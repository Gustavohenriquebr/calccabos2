"""Alembic env.py — CalcCabos
- Reads DATABASE_URL from the environment (same .env used by FastAPI).
- Rewrites postgresql:// -> postgresql+psycopg:// for psycopg3 driver.
- render_as_batch=True: SQLite dev ALTER TABLE compatibility.
- compare_type=True: autogenerate detects column type drift.
"""
import os
from logging.config import fileConfig

from dotenv import load_dotenv
from sqlalchemy import create_engine, pool
from alembic import context

# Load .env — makes DATABASE_URL available when running `alembic` CLI
load_dotenv()

# Alembic config object
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import all models so autogenerate can detect the full schema
from app.database import Base  # noqa: E402
import app.models.usuario      # noqa: F401,E402
import app.models.projeto      # noqa: F401,E402
import app.models.circuito     # noqa: F401,E402

target_metadata = Base.metadata


def _get_url() -> str:
    """Resolve DATABASE_URL, rewriting postgresql:// for psycopg3."""
    url = (
        os.environ.get("DATABASE_URL")
        or config.get_main_option("sqlalchemy.url", "sqlite:///./calc.db")
    )
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


def run_migrations_offline() -> None:
    """Offline mode — emit SQL to stdout without a live DB connection."""
    url = _get_url()
    is_sqlite = url.startswith("sqlite")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=is_sqlite,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Online mode — connect to DB and run migrations transactionally."""
    url = _get_url()
    is_sqlite = url.startswith("sqlite")

    # Use NullPool for migrations so connections are not held open.
    engine = create_engine(url, poolclass=pool.NullPool)

    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=is_sqlite,   # Required for SQLite ALTER TABLE
            compare_type=True,           # Detect column type changes in autogenerate
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
