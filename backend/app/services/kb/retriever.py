"""
Retriever Service (MVP)
Performs semantic search over indexed documents
"""
import json
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text, func

from app.models.kb import KBChunk
from app.services.kb.embedding_service import get_embedding_service


class SearchResult:
    """Represents a search result"""
    def __init__(
        self,
        chunk_id: str,
        chunk_text: str,
        document_id: Optional[str],
        project_id: str,
        similarity_score: float,
        metadata: Dict[str, Any],
        keywords: List[str] = None
    ):
        self.chunk_id = chunk_id
        self.chunk_text = chunk_text
        self.document_id = document_id
        self.project_id = project_id
        self.similarity_score = similarity_score
        self.metadata = metadata
        self.keywords = keywords or []

    def to_dict(self) -> Dict[str, Any]:
        return {
            'chunk_id': self.chunk_id,
            'chunk_text': self.chunk_text,
            'document_id': self.document_id,
            'project_id': self.project_id,
            'similarity_score': self.similarity_score,
            'metadata': self.metadata,
            'keywords': self.keywords
        }


class RetrieverService:
    """Retrieve relevant chunks using vector similarity search"""

    def __init__(self):
        self.embedder = get_embedding_service()

    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """
        Compute cosine similarity between two vectors

        Args:
            vec1: First vector
            vec2: Second vector

        Returns:
            Cosine similarity score (0-1)
        """
        import math

        # Compute dot product
        dot_product = sum(a * b for a, b in zip(vec1, vec2))

        # Compute magnitudes
        magnitude1 = math.sqrt(sum(a * a for a in vec1))
        magnitude2 = math.sqrt(sum(b * b for b in vec2))

        # Avoid division by zero
        if magnitude1 == 0 or magnitude2 == 0:
            return 0.0

        # Return cosine similarity
        return dot_product / (magnitude1 * magnitude2)

    def _extract_keywords(self, query: str) -> List[str]:
        """
        Extract keywords from search query for highlighting

        Args:
            query: Search query

        Returns:
            List of keywords
        """
        import re
        # Remove common stop words and extract meaningful words
        stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'}
        words = re.findall(r'\w+', query.lower())
        keywords = [w for w in words if len(w) > 2 and w not in stop_words]
        return keywords

    async def search(
        self,
        db: AsyncSession,
        query: str,
        project_id: Optional[str] = None,
        top_k: int = 10,
        min_similarity: float = 0.3,
        document_id: Optional[str] = None
    ) -> List[SearchResult]:
        """
        Search knowledge base using semantic similarity

        Args:
            db: Database session
            query: Search query
            project_id: Optional UUID of project to search within (None = search all projects)
            top_k: Number of results to return
            min_similarity: Minimum similarity threshold (0-1)
            document_id: Optional - limit search to specific document

        Returns:
            List of SearchResult objects
        """
        # Generate query embedding
        query_embedding = await self.embedder.embed_text(query)

        # Build SQL query to fetch chunks
        # Since MySQL doesn't have native vector operations, we'll compute similarity in Python
        where_clauses = []
        params = {}

        if project_id:
            where_clauses.append("project_id = :project_id")
            params['project_id'] = project_id

        if document_id:
            where_clauses.append("document_id = :document_id")
            params['document_id'] = document_id

        where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        sql_query = text(f"""
            SELECT
                id,
                chunk_text,
                document_id,
                project_id,
                metadata,
                embedding
            FROM kb_chunks
            {where_sql}
        """)

        # Execute query
        result = await db.execute(sql_query, params)
        rows = result.fetchall()

        # Extract keywords from query for highlighting
        keywords = self._extract_keywords(query)

        # Compute cosine similarity for each chunk in Python
        search_results = []
        for row in rows:
            # Parse the embedding from JSON
            chunk_embedding = json.loads(row.embedding) if isinstance(row.embedding, str) else row.embedding

            # Compute cosine similarity
            similarity = self._cosine_similarity(query_embedding, chunk_embedding)

            # Filter by minimum similarity
            if similarity < min_similarity:
                continue

            metadata = json.loads(row.metadata) if row.metadata else {}

            search_result = SearchResult(
                chunk_id=row.id,
                chunk_text=row.chunk_text,
                document_id=row.document_id,
                project_id=row.project_id,
                similarity_score=float(similarity),
                metadata=metadata,
                keywords=keywords
            )
            search_results.append(search_result)

        # Sort by similarity score (descending) and limit results
        search_results.sort(key=lambda x: x.similarity_score, reverse=True)
        return search_results[:top_k]

    async def hybrid_search(
        self,
        db: AsyncSession,
        query: str,
        project_id: str,
        top_k: int = 10,
        min_similarity: float = 0.3,
        keyword_weight: float = 0.3,
        document_id: Optional[str] = None
    ) -> List[SearchResult]:
        """
        Hybrid search combining vector similarity and keyword matching

        Args:
            db: Database session
            query: Search query
            project_id: UUID of project
            top_k: Number of results
            min_similarity: Minimum similarity threshold
            keyword_weight: Weight for keyword score (0-1)
            document_id: Optional document filter

        Returns:
            List of SearchResult objects
        """
        # Generate query embedding
        query_embedding = await self.embedder.embed_text(query)
        query_vector_str = json.dumps(query_embedding)

        # Hybrid search: vector similarity + full-text search
        sql_query = text("""
            WITH vector_results AS (
                SELECT
                    id,
                    chunk_text,
                    document_id,
                    project_id,
                    metadata,
                    1 - (embedding::vector <=> :query_vector::vector) as vector_score
                FROM kb_chunks
                WHERE project_id = :project_id
                """ + ("AND document_id = :document_id" if document_id else "") + """
            ),
            keyword_results AS (
                SELECT
                    id,
                    ts_rank(to_tsvector('english', chunk_text), plainto_tsquery('english', :query)) as keyword_score
                FROM kb_chunks
                WHERE project_id = :project_id
                """ + ("AND document_id = :document_id" if document_id else "") + """
                AND to_tsvector('english', chunk_text) @@ plainto_tsquery('english', :query)
            )
            SELECT
                v.id,
                v.chunk_text,
                v.document_id,
                v.project_id,
                v.metadata,
                (1 - :keyword_weight) * v.vector_score +
                :keyword_weight * COALESCE(k.keyword_score, 0) as combined_score
            FROM vector_results v
            LEFT JOIN keyword_results k ON v.id = k.id
            WHERE v.vector_score >= :min_similarity
            ORDER BY combined_score DESC
            LIMIT :top_k
        """)

        params = {
            'query_vector': query_vector_str,
            'query': query,
            'project_id': project_id,
            'top_k': top_k,
            'min_similarity': min_similarity,
            'keyword_weight': keyword_weight
        }

        if document_id:
            params['document_id'] = document_id

        # Execute query
        result = await db.execute(sql_query, params)
        rows = result.fetchall()

        # Convert to SearchResult objects
        search_results = []
        for row in rows:
            metadata = json.loads(row.metadata) if row.metadata else {}

            search_result = SearchResult(
                chunk_id=row.id,
                chunk_text=row.chunk_text,
                document_id=row.document_id,
                project_id=row.project_id,
                similarity_score=float(row.combined_score),
                metadata=metadata
            )
            search_results.append(search_result)

        return search_results

    async def get_document_chunks(
        self,
        db: AsyncSession,
        document_id: str
    ) -> List[Dict[str, Any]]:
        """
        Get all chunks for a document (for summarization)

        Args:
            db: Database session
            document_id: UUID of document

        Returns:
            List of chunk dicts
        """
        result = await db.execute(
            select(KBChunk)
            .where(KBChunk.document_id == document_id)
            .order_by(text("(metadata->>'chunk_index')::int"))
        )
        chunks = result.scalars().all()

        return [
            {
                'id': chunk.id,
                'text': chunk.chunk_text,
                'metadata': json.loads(chunk.meta) if chunk.meta else {}
            }
            for chunk in chunks
        ]


# Singleton instance
_retriever_instance = None

def get_retriever() -> RetrieverService:
    """Get singleton RetrieverService instance"""
    global _retriever_instance
    if _retriever_instance is None:
        _retriever_instance = RetrieverService()
    return _retriever_instance
