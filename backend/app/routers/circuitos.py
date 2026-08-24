from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, Request
from sqlalchemy import func
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
from app.database import get_db
from app.models.circuito import Circuito, TipoCabo
from app.models.projeto import Projeto
from app.models.usuario import Usuario
from app.routers.auth import usuario_atual
from app.services.calculo import calcular_circuito
from app.services.importador_circuitos import preview_importacao, confirmar_importacao as confirmar_importacao_arquivo
from app.services.projeto_eletrico import calcular_transformador, carregar_json
from app.services.status_utils import normalizar_tipo_cabo

router = APIRouter()

from app.schemas.circuito import CircuitoCreate, CircuitoRead, ImportarConfirmarPayload
def checar_projeto(projeto_id: int, u: Usuario, db: Session):
    p = db.query(Projeto).filter(Projeto.id == projeto_id, Projeto.usuario_id == u.id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    return p

def _tipo_cabo(valor: Any) -> TipoCabo:
    if isinstance(valor, TipoCabo):
        return valor
    texto = normalizar_tipo_cabo(valor)
    try:
        return TipoCabo(texto)
    except ValueError:
        return TipoCabo.CU_PVC


def _aplicar_origem_transformador(valores: Dict[str, Any], projeto: Projeto) -> Dict[str, Any]:
    transformador = calcular_transformador(carregar_json(getattr(projeto, "transformador_dados", None)))
    if not valores.get("isc_local") and transformador.get("corrente_curto_secundario_ka"):
        valores["isc_local"] = transformador["corrente_curto_secundario_ka"]
    return valores


def _criar_circuitos_importados(payload: ImportarConfirmarPayload, db: Session, u: Usuario) -> Dict[str, Any]:
    p = checar_projeto(payload.projeto_id, u, db)
    max_ordem = db.query(func.max(Circuito.ordem)).filter(Circuito.projeto_id == payload.projeto_id).scalar() or 0
    criados = []
    erros = []

    linhas = payload.linhas
    if getattr(payload, "mapeamento_usuario", None):
        from app.services.importador_circuitos import _validar_registro
        novas_linhas = []
        for l in linhas:
            if "dados_originais" in l:
                raw = l["dados_originais"].copy()
                raw["_linha"] = l.get("linha", 1)
                novas_linhas.append(_validar_registro(raw, payload.mapeamento_usuario))
            else:
                novas_linhas.append(l)
        linhas = novas_linhas

    for indice, linha in enumerate(linhas, start=1):
        dados = linha.get("circuito") if isinstance(linha, dict) else None
        if not dados and isinstance(linha, dict):
            dados = linha
        if not isinstance(dados, dict):
            erros.append({"linha": linha.get("linha", indice) if isinstance(linha, dict) else indice, "erros": ["Linha sem dados de circuito."]})
            continue

        try:
            valores = dict(dados)
            valores["projeto_id"] = payload.projeto_id
            valores["ordem"] = max_ordem + indice
            valores["tipo_cabo"] = _tipo_cabo(valores.get("tipo_cabo"))
            valores = _aplicar_origem_transformador(valores, p)

            circuito = Circuito(**valores)
            resultado = calcular_circuito(circuito, p.contexto)
            for campo, valor in resultado.items():
                setattr(circuito, campo, valor)
            db.add(circuito)
            criados.append(circuito)
        except Exception as exc:
            erros.append({"linha": linha.get("linha", indice) if isinstance(linha, dict) else indice, "erros": [str(exc)]})

    if criados:
        db.commit()
        for circuito in criados:
            db.refresh(circuito)

    from app.schemas.circuito import CircuitoRead
    return {
        "criados": len(criados),
        "erros": erros,
        "circuitos": [CircuitoRead.model_validate(c).model_dump() for c in criados],
    }


# ── Pagination response schema ─────────────────────────────────────────────
class PaginatedCircuitos(BaseModel):
    """Paginated envelope for circuit lists.

    The `items` field contains the current page of circuits.
    `total` is the full count for this project (used by the frontend to build
    scroll indicators and decide whether to fetch more pages).

    Backward-compat: clients reading [0], [1]... still work via `items`.
    """
    items: List[CircuitoRead]
    total: int
    limit: int
    offset: int

    class Config:
        from_attributes = True


# Max circuits per page. 1000 prevents OOM on large requests.
# Clients should use pagination for >200 circuits.
_MAX_PAGE_LIMIT = 1000
_DEFAULT_PAGE_LIMIT = 200
_BATCH_CALC_LIMIT = 5000  # safety cap on bulk calculation


@router.get("/projeto/{projeto_id}", response_model=List[CircuitoRead])
def listar(
    projeto_id: int,
    db: Session = Depends(get_db),
    u: Usuario = Depends(usuario_atual),
    limit: int = Query(default=_DEFAULT_PAGE_LIMIT, ge=1, le=_MAX_PAGE_LIMIT,
                       description="Circuits per page (default 200, max 1000)"),
    offset: int = Query(default=0, ge=0, description="Number of circuits to skip"),
    status: Optional[str] = Query(default=None, description="Filter by status_final (OK|ALERTA|CRITICO)"),
    busca: Optional[str] = Query(default=None, description="Free-text search on descricao/tag"),
):
    """List circuits for a project with pagination, filtering, and sorting.

    Returns a flat list for backward compatibility (the PaginatedCircuitos
    envelope is available via GET /projeto/{id}/paginated if needed).
    Default limit=500 keeps the first load fast; increase offset for more.
    """
    checar_projeto(projeto_id, u, db)
    q = db.query(Circuito).filter(Circuito.projeto_id == projeto_id)

    if status:
        q = q.filter(Circuito.status_final == status.upper())
    if busca:
        pattern = f"%{busca}%"
        q = q.filter(
            Circuito.descricao.ilike(pattern) | Circuito.tag.ilike(pattern)
        )

    return q.order_by(Circuito.ordem).offset(offset).limit(limit).all()


@router.get("/projeto/{projeto_id}/paginated")
def listar_paginado(
    projeto_id: int,
    db: Session = Depends(get_db),
    u: Usuario = Depends(usuario_atual),
    limit: int = Query(default=_DEFAULT_PAGE_LIMIT, ge=1, le=_MAX_PAGE_LIMIT),
    offset: int = Query(default=0, ge=0),
    status: Optional[str] = Query(default=None),
    busca: Optional[str] = Query(default=None),
) -> dict:
    """Paginated circuit list with total count for frontend pagination controls."""
    checar_projeto(projeto_id, u, db)
    q = db.query(Circuito).filter(Circuito.projeto_id == projeto_id)

    if status:
        q = q.filter(Circuito.status_final == status.upper())
    if busca:
        pattern = f"%{busca}%"
        q = q.filter(
            Circuito.descricao.ilike(pattern) | Circuito.tag.ilike(pattern)
        )

    total = q.count()
    items = q.order_by(Circuito.ordem).offset(offset).limit(limit).all()
    return {"items": items, "total": total, "limit": limit, "offset": offset}

@router.post("/", response_model=CircuitoRead)
def criar(dados: CircuitoCreate, db: Session = Depends(get_db), u: Usuario = Depends(usuario_atual)):
    p = checar_projeto(dados.projeto_id, u, db)
    # FIX: Use .model_dump() instead of deprecated .dict() (Pydantic v2)
    valores = _aplicar_origem_transformador(dados.model_dump(), p)
    c = Circuito(**valores)
    resultado = calcular_circuito(c, p.contexto)
    for k, v in resultado.items():
        setattr(c, k, v)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.post("/importar-circuitos/preview")
async def preview_importar_circuitos(
    projeto_id: int = Form(...),
    arquivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    u: Usuario = Depends(usuario_atual),
):
    checar_projeto(projeto_id, u, db)
    conteudo = await arquivo.read()
    try:
        return preview_importacao(arquivo.filename or "planilha", conteudo)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/importar-circuitos/confirmar")
async def confirmar_importacao(
    request: Request,
    db: Session = Depends(get_db),
    u: Usuario = Depends(usuario_atual),
):
    """
    Accepts two request shapes:
    1) JSON (step 3 flow): { projeto_id: int, linhas: [...] } -> IMPORTA
    2) multipart/form-data (step 2 Power BI flow): file + mapeamento_usuario (+ projeto_id) -> PREVIEW/VALIDAÇÃO
    """
    content_type = (request.headers.get("content-type") or "").lower()

    if "application/json" in content_type:
        payload = await request.json()
        importar_payload = ImportarConfirmarPayload.model_validate(payload)
        return _criar_circuitos_importados(importar_payload, db, u)

    form = await request.form()
    arquivo = form.get("file")
    mapeamento_usuario_raw = form.get("mapeamento_usuario")
    projeto_id = form.get("projeto_id")

    if arquivo is None:
        raise HTTPException(status_code=400, detail="Campo 'file' é obrigatório no multipart.")
    if mapeamento_usuario_raw is None:
        raise HTTPException(status_code=400, detail="Campo 'mapeamento_usuario' é obrigatório no multipart.")
    if projeto_id is None:
        raise HTTPException(status_code=400, detail="Campo 'projeto_id' é obrigatório no multipart.")

    try:
        mapeamento_usuario = __import__("json").loads(mapeamento_usuario_raw)
    except Exception:
        raise HTTPException(status_code=400, detail="mapeamento_usuario deve ser um JSON válido.")

    try:
        projeto_id_int = int(projeto_id)
    except Exception:
        raise HTTPException(status_code=400, detail="projeto_id deve ser um inteiro.")

    checar_projeto(projeto_id_int, u, db)
    conteudo = await arquivo.read()
    nome_arquivo = getattr(arquivo, "filename", None) or "planilha"
    resultado_import = confirmar_importacao_arquivo(nome_arquivo, conteudo, mapeamento_usuario)
    resultado_import["projeto_id"] = projeto_id_int
    return resultado_import

@router.post("/importar-circuitos")
async def importar_circuitos(
    projeto_id: int = Form(...),
    arquivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    u: Usuario = Depends(usuario_atual),
):
    checar_projeto(projeto_id, u, db)
    conteudo = await arquivo.read()
    try:
        preview = preview_importacao(arquivo.filename or "planilha", conteudo)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    linhas_validas = [linha for linha in preview["linhas"] if linha.get("valido")]
    resultado = _criar_circuitos_importados(ImportarConfirmarPayload(projeto_id=projeto_id, linhas=linhas_validas), db, u)
    resultado["preview"] = preview
    return resultado

@router.put("/{id}", response_model=CircuitoRead)
def atualizar(id: int, dados: CircuitoCreate, db: Session = Depends(get_db), u: Usuario = Depends(usuario_atual)):
    c = db.query(Circuito).filter(Circuito.id == id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Circuito não encontrado")
    p = checar_projeto(c.projeto_id, u, db)
    # FIX: Use .model_dump() instead of deprecated .dict() (Pydantic v2)
    valores = _aplicar_origem_transformador(dados.model_dump(exclude_unset=True), p)
    for k, v in valores.items():
        setattr(c, k, v)
    resultado = calcular_circuito(c, p.contexto)
    for k, v in resultado.items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return c

@router.delete("/{id}")
def deletar(id: int, db: Session = Depends(get_db), u: Usuario = Depends(usuario_atual)):
    c = db.query(Circuito).filter(Circuito.id == id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Circuito não encontrado")
    checar_projeto(c.projeto_id, u, db)
    db.delete(c)
    db.commit()
    return {"ok": True}


@router.delete("/projeto/{projeto_id}")
def deletar_por_projeto(
    projeto_id: int,
    db: Session = Depends(get_db),
    u: Usuario = Depends(usuario_atual),
):
    """Remove todos os circuitos do projeto, preservando o proprio projeto."""
    checar_projeto(projeto_id, u, db)
    removidos = (
        db.query(Circuito)
        .filter(Circuito.projeto_id == projeto_id)
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"ok": True, "removidos": removidos}

@router.post("/calcular-lote/{projeto_id}")
def calcular_lote(
    projeto_id: int,
    db: Session = Depends(get_db),
    u: Usuario = Depends(usuario_atual),
    batch_size: int = Query(default=500, ge=1, le=_BATCH_CALC_LIMIT,
                            description="Max circuits per DB commit chunk"),
):
    """Recalculate all circuits for a project.

    Processes in chunks of `batch_size` (default 500) with intermediate
    commits.  This limits peak memory use and prevents one 10k-circuit
    project from holding a write lock for minutes.
    If a single circuit raises, it is skipped (error reported) and
    calculation continues — one bad row cannot abort the entire project.
    """
    p = checar_projeto(projeto_id, u, db)
    total_circuitos = db.query(func.count(Circuito.id)).filter(
        Circuito.projeto_id == projeto_id
    ).scalar() or 0

    if total_circuitos > _BATCH_CALC_LIMIT:
        raise HTTPException(
            status_code=413,
            detail=f"Projeto tem {total_circuitos} circuitos; max={_BATCH_CALC_LIMIT}. "
                   "Use chunks menores ou ative o processamento em background.",
        )

    calculados = 0
    erros: List[dict] = []
    chunk_count = 0

    # Stream in chunks to avoid loading all rows into memory at once
    q = db.query(Circuito).filter(Circuito.projeto_id == projeto_id)
    offset = 0
    while True:
        chunk = q.order_by(Circuito.ordem).offset(offset).limit(batch_size).all()
        if not chunk:
            break
        for c in chunk:
            try:
                resultado = calcular_circuito(c, p.contexto)
                for k, v in resultado.items():
                    setattr(c, k, v)
                calculados += 1
            except Exception as exc:  # pragma: no cover
                erros.append({"id": c.id, "descricao": c.descricao, "erro": str(exc)})
        if calculados > chunk_count:
            db.commit()  # Intermediate commit per chunk
            chunk_count = calculados
        offset += batch_size

    return {
        "calculados": calculados,
        "total": total_circuitos,
        "erros": erros,
        "chunks": (total_circuitos // batch_size) + 1,
    }
