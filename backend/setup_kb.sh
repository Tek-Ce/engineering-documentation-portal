#!/bin/bash
# Knowledge Base Setup Script

set -e

echo "========================================="
echo "Knowledge Base Setup"
echo "========================================="
echo ""

# Check if we're in the backend directory
if [ ! -f "alembic.ini" ]; then
    echo "Error: Must run this script from the backend directory"
    exit 1
fi

# Activate virtual environment
echo "1. Activating virtual environment..."
source venv/bin/activate

# Check if dependencies are installed
echo "2. Checking dependencies..."
python -c "import pgvector" 2>/dev/null || { echo "Error: pgvector not installed. Run: pip install pgvector sentence-transformers pypdf pdfplumber python-docx tiktoken"; exit 1; }
python -c "import sentence_transformers" 2>/dev/null || { echo "Error: sentence-transformers not installed"; exit 1; }
echo "   ✓ Dependencies installed"

# Run database migration
echo "3. Running database migration..."
alembic upgrade head
echo "   ✓ Migration complete"

# Test KB health
echo "4. Testing KB service (requires backend to be running)..."
echo "   You can test with: curl http://localhost:8000/api/v1/kb/health"

echo ""
echo "========================================="
echo "Setup Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Ensure backend is running: uvicorn app.main:app --reload"
echo "2. Test health: curl http://localhost:8000/api/v1/kb/health"
echo "3. Index a document via API or UI"
echo ""
echo "API Endpoints:"
echo "  POST /api/v1/kb/index        - Index a document"
echo "  POST /api/v1/kb/search       - Semantic search"
echo "  POST /api/v1/kb/summarize    - Generate summary"
echo "  GET  /api/v1/kb/status/{id}  - Check job status"
echo "  GET  /api/v1/kb/health       - Health check"
echo ""
