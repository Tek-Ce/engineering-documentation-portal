"""
Run model sanity check: python -m app.models
"""

from app.db.database import Base
from app.models import (
    User, Project, ProjectMember, Document,
    Comment, Tag, Notification, ActivityLog
)

def main():
    print("============================================================")
    print("✅ Engineering Documentation Portal - Model Sanity Check")
    print("============================================================")
    print(f"Loaded {len(Base.registry.mappers)} ORM models successfully:\n")
    for mapper in Base.registry.mappers:
        print(f" - {mapper.class_.__name__} ({mapper.local_table.name})")

if __name__ == "__main__":
    main()
