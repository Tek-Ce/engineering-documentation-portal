"""
Knowledge Base Services

Provides document indexing, semantic search, and summarization.
"""

from app.services.kb.document_processor import get_document_processor, DocumentProcessor
from app.services.kb.embedding_service import get_embedding_service, EmbeddingService
from app.services.kb.indexer import get_indexer, IndexerService
from app.services.kb.retriever import get_retriever, RetrieverService, SearchResult
from app.services.kb.summarizer import get_summarizer, SummarizerService

__all__ = [
    'get_document_processor',
    'DocumentProcessor',
    'get_embedding_service',
    'EmbeddingService',
    'get_indexer',
    'IndexerService',
    'get_retriever',
    'RetrieverService',
    'SearchResult',
    'get_summarizer',
    'SummarizerService',
]
