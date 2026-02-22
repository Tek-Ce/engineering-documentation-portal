"""
Background workers package.

Each worker is designed to be executed explicitly as a module, e.g.:

    python -m app.workers.kb_worker

This package intentionally avoids importing or running worker logic
at import time to prevent side effects, circular imports, and
accidental execution within the FastAPI application process.
"""
from app.workers.kb_worker import run_worker