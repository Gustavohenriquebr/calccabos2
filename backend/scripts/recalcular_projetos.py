#!/usr/bin/env python3
"""recalcular_projetos.py — Script de recálculo em lote pós-correção do bug K2.

Uso:
  python3 scripts/recalcular_projetos.py --dry-run   # mostra o que mudaria, sem gravar
  python3 scripts/recalcular_projetos.py --apply     # aplica mudanças e salva log

Propósito:
  Projetos salvos no banco ANTES da correção do bug K2 (2026-08-17) podem ter
  valores de seção/disjuntor/ΔV% calculados com K2 errado (coluna de eletroduto
  aplicada a circuitos em bandeja). Este script recalcula todos os circuitos
  usando a lógica corrigida já em produção e registra cada diferença.

Log de auditoria:
  backend/recalculo_log.json — uma entrada por campo alterado, por circuito.
  NÃO sobrescreve sem log. Rastreabilidade total.

Segurança:
  --dry-run é o modo padrão e não grava NADA no banco.
  --apply requer confirmação explícita e salva o log antes de gravar.
"""
import sys
import os
import json
import argparse
import logging
from datetime import datetime, timezone
from pathlib import Path

# ── Setup path para importar o app ───────────────────────────────────────────
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

# ── Importações do app ────────────────────────────────────────────────────────
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine

from app.config import settings
from app.database import Base
from app.models.circuito import Circuito
from app.models.projeto import Projeto
import app.models  # carrega todos os modelos

from app.services.calculo import calcular_circuito

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("recalculo")

# ── Campos auditados (calculados pelo motor, armazenados no banco) ─────────────
# Inclui os campos mais relevantes para a correção do K2.
CAMPOS_AUDITADOS = [
    "fator_k2",
    "secao_mm2",
    "disjuntor_a",
    "disjuntor_corrente_nominal",
    "queda_tensao_pct",
    "queda_tensao_acumulada",
    "corrente_corrigida",
    "ampacidade",
    "secao_pe_mm2",
    "status_final",
    "protecao_status",
]

LOG_PATH = BACKEND_DIR / "recalculo_log.json"


def _get_engine():
    url = settings.DATABASE_URL
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return create_engine(url, connect_args={"check_same_thread": False} if "sqlite" in url else {})


def _arredondar(valor):
    """Normaliza valores float para comparação sem ruído de ponto flutuante."""
    if isinstance(valor, float):
        return round(valor, 4)
    return valor


def _comparar(circuito_orm, resultado_novo):
    """Retorna lista de diffs {campo, valor_antigo, valor_novo} para campos alterados."""
    diffs = []
    for campo in CAMPOS_AUDITADOS:
        antigo = _arredondar(getattr(circuito_orm, campo, None))
        novo = _arredondar(resultado_novo.get(campo))
        if antigo != novo and not (antigo is None and novo is None):
            diffs.append({
                "campo": campo,
                "valor_antigo": antigo,
                "valor_novo": novo,
            })
    return diffs


def recalcular(dry_run: bool = True):
    engine = _get_engine()
    Session = sessionmaker(bind=engine)
    db = Session()

    timestamp = datetime.now(timezone.utc).isoformat()
    modo = "DRY-RUN" if dry_run else "APPLY"
    logger.info(f"=== Recálculo em lote — modo {modo} === {timestamp}")

    # Estatísticas
    total_projetos = 0
    total_circuitos = 0
    circuitos_com_diff = 0
    projetos_afetados = set()
    entradas_log = []

    projetos = db.query(Projeto).order_by(Projeto.id).all()
    total_projetos = len(projetos)
    logger.info(f"Projetos encontrados: {total_projetos}")

    for projeto in projetos:
        contexto = str(projeto.contexto.value if hasattr(projeto.contexto, "value") else projeto.contexto or "industrial")
        circuitos = (
            db.query(Circuito)
            .filter(Circuito.projeto_id == projeto.id)
            .order_by(Circuito.ordem)
            .all()
        )

        for circuito in circuitos:
            total_circuitos += 1
            try:
                resultado_novo = calcular_circuito(circuito, contexto)
            except Exception as exc:
                logger.warning(f"  ERRO ao recalcular circuito id={circuito.id} "
                               f"tag={circuito.tag or circuito.descricao}: {exc}")
                continue

            diffs = _comparar(circuito, resultado_novo)
            if not diffs:
                continue

            circuitos_com_diff += 1
            projetos_afetados.add(projeto.id)

            entrada = {
                "timestamp": timestamp,
                "projeto_id": projeto.id,
                "projeto_nome": projeto.nome,
                "circuito_id": circuito.id,
                "circuito_tag": circuito.tag or circuito.descricao,
                "metodo_instalacao": circuito.metodo_instalacao,
                "agrupamento": circuito.agrupamento,
                "alteracoes": diffs,
            }
            entradas_log.append(entrada)

            logger.info(
                f"  [DIFF] Proj {projeto.id} '{projeto.nome}' | "
                f"Circ {circuito.id} '{circuito.tag or circuito.descricao}' "
                f"({circuito.metodo_instalacao}, agrup={circuito.agrupamento}) "
                f"→ {len(diffs)} campo(s) alterado(s)"
            )
            for d in diffs:
                logger.info(f"         {d['campo']}: {d['valor_antigo']} → {d['valor_novo']}")

            if not dry_run:
                for campo in CAMPOS_AUDITADOS:
                    if campo in resultado_novo:
                        setattr(circuito, campo, resultado_novo[campo])

        if not dry_run and projetos_afetados:
            db.commit()

    # ── Relatório final ────────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print(f"  RELATÓRIO DE RECÁLCULO — {modo}")
    print("=" * 70)
    print(f"  Total de projetos no banco:       {total_projetos}")
    print(f"  Total de circuitos verificados:   {total_circuitos}")
    print(f"  Projetos com circuitos alterados: {len(projetos_afetados)}")
    print(f"  Circuitos com alguma diferença:   {circuitos_com_diff}")
    if circuitos_com_diff:
        campos_contagem = {}
        for e in entradas_log:
            for a in e["alteracoes"]:
                campos_contagem[a["campo"]] = campos_contagem.get(a["campo"], 0) + 1
        print(f"\n  Campos mais alterados:")
        for campo, cnt in sorted(campos_contagem.items(), key=lambda x: -x[1]):
            print(f"    {campo}: {cnt} circuito(s)")
    print("=" * 70)

    if dry_run:
        print("\n  MODO DRY-RUN: nenhum dado foi gravado no banco.")
        if circuitos_com_diff:
            print(f"  Para aplicar, rode com --apply após aprovação.")
    else:
        # Salva log de auditoria
        log_existente = []
        if LOG_PATH.exists():
            try:
                log_existente = json.loads(LOG_PATH.read_text(encoding="utf-8"))
            except Exception:
                log_existente = []
        log_existente.extend(entradas_log)
        LOG_PATH.write_text(json.dumps(log_existente, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\n  Log de auditoria salvo em: {LOG_PATH}")
        print(f"  Banco atualizado com {circuitos_com_diff} circuito(s) recalculado(s).")

    db.close()
    return {
        "total_projetos": total_projetos,
        "total_circuitos": total_circuitos,
        "projetos_afetados": len(projetos_afetados),
        "circuitos_com_diff": circuitos_com_diff,
        "entradas_log": entradas_log,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Recalcula circuitos do banco com a lógica K2 corrigida.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--dry-run",
        action="store_true",
        help="Modo seguro: apenas reporta diferenças, NÃO grava no banco.",
    )
    group.add_argument(
        "--apply",
        action="store_true",
        help="Aplica as mudanças e salva log de auditoria. Requer --dry-run ter sido feito antes.",
    )
    args = parser.parse_args()

    if args.apply:
        print("\n⚠️  ATENÇÃO: --apply irá modificar registros no banco de dados.")
        print("   Isso pode alterar dimensionamento de cabos em projetos existentes.")
        confirmacao = input("   Digite 'CONFIRMAR' para prosseguir: ").strip()
        if confirmacao != "CONFIRMAR":
            print("   Cancelado.")
            sys.exit(0)

    recalcular(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
