# ============================================
# FILE: app/services/embedding_service.py
# Embedding Generation Service - Pipeline Component #4
# Crawl → Extract → Chunk → [INDEX/EMBED] → Search
# ============================================
"""
Embedding Service

Generates vector embeddings for text using sentence-transformers.
Also provides similarity search and ranking utilities.

Model: all-MiniLM-L6-v2 (384 dimensions)
- Fast inference
- Good quality for semantic search
- ~90MB model size

Usage:
    embedding = await EmbeddingService.generate_embedding("Hello world")
    embeddings = await EmbeddingService.generate_embeddings_batch(["Hello", "World"])
    similar = EmbeddingService.find_most_similar(query_emb, candidate_embs, top_k=10)
"""
import numpy as np
from typing import List, Optional, Tuple, Dict, Any
import logging
import time

logger = logging.getLogger(__name__)


class EmbeddingService:
    """
    Service for generating text embeddings using sentence-transformers.
    
    Uses lazy loading to avoid loading model until needed.
    Thread-safe for concurrent requests.
    """
    
    _model = None
    _model_name = "all-MiniLM-L6-v2"  # 384 dimensions, fast & good quality
    _dimension = 384
    _loading = False
    
    @classmethod
    def get_model(cls):
        """Lazy load the embedding model"""
        if cls._model is None and not cls._loading:
            cls._loading = True
            try:
                from sentence_transformers import SentenceTransformer
                logger.info(f"Loading embedding model: {cls._model_name}")
                start = time.time()
                cls._model = SentenceTransformer(cls._model_name)
                elapsed = time.time() - start
                logger.info(f"Embedding model loaded in {elapsed:.2f}s")
            except ImportError:
                logger.error("sentence-transformers not installed")
                logger.error("Run: pip install sentence-transformers")
                raise ImportError("sentence-transformers package required")
            except Exception as e:
                logger.error(f"Failed to load embedding model: {e}")
                raise
            finally:
                cls._loading = False
        return cls._model
    
    @classmethod
    def get_dimension(cls) -> int:
        """Get the embedding dimension"""
        return cls._dimension
    
    @classmethod
    def get_model_name(cls) -> str:
        """Get the model name"""
        return cls._model_name
    
    @classmethod
    async def generate_embedding(cls, text: str) -> List[float]:
        """
        Generate embedding for a single text.
        
        Args:
            text: Input text to embed
            
        Returns:
            List of floats representing the embedding vector (384 dims)
        """
        if not text or not text.strip():
            # Return zero vector for empty text
            return [0.0] * cls._dimension
        
        try:
            model = cls.get_model()
            
            # Truncate very long texts (model max is ~512 tokens)
            text = text[:8000]  # ~2000 tokens roughly
            
            # Generate embedding
            embedding = model.encode(
                text,
                convert_to_numpy=True,
                normalize_embeddings=True  # L2 normalize for cosine similarity
            )
            
            return embedding.tolist()
            
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            # Return zero vector on failure (will have 0 similarity)
            return [0.0] * cls._dimension
    
    @classmethod
    async def generate_embeddings_batch(
        cls,
        texts: List[str],
        batch_size: int = 32,
        show_progress: bool = False
    ) -> List[List[float]]:
        """
        Generate embeddings for multiple texts efficiently.
        
        Args:
            texts: List of input texts
            batch_size: Number of texts to process at once
            show_progress: Show progress bar for large batches
            
        Returns:
            List of embedding vectors (same order as input)
        """
        if not texts:
            return []
        
        try:
            model = cls.get_model()
            
            # Track which texts are empty
            non_empty_indices = []
            non_empty_texts = []
            
            for i, text in enumerate(texts):
                if text and text.strip():
                    non_empty_indices.append(i)
                    # Truncate long texts
                    non_empty_texts.append(text[:8000])
            
            if not non_empty_texts:
                # All texts were empty
                return [[0.0] * cls._dimension for _ in texts]
            
            # Generate embeddings in batches
            embeddings = model.encode(
                non_empty_texts,
                batch_size=batch_size,
                convert_to_numpy=True,
                normalize_embeddings=True,
                show_progress_bar=show_progress and len(non_empty_texts) > 100
            )
            
            # Reconstruct full list with zero vectors for empty texts
            result = [[0.0] * cls._dimension for _ in texts]
            for idx, embedding in zip(non_empty_indices, embeddings):
                result[idx] = embedding.tolist()
            
            return result
            
        except Exception as e:
            logger.error(f"Batch embedding generation failed: {e}")
            return [[0.0] * cls._dimension for _ in texts]
    
    @classmethod
    def cosine_similarity(
        cls,
        embedding1: List[float],
        embedding2: List[float]
    ) -> float:
        """
        Calculate cosine similarity between two embeddings.
        
        Since embeddings are L2 normalized, this is just the dot product.
        
        Returns:
            Similarity score between -1 and 1 (higher = more similar)
        """
        try:
            a = np.array(embedding1, dtype=np.float32)
            b = np.array(embedding2, dtype=np.float32)
            
            # For normalized vectors, cosine similarity = dot product
            similarity = float(np.dot(a, b))
            
            # Clamp to valid range (handles numerical errors)
            return max(-1.0, min(1.0, similarity))
            
        except Exception as e:
            logger.error(f"Similarity calculation failed: {e}")
            return 0.0
    
    @classmethod
    def find_most_similar(
        cls,
        query_embedding: List[float],
        candidate_embeddings: List[List[float]],
        top_k: int = 10,
        threshold: float = 0.0
    ) -> List[Tuple[int, float]]:
        """
        Find the most similar embeddings to a query.
        
        Uses vectorized operations for efficiency.
        
        Args:
            query_embedding: The query vector
            candidate_embeddings: List of candidate vectors
            top_k: Number of results to return
            threshold: Minimum similarity threshold (0-1)
            
        Returns:
            List of (index, similarity_score) tuples, sorted by score descending
        """
        if not candidate_embeddings:
            return []
        
        try:
            query = np.array(query_embedding, dtype=np.float32)
            candidates = np.array(candidate_embeddings, dtype=np.float32)
            
            # Calculate all similarities at once (dot product for normalized vectors)
            similarities = np.dot(candidates, query)
            
            # Apply threshold
            if threshold > 0:
                valid_mask = similarities >= threshold
                valid_indices = np.where(valid_mask)[0]
                valid_similarities = similarities[valid_mask]
            else:
                valid_indices = np.arange(len(similarities))
                valid_similarities = similarities
            
            if len(valid_similarities) == 0:
                return []
            
            # Get top-k indices
            if len(valid_similarities) <= top_k:
                top_local_indices = np.argsort(valid_similarities)[::-1]
            else:
                # Use argpartition for efficiency with large arrays
                top_local_indices = np.argpartition(valid_similarities, -top_k)[-top_k:]
                top_local_indices = top_local_indices[np.argsort(valid_similarities[top_local_indices])[::-1]]
            
            # Map back to original indices
            results = [
                (int(valid_indices[i]), float(valid_similarities[i]))
                for i in top_local_indices
            ]
            
            return results
            
        except Exception as e:
            logger.error(f"Similarity search failed: {e}")
            return []
    
    @classmethod
    def is_zero_vector(cls, embedding: List[float]) -> bool:
        """Check if embedding is a zero vector (failed/empty)"""
        return all(v == 0.0 for v in embedding[:10])  # Just check first 10


class HybridSearchScorer:
    """
    Combines keyword and semantic search scores with configurable weights.
    
    Implements a ranking formula that balances:
    - Keyword match precision (BM25-style)
    - Semantic similarity (vector cosine)
    - Recency boost
    - Title/exact match boost
    """
    
    # Default weights (tunable per deployment)
    KEYWORD_WEIGHT = 0.4
    SEMANTIC_WEIGHT = 0.6
    
    # Boost factors
    EXACT_MATCH_BOOST = 1.5
    TITLE_MATCH_BOOST = 1.3
    RECENCY_BOOST_MAX = 1.2  # Max boost for very recent docs
    RECENCY_DECAY_DAYS = 365  # Days until recency boost = 1.0
    
    @classmethod
    def combine_scores(
        cls,
        keyword_score: float,
        semantic_score: float,
        exact_match: bool = False,
        title_match: bool = False,
        days_old: int = 0,
        keyword_weight: Optional[float] = None,
        semantic_weight: Optional[float] = None
    ) -> float:
        """
        Combine multiple scoring signals into a single relevance score.
        
        Args:
            keyword_score: Score from keyword/FTS search (0-1 normalized)
            semantic_score: Score from semantic search (0-1 normalized)
            exact_match: Whether query appears exactly in text
            title_match: Whether query matches document title
            days_old: Age of the document in days
            keyword_weight: Override default keyword weight
            semantic_weight: Override default semantic weight
            
        Returns:
            Combined score (can exceed 1.0 with boosts)
        """
        # Use provided weights or defaults
        kw_weight = keyword_weight if keyword_weight is not None else cls.KEYWORD_WEIGHT
        sem_weight = semantic_weight if semantic_weight is not None else cls.SEMANTIC_WEIGHT
        
        # Normalize weights
        total_weight = kw_weight + sem_weight
        if total_weight > 0:
            kw_weight /= total_weight
            sem_weight /= total_weight
        
        # Base combined score
        base_score = (kw_weight * keyword_score) + (sem_weight * semantic_score)
        
        # Apply exact match boost
        if exact_match:
            base_score *= cls.EXACT_MATCH_BOOST
        
        # Apply title match boost
        if title_match:
            base_score *= cls.TITLE_MATCH_BOOST
        
        # Apply recency boost (decays linearly over RECENCY_DECAY_DAYS)
        if days_old < cls.RECENCY_DECAY_DAYS:
            decay_factor = 1.0 - (days_old / cls.RECENCY_DECAY_DAYS)
            recency_boost = 1.0 + (cls.RECENCY_BOOST_MAX - 1.0) * decay_factor
            base_score *= recency_boost
        
        return base_score
    
    @classmethod
    def normalize_keyword_score(cls, score: float, max_score: float = 100.0) -> float:
        """
        Normalize BM25/FTS score to 0-1 range.
        
        FTS scores can vary widely, so we use a logarithmic normalization.
        """
        if score <= 0 or max_score <= 0:
            return 0.0
        
        # Log normalization for better distribution
        import math
        normalized = math.log1p(score) / math.log1p(max_score)
        return min(1.0, max(0.0, normalized))
    
    @classmethod
    def normalize_semantic_score(cls, score: float) -> float:
        """
        Normalize cosine similarity (-1 to 1) to 0-1 range.
        
        In practice, most semantic scores are between 0.3-0.9
        """
        # Map [-1, 1] to [0, 1]
        normalized = (score + 1.0) / 2.0
        return min(1.0, max(0.0, normalized))
