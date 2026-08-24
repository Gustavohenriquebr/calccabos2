"""
diag_schema.py — CalcCabos Phase 1 schema audit.
Run from backend/: python diag_schema.py
"""
import sys
import os

sys.path.insert(0, ".")

# Import all models so the full SQLAlchemy registry is populated
import app.models.usuario   # noqa
import app.models.projeto   # noqa
import app.models.circuito  # noqa

from app.database import engine
from app.models.circuito import Circuito
from app.models.projeto import Projeto
import sqlalchemy as sa

insp = sa.inspect(engine)

# ── 1. Tables present in DB ──────────────────────────────────────────────────
print("=== TABLES IN DB ===")
tables = insp.get_table_names()
for t in sorted(tables):
    print("  " + t)

# ── 2. circuitos columns ─────────────────────────────────────────────────────
print("\n=== circuitos COLUMNS IN DB ===")
cols = insp.get_columns("circuitos")
db_cols = {c["name"]: c for c in cols}
for name in sorted(db_cols.keys()):
    info = db_cols[name]
    print("  {}: {}  nullable={}".format(name, info["type"], info["nullable"]))

# ── 3. projetos columns ──────────────────────────────────────────────────────
print("\n=== projetos COLUMNS IN DB ===")
pcols = insp.get_columns("projetos")
db_pcols = {c["name"]: c for c in pcols}
for name in sorted(db_pcols.keys()):
    info = db_pcols[name]
    print("  {}: {}  nullable={}".format(name, info["type"], info["nullable"]))

# ── 4. Indexes on circuitos ──────────────────────────────────────────────────
print("\n=== circuitos INDEXES IN DB ===")
for idx in insp.get_indexes("circuitos"):
    print("  {}: {}  unique={}".format(idx["name"], idx["column_names"], idx["unique"]))

# ── 5. Indexes on projetos ───────────────────────────────────────────────────
print("\n=== projetos INDEXES IN DB ===")
for idx in insp.get_indexes("projetos"):
    print("  {}: {}  unique={}".format(idx["name"], idx["column_names"], idx["unique"]))

# ── 6. Alembic version ───────────────────────────────────────────────────────
print("\n=== alembic_version ===")
try:
    with engine.connect() as conn:
        rows = conn.execute(sa.text("SELECT version_num FROM alembic_version")).fetchall()
        print("  Current head: {}".format([r[0] for r in rows]))
except Exception as e:
    print("  alembic_version table missing or error: {}".format(e))

# ── 7. ORM vs DB drift ──────────────────────────────────────────────────────
print("\n=== ORM vs DB — circuitos drift ===")
orm_cols = {c.name for c in Circuito.__table__.columns}
db_col_names = set(db_cols.keys())
missing_from_db = sorted(orm_cols - db_col_names)
extra_in_db = sorted(db_col_names - orm_cols)
print("  In ORM but MISSING from DB: {}".format(missing_from_db))
print("  In DB but NOT in ORM:       {}".format(extra_in_db))

print("\n=== ORM vs DB — projetos drift ===")
orm_pcols = {c.name for c in Projeto.__table__.columns}
db_pcol_names = set(db_pcols.keys())
missing_from_db_p = sorted(orm_pcols - db_pcol_names)
extra_in_db_p = sorted(db_pcol_names - orm_pcols)
print("  In ORM but MISSING from DB: {}".format(missing_from_db_p))
print("  In DB but NOT in ORM:       {}".format(extra_in_db_p))

print("\n=== Audit complete ===")
