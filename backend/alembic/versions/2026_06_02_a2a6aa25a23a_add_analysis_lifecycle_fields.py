"""add analysis lifecycle fields

Revision ID: a2a6aa25a23a
Revises: 29f0787ef4ac
Create Date: 2026-06-02 22:11:05.279285

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a2a6aa25a23a'
down_revision: Union[str, None] = '29f0787ef4ac'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "analyses",
        sa.Column("celery_task_id", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "analyses",
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "analyses",
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "analyses",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=True,
        ),
    )

    op.create_index(
        "ix_analyses_celery_task_id",
        "analyses",
        ["celery_task_id"],
        unique=False,
    )
    op.create_index(
        "ix_analyses_status",
        "analyses",
        ["status"],
        unique=False,
    )
    op.create_index(
        "ix_analysis_logs_status",
        "analysis_logs",
        ["status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_analysis_logs_status", table_name="analysis_logs")
    op.drop_index("ix_analyses_status", table_name="analyses")
    op.drop_index("ix_analyses_celery_task_id", table_name="analyses")

    op.drop_column("analyses", "updated_at")
    op.drop_column("analyses", "finished_at")
    op.drop_column("analyses", "started_at")
    op.drop_column("analyses", "celery_task_id")