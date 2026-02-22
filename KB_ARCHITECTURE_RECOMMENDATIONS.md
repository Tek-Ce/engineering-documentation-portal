# Knowledge Base Architecture Recommendations

## Current Issues
1. **No indexed content**: 4 documents exist but 0 KB chunks (indexing jobs stuck in "queued")
2. **Background worker not running**: Jobs never get processed
3. **Tight coupling**: KB is embedded in the main app, making it hard to scale independently

---

## Practical Solutions (Choose One)

### Option 1: Quick Fix - Index Documents via API (Immediate)

Use the existing API to manually trigger indexing:

```bash
# Get your auth token first
TOKEN="your-jwt-token"

# Get document IDs
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/v1/projects/{project_id}/documents

# Index each document
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/kb/index/document/{document_id}
```

Or use the frontend's "Rebuild KB Index" button if available.

---

### Option 2: Run the KB Worker Manually (Short-term)

The KB has a background worker that needs to run separately:

```bash
cd backend

# Run the worker to process queued jobs
python -c "
import asyncio
from app.workers.kb_worker import process_pending_jobs

asyncio.run(process_pending_jobs())
"
```

---

### Option 3: Separate KB as Microservice (Recommended for Scale)

For long-term scalability and internet integration, separate the KB into its own service:

```
┌─────────────────────────────────────────────────────────────────┐
│                       MAIN PORTAL                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │   Frontend   │  │   Backend    │  │   MySQL Database     │   │
│  │   (React)    │◄─┤   (FastAPI)  │◄─┤   (Users, Projects,  │   │
│  │              │  │              │  │    Documents)        │   │
│  └──────────────┘  └──────┬───────┘  └──────────────────────┘   │
│                           │                                      │
│                           │ REST/gRPC                            │
│                           ▼                                      │
└───────────────────────────┼─────────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────────┐
│              KB MICROSERVICE (Separate Deployment)               │
│                           │                                      │
│  ┌────────────────────────▼────────────────────────────────┐    │
│  │                   KB API Gateway                         │    │
│  │  POST /index    GET /search    POST /crawl              │    │
│  └────────────────────────┬────────────────────────────────┘    │
│                           │                                      │
│  ┌──────────┐  ┌──────────┴──────────┐  ┌───────────────────┐   │
│  │ Indexer  │  │    Search Engine    │  │   Web Crawler     │   │
│  │ Worker   │  │ (Semantic+Keyword)  │  │  (Future: URLs)   │   │
│  └────┬─────┘  └─────────┬───────────┘  └─────────┬─────────┘   │
│       │                  │                        │              │
│  ┌────┴──────────────────┴────────────────────────┴─────────┐   │
│  │              Vector Database                              │   │
│  │    (ChromaDB / Pinecone / PostgreSQL+pgvector)           │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

#### Benefits of Separation:
1. **Independent scaling**: Scale KB separately from main app
2. **Internet access**: Add web crawling without affecting main app
3. **Better tech stack**: Use purpose-built vector DB (ChromaDB, Pinecone)
4. **Easier maintenance**: Deploy/update KB without touching main app

---

## Recommended Architecture for Separate KB Service

### Technology Stack

| Component | Current | Recommended |
|-----------|---------|-------------|
| **Vector Store** | MySQL (JSON column) | ChromaDB (local) or Pinecone (cloud) |
| **Embeddings** | sentence-transformers (local) | Keep local OR use OpenAI embeddings |
| **Search** | Custom hybrid search | Keep custom OR use Elasticsearch |
| **Queue** | FastAPI BackgroundTasks | Redis + Celery |
| **API** | Part of main FastAPI | Separate FastAPI service |

### Simple KB Service Structure

```
kb-service/
├── app/
│   ├── main.py              # FastAPI app
│   ├── api/
│   │   ├── search.py        # GET /search
│   │   ├── index.py         # POST /index
│   │   └── crawl.py         # POST /crawl (future)
│   ├── services/
│   │   ├── embedding.py     # Generate embeddings
│   │   ├── indexer.py       # Index documents
│   │   └── searcher.py      # Hybrid search
│   ├── storage/
│   │   ├── chroma.py        # ChromaDB adapter
│   │   └── pinecone.py      # Pinecone adapter (cloud)
│   └── workers/
│       └── tasks.py         # Celery tasks
├── docker-compose.yml
├── Dockerfile
└── requirements.txt
```

### Example KB Service API

```python
# kb-service/app/main.py
from fastapi import FastAPI

app = FastAPI(title="Knowledge Base Service")

@app.post("/index")
async def index_document(request: IndexRequest):
    """Index a document from the main portal."""
    # 1. Fetch document content (from URL or base64)
    # 2. Extract text
    # 3. Chunk and embed
    # 4. Store in vector DB
    return {"status": "indexed", "chunks": 10}

@app.get("/search")
async def search(q: str, project_id: str = None, limit: int = 10):
    """Search the knowledge base."""
    # 1. Embed query
    # 2. Vector similarity search
    # 3. Keyword fallback
    # 4. Return ranked results
    return {"results": [...]}

@app.post("/crawl")
async def crawl_url(url: str, project_id: str):
    """Crawl a URL and add to KB (future feature)."""
    # 1. Fetch URL content
    # 2. Extract text
    # 3. Index like a document
    return {"status": "queued"}
```

---

## Phase 1: Quick Win (Do This Now)

1. **Fix current indexing** by adding synchronous indexing when documents upload:

```python
# In documents.py upload endpoint, after saving document:
from app.services.indexer_service import IndexerService

# After document is saved:
try:
    await IndexerService.index_document(db, document)
    await db.commit()
except Exception as e:
    logger.error(f"KB indexing failed: {e}")
    # Don't fail upload if KB indexing fails
```

2. **Lower search thresholds** to get more results:

```python
# In search_service.py
MIN_SEMANTIC_SCORE = 0.1  # Was 0.3
MIN_KEYWORD_SCORE = 0.05  # Was 0.1
```

---

## Phase 2: Stabilize (This Week)

1. **Add a cron job** to process queued KB jobs:

```bash
# Add to crontab
*/5 * * * * cd /path/to/backend && python -m app.workers.kb_worker
```

2. **Add retry logic** for failed jobs

3. **Add logging** to track indexing success/failure

---

## Phase 3: Separate (When Ready to Scale)

1. Create new `kb-service` repository
2. Use ChromaDB for vector storage (simpler than MySQL JSON)
3. Add Redis queue for background jobs
4. Expose REST API for main portal to call
5. Update main portal to call KB service instead of local KB

---

## Internet/Web Crawling (Future)

Once KB is separated, add web crawling:

```python
# kb-service/app/api/crawl.py
import httpx
from bs4 import BeautifulSoup

@app.post("/crawl")
async def crawl_and_index(url: str, project_id: str):
    # 1. Fetch page
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)

    # 2. Extract text
    soup = BeautifulSoup(resp.text, 'html.parser')
    text = soup.get_text()

    # 3. Index like document
    chunks = await index_text(text, source_url=url, project_id=project_id)

    return {"status": "indexed", "url": url, "chunks": len(chunks)}
```

---

## Summary

| Timeframe | Action | Effort |
|-----------|--------|--------|
| **Now** | Trigger manual indexing via API | 5 min |
| **Today** | Add inline indexing on document upload | 30 min |
| **This Week** | Add cron job for job processing | 1 hour |
| **Next Sprint** | Separate KB as microservice | 2-3 days |
| **Future** | Add web crawling capability | 1-2 days |

The current KB architecture is functional but needs the worker to run. For long-term scalability, separating it into a microservice is the right approach.
