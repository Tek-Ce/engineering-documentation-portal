# ============================================
# FILE: app/services/search_service.py
# Search Service - Pipeline Component #5
# Crawl → Extract → Chunk → Index → [SEARCH]
# ============================================
"""
Search Service

Implements hybrid search combining:
- Keyword search (SQL LIKE / FULLTEXT matching)
- Semantic search (vector cosine similarity)
- Combined ranking with configurable weights

Features:
- Full-text search across all indexed chunks
- AI-powered semantic similarity
- Result highlighting and snippets
- Filtering by project, date, document type
- Pagination and result limiting

Usage:
    results = await SearchService.search(
        db,
        query="JWT authentication error",
        project_id="...",
        limit=20
    )
"""
import time
import re
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_, text

from app.models.kb import KBChunk
from app.models.document import Document
from app.models.project import Project
from app.services.embedding_service import EmbeddingService, HybridSearchScorer

logger = logging.getLogger(__name__)


@dataclass
class SearchResult:
    """Internal search result representation"""
    chunk_id: str
    document_id: Optional[str]
    project_id: str
    text: str
    highlight: str
    source_type: str
    file_name: Optional[str]
    file_path: Optional[str]
    document_title: Optional[str]
    project_name: Optional[str]
    score: float
    keyword_score: float
    semantic_score: float
    chunk_index: int
    total_chunks: int
    created_at: datetime


class SearchService:
    """
    Hybrid search service.
    
    Combines keyword search (fast, precise) with semantic search (smart, contextual)
    to provide relevant results for user queries.
    """
    
    # Configuration
    DEFAULT_LIMIT = 20
    MAX_LIMIT = 100
    SNIPPET_LENGTH = 250
    HIGHLIGHT_START = "<mark>"
    HIGHLIGHT_END = "</mark>"
    
    # Search weights (can be tuned)
    KEYWORD_WEIGHT = 0.4
    SEMANTIC_WEIGHT = 0.6
    
    # Minimum scores to include results
    MIN_KEYWORD_SCORE = 0.01
    MIN_SEMANTIC_SCORE = 0.3
    
    @classmethod
    async def search(
        cls,
        db: AsyncSession,
        query: str,
        project_id: Optional[str] = None,
        document_types: Optional[List[str]] = None,
        file_types: Optional[List[str]] = None,
        limit: int = DEFAULT_LIMIT,
        offset: int = 0,
        use_semantic: bool = True,
        use_keyword: bool = True,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        boost_recent: bool = True
    ) -> Dict[str, Any]:
        """
        Perform hybrid search across the knowledge base.
        
        Args:
            db: Database session
            query: Search query text
            project_id: Filter by project (optional)
            document_types: Filter by document types (optional)
            file_types: Filter by file extensions (optional)
            limit: Maximum results to return
            offset: Pagination offset
            use_semantic: Enable semantic/vector search
            use_keyword: Enable keyword/FTS search
            date_from: Filter by date range start
            date_to: Filter by date range end
            boost_recent: Apply recency boost to ranking
            
        Returns:
            Dict with search results and metadata
        """
        start_time = time.time()
        
        # Validate and clean inputs
        limit = min(limit, cls.MAX_LIMIT)
        query = query.strip()
        
        if not query:
            return cls._empty_response(query, 0)
        
        results: List[SearchResult] = []
        keyword_time = 0
        semantic_time = 0
        
        try:
            # Run keyword search
            keyword_results = {}
            if use_keyword:
                kw_start = time.time()
                keyword_results = await cls._keyword_search(
                    db, query, project_id, limit * 3
                )
                keyword_time = int((time.time() - kw_start) * 1000)
            
            # Run semantic search
            semantic_results = {}
            if use_semantic:
                sem_start = time.time()
                semantic_results = await cls._semantic_search(
                    db, query, project_id, limit * 3
                )
                semantic_time = int((time.time() - sem_start) * 1000)
            
            # Merge and rank results
            results = await cls._merge_and_rank_results(
                db,
                keyword_results,
                semantic_results,
                query,
                boost_recent=boost_recent
            )
            
            # Apply additional filters
            results = cls._apply_filters(
                results,
                document_types=document_types,
                file_types=file_types,
                date_from=date_from,
                date_to=date_to
            )
            
            # Get total before pagination
            total_results = len(results)
            
            # Apply pagination
            results = results[offset:offset + limit]
            
        except Exception as e:
            logger.error(f"Search failed: {e}", exc_info=True)
            return cls._empty_response(query, int((time.time() - start_time) * 1000))
        
        search_time_ms = int((time.time() - start_time) * 1000)
        
        return {
            "query": query,
            "total_results": total_results,
            "results": [cls._to_dict(r) for r in results],
            "search_time_ms": search_time_ms,
            "keyword_time_ms": keyword_time,
            "semantic_time_ms": semantic_time,
            "limit": limit,
            "offset": offset,
            "has_more": total_results > offset + limit,
            "used_semantic": use_semantic,
            "used_keyword": use_keyword
        }
    
    @classmethod
    async def _keyword_search(
        cls,
        db: AsyncSession,
        query: str,
        project_id: Optional[str],
        limit: int
    ) -> Dict[str, float]:
        """
        Perform keyword search using MySQL FULLTEXT (with LIKE fallback).
        
        Returns dict of chunk_id -> keyword_score
        """
        results = {}
        
        try:
            # Try FULLTEXT search first (MySQL)
            fulltext_results = await cls._fulltext_search(db, query, project_id, limit)
            if fulltext_results:
                return fulltext_results
            
            # Fallback to LIKE search
            terms = cls._tokenize_query(query)
            
            if not terms:
                return results
            
            # Build WHERE conditions for each term
            conditions = []
            for term in terms:
                # Case-insensitive LIKE search
                conditions.append(
                    func.lower(KBChunk.chunk_text).contains(term.lower())
                )
            
            # Build query - match any term
            stmt = select(KBChunk.id, KBChunk.chunk_text).where(
                or_(*conditions)
            )
            
            # Filter by project if specified
            if project_id:
                stmt = stmt.where(KBChunk.project_id == project_id)
            
            stmt = stmt.limit(limit * 2)  # Get extra for scoring
            
            result = await db.execute(stmt)
            rows = result.all()
            
            # Score results based on term frequency and position
            for row in rows:
                chunk_id = str(row[0])
                chunk_text = row[1].lower()
                
                score = cls._calculate_keyword_score(chunk_text, terms, query.lower())
                
                if score >= cls.MIN_KEYWORD_SCORE:
                    results[chunk_id] = score
            
            # Sort by score and limit
            sorted_results = sorted(results.items(), key=lambda x: x[1], reverse=True)[:limit]
            results = dict(sorted_results)
            
        except Exception as e:
            logger.error(f"Keyword search failed: {e}")
        
        return results
    
    @classmethod
    async def _fulltext_search(
        cls,
        db: AsyncSession,
        query: str,
        project_id: Optional[str],
        limit: int
    ) -> Dict[str, float]:
        """
        Perform FULLTEXT search using MySQL MATCH AGAINST.
        
        Returns dict of chunk_id -> relevance_score, or empty dict if FULLTEXT unavailable
        """
        results = {}
        
        try:
            # Sanitize query for FULLTEXT
            search_query = re.sub(r'[^\w\s]', ' ', query).strip()
            if not search_query:
                return results
            
            # Build FULLTEXT query
            if project_id:
                fulltext_sql = """
                    SELECT id, 
                           MATCH(chunk_text_fts) AGAINST(:query IN NATURAL LANGUAGE MODE) as relevance
                    FROM kb_chunks
                    WHERE MATCH(chunk_text_fts) AGAINST(:query IN NATURAL LANGUAGE MODE)
                    AND project_id = :project_id
                    ORDER BY relevance DESC
                    LIMIT :limit
                """
                params = {"query": search_query, "project_id": project_id, "limit": limit}
            else:
                fulltext_sql = """
                    SELECT id, 
                           MATCH(chunk_text_fts) AGAINST(:query IN NATURAL LANGUAGE MODE) as relevance
                    FROM kb_chunks
                    WHERE MATCH(chunk_text_fts) AGAINST(:query IN NATURAL LANGUAGE MODE)
                    ORDER BY relevance DESC
                    LIMIT :limit
                """
                params = {"query": search_query, "limit": limit}
            
            result = await db.execute(text(fulltext_sql), params)
            rows = result.all()
            
            # Normalize relevance scores to 0-1 range
            if rows:
                max_relevance = max(row[1] for row in rows) if rows else 1.0
                for row in rows:
                    chunk_id = str(row[0])
                    relevance = float(row[1]) / max_relevance if max_relevance > 0 else 0
                    results[chunk_id] = relevance
            
            logger.debug(f"FULLTEXT search found {len(results)} results")
            return results
            
        except Exception as e:
            # FULLTEXT might not be available (index not created, wrong DB, etc.)
            logger.debug(f"FULLTEXT search unavailable, will use LIKE: {e}")
            return {}
    
    @classmethod
    async def _semantic_search(
        cls,
        db: AsyncSession,
        query: str,
        project_id: Optional[str],
        limit: int
    ) -> Dict[str, float]:
        """
        Perform semantic search using embeddings.
        
        Returns dict of chunk_id -> semantic_score
        """
        results = {}
        
        try:
            # Generate query embedding
            query_embedding = await EmbeddingService.generate_embedding(query)
            
            if EmbeddingService.is_zero_vector(query_embedding):
                logger.warning("Failed to generate query embedding")
                return results
            
            # Get all chunk embeddings (with optional project filter)
            stmt = select(KBChunk.id, KBChunk.embedding)
            
            if project_id:
                stmt = stmt.where(KBChunk.project_id == project_id)
            
            # Limit chunks to search (for performance)
            stmt = stmt.limit(10000)
            
            result = await db.execute(stmt)
            rows = result.all()
            
            if not rows:
                return results
            
            # Extract IDs and embeddings
            chunk_ids = [str(row[0]) for row in rows]
            embeddings = [row[1] for row in rows]
            
            # Find most similar
            similar = EmbeddingService.find_most_similar(
                query_embedding,
                embeddings,
                top_k=limit,
                threshold=cls.MIN_SEMANTIC_SCORE
            )
            
            for idx, score in similar:
                results[chunk_ids[idx]] = score
            
        except Exception as e:
            logger.error(f"Semantic search failed: {e}")
        
        return results
    
    @classmethod
    async def _merge_and_rank_results(
        cls,
        db: AsyncSession,
        keyword_results: Dict[str, float],
        semantic_results: Dict[str, float],
        query: str,
        boost_recent: bool = True
    ) -> List[SearchResult]:
        """
        Merge keyword and semantic results with hybrid ranking.
        """
        # Get all unique chunk IDs
        all_chunk_ids = set(keyword_results.keys()) | set(semantic_results.keys())
        
        if not all_chunk_ids:
            return []
        
        # Normalize scores
        max_keyword = max(keyword_results.values()) if keyword_results else 1.0
        max_semantic = max(semantic_results.values()) if semantic_results else 1.0
        
        # Calculate combined scores
        combined_scores = {}
        for chunk_id in all_chunk_ids:
            kw_score = keyword_results.get(chunk_id, 0) / max_keyword if max_keyword > 0 else 0
            sem_score = semantic_results.get(chunk_id, 0) / max_semantic if max_semantic > 0 else 0
            
            combined_scores[chunk_id] = {
                "keyword": kw_score,
                "semantic": sem_score
            }
        
        # Fetch chunk data
        stmt = select(KBChunk).where(KBChunk.id.in_(list(all_chunk_ids)))
        result = await db.execute(stmt)
        chunks = {str(c.id): c for c in result.scalars().all()}
        
        # Fetch related documents
        doc_ids = list(set(
            str(c.document_id) for c in chunks.values() 
            if c.document_id
        ))
        
        documents = {}
        if doc_ids:
            doc_stmt = select(Document).where(Document.id.in_(doc_ids))
            doc_result = await db.execute(doc_stmt)
            documents = {str(d.id): d for d in doc_result.scalars().all()}
        
        # Fetch related projects
        project_ids = list(set(str(c.project_id) for c in chunks.values()))
        
        projects = {}
        if project_ids:
            proj_stmt = select(Project).where(Project.id.in_(project_ids))
            proj_result = await db.execute(proj_stmt)
            projects = {str(p.id): p for p in proj_result.scalars().all()}
        
        # Build search results with final scores
        results = []
        query_lower = query.lower()
        
        for chunk_id, scores in combined_scores.items():
            chunk = chunks.get(chunk_id)
            if not chunk:
                continue
            
            doc = documents.get(str(chunk.document_id)) if chunk.document_id else None
            proj = projects.get(str(chunk.project_id))
            
            # Check for exact match and title match
            exact_match = query_lower in chunk.chunk_text.lower()
            title_match = doc and query_lower in doc.title.lower()
            
            # Calculate days old
            days_old = 0
            if boost_recent and chunk.created_at:
                days_old = (datetime.utcnow() - chunk.created_at).days
            
            # Combine scores
            combined_score = HybridSearchScorer.combine_scores(
                keyword_score=scores["keyword"],
                semantic_score=scores["semantic"],
                exact_match=exact_match,
                title_match=title_match,
                days_old=days_old if boost_recent else 0,
                keyword_weight=cls.KEYWORD_WEIGHT,
                semantic_weight=cls.SEMANTIC_WEIGHT
            )
            
            # Generate highlight
            highlight = cls._generate_highlight(chunk.chunk_text, query)
            
            # Get total chunks for this document
            total_chunks = 1
            if chunk.meta:
                total_chunks = chunk.meta.get("total_chunks", 1)
            
            results.append(SearchResult(
                chunk_id=str(chunk.id),
                document_id=str(chunk.document_id) if chunk.document_id else None,
                project_id=str(chunk.project_id),
                text=chunk.chunk_text,
                highlight=highlight,
                source_type=chunk.source_type,
                file_name=doc.file_name if doc else None,
                file_path=doc.file_path if doc else None,
                document_title=doc.title if doc else None,
                project_name=proj.name if proj else None,
                score=combined_score,
                keyword_score=scores["keyword"],
                semantic_score=scores["semantic"],
                chunk_index=chunk.chunk_index,
                total_chunks=total_chunks,
                created_at=chunk.created_at
            ))
        
        # Sort by combined score
        results.sort(key=lambda x: x.score, reverse=True)
        
        return results
    
    @classmethod
    def _apply_filters(
        cls,
        results: List[SearchResult],
        document_types: Optional[List[str]] = None,
        file_types: Optional[List[str]] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None
    ) -> List[SearchResult]:
        """Apply additional filters to results."""
        filtered = results
        
        if document_types:
            filtered = [r for r in filtered if r.source_type in document_types]
        
        if file_types and file_types:
            filtered = [
                r for r in filtered 
                if r.file_name and any(
                    r.file_name.lower().endswith(ft.lower())
                    for ft in file_types
                )
            ]
        
        if date_from:
            filtered = [r for r in filtered if r.created_at and r.created_at >= date_from]
        
        if date_to:
            filtered = [r for r in filtered if r.created_at and r.created_at <= date_to]
        
        return filtered
    
    @classmethod
    def _tokenize_query(cls, query: str) -> List[str]:
        """Tokenize query into search terms."""
        # Remove special characters, keep alphanumeric and spaces
        cleaned = re.sub(r'[^\w\s-]', ' ', query)
        
        # Split into words
        words = cleaned.split()
        
        # Filter out very short words (except for acronyms in caps)
        terms = [
            w for w in words 
            if len(w) >= 2 or (len(w) >= 1 and w.isupper())
        ]
        
        return terms
    
    @classmethod
    def _calculate_keyword_score(
        cls,
        text: str,
        terms: List[str],
        original_query: str
    ) -> float:
        """
        Calculate keyword match score.
        
        Considers:
        - Term frequency
        - Exact phrase match
        - Term proximity
        """
        score = 0.0
        text_lower = text.lower()
        
        # Exact phrase match (highest weight)
        if original_query in text_lower:
            score += 2.0
        
        # Individual term matches
        for term in terms:
            term_lower = term.lower()
            count = text_lower.count(term_lower)
            if count > 0:
                # Diminishing returns for repeated terms
                score += min(count, 5) * 0.3
        
        # Normalize by text length (prefer shorter, focused chunks)
        text_length = len(text)
        if text_length > 0:
            score = score * (1000 / (text_length + 500))
        
        return score
    
    @classmethod
    def _generate_highlight(cls, text: str, query: str) -> str:
        """Generate highlighted snippet around query terms."""
        text_lower = text.lower()
        query_lower = query.lower()
        terms = cls._tokenize_query(query)
        
        # Find best position to center snippet
        best_pos = 0
        best_score = -1
        
        # Look for exact query match first
        exact_pos = text_lower.find(query_lower)
        if exact_pos >= 0:
            best_pos = exact_pos
            best_score = 100
        else:
            # Find position with most term matches nearby
            for i in range(0, len(text_lower), 50):
                window = text_lower[i:i + cls.SNIPPET_LENGTH]
                score = sum(1 for term in terms if term.lower() in window)
                if score > best_score:
                    best_score = score
                    best_pos = i
        
        # Extract snippet centered on best position
        snippet_start = max(0, best_pos - cls.SNIPPET_LENGTH // 4)
        snippet_end = min(len(text), snippet_start + cls.SNIPPET_LENGTH)
        
        # Adjust to word boundaries
        if snippet_start > 0:
            # Find start of word
            space_pos = text.rfind(' ', 0, snippet_start + 30)
            if space_pos > 0:
                snippet_start = space_pos + 1
        
        if snippet_end < len(text):
            # Find end of word
            space_pos = text.find(' ', snippet_end - 30)
            if space_pos > 0:
                snippet_end = space_pos
        
        snippet = text[snippet_start:snippet_end]
        
        # Add ellipsis
        if snippet_start > 0:
            snippet = "..." + snippet
        if snippet_end < len(text):
            snippet = snippet + "..."
        
        # Highlight matching terms
        for term in terms:
            # Case-insensitive replacement with highlight tags
            pattern = re.compile(re.escape(term), re.IGNORECASE)
            snippet = pattern.sub(
                f"{cls.HIGHLIGHT_START}\\g<0>{cls.HIGHLIGHT_END}",
                snippet
            )
        
        return snippet
    
    @classmethod
    def _to_dict(cls, result: SearchResult) -> Dict[str, Any]:
        """Convert SearchResult to dict for JSON serialization."""
        return {
            "chunk_id": result.chunk_id,
            "document_id": result.document_id,
            "project_id": result.project_id,
            "text": result.text,
            "highlight": result.highlight,
            "source_type": result.source_type,
            "file_name": result.file_name,
            "file_path": result.file_path,
            "document_title": result.document_title,
            "project_name": result.project_name,
            "score": round(result.score, 4),
            "keyword_score": round(result.keyword_score, 4) if result.keyword_score else None,
            "semantic_score": round(result.semantic_score, 4) if result.semantic_score else None,
            "chunk_index": result.chunk_index,
            "total_chunks": result.total_chunks,
            "created_at": result.created_at.isoformat() if result.created_at else None
        }
    
    @classmethod
    def _empty_response(cls, query: str, search_time_ms: int) -> Dict[str, Any]:
        """Return empty search response."""
        return {
            "query": query,
            "total_results": 0,
            "results": [],
            "search_time_ms": search_time_ms,
            "keyword_time_ms": 0,
            "semantic_time_ms": 0,
            "limit": cls.DEFAULT_LIMIT,
            "offset": 0,
            "has_more": False,
            "used_semantic": True,
            "used_keyword": True
        }
    
    @classmethod
    async def get_similar_chunks(
        cls,
        db: AsyncSession,
        chunk_id: Optional[str] = None,
        text: Optional[str] = None,
        project_id: Optional[str] = None,
        limit: int = 5,
        exclude_same_document: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Find chunks similar to a given chunk or text.
        
        Useful for "related content" features.
        """
        if not chunk_id and not text:
            return []
        
        query_embedding = None
        source_doc_id = None
        
        if chunk_id:
            # Get the source chunk
            stmt = select(KBChunk).where(KBChunk.id == chunk_id)
            result = await db.execute(stmt)
            source_chunk = result.scalar_one_or_none()
            
            if not source_chunk:
                return []
            
            query_embedding = source_chunk.embedding
            source_doc_id = str(source_chunk.document_id) if source_chunk.document_id else None
            
            if not project_id:
                project_id = str(source_chunk.project_id)
        else:
            # Generate embedding from text
            query_embedding = await EmbeddingService.generate_embedding(text)
        
        if EmbeddingService.is_zero_vector(query_embedding):
            return []
        
        # Get candidate chunks
        stmt = select(KBChunk.id, KBChunk.document_id, KBChunk.chunk_text, KBChunk.embedding)
        
        if project_id:
            stmt = stmt.where(KBChunk.project_id == project_id)
        
        if exclude_same_document and source_doc_id:
            stmt = stmt.where(KBChunk.document_id != source_doc_id)
        
        if chunk_id:
            stmt = stmt.where(KBChunk.id != chunk_id)
        
        stmt = stmt.limit(1000)
        
        result = await db.execute(stmt)
        rows = result.all()
        
        if not rows:
            return []
        
        # Find similar
        chunk_ids = [str(row[0]) for row in rows]
        doc_ids = [str(row[1]) if row[1] else None for row in rows]
        texts = [row[2] for row in rows]
        embeddings = [row[3] for row in rows]
        
        similar = EmbeddingService.find_most_similar(
            query_embedding,
            embeddings,
            top_k=limit,
            threshold=0.4
        )
        
        # Get document titles
        doc_id_set = set(doc_ids[idx] for idx, _ in similar if doc_ids[idx])
        
        documents = {}
        if doc_id_set:
            doc_stmt = select(Document.id, Document.title).where(Document.id.in_(list(doc_id_set)))
            doc_result = await db.execute(doc_stmt)
            documents = {str(row[0]): row[1] for row in doc_result.all()}
        
        return [
            {
                "chunk_id": chunk_ids[idx],
                "document_id": doc_ids[idx],
                "document_title": documents.get(doc_ids[idx]) if doc_ids[idx] else None,
                "text_preview": texts[idx][:200] + "..." if len(texts[idx]) > 200 else texts[idx],
                "similarity_score": round(score, 4)
            }
            for idx, score in similar
        ]
