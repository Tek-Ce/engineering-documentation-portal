#!/usr/bin/env python3
"""
Test KB System
"""
import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Add app to path
sys.path.insert(0, '/home/kiplimo/Desktop/opt/Devs/backend')

from app.services.kb import get_indexer, get_retriever
from app.core.config import settings

async def test_kb():
    print("=" * 60)
    print("Testing Knowledge Base System")
    print("=" * 60)
    print()

    # Create async engine - convert mysql:// to mysql+aiomysql://
    db_url = settings.DATABASE_URL.replace('mysql://', 'mysql+aiomysql://')
    engine = create_async_engine(db_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        try:
            # Test document
            document_id = "7ce8686c-b398-4129-bf23-75e04e6de421"
            project_id = None  # Will fetch from document

            # Get document details
            from sqlalchemy import text
            result = await db.execute(
                text("SELECT project_id, file_path FROM documents WHERE id = :id"),
                {"id": document_id}
            )
            row = result.fetchone()
            if not row:
                print("✗ Document not found!")
                return

            project_id = row[0]
            file_path = row[1]
            # File paths in DB are stored as "documents/filename.ext" but actual location is "uploads/documents/"
            if file_path.startswith('documents/'):
                file_path = file_path.replace('documents/', 'uploads/documents/', 1)
            full_path = f"/home/kiplimo/Desktop/opt/Devs/backend/{file_path}"

            print(f"Document ID: {document_id}")
            print(f"Project ID: {project_id}")
            print(f"File Path: {full_path}")
            print()

            # Test 1: Index Document
            print("Test 1: Indexing Document...")
            print("-" * 60)
            indexer = get_indexer()

            try:
                job_id = await indexer.index_document(
                    db=db,
                    document_id=document_id,
                    project_id=project_id,
                    file_path=full_path,
                    source_type="document"
                )
                print(f"✓ Indexing started! Job ID: {job_id}")

                # Wait for indexing to complete
                print("  Waiting for indexing to complete...")
                for i in range(30):
                    await asyncio.sleep(1)
                    status = await indexer.get_job_status(db, job_id)
                    if status['status'] in ['completed', 'failed']:
                        break
                    print(f"  Progress: {status.get('progress', 0)}%", end='\r')

                status = await indexer.get_job_status(db, job_id)
                if status['status'] == 'completed':
                    print(f"\n✓ Indexing completed!")
                    print(f"  Chunks created: {status.get('result', {}).get('chunks_created', 0)}")
                else:
                    print(f"\n✗ Indexing failed: {status.get('error_message', 'Unknown error')}")
                    return

            except Exception as e:
                print(f"✗ Indexing error: {str(e)}")
                import traceback
                traceback.print_exc()
                return

            print()

            # Test 2: Search
            print("Test 2: Semantic Search...")
            print("-" * 60)
            retriever = get_retriever()

            try:
                results = await retriever.search(
                    db=db,
                    query="requirements specifications",
                    project_id=project_id,
                    top_k=5,
                    min_similarity=0.3
                )

                print(f"✓ Search completed! Found {len(results)} results")
                print()
                for i, result in enumerate(results[:3], 1):
                    print(f"Result {i}:")
                    print(f"  Similarity: {result.similarity_score:.3f}")
                    print(f"  Text: {result.chunk_text[:100]}...")
                    print()

            except Exception as e:
                print(f"✗ Search error: {str(e)}")
                import traceback
                traceback.print_exc()

            print()
            print("=" * 60)
            print("✓ KB System Test Complete!")
            print("=" * 60)

        except Exception as e:
            print(f"✗ Test error: {str(e)}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_kb())
