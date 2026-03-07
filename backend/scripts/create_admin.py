"""
Admin User Creation Script for Engineering Documentation Portal
FIXED VERSION - No Pylance Type Errors

This script creates an initial admin user with proper async handling
and correct type annotations.

Usage:
    python scripts/create_admin.py
"""

import asyncio
import sys
import uuid
from pathlib import Path
from typing import Optional

# Add the parent directory to the path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker, AsyncEngine
from sqlalchemy import select
from passlib.context import CryptContext

# Import your models and config
try:
    from app.models.user import User
    from app.core.config import settings
    from app.models.project import Project, ProjectRole
    from app.models.document import Document
    from app.models.project_member import ProjectMember
    from app.models.notification import Notification
    from app.models.comment import Comment
    from app.models.tag import Tag
    try:
        from app.models import kb  # registers KBChunk/KBSummary with SQLAlchemy
    except Exception:
        pass
except ImportError as e:
    print(f"❌ Error importing modules: {e}")
    print("Make sure you're running this from the project root:")
    print("  python scripts/create_admin.py")
    sys.exit(1)


# Password hashing configuration
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AdminCreator:
    """Handles admin user creation with proper async database operations"""
    
    def __init__(self):
        self.engine: Optional[AsyncEngine] = None
        self.async_session: Optional[async_sessionmaker[AsyncSession]] = None
        
    async def initialize(self) -> bool:
        """Initialize database connection"""
        try:
            # Create async engine
            raw_url = settings.DATABASE_URL
            if raw_url.startswith('mysql://'):
                database_url = 'mysql+aiomysql://' + raw_url[len('mysql://'):]
            elif raw_url.startswith('mysql+pymysql://'):
                database_url = 'mysql+aiomysql://' + raw_url[len('mysql+pymysql://'):]
            else:
                database_url = raw_url
            
            if not database_url:
                print("❌ DATABASE_URL not configured in .env file")
                return False
            
            self.engine = create_async_engine(
                database_url,
                echo=False,  # Set to True for SQL debugging
                pool_pre_ping=True,
                pool_recycle=3600,
            )
            
            # Create session factory using async_sessionmaker (correct way for SQLAlchemy 2.0+)
            self.async_session = async_sessionmaker(
                self.engine,
                class_=AsyncSession,
                expire_on_commit=False
            )
            
            print("✓ Database connection initialized")
            return True
            
        except Exception as e:
            print(f"❌ Failed to initialize database: {e}")
            print(f"   Check your DATABASE_URL in .env file")
            print(f"   Current URL starts with: {settings.DATABASE_URL[:30]}...")
            return False
    
    async def check_existing_admin(self, session: AsyncSession) -> bool:
        """Check if admin user already exists"""
        try:
            result = await session.execute(
                select(User).where(User.email == "admin@engportal.local")
            )
            admin = result.scalar_one_or_none()
            
            if admin:
                print(f"⚠️  Admin user already exists:")
                print(f"   📧 Email: {admin.email}")
                print(f"   👤 Name: {admin.full_name}")
                print(f"   ✓  Active: {admin.is_active}")
                return True
            
            print("✓ No existing admin user found")
            return False
            
        except Exception as e:
            print(f"❌ Error checking for existing admin: {e}")
            raise
    
    async def create_admin_user(self, session: AsyncSession) -> User:
        """Create a new admin user"""
        try:
            # Hash the default password
            password_hash = pwd_context.hash("admin@123")
            
            # Create admin user
            admin = User(
                id=str(uuid.uuid4()),
                full_name="System Administrator",
                email="admin@engportal.local",
                password_hash=password_hash,
                role="ADMIN",
                is_active=True,
                created_by=None
            )
            
            session.add(admin)
            await session.commit()
            await session.refresh(admin)
            
            print("✓ Admin user created successfully!")
            return admin
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Error creating admin user: {e}")
            raise
    
    async def verify_admin(self, session: AsyncSession) -> None:
        """Verify admin user was created correctly"""
        try:
            result = await session.execute(
                select(User).where(User.role == "ADMIN")
            )
            admins = result.scalars().all()
            
            print(f"✅ Found {len(admins)} admin user(s):")
            for admin in admins:
                print(f"\n   📧 {admin.email}")
                print(f"   👤 {admin.full_name}")
                print(f"   ✓  Active: {admin.is_active}")
                print(f"   🆔 ID: {admin.id}")
            
        except Exception as e:
            print(f"❌ Error verifying admin: {e}")
            raise
    
    async def cleanup(self) -> None:
        """Properly cleanup database connections"""
        try:
            if self.engine:
                await self.engine.dispose()
                print("\n✓ Database connections closed")
        except Exception as e:
            print(f"⚠️  Error during cleanup: {e}")
    
    async def run(self) -> bool:
        """Main execution flow"""
        print("=" * 60)
        print("🔧 Engineering Documentation Portal - Admin Setup")
        print("=" * 60)
        print()
        
        # Initialize database
        if not await self.initialize():
            return False
        
        # Check that session factory was created
        if not self.async_session:
            print("❌ Session factory not initialized properly")
            return False
        
        try:
            # Create session
            async with self.async_session() as session:
                print("\n📋 Checking if admin user exists...")
                
                # Check for existing admin
                exists = await self.check_existing_admin(session)
                if exists:
                    print("\n⚠️  Admin user already exists. Skipping creation.")
                    print("   To reset, delete the existing admin user first.")
                    return True
                
                # Create admin user
                print("\n🔨 Creating admin user...")
                admin = await self.create_admin_user(session)
                
                # Display credentials
                print("\n" + "=" * 60)
                print("✅ ADMIN USER CREDENTIALS")
                print("=" * 60)
                print()
                print(f"   📧 Email:    admin@engportal.local")
                print(f"   🔑 Password: admin123")
                print(f"   👤 Name:     {admin.full_name}")
                print(f"   🎭 Role:     {admin.role}")
                print()
                print("=" * 60)
                print()
                print("⚠️  SECURITY WARNING:")
                print("   ➤ Change this password IMMEDIATELY after first login!")
                print("   ➤ Use: POST /api/v1/auth/change-password")
                print()
                print("🚀 Next Steps:")
                print("   1. Start the server: uvicorn app.main:app --reload")
                print("   2. Visit: http://localhost:8000/docs")
                print("   3. Login with the credentials above")
                print("   4. Change the password")
                print("   5. Create additional users")
                print()
                print("=" * 60)
                
                # Verify creation
                print("\n🔍 Verifying admin user...")
                await self.verify_admin(session)
                
            return True
            
        except Exception as e:
            print(f"\n❌ Script failed: {e}")
            import traceback
            traceback.print_exc()
            return False
        
        finally:
            # Cleanup
            await self.cleanup()


async def main():
    """Entry point for the script"""
    creator = AdminCreator()
    success = await creator.run()
    
    if success:
        print("\n✅ Admin setup completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Admin setup failed!")
        sys.exit(1)


if __name__ == "__main__":
    try:
        # Run the async main function
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n⚠️  Script interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)