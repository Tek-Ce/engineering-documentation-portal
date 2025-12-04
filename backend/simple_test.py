#!/usr/bin/env python3
"""
Simple KB Test - Direct Testing
"""
import sys
sys.path.insert(0, '/home/kiplimo/Desktop/opt/Devs/backend')

from app.services.kb import get_embedding_service, get_document_processor

print("=" * 60)
print("Simple KB Test")
print("=" * 60)
print()

# Test 1: Embedding Service
print("Test 1: Embedding Service")
print("-" * 60)
try:
    embedder = get_embedding_service()
    print(f"✓ Embedding service loaded")
    print(f"  Model: BAAI/bge-small-en-v1.5")
    print(f"  Dimension: {embedder.get_embedding_dim()}")

    # Test embedding
    test_text = "This is a test document about engineering requirements."
    embedding = embedder.embed(test_text)
    print(f"✓ Generated embedding shape: {len(embedding)}")
    print()
except Exception as e:
    print(f"✗ Error: {e}")
    import traceback
    traceback.print_exc()
    print()

# Test 2: Document Processing
print("Test 2: Document Processing")
print("-" * 60)
try:
    processor = get_document_processor()
    print(f"✓ Document processor loaded")

    # Test with actual file
    import asyncio
    async def test_process():
        file_path = "/home/kiplimo/Desktop/opt/Devs/backend/uploads/documents/6e29caf1-4798-4963-8bbc-9d04feb1e9a9.txt"
        chunks = await processor.process_document(
            file_path=file_path,
            document_id="test-doc",
            project_id="test-project"
        )
        return chunks

    chunks = asyncio.run(test_process())
    print(f"✓ Processed document")
    print(f"  Total chunks: {len(chunks)}")
    if len(chunks) > 0:
        print(f"  First chunk text: {chunks[0].chunk_text[:100]}...")
        print(f"  First chunk tokens: {chunks[0].token_count}")
        print(f"  Embedding dimension: {len(chunks[0].embedding)}")
    print()
except Exception as e:
    print(f"✗ Error: {e}")
    import traceback
    traceback.print_exc()
    print()

print("=" * 60)
print("Test Complete!")
print("=" * 60)
