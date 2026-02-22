#!/usr/bin/env python3
"""
Manual document indexing script for Knowledge Base.
Run this to index all documents that haven't been indexed yet.

Usage:
    cd backend
    python scripts/index_documents.py

Options:
    --force    Force re-index all documents (even if already indexed)
    --project  Only index documents from a specific project ID
"""
import asyncio
import sys
import os
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Set environment variable to avoid model downloads in some environments
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")


async def index_all_documents(force_reindex: bool = False, project_id: str = None):
    """Index all documents that haven't been indexed yet."""
    # Import inside function to ensure path is set up
    from sqlalchemy import select, func
    from sqlalchemy.ext.asyncio import AsyncSession
    from app.db.database import AsyncSessionLocal
    from app.models.document import Document
    from app.models.kb import KBChunk
    from app.services.indexer_service import IndexerService

    async with AsyncSessionLocal() as db:
        # Get documents (optionally filtered by project)
        stmt = select(Document)
        if project_id:
            stmt = stmt.where(Document.project_id == project_id)

        result = await db.execute(stmt)
        documents = result.scalars().all()

        print(f"Found {len(documents)} documents")

        indexed_count = 0
        skipped_count = 0
        failed_count = 0

        for doc in documents:
            doc_id = str(doc.id)

            if not force_reindex:
                # Check if already indexed
                chunk_count_query = select(func.count()).select_from(KBChunk).where(
                    KBChunk.document_id == doc_id
                )
                chunk_result = await db.execute(chunk_count_query)
                existing_chunks = chunk_result.scalar() or 0

                if existing_chunks > 0:
                    print(f"  [SKIP] {doc.title} - already indexed ({existing_chunks} chunks)")
                    skipped_count += 1
                    continue

            print(f"  [INDEX] {doc.title}...")
            try:
                # Use the IndexerService directly
                indexing_result = await IndexerService.index_document(
                    db=db,
                    document=doc,
                    force_reindex=force_reindex
                )
                await db.commit()

                if indexing_result.get("success"):
                    chunks_created = indexing_result.get('chunks_created', 0)
                    if chunks_created > 0:
                        print(f"    -> Created {chunks_created} chunks")
                        indexed_count += 1
                    else:
                        # Already indexed with same content
                        print(f"    -> {indexing_result.get('error', 'Already indexed')}")
                        skipped_count += 1
                else:
                    print(f"    -> FAILED: {indexing_result.get('error', 'Unknown error')}")
                    failed_count += 1
            except Exception as e:
                print(f"    -> ERROR: {e}")
                failed_count += 1
                await db.rollback()

        # Final count
        final_count = await db.execute(select(func.count()).select_from(KBChunk))
        total_chunks = final_count.scalar()

        print("")
        print("=" * 50)
        print(f"Summary:")
        print(f"  Indexed: {indexed_count}")
        print(f"  Skipped: {skipped_count}")
        print(f"  Failed: {failed_count}")
        print(f"  Total KB chunks: {total_chunks}")


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Index documents for Knowledge Base")
    parser.add_argument("--force", action="store_true", help="Force re-index all documents")
    parser.add_argument("--project", type=str, help="Only index documents from this project ID")

    args = parser.parse_args()

    print("=" * 50)
    print("Knowledge Base - Manual Document Indexer")
    print("=" * 50)

    if args.force:
        print("Mode: FORCE RE-INDEX (will re-index all documents)")
    else:
        print("Mode: INCREMENTAL (will skip already indexed documents)")

    if args.project:
        print(f"Project filter: {args.project}")

    print("")

    asyncio.run(index_all_documents(
        force_reindex=args.force,
        project_id=args.project
    ))


if __name__ == "__main__":
    main()
