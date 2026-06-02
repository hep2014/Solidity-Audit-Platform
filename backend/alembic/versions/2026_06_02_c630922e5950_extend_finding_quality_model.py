"""extend finding quality model

Revision ID: c630922e5950
Revises: a40a19c90715
Create Date: 2026-06-02 22:49:38.131307

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c630922e5950'
down_revision: Union[str, None] = 'a40a19c90715'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("findings", sa.Column("file_path", sa.Text(), nullable=True))
    op.add_column("findings", sa.Column("column", sa.Integer(), nullable=True))
    op.add_column("findings", sa.Column("end_line", sa.Integer(), nullable=True))
    op.add_column("findings", sa.Column("confidence", sa.String(length=50), nullable=True))
    op.add_column("findings", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("findings", sa.Column("recommendation", sa.Text(), nullable=True))
    op.add_column(
        "findings",
        sa.Column("references", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column("findings", sa.Column("fingerprint", sa.String(length=128), nullable=True))

    op.execute(
        """
        UPDATE findings
        SET fingerprint = md5(
            coalesce(tool, '') || ':' ||
            coalesce(rule, '') || ':' ||
            coalesce(line::text, '') || ':' ||
            coalesce(message, '')
        )
        WHERE fingerprint IS NULL
        """
    )

    op.alter_column("findings", "fingerprint", nullable=False)

    op.create_index("ix_findings_severity", "findings", ["severity"], unique=False)
    op.create_index("ix_findings_rule", "findings", ["rule"], unique=False)
    op.create_index("ix_findings_tool", "findings", ["tool"], unique=False)
    op.create_index("ix_findings_fingerprint", "findings", ["fingerprint"], unique=False)

    op.create_unique_constraint(
        "uq_findings_analysis_fingerprint",
        "findings",
        ["analysis_id", "fingerprint"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_findings_analysis_fingerprint", "findings", type_="unique")

    op.drop_index("ix_findings_fingerprint", table_name="findings")
    op.drop_index("ix_findings_tool", table_name="findings")
    op.drop_index("ix_findings_rule", table_name="findings")
    op.drop_index("ix_findings_severity", table_name="findings")

    op.drop_column("findings", "fingerprint")
    op.drop_column("findings", "references")
    op.drop_column("findings", "recommendation")
    op.drop_column("findings", "description")
    op.drop_column("findings", "confidence")
    op.drop_column("findings", "end_line")
    op.drop_column("findings", "column")
    op.drop_column("findings", "file_path")