"""add_video_fields_to_generation_tasks

Revision ID: e3f9a6c4b201
Revises: d92b5b0a6b11
Create Date: 2026-06-06 23:58:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e3f9a6c4b201"
down_revision: Union[str, Sequence[str], None] = "d92b5b0a6b11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("generation_tasks", sa.Column("result_video_url", sa.String(), nullable=True))
    op.add_column("generation_tasks", sa.Column("video_status", sa.String(), nullable=True))
    op.add_column("generation_tasks", sa.Column("video_progress", sa.Integer(), nullable=True, server_default="0"))
    op.add_column("generation_tasks", sa.Column("video_error_message", sa.String(), nullable=True))
    op.add_column("generation_tasks", sa.Column("video_prompt", sa.String(), nullable=True))
    op.add_column("generation_tasks", sa.Column("video_external_task_id", sa.String(), nullable=True))
    op.create_index(op.f("ix_generation_tasks_video_status"), "generation_tasks", ["video_status"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_generation_tasks_video_status"), table_name="generation_tasks")
    op.drop_column("generation_tasks", "video_external_task_id")
    op.drop_column("generation_tasks", "video_prompt")
    op.drop_column("generation_tasks", "video_error_message")
    op.drop_column("generation_tasks", "video_progress")
    op.drop_column("generation_tasks", "video_status")
    op.drop_column("generation_tasks", "result_video_url")
