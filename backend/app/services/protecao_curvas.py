"""Avaliação conservadora de pontos de curva tempo-corrente.

Os pontos devem vir de documentação do fabricante e representar um limite
superior de tempo de atuação para cada múltiplo da corrente nominal.
"""

import math


def normalizar_pontos(pontos):
    if not isinstance(pontos, list) or not pontos:
        return []

    normalizados = []
    for ponto in pontos[:32]:
        if not isinstance(ponto, dict):
            continue
        try:
            multiplo = float(ponto.get("multiplo_in", ponto.get("current_multiple")))
            tempo = float(ponto.get("tempo_max_s", ponto.get("max_time_s")))
        except (TypeError, ValueError):
            continue
        if not math.isfinite(multiplo) or not math.isfinite(tempo):
            continue
        if multiplo <= 0 or tempo <= 0:
            continue
        normalizados.append({"multiplo_in": multiplo, "tempo_max_s": tempo})

    normalizados.sort(key=lambda item: item["multiplo_in"])
    deduplicados = []
    for ponto in normalizados:
        if deduplicados and ponto["multiplo_in"] == deduplicados[-1]["multiplo_in"]:
            deduplicados[-1] = ponto
        else:
            deduplicados.append(ponto)
    return deduplicados


def tempo_maximo_para_corrente(pontos, multiplo_in):
    """Interpola em escala log-log e recusa extrapolação."""
    pontos = normalizar_pontos(pontos)
    if not pontos or not math.isfinite(multiplo_in) or multiplo_in <= 0:
        return None
    if multiplo_in < pontos[0]["multiplo_in"] or multiplo_in > pontos[-1]["multiplo_in"]:
        return None
    if len(pontos) == 1:
        return pontos[0]["tempo_max_s"] if multiplo_in == pontos[0]["multiplo_in"] else None

    for anterior, posterior in zip(pontos, pontos[1:]):
        x1 = anterior["multiplo_in"]
        x2 = posterior["multiplo_in"]
        if x1 <= multiplo_in <= x2:
            if x1 == x2:
                return posterior["tempo_max_s"]
            proporcao = (math.log(multiplo_in) - math.log(x1)) / (math.log(x2) - math.log(x1))
            y1 = math.log(anterior["tempo_max_s"])
            y2 = math.log(posterior["tempo_max_s"])
            return math.exp(y1 + proporcao * (y2 - y1))
    return None


def avaliar_curva(pontos, corrente_fim_a, corrente_nominal_a, tempo_limite_s):
    pontos = normalizar_pontos(pontos)
    if not pontos or not corrente_fim_a or not corrente_nominal_a or not tempo_limite_s:
        return {
            "status": "NOT_EVALUATED",
            "motivo": "Pontos de curva, corrente no fim, In e tempo limite são necessários.",
            "pontos": pontos,
        }

    multiplo = float(corrente_fim_a) / float(corrente_nominal_a)
    tempo_curva = tempo_maximo_para_corrente(pontos, multiplo)
    if tempo_curva is None:
        return {
            "status": "NOT_EVALUATED",
            "motivo": "A corrente no fim está fora da faixa documentada da curva; não foi feita extrapolação.",
            "multiplo_in": round(multiplo, 6),
            "pontos": pontos,
        }

    status = "OK" if tempo_curva <= float(tempo_limite_s) else "BLOCKED"
    return {
        "status": status,
        "multiplo_in": round(multiplo, 6),
        "tempo_curva_max_s": round(tempo_curva, 6),
        "tempo_limite_s": round(float(tempo_limite_s), 6),
        "pontos": pontos,
        "motivo": "Tempo de atuação documentado atende ao limite informado." if status == "OK" else "Tempo de atuação documentado excede o limite informado.",
    }
