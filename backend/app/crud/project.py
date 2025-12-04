# ============================================
# FILE: app/crud/project.py - FIXED
# ============================================

from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload

from app.crud.base import CRUDBase
from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectUpdate
import uuid


class CRUDProject(CRUDBase[Project, ProjectCreate, ProjectUpdate]):
    """CRUD operations for Project"""
    
    async def create(
        self,
        db: AsyncSession,
        *,
        obj_in: ProjectCreate,
        created_by: str
    ) -> Project:
        """Create new project"""
        db_obj = Project(
            id=str(uuid.uuid4()),
            name=obj_in.name,
            description=obj_in.description,
            brief=obj_in.brief,
            code=obj_in.code,
            is_active=obj_in.is_active,
            created_by=created_by
        )
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj
    
    async def get_by_code(self, db: AsyncSession, *, code: str) -> Optional[Project]:
        """Get project by code"""
        result = await db.execute(
            select(Project).where(Project.code == code)
        )
        return result.scalar_one_or_none()
    
    async def get_with_documents(
        self, 
        db: AsyncSession, 
        *, 
        project_id: str
    ) -> Optional[Project]:
        """Get project with all documents loaded"""
        result = await db.execute(
            select(Project)
            .options(selectinload(Project.documents))
            .where(Project.id == project_id)
        )
        return result.scalar_one_or_none()
    
    async def get_active_projects(
        self, 
        db: AsyncSession, 
        *, 
        skip: int = 0, 
        limit: int = 100
    ) -> List[Project]:
        """Get all active projects"""
        result = await db.execute(
            select(Project)
            .where(Project.is_active == True)
            .offset(skip)
            .limit(limit)
            .order_by(Project.name)
        )
        return list(result.scalars().all())
    
    async def get_by_creator(
        self, 
        db: AsyncSession, 
        *, 
        creator_id: str, 
        skip: int = 0, 
        limit: int = 100
    ) -> List[Project]:
        """Get projects created by a specific user"""
        result = await db.execute(
            select(Project)
            .where(Project.created_by == creator_id)
            .offset(skip)
            .limit(limit)
            .order_by(Project.created_at.desc())
        )
        return list(result.scalars().all())
    
    async def search(
        self, 
        db: AsyncSession, 
        *, 
        query: str, 
        skip: int = 0, 
        limit: int = 100
    ) -> List[Project]:
        """Search projects by name, code, or description"""
        search_pattern = f"%{query}%"
        result = await db.execute(
            select(Project)
            .where(
                or_(
                    Project.name.ilike(search_pattern),
                    Project.code.ilike(search_pattern),
                    Project.description.ilike(search_pattern)
                )
            )
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())
    
    async def count(self, db: AsyncSession) -> int:
        """
        Count total number of projects
        
        ← THIS WAS MISSING! Added to fix Error #1
        """
        result = await db.execute(
            select(func.count()).select_from(Project)
        )
        return result.scalar() or 0
    
    async def get_project_stats(
        self, 
        db: AsyncSession, 
        *, 
        project_id: str
    ) -> Dict[str, Any]:
        """Get project statistics"""
        from app.models.document import Document
        
        # Count documents
        doc_count = await db.execute(
            select(func.count())
            .select_from(Document)
            .where(Document.project_id == project_id)
        )
        total_documents = doc_count.scalar() or 0
        
        # Count published documents
        published_count = await db.execute(
            select(func.count())
            .select_from(Document)
            .where(
                Document.project_id == project_id,
                Document.status == "published"
            )
        )
        published_documents = published_count.scalar() or 0

        # Count draft documents
        draft_count = await db.execute(
            select(func.count())
            .select_from(Document)
            .where(
                Document.project_id == project_id,
                Document.status == "draft"
            )
        )
        draft_documents = draft_count.scalar() or 0

        # Count project members
        from app.models.project_member import ProjectMember
        members_count = await db.execute(
            select(func.count())
            .select_from(ProjectMember)
            .where(ProjectMember.project_id == project_id)
        )
        total_members = members_count.scalar() or 0

        return {
            "total_documents": total_documents,
            "published_documents": published_documents,
            "draft_documents": draft_documents,
            "total_members": total_members
        }
    
    async def archive(self, db: AsyncSession, *, project_id: str) -> Optional[Project]:
        """Archive a project (set is_active to False and status to archived)"""
        project = await self.get(db, id=project_id)
        if project:
            project.is_active = False  # type: ignore[assignment]
            project.status = "archived"  # type: ignore[assignment]
            db.add(project)
            await db.flush()
            await db.refresh(project)
        return project
    
    async def restore(self, db: AsyncSession, *, project_id: str) -> Optional[Project]:
        """Restore an archived project (set is_active to True and status to active)"""
        project = await self.get(db, id=project_id)
        if project:
            project.is_active = True  # type: ignore[assignment]
            project.status = "active"  # type: ignore[assignment]
            db.add(project)
            await db.flush()
            await db.refresh(project)
        return project


crud_project = CRUDProject(Project)