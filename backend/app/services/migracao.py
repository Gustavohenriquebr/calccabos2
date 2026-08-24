from sqlalchemy import text


# ── MT/AT protection columns (added with the MT/AT feature sprint) ────────────
# These were missing from the original safety-net migration and caused
# ProgrammingError: UndefinedColumn on every SELECT against the circuitos table.
CIRCUITO_MTAT_COLUMNS = [
    ("classe_tensao_kv",  "DOUBLE PRECISION"),
    ("nbi_kv",            "DOUBLE PRECISION"),
    ("tafi_ka",           "DOUBLE PRECISION"),
    ("sequencia_operacao","VARCHAR(30)"),
    ("meio_extincao",     "VARCHAR(30)"),
    ("tipo_acionamento",  "VARCHAR(30)"),
    ("acessorios",        "JSONB"),
    ("modelo",            "VARCHAR(80)"),
    ("norma_referencia",  "VARCHAR(80)"),
]


CIRCUITO_EXECUTIVO_COLUMNS = [
    ("tag", "VARCHAR(80)"),
    ("from_barramento", "VARCHAR(120)"),
    ("to_equipamento", "VARCHAR(120)"),
    ("protection_device", "VARCHAR(40)"),
    ("modo_dimensionamento", "VARCHAR(20) DEFAULT 'manual'"),
    ("modo_selecao_componentes", "VARCHAR(20) DEFAULT 'manual'"),
    ("disjuntor_tensao_nominal", "DOUBLE PRECISION"),
    ("disjuntor_corrente_nominal", "DOUBLE PRECISION"),
    ("disjuntor_icu", "DOUBLE PRECISION"),
    ("disjuntor_curva", "VARCHAR(30)"),
    ("disjuntor_fabricante", "VARCHAR(80)"),
    ("corrente_ac_dc", "VARCHAR(10) DEFAULT 'AC'"),
    ("potencia_kva", "DOUBLE PRECISION"),
    ("usar_kva_informado", "BOOLEAN DEFAULT FALSE"),
    ("fator_demanda", "DOUBLE PRECISION DEFAULT 1.0"),
    ("fator_eficiencia", "DOUBLE PRECISION DEFAULT 1.0"),
    ("metodo_instalacao", "VARCHAR(30) DEFAULT 'TRAY'"),
    ("formacao", "INTEGER DEFAULT 1"),
    ("comprimento_real", "DOUBLE PRECISION"),
    ("queda_tensao_alimentador", "DOUBLE PRECISION DEFAULT 0.0"),
    ("corrente_projeto", "DOUBLE PRECISION"),
    ("corrente_corrigida", "DOUBLE PRECISION"),
    ("fator_k1", "DOUBLE PRECISION"),
    ("fator_k2", "DOUBLE PRECISION"),
    ("fator_k3", "DOUBLE PRECISION"),
    ("corrente_condutor", "DOUBLE PRECISION"),
    ("tensao_fase", "DOUBLE PRECISION"),
    ("isc_local", "DOUBLE PRECISION"),
    ("isc_cabo", "DOUBLE PRECISION"),
    ("tempo_atuacao", "DOUBLE PRECISION"),
    ("secao_joule", "DOUBLE PRECISION"),
    ("impedancia_rdc", "DOUBLE PRECISION"),
    ("impedancia_rac", "DOUBLE PRECISION"),
    ("impedancia_xl", "DOUBLE PRECISION"),
    ("queda_tensao_max", "DOUBLE PRECISION"),
    ("queda_tensao_acumulada", "DOUBLE PRECISION"),
    ("tipo_cabo_comercial", "VARCHAR(80)"),
    ("nota_tecnica", "TEXT"),
    ("revisao", "VARCHAR(10)"),
    ("status_final", "VARCHAR(30)"),
    ("protecao_status", "VARCHAR(30)"),
    ("protecao_nota", "TEXT"),
    ("validacao_status", "VARCHAR(30)"),
    ("validacao_mensagem", "TEXT"),
    ("validacao_detalhes", "TEXT"),
    ("cabo_sugerido_secao", "DOUBLE PRECISION"),
    ("cabo_sugerido_tipo_comercial", "VARCHAR(80)"),
    ("cabo_sugerido_ampacidade", "DOUBLE PRECISION"),
    ("disjuntor_sugerido_in", "DOUBLE PRECISION"),
    ("disjuntor_sugerido_icu", "DOUBLE PRECISION"),
    ("disjuntor_sugerido_curva", "VARCHAR(30)"),
    ("selecao_componentes_status", "VARCHAR(30)"),
    ("selecao_componentes_justificativa", "TEXT"),
]

PROJETO_TECNICO_COLUMNS = [
    ("transformador_dados", "TEXT"),
    ("sistema_trifasico_dados", "TEXT"),
    ("protecao_geral_dados", "TEXT"),
    ("para_raios_dados", "TEXT"),
    ("aterramento_dados", "TEXT"),
    ("areas_classificadas_dados", "TEXT"),
]


def _column_exists(conn, table: str, name: str) -> bool:
    """Check whether a column exists. Works on SQLite (dev) and PostgreSQL (prod)."""
    dialect = conn.dialect.name  # 'sqlite' or 'postgresql'

    if dialect == "sqlite":
        rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
        return any(row[1] == name for row in rows)
    else:
        row = conn.execute(
            text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name = :t AND column_name = :c"
            ),
            {"t": table, "c": name},
        ).fetchone()
        return row is not None


def _add_column_portable(conn, table: str, name: str, ddl: str) -> None:
    """Add a column only if it doesn't already exist.

    Queries information_schema / PRAGMA before issuing ALTER TABLE so
    we never send a statement that would raise DuplicateColumn.  This is
    safe on both SQLite (dev) and PostgreSQL (prod) without requiring
    SAVEPOINTs or exception-swallowing tricks.
    """
    if not _column_exists(conn, table, name):
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))


def ensure_circuito_executivo_columns(engine):
    """Add executive-design and MT/AT columns to existing CalcCabos databases.

    Safe to call on every startup — _add_column_portable is idempotent
    (checks information_schema before issuing ALTER TABLE).
    """
    with engine.begin() as conn:
        for name, ddl in PROJETO_TECNICO_COLUMNS:
            _add_column_portable(conn, "projetos", name, ddl)

        # MT/AT columns MUST be added before executive columns so the
        # ORM SELECT (which lists all columns) never hits UndefinedColumn.
        for name, ddl in CIRCUITO_MTAT_COLUMNS:
            _add_column_portable(conn, "circuitos", name, ddl)

        for name, ddl in CIRCUITO_EXECUTIVO_COLUMNS:
            _add_column_portable(conn, "circuitos", name, ddl)

        conn.execute(text("UPDATE circuitos SET corrente_ac_dc = 'AC' WHERE corrente_ac_dc IS NULL"))
        conn.execute(text("UPDATE circuitos SET fator_demanda = 1.0 WHERE fator_demanda IS NULL"))
        conn.execute(text("UPDATE circuitos SET fator_eficiencia = 1.0 WHERE fator_eficiencia IS NULL"))
        conn.execute(text("UPDATE circuitos SET metodo_instalacao = 'TRAY' WHERE metodo_instalacao IS NULL"))
        conn.execute(text("UPDATE circuitos SET formacao = 1 WHERE formacao IS NULL"))
        conn.execute(text("UPDATE circuitos SET queda_tensao_alimentador = 0.0 WHERE queda_tensao_alimentador IS NULL"))
        conn.execute(text("UPDATE circuitos SET modo_selecao_componentes = 'manual' WHERE modo_selecao_componentes IS NULL"))
        conn.execute(text("UPDATE circuitos SET modo_dimensionamento = COALESCE(modo_dimensionamento, modo_selecao_componentes, 'manual')"))
        conn.execute(text("UPDATE circuitos SET usar_kva_informado = FALSE WHERE usar_kva_informado IS NULL"))
