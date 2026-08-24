from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field

from app.services.areas_classificadas import calcular_areas_classificadas
from app.services.aterramento import calcular_aterramento
from app.services.calculo import calcular_circuito
from app.services.para_raios import calcular_para_raios
from app.services.projeto_eletrico import calcular_sistema_trifasico_projeto, calcular_transformador
from app.services.protecao import validar_protecao_geral

router = APIRouter()


class CircuitoPayload(BaseModel):
    model_config = ConfigDict(extra="allow")
    contexto: Optional[str] = "industrial"


class ModuloPayload(BaseModel):
    modulo: str
    dados: Optional[Dict[str, Any]] = None
    circuitos: Optional[list] = None
    tensao_ref: Optional[int] = 380
    transformador: Optional[Dict[str, Any]] = None


class CircuitoLotePayload(BaseModel):
    contexto: Optional[str] = "industrial"
    circuitos: List[Dict[str, Any]] = Field(default_factory=list)


class DictObj:
    def __init__(self, d):
        self.__dict__.update(d)

    def __getattr__(self, name):
        return None


@router.post("/calcular")
def calcular_endpoint(payload: dict):
    contexto = payload.pop("contexto", "industrial")
    circuito = DictObj(payload)
    return calcular_circuito(circuito, contexto)


@router.post("/calcular-lote")
def calcular_lote_endpoint(payload: CircuitoLotePayload):
    resultados = []
    erros = []

    for index, item in enumerate(payload.circuitos or []):
        dados = dict(item or {})
        contexto = dados.pop("contexto", None) or payload.contexto or "industrial"
        circuito_id = dados.get("id") or dados.get("_id")
        try:
            resultado = calcular_circuito(DictObj(dados), contexto)
            resultados.append({
                "index": index,
                "id": circuito_id,
                "resultado": resultado,
            })
        except Exception as exc:
            erro = {
                "index": index,
                "id": circuito_id,
                "erro": str(exc),
            }
            resultados.append(erro)
            erros.append(erro)

    return {
        "total": len(payload.circuitos or []),
        "calculados": len(resultados) - len(erros),
        "erros": erros,
        "resultados": resultados,
    }


@router.post("/calcular-modulo")
def calcular_modulo_endpoint(payload: ModuloPayload):
    modulo_raw = payload.modulo or ""
    modulo = modulo_raw.strip().lower().replace("-", "_")
    dados = payload.dados or {}

    if modulo == "transformador":
        return calcular_transformador(dados)

    if modulo in {"sistema_trifasico", "sistema_trifasico_projeto"}:
        circuitos = [DictObj(c) for c in (payload.circuitos or [])]
        return calcular_sistema_trifasico_projeto(dados, circuitos, payload.tensao_ref)

    if modulo in {"protecoes", "protecao_geral"}:
        return validar_protecao_geral(dados, payload.transformador or {})

    if modulo == "para_raios":
        return calcular_para_raios(dados)

    if modulo == "aterramento":
        return calcular_aterramento(dados)

    if modulo == "areas_classificadas":
        return calcular_areas_classificadas(dados)

    return {"erro": f"Modulo desconhecido: {modulo_raw}", "status": "ALERTA"}

