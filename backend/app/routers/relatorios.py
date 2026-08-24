"""relatorios.py — Router de relatórios PDF e Excel.

Endpoints disponíveis:
  GET  /api/projetos/:id/relatorio/pdf    — FASE 4: busca tudo do banco, gera PDF
  GET  /api/projetos/:id/relatorio/excel  — FASE 4: busca tudo do banco, gera Excel
  POST /relatorio/pdf                     — DEPRECATED: mantido por compatibilidade
  POST /relatorio/excel                   — DEPRECATED: mantido por compatibilidade
"""
from io import BytesIO
from typing import Any, Dict, List, Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.circuito import Circuito
from app.models.projeto import Projeto
from app.models.usuario import Usuario
from app.routers.auth import usuario_atual
from app.services.relatorio_pdf import gerar_pdf
from app.services.relatorio_excel import gerar_excel


class DictObj:
    def __init__(self, d):
        self.__dict__.update(d)

    def __getattr__(self, name):
        return None


router = APIRouter()
compat_router = APIRouter()


# ── FASE 4: Endpoints REST por ID ─────────────────────────────────────────────
# GET /api/projetos/:id/relatorio/pdf
# GET /api/projetos/:id/relatorio/excel
#
# O backend busca projeto, circuitos e usuário no banco usando :id.
# Não é necessário nenhum body na requisição.
#
# Retornos:
#   200  application/pdf ou .xlsx  — arquivo gerado
#   404  { "detail": "..." }       — projeto não encontrado

@router.get("/{id}/relatorio/pdf", tags=["relatorios"])
def gerar_relatorio_pdf(
    id: int,
    db: Session = Depends(get_db),
    u: Usuario = Depends(usuario_atual),
):
    """Gera o relatório PDF do projeto buscando todos os dados do banco.

    Não requer body — o backend busca projeto, circuitos e usuário internamente.
    """
    p = db.query(Projeto).filter(Projeto.id == id, Projeto.usuario_id == u.id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")

    circuitos_orm = (
        db.query(Circuito)
        .filter(Circuito.projeto_id == id)
        .order_by(Circuito.ordem)
        .all()
    )

    # Converte ORM → DictObj compatível com gerar_pdf
    projeto_obj = DictObj(
        {
            "id": p.id,
            "nome": p.nome,
            "descricao": p.descricao,
            "cliente": p.cliente,
            "contexto": p.contexto,
            "tensao_ref": p.tensao_ref,
            "criado_em": p.criado_em,
        }
    )
    circuitos_obj = [
        DictObj(
            {col.name: getattr(c, col.name) for col in Circuito.__table__.columns}
        )
        for c in circuitos_orm
    ]
    usuario_obj = DictObj(
        {"nome": u.nome, "email": u.email, "crea": u.crea, "empresa": u.empresa}
    )

    pdf_bytes = gerar_pdf(projeto_obj, circuitos_obj, usuario_obj)
    filename = f"calccabos_{p.id}.pdf"

    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/{id}/relatorio/excel", tags=["relatorios"])
def gerar_relatorio_excel(
    id: int,
    db: Session = Depends(get_db),
    u: Usuario = Depends(usuario_atual),
):
    """Gera o relatório Excel do projeto buscando todos os dados do banco.

    Não requer body — o backend busca projeto, circuitos e usuário internamente.
    """
    p = db.query(Projeto).filter(Projeto.id == id, Projeto.usuario_id == u.id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")

    circuitos_orm = (
        db.query(Circuito)
        .filter(Circuito.projeto_id == id)
        .order_by(Circuito.ordem)
        .all()
    )

    projeto_obj = DictObj(
        {
            "id": p.id,
            "nome": p.nome,
            "descricao": p.descricao,
            "cliente": p.cliente,
            "contexto": p.contexto,
            "tensao_ref": p.tensao_ref,
            "criado_em": p.criado_em,
        }
    )
    circuitos_obj = [
        DictObj(
            {col.name: getattr(c, col.name) for col in Circuito.__table__.columns}
        )
        for c in circuitos_orm
    ]
    usuario_obj = DictObj(
        {"nome": u.nome, "email": u.email, "crea": u.crea, "empresa": u.empresa}
    )

    excel_bytes = gerar_excel(projeto_obj, circuitos_obj, usuario_obj)
    filename = f"calccabos_{p.id}.xlsx"

    return StreamingResponse(
        BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# Contrato usado pelo frontend e pelo backend Node em producao.
# As rotas REST antigas em /api/projetos/{id}/relatorio/* continuam ativas.
@compat_router.get("/{id}/{tipo}", tags=["relatorios-compat"])
def gerar_relatorio_compat(
    id: int,
    tipo: Literal["pdf", "excel"],
    db: Session = Depends(get_db),
    u: Usuario = Depends(usuario_atual),
):
    if tipo == "pdf":
        return gerar_relatorio_pdf(id=id, db=db, u=u)
    return gerar_relatorio_excel(id=id, db=db, u=u)


# ── DEPRECATED: endpoints antigos mantidos por compatibilidade ─────────────────
# Os endpoints POST abaixo recebem projeto+circuitos+usuario no body.
# Mantidos para não quebrar clientes existentes.
# DEPRECATED desde v2.1.0 — usar GET /api/projetos/:id/relatorio/pdf|excel

class RelatorioPayload(BaseModel):
    projeto: Dict[str, Any]
    circuitos: List[Dict[str, Any]]
    usuario: Dict[str, Any]


# DEPRECATED — use GET /api/projetos/:id/relatorio/pdf
@router.post("/pdf", tags=["relatorios-deprecated"])
def exportar_pdf(payload: RelatorioPayload):
    p = DictObj(payload.projeto)
    p.id = payload.projeto.get("id") or payload.projeto.get("_id")

    circuitos = [DictObj(c) for c in payload.circuitos]
    u = DictObj(payload.usuario)

    pdf_bytes = gerar_pdf(p, circuitos, u)
    filename = f"calccabos_{p.id or 'relatorio'}.pdf"

    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# DEPRECATED — use GET /api/projetos/:id/relatorio/excel
@router.post("/excel", tags=["relatorios-deprecated"])
def exportar_excel(payload: RelatorioPayload):
    p = DictObj(payload.projeto)
    p.id = payload.projeto.get("id") or payload.projeto.get("_id")

    circuitos = [DictObj(c) for c in payload.circuitos]
    u = DictObj(payload.usuario)

    excel_bytes = gerar_excel(p, circuitos, u)
    filename = f"calccabos_{p.id or 'relatorio'}.xlsx"

    return StreamingResponse(
        BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
