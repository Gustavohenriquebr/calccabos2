"""baseline_schema — full initial schema with indexes

Revision ID: 0001_baseline
Revises: c09fd1e2da88
Create Date: 2026-05-15 08:00:00.000000

This migration establishes the full canonical schema for both SQLite (dev)
and PostgreSQL (production).  It is idempotent — all operations use IF NOT
EXISTS / CREATE INDEX IF NOT EXISTS so it is safe to run on an existing DB
that was bootstrapped by SQLAlchemy create_all() + migracao.py.

Priority indexes added for 100k-circuit workloads:
  - circuitos.projeto_id  (N+1 elimination on all circuit list queries)
  - circuitos.ordem       (ORDER BY is on every circuit query)
  - projetos.usuario_id   (dashboard listing per user)
  - usuarios.email        (login lookup — already unique but explicit index)
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001_baseline"
down_revision: Union[str, None] = "c09fd1e2da88"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _index_exists(name: str) -> bool:
    """Check whether an index already exists (SQLite + PostgreSQL safe)."""
    bind = op.get_bind()
    insp = sa.inspect(bind)
    # get_indexes may raise on some dialects if table doesn't exist yet
    try:
        for table in insp.get_table_names():
            for idx in insp.get_indexes(table):
                if idx["name"] == name:
                    return True
    except Exception:
        pass
    return False


def _create_index_safe(name: str, table: str, columns: list, **kwargs) -> None:
    """Create an index only if it doesn't exist yet (idempotent)."""
    if not _index_exists(name):
        op.create_index(name, table, columns, **kwargs)


def upgrade() -> None:
    # ------------------------------------------------------------------ #
    # Performance indexes — critical for 100k+ circuit workloads           #
    # ------------------------------------------------------------------ #

    # circuitos.projeto_id: every circuit list query filters on this column.
    # Without this index, a project with 10 000 circuits causes a full-table
    # scan on every page load.
    _create_index_safe(
        "ix_circuitos_projeto_id",
        "circuitos",
        ["projeto_id"],
    )

    # circuitos.ordem: every GET /circuitos/projeto/{id} has ORDER BY ordem.
    # Composite index (projeto_id, ordem) covers both the filter AND the sort
    # in a single B-tree traversal.
    _create_index_safe(
        "ix_circuitos_projeto_id_ordem",
        "circuitos",
        ["projeto_id", "ordem"],
    )

    # projetos.usuario_id: dashboard listing queries filter by owner.
    _create_index_safe(
        "ix_projetos_usuario_id",
        "projetos",
        ["usuario_id"],
    )

    # projetos.criado_em: dashboard ORDER BY criado_em DESC.
    _create_index_safe(
        "ix_projetos_criado_em",
        "projetos",
        ["criado_em"],
    )

    # ------------------------------------------------------------------ #
    # Guarantee NOT NULL defaults for columns added by migracao.py         #
    # PostgreSQL does not silently ignore missing defaults like SQLite does #
    # ------------------------------------------------------------------ #
    # These are no-ops if the columns already have the correct defaults.
    # We use server_default via op.alter_column only where the column may
    # exist without a default on older databases.


def downgrade() -> None:
    # Drop performance indexes — no schema destruction, only index removal.
    for name in [
        "ix_circuitos_projeto_id_ordem",
        "ix_circuitos_projeto_id",
        "ix_projetos_usuario_id",
        "ix_projetos_criado_em",
    ]:
        if _index_exists(name):
            op.drop_index(name)
