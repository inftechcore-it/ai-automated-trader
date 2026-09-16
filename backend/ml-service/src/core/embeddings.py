"""
Embedding Service using Google Gemini text-embedding-004 (768 Dimensions)
Includes batching, exponential backoff, rate limiting, and offline fallback.
"""
import os
import time
import logging
import hashlib
import numpy as np
from typing import List, Optional
try:
    import google.generativeai as genai
    HAS_GENAI = True
except ImportError:
    genai = None
    HAS_GENAI = False

from src.core.config import settings

logger = logging.getLogger("rag.embeddings")

class GeminiEmbedder:
    """Embedder using Gemini text-embedding-004 with 768 output dimensions"""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.model = settings.EMBEDDING_MODEL
        self.dimensions = settings.EMBEDDING_DIMENSIONS
        self._is_configured = False
        self._setup_client()

    def _setup_client(self):
        if self.api_key and HAS_GENAI:
            try:
                genai.configure(api_key=self.api_key)
                self._is_configured = True
                logger.info(f"Gemini Embedder configured successfully with model {self.model}")
            except Exception as e:
                logger.warning(f"Failed to configure Gemini client: {e}. Fallback embedder will be used.")
                self._is_configured = False
        elif not HAS_GENAI:
            logger.info("google-generativeai package not yet installed. Running with 768-dim deterministic fallback vectors.")
            self._is_configured = False
        else:
            logger.warning("No GEMINI_API_KEY found. Running in fallback embedding mode.")
            self._is_configured = False

    def embed_text(self, text: str, task_type: str = "RETRIEVAL_DOCUMENT") -> List[float]:
        """Embeds a single text string into a 768-dimensional float vector"""
        if not text or not text.strip():
            return [0.0] * self.dimensions

        # Clean text
        clean_text = text.strip()[:8000]

        if self._is_configured:
            for attempt in range(4):
                try:
                    result = genai.embed_content(
                        model=self.model,
                        content=clean_text,
                        task_type=task_type
                    )
                    embedding = result['embedding']
                    # Verify dimensions
                    if len(embedding) == self.dimensions:
                        return embedding
                    elif len(embedding) > self.dimensions:
                        return embedding[:self.dimensions]
                    else:
                        # Pad with zeros if needed
                        return embedding + [0.0] * (self.dimensions - len(embedding))
                except Exception as e:
                    wait_time = (2 ** attempt) * 0.5
                    logger.warning(f"Gemini embedding attempt {attempt + 1} failed: {e}. Retrying in {wait_time}s...")
                    time.sleep(wait_time)
            
            logger.error("All Gemini embedding attempts failed. Using deterministic fallback vector.")

        return self._generate_deterministic_embedding(clean_text)

    def embed_query(self, query: str) -> List[float]:
        """Embeds a search query using RETRIEVAL_QUERY task type"""
        return self.embed_text(query, task_type="RETRIEVAL_QUERY")

    def embed_documents(self, documents: List[str], batch_size: int = 10) -> List[List[float]]:
        """Batch embeds a list of documents with rate-limiting pauses"""
        embeddings = []
        for i in range(0, len(documents), batch_size):
            batch = documents[i : i + batch_size]
            for doc in batch:
                embeddings.append(self.embed_text(doc))
            if self._is_configured and i + batch_size < len(documents):
                time.sleep(0.2)  # Respect API quota
        return embeddings

    def _generate_deterministic_embedding(self, text: str) -> List[float]:
        """
        Generates a deterministic, normalized 768-dimensional pseudo-semantic embedding
        based on hash digest and token features. Used as a zero-crash resilience fallback.
        """
        # Create deterministic seed from SHA-256 of text
        h = hashlib.sha256(text.encode("utf-8")).digest()
        seed = int.from_bytes(h[:4], "big")
        rng = np.random.default_rng(seed)
        
        # Base normal vector
        vector = rng.standard_normal(self.dimensions).astype(np.float32)
        
        # Modulate with character n-grams to capture token similarity
        words = text.lower().split()
        for idx, word in enumerate(words[:50]):
            word_hash = int.from_bytes(hashlib.md5(word.encode()).digest()[:4], "big")
            slot = word_hash % self.dimensions
            vector[slot] += (1.0 / (idx + 1.0)) * 2.0
            
        # L2-normalize to unit length for cosine similarity
        norm = np.linalg.norm(vector)
        if norm > 0:
            vector = vector / norm
            
        return vector.tolist()

# Global default embedder instance
embedder = GeminiEmbedder()
