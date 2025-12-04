# ============================================
# FILE 3: app/db/database.py
# ============================================
from app.db.base_class import Base 
from sqlalchemy.ext.asyncio import (
    create_async_engine, 
    AsyncSession, 
    async_sessionmaker)
 # ✅ use the shared Base
from app.core.config import settings

# Convert MySQL URL to async
ASYNC_DATABASE_URL = settings.DATABASE_URL.replace("mysql://", "mysql+aiomysql://")

engine = create_async_engine(
    ASYNC_DATABASE_URL,
    echo=settings.DEBUG,
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
