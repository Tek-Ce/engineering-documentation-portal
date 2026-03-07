"""baseline_existing_schema

Revision ID: fe769040cc2f
Revises: 
Create Date: 2026-01-28 17:36:59.025720

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "baseline_001"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Import all models so they register with Base metadata
    import app.models.user
    import app.models.project
    import app.models.project_member
    import app.models.document
    import app.models.comment
    import app.models.notification
    import app.models.tag
    import app.models.activity_log
    try:
        import app.models.kb
    except Exception:
        pass

    from app.db.base_class import Base
    bind = op.get_bind()
    Base.metadata.create_all(bind)


def downgrade():
    pass
