"""
Async PostgreSQL + pgvector Database Client
Handles connection pooling, pgvector type registration, and vector similarity queries.
"""
import logging
import json
from typing import List, Dict, Any, Optional
from src.core.config import settings

logger = logging.getLogger("rag.db")

class DatabasePool:
    """Async connection pool manager for PostgreSQL with pgvector"""
    _pool: Optional[Any] = None

    @classmethod
    async def get_pool(cls):
        try:
            import asyncpg
        except ImportError:
            raise ImportError(
                "asyncpg is not installed. Please run `pip install -r backend/ml-service/requirements.txt` to enable PostgreSQL database connectivity."
            )

        if cls._pool is None or cls._pool._closed:
            dsn = settings.postgres_connection_url
            # Clean DSN schema query parameter if present for asyncpg
            if "?schema=" in dsn:
                dsn = dsn.split("?schema=")[0]
            
            logger.info(f"Initializing PostgreSQL connection pool to {dsn.split('@')[-1] if '@' in dsn else dsn}")
            cls._pool = await asyncpg.create_pool(
                dsn=dsn,
                min_size=2,
                max_size=10,
                init=cls._init_connection,
                command_timeout=30.0
            )
        return cls._pool

    @classmethod
    async def _init_connection(cls, conn):
        """Register pgvector extension codec on every new connection"""
        try:
            await conn.execute("CREATE EXTENSION IF NOT EXISTS vector;")
            try:
                from pgvector.asyncpg import register_vector
                await register_vector(conn)
            except ImportError:
                pass
        except Exception as e:
            logger.warning(f"Could not register pgvector on connection initialization (extension may need superuser): {e}")

    @classmethod
    async def close(cls):
        if cls._pool is not None and not cls._pool._closed:
            await cls._pool.close()
            cls._pool = None
            logger.info("PostgreSQL connection pool closed.")

    @classmethod
    async def execute(cls, query: str, *args) -> str:
        pool = await cls.get_pool()
        async with pool.acquire() as conn:
            return await conn.execute(query, *args)

    @classmethod
    async def fetch(cls, query: str, *args) -> List[Any]:
        pool = await cls.get_pool()
        async with pool.acquire() as conn:
            return await conn.fetch(query, *args)

    @classmethod
    async def fetchrow(cls, query: str, *args) -> Optional[Any]:
        pool = await cls.get_pool()
        async with pool.acquire() as conn:
            return await conn.fetchrow(query, *args)

    @classmethod
    async def fetchval(cls, query: str, *args) -> Any:
        pool = await cls.get_pool()
        async with pool.acquire() as conn:
            return await conn.fetchval(query, *args)

    @classmethod
    async def vector_similarity_search(
        cls,
        table_name: str,
        query_vector: List[float],
        top_k: int = 5,
        filter_sql: Optional[str] = None,
        filter_params: Optional[List[Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Performs Cosine Distance vector similarity search with HNSW index acceleration.
        Returns top_k matching records ranked by similarity score (1.0 - cosine_distance).
        """
        pool = await cls.get_pool()
        filter_params = filter_params or []
        
        where_clause = f"WHERE {filter_sql}" if filter_sql else ""
        vector_param_idx = len(filter_params) + 1
        limit_param_idx = len(filter_params) + 2

        query = f"""
            SELECT *,
                   1.0 - (embedding <=> ${vector_param_idx}::vector) AS similarity_score
            FROM {table_name}
            {where_clause}
            ORDER BY embedding <=> ${vector_param_idx}::vector ASC
            LIMIT ${limit_param_idx};
        """

        params = [*filter_params, query_vector, top_k]
        async with pool.acquire() as conn:
            records = await conn.fetch(query, *params)
            return [dict(r) for r in records]

db = DatabasePool
