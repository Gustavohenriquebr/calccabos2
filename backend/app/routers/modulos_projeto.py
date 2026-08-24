from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.circuito import Circuito
from app.models.projeto import Projeto
from app.models.usuario import Usuario
from app.routers.auth import usuario_atual
from app.services.aterramento import calcular_aterramento
from app.services.areas_classificadas import calcular_areas_classificadas
from app.services.para_raios import calcular_para_raios
from app.services.projeto_eletrico import calcular_transformador, carregar_json, dump_json
from app.services.protecao import validar_protecao_circuito, validar_protecao_geral

router = APIRouter()


def _projeto_do_usuario(id: int, db: Session, u: Usuario) -> Projeto:
    projeto = db.query(Projeto).filter(Projeto.id == id, Projeto.usuario_id == u.id).first()
    if not projeto:
        raise HTTPException(status_code=404, detail="Projeto nao encontrado")
    return projeto


def _payload_protecoes(projeto: Projeto, db: Session) -> Dict[str, Any]:
    transformador = calcular_transformador(carregar_json(getattr(projeto, "transformador_dados", None)))
    dados_geral = carregar_json(getattr(projeto, "protecao_geral_dados", None))
    geral = validar_protecao_geral(dados_geral, transformador) if dados_geral else None
    circuitos = db.query(Circuito).filter(Circuito.projeto_id == projeto.id).order_by(Circuito.ordem).all()
    return {
        "geral": geral,
        "circuitos": [validar_protecao_circuito(circuito) for circuito in circuitos],
    }


@router.get("/{id}/protecoes")
def obter_protecoes(id: int, db: Session = Depends(get_db), u: Usuario = Depends(usuario_atual)):
    projeto = _projeto_do_usuario(id, db, u)
    return _payload_protecoes(projeto, db)


def _salvar_protecoes(id: int, dados: Dict[str, Any], db: Session, u: Usuario):
    projeto = _projeto_do_usuario(id, db, u)
    transformador = calcular_transformador(carregar_json(getattr(projeto, "transformador_dados", None)))
    calculado = validar_protecao_geral(dados, transformador)
    projeto.protecao_geral_dados = dump_json(calculado)
    db.commit()
    db.refresh(projeto)
    return calculado


@router.post("/{id}/protecoes")
def criar_ou_salvar_protecoes(id: int, dados: Dict[str, Any], db: Session = Depends(get_db), u: Usuario = Depends(usuario_atual)):
    return _salvar_protecoes(id, dados, db, u)


@router.put("/{id}/protecoes")
def salvar_protecoes(id: int, dados: Dict[str, Any], db: Session = Depends(get_db), u: Usuario = Depends(usuario_atual)):
    return _salvar_protecoes(id, dados, db, u)


@router.post("/{id}/protecoes/geral")
def criar_ou_salvar_protecao_geral(id: int, dados: Dict[str, Any], db: Session = Depends(get_db), u: Usuario = Depends(usuario_atual)):
    return _salvar_protecoes(id, dados, db, u)


@router.put("/{id}/protecoes/geral")
def salvar_protecao_geral(id: int, dados: Dict[str, Any], db: Session = Depends(get_db), u: Usuario = Depends(usuario_atual)):
    return _salvar_protecoes(id, dados, db, u)


@router.get("/{id}/para-raios")
def obter_para_raios(id: int, db: Session = Depends(get_db), u: Usuario = Depends(usuario_atual)):
    projeto = _projeto_do_usuario(id, db, u)
    calculado = calcular_para_raios(carregar_json(getattr(projeto, "para_raios_dados", None)))
    return {**calculado, "lista": calculado.get("lista", [])}


def _salvar_para_raios(id: int, dados: Dict[str, Any], db: Session, u: Usuario):
    projeto = _projeto_do_usuario(id, db, u)
    calculado = calcular_para_raios(dados)
    projeto.para_raios_dados = dump_json(calculado)
    db.commit()
    db.refresh(projeto)
    return {**calculado, "lista": calculado.get("lista", [])}


@router.post("/{id}/para-raios")
def criar_ou_salvar_para_raios(id: int, dados: Dict[str, Any], db: Session = Depends(get_db), u: Usuario = Depends(usuario_atual)):
    return _salvar_para_raios(id, dados, db, u)


@router.put("/{id}/para-raios")
def salvar_para_raios(id: int, dados: Dict[str, Any], db: Session = Depends(get_db), u: Usuario = Depends(usuario_atual)):
    return _salvar_para_raios(id, dados, db, u)


@router.get("/{id}/aterramento")
def obter_aterramento(id: int, db: Session = Depends(get_db), u: Usuario = Depends(usuario_atual)):
    projeto = _projeto_do_usuario(id, db, u)
    return calcular_aterramento(carregar_json(getattr(projeto, "aterramento_dados", None)))


def _salvar_aterramento(id: int, dados: Dict[str, Any], db: Session, u: Usuario):
    projeto = _projeto_do_usuario(id, db, u)
    calculado = calcular_aterramento(dados)
    projeto.aterramento_dados = dump_json(calculado)
    db.commit()
    db.refresh(projeto)
    return calculado


@router.post("/{id}/aterramento")
def criar_ou_salvar_aterramento(id: int, dados: Dict[str, Any], db: Session = Depends(get_db), u: Usuario = Depends(usuario_atual)):
    return _salvar_aterramento(id, dados, db, u)


@router.put("/{id}/aterramento")
def salvar_aterramento(id: int, dados: Dict[str, Any], db: Session = Depends(get_db), u: Usuario = Depends(usuario_atual)):
    return _salvar_aterramento(id, dados, db, u)


@router.get("/{id}/areas-classificadas")
def obter_areas_classificadas(id: int, db: Session = Depends(get_db), u: Usuario = Depends(usuario_atual)):
    projeto = _projeto_do_usuario(id, db, u)
    return calcular_areas_classificadas(carregar_json(getattr(projeto, "areas_classificadas_dados", None)))


def _salvar_areas_classificadas(id: int, dados: Dict[str, Any], db: Session, u: Usuario):
    projeto = _projeto_do_usuario(id, db, u)
    calculado = calcular_areas_classificadas(dados)
    projeto.areas_classificadas_dados = dump_json(calculado)
    db.commit()
    db.refresh(projeto)
    return calculado


@router.post("/{id}/areas-classificadas")
def criar_ou_salvar_areas_classificadas(id: int, dados: Dict[str, Any], db: Session = Depends(get_db), u: Usuario = Depends(usuario_atual)):
    return _salvar_areas_classificadas(id, dados, db, u)


@router.put("/{id}/areas-classificadas")
def salvar_areas_classificadas(id: int, dados: Dict[str, Any], db: Session = Depends(get_db), u: Usuario = Depends(usuario_atual)):
    return _salvar_areas_classificadas(id, dados, db, u)
