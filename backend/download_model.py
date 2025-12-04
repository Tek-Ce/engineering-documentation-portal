#!/usr/bin/env python3
"""
Download the BGE embedding model with progress tracking
"""
import os
from sentence_transformers import SentenceTransformer
from tqdm import tqdm

# Set cache directory
cache_dir = os.path.expanduser("~/.cache/huggingface/hub")
os.makedirs(cache_dir, exist_ok=True)

print("=" * 60)
print("Downloading BGE Embedding Model")
print("=" * 60)
print(f"Model: BAAI/bge-small-en-v1.5")
print(f"Size: ~133 MB")
print(f"Cache: {cache_dir}")
print("=" * 60)
print()

# Download with progress
try:
    print("Starting download...")
    model = SentenceTransformer('BAAI/bge-small-en-v1.5', cache_folder=cache_dir)

    print()
    print("=" * 60)
    print("✓ Download Complete!")
    print("=" * 60)
    print(f"Model dimension: {model.get_sentence_embedding_dimension()}")
    print()

    # Test the model
    print("Testing model with sample text...")
    test_embedding = model.encode("This is a test sentence")
    print(f"✓ Model is working! Embedding shape: {test_embedding.shape}")
    print()
    print("You can now use the KB system!")

except Exception as e:
    print(f"✗ Error: {e}")
    exit(1)
