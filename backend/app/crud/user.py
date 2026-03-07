# ============================================
# FILE: app/crud/user.py
# ============================================
from typing import Optional, List, Dict, Any
import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
from app.crud.base import CRUDBase
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from app.core.security import get_password_hash, verify_password

# Consider users online if active within this many minutes
ONLINE_THRESHOLD_MINUTES = 5

class CRUDUser(CRUDBase[User, UserCreate, UserUpdate]):
    async def get_by_email(self, db: AsyncSession, *, email: str) -> Optional[User]:
        """Get user by email"""
        result = await db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def get_active_users(
        self, db: AsyncSession, *, skip: int = 0, limit: int = 100
    ) -> tuple[List[User], int]:
        """Get active users only with total count"""
        # Count active users - use is_(True) for boolean comparison
        count_query = select(func.count()).select_from(User).where(User.is_active.is_(True))
        total_result = await db.execute(count_query)
        total: int = total_result.scalar() or 0  # ensure int
        
        # Get active users - access Column class for .desc() method
        query = (
            select(User)
            .where(User.is_active.is_(True))
            .offset(skip)
            .limit(limit)
            .order_by(User.__table__.c.created_at.desc())  # Access column from table
        )
        result = await db.execute(query)
        users: List[User] = list(result.scalars())
        return users, total

    async def create(
        self, db: AsyncSession, *, obj_in: UserCreate, created_by_id: Optional[str] = None
    ) -> User:
        """Create user with hashed password"""
        db_obj = User(
            id=str(uuid.uuid4()),
            full_name=obj_in.full_name,
            email=obj_in.email,
            password_hash=get_password_hash(obj_in.password),
            role=obj_in.role,
            is_active=True,
            created_by=created_by_id
        )
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def authenticate(self, db: AsyncSession, *, email: str, password: str) -> Optional[User]:
        """Authenticate user"""
        user = await self.get_by_email(db, email=email)
        if not user:
            return None
        if not verify_password(password, str(user.password_hash)):
            return None
        return user

    async def deactivate(self, db: AsyncSession, *, id: str) -> bool:
        """Soft delete - deactivate user"""
        user = await self.get(db, id=id)
        if user:
            user.is_active = False  # type: ignore
            await db.flush()
            return True
        return False

    async def search(
        self, db: AsyncSession, *, query: str, skip: int = 0, limit: int = 100
    ) -> tuple[List[User], int]:
        """Search users by full_name or email"""
        from sqlalchemy import func

        # Build where clause
        where_clause = or_(
            User.__table__.c.full_name.ilike(f"%{query}%"),
            User.__table__.c.email.ilike(f"%{query}%")
        )

        # Get total count
        count_query = select(func.count()).select_from(User).where(where_clause)
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        # Get users
        search_query = (
            select(User)
            .where(where_clause)
            .offset(skip)
            .limit(limit)
        )
        result = await db.execute(search_query)
        users: List[User] = list(result.scalars())

        return users, total

    async def update_activity(self, db: AsyncSession, *, user_id: str) -> bool:
        """Update user's last activity timestamp."""
        user = await self.get(db, id=user_id)
        if user:
            user.last_activity = datetime.now(timezone.utc)  # type: ignore
            await db.flush()
            return True
        return False

    async def get_online_users(
        self, db: AsyncSession, *, threshold_minutes: int = ONLINE_THRESHOLD_MINUTES
    ) -> List[Dict[str, Any]]:
        """Get users who were active within the threshold."""
        threshold_time = datetime.now(timezone.utc) - timedelta(minutes=threshold_minutes)

        stmt = (
            select(User)
            .where(
                and_(
                    User.is_active.is_(True),
                    User.last_activity.isnot(None),
                    User.last_activity >= threshold_time
                )
            )
            .order_by(User.last_activity.desc())
        )

        result = await db.execute(stmt)
        users = result.scalars().all()

        return [
            {
                "id": str(u.id),
                "full_name": u.full_name,
                "email": u.email,
                "role": u.role.value if u.role else None,
                "last_activity": u.last_activity.isoformat() if u.last_activity else None,
                "is_online": True
            }
            for u in users
        ]

    async def get_users_with_status(
        self, db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
        threshold_minutes: int = ONLINE_THRESHOLD_MINUTES
    ) -> List[Dict[str, Any]]:
        """Get all active users with their online status."""
        threshold_time = datetime.now(timezone.utc) - timedelta(minutes=threshold_minutes)

        stmt = (
            select(User)
            .where(User.is_active.is_(True))
            .order_by(User.last_activity.desc().nullslast(), User.full_name)
            .offset(skip)
            .limit(limit)
        )

        result = await db.execute(stmt)
        users = result.scalars().all()

        return [
            {
                "id": str(u.id),
                "full_name": u.full_name,
                "email": u.email,
                "role": u.role.value if u.role else None,
                "last_activity": u.last_activity.isoformat() if u.last_activity else None,
                "last_login": u.last_login.isoformat() if u.last_login else None,
                "is_online": u.last_activity is not None and u.last_activity >= threshold_time
            }
            for u in users
        ]


# Singleton instance to use in routes/services
crud_user = CRUDUser(User)