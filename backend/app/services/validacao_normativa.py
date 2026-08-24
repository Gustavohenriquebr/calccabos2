import json
from typing import Any, Dict, List, Optional

from app.services.status_utils import normalizar_status, status_mais_grave


TENSOES_COMPATIVEIS = {127, 220, 230, 254, 380, 400, 440, 480, 690, 4160, 6900, 13800, 34500}


def _float(valor: Any) -> Optional[float]:
    try:
        if valor is None or valor == "":
            return None
        return float(valor)
    except (TypeError, ValueError):
        return None


def _status_mais_grave(status_atual: str, novo_status: str) -> str:
    return status_mais_grave(status_atual, novo_status)


def _item(criterio: str, status: str, mensagem: str, norma_ref: str) -> Dict[str, str]:
    return {
        "criterio": criterio,
        "status": status,
        "mensagem": mensagem,
        "norma_ref": norma_ref,
    }


def validar_circuito_normativo(dados: Dict[str, Any], contexto: str = "industrial") -> Dict[str, Any]:
    itens: List[Dict[str, str]] = []
    status = "OK"

    ib = _float(dados.get("corrente_projeto") or dados.get("corrente_nominal"))
    corrente_corrigida = _float(dados.get("corrente_corrigida"))
    ampacidade = _float(dados.get("corrente_condutor") or dados.get("ampacidade"))
    formacao = int(_float(dados.get("formacao")) or 1)
    capacidade_corrigida = _float(dados.get("ampacidade_corrigida_total"))
    capacidade_total = capacidade_corrigida if capacidade_corrigida is not None else (
        ampacidade * max(formacao, 1) if ampacidade is not None else None
    )
    corrente_requerida_ampacidade = ib if capacidade_corrigida is not None else corrente_corrigida
    in_disjuntor = _float(dados.get("disjuntor_corrente_nominal") or dados.get("disjuntor_a"))
    icu = _float(dados.get("disjuntor_icu"))
    icc = _float(dados.get("isc_local"))
    queda = _float(dados.get("queda_tensao_acumulada") if dados.get("queda_tensao_acumulada") is not None else dados.get("queda_tensao_pct"))
    queda_limite = _float(dados.get("queda_tensao_max"))
    tensao = _float(dados.get("tensao"))

    norma_qt = {
        "industrial": "NBR 5410",
        "residencial": "NBR 5410",
        "hospitalar": "NBR 13534",
        "offshore": "N-1997 / N-2040",
    }.get(str(contexto or "industrial").lower(), "NBR 5410")

    if ib is None or ib <= 0:
        itens.append(_item("Coerência", "CRITICO", "Corrente de projeto Ib ausente ou inválida.", "Dados mínimos do circuito"))
        status = _status_mais_grave(status, "CRITICO")

    if tensao is None or tensao <= 0:
        itens.append(_item("Coerência", "CRITICO", "Tensão do circuito ausente ou inválida.", "Dados mínimos do circuito"))
        status = _status_mais_grave(status, "CRITICO")
    elif int(round(tensao)) not in TENSOES_COMPATIVEIS:
        itens.append(_item("Coerência", "ALERTA", f"Tensão {tensao:g}V fora das tensões usuais cadastradas.", "Critério interno de coerência"))
        status = _status_mais_grave(status, "ALERTA")

    if in_disjuntor is None or in_disjuntor <= 0:
        itens.append(_item("Proteção", "ALERTA", "Corrente nominal do disjuntor In ausente; coordenação não avaliada.", "Dados de proteção necessários"))
        status = _status_mais_grave(status, "ALERTA")
    elif ib is not None:
        if in_disjuntor < ib:
            itens.append(_item("Proteção", "CRITICO", f"Disjuntor inadequado: In ({in_disjuntor:g}A) menor que Ib ({ib:.2f}A).", "NBR 5410 - In >= Ib"))
            status = _status_mais_grave(status, "CRITICO")
        elif in_disjuntor < ib * 1.10:
            itens.append(_item("Proteção", "ALERTA", f"Margem baixa: In ({in_disjuntor:g}A) está muito próximo de Ib ({ib:.2f}A).", "Critério interno de margem"))
            status = _status_mais_grave(status, "ALERTA")

    if icc is None or icc <= 0:
        itens.append(_item("Proteção", "ALERTA", "Icc no ponto não informado; Icu do disjuntor não pode ser validado.", "IEC 60909 / NBR 5410"))
        status = _status_mais_grave(status, "ALERTA")
    elif icu is None or icu <= 0:
        itens.append(_item("Proteção", "ALERTA", f"Icu/Icn ausente para Icc de {icc:.2f}kA; capacidade de interrupção não avaliada.", "Dados de proteção necessários"))
        status = _status_mais_grave(status, "ALERTA")
    elif icu < icc:
        itens.append(_item("Proteção", "CRITICO", f"Disjuntor inadequado: Icu ({icu:g}kA) menor que Icc ({icc:.2f}kA).", "NBR 5410 - Icu >= Icc"))
        status = _status_mais_grave(status, "CRITICO")
    elif icu < icc * 1.20:
        itens.append(_item("Proteção", "ALERTA", f"Margem baixa: Icu ({icu:g}kA) próximo de Icc ({icc:.2f}kA).", "Critério interno de margem"))
        status = _status_mais_grave(status, "ALERTA")

    if corrente_requerida_ampacidade is None or corrente_requerida_ampacidade <= 0:
        itens.append(_item("Cabo", "CRITICO", "Corrente corrigida Ib' ausente ou inválida.", "NBR 5410 seção 6.2"))
        status = _status_mais_grave(status, "CRITICO")
    elif capacidade_total is None or capacidade_total <= 0:
        itens.append(_item("Cabo", "CRITICO", "Ampacidade do cabo ausente ou inválida.", "NBR 5410 seção 6.2"))
        status = _status_mais_grave(status, "CRITICO")
    elif capacidade_total < corrente_requerida_ampacidade:
        itens.append(_item("Cabo", "CRITICO", f"Cabo inadequado: capacidade corrigida total ({capacidade_total:.2f}A) menor que a corrente requerida ({corrente_requerida_ampacidade:.2f}A).", "Critério de ampacidade configurado"))
        status = _status_mais_grave(status, "CRITICO")
    elif capacidade_total < corrente_requerida_ampacidade * 1.10:
        itens.append(_item("Cabo", "ALERTA", f"Margem baixa: capacidade corrigida total ({capacidade_total:.2f}A) próxima da corrente requerida ({corrente_requerida_ampacidade:.2f}A).", "Critério interno de margem"))
        status = _status_mais_grave(status, "ALERTA")

    # ── Limites normativos absolutos de ΔV% acumulada ────────────────────────
    LIMITE_ACUMULADO = {
        "industrial":  5.0,
        "residencial":  5.0,
        "hospitalar":  5.0,
        "offshore":    3.0,
    }
    LIMITE_TRECHO = {
        "industrial":  7.0,
        "residencial":  7.0,
        "hospitalar":  5.0,
        "offshore":    3.0,
    }
    ctx = str(contexto or "industrial").lower()
    lim_acum = LIMITE_ACUMULADO.get(ctx, 5.0)
    lim_trecho = LIMITE_TRECHO.get(ctx, 7.0)

    queda_trecho = _float(dados.get("queda_tensao_pct"))
    queda_acum   = _float(dados.get("queda_tensao_acumulada"))
    # garante que acumulada nunca seja None: fallback para trecho
    if queda_acum is None:
        queda_acum = queda_trecho

    # Validação de ΔV% acumulada (da fonte ao equipamento)
    if queda_acum is None:
        itens.append(_item("Queda de tensão acumulada", "ALERTA",
            "ΔV% acumulada não calculada; verifique queda_tensao_alimentador do circuito pai.",
            norma_qt))
        status = _status_mais_grave(status, "ALERTA")
    elif queda_acum > lim_acum:
        itens.append(_item("Queda de tensão acumulada", "CRITICO",
            f"ΔV% acumulada ({queda_acum:.2f}%) excede o limite normativo ({lim_acum:.0f}%) para contexto {ctx}.",
            norma_qt))
        status = _status_mais_grave(status, "CRITICO")
    elif queda_acum > lim_acum * 0.85:
        itens.append(_item("Queda de tensão acumulada", "ALERTA",
            f"ΔV% acumulada ({queda_acum:.2f}%) próxima do limite normativo ({lim_acum:.0f}%).",
            norma_qt))
        status = _status_mais_grave(status, "ALERTA")

    # Validação de ΔV% do trecho (limite configurado por contexto/modo)
    if queda_limite is not None and queda_trecho is not None:
        if queda_trecho > queda_limite:
            itens.append(_item("Queda de tensão trecho", "CRITICO",
                f"ΔV% do trecho ({queda_trecho:.2f}%) maior que o limite configurado ({queda_limite:.2f}%).",
                norma_qt))
            status = _status_mais_grave(status, "CRITICO")
        elif queda_trecho > queda_limite * 0.85:
            itens.append(_item("Queda de tensão trecho", "ALERTA",
                f"ΔV% do trecho ({queda_trecho:.2f}%) próxima do limite configurado ({queda_limite:.2f}%).",
                norma_qt))
            status = _status_mais_grave(status, "ALERTA")

    if not itens:
        itens.append(_item("Verificações técnicas", "OK", "Critérios calculados atendidos com os dados e premissas registrados.", "Critérios CalcCabos; validação profissional necessária"))

    mensagens_prioritarias = [item["mensagem"] for item in itens if item["status"] == status]
    mensagem = mensagens_prioritarias[0] if mensagens_prioritarias else itens[0]["mensagem"]

    return {
        "validacao_status": normalizar_status(status),
        "validacao_mensagem": mensagem,
        "validacao_detalhes": json.dumps(itens, ensure_ascii=False),
    }
