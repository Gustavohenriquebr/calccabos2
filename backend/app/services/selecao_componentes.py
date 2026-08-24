DISJUNTORES_COMERCIAIS = [
    6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315,
    400, 500, 630, 800, 1000, 1250, 1600,
]

ICU_COMERCIAL_KA = [6, 10, 15, 20, 25, 36, 50, 65, 100]


def normalizar_modo_selecao(valor):
    texto = str(valor or "manual").strip().lower()
    return "automatico" if texto in ("auto", "automatico", "automático", "automatic") else "manual"


def carga_motor(descricao="", tag="", eficiencia=1.0):
    descricao = str(descricao or "").lower()
    tag = str(tag or "").lower()
    try:
        eficiencia = float(eficiencia or 1.0)
    except (TypeError, ValueError):
        eficiencia = 1.0
    return "motor" in descricao or tag.startswith("m-") or eficiencia < 0.999


def selecionar_icu(isc_ka):
    try:
        isc_ka = float(isc_ka or 0)
    except (TypeError, ValueError):
        isc_ka = 0
    if isc_ka <= 0:
        return None
    return next((icu for icu in ICU_COMERCIAL_KA if icu >= isc_ka), None)


def selecionar_disjuntor_automatico(ib, capacidade_cabo, isc_ka, descricao="", tag="", eficiencia=1.0):
    try:
        ib = float(ib or 0)
    except (TypeError, ValueError):
        ib = 0
    try:
        capacidade_cabo = float(capacidade_cabo or 0)
    except (TypeError, ValueError):
        capacidade_cabo = 0

    motor = carga_motor(descricao, tag, eficiencia)
    alvo = ib
    candidatos = [valor for valor in DISJUNTORES_COMERCIAIS if valor >= alvo]
    candidatos_compativeis = [valor for valor in candidatos if not capacidade_cabo or valor <= capacidade_cabo]
    corrente = candidatos_compativeis[0] if candidatos_compativeis else None
    icu = selecionar_icu(isc_ka)
    curva = "D" if motor else "C"

    status = "OK"
    notas = []
    if corrente:
        notas.append(f"In comercial {corrente}A selecionado para Ib {ib:.2f}A.")
    elif candidatos:
        status = "CRITICO"
        notas.append(
            f"Nenhum disjuntor atende simultaneamente In >= Ib ({ib:.2f}A) "
            f"e In <= ampacidade do cabo ({capacidade_cabo:.2f}A)."
        )
    else:
        status = "CRITICO"
        notas.append(f"Nenhum disjuntor comercial disponivel para Ib {ib:.2f}A.")

    if motor:
        notas.append("Curva D sugerida por criterio de carga motora.")
    else:
        notas.append("Curva C sugerida para carga geral.")

    if isc_ka and icu:
        notas.append(f"Icu comercial {icu}kA selecionado para Icc {float(isc_ka):.2f}kA.")
    elif isc_ka:
        status = "CRITICO"
        notas.append(f"Nenhum Icu comercial atende Icu >= Icc ({float(isc_ka):.2f}kA).")
    else:
        if status == "OK":
            status = "ALERTA"
        notas.append("Icc nao informado; Icu nao pode ser selecionado com seguranca.")

    return {
        "in": float(corrente) if corrente else None,
        "icu": float(icu) if icu else None,
        "curva": curva,
        "status": status,
        "justificativa": " ".join(notas),
    }


def montar_resultado_selecao(
    modo,
    tipo_cabo_comercial,
    secao,
    ampacidade_total,
    corrente_requerida,
    queda_tensao,
    queda_limite,
    disjuntor,
    cabo_status="OK",
    cabo_motivo="",
):
    if cabo_status == "CRITICO" or disjuntor.get("status") == "CRITICO":
        status = "CRITICO"
    elif cabo_status == "ALERTA" or disjuntor.get("status") == "ALERTA":
        status = "ALERTA"
    else:
        status = "OK"
    disjuntor_in = disjuntor.get("in")
    if disjuntor_in is None:
        justificativa = (
            f"Cabo {tipo_cabo_comercial} avaliado com secao {secao:g}mm2, "
            f"capacidade corrigida total {ampacidade_total:.2f}A para Ib {corrente_requerida:.2f}A "
            f"e queda de tensao {queda_tensao:.2f}% limitada a {queda_limite:.2f}%. "
            f"{cabo_motivo} Disjuntor automatico nao selecionado. {disjuntor.get('justificativa')}"
        )
    else:
        justificativa = (
            f"Cabo {tipo_cabo_comercial} selecionado com secao {secao:g}mm2, "
            f"capacidade corrigida total {ampacidade_total:.2f}A para Ib {corrente_requerida:.2f}A "
            f"e queda de tensao {queda_tensao:.2f}% limitada a {queda_limite:.2f}%. "
            f"{cabo_motivo} "
            f"Disjuntor sugerido: In {disjuntor_in:g}A, curva {disjuntor.get('curva')}, "
            f"Icu {disjuntor.get('icu') or '-'}kA. {disjuntor.get('justificativa')}"
        )
    if modo == "manual":
        justificativa = "Modo manual: componentes informados pelo usuario permanecem preferenciais. " + justificativa
    else:
        justificativa = "Modo automatico: componentes calculados aplicados ao circuito. " + justificativa

    return {
        "cabo_sugerido_secao": float(secao),
        "cabo_sugerido_tipo_comercial": tipo_cabo_comercial,
        "cabo_sugerido_ampacidade": round(float(ampacidade_total), 3),
        "disjuntor_sugerido_in": disjuntor.get("in"),
        "disjuntor_sugerido_icu": disjuntor.get("icu"),
        "disjuntor_sugerido_curva": disjuntor.get("curva"),
        "selecao_componentes_status": status,
        "selecao_componentes_justificativa": justificativa,
    }
