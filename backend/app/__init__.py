# ============================================
# FILE: app/__init__.py
# ============================================

"""
Engineering Documentation Portal API
"""
__version__ = "1.0.0"

# Import package-level objects (optional)
from .db.database import get_db
from .core.config import settings
