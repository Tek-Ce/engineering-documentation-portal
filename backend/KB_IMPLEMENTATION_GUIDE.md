# Knowledge Base Implementation Guide

## Overview

This guide walks through the complete implementation of the Knowledge Base (KB) system for the Engineering Documentation Portal.

## Architecture

```
Backend Services:
├── Document Processor  - Extract & chunk documents
├── Embedding Service   - Generate vector embeddings
├── Retriever Service   - Semantic search
├── Summarizer Service  - Generate summaries
├── Chat Service        - RAG-based Q&A
└── Background Workers  - Async processing

Database:
├── kb_chunks          - Document chunks with embeddings
├── kb_summaries       - Cached summaries
├── kb_processing_jobs - Job queue
└── kb_settings        - Project configuration
```

## Installation Steps

### 1. Install Dependencies

```bash
cd backend
source venv/bin/activate
pip install pgvector sentence-transformers pypdf pdfplumber python-docx pytesseract tiktoken
```

### 2. Enable pgvector in PostgreSQL

```sql
-- Connect to your database
psql -U your_user -d your_database

-- Enable extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify
\dx vector
```

### 3. Run Database Migrations

```bash
# Create migration
alembic revision --autogenerate -m "Add KB tables"

# Apply migration
alembic upgrade head
```

### 4. Configure Settings

Create `.env` file:

```env
# KB Configuration
KB_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
KB_CHUNK_SIZE=512
KB_CHUNK_OVERLAP=50
KB_MAX_CHUNKS_PER_DOC=1000

# LLM Configuration (Optional)
OLLAMA_BASE_URL=http://localhost:11434
OPENAI_API_KEY=your_key_here  # Optional

# Processing
KB_WORKER_THREADS=4
KB_BATCH_SIZE=32
```

## Usage

### Index a Document

```python
from app.services.kb.indexer import index_document

# Trigger indexing
job_id = await index_document(
    document_id="uuid",
    project_id="uuid"
)
```

### Search

```python
from app.services.kb.retriever import search_knowledge_base

results = await search_knowledge_base(
    query="How do we handle authentication?",
    project_id="uuid",
    top_k=10
)
```

### Generate Summary

```python
from app.services.kb.summarizer import generate_summary

summary = await generate_summary(
    document_id="uuid",
    summary_type="short",  # short, long, executive, technical
    use_llm=False  # Use rule-based by default
)
```

### Chat Assistant

```python
from app.services.kb.chat import answer_question

response = await answer_question(
    question="What's our deployment process?",
    project_id="uuid",
    chat_history=[]
)

print(response.answer)
print(response.sources)  # Document citations
```

## API Endpoints

### POST /api/v1/kb/index
Index a document

### POST /api/v1/kb/search
Semantic search across project knowledge

### POST /api/v1/kb/summarize
Generate document summary

### POST /api/v1/kb/chat
Ask questions via RAG

### GET /api/v1/kb/status/{job_id}
Check indexing job status

## Frontend Integration

### Search Component

```tsx
import { KBSearch } from '@/components/KB/KBSearch';

<KBSearch projectId={projectId} />
```

### Chat Widget

```tsx
import { KBChat } from '@/components/KB/KBChat';

<KBChat projectId={projectId} />
```

## Performance Tuning

### Vector Index Optimization

```sql
-- Adjust HNSW parameters for your data size
CREATE INDEX idx_kb_chunks_embedding ON kb_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- For larger datasets (>1M chunks):
-- m = 32, ef_construction = 128
```

### Query Performance

- Cache frequently searched queries (Redis)
- Use hybrid search (vector + keyword)
- Implement result reranking for top results only
- Batch embed multiple queries together

## Monitoring

### Health Checks

```bash
curl http://localhost:8000/api/v1/kb/health
```

### Metrics to Track

- Search latency (p50, p95, p99)
- Embedding generation time
- Index freshness
- LLM costs (if using cloud)
- Cache hit rate

## Troubleshooting

### pgvector Not Found

```bash
# Install PostgreSQL development headers
sudo apt-get install postgresql-server-dev-all

# Reinstall pgvector
pip install --force-reinstall pgvector
```

### Slow Embedding Generation

- Use GPU if available
- Reduce batch size
- Use smaller model (all-MiniLM-L6-v2)

### High Memory Usage

- Process documents in batches
- Clear embedding cache periodically
- Limit concurrent workers

## Next Steps

1. ✅ Set up database schema
2. ⏳ Implement document processor
3. ⏳ Create embedding service
4. ⏳ Build search functionality
5. ⏳ Add summarization
6. ⏳ Implement chat assistant
7. ⏳ Create frontend components

## Support

For issues or questions:
- Check logs: `tail -f logs/kb.log`
- Run health check: `curl /api/v1/kb/health`
- Contact: [Your team contact]
