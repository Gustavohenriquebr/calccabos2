# backend/app/services/pdf/data_provider.py
"""Central data-provider for CalcCabos memorial PDF / Excel / IA layers.

Aggregates ALL technical information about a project into a single DTO
(plain dict conforming to MemorialDTO) that can be consumed by the PDF
generator, the Excel exporter, the AI assistant and any future dashboard.

The implementation re-uses the existing calculation helpers from the
*legacy* code so that no electrical formulas are altered; only data
aggregation and normalisation are performed here.

PUBLIC SURFACE
--------------
``get_memorial_data(projeto, circuitos)`` → MemorialDTO
    The only function that external modules should import.

FASE 5 CHANGES
--------------
* Added top-level keys: ``protecao_geral``, ``para_raios``, ``aterramento``,
  ``areas_classificadas``, ``tensao_secundaria``.
* Added derived metrics: ``icc_max``, ``sem_icc``, ``qt_max``,
  ``automaticos``, ``selecao_critica``.
* Added ``conclusoes_tecnicas`` list so sections never need to compute it.
* All section modules can now receive this DTO and perform zero calculations.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List

from app.services.pdf.dto import DotDict
from app.services.status_utils import normalizar_status, is_critico, status_global
from app.services.projeto_eletrico import (
    calcular_sistema_trifasico_projeto,
    calcular_transformador,
    carregar_json,
)
from app.services.aterramento import calcular_aterramento
from app.services.areas_classificadas import calcular_areas_classificadas
from app.services.para_raios import calcular_para_raios
from app.services.protecao import validar_protecao_geral

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Internal helpers (pure functions, no I/O)
# ---------------------------------------------------------------------------

def _status_final_dp(c: Any) -> str:
    """Resolve the final status for a circuit object."""
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


def _contagem_status_dp(circuitos: List[Any]) -> Dict[str, Any]:
    """Aggregate circuit status counts."""
    total = len(circuitos)
    ok = sum(1 for c in circuitos if _status_final_dp(c) == "OK")
    alertas = sum(1 for c in circuitos if _status_final_dp(c) == "ALERTA")
    criticos = sum(1 for c in circuitos if is_critico(_status_final_dp(c)))
    status = (
        "CRITICO" if criticos
        else "ALERTA" if alertas
        else "OK" if total
        else "NAO CALCULADO"
    )
    return {"total": total, "ok": ok, "alertas": alertas, "criticos": criticos, "status": status}


def _contagem_protecoes_dp(circuitos: List[Any]) -> Dict[str, int]:
    """Aggregate protection status counts across all circuits."""
    statuses = [normalizar_status(getattr(c, "protecao_status", None), "OK") for c in circuitos]
    return {
        "ok": sum(1 for s in statuses if s == "OK"),
        "alerta": sum(1 for s in statuses if s == "ALERTA"),
        "critico": sum(1 for s in statuses if s == "CRITICO"),
    }


def _build_modulos(projeto: Any, transformador: Dict[str, Any]) -> Dict[str, Any]:
    """Run all module-level calculations and return keyed results."""
    return {
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


def _build_resumo_global(
    projeto: Any, circuitos: List[Any], modulos: Dict[str, Any]
) -> Dict[str, Any]:
    """Build the high-level global summary (DTO-local implementation)."""
    circ = _contagem_status_dp(circuitos)
    prot = _contagem_protecoes_dp(circuitos)

    status_items = [circ["status"]]
    status_items.extend(normalizar_status(getattr(c, "protecao_status", None), "OK") for c in circuitos)
    status_items.extend(normalizar_status(d.get("status"), "ALERTA") for d in modulos.values())
    geral = status_global(*status_items)

    criticos_lista: List[str] = []
    alertas_lista: List[str] = []

    if circ["criticos"]:
        criticos_lista.append(f"Circuitos ({circ['criticos']} crítico(s))")
    elif circ["alertas"]:
        alertas_lista.append(f"Circuitos ({circ['alertas']} em alerta)")

    if prot["critico"]:
        criticos_lista.append(f"Proteções de circuitos ({prot['critico']} crítica(s))")
    elif prot["alerta"]:
        alertas_lista.append(f"Proteções de circuitos ({prot['alerta']} em alerta)")

    for nome, dados in modulos.items():
        st = normalizar_status(dados.get("status"), "ALERTA")
        msg = dados.get("mensagem") or "sem justificativa"
        if st == "CRITICO":
            criticos_lista.append(f"{nome}: {msg}")
        elif st == "ALERTA":
            if nome == "Para-raios":
                alertas_lista.append("Para-raios não informado ou incompleto.")
            else:
                alertas_lista.append(f"{nome}: {msg}")

    motivo = (
        f"Há {len(criticos_lista)} pendência(s) crítica(s) e {len(alertas_lista)} pendência(s) em alerta."
        if criticos_lista
        else f"Há {len(alertas_lista)} pendência(s) em alerta."
        if alertas_lista
        else "Todos os módulos avaliados estão OK."
    )

    return {
        **circ,
        "status": geral,
        "protecoes": prot,
        "modulos": modulos,
        "criticos_modulos": criticos_lista,
        "alertas_modulos": alertas_lista,
        "modulos_contagem": {
            "ok": sum(1 for d in modulos.values() if normalizar_status(d.get("status"), "ALERTA") == "OK"),
            "alerta": sum(1 for d in modulos.values() if normalizar_status(d.get("status"), "ALERTA") == "ALERTA"),
            "critico": sum(1 for d in modulos.values() if normalizar_status(d.get("status"), "ALERTA") == "CRITICO"),
        },
        "motivo_status": motivo,
    }


def _build_conclusoes(circuitos: List[Any], resumo_global: Dict[str, Any]) -> List[str]:
    """Produce technical conclusion lines. Pure function — no I/O."""
    if not circuitos:
        return ["Nenhum circuito cadastrado para emissão do memorial técnico."]

    def _qt(c: Any):
        v = getattr(c, "queda_tensao_acumulada", None)
        return v if v is not None else getattr(c, "queda_tensao_pct", None)

    fora_qt = sum(
        1 for c in circuitos
        if _qt(c) is not None and getattr(c, "queda_tensao_max", None) is not None and _qt(c) > getattr(c, "queda_tensao_max", None)
    )
    protecao_critica = sum(1 for c in circuitos if is_critico(getattr(c, "protecao_status", None)))
    selecao_critica = sum(1 for c in circuitos if getattr(c, "selecao_componentes_status", None) == "CRITICO")
    validacao_critica = sum(1 for c in circuitos if is_critico(getattr(c, "validacao_status", None)))
    n_alertas = sum(1 for c in circuitos if _status_final_dp(c) == "ALERTA")

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


def _fmt_num(valor: Any, casas: int = 2, sufixo: str = "") -> str:
    try:
        if valor is None or valor == "":
            return "-"
        return f"{float(valor):.{casas}f}{sufixo}"
    except (TypeError, ValueError):
        return "-"


def _build_interpretacoes(circuitos_dto: List[DotDict]) -> List[List[str]]:
    linhas: List[List[str]] = []

    for c in circuitos_dto:
        nome = c.get("tag_ou_descricao") or "-"
        status = c.get("status_final") or "ALERTA"
        qt = c.get("queda_tensao_calculada")
        qt_limite = c.get("queda_tensao_max")
        icc = c.get("isc_local")
        icu = c.get("disjuntor_icu") or c.get("disjuntor_sugerido_icu")
        temp = c.get("temp_ambiente")

        if qt is not None and qt_limite is not None and qt > qt_limite:
            linhas.append([nome, "Queda de tensao elevada", f"{_fmt_num(qt)}% > limite {_fmt_num(qt_limite)}%", "CRITICO"])
        elif qt is not None and qt_limite is not None and qt > qt_limite * 0.85:
            linhas.append([nome, "Queda de tensao proxima do limite", f"{_fmt_num(qt)}% de limite {_fmt_num(qt_limite)}%", "ALERTA"])

        if icc and icu and icu < icc:
            linhas.append([nome, "Margem insuficiente entre Icu e Icc", f"Icu {_fmt_num(icu, 2, ' kA')} < Icc {_fmt_num(icc, 2, ' kA')}", "CRITICO"])
        elif icc and icu and icu < icc * 1.20:
            linhas.append([nome, "Margem baixa entre Icu e Icc", f"Icu {_fmt_num(icu, 2, ' kA')} proximo de Icc {_fmt_num(icc, 2, ' kA')}", "ALERTA"])

        if not c.get("ampacidade_ok", True):
            linhas.append([nome, "Condutor subdimensionado por ampacidade", "Corrente corrigida superior a capacidade do condutor/formacao.", "CRITICO"])

        if temp is not None and temp >= 40:
            linhas.append([nome, "Temperatura ambiente elevada", f"Temperatura informada: {_fmt_num(temp, 1, ' C')}", "ALERTA"])

        if status != "OK" and not any(row[0] == nome for row in linhas):
            motivo = c.get("validacao_mensagem") or c.get("protecao_nota") or c.get("selecao_componentes_justificativa") or "Circuito requer revisao tecnica."
            linhas.append([nome, "Validacao normativa", motivo, status])

    if not linhas and circuitos_dto:
        linhas.append(["Geral", "Sem pendencias criticas detectadas", "Circuitos avaliados sem alerta principal nos criterios automatizados.", "OK"])

    return linhas[:20]


def _build_memorias_calculo(circuitos_dto: List[DotDict]) -> List[List[str]]:
    linhas: List[List[str]] = []

    for c in circuitos_dto[:8]:
        nome = c.get("tag_ou_descricao") or "-"
        linhas.append([
            nome,
            "Corrente de projeto",
            "Ib = P(kW)*1000/(sqrt(3)*V*FP*eta)",
            f"P={_fmt_num(c.get('potencia_kw'), 2, ' kW')}; V={_fmt_num(c.get('tensao'), 0, ' V')}; FP={_fmt_num(c.get('fator_potencia'), 3)}; eta={_fmt_num(c.get('fator_eficiencia'), 3)}",
            f"Ib={_fmt_num(c.get('corrente_projeto') or c.get('corrente_nominal'), 2, ' A')}",
            "NBR 5410 / criterio CalcCabos",
        ])
        linhas.append([
            nome,
            "Ampacidade corrigida",
            "Ib' = Ib/(K1*K2*K3)",
            f"K1={_fmt_num(c.get('fator_k1'), 3)}; K2={_fmt_num(c.get('fator_k2'), 3)}; K3={_fmt_num(c.get('fator_k3'), 3)}",
            f"Ib'={_fmt_num(c.get('corrente_corrigida'), 2, ' A')}; Iz={_fmt_num(c.get('corrente_condutor') or c.get('ampacidade'), 2, ' A')}",
            "NBR 5410 secao 6.2",
        ])
        linhas.append([
            nome,
            "Queda de tensao",
            "dV% = 100*sqrt(3)*Ib*L*(R*cos(phi)+X*sen(phi))/V",
            f"L={_fmt_num(c.get('distancia_m'), 1, ' m')}; R={_fmt_num(c.get('impedancia_rac'), 6)}; X={_fmt_num(c.get('impedancia_xl'), 6)}",
            f"dV={_fmt_num(c.get('queda_tensao_calculada'), 3, '%')} (limite {_fmt_num(c.get('queda_tensao_max'), 2, '%')})",
            "NBR 5410 / IEC 60228",
        ])
        linhas.append([
            nome,
            "Protecao",
            "Ib <= In <= Iz e Icu >= Icc",
            f"Ib={_fmt_num(c.get('corrente_projeto') or c.get('corrente_nominal'), 2, ' A')}; In={_fmt_num(c.get('disjuntor_corrente_nominal') or c.get('disjuntor_a'), 0, ' A')}; Icc={_fmt_num(c.get('isc_local'), 2, ' kA')}",
            f"Icu={_fmt_num(c.get('disjuntor_icu') or c.get('disjuntor_sugerido_icu'), 2, ' kA')}; status={c.get('protecao_status') or c.get('status_final')}",
            "NBR 5410 / IEC 60909",
        ])

    return linhas


def _build_benchmark_validacao(circuitos_dto: List[DotDict], resumo_global: Dict[str, Any]) -> List[List[str]]:
    total = len(circuitos_dto)
    ok = sum(1 for c in circuitos_dto if c.get("status_final") == "OK")
    alertas = sum(1 for c in circuitos_dto if c.get("status_final") == "ALERTA")
    criticos = sum(1 for c in circuitos_dto if c.get("status_final") == "CRITICO")
    convergencia = 100.0 if total and not criticos else (100.0 * ok / total if total else 0.0)

    return [
        ["Motor CalcCabos", "Resultados salvos no projeto", f"{total} circuito(s); OK={ok}; ALERTA={alertas}; CRITICO={criticos}", f"{convergencia:.1f}%", resumo_global.get("status", "ALERTA")],
        ["Memoria algebrica interna", "Formulas exibidas no memorial", "Corrente, ampacidade, queda, protecao e curto rastreados por circuito.", "Convergente quando dados de entrada estao completos", "OK"],
        ["Excel normativo externo", "Nao anexado ao projeto", "Comparacao externa pendente; anexar planilha de referencia para auditoria academica/profissional.", "-", "PENDENTE"],
        ["Caneco / ETAP / EasyPower", "Nao anexado ao projeto", "Benchmark com software comercial deve ser registrado como evidencia externa na revisao do memorial.", "-", "PENDENTE"],
    ]


def _qt_value(c: Any) -> float:
    """Resolve the voltage drop value for a circuit, defaulting to 0."""
    v = getattr(c, "queda_tensao_acumulada", None)
    result = v if v is not None else getattr(c, "queda_tensao_pct", None)
    return result or 0.0


# ---------------------------------------------------------------------------
# FASE 6 — ORM → DTO mapping
# ---------------------------------------------------------------------------

def build_circuito_dto(c: Any) -> DotDict:
    """Build a CircuitoDTO DotDict from a circuit ORM object.

    Mirrors the original map_circuito_to_dto logic but is named for clarity.
    """
    def _g(field, default=None):
        """Safe getter for ORM, dict, or SimpleNamespace objects."""
        if isinstance(c, dict):
            return c.get(field, default)
        return getattr(c, field, default)

    # Resolve compound fields
    qt_acum = _g("queda_tensao_acumulada")
    qt_pct = _g("queda_tensao_pct")
    qt_calc = qt_acum if qt_acum is not None else qt_pct
    qt_max = _g("queda_tensao_max")

    corrente_condutor = _g("corrente_condutor") or _g("ampacidade") or 0
    corrente_corrigida = _g("corrente_corrigida") or _g("corrente_nominal") or 0
    formacao = _g("formacao") or 1
    amp_ok = corrente_condutor >= (corrente_corrigida / max(formacao, 1))
    qt_ok = qt_calc is None or qt_max is None or qt_calc <= qt_max

    ib = _g("corrente_projeto") or _g("corrente_nominal")
    ib_corr = _g("corrente_corrigida")

    # Resolve status
    if _g("status_final"):
        status_final = normalizar_status(_g("status_final"))
    elif _g("status") == "ok":
        status_final = "OK"
    elif _g("status") == "erro":
        status_final = "CRITICO"
    elif _g("status") == "alerta":
        status_final = "ALERTA"
    else:
        status_final = "ALERTA"

    tag = _g("tag")
    descricao = _g("descricao")

    return DotDict(
        id=_g("id"),
        tag=tag,
        descricao=descricao,
        tag_ou_descricao=tag or descricao or "-",
        from_barramento=_g("from_barramento"),
        to_equipamento=_g("to_equipamento"),
        revisao=_g("revisao"),
        nota_tecnica=_g("nota_tecnica"),
        protection_device=_g("protection_device"),
        tensao=_g("tensao"),
        fases=_g("fases"),
        corrente_ac_dc=_g("corrente_ac_dc"),
        potencia_kw=_g("potencia_kw"),
        potencia_kva=_g("potencia_kva"),
        fator_potencia=_g("fator_potencia"),
        fator_eficiencia=_g("fator_eficiencia"),
        fator_demanda=_g("fator_demanda"),
        distancia_m=_g("distancia_m"),
        temp_ambiente=_g("temp_ambiente"),
        corrente_projeto=_g("corrente_projeto"),
        corrente_nominal=_g("corrente_nominal"),
        corrente_corrigida=_g("corrente_corrigida"),
        ib=ib,
        ib_corr=ib_corr,
        status=_g("status"),
        status_final=status_final,
        validacao_status=_g("validacao_status"),
        validacao_mensagem=_g("validacao_mensagem"),
        modo_dimensionamento=_g("modo_dimensionamento"),
        modo_selecao_componentes=_g("modo_selecao_componentes"),
        selecao_componentes_status=_g("selecao_componentes_status"),
        selecao_componentes_justificativa=_g("selecao_componentes_justificativa"),
        disjuntor_tensao_nominal=_g("disjuntor_tensao_nominal"),
        disjuntor_curva=_g("disjuntor_curva"),
        disjuntor_corrente_nominal=_g("disjuntor_corrente_nominal"),
        disjuntor_a=_g("disjuntor_a"),
        disjuntor_icu=_g("disjuntor_icu"),
        protecao_status=_g("protecao_status"),
        protecao_nota=_g("protecao_nota"),
        disjuntor_sugerido_in=_g("disjuntor_sugerido_in"),
        disjuntor_sugerido_icu=_g("disjuntor_sugerido_icu"),
        disjuntor_sugerido_curva=_g("disjuntor_sugerido_curva"),
        corrente_condutor=corrente_condutor or None,
        ampacidade=_g("ampacidade"),
        formacao=formacao,
        secao_mm2=_g("secao_mm2"),
        secao_pe_mm2=_g("secao_pe_mm2"),
        tipo_cabo=_g("tipo_cabo"),
        tipo_cabo_comercial=_g("tipo_cabo_comercial"),
        metodo_instalacao=_g("metodo_instalacao"),
        fator_k1=_g("fator_k1"),
        fator_k2=_g("fator_k2"),
        fator_k3=_g("fator_k3"),
        cabo_sugerido_tipo_comercial=_g("cabo_sugerido_tipo_comercial"),
        cabo_sugerido_ampacidade=_g("cabo_sugerido_ampacidade"),
        ampacidade_ok=amp_ok,
        queda_tensao_pct=qt_pct,
        queda_tensao_acumulada=qt_acum,
        queda_tensao_max=qt_max,
        queda_tensao_calculada=qt_calc,
        queda_tensao_ok=qt_ok,
        impedancia_rdc=_g("impedancia_rdc"),
        impedancia_rac=_g("impedancia_rac"),
        impedancia_xl=_g("impedancia_xl"),
        comprimento_real=_g("comprimento_real"),
        isc_local=_g("isc_local"),
        isc_cabo=_g("isc_cabo"),
        tempo_atuacao=_g("tempo_atuacao"),
        _protecao=dict(
            device=_g("protection_device"),
            tensao_nominal=_g("disjuntor_tensao_nominal"),
            curva=_g("disjuntor_curva"),
            corrente_nominal=_g("disjuntor_corrente_nominal") or _g("disjuntor_a"),
            icu=_g("disjuntor_icu"),
            status=_g("protecao_status"),
            nota=_g("protecao_nota"),
            disjuntor_sugerido_in=_g("disjuntor_sugerido_in"),
            disjuntor_sugerido_icu=_g("disjuntor_sugerido_icu"),
            disjuntor_sugerido_curva=_g("disjuntor_sugerido_curva"),
        ),
        _ampacidade=dict(
            corrente_condutor=corrente_condutor or None,
            ampacidade=_g("ampacidade"),
            formacao=formacao,
            secao_mm2=_g("secao_mm2"),
            secao_pe_mm2=_g("secao_pe_mm2"),
            tipo_cabo=_g("tipo_cabo"),
            tipo_cabo_comercial=_g("tipo_cabo_comercial"),
            metodo_instalacao=_g("metodo_instalacao"),
            fator_k1=_g("fator_k1"),
            fator_k2=_g("fator_k2"),
            fator_k3=_g("fator_k3"),
            cabo_sugerido_tipo_comercial=_g("cabo_sugerido_tipo_comercial"),
            cabo_sugerido_ampacidade=_g("cabo_sugerido_ampacidade"),
            ok=amp_ok,
        ),
        _queda_tensao=dict(
            pct=qt_pct,
            acumulada=qt_acum,
            calculada=qt_calc,
            max=qt_max,
            ok=qt_ok,
            impedancia_rdc=_g("impedancia_rdc"),
            impedancia_rac=_g("impedancia_rac"),
            impedancia_xl=_g("impedancia_xl"),
            distancia_m=_g("distancia_m"),
            comprimento_real=_g("comprimento_real"),
        ),
        _icc=dict(
            isc_local=_g("isc_local"),
            isc_cabo=_g("isc_cabo"),
            tempo_atuacao=_g("tempo_atuacao"),
        ),
    )
    qt_calc = qt_acum if qt_acum is not None else qt_pct
    qt_max = _g("queda_tensao_max")

    corrente_condutor = _g("corrente_condutor") or _g("ampacidade") or 0
    corrente_corrigida = _g("corrente_corrigida") or _g("corrente_nominal") or 0
    formacao = _g("formacao") or 1
    amp_ok = corrente_condutor >= (corrente_corrigida / max(formacao, 1))
    qt_ok = qt_calc is None or qt_max is None or qt_calc <= qt_max

    ib = _g("corrente_projeto") or _g("corrente_nominal")
    ib_corr = _g("corrente_corrigida")

    # Resolve status
    if _g("status_final"):
        status_final = normalizar_status(_g("status_final"))
    elif _g("status") == "ok":
        status_final = "OK"
    elif _g("status") == "erro":
        status_final = "CRITICO"
    elif _g("status") == "alerta":
        status_final = "ALERTA"
    else:
        status_final = "ALERTA"

    tag = _g("tag")
    descricao = _g("descricao")

    return DotDict(
        # Identification
        id=_g("id"),
        tag=tag,
        descricao=descricao,
        tag_ou_descricao=tag or descricao or "-",
        from_barramento=_g("from_barramento"),
        to_equipamento=_g("to_equipamento"),
        revisao=_g("revisao"),
        nota_tecnica=_g("nota_tecnica"),
        protection_device=_g("protection_device"),

        # Electrical basics
        tensao=_g("tensao"),
        fases=_g("fases"),
        corrente_ac_dc=_g("corrente_ac_dc"),
        potencia_kw=_g("potencia_kw"),
        potencia_kva=_g("potencia_kva"),
        fator_potencia=_g("fator_potencia"),
        fator_eficiencia=_g("fator_eficiencia"),
        fator_demanda=_g("fator_demanda"),
        distancia_m=_g("distancia_m"),
        temp_ambiente=_g("temp_ambiente"),

        # Corrente
        corrente_projeto=_g("corrente_projeto"),
        corrente_nominal=_g("corrente_nominal"),
        corrente_corrigida=_g("corrente_corrigida"),
        ib=ib,
        ib_corr=ib_corr,

        # Status
        status=_g("status"),
        status_final=status_final,

        # Validação normativa
        validacao_status=_g("validacao_status"),
        validacao_mensagem=_g("validacao_mensagem"),

        # Seleção automática
        modo_dimensionamento=_g("modo_dimensionamento"),
        modo_selecao_componentes=_g("modo_selecao_componentes"),
        selecao_componentes_status=_g("selecao_componentes_status"),
        selecao_componentes_justificativa=_g("selecao_componentes_justificativa"),

        # Proteção (flat)
        disjuntor_tensao_nominal=_g("disjuntor_tensao_nominal"),
        disjuntor_curva=_g("disjuntor_curva"),
        disjuntor_corrente_nominal=_g("disjuntor_corrente_nominal"),
        disjuntor_a=_g("disjuntor_a"),
        disjuntor_icu=_g("disjuntor_icu"),
        protecao_status=_g("protecao_status"),
        protecao_nota=_g("protecao_nota"),
        disjuntor_sugerido_in=_g("disjuntor_sugerido_in"),
        disjuntor_sugerido_icu=_g("disjuntor_sugerido_icu"),
        disjuntor_sugerido_curva=_g("disjuntor_sugerido_curva"),

        # Ampacidade (flat)
        corrente_condutor=corrente_condutor or None,
        ampacidade=_g("ampacidade"),
        formacao=formacao,
        secao_mm2=_g("secao_mm2"),
        secao_pe_mm2=_g("secao_pe_mm2"),
        tipo_cabo=_g("tipo_cabo"),
        tipo_cabo_comercial=_g("tipo_cabo_comercial"),
        metodo_instalacao=_g("metodo_instalacao"),
        fator_k1=_g("fator_k1"),
        fator_k2=_g("fator_k2"),
        fator_k3=_g("fator_k3"),
        cabo_sugerido_tipo_comercial=_g("cabo_sugerido_tipo_comercial"),
        cabo_sugerido_ampacidade=_g("cabo_sugerido_ampacidade"),
        ampacidade_ok=amp_ok,

        # Queda de tensão (flat)
        queda_tensao_pct=qt_pct,
        queda_tensao_acumulada=qt_acum,
        queda_tensao_max=qt_max,
        queda_tensao_calculada=qt_calc,
        queda_tensao_ok=qt_ok,
        impedancia_rdc=_g("impedancia_rdc"),
        impedancia_rac=_g("impedancia_rac"),
        impedancia_xl=_g("impedancia_xl"),
        comprimento_real=_g("comprimento_real"),

        # ICC (flat)
        isc_local=_g("isc_local"),
        isc_cabo=_g("isc_cabo"),
        tempo_atuacao=_g("tempo_atuacao"),

        # Nested sub-DTOs (for structured consumers)
        _protecao=dict(
            device=_g("protection_device"),
            tensao_nominal=_g("disjuntor_tensao_nominal"),
            curva=_g("disjuntor_curva"),
            corrente_nominal=_g("disjuntor_corrente_nominal") or _g("disjuntor_a"),
            icu=_g("disjuntor_icu"),
            status=_g("protecao_status"),
            nota=_g("protecao_nota"),
            disjuntor_sugerido_in=_g("disjuntor_sugerido_in"),
            disjuntor_sugerido_icu=_g("disjuntor_sugerido_icu"),
            disjuntor_sugerido_curva=_g("disjuntor_sugerido_curva"),
        ),
        _ampacidade=dict(
            corrente_condutor=corrente_condutor or None,
            ampacidade=_g("ampacidade"),
            formacao=formacao,
            secao_mm2=_g("secao_mm2"),
            secao_pe_mm2=_g("secao_pe_mm2"),
            tipo_cabo=_g("tipo_cabo"),
            tipo_cabo_comercial=_g("tipo_cabo_comercial"),
            metodo_instalacao=_g("metodo_instalacao"),
            fator_k1=_g("fator_k1"),
            fator_k2=_g("fator_k2"),
            fator_k3=_g("fator_k3"),
            cabo_sugerido_tipo_comercial=_g("cabo_sugerido_tipo_comercial"),
            cabo_sugerido_ampacidade=_g("cabo_sugerido_ampacidade"),
            ok=amp_ok,
        ),
        _queda_tensao=dict(
            pct=qt_pct,
            acumulada=qt_acum,
            calculada=qt_calc,
            max=qt_max,
            ok=qt_ok,
            impedancia_rdc=_g("impedancia_rdc"),
            impedancia_rac=_g("impedancia_rac"),
            impedancia_xl=_g("impedancia_xl"),
            distancia_m=_g("distancia_m"),
            comprimento_real=_g("comprimento_real"),
        ),
        _icc=dict(
            isc_local=_g("isc_local"),
            isc_cabo=_g("isc_cabo"),
            tempo_atuacao=_g("tempo_atuacao"),
        ),
    )


def map_circuito_to_dto(c: Any) -> DotDict:
    """Legacy wrapper – forwards to the new build_circuito_dto function.
    This preserves existing imports while allowing future code to call the
    clearer ``build_circuito_dto`` name.
    """
    return build_circuito_dto(c)

def map_circuitos_to_dtos(circuitos: List[Any]) -> List[DotDict]:
    """Map a list of circuit ORM objects to a list of CircuitoDTO DotDicts."""
    return [map_circuito_to_dto(c) for c in (circuitos or [])]

# ---------------------------------------------------------------------------
# Public API — single function that external modules should import
# ---------------------------------------------------------------------------

def get_memorial_data(projeto: Any, circuitos: List[Any]) -> Dict[str, Any]:

    """Assemble a complete, normalised DTO for *projeto*.

    Parameters
    ----------
    projeto : Any
        Project ORM / model instance.
    circuitos : List[Any]
        List of circuit objects already loaded from the DB. ``None`` is
        treated as an empty list.

    Returns
    -------
    dict
        Deterministic schema (MemorialDTO) consumable by PDF, Excel,
        IA and dashboard layers. Section renderers must not call any
        electrical calculation function after receiving this DTO.
    """
    # --- guards ---
    if circuitos is None:
        circuitos = []

    logger.info(
        "Building memorial DTO for project %s (%d circuits)",
        getattr(projeto, "id", "<no-id>"),
        len(circuitos),
    )

    # --- layer 1: core calculations (unchanged formulas) ---
    transformador = calcular_transformador(
        carregar_json(getattr(projeto, "transformador_dados", None))
    )
    sistema = calcular_sistema_trifasico_projeto(
        carregar_json(getattr(projeto, "sistema_trifasico_dados", None)),
        circuitos,
        getattr(projeto, "tensao_ref", None),
    )
    modulos = _build_modulos(projeto, transformador)

    # Convenient top-level aliases for the most-used modules
    protecao_geral = modulos["Proteção geral"]
    para_raios = modulos["Para-raios"]
    aterramento = modulos["Aterramento"]
    areas_classificadas = modulos["Áreas Classificadas"]

    # --- layer 2: aggregation ---
    resumo_global = _build_resumo_global(projeto, circuitos, modulos)
    circuito_resumo = _contagem_status_dp(circuitos)
    protecoes_status = _contagem_protecoes_dp(circuitos)

    # --- layer 3: derived scalars ---
    tensao_secundaria = transformador.get("tensao_secundaria") or getattr(projeto, "tensao_ref", None)
    icc_max = max((c.isc_local or 0 for c in circuitos), default=0)
    sem_icc = sum(1 for c in circuitos if not getattr(c, "isc_local", None))
    qt_max = max((_qt_value(c) for c in circuitos), default=0.0)
    automaticos = sum(
        1 for c in circuitos
        if (getattr(c, "modo_dimensionamento", None) or getattr(c, "modo_selecao_componentes", None)) == "automatico"
    )
    selecao_critica = sum(
        1 for c in circuitos if getattr(c, "selecao_componentes_status", None) == "CRITICO"
    )
    fora_qt = sum(
        1 for c in circuitos
        if _qt_value(c) > 0
        and getattr(c, "queda_tensao_max", None) is not None
        and _qt_value(c) > getattr(c, "queda_tensao_max")
    )

    # --- layer 4: conclusions ---
    conclusoes = _build_conclusoes(circuitos, resumo_global)
    circuitos_dto = map_circuitos_to_dtos(circuitos)
    interpretacoes = _build_interpretacoes(circuitos_dto)
    memorias_calculo = _build_memorias_calculo(circuitos_dto)
    benchmark_validacao = _build_benchmark_validacao(circuitos_dto, resumo_global)

    # --- assemble final DTO ---
    dto: Dict[str, Any] = {
        # Identification
        "projeto": {
            "id": getattr(projeto, "id", None),
            "nome": getattr(projeto, "nome", ""),
            "cliente": getattr(projeto, "cliente", ""),
            "tensao_ref": getattr(projeto, "tensao_ref", None),
            "contexto": getattr(projeto, "contexto", "industrial"),
            "revisao": getattr(projeto, "revisao", "0"),
        },
        # Technical modules
        "transformador": transformador,
        "sistema_trifasico": sistema,
        "protecao_geral": protecao_geral,
        "para_raios": para_raios,
        "aterramento": aterramento,
        "areas_classificadas": areas_classificadas,
        "modulos": modulos,
        # Derived scalars
        "tensao_secundaria": tensao_secundaria,
        "icc_max": icc_max,
        "sem_icc": sem_icc,
        "qt_max": qt_max,
        "automaticos": automaticos,
        "selecao_critica": selecao_critica,
        "fora_qt": fora_qt,
        # Circuits — ORM objects (backward compat; will be removed in Fase 7)
        "circuitos": circuitos,
        "circuitos_alerta": [c for c in circuitos if _status_final_dp(c) == "ALERTA"],
        "circuitos_criticos": [c for c in circuitos if is_critico(_status_final_dp(c))],
        # Circuits — pure DTOs (Fase 6, ORM-free, JSON-safe)
        "circuitos_dto": circuitos_dto,
        "circuitos_dto_alerta": [],   # populated below
        "circuitos_dto_criticos": [], # populated below
        # Aggregated statuses
        "resumo_global": resumo_global,
        "circuito_resumo": circuito_resumo,
        "protecoes_status": protecoes_status,
        "status_geral": resumo_global.get("status"),
        # Technical conclusions (pre-computed)
        "conclusoes_tecnicas": conclusoes,
        "interpretacoes_automaticas": interpretacoes,
        "memorias_calculo": memorias_calculo,
        "benchmark_validacao": benchmark_validacao,
        # AI / dashboard fields
        "top_riscos": resumo_global.get("criticos_modulos", []),
        "pendencias_criticas": resumo_global.get("criticos_modulos", []),
        "alertas_modulos": resumo_global.get("alertas_modulos", []),
        "resumo_executivo": resumo_global.get("motivo_status", ""),
        # KPI metric groups
        "metricas_ampacidade": {
            "total": circuito_resumo.get("total", 0),
            "ok": circuito_resumo.get("ok", 0),
            "alertas": circuito_resumo.get("alertas", 0),
            "criticos": circuito_resumo.get("criticos", 0),
        },
        "metricas_protecao": protecoes_status,
        "metricas_queda_tensao": {
            "total": circuito_resumo.get("total", 0),
            "qt_max": qt_max,
            "fora_limite": fora_qt,
        },
        "metricas_icc": {
            "icc_max": icc_max,
            "sem_icc": sem_icc,
        },
    }

    # Populate filtered DTO circuit lists after mapping
    dto["circuitos_dto_alerta"] = [d for d in dto["circuitos_dto"] if d.get("status_final") == "ALERTA"]
    dto["circuitos_dto_criticos"] = [d for d in dto["circuitos_dto"] if d.get("status_final") == "CRITICO"]

    logger.debug("DTO built successfully: %d fields, %d circuit DTOs.", len(dto), len(dto["circuitos_dto"]))
    return dto


# ---------------------------------------------------------------------------
# FASE 6 — Serialisation helpers
# ---------------------------------------------------------------------------

def _serialize_value(v: Any) -> Any:
    """Recursively convert a value to a JSON-safe primitive."""
    if isinstance(v, DotDict):
        return {k: _serialize_value(val) for k, val in v.items()}
    if isinstance(v, dict):
        return {k: _serialize_value(val) for k, val in v.items()}
    if isinstance(v, list):
        return [_serialize_value(item) for item in v]
    if isinstance(v, (str, int, float, bool, type(None))):
        return v
    # Fallback: convert to string (handles ORM proxies, enums, etc.)
    return str(v)


def serialize_memorial_dto(dto: Dict[str, Any], exclude_orm: bool = True) -> Dict[str, Any]:
    """Return a fully JSON-serialisable copy of a MemorialDTO.

    Converts all values to plain Python primitives (str / int / float /
    bool / None / list / dict). Safe for Redis caching, AI context
    injection and external API responses.

    Parameters
    ----------
    dto : dict
        MemorialDTO as returned by ``get_memorial_data()``.
    exclude_orm : bool
        If ``True`` (default), removes ``circuitos``, ``circuitos_alerta``
        and ``circuitos_criticos`` (which may contain ORM objects). The
        pure-DTO equivalents (``circuitos_dto``, …) are kept.

    Returns
    -------
    dict
        JSON-serialisable dict (no SQLAlchemy proxies).
    """
    ORM_KEYS = {"circuitos", "circuitos_alerta", "circuitos_criticos"}
    result: Dict[str, Any] = {}
    for key, value in dto.items():
        if exclude_orm and key in ORM_KEYS:
            continue
        result[key] = _serialize_value(value)
    return result
