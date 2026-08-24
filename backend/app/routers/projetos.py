from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.circuito import Circuito
from app.models.projeto import ContextoNormativo, Projeto
from app.models.usuario import Usuario
from app.routers.auth import usuario_atual
from app.services.projeto_eletrico import (
    calcular_sistema_trifasico,
    calcular_sistema_trifasico_projeto,
    calcular_transformador,
    carregar_json,
    dump_json,
)

router = APIRouter()


from typing import List
from app.schemas.projeto import ProjetoCreate, ProjetoUpdate, ProjetoRead

def _projeto_do_usuario(id: int, db: Session, u: Usuario) -> Projeto:
    p = db.query(Projeto).filter(Projeto.id == id, Projeto.usuario_id == u.id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Projeto nao encontrado")
    return p


@router.get("/", response_model=List[ProjetoRead])
@router.get("", response_model=List[ProjetoRead])
def listar(db: Session = Depends(get_db), u: Usuario = Depends(usuario_atual)):
    return db.query(Projeto).filter(Projeto.usuario_id == u.id).order_by(Projeto.criado_em.desc()).all()


@router.post("/", response_model=ProjetoRead)
@router.post("", response_model=ProjetoRead)
def criar(dados: ProjetoCreate, db: Session = Depends(get_db), u: Usuario = Depends(usuario_atual)):
    # FIX: Use .model_dump() instead of deprecated .dict() (Pydantic v2)
    p = Projeto(**dados.model_dump(), usuario_id=u.id)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.get("/{id}", response_model=ProjetoRead)
def obter(id: int, db: Session = Depends(get_db), u: Usuario = Depends(usuario_atual)):
    return _projeto_do_usuario(id, db, u)


@router.put("/{id}", response_model=ProjetoRead)
def atualizar(id: int, dados: ProjetoUpdate, db: Session = Depends(get_db), u: Usuario = Depends(usuario_atual)):
    p = _projeto_do_usuario(id, db, u)
    # FIX: Use .model_dump() instead of deprecated .dict() (Pydantic v2)
    for k, v in dados.model_dump().items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p


@router.get("/{id}/transformador")
def obter_transformador(id: int, db: Session = Depends(get_db), u: Usuario = Depends(usuario_atual)):
    p = _projeto_do_usuario(id, db, u)
    return calcular_transformador(carregar_json(p.transformador_dados))


@router.put("/{id}/transformador")
def salvar_transformador(id: int, dados: Dict[str, Any], db: Session = Depends(get_db), u: Usuario = Depends(usuario_atual)):
    p = _projeto_do_usuario(id, db, u)
    calculado = calcular_transformador(dados)
    p.transformador_dados = dump_json(calculado)
    if calculado.get("tensao_secundaria"):
        p.tensao_ref = int(round(calculado["tensao_secundaria"]))
    db.commit()
    db.refresh(p)
    return calculado


@router.get("/{id}/sistema-trifasico")
def obter_sistema_trifasico(id: int, db: Session = Depends(get_db), u: Usuario = Depends(usuario_atual)):
    p = _projeto_do_usuario(id, db, u)
    circuitos = db.query(Circuito).filter(Circuito.projeto_id == id).all()
    return calcular_sistema_trifasico_projeto(carregar_json(p.sistema_trifasico_dados), circuitos, p.tensao_ref)


@router.put("/{id}/sistema-trifasico")
def salvar_sistema_trifasico(id: int, dados: Dict[str, Any], db: Session = Depends(get_db), u: Usuario = Depends(usuario_atual)):
    p = _projeto_do_usuario(id, db, u)
    calculado = calcular_sistema_trifasico(dados)
    p.sistema_trifasico_dados = dump_json(calculado)
    db.commit()
    circuitos = db.query(Circuito).filter(Circuito.projeto_id == id).all()
    return calcular_sistema_trifasico_projeto(calculado, circuitos, p.tensao_ref)


@router.delete("/{id}")
def deletar(id: int, db: Session = Depends(get_db), u: Usuario = Depends(usuario_atual)):
    p = _projeto_do_usuario(id, db, u)
    db.delete(p)
    db.commit()
    return {"ok": True}


# ── FASE 3: Endpoint de proteções por circuito ───────────────────────────────
# GET /api/projetos/:id/protecoes/circuitos
#
# Agrega os dados de proteção JÁ CALCULADOS e armazenados em cada circuito.
# NÃO recalcula — apenas lê o que está no banco.
# Difere de GET /:id/protecoes (que chama o módulo de cálculo de proteção geral
# do transformador). Este endpoint é específico para proteções por circuito.
#
# Retornos:
#   200  { projetoId, protecoes: [...] }  — inclui array vazio se sem circuitos
#   404  { detail: "..." }               — projeto não encontrado ou não pertence ao usuário
@router.get("/{id}/protecoes/circuitos")
def obter_protecoes_circuitos(id: int, db: Session = Depends(get_db), u: Usuario = Depends(usuario_atual)):
    """Retorna dados de proteção já calculados para cada circuito do projeto.

    Agrega disjuntor, seção, corrente projetada e status de proteção diretamente
    do banco — sem recalcular. Útil para relatórios e dashboards de proteções.
    """
    p = _projeto_do_usuario(id, db, u)
    circuitos = db.query(Circuito).filter(Circuito.projeto_id == id).order_by(Circuito.ordem).all()

    protecoes = []
    for c in circuitos:
        protecoes.append({
            "circuitoId": c.id,
            "circuitoTag": c.tag or c.descricao,
            "descricao": c.descricao,
            "disjuntor": c.disjuntor_corrente_nominal or c.disjuntor_a,
            "disjuntorCurva": c.disjuntor_curva,
            "disjuntorIcu": c.disjuntor_icu,
            "disjuntorFabricante": c.disjuntor_fabricante,
            "secao": c.secao_mm2,
            "secaoPe": c.secao_pe_mm2,
            "correnteProjetada": c.corrente_projeto or c.corrente_nominal,
            "correnteCorrigida": c.corrente_corrigida,
            "ampacidade": c.ampacidade,
            "protecaoStatus": c.protecao_status,
            "protecaoNota": c.protecao_nota,
            "statusFinal": c.status_final,
        })

    return {
        "projetoId": id,
        "projetoNome": p.nome,
        "totalCircuitos": len(protecoes),
        "protecoes": protecoes,
    }
