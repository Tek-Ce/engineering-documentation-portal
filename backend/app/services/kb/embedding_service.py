"""
Embedding Service (MVP)
Generates vector embeddings using sentence-transformers
"""
import asyncio
from typing import List, Optional
import numpy as np

try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    SentenceTransformer = None


class EmbeddingService:
    """Generate embeddings for text using sentence-transformers"""

    def __init__(
        self,
        model_name: str = "BAAI/bge-small-en-v1.5",
        batch_size: int = 32,
        device: Optional[str] = None
    ):
        """
        Initialize embedding service

        Args:
            model_name: HuggingFace model name
            batch_size: Batch size for embedding generation
            device: 'cuda', 'cpu', or None (auto-detect)
        """
        if not SentenceTransformer:
            raise ImportError("sentence-transformers not installed. Run: pip install sentence-transformers")

        self.model_name = model_name
        self.batch_size = batch_size
        self.device = device

        # Load model lazily
        self._model: Optional[SentenceTransformer] = None

    @property
    def model(self) -> SentenceTransformer:
        """Lazy load the model"""
        if self._model is None:
            self._model = SentenceTransformer(
                self.model_name,
                device=self.device
            )
        return self._model

    async def embed_text(self, text: str) -> List[float]:
        """
        Generate embedding for a single text

        Args:
            text: Text to embed

        Returns:
            List of floats (384 dimensions for bge-small-en-v1.5)
        """
        embeddings = await self.embed_batch([text])
        return embeddings[0]

    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for multiple texts

        Args:
            texts: List of texts to embed

        Returns:
            List of embeddings (each is 384 floats)
        """
        if not texts:
            return []

        # Run embedding in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        embeddings = await loop.run_in_executor(
            None,
            self._embed_sync,
            texts
        )

        return embeddings

    def _embed_sync(self, texts: List[str]) -> List[List[float]]:
        """Synchronous embedding generation"""
        # Encode texts
        embeddings = self.model.encode(
            texts,
            batch_size=self.batch_size,
            show_progress_bar=False,
            convert_to_numpy=True,
            normalize_embeddings=True  # For cosine similarity
        )

        # Convert numpy array to list of lists
        return embeddings.tolist()

    def get_embedding_dim(self) -> int:
        """Get embedding dimension"""
        # bge-small-en-v1.5 returns 384 dimensions
        return self.model.get_sentence_embedding_dimension()


# Singleton instance
_embedding_service_instance = None

def get_embedding_service() -> EmbeddingService:
    """Get singleton EmbeddingService instance"""
    global _embedding_service_instance
    if _embedding_service_instance is None:
        _embedding_service_instance = EmbeddingService(
            model_name="BAAI/bge-small-en-v1.5",
            batch_size=32,
            device=None  # Auto-detect
        )
    return _embedding_service_instance
