"""Modelo tecnico parametrizado de tensao para o CalcCabos.

Este modulo classifica e documenta tensao como dado tecnico completo. Ele nao
declara conformidade normativa e, para MT/AT/EAT/UAT, registra limitacoes para
validacao profissional e dados especificos de isolamento/protecao.
"""

from typing import Any, Dict, List, Optional


AC_REFERENCIAS = {"fase_neutro", "fase_fase"}
DC_REFERENCIAS = {"polo_polo", "polo_terra", "monopolar", "bipolar", "cc"}
CONTEXTOS_APLICACAO = {
    "predial",
    "industrial",
    "mineracao",
    "mineração",
    "offshore",
    "subestacao",
    "subestação",
    "distribuicao",
    "distribuição",
    "transmissao",
    "transmissão",
    "geracao",
    "geração",
    "hidreletrica",
    "hidrelétrica",
    "termeletrica",
    "termelétrica",
    "nuclear",
    "fotovoltaico",
    "data center",
    "outro",
}


def _normalizar_texto(valor: Any, padrao: str = "") -> str:
    texto = str(valor or padrao).strip().lower()
    return texto.replace("-", "_").replace(" ", "_")


def _float(valor: Any) -> Optional[float]:
    if valor is None or valor == "":
        return None
    try:
        numero = float(valor)
    except (TypeError, ValueError):
        return None
    return numero if numero > 0 else None


def tensao_para_volts(valor: Any, unidade: Any = "V") -> Optional[float]:
    numero = _float(valor)
    if numero is None:
        return None
    unidade_norm = str(unidade or "V").strip().lower()
    return numero * 1000 if unidade_norm == "kv" else numero


def classificar_tensao_ac(tensao_v: Optional[float]) -> str:
    if tensao_v is None:
        return "NAO_INFORMADA"
    tensao_kv = tensao_v / 1000
    if tensao_kv <= 1:
        return "BT"
    if tensao_kv <= 36.2:
        return "MT"
    if tensao_kv <= 230:
        return "AT"
    if tensao_kv <= 800:
        return "EAT"
    return "UAT"


def analisar_tensao(
    *,
    valor: Any,
    unidade: Any = "V",
    tipo_sistema: Any = "AC",
    referencia: Any = None,
    fases: Any = None,
    contexto_aplicacao: Any = None,
) -> Dict[str, Any]:
    tipo = str(tipo_sistema or "AC").strip().upper()
    tipo = "DC" if tipo == "DC" else "AC"
    tensao_v = tensao_para_volts(valor, unidade)
    unidade_norm = "kV" if str(unidade or "V").strip().lower() == "kv" else "V"
    referencia_norm = _normalizar_texto(referencia)
    contexto_norm = _normalizar_texto(contexto_aplicacao)
    alertas: List[Dict[str, Any]] = []
    limitacoes: List[str] = []

    if not referencia_norm:
        referencia_norm = "fase_fase" if tipo == "AC" else "polo_polo"

    if tipo == "AC" and referencia_norm not in AC_REFERENCIAS:
        alertas.append({
            "code": "INVALID_AC_VOLTAGE_REFERENCE",
            "severity": "WARNING",
            "message": "Referencia de tensao AC nao usual; confirme fase-neutro ou fase-fase.",
            "blocking": False,
        })
    if tipo == "DC" and referencia_norm not in DC_REFERENCIAS:
        alertas.append({
            "code": "INVALID_DC_VOLTAGE_REFERENCE",
            "severity": "WARNING",
            "message": "Referencia de tensao DC nao usual; confirme polo-polo, polo-terra, monopolar ou bipolar.",
            "blocking": False,
        })

    if tensao_v is None:
        alertas.append({
            "code": "MISSING_VOLTAGE",
            "severity": "BLOCKED",
            "message": "Tensao deve ser informada como valor positivo.",
            "blocking": True,
        })
        classificacao = "NAO_INFORMADA"
    elif tipo == "DC":
        classificacao = "CC"
        alertas.append({
            "code": "DC_SYSTEM_RULES",
            "severity": "INFO",
            "message": "Sistema DC: fator de potencia e raiz de tres nao se aplicam.",
            "blocking": False,
        })
        limitacoes.append("Sistema DC registrado separadamente; niveis de isolamento/protecao DC dependem de criterios especificos.")
    else:
        classificacao = classificar_tensao_ac(tensao_v)

    if tipo == "AC" and classificacao in {"AT", "EAT", "UAT"}:
        alertas.append({
            "code": "HIGH_VOLTAGE_LIMITED_VALIDATION",
            "severity": "WARNING",
            "message": f"Tensao classificada como {classificacao}. Verificacoes de isolamento, coordenacao e protecao dependem de dados especificos e podem ficar como NOT_EVALUATED.",
            "blocking": False,
        })
        limitacoes.append("Validacao automatica de AT/EAT/UAT e limitada; requer dados de isolamento, coordenacao, equipamentos e estudo especifico.")

    try:
        fases_int = int(fases) if fases is not None and fases != "" else None
    except (TypeError, ValueError):
        fases_int = None
    if tipo == "AC" and fases_int == 3 and referencia_norm == "fase_neutro":
        alertas.append({
            "code": "PHASE_NEUTRAL_IN_THREE_PHASE",
            "severity": "WARNING",
            "message": "Tensao fase-neutro informada em sistema trifasico: confirme se a carga usa fase-neutro ou fase-fase.",
            "blocking": False,
        })

    if contexto_norm and contexto_norm not in CONTEXTOS_APLICACAO:
        alertas.append({
            "code": "APPLICATION_CONTEXT_OTHER",
            "severity": "INFO",
            "message": "Contexto de aplicacao tratado como outro; registre premissas no memorial.",
            "blocking": False,
        })

    return {
        "valor_informado": _float(valor),
        "unidade": unidade_norm,
        "tensao_v": tensao_v,
        "tensao_kv": None if tensao_v is None else tensao_v / 1000,
        "tipo_sistema": tipo,
        "referencia": referencia_norm,
        "classificacao": classificacao,
        "contexto_aplicacao": contexto_norm or None,
        "alertas": alertas,
        "limitacoes": limitacoes,
    }
