# backend/app/services/pdf/helpers.py
"""Pure Python helpers shared by all PDF section modules.

No ReportLab imports here – these functions can be used by PDF,
Excel, IA and any future consumer without pulling in the PDF stack.
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional

from app.services.calculo import CONTEXTOS
from app.services.projeto_eletrico import (
    calcular_sistema_trifasico_projeto,
    calcular_transformador,
    carregar_json,
)
from app.services.aterramento import calcular_aterramento
from app.services.areas_classificadas import calcular_areas_classificadas
from app.services.para_raios import calcular_para_raios
from app.services.protecao import validar_protecao_geral
from app.services.status_utils import (
    is_critico,
    limpar_texto,
    normalizar_status,
    normalizar_tipo_cabo,
    status_global,
    status_visual,
)
from app.services.pdf.estilos import OK_FILL, ALERT_FILL, CRITICAL_FILL


# ---------------------------------------------------------------------------
# Context / type helpers
# ---------------------------------------------------------------------------

def _ctx(contexto: Any) -> str:
    """Resolve a contexto enum/string to its canonical string value."""
    if hasattr(contexto, "value"):
        return contexto.value
    return str(contexto or "industrial").split(".")[-1]


def _tipo_cabo(tipo: Any) -> str:
    return normalizar_tipo_cabo(tipo)


def _norma_ref(projeto: Any) -> str:
    contexto = _ctx(projeto.contexto)
    return CONTEXTOS.get(contexto, CONTEXTOS["industrial"])["norma_ref"]


# ---------------------------------------------------------------------------
# Status helpers
# ---------------------------------------------------------------------------

def _status_final(c: Any) -> str:
    """Return a normalised final status string for a circuit."""
    if getattr(c, "status_final", None):
        return normalizar_status(c.status_final)
    st = getattr(c, "status", None)
    if st == "ok":
        return "OK"
    if st == "erro":
        return "CRITICO"
    if st == "alerta":
        return "ALERTA"
    return "ALERTA"


def _status_fill(status: Any):
    """Return a ReportLab fill colour for a status string."""
    status = normalizar_status(status)
    if status == "OK":
        return OK_FILL
    if status == "CRITICO":
        return CRITICAL_FILL
    return ALERT_FILL


def _status_hex(status: Any):
    """Return a ReportLab fill colour with ALERTA as default."""
    status = normalizar_status(status, "ALERTA")
    if status == "OK":
        return OK_FILL
    if status == "CRITICO":
        return CRITICAL_FILL
    return ALERT_FILL


def _critico(status: Any) -> bool:
    return is_critico(status)


# ---------------------------------------------------------------------------
# Data helpers
# ---------------------------------------------------------------------------

def _tem_dados_tecnicos(dados: Any) -> bool:
    """True if dict has at least one meaningful value. Safe against None."""
    if not dados or not isinstance(dados, dict):
        return False
    return any(v not in (None, "", {}) for v in dados.values())


def _contagem_status(circuitos: List[Any]) -> Dict[str, Any]:
    total = len(circuitos)
    ok = sum(1 for c in circuitos if _status_final(c) == "OK")
    alertas = sum(1 for c in circuitos if _status_final(c) == "ALERTA")
    criticos = sum(1 for c in circuitos if _critico(_status_final(c)))
    status = (
        "CRITICO" if criticos
        else "ALERTA" if alertas
        else "OK" if total
        else "NAO CALCULADO"
    )
    return {"total": total, "ok": ok, "alertas": alertas, "criticos": criticos, "status": status}


def _contagem_protecoes_circuitos(circuitos: List[Any]) -> Dict[str, int]:
    statuses = [normalizar_status(getattr(c, "protecao_status", None), "OK") for c in circuitos]
    return {
        "ok": sum(1 for s in statuses if s == "OK"),
        "alerta": sum(1 for s in statuses if s == "ALERTA"),
        "critico": sum(1 for s in statuses if s == "CRITICO"),
    }


def _resumo_global(
    projeto: Any,
    circuitos: List[Any],
    modulos: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Build the global project summary used across the PDF."""
    circ = _contagem_status(circuitos)
    if modulos is None:
        transformador = calcular_transformador(
            carregar_json(getattr(projeto, "transformador_dados", None))
        )
        modulos = {
            "Proteção geral": validar_protecao_geral(
                carregar_json(getattr(projeto, "protecao_geral_dados", None)), transformador
            ),
            "Para-raios": calcular_para_raios(
                carregar_json(getattr(projeto, "para_raios_dados", None))
            ),
            "Aterramento": calcular_aterramento(
                carregar_json(getattr(projeto, "aterramento_dados", None))
            ),
            "Áreas Classificadas": calcular_areas_classificadas(
                carregar_json(getattr(projeto, "areas_classificadas_dados", None))
            ),
        }

    protecoes = _contagem_protecoes_circuitos(circuitos)
    status_items = [circ["status"]]
    status_items.extend(normalizar_status(getattr(c, "protecao_status", None), "OK") for c in circuitos)
    status_items.extend(normalizar_status(d.get("status"), "ALERTA") for d in modulos.values())
    geral = status_global(*status_items)

    criticos: List[str] = []
    alertas: List[str] = []
    if circ["criticos"]:
        criticos.append(f"Circuitos ({circ['criticos']} crítico(s))")
    elif circ["alertas"]:
        alertas.append(f"Circuitos ({circ['alertas']} em alerta)")

    if protecoes["critico"]:
        criticos.append(f"Proteções de circuitos ({protecoes['critico']} crítica(s))")
    elif protecoes["alerta"]:
        alertas.append(f"Proteções de circuitos ({protecoes['alerta']} em alerta)")

    for nome, dados in modulos.items():
        st = normalizar_status(dados.get("status"), "ALERTA")
        msg = dados.get("mensagem") or "sem justificativa"
        if st == "CRITICO":
            criticos.append(f"{nome}: {msg}")
        elif st == "ALERTA":
            if nome == "Para-raios":
                alertas.append("Para-raios não informado ou incompleto.")
            else:
                alertas.append(f"{nome}: {msg}")

    if criticos:
        motivo = f"Há {len(criticos)} pendência(s) crítica(s) e {len(alertas)} pendência(s) em alerta."
    elif alertas:
        motivo = f"Há {len(alertas)} pendência(s) em alerta."
    else:
        motivo = "Todos os módulos avaliados estão OK."

    return {
        **circ,
        "status": geral,
        "protecoes": protecoes,
        "modulos": modulos,
        "criticos_modulos": criticos,
        "alertas_modulos": alertas,
        "modulos_contagem": {
            "ok": sum(1 for d in modulos.values() if normalizar_status(d.get("status"), "ALERTA") == "OK"),
            "alerta": sum(1 for d in modulos.values() if normalizar_status(d.get("status"), "ALERTA") == "ALERTA"),
            "critico": sum(1 for d in modulos.values() if normalizar_status(d.get("status"), "ALERTA") == "CRITICO"),
        },
        "motivo_status": motivo,
    }


def _conclusoes_tecnicas(
    circuitos: List[Any],
    resumo_global: Optional[Dict[str, Any]] = None,
) -> List[str]:
    """Produce the list of technical conclusion lines for the memorial."""
    if not circuitos and not resumo_global:
        return ["Nenhum circuito cadastrado para emissão do memorial técnico."]

    fora_qt = sum(
        1 for c in circuitos
        if (getattr(c, "queda_tensao_acumulada", None) if getattr(c, "queda_tensao_acumulada", None) is not None else getattr(c, "queda_tensao_pct", None)) is not None
        and getattr(c, "queda_tensao_max", None) is not None
        and (getattr(c, "queda_tensao_acumulada", None) if getattr(c, "queda_tensao_acumulada", None) is not None else getattr(c, "queda_tensao_pct", None))
        > getattr(c, "queda_tensao_max", None)
    )
    protecao_critica = sum(1 for c in circuitos if _critico(getattr(c, "protecao_status", None)))
    selecao_critica = sum(1 for c in circuitos if getattr(c, "selecao_componentes_status", None) == "CRITICO")
    validacao_critica = sum(1 for c in circuitos if _critico(getattr(c, "validacao_status", None)))
    n_alertas = sum(1 for c in circuitos if _status_final(c) == "ALERTA")

    resumo_global = resumo_global or {}
    status_geral = resumo_global.get("status") or (
        "CRITICO" if any([fora_qt, protecao_critica, selecao_critica, validacao_critica])
        else "ALERTA" if n_alertas
        else "OK"
    )
    criticos_modulos = resumo_global.get("criticos_modulos", [])
    alertas_modulos = resumo_global.get("alertas_modulos", [])

    linhas: List[str] = []
    if status_geral == "CRITICO":
        linhas.append("Projeto NÃO está liberado para emissão final pelo CalcCabos.")
        if criticos_modulos:
            linhas.append("Módulos críticos: " + "; ".join(criticos_modulos))
    elif status_geral == "ALERTA":
        linhas.append("Projeto requer revisão técnica antes da emissão final.")
    else:
        linhas.append("Projeto atende aos critérios de dimensionamento calculados pelo CalcCabos.")

    if fora_qt:
        linhas.append(f"{fora_qt} circuito(s) estão fora do limite de queda de tensão.")
    if protecao_critica:
        linhas.append(f"{protecao_critica} circuito(s) possuem proteção/disjuntor inadequado.")
    if selecao_critica:
        linhas.append(f"{selecao_critica} circuito(s) não possuem componente automático compatível.")
    if validacao_critica:
        linhas.append(f"{validacao_critica} circuito(s) possuem validação normativa crítica.")
    if n_alertas or alertas_modulos:
        itens = []
        if n_alertas:
            itens.append(f"{n_alertas} circuito(s) exigem atenção por margem baixa ou dados incompletos")
        itens.extend(alertas_modulos)
        linhas.append("Pendências em alerta: " + "; ".join(itens))
    return linhas
