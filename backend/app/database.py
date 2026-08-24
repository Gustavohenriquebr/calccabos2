"""database.py — CalcCabos DB engine and session factory.

- SQLite WAL Pragma Tuned
- Automated Recoverer for SQLITE_BUSY deadlocks.
- 7. SQLite Automatic Backup (.bak)
- 8. WAL Auto Checkpointer Thread
"""
import os
import logging
import time
import shutil
import threading
from sqlalchemy import create_engine, event, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.exc import OperationalError

from app.config import settings

logger = logging.getLogger("calccabos.database")
url = settings.DATABASE_URL
if url.startswith("postgresql://"):
    url = url.replace("postgresql://", "postgresql+psycopg://", 1)

_is_sqlite = url.startswith("sqlite")

if _is_sqlite:
    # ── SQLITE ENGINE HARDENED ──
    engine = create_engine(
        url,
        connect_args={
            "check_same_thread": False,
            "timeout": 15  # Elevado timeout nativo para proteção de locking
        },
        poolclass=StaticPool if ":memory:" in url else None,
        pool_pre_ping=True,
    )

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragmas(dbapi_conn, _):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA cache_size=-64000")
        cursor.execute("PRAGMA busy_timeout=15000")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
        
    # ── 8. WAL AUTO CHECKPOINT DAEMON ──
    def wal_auto_checkpointer():
        while True:
            time.sleep(300)  # Roda a cada 5 minutos
            try:
                with engine.connect() as conn:
                    conn.execute(text("PRAGMA wal_checkpoint(PASSIVE)"))
                    conn.commit()
                logger.info("WAL Checkpoint PASSIVE executado com sucesso.")
            except Exception as e:
                logger.error(f"Erro silencioso no WAL Auto Checkpointer: {e}")

    threading.Thread(target=wal_auto_checkpointer, daemon=True, name="WALCheckpointer").start()
    
else:
    engine = create_engine(url, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ── 7. SQLITE BACKUP AUTOMÁTICO ──
def perform_auto_backup():
    if not _is_sqlite: return
    db_path = url.replace("sqlite:///", "")
    if not os.path.exists(db_path): return
    bak_path = f"{db_path}.bak_{int(time.time())}"
    try:
        shutil.copy2(db_path, bak_path)
        logger.warning(f"Backup Automático Gerado: {bak_path}")
    except Exception as e:
        logger.error(f"Falha ao gerar backup: {e}")

# ── 9. SQLITE RECOVERY MECHANISM ──
def get_db():
    retries = 3
    for attempt in range(retries):
        db = SessionLocal()
        try:
            yield db
            break  # Sucesso!
        except OperationalError as exc:
            db.rollback()
            err_msg = str(exc)
            
            # Detecção de Database is locked / WAL failure
            if "database is locked" in err_msg or "malformed" in err_msg:
                logger.error(f"SQLite Fault Detectado (Attempt {attempt+1}/{retries}): {err_msg}")
                db.close()
                if attempt < retries - 1:
                    logger.warning("Acionando Auto-Backup antes do Recovery...")
                    perform_auto_backup()
                    logger.warning("Acionando SQLite WAL Checkpoint Truncate Recovery & Reconnect...")
                    try:
                        with engine.connect() as conn:
                            conn.execute(text("PRAGMA wal_checkpoint(TRUNCATE)"))
                            conn.commit()
                    except Exception as chk_exc:
                        logger.error(f"Falha no WAL Checkpoint de Recovery: {chk_exc}")
                    time.sleep(1.0) # Respiro do SO
                    continue
            raise
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()