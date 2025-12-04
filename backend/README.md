# FILE: README.md
"""
# Engineering Documentation Portal

Backend API for managing engineering documentation and team collaboration.

## Features

- User management with role-based access control
- Project spaces with team member assignments
- Document upload with version control
- Comments and tagging for collaboration
- Real-time notifications
- Activity logging and audit trail

## Tech Stack

- **Backend**: Python 3.11+, FastAPI
- **Database**: MySQL 8.0+
- **ORM**: SQLAlchemy 2.0 (async)
- **Authentication**: JWT tokens

## Setup

1. **Clone repository**
```bash
git clone <repo-url>
cd backend
```

2. **Create virtual environment**
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows
```

3. **Install dependencies**
```bash
pip install -r requirements.txt
```

4. **Setup database**
```bash
mysql -u root -p
CREATE DATABASE engineering_portal;
USE engineering_portal;
SOURCE ../database_schema.sql;
```

5. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

6. **Create admin user**
```bash
python scripts/create_admin.py
```

7. **Run application**
```bash
uvicorn app.main:app --reload
```

8. **Access API**
- API: http://localhost:8000
- Docs: http://localhost:8000/docs

## Default Admin

- Email: admin@engportal.local
- Password: admin123
- **Change password immediately after first login!**

## API Endpoints

### Authentication
- POST `/api/v1/auth/login` - Login
- POST `/api/v1/auth/change-password` - Change password
- GET `/api/v1/auth/me` - Get current user

### Users
- POST `/api/v1/users` - Create user (Admin)
- GET `/api/v1/users` - List users (Admin)
- GET `/api/v1/users/{id}` - Get user (Admin)
- PUT `/api/v1/users/{id}` - Update user (Admin)
- DELETE `/api/v1/users/{id}` - Deactivate user (Admin)

### Projects
- POST `/api/v1/projects` - Create project
- GET `/api/v1/projects` - List projects
- GET `/api/v1/projects/{id}` - Get project details
- PUT `/api/v1/projects/{id}` - Update project
- POST `/api/v1/projects/{id}/members` - Add member
- DELETE `/api/v1/projects/{id}/members/{user_id}` - Remove member

### Documents
- POST `/api/v1/documents/upload` - Upload document
- GET `/api/v1/documents` - List documents
- GET `/api/v1/documents/{id}` - Get document
- PUT `/api/v1/documents/{id}` - Update document
- DELETE `/api/v1/documents/{id}` - Delete document

## License

Proprietary
"""

# ============================================
# ADMIN CREATION SCRIPT
# ============================================

# FILE: scripts/create_admin.py
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from app.db.database import AsyncSessionLocal
from app.models.user import User, UserRole
from app.core.security import get_password_hash
from sqlalchemy import select
import uuid

async def create_admin_user():
    async with AsyncSessionLocal() as session:
        try:
            # Check if admin exists
            result = await session.execute(
                select(User).where(User.email == "admin@engportal.local")
            )
            existing_admin = result.scalar_one_or_none()
            
            if existing_admin:
                print("❌ Admin user already exists!")
                print(f"   Email: {existing_admin.email}")
                return
            
            # Create admin user
            admin_user = User(
                id=str(uuid.uuid4()),
                email="admin@engportal.local",
                password_hash=get_password_hash("admin123"),
                full_name="System Administrator",
                role=UserRole.ADMIN,
                is_active=True
            )
            
            session.add(admin_user)
            await session.commit()
            
            print("✅ Admin user created successfully!")
            print("\n" + "="*50)
            print("📧 Email:    admin@engportal.local")
            print("🔑 Password: admin123")
            print("="*50)
            print("\n⚠️  IMPORTANT: Change this password immediately!")
            
        except Exception as e:
            print(f"❌ Error: {str(e)}")
            await session.rollback()

if __name__ == "__main__":
    print("Creating admin user...\n")
    asyncio.run(create_admin_user())
"""