"""add_mtat_fields

Revision ID: c09fd1e2da88
Revises: 823e7ff3d207
Create Date: 2026-05-12 18:21:40.435289

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c09fd1e2da88'
down_revision: Union[str, None] = '823e7ff3d207'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
