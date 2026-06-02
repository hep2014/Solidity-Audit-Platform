"""add project workspace metadata

Revision ID: a40a19c90715
Revises: a2a6aa25a23a
Create Date: 2026-06-02 22:21:24.848717

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a40a19c90715'
down_revision: Union[str, None] = 'a2a6aa25a23a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("root_path", sa.Text(), nullable=True),
    )
    op.add_column(
        "projects",
        sa.Column("entrypoint_path", sa.Text(), nullable=True),
    )
    op.add_column(
        "projects",
        sa.Column(
            "project_type",
            sa.String(length=50),
            nullable=False,
            server_default="single_file",
        ),
    )
    op.add_column(
        "projects",
        sa.Column(
            "solidity_files_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "projects",
        sa.Column("detected_solc_versions", sa.JSON(), nullable=True),
    )
    op.add_column(
        "projects",
        sa.Column("metadata", sa.JSON(), nullable=True),
    )

    op.create_index(
        "ix_projects_owner_id",
        "projects",
        ["owner_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_projects_owner_id", table_name="projects")

    op.drop_column("projects", "metadata")
    op.drop_column("projects", "detected_solc_versions")
    op.drop_column("projects", "solidity_files_count")
    op.drop_column("projects", "project_type")
    op.drop_column("projects", "entrypoint_path")
    op.drop_column("projects", "root_path")
