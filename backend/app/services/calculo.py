import math

from app.services.selecao_componentes import (
    montar_resultado_selecao,
    normalizar_modo_selecao,
    selecionar_disjuntor_automatico,
    carga_motor
)
from app.services.status_utils import normalizar_status, normalizar_tipo_cabo, numero_finito, status_mais_grave
from app.services.validacao_normativa import validar_circuito_normativo
from app.services.curto_circuito import curto_por_transformador, corrente_trifasica
from app.services.disjuntor_selector import selecionar_disjuntor
from app.services.normativa_protecao import validar_protecao
from app.services.tensao import analisar_tensao
from app.services.protecao_curvas import avaliar_curva


SECOES = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300]

AMPACIDADE = {
    "CU-PVC": {
        1.5: 15, 2.5: 21, 4: 28, 6: 36, 10: 50, 16: 68, 25: 89, 35: 111,
        50: 134, 70: 171, 95: 207, 120: 239, 150: 272, 185: 310, 240: 365, 300: 419,
    },
    "CU-XLPE": {
        1.5: 19, 2.5: 26, 4: 35, 6: 45, 10: 63, 16: 85, 25: 112, 35: 138,
        50: 168, 70: 213, 95: 258, 120: 299, 150: 341, 185: 390, 240: 461, 300: 530,
    },
    "AL-PVC": {
        16: 52, 25: 68, 35: 85, 50: 103, 70: 132, 95: 160, 120: 185,
        150: 211, 185: 241, 240: 285, 300: 327,
    },
    "AL-XLPE": {
        16: 64, 25: 85, 35: 103, 50: 127, 70: 163, 95: 198, 120: 229,
        150: 263, 185: 300, 240: 356, 300: 409,
    },
}

FATOR_TEMP = {
    "PVC": {25: 1.03, 30: 1.00, 35: 0.94, 40: 0.87, 45: 0.79, 50: 0.71, 55: 0.61, 60: 0.50},
    "XLPE": {25: 1.04, 30: 1.00, 35: 0.96, 40: 0.91, 45: 0.87, 50: 0.82, 55: 0.76, 60: 0.71},
}

# ── NBR 5410:2004 Tabela 42 — Fator de agrupamento K2 por método de instalação ───────────
#
# INVESTIGACAO_K2: O avaliador reportou K2=0.77 para 4 circuitos em bandeja,
# mas o software retornava K2=0.65. A causa era uma tabela única sem distinção
# por método de instalação. A NBR 5410 Tabela 42 tem DUAS colunas principais:
#
#   Coluna A (bandeja / ar livre, camada única) — métodos TRAY, BANDEJAMENTO,
#     AIR, AR_LIVRE:
#     n=1: 1.00, n=2: 0.88, n=3: 0.82, n=4: 0.77, n=5: 0.73, n≥6: 0.72–0.70
#
#   Coluna B (eletroduto embutido/enterrado, cabos encerrados) — métodos CONDUIT,
#     ELETRODUTO, DIRECT, ENTERRADO:
#     n=1: 1.00, n=2: 0.80, n=3: 0.70, n=4: 0.65, n=5: 0.60, n=6: 0.57...
#
# A versão anterior usava apenas a Coluna B para TODOS os métodos — bug de
# indexação confirmado. Correção aplicada em 2026-08-17.
# Ref: NBR 5410:2004 Tabela 42, IEC 60364-5-52 Tabela A.52-17.

# Coluna A: bandejas (cable trays) e instalação em ar livre — camada única
# Métodos de instalação: TRAY, BANDEJAMENTO, AIR, AR_LIVRE
_FATOR_AGRUP_BANDEJA = {
    1: 1.00, 2: 0.88, 3: 0.82, 4: 0.77, 5: 0.73,
    6: 0.72, 7: 0.72, 8: 0.71, 9: 0.70,
}

# Coluna B: eletrodutos e cabos enterrados — cabos encerrados
# Métodos de instalação: CONDUIT, ELETRODUTO, DIRECT, ENTERRADO
_FATOR_AGRUP_ELETRODUTO = {
    1: 1.00, 2: 0.80, 3: 0.70, 4: 0.65, 5: 0.60,
    6: 0.57, 7: 0.54, 8: 0.52, 9: 0.50,
}

# Mapeamento método de instalação → tabela K2 correta
FATOR_AGRUP_POR_METODO = {
    "TRAY":         _FATOR_AGRUP_BANDEJA,
    "BANDEJAMENTO": _FATOR_AGRUP_BANDEJA,
    "AIR":          _FATOR_AGRUP_BANDEJA,
    "AR_LIVRE":     _FATOR_AGRUP_BANDEJA,
    "CONDUIT":      _FATOR_AGRUP_ELETRODUTO,
    "ELETRODUTO":   _FATOR_AGRUP_ELETRODUTO,
    "DIRECT":       _FATOR_AGRUP_ELETRODUTO,
    "ENTERRADO":    _FATOR_AGRUP_ELETRODUTO,
}

FATOR_METODO = {
    "TRAY": 1.00,
    "BANDEJAMENTO": 1.00,
    "AIR": 1.05,
    "AR_LIVRE": 1.05,
    "CONDUIT": 0.90,
    "ELETRODUTO": 0.90,
    "DIRECT": 0.85,
    "ENTERRADO": 0.85,
}

CONTEXTOS = {
    "industrial": {
        "qt_terminal": 7.0,
        "qt_alimentador": 5.0,
        "qt_partida": 10.0,
        "norma_ref": "NBR 5410",
    },
    "offshore": {
        "qt_terminal": 3.0,
        "qt_alimentador": 2.0,
        "qt_partida": 5.0,
        "norma_ref": "N-1997 Rev.B / N-2040 Rev.F",
    },
    "hospitalar": {
        "qt_terminal": 4.0,
        "qt_alimentador": 3.0,
        "qt_partida": 7.0,
        "norma_ref": "NBR 13534",
    },
    "residencial": {
        "qt_terminal": 7.0,
        "qt_alimentador": 5.0,
        "qt_partida": 10.0,
        "norma_ref": "NBR 5410",
    },
}

K_JOULE = {
    "CU-PVC":  115,   # NBR 5410 Tab.43 — inalterado
    "CU-XLPE": 143,   # NBR 5410 Tab.43 — corrigido (era 135)
    "AL-PVC":   76,   # NBR 5410 Tab.43 — corrigido (era 74)
    "AL-XLPE":  94,   # NBR 5410 Tab.43 — corrigido (era 87)
}

# NBR 5410 / IEC 60228: ρ a 20°C — usado SOMENTE para cálculo de Icc (seção 5.3.6)
RDC_20 = {"CU": 17.24, "AL": 28.26}

# NBR 5410 seção 6.2.3: ρ na temperatura máxima de operação do condutor (regime permanente)
# PVC  → condutor a 70°C | XLPE/EPR → condutor a 90°C
RDC_OP = {
    "CU-PVC":  22.41,   # ρ_Cu a 70°C (mΩ·mm²/m) — NBR 5410 / IEC 60228
    "CU-XLPE": 24.42,   # ρ_Cu a 90°C (mΩ·mm²/m) — NBR 5410 / IEC 60228
    "AL-PVC":  36.97,   # ρ_Al a 70°C (mΩ·mm²/m) — NBR 5410 / IEC 60228
    "AL-XLPE": 40.25,   # ρ_Al a 90°C (mΩ·mm²/m) — NBR 5410 / IEC 60228
}

DISJUNTORES = [
    6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315,
    400, 500, 630, 800, 1000, 1250, 1600,
]

ICU_COMERCIAL_KA = [6, 10, 15, 20, 25, 36, 50, 65, 100]

ENGINE_VERSION = "2.1.0"
AUDIT_SCHEMA_VERSION = "1.0"

# Valores de projeto conservadores usados somente quando o cliente ainda não
# informou um critério próprio. Não representam, isoladamente, conformidade
# normativa e são sempre registrados como premissa na resposta auditável.
SECAO_MINIMA_PROJETO = {
    "ILUMINACAO": 1.5,
    "CONTROLE": 1.5,
    "FORCA": 2.5,
    "MOTOR": 2.5,
    "GERAL": 2.5,
}


def _valor(c, nome, padrao=None):
    valor = getattr(c, nome, padrao)
    return padrao if valor is None else valor


def _float(valor, padrao=0.0):
    return numero_finito(valor, padrao)


def _int(valor, padrao=0):
    try:
        if valor is None or valor == "":
            return padrao
        return int(valor)
    except (TypeError, ValueError):
        return padrao


def _normalizar_enum(valor, padrao=""):
    if hasattr(valor, "value"):
        valor = valor.value
    texto = str(valor or padrao)
    if "." in texto:
        texto = texto.split(".")[-1]
    return texto.replace("_", "-").upper()


def _normalizar_contexto(contexto):
    if hasattr(contexto, "value"):
        contexto = contexto.value
    texto = str(contexto or "industrial")
    if "." in texto:
        texto = texto.split(".")[-1]
    return texto.lower()


def _normalizar_metodo(valor):
    metodo = str(valor or "TRAY").replace("-", "_").replace(" ", "_").upper()
    return metodo if metodo in FATOR_METODO else "TRAY"


def _fator_temperatura(tipo, temperatura):
    familia = "XLPE" if "XLPE" in tipo else "PVC"
    tabela = FATOR_TEMP[familia]
    for temp_ref, fator in sorted(tabela.items()):
        if temperatura <= temp_ref:
            return fator
    return list(tabela.values())[-1]


def _normalizar_secao(valor, tipo=None):
    disponiveis = SECOES
    if tipo:
        amp_map = AMPACIDADE.get(tipo, AMPACIDADE["CU-PVC"])
        disponiveis = [s for s in SECOES if s in amp_map]
    for secao in disponiveis:
        if secao >= valor:
            return secao
    return disponiveis[-1]


def _secao_por_ampacidade(tipo, corrente_por_cabo):
    amp_map = AMPACIDADE.get(tipo, AMPACIDADE["CU-PVC"])
    for secao in SECOES:
        if amp_map.get(secao, 0) >= corrente_por_cabo:
            return secao
    return max(amp_map)


def _impedancias(tipo, secao, metodo, para_icc=False):
    material = "AL" if tipo.startswith("AL") else "CU"
    if para_icc:
        # NBR 5410 seção 5.3.6: ρ a 20°C para cálculo de Icc_mínimo no fim da linha
        rdc = RDC_20[material] / secao
    else:
        # NBR 5410 seção 6.2.3: ρ à temperatura máxima de operação para cálculo de ΔV%
        rdc = RDC_OP.get(tipo, RDC_20[material]) / secao
    rac = rdc * (1.02 if secao <= 35 else 1.05)
    if secao <= 35:
        xl = 0.0
    elif metodo in ("CONDUIT", "ELETRODUTO"):
        xl = 0.09
    elif metodo in ("DIRECT", "ENTERRADO"):
        xl = 0.10
    else:
        xl = 0.08
    return rdc, rac, xl


def _queda_tensao_pct(V, corrente, fp, fases, comprimento_m, tipo, secao, formacao, metodo, ac_dc):
    rdc, rac, xl = _impedancias(tipo, secao, metodo)
    comprimento_km = comprimento_m / 1000.0
    formacao = max(formacao, 1)
    fp = min(max(fp, 0.0), 1.0)
    seno = math.sqrt(max(1 - fp**2, 0.0))

    if ac_dc == "DC":
        delta_v = 2 * corrente * (rdc / formacao) * comprimento_km
    elif fases == 3:
        delta_v = math.sqrt(3) * corrente * ((rac / formacao) * fp + (xl / formacao) * seno) * comprimento_km
    else:
        delta_v = 2 * corrente * ((rac / formacao) * fp + (xl / formacao) * seno) * comprimento_km

    return (delta_v / V) * 100 if V > 0 else 0.0, rdc, rac, xl


def _tem_valor(c, nome):
    valor = getattr(c, nome, None)
    return valor is not None and valor != ""


def _configuracao_eletrica(c):
    """Normaliza o novo contrato sem quebrar os campos legados fases/AC-DC."""
    informado = str(_valor(c, "configuracao_eletrica", "") or "").strip().lower()
    aliases = {
        "ac_monofasico": "AC_MONOFASICO",
        "monofasico": "AC_MONOFASICO",
        "ac_trifasico": "AC_TRIFASICO",
        "trifasico": "AC_TRIFASICO",
        "dc": "DC",
        "cc": "DC",
    }
    if informado in aliases:
        configuracao = aliases[informado]
        origem = "informed"
    else:
        ac_dc = str(_valor(c, "corrente_ac_dc", _valor(c, "tipo_sistema_tensao", "AC")) or "AC").upper()
        fases = _int(_valor(c, "fases", 3), 3)
        configuracao = "DC" if ac_dc == "DC" else "AC_TRIFASICO" if fases == 3 else "AC_MONOFASICO"
        origem = "derived_from_legacy"

    referencia = str(_valor(c, "referencia_tensao", "") or "").strip().lower()
    if configuracao == "DC":
        referencia = "cc"
    elif referencia not in {"fase_neutro", "fase_fase"}:
        # O antigo fases=2 significava, na interface, dois condutores ativos.
        referencia = "fase_fase" if _int(_valor(c, "fases", 1), 1) == 2 else (
            "fase_fase" if configuracao == "AC_TRIFASICO" else "fase_neutro"
        )
    return configuracao, referencia, origem


def _resolver_corrente(c, V, demanda):
    configuracao, referencia_tensao, origem_config = _configuracao_eletrica(c)
    modo = str(_valor(c, "modo_entrada", "") or "").strip().lower()
    aliases_modo = {
        "corrente": "CORRENTE_INFORMADA",
        "corrente_informada": "CORRENTE_INFORMADA",
        "potencia_ativa": "POTENCIA_ATIVA",
        "kw": "POTENCIA_ATIVA",
        "potencia_aparente": "POTENCIA_APARENTE",
        "kva": "POTENCIA_APARENTE",
    }
    modo = aliases_modo.get(modo)
    if not modo:
        if _float(_valor(c, "corrente_informada", 0), 0) > 0:
            modo = "CORRENTE_INFORMADA"
        elif bool(_valor(c, "usar_kva_informado", False)) and _float(_valor(c, "potencia_kva", 0), 0) > 0:
            modo = "POTENCIA_APARENTE"
        else:
            modo = "POTENCIA_ATIVA"

    fp = _float(_valor(c, "fator_potencia", 0), 0)
    eficiencia = _float(_valor(c, "fator_eficiencia", 0), 0)
    potencia_kw = _float(_valor(c, "potencia_kw", 0), 0)
    potencia_kva = _float(_valor(c, "potencia_kva", 0), 0)
    corrente_informada = _float(_valor(c, "corrente_informada", 0), 0)
    base_potencia = str(_valor(c, "base_potencia", "entrada_eletrica") or "entrada_eletrica").strip().lower()
    if base_potencia not in {"entrada_eletrica", "saida_mecanica"}:
        base_potencia = "entrada_eletrica"

    erros = []
    alertas = []
    if V <= 0:
        erros.append(("INVALID_VOLTAGE", "Tensão deve ser maior que zero."))
    if demanda <= 0:
        erros.append(("INVALID_DEMAND_FACTOR", "Fator de demanda deve ser maior que zero."))

    formula = ""
    substituicao = ""
    corrente = 0.0
    potencia_entrada_w = None

    if modo == "CORRENTE_INFORMADA":
        if corrente_informada <= 0:
            erros.append(("MISSING_CURRENT", "Corrente informada deve ser maior que zero."))
        corrente = corrente_informada * demanda
        formula = "Iprojeto = Iinformada × fd"
        substituicao = f"I = {corrente_informada:g} × {demanda:g}"
    elif modo == "POTENCIA_APARENTE":
        if configuracao == "DC":
            erros.append(("APPARENT_POWER_NOT_APPLICABLE_DC", "Potência aparente em kVA não se aplica ao cálculo CC."))
        if potencia_kva <= 0:
            erros.append(("MISSING_APPARENT_POWER", "Potência aparente deve ser maior que zero."))
        potencia_va = potencia_kva * 1000 * demanda
        divisor = math.sqrt(3) * V if configuracao == "AC_TRIFASICO" else V
        corrente = potencia_va / divisor if divisor > 0 else 0.0
        formula = "I = S / (√3 × VLL)" if configuracao == "AC_TRIFASICO" else "I = S / V"
        substituicao = (
            f"I = {potencia_va:g} / (1,7320508 × {V:g})"
            if configuracao == "AC_TRIFASICO" else f"I = {potencia_va:g} / {V:g}"
        )
    else:
        if potencia_kw <= 0:
            erros.append(("MISSING_ACTIVE_POWER", "Potência ativa deve ser maior que zero."))
        potencia_entrada_w = potencia_kw * 1000
        if base_potencia == "saida_mecanica":
            if eficiencia <= 0 or eficiencia > 1:
                erros.append(("INVALID_EFFICIENCY", "Rendimento entre 0 e 1 é obrigatório para potência mecânica de saída."))
            else:
                potencia_entrada_w /= eficiencia
        potencia_entrada_w *= demanda
        if configuracao == "DC":
            corrente = potencia_entrada_w / V if V > 0 else 0.0
            formula = "I = Pentrada / Vdc"
            substituicao = f"I = {potencia_entrada_w:g} / {V:g}"
        else:
            if fp <= 0 or fp > 1:
                erros.append(("INVALID_POWER_FACTOR", "Fator de potência entre 0 e 1 é obrigatório para potência ativa em CA."))
            divisor = (math.sqrt(3) if configuracao == "AC_TRIFASICO" else 1.0) * V * fp
            corrente = potencia_entrada_w / divisor if divisor > 0 else 0.0
            formula = "I = Pentrada / (√3 × VLL × fp)" if configuracao == "AC_TRIFASICO" else "I = Pentrada / (V × fp)"
            substituicao = (
                f"I = {potencia_entrada_w:g} / (1,7320508 × {V:g} × {fp:g})"
                if configuracao == "AC_TRIFASICO" else f"I = {potencia_entrada_w:g} / ({V:g} × {fp:g})"
            )

    if origem_config == "derived_from_legacy":
        alertas.append({
            "code": "LEGACY_ELECTRICAL_CONFIGURATION",
            "severity": "WARNING",
            "field": "configuracao_eletrica",
            "message": "Configuração elétrica derivada dos campos legados AC/DC e fases; confirme a referência da tensão.",
            "blocking": False,
        })
    return {
        "corrente": corrente,
        "configuracao": configuracao,
        "referencia_tensao": referencia_tensao,
        "modo_entrada": modo,
        "base_potencia": base_potencia,
        "potencia_entrada_w": potencia_entrada_w,
        "formula": formula,
        "substituicao": substituicao,
        "erros": erros,
        "alertas": alertas,
    }


def _corrente_projeto(V, potencia_kw, potencia_kva, fp, eficiencia, demanda, fases, ac_dc):
    """Compatibilidade interna para callers legados; não trata mais fases=2 como 2×V."""
    if potencia_kva and potencia_kva > 0:
        potencia_va = potencia_kva * 1000 * demanda
        return potencia_va / ((math.sqrt(3) if ac_dc != "DC" and fases == 3 else 1) * V) if V > 0 else 0.0
    potencia_entrada = potencia_kw * 1000 * demanda / (eficiencia if eficiencia > 0 else 1.0)
    divisor_fp = fp if ac_dc != "DC" and fp > 0 else 1.0
    return potencia_entrada / ((math.sqrt(3) if ac_dc != "DC" and fases == 3 else 1) * V * divisor_fp) if V > 0 else 0.0


def _potencia_kva_calculada(potencia_kw, potencia_kva, fp, eficiencia):
    if potencia_kva and potencia_kva > 0:
        return potencia_kva
    fp = fp if fp > 0 else 1.0
    eficiencia = eficiencia if eficiencia > 0 else 1.0
    return potencia_kw / (fp * eficiencia) if potencia_kw else 0.0


def _kva_efetivo(c, potencia_kw, potencia_kva_manual, fp, eficiencia):
    usar_manual = bool(_valor(c, "usar_kva_informado", False))
    fp_base = fp if fp > 0 else 1.0
    eficiencia_base = eficiencia if eficiencia > 0 else 1.0
    kva_calculado = potencia_kw / (fp_base * eficiencia_base) if potencia_kw > 0 else 0.0
    if potencia_kva_manual and potencia_kva_manual > 0 and kva_calculado > 0:
        desvio = abs(potencia_kva_manual - kva_calculado) / kva_calculado
        if desvio > 0.20:
            if usar_manual:
                return (
                    potencia_kva_manual,
                    kva_calculado,
                    True,
                    f"kVA informado ({potencia_kva_manual:.3f}) difere {desvio * 100:.1f}% do kVA calculado ({kva_calculado:.3f}); uso manual explicito aplicado.",
                )
            return (
                kva_calculado,
                kva_calculado,
                True,
                f"kVA informado ({potencia_kva_manual:.3f}) difere {desvio * 100:.1f}% do kVA calculado por kW/FP/eta ({kva_calculado:.3f}); calculo usou kW/FP/eta.",
            )
        return (potencia_kva_manual if usar_manual else kva_calculado), kva_calculado, False, ""
    return kva_calculado, kva_calculado, False, ""


def _disjuntor(corrente, c):
    descricao = str(_valor(c, "descricao", "") or "").lower()
    tag = str(_valor(c, "tag", "") or "").lower()
    eficiencia = _float(_valor(c, "fator_eficiencia", 1.0), 1.0)
    multiplicador = 1.25 if ("motor" in descricao or tag.startswith("m-") or eficiencia < 0.999) else 1.0
    alvo = corrente * multiplicador
    return next((d for d in DISJUNTORES if d >= alvo), DISJUNTORES[-1])


def _curva_disjuntor(c):
    curva = str(_valor(c, "disjuntor_curva", "") or "").strip().upper()
    if curva:
        return curva
    descricao = str(_valor(c, "descricao", "") or "").lower()
    tag = str(_valor(c, "tag", "") or "").lower()
    eficiencia = _float(_valor(c, "fator_eficiencia", 1.0), 1.0)
    return "D" if ("motor" in descricao or tag.startswith("m-") or eficiencia < 0.999) else "C"


def _icu_sugerido(isc_ka):
    if not isc_ka or isc_ka <= 0:
        return None
    return next((icu for icu in ICU_COMERCIAL_KA if icu >= isc_ka), None)


def _verificar_protecao(c, V, ib, iz_corrigida, isc_ka, disjuntor_sugerido, disjuntor_auto=None, modo_selecao="manual", isc_cabo_ka=None):
    modo_auto = modo_selecao == "automatico" and disjuntor_auto and disjuntor_auto.get("in")
    if modo_auto:
        in_disjuntor = float(disjuntor_auto["in"])
        vn_disjuntor = V
        icu = disjuntor_auto.get("icu")
        curva = disjuntor_auto.get("curva") or _curva_disjuntor(c)
    else:
        in_disjuntor = _float(_valor(c, "disjuntor_corrente_nominal", 0), 0) or None
        vn_disjuntor = _float(_valor(c, "disjuntor_tensao_nominal", 0), 0) or V
        icu_informado = _float(_valor(c, "disjuntor_icu", 0), 0)
        icu = icu_informado or None
        curva = str(_valor(c, "disjuntor_curva", "") or "").strip().upper() or None
    fabricante = str(_valor(c, "disjuntor_fabricante", "") or "").strip() or None
    curva_fonte = str(_valor(c, "protecao_curva_fonte", "") or "").strip() or None
    curva_pontos = _valor(c, "protecao_curva_pontos", []) or []

    status = "OK"
    status_auditavel = "OK"
    notas = []
    verificacoes = {}

    if in_disjuntor is None:
        status = "ALERTA"
        status_auditavel = "NOT_EVALUATED"
        notas.append("In do disjuntor não informado; coordenação de sobrecarga não avaliada")
    elif in_disjuntor < ib:
        status = "CRITICO"
        status_auditavel = "BLOCKED"
        notas.append(f"In {in_disjuntor:.0f}A menor que Ib {ib:.2f}A")
    elif in_disjuntor < ib * 1.10:
        status = status_mais_grave(status, "ALERTA")
        notas.append("Margem baixa entre In e Ib")

    if in_disjuntor is not None and iz_corrigida and in_disjuntor > iz_corrigida:
        status = "CRITICO"
        status_auditavel = "BLOCKED"
        notas.append(f"In {in_disjuntor:.0f}A maior que Iz corrigida {iz_corrigida:.2f}A")
    elif in_disjuntor is not None and iz_corrigida and in_disjuntor > iz_corrigida * 0.90 and normalizar_status(status) != "CRITICO":
        status = status_mais_grave(status, "ALERTA")
        notas.append("Margem baixa entre In e capacidade do cabo")

    verificacoes["overload_coordination"] = {
        "status": "NOT_EVALUATED" if in_disjuntor is None else "BLOCKED" if in_disjuntor < ib or not iz_corrigida or in_disjuntor > iz_corrigida else "OK",
        "ib_a": round(ib, 6),
        "in_a": round(in_disjuntor, 6) if in_disjuntor is not None else None,
        "iz_corrected_a": round(iz_corrigida, 6) if iz_corrigida else None,
        "rule": "Ib <= In <= Iz_corrected",
    }

    if isc_ka and isc_ka > 0:
        if not icu:
            if normalizar_status(status) != "CRITICO":
                status = status_mais_grave(status, "ALERTA")
            if status_auditavel != "BLOCKED":
                status_auditavel = "NOT_EVALUATED"
            notas.append("Icu/Icn não informado; capacidade de interrupção não avaliada")
        elif icu < isc_ka:
            status = "CRITICO"
            status_auditavel = "BLOCKED"
            notas.append(f"Icu/Icn {icu:.2f}kA menor que Icc {isc_ka:.2f}kA")
        elif icu < isc_ka * 1.20 and normalizar_status(status) != "CRITICO":
            status = status_mais_grave(status, "ALERTA")
            notas.append("Margem baixa entre Icu e Icc")
        verificacoes["breaking_capacity"] = {
            "status": "NOT_EVALUATED" if not icu else "BLOCKED" if icu < isc_ka else "OK",
            "icc_ka": round(isc_ka, 6),
            "icu_ka": round(icu, 6) if icu else None,
            "rule": "Icu/Icn >= Icc",
        }
    else:
        verificacoes["breaking_capacity"] = {
            "status": "NOT_EVALUATED",
            "icc_ka": None,
            "icu_ka": round(icu, 6) if icu else None,
            "rule": "Icu/Icn >= Icc",
        }
        if normalizar_status(status) != "CRITICO":
            status = status_mais_grave(status, "ALERTA")
        if status_auditavel != "BLOCKED":
            status_auditavel = "NOT_EVALUATED"
        status = status_mais_grave(status, "ALERTA")
        notas.append("Icc nao informado; Icu nao pode ser validado")

    # A corrente no fim da linha só pode ser verificada quando os pontos da
    # curva vêm de uma fonte documentada do fabricante. Sem isso, permanece
    # NOT_EVALUATED e o relatório final continua bloqueado.
    curva_informada = _tem_valor(c, "disjuntor_curva")
    tempo_informado = _tem_valor(c, "tempo_atuacao")
    curva_disponivel = bool(curva_pontos and curva_informada and fabricante and curva_fonte)
    curva_avaliacao = avaliar_curva(
        curva_pontos,
        (isc_cabo_ka * 1000) if isc_cabo_ka else None,
        in_disjuntor,
        _float(_valor(c, "tempo_atuacao", 0), 0),
    ) if curva_disponivel else {
        "status": "NOT_EVALUATED",
        "motivo": "Icc no fim, In, curva, tempo, fabricante, fonte e pontos tempo-corrente são necessários.",
    }
    verificacoes["automatic_disconnection"] = {
        **curva_avaliacao,
        "icc_end_ka": round(isc_cabo_ka, 6) if isc_cabo_ka else None,
        "curva": curva,
        "fabricante": fabricante,
        "fonte": curva_fonte,
    }
    if curva_avaliacao["status"] == "BLOCKED":
        status = "CRITICO"
        status_auditavel = "BLOCKED"
        notas.append("Curva tempo-corrente indica tempo de atuação acima do limite informado.")
    elif curva_avaliacao["status"] == "NOT_EVALUATED":
        if status_auditavel != "BLOCKED":
            status_auditavel = "NOT_EVALUATED"
        if status == "OK":
            status = "ALERTA"
        notas.append("Atuacao automatica no fim do circuito nao verificada; informe curva documentada e fonte do fabricante.")

    return {
        "disjuntor_tensao_nominal": round(vn_disjuntor, 2),
        "disjuntor_corrente_nominal": float(in_disjuntor) if in_disjuntor is not None else None,
        "disjuntor_icu": round(icu, 3) if icu else None,
        "disjuntor_curva": curva,
        "disjuntor_fabricante": fabricante,
        "protecao_curva_fonte": curva_fonte,
        "protecao_curva_pontos": curva_pontos if isinstance(curva_pontos, list) else [],
        "protecao_status": normalizar_status(status),
        "protecao_avaliacao_status": status_auditavel,
        "protecao_verificacoes": verificacoes,
        "protecao_nota": "; ".join(notas),
    }


def _secao_pe(secao_fase):
    if secao_fase <= 16:
        return secao_fase
    if secao_fase <= 35:
        return 16
    return _normalizar_secao(secao_fase / 2)


def _isc_no_fim(V, fases, isc_local_ka, comprimento_m, tipo, secao, formacao, metodo):
    if not isc_local_ka or isc_local_ka <= 0 or V <= 0:
        return None
    # NBR 5410 seção 5.3.6: usar ρ a 20°C para cálculo de Icc_mínimo no fim da linha
    rdc, rac, xl = _impedancias(tipo, secao, metodo, para_icc=True)
    comprimento_km = comprimento_m / 1000.0
    formacao = max(formacao, 1)
    z_cabo = math.sqrt(((rac / formacao) * comprimento_km) ** 2 + ((xl / formacao) * comprimento_km) ** 2)
    if fases == 3:
        z_fonte = V / (math.sqrt(3) * isc_local_ka * 1000)
        isc = V / (math.sqrt(3) * (z_fonte + z_cabo)) / 1000
    else:
        z_fonte = V / (isc_local_ka * 1000)
        isc = V / (z_fonte + z_cabo) / 1000
    return max(isc, 0.0)


def _status(status_final):
    status_final = normalizar_status(status_final)
    if status_final == "CRITICO":
        return "erro"
    if status_final == "OK":
        return "ok"
    return "alerta"


def _formatar_secao(secao):
    return str(int(secao)) if float(secao).is_integer() else str(secao).replace(".", ",")


def _selecionar_secao_automatica(V, corrente, corrente_corrigida, fp, fases, comprimento_m, tipo, formacao, metodo, ac_dc, qt_alimentador, qt_limite, secao_joule_norm):
    amp_map = AMPACIDADE.get(tipo, AMPACIDADE["CU-PVC"])
    candidatos = [s for s in SECOES if s in amp_map]
    ultima_falha = []

    for secao in candidatos:
        ampacidade_total = amp_map.get(secao, 0) * max(formacao, 1)
        qt_circuito, _, _, _ = _queda_tensao_pct(V, corrente, fp, fases, comprimento_m, tipo, secao, formacao, metodo, ac_dc)
        qt_total = qt_alimentador + qt_circuito
        falhas = []
        if ampacidade_total < corrente_corrigida:
            falhas.append(f"ampacidade {ampacidade_total:.2f}A < Ib' {corrente_corrigida:.2f}A")
        if qt_total > qt_limite:
            falhas.append(f"queda {qt_total:.2f}% > limite {qt_limite:.2f}%")
        if secao_joule_norm and secao < secao_joule_norm:
            falhas.append(f"secao {secao:g}mm2 < Joule {secao_joule_norm:g}mm2")
        if not falhas:
            return {
                "secao": secao,
                "status": "OK",
                "motivo": f"Menor secao comercial que atende ampacidade, queda de tensao e Joule: {secao:g}mm2.",
            }
        ultima_falha = falhas

    return {
        "secao": candidatos[-1],
        "status": "CRITICO",
        "motivo": f"Nenhuma secao comercial cadastrada atende todos os criterios. Maior secao avaliada: {candidatos[-1]:g}mm2; falhas: {'; '.join(ultima_falha)}.",
    }


def calcular_circuito(c, contexto="industrial"):
    alertas_auditaveis = []
    premissas = []
    limitacoes = [
        "Resultado de apoio técnico; não constitui declaração de conformidade do projeto.",
        "Tabelas internas de ampacidade devem ser confirmadas para o método de instalação e edição técnica aplicáveis.",
        "A verificação de curto-circuito térmico depende da Icc e do tempo de eliminação informados; a atuação automática exige curva tempo-corrente identificável do fabricante.",
    ]

    tipo_sistema_tensao = str(_valor(c, "tipo_sistema_tensao", _valor(c, "corrente_ac_dc", "AC")) or "AC").upper()
    unidade_tensao = _valor(c, "tensao_unidade", "V")
    referencia_tensao_param = _valor(c, "referencia_tensao", None)
    if not referencia_tensao_param:
        referencia_tensao_param = _valor(c, "referencia_tensao_dc", None) if tipo_sistema_tensao == "DC" else None
    tensao_info = analisar_tensao(
        valor=_valor(c, "tensao", None),
        unidade=unidade_tensao,
        tipo_sistema=tipo_sistema_tensao,
        referencia=referencia_tensao_param,
        fases=_valor(c, "fases", None),
        contexto_aplicacao=_valor(c, "contexto_aplicacao", contexto),
    )
    V = _float(tensao_info.get("tensao_v"), 0)
    potencia_kw = _float(_valor(c, "potencia_kw", 0), 0)
    fp_informado = _tem_valor(c, "fator_potencia")
    fp = _float(_valor(c, "fator_potencia", 0), 0)
    distancia_m = _float(_valor(c, "distancia_m", 0), 0)
    comprimento_m = _float(_valor(c, "comprimento_real", None), 0) or distancia_m
    if _tem_valor(c, "temp_ambiente"):
        temperatura = _float(_valor(c, "temp_ambiente", 30), 30)
    else:
        temperatura = 30.0
        premissas.append({"field": "temp_ambiente", "value": 30.0, "unit": "°C", "reason": "Não informado; premissa de projeto aplicada."})
    fases = _int(_valor(c, "fases", 3), 3)
    if _tem_valor(c, "agrupamento"):
        agrupamento = max(_int(_valor(c, "agrupamento", 1), 1), 1)
    else:
        agrupamento = 1
        premissas.append({"field": "agrupamento", "value": 1, "unit": "circuito", "reason": "Não informado; circuito isolado assumido."})
    formacao = max(_int(_valor(c, "formacao", 1), 1), 1)
    if _tem_valor(c, "tipo_cabo"):
        tipo = normalizar_tipo_cabo(_valor(c, "tipo_cabo", "CU-PVC"))
    else:
        tipo = "CU-PVC"
        premissas.append({"field": "tipo_cabo", "value": tipo, "reason": "Não informado; premissa legada aplicada."})
    if _tem_valor(c, "metodo_instalacao"):
        metodo = _normalizar_metodo(_valor(c, "metodo_instalacao", "TRAY"))
    else:
        metodo = "TRAY"
        premissas.append({"field": "metodo_instalacao", "value": metodo, "reason": "Não informado; premissa legada aplicada e requer confirmação."})
    ac_dc = str(_valor(c, "corrente_ac_dc", tipo_sistema_tensao) or tipo_sistema_tensao).upper()
    ac_dc = "DC" if ac_dc == "DC" else "AC"
    potencia_kva = _float(_valor(c, "potencia_kva", 0), 0)
    demanda = _float(_valor(c, "fator_demanda", 1.0), 1.0)
    eficiencia = _float(_valor(c, "fator_eficiencia", 1.0), 1.0)
    isc_local = _float(_valor(c, "isc_local", 0), 0)
    tempo_atuacao = _float(_valor(c, "tempo_atuacao", 0), 0)
    # queda_tensao_alimentador pode ser None no banco (circuito raiz); força 0.0 neste caso
    qt_alimentador = _float(_valor(c, "queda_tensao_alimentador", 0.0) or 0.0, 0.0)
    modo_selecao = normalizar_modo_selecao(_valor(c, "modo_dimensionamento", _valor(c, "modo_selecao_componentes", "manual")))

    contexto_chave = _normalizar_contexto(contexto)
    contexto_cfg = CONTEXTOS.get(contexto_chave, CONTEXTOS["industrial"])
    qt_limite_informado = _float(_valor(c, "queda_tensao_limite", 0), 0)
    qt_limite = qt_limite_informado or contexto_cfg["qt_terminal"]
    if not qt_limite_informado:
        premissas.append({
            "field": "queda_tensao_limite",
            "value": qt_limite,
            "unit": "%",
            "reason": f"Limite de projeto não informado; configuração interna do contexto {contexto_chave} aplicada.",
        })

    corrente_info = _resolver_corrente(c, V, demanda)
    alertas_auditaveis.extend(corrente_info["alertas"])
    erros_entrada = list(corrente_info["erros"])
    if distancia_m < 0:
        erros_entrada.append(("INVALID_LENGTH", "Distância não pode ser negativa."))
    if agrupamento not in FATOR_AGRUP_POR_METODO.get(metodo, {}):
        erros_entrada.append(("GROUPING_OUT_OF_TABLE", "Agrupamento fora do domínio da tabela cadastrada."))
    for alerta_tensao in tensao_info.get("alertas", []):
        if alerta_tensao.get("blocking"):
            erros_entrada.append((alerta_tensao.get("code", "VOLTAGE_ERROR"), alerta_tensao.get("message", "Tensão inválida.")))
        else:
            alertas_auditaveis.append(alerta_tensao)

    if erros_entrada:
        alertas_bloqueantes = [
            {"code": codigo, "severity": "BLOCKED", "message": mensagem, "blocking": True}
            for codigo, mensagem in erros_entrada
        ]
        return {
            "corrente_nominal": None,
            "corrente_projeto": None,
            "corrente_corrigida": None,
            "secao_mm2": None,
            "disjuntor_a": None,
            "queda_tensao_pct": None,
            "queda_tensao_acumulada": None,
            "secao_pe_mm2": None,
            "ampacidade": None,
            "corrente_condutor": None,
            "status": "erro",
            "modo_dimensionamento": modo_selecao,
            "modo_selecao_componentes": modo_selecao,
            "status_final": "CRITICO",
            "validacao_status": "CRITICO",
            "validacao_mensagem": alertas_bloqueantes[0]["message"],
            "validacao_detalhes": "[]",
            "resultado": {"status": "BLOCKED", "adopted_section_mm2": None},
            "criterios": {},
            "decisao": {"rule": "max_applicable_required_sections", "adopted_section_mm2": None},
            "memorial": {"schema_version": AUDIT_SCHEMA_VERSION, "steps": []},
            "alertas": alertas_bloqueantes,
            "premissas": premissas,
            "limitacoes": limitacoes + tensao_info.get("limitacoes", []),
            "metadados_calculo": {"engine_version": ENGINE_VERSION, "schema_version": AUDIT_SCHEMA_VERSION, "tensao": tensao_info},
        }

    corrente = corrente_info["corrente"]
    configuracao = corrente_info["configuracao"]
    fases_calculo = 3 if configuracao == "AC_TRIFASICO" else 1
    ac_dc = "DC" if configuracao == "DC" else "AC"
    if ac_dc == "DC":
        tensao_info = analisar_tensao(
            valor=_valor(c, "tensao", None),
            unidade=unidade_tensao,
            tipo_sistema="DC",
            referencia=referencia_tensao_param,
            fases=_valor(c, "fases", None),
            contexto_aplicacao=_valor(c, "contexto_aplicacao", contexto),
        )
    fp_queda = fp if ac_dc == "AC" and fp > 0 else 1.0
    if ac_dc == "AC" and not fp_informado and corrente_info["modo_entrada"] != "POTENCIA_ATIVA":
        premissas.append({"field": "fator_potencia", "value": 1.0, "reason": "Não informado; usado apenas no modelo aproximado de queda de tensão."})
    kva_calculado = (
        corrente_info["potencia_entrada_w"] / 1000 / fp
        if corrente_info["potencia_entrada_w"] and ac_dc == "AC" and fp > 0 else potencia_kva
    )
    kva_final = potencia_kva if corrente_info["modo_entrada"] == "POTENCIA_APARENTE" else kva_calculado
    kva_inconsistente = False
    mensagem_kva = ""
    k1 = _fator_temperatura(tipo, temperatura)
    # K2: selecionado pela tabela correta do método de instalação (NBR 5410 Tab.42)
    # Bandeja/ar livre → coluna A (ex: 4 circuitos → 0.77)
    # Eletroduto/enterrado → coluna B (ex: 4 circuitos → 0.65)
    _tabela_k2 = FATOR_AGRUP_POR_METODO.get(metodo, _FATOR_AGRUP_ELETRODUTO)
    k2 = _tabela_k2[agrupamento]
    k3 = FATOR_METODO.get(metodo, 1.00)
    fator_total = max(k1 * k2 * k3, 0.01)
    corrente_corrigida = corrente / fator_total
    corrente_por_cabo = corrente_corrigida / formacao

    secao_ampacidade = _secao_por_ampacidade(tipo, corrente_por_cabo)
    amp_map = AMPACIDADE.get(tipo, AMPACIDADE["CU-PVC"])

    secao_qt = secao_ampacidade
    for secao in [s for s in SECOES if s in amp_map]:
        qt_circuito, _, _, _ = _queda_tensao_pct(V, corrente, fp_queda, fases_calculo, comprimento_m, tipo, secao, formacao, metodo, ac_dc)
        if qt_alimentador + qt_circuito <= qt_limite:
            secao_qt = secao
            break
        secao_qt = secao

    k_joule = K_JOULE.get(tipo, 115)
    secao_joule = 0.0
    secao_joule_norm = 0.0
    if isc_local > 0 and tempo_atuacao > 0:
        secao_joule = (isc_local * 1000 * math.sqrt(tempo_atuacao)) / k_joule
        secao_joule_norm = _normalizar_secao(secao_joule, tipo)
    elif isc_local > 0 or tempo_atuacao > 0:
        alertas_auditaveis.append({
            "code": "INCOMPLETE_SHORT_CIRCUIT_DATA",
            "severity": "WARNING",
            "field": "isc_local/tempo_atuacao",
            "message": "Icc e tempo de eliminação são necessários para avaliar a seção térmica de curto-circuito.",
            "blocking": False,
        })

    aplicacao = str(_valor(c, "aplicacao_circuito", "GERAL") or "GERAL").replace("ç", "c").upper()
    secao_minima_informada = _float(_valor(c, "secao_minima_aplicacao", 0), 0)
    secao_minima = secao_minima_informada or SECAO_MINIMA_PROJETO.get(aplicacao, SECAO_MINIMA_PROJETO["GERAL"])
    secao_minima = _normalizar_secao(secao_minima, tipo)
    if not secao_minima_informada:
        premissas.append({
            "field": "secao_minima_aplicacao",
            "value": secao_minima,
            "unit": "mm²",
            "reason": f"Critério interno de projeto para aplicação {aplicacao}; validar conforme escopo e referência vigente.",
        })

    in_informado = _float(_valor(c, "disjuntor_corrente_nominal", 0), 0)
    in_para_criterio = in_informado or (_disjuntor(corrente, c) if modo_selecao == "automatico" else 0)
    secao_protecao = 0.0
    if in_para_criterio > 0:
        for secao in [s for s in SECOES if s in amp_map]:
            iz_candidato = amp_map[secao] * fator_total * formacao
            if iz_candidato >= in_para_criterio:
                secao_protecao = secao
                break
        if not secao_protecao:
            secao_protecao = max(amp_map)

    secao_mecanica_informada = _float(_valor(c, "secao_minima_mecanica", 0), 0)
    secao_mecanica = _normalizar_secao(secao_mecanica_informada, tipo) if secao_mecanica_informada > 0 else 0.0

    selecao_cabo = _selecionar_secao_automatica(
        V,
        corrente,
        corrente,
        fp_queda,
        fases_calculo,
        comprimento_m,
        tipo,
        formacao,
        metodo,
        ac_dc,
        qt_alimentador,
        qt_limite,
        secao_joule_norm,
    )
    secoes_aplicaveis = [secao_ampacidade, secao_qt, secao_minima]
    if secao_joule_norm:
        secoes_aplicaveis.append(secao_joule_norm)
    if secao_protecao:
        secoes_aplicaveis.append(secao_protecao)
    if secao_mecanica:
        secoes_aplicaveis.append(secao_mecanica)
    secao_final = max(secoes_aplicaveis)
    secao_final = _normalizar_secao(secao_final, tipo)

    ampacidade_preliminar = amp_map.get(secao_final, 0)
    iz_corrigida_preliminar = ampacidade_preliminar * fator_total * formacao

    # Lógica de seleção de disjuntor MT/AT vs BT
    disjuntor_mtat = None
    se_mtat = V >= 1000
    
    if se_mtat and modo_selecao == "automatico":
        # Se for MT/AT, usa o novo selector industrial
        # Como não temos db_session aqui, ele usará o catálogo interno.
        disj_mtat_info = selecionar_disjuntor(
            corrente_projeto=corrente,
            icc_calculada=isc_local,
            tensao_kv=V / 1000.0,
            aplicacao="MT"
        )
        if disj_mtat_info:
            disjuntor_mtat = {
                "in": disj_mtat_info["corrente_nominal"],
                "icu": disj_mtat_info["capacidade_interrupcao"],
                "curva": "D" if carga_motor(_valor(c, "descricao", ""), _valor(c, "tag", ""), eficiencia) else "C",
                "status": "OK",
                "justificativa": f"Disjuntor MT {disj_mtat_info['fabricante']} {disj_mtat_info['modelo']} selecionado."
            }
        else:
            disjuntor_mtat = {
                "in": None,
                "icu": None,
                "curva": "C",
                "status": "CRITICO",
                "justificativa": "Nenhum disjuntor MT/AT atende aos critérios."
            }
        disjuntor_auto = disjuntor_mtat
    else:
        disjuntor_auto = selecionar_disjuntor_automatico(
            corrente,
            iz_corrigida_preliminar,
            isc_local,
            descricao=_valor(c, "descricao", ""),
            tag=_valor(c, "tag", ""),
            eficiencia=eficiencia,
        )

    if modo_selecao == "automatico":
        ultima_secao_avaliada = secao_final
        for secao in [s for s in SECOES if s in amp_map and s >= secao_final]:
            ultima_secao_avaliada = secao
            
            if se_mtat:
                candidato_disjuntor = disjuntor_mtat # disjuntor MT não depende da capacidade do cabo na versão atual do selector
            else:
                candidato_disjuntor = selecionar_disjuntor_automatico(
                    corrente,
                    amp_map.get(secao, 0) * fator_total * formacao,
                    isc_local,
                    descricao=_valor(c, "descricao", ""),
                    tag=_valor(c, "tag", ""),
                    eficiencia=eficiencia,
                )
            if candidato_disjuntor and candidato_disjuntor.get("in"):
                secao_final = secao
                disjuntor_auto = candidato_disjuntor
                break
        else:
            secao_final = ultima_secao_avaliada

    qt_real, rdc, rac, xl = _queda_tensao_pct(V, corrente, fp_queda, fases_calculo, comprimento_m, tipo, secao_final, formacao, metodo, ac_dc)
    qt_acumulada = qt_alimentador + qt_real
    ampacidade = amp_map.get(secao_final, 0)
    iz_corrigida_total = ampacidade * fator_total * formacao
    isc_cabo = _isc_no_fim(V, fases_calculo, isc_local, comprimento_m, tipo, secao_final, formacao, metodo)
    if se_mtat and modo_selecao == "automatico":
        disjuntor_auto = disjuntor_mtat
    else:
        disjuntor_auto = selecionar_disjuntor_automatico(
            corrente,
            iz_corrigida_total,
            isc_local,
            descricao=_valor(c, "descricao", ""),
            tag=_valor(c, "tag", ""),
            eficiencia=eficiencia,
        )
    disjuntor = _disjuntor(corrente, c)
    protecao = _verificar_protecao(c, V, corrente, iz_corrigida_total, isc_local, disjuntor, disjuntor_auto, modo_selecao, isc_cabo_ka=isc_cabo)
    pe = _secao_pe(secao_final)
    tensao_fase = V / math.sqrt(3) if configuracao == "AC_TRIFASICO" else V
    condutores_ativos = 3 if configuracao == "AC_TRIFASICO" else 2
    tipo_comercial = f"{formacao}x{condutores_ativos}/C#{_formatar_secao(secao_final)}"
    selecao_componentes = montar_resultado_selecao(
        modo_selecao,
        tipo_comercial,
        secao_final,
        iz_corrigida_total,
        corrente_corrigida,
        qt_acumulada,
        qt_limite,
        disjuntor_auto,
        cabo_status=selecao_cabo["status"],
        cabo_motivo=selecao_cabo["motivo"],
    )

    status_final = "OK"
    if iz_corrigida_total < corrente or qt_acumulada > qt_limite or (secao_joule_norm and secao_joule_norm > max(amp_map)):
        status_final = "CRITICO"
    elif qt_acumulada > qt_limite * 0.85 or iz_corrigida_total < corrente * 1.10 or isc_local <= 0:
        status_final = "ALERTA"

    if kva_inconsistente:
        status_final = status_mais_grave(status_final, "ALERTA")

    if protecao["protecao_status"] == "CRITICO":
        status_final = "CRITICO"
    elif protecao["protecao_status"] == "ALERTA" and status_final == "OK":
        status_final = "ALERTA"

    resultado = {
        "corrente_nominal": round(corrente, 2),
        "corrente_projeto": round(corrente, 2),
        "corrente_corrigida": round(corrente_corrigida, 2),
        "tensao": round(V, 3),
        "fator_k1": round(k1, 3),
        "fator_k2": round(k2, 3),
        "fator_k3": round(k3, 3),
        "secao_mm2": secao_final,
        "disjuntor_a": float(disjuntor),
        **protecao,
        "queda_tensao_pct": round(qt_real, 3),
        "queda_tensao_max": round(qt_limite, 3),
        # Nunca None: se circuito raiz (qt_alimentador=0), acumulada = trecho
        "queda_tensao_acumulada": round(qt_acumulada if qt_acumulada is not None else qt_real, 3),
        "secao_pe_mm2": pe,
        "ampacidade": float(ampacidade),
        "corrente_condutor": float(ampacidade),
        "ampacidade_corrigida_total": round(iz_corrigida_total, 3),
        "tensao_fase": round(tensao_fase, 3),
        "isc_local": round(isc_local, 3) if isc_local > 0 else None,
        "isc_cabo": round(isc_cabo, 3) if isc_cabo is not None else None,
        "tempo_atuacao": round(tempo_atuacao, 3) if tempo_atuacao > 0 else None,
        "secao_joule": round(secao_joule, 3) if secao_joule else 0.0,
        "impedancia_rdc": round(rdc, 6),
        "impedancia_rac": round(rac, 6),
        "impedancia_xl": round(xl, 6),
        "tipo_cabo_comercial": tipo_comercial,
        "potencia_kva": round(kva_final, 3),
        "potencia_kva_informada": round(potencia_kva, 3) if potencia_kva else None,
        "potencia_kva_calculada": round(kva_calculado, 3),
        "inconsistencia_kva": mensagem_kva or None,
        "comprimento_real": round(comprimento_m, 3),
        "corrente_ac_dc": ac_dc,
        "configuracao_eletrica": configuracao,
        "referencia_tensao": corrente_info["referencia_tensao"],
        "modo_entrada": corrente_info["modo_entrada"],
        "base_potencia": corrente_info["base_potencia"],
        "metodo_instalacao": metodo,
        "formacao": formacao,
        "modo_dimensionamento": modo_selecao,
        "modo_selecao_componentes": modo_selecao,
        **selecao_componentes,
        "status": _status(status_final),
        "status_final": normalizar_status(status_final),
    }

    validacao = validar_circuito_normativo(resultado, contexto_chave)
    resultado.update(validacao)
    resultado["validacao_status"] = normalizar_status(resultado.get("validacao_status"))
    if mensagem_kva:
        resultado["validacao_status"] = status_mais_grave(resultado["validacao_status"], "ALERTA")
        mensagem_atual = resultado.get("validacao_mensagem") or ""
        resultado["validacao_mensagem"] = f"{mensagem_atual} {mensagem_kva}".strip()

    if resultado["validacao_status"] == "CRITICO":
        resultado["status_final"] = "CRITICO"
    elif resultado.get("selecao_componentes_status") == "CRITICO":
        resultado["status_final"] = "CRITICO"
    elif validacao["validacao_status"] == "ALERTA" and resultado["status_final"] == "OK":
        resultado["status_final"] = "ALERTA"
    elif resultado.get("selecao_componentes_status") == "ALERTA" and resultado["status_final"] == "OK":
        resultado["status_final"] = "ALERTA"
    resultado["status_final"] = normalizar_status(resultado["status_final"])
    resultado["status"] = _status(resultado["status_final"])

    criterios = {
        "ampacidade": {
            "required_section_mm2": secao_ampacidade,
            "status": "OK" if iz_corrigida_total >= corrente else "BLOCKED",
            "ib_a": round(corrente, 6),
            "iz_corrected_a": round(iz_corrigida_total, 6),
        },
        "voltage_drop": {
            "required_section_mm2": secao_qt,
            "status": "OK" if qt_acumulada <= qt_limite else "BLOCKED",
            "calculated_pct": round(qt_acumulada, 6),
            "limit_pct": round(qt_limite, 6),
        },
        "minimum_application": {
            "required_section_mm2": secao_minima,
            "status": "OK",
            "application": aplicacao,
            "basis": "informed" if secao_minima_informada else "project_assumption_pending_validation",
        },
        "short_circuit": {
            "required_section_mm2": secao_joule_norm or None,
            "status": "OK" if secao_joule_norm and secao_final >= secao_joule_norm else "NOT_EVALUATED" if not secao_joule_norm else "BLOCKED",
            "icc_ka": round(isc_local, 6) if isc_local > 0 else None,
            "clearing_time_s": round(tempo_atuacao, 6) if tempo_atuacao > 0 else None,
        },
        "protection": {
            "required_section_mm2": secao_protecao or None,
            "status": protecao["protecao_avaliacao_status"],
            "ib_a": round(corrente, 6),
            "in_a": protecao["disjuntor_corrente_nominal"],
            "iz_corrected_a": round(iz_corrigida_total, 6),
            "checks": protecao["protecao_verificacoes"],
        },
        "mechanical": {
            "required_section_mm2": secao_mecanica or None,
            "status": "OK" if secao_mecanica else "NOT_EVALUATED",
        },
    }
    secoes_por_criterio = {
        nome: dados["required_section_mm2"]
        for nome, dados in criterios.items()
        if dados.get("required_section_mm2") is not None
    }
    criterios_dominantes = [nome for nome, secao in secoes_por_criterio.items() if secao == secao_final]

    for premissa in premissas:
        alertas_auditaveis.append({
            "code": "ASSUMPTION_USED",
            "severity": "WARNING",
            "field": premissa["field"],
            "message": premissa["reason"],
            "blocking": False,
        })
    if protecao["protecao_avaliacao_status"] == "NOT_EVALUATED":
        alertas_auditaveis.append({
            "code": "PROTECTION_NOT_FULLY_EVALUATED",
            "severity": "WARNING",
            "field": "protecao",
            "message": "A proteção não foi integralmente verificada com curva, tempo, curto e dados do fabricante.",
            "blocking": False,
        })
    if tensao_info.get("classificacao") in {"AT", "EAT", "UAT"} and resultado["status_final"] == "OK":
        resultado["status_final"] = "ALERTA"
        resultado["status"] = _status(resultado["status_final"])
        resultado["validacao_status"] = status_mais_grave(resultado.get("validacao_status"), "ALERTA")
        mensagem_atual = resultado.get("validacao_mensagem") or ""
        resultado["validacao_mensagem"] = (
            f"{mensagem_atual} Tensão {tensao_info.get('classificacao')}: validações de isolamento, coordenação e proteção específicas não avaliadas integralmente."
        ).strip()

    memorial_steps = [
        {
            "id": "design_current",
            "title": "Corrente de projeto",
            "status": "OK",
            "formula": corrente_info["formula"],
            "substitution": corrente_info["substituicao"],
            "result": {"value": round(corrente, 6), "unit": "A"},
            "inputs": {
                "voltage_v": V,
                "voltage_unit": tensao_info.get("unidade"),
                "voltage_reference": tensao_info.get("referencia"),
                "voltage_classification": tensao_info.get("classificacao"),
                "power_kw": potencia_kw if corrente_info["modo_entrada"] == "POTENCIA_ATIVA" else None,
                "apparent_power_kva": potencia_kva if corrente_info["modo_entrada"] == "POTENCIA_APARENTE" else None,
                "informed_current_a": _float(_valor(c, "corrente_informada", 0), 0) or None,
                "power_factor": fp if ac_dc == "AC" else None,
                "efficiency": eficiencia if corrente_info["base_potencia"] == "saida_mecanica" else None,
            },
        },
        {
            "id": "corrected_ampacity",
            "title": "Capacidade de condução corrigida",
            "status": criterios["ampacidade"]["status"],
            "formula": "Iz = Iz_table × K1 × K2 × K3 × n_parallel",
            "substitution": f"Iz = {ampacidade:g} × {k1:g} × {k2:g} × {k3:g} × {formacao:g}",
            "result": {"value": round(iz_corrigida_total, 6), "unit": "A"},
        },
        {
            "id": "voltage_drop",
            "title": "Queda de tensão",
            "status": criterios["voltage_drop"]["status"],
            "formula": "ΔV% = 100 × ΔV / V",
            "substitution": f"ΔV% = {qt_real:.6f}% no trecho + {qt_alimentador:.6f}% a montante",
            "result": {"value": round(qt_acumulada, 6), "unit": "%"},
        },
        {
            "id": "section_decision",
            "title": "Decisão da seção",
            "status": "OK",
            "formula": "Sfinal = next_commercial(max(Scriteria))",
            "substitution": "max(" + ", ".join(f"{nome}={secao:g} mm²" for nome, secao in secoes_por_criterio.items()) + ")",
            "result": {"value": secao_final, "unit": "mm²"},
        },
    ]
    resultado.update({
        "resultado": {
            "status": "BLOCKED" if resultado["status_final"] == "CRITICO" else "WARNING" if resultado["status_final"] == "ALERTA" else "OK",
            "design_current_a": round(corrente, 6),
            "corrected_capacity_a": round(iz_corrigida_total, 6),
            "adopted_section_mm2": secao_final,
            "voltage_drop_pct": round(qt_acumulada, 6),
            "governing_criteria": criterios_dominantes,
        },
        "criterios": criterios,
        "decisao": {
            "rule": "max_applicable_required_sections",
            "sections_mm2": secoes_por_criterio,
            "governing_criteria": criterios_dominantes,
            "adopted_section_mm2": secao_final,
        },
        "memorial": {"schema_version": AUDIT_SCHEMA_VERSION, "steps": memorial_steps},
        "alertas": alertas_auditaveis,
        "premissas": premissas,
        "limitacoes": limitacoes + tensao_info.get("limitacoes", []),
        "metadados_calculo": {"engine_version": ENGINE_VERSION, "schema_version": AUDIT_SCHEMA_VERSION, "tensao": tensao_info},
    })

    return resultado
