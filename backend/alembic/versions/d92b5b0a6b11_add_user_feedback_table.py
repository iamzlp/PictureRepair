"""add_user_feedback_table

Revision ID: d92b5b0a6b11
Revises: b8f2a7d9c1aa
Create Date: 2026-05-24 19:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d92b5b0a6b11"
down_revision: Union[str, Sequence[str], None] = "b8f2a7d9c1aa"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_feedback",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("feedback_type", sa.String(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="submitted"),
        sa.Column("source", sa.String(), nullable=False, server_default="miniprogram"),
        sa.Column("page_path", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_user_feedback_feedback_type"), "user_feedback", ["feedback_type"], unique=False)
    op.create_index(op.f("ix_user_feedback_status"), "user_feedback", ["status"], unique=False)
    op.create_index(op.f("ix_user_feedback_user_id"), "user_feedback", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_user_feedback_user_id"), table_name="user_feedback")
    op.drop_index(op.f("ix_user_feedback_status"), table_name="user_feedback")
    op.drop_index(op.f("ix_user_feedback_feedback_type"), table_name="user_feedback")
    op.drop_table("user_feedback")
