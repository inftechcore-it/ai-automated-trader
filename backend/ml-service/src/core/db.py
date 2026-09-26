"""
Async MySQL Database Client
Handles connection pooling and vector similarity search for AI-BDM Knowledge Base and RAG.
"""
import logging
import json
import re
from typing import List, Dict, Any, Optional
import numpy as np
try:
    import aiomysql
except ImportError:
    aiomysql = None
from src.core.config import settings

logger = logging.getLogger("rag.db")

def _convert_pg_placeholders_to_mysql(query: str) -> str:
    """Converts Postgres $1, $2 placeholders to MySQL %s placeholders if needed."""
    return re.sub(r'\$\d+', '%s', query)

class DatabasePool:
    """Async connection pool manager for MySQL"""
    _pool: Optional[Any] = None

    @classmethod
    async def get_pool(cls):
        if aiomysql is None:
            raise ImportError(
                "aiomysql is not installed. Please run `pip install aiomysql pymysql` to enable MySQL database connectivity."
            )

        if cls._pool is None or cls._pool._closed:
            params = settings.mysql_connection_params
            logger.info(f"Initializing MySQL connection pool to {params.get('host')}:{params.get('port')}/{params.get('db')}")
            cls._pool = await aiomysql.create_pool(
                host=params["host"],
                port=params["port"],
                user=params["user"],
                password=params["password"],
                db=params["db"],
                charset=params.get("charset", "utf8mb4"),
                autocommit=True,
                minsize=2,
                maxsize=10,
                cursorclass=aiomysql.DictCursor
            )
        return cls._pool

    @classmethod
    async def close(cls):
        if cls._pool is not None and not cls._pool._closed:
            cls._pool.close()
            await cls._pool.wait_closed()
            cls._pool = None
            logger.info("MySQL connection pool closed.")

    @classmethod
    async def execute(cls, query: str, *args) -> int:
        pool = await cls.get_pool()
        query = _convert_pg_placeholders_to_mysql(query)
        async with pool.acquire() as conn:
            async with conn.cursor() as cursor:
                # If single argument is list/tuple, pass as args
                if len(args) == 1 and isinstance(args[0], (list, tuple)):
                    params = args[0]
                else:
                    params = args
                return await cursor.execute(query, params)

    @classmethod
    async def fetch(cls, query: str, *args) -> List[Dict[str, Any]]:
        pool = await cls.get_pool()
        query = _convert_pg_placeholders_to_mysql(query)
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cursor:
                if len(args) == 1 and isinstance(args[0], (list, tuple)):
                    params = args[0]
                else:
                    params = args
                await cursor.execute(query, params)
                return await cursor.fetchall()

    @classmethod
    async def fetchrow(cls, query: str, *args) -> Optional[Dict[str, Any]]:
        pool = await cls.get_pool()
        query = _convert_pg_placeholders_to_mysql(query)
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cursor:
                if len(args) == 1 and isinstance(args[0], (list, tuple)):
                    params = args[0]
                else:
                    params = args
                await cursor.execute(query, params)
                return await cursor.fetchone()

    @classmethod
    async def fetchval(cls, query: str, *args) -> Any:
        row = await cls.fetchrow(query, *args)
        if row and isinstance(row, dict):
            return next(iter(row.values()), None)
        return None

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
        Performs Cosine Similarity vector search on records stored in MySQL.
        Calculates cosine distance via fast vectorized numpy operations.
        Returns top_k matching records ranked by similarity score.
        """
        filter_params = filter_params or []
        where_clause = f"WHERE {filter_sql}" if filter_sql else ""
        query = f"SELECT * FROM `{table_name}` {where_clause};"
        
        records = await cls.fetch(query, *filter_params)
        if not records:
            return []

        q_vec = np.array(query_vector, dtype=np.float32)
        q_norm = np.linalg.norm(q_vec)
        if q_norm == 0:
            return records[:top_k]

        scored_records = []
        for r in records:
            raw_emb = r.get("embedding")
            if raw_emb is None:
                continue
            
            if isinstance(raw_emb, str):
                try:
                    emb = json.loads(raw_emb)
                except Exception:
                    continue
            elif isinstance(raw_emb, (list, tuple)):
                emb = raw_emb
            else:
                continue

            if not emb or len(emb) != len(query_vector):
                continue

            emb_arr = np.array(emb, dtype=np.float32)
            emb_norm = np.linalg.norm(emb_arr)
            if emb_norm == 0:
                sim = 0.0
            else:
                sim = float(np.dot(q_vec, emb_arr) / (q_norm * emb_norm))

            # Store similarity score
            record_copy = dict(r)
            record_copy["similarity_score"] = sim
            scored_records.append(record_copy)

        scored_records.sort(key=lambda x: x["similarity_score"], reverse=True)
        return scored_records[:top_k]

db = DatabasePool
