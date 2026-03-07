# ============================================
# FILE 3: app/db/database.py
# ============================================
import os
from app.db.base_class import Base
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    AsyncSession,
    async_sessionmaker)

# Use os.getenv directly to avoid pydantic-settings URL mangling.
# Only add +aiomysql if the URL starts with bare mysql:// (not already mysql+aiomysql://).
# Note: .replace("mysql://", "mysql+aiomysql://") would corrupt an already-correct
# mysql+aiomysql:// URL because "aiomysql://" contains the substring "mysql://".
_raw_url = os.getenv("DATABASE_URL", "")
if _raw_url.startswith("mysql://"):
    ASYNC_DATABASE_URL = "mysql+aiomysql://" + _raw_url[len("mysql://"):]
else:
    ASYNC_DATABASE_URL = _raw_url

engine = create_async_engine(
    ASYNC_DATABASE_URL,
    echo=False,
    pool_pre_ping=True
)


AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)



# Dependency for routes
async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
