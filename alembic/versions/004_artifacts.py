"""Add artifacts table for persistent artifact storage

Revision ID: 004_artifacts
Revises: 003_enhanced_auth
Create Date: 2024-12-29

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '004_artifacts'
down_revision: Union[str, None] = '003_enhanced_auth'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create artifacts table
    op.create_table(
        'artifacts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.String(100), nullable=False, index=True),  # execution session
        sa.Column('chat_session_id', sa.Integer(), nullable=True),  # links to chat_sessions.id
        sa.Column('message_id', sa.Integer(), nullable=True),  # links to chat_messages.id
        sa.Column('agent_id', sa.String(100), nullable=False),  # which agent created it
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('path', sa.String(500), nullable=False),  # original path in workspace
        sa.Column('language', sa.String(50), nullable=True),
        sa.Column('content', sa.Text(), nullable=True),  # actual file content
        sa.Column('size', sa.Integer(), nullable=True),
        sa.Column('content_type', sa.String(100), nullable=True),  # mime type
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create additional indexes (session_id index is created via index=True above)
    op.create_index('ix_artifacts_chat_session_id', 'artifacts', ['chat_session_id'])
    op.create_index('ix_artifacts_agent_id', 'artifacts', ['agent_id'])


def downgrade() -> None:
    op.drop_index('ix_artifacts_agent_id', table_name='artifacts')
    op.drop_index('ix_artifacts_chat_session_id', table_name='artifacts')
    op.drop_table('artifacts')
