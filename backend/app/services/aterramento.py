"""
Serviço de cálculo do sistema de aterramento.
Referência normativa: Aula 1 P2 — Prof. Armando, Unisanta

Método Wenner com fatores K pré-calculados (p=0,40m):
    rho(a) = K(a) × R(a)

Análise de desvios (NBR 7117):
    Descartar medições com desvio > 50% da média por espaçamento.

Resistividade aparente (2 camadas):
    deq = sum(d_i)
    rho_eq = deq / sum(d_i / rho_i)
    theta = r / deq
    delta = rho_inf / rho_eq
    N = tabela bilinear(theta, delta)
    rho_a = N × rho_eq
"""
import math
from typing import Any, Dict, List, Optional, Tuple

from app.services.status_utils import normalizar_status, numero_finito, status_mais_grave

# ---------------------------------------------------------------------------
# Tabelas normativas embutidas (Aula 1 P2)
# ---------------------------------------------------------------------------

# Fatores K pré-calculados para p = 0,40 m (profundidade das hastes)
# rho(a) = K(a) × R(a)
FATORES_K: Dict[float, float] = {
    1:  7.694037,
    2:  13.39432,
    4:  25.56577,
    8:  50.48453,
    16: 100.6408,
    32: 201.1169,
    64: 402.1513,
}

# Tabela N(theta, delta) — interpolação bilinear do gráfico bilogarítmico da norma
# Fonte: Gráfico Prof. Armando (Aula 1 P2) — valores lidos diretamente do gráfico
# delta = rho_inf / rho_eq  (razão de resistividades: profunda / equivalente superficial)
# theta = r / deq           (razão de alcance / profundidade equivalente)
# Para delta < 1 (camada profunda mais condutora): N < 1 (resistividade aparente reduzida)
# Para delta > 1 (camada profunda mais resistiva): N > 1 (resistividade aparente elevada)
TABELA_N: Dict[float, Dict[float, float]] = {
    # theta:  {delta: N}
    #          0.1    0.2    0.5    1.0    2.0    5.0    10.0
    0.1:  {0.1: 1.00, 0.2: 1.00, 0.5: 1.00, 1.0: 1.00, 2.0: 1.00, 5.0: 1.00, 10.0: 1.00},
    0.5:  {0.1: 0.98, 0.2: 0.96, 0.5: 0.93, 1.0: 1.00, 2.0: 1.10, 5.0: 1.40, 10.0: 1.70},
    1.0:  {0.1: 0.95, 0.2: 0.92, 0.5: 0.88, 1.0: 1.00, 2.0: 1.25, 5.0: 1.80, 10.0: 2.30},
    2.0:  {0.1: 0.90, 0.2: 0.82, 0.5: 0.78, 1.0: 1.00, 2.0: 1.50, 5.0: 2.60, 10.0: 3.50},
    3.0:  {0.1: 0.85, 0.2: 0.75, 0.5: 0.73, 1.0: 1.00, 2.0: 1.65, 5.0: 3.20, 10.0: 4.50},
    5.0:  {0.1: 0.80, 0.2: 0.70, 0.5: 0.68, 1.0: 1.00, 2.0: 2.00, 5.0: 4.50, 10.0: 6.50},
    10.0: {0.1: 0.75, 0.2: 0.65, 0.5: 0.63, 1.0: 1.00, 2.0: 2.50, 5.0: 6.50, 10.0: 9.50},
}

# Espaçamentos disponíveis na tabela K (para busca do mais próximo)
ESPACAMENTOS_K: List[float] = sorted(FATORES_K.keys())

# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------

def _float(valor: Any, padrao: Optional[float] = None) -> Optional[float]:
    return numero_finito(valor, padrao)


def _str(valor: Any, padrao: str = "") -> str:
    return str(valor or padrao).strip()


def _round(valor: Optional[float], casas: int = 3) -> Optional[float]:
    return round(valor, casas) if valor is not None else None


def _item(criterio: str, status: str, mensagem: str) -> Dict[str, str]:
    return {"criterio": criterio, "status": normalizar_status(status), "mensagem": mensagem}


def _campo_texto(dados: Dict[str, Any], *campos: str) -> str:
    for campo in campos:
        valor = _str(dados.get(campo))
        if valor:
            return valor
    return ""


def _classificar_solo(resistividade_media: Optional[float]) -> str:
    if resistividade_media is None:
        return "nao calculavel"
    if resistividade_media < 100:
        return "baixa resistividade"
    if resistividade_media <= 1000:
        return "media resistividade"
    return "alta resistividade"


def _fator_k(a: float) -> float:
    """
    Retorna o fator K para o espaçamento a (m) com p=0,40m.
    Se o espaçamento não estiver na tabela, usa interpolação linear log-log
    ou o valor do espaçamento mais próximo.
    """
    if a in FATORES_K:
        return FATORES_K[a]
    # Buscar vizinhos na tabela para interpolação log-log
    menores = [e for e in ESPACAMENTOS_K if e <= a]
    maiores = [e for e in ESPACAMENTOS_K if e > a]
    if not menores:
        return FATORES_K[ESPACAMENTOS_K[0]]
    if not maiores:
        return FATORES_K[ESPACAMENTOS_K[-1]]
    a1, a2 = menores[-1], maiores[0]
    k1, k2 = FATORES_K[a1], FATORES_K[a2]
    # Interpolação linear em escala log-log
    t = (math.log(a) - math.log(a1)) / (math.log(a2) - math.log(a1))
    return math.exp(math.log(k1) + t * (math.log(k2) - math.log(k1)))


def _wenner_formula_completa(a: float, R: float, p: float = 0.4) -> float:
    """
    Fórmula completa de Wenner (com correção de profundidade p):
    rho = (4*pi*a*R) / (1 + 2a/sqrt(a^2+(2p)^2) - 2a/sqrt((2a)^2+(2p)^2))
    Usada quando a não está na tabela K e p != 0.4
    """
    if a <= 0 or R <= 0:
        return 0.0
    numerador = 4 * math.pi * a * R
    denominador = (
        1
        + 2 * a / math.sqrt(a**2 + (2 * p) ** 2)
        - 2 * a / math.sqrt((2 * a) ** 2 + (2 * p) ** 2)
    )
    if denominador <= 0:
        return 2 * math.pi * a * R  # fallback simplificado
    return numerador / denominador


# ---------------------------------------------------------------------------
# Função 1: Calcular Wenner com fatores K
# ---------------------------------------------------------------------------

def calcular_wenner(
    medicoes: Dict[float, List[float]],
    p: float = 0.4,
) -> Dict[str, Any]:
    """
    Calcula resistividade por espaçamento usando fatores K pré-calculados.

    Parâmetros:
        medicoes: dict {a_m: [R1, R2, R3, ...]}  (espaçamento → lista de resistências medidas)
        p: profundidade das hastes (m), padrão 0.4 m

    Retorno:
        resistividades    : {a: [rho1, rho2, ...]}
        medias_brutas     : {a: media_de_todas}
        desvios_pct       : {a: [dev1%, dev2%, ...]}
        validos           : {a: [rho válidos após descarte]}
        medias_validas    : {a: media_sem_outliers}
        descartados       : {a: nro de medições descartadas}
    """
    resistividades: Dict[float, List[float]] = {}
    medias_brutas: Dict[float, float] = {}
    desvios_pct: Dict[float, List[float]] = {}
    validos: Dict[float, List[float]] = {}
    medias_validas: Dict[float, float] = {}
    descartados: Dict[float, int] = {}

    for a_raw, leituras in (medicoes or {}).items():
        a = _float(a_raw)
        if a is None or a <= 0:
            continue
        Rs = [_float(r) for r in (leituras if isinstance(leituras, list) else [leituras])]
        Rs = [r for r in Rs if r is not None and r > 0]
        if not Rs:
            continue

        # Usar fator K se p == 0.4, senão fórmula completa
        if abs(p - 0.4) < 0.001:
            k = _fator_k(a)
            rhos = [round(k * r, 3) for r in Rs]
        else:
            rhos = [round(_wenner_formula_completa(a, r, p), 3) for r in Rs]

        resistividades[a] = rhos
        media = sum(rhos) / len(rhos)
        medias_brutas[a] = round(media, 3)

        # Análise de desvios (NBR 7117): descartar > 50% da média
        devs = [round(abs(rho - media) / media * 100, 2) for rho in rhos]
        desvios_pct[a] = devs

        rhos_validos = [rho for rho, dev in zip(rhos, devs) if dev <= 50.0]
        descartados[a] = len(rhos) - len(rhos_validos)

        if rhos_validos:
            validos[a] = rhos_validos
            medias_validas[a] = round(sum(rhos_validos) / len(rhos_validos), 3)
        else:
            # Todos descartados: usar todos mesmo assim (sem dados não há alternativa)
            validos[a] = rhos
            medias_validas[a] = round(media, 3)

    return {
        "resistividades": resistividades,
        "medias_brutas": medias_brutas,
        "desvios_pct": desvios_pct,
        "validos": validos,
        "medias_validas": medias_validas,
        "descartados": descartados,
    }


# ---------------------------------------------------------------------------
# Função 2: Interpolação bilinear da tabela N(theta, delta)
# ---------------------------------------------------------------------------

def _interpolar_N(theta: float, delta: float) -> float:
    """
    Interpolação bilinear (log-log nos eixos) na tabela N(theta, delta).
    """
    thetas = sorted(TABELA_N.keys())
    deltas = sorted(next(iter(TABELA_N.values())).keys())

    def _clamp(val, seq):
        if val <= seq[0]:
            return seq[0], seq[0]
        if val >= seq[-1]:
            return seq[-1], seq[-1]
        for i in range(len(seq) - 1):
            if seq[i] <= val <= seq[i + 1]:
                return seq[i], seq[i + 1]
        return seq[-2], seq[-1]

    t1, t2 = _clamp(theta, thetas)
    d1, d2 = _clamp(delta, deltas)

    # Valores dos 4 cantos
    N11 = TABELA_N[t1][d1]
    N12 = TABELA_N[t1][d2]
    N21 = TABELA_N[t2][d1]
    N22 = TABELA_N[t2][d2]

    # Interpolação linear em theta
    if t1 == t2:
        Nd1 = N11
        Nd2 = N12
    else:
        ft = (theta - t1) / (t2 - t1)
        Nd1 = N11 + ft * (N21 - N11)
        Nd2 = N12 + ft * (N22 - N12)

    # Interpolação linear em delta
    if d1 == d2:
        return round(Nd1, 4)
    fd = (delta - d1) / (d2 - d1)
    return round(Nd1 + fd * (Nd2 - Nd1), 4)


# ---------------------------------------------------------------------------
# Função 3: Calcular resistividade aparente (2 camadas)
# ---------------------------------------------------------------------------

def calcular_resistividade_aparente(
    estratificacao: List[Dict[str, float]],
    configuracao: str,
    dimensoes: Dict[str, float],
    rho_infinito: float,
) -> Dict[str, Any]:
    """
    Calcula resistividade aparente para dimensionamento da malha.

    Parâmetros:
        estratificacao: [{"espessura_m": d, "resistividade_ohm_m": rho}, ...]
        configuracao:   "retangular" | "hastes_alinhadas" | "quadrado" | "cabo"
        dimensoes:      dict conforme configuracao:
                          retangular:      {"largura_m": L, "comprimento_m": C}
                          hastes_alinhadas: {"espacamento_m": e, "n_hastes": n}
                          quadrado:        {"diagonal_m": diag}
                          cabo:            {"comprimento_m": comp}
        rho_infinito:   resistividade da camada mais profunda (Omega.m)

    Retorno:
        deq_m, rho_eq, theta, delta, N, rho_aparente, mensagem
    """
    resultado: Dict[str, Any] = {}

    # 1. deq = soma das espessuras
    deq = sum(_float(cam.get("espessura_m"), 0) or 0 for cam in estratificacao)
    if deq <= 0:
        return {"erro": "Espessuras das camadas ausentes ou zeradas.", "rho_aparente": None}

    # 2. rho_eq = deq / sum(d_i / rho_i)
    soma_inv = sum(
        (_float(cam.get("espessura_m"), 0) or 0) / max(_float(cam.get("resistividade_ohm_m"), 1) or 1, 1e-9)
        for cam in estratificacao
    )
    rho_eq = deq / soma_inv if soma_inv > 0 else None
    if rho_eq is None:
        return {"erro": "Resistividade das camadas inválida.", "rho_aparente": None}

    # 3. r conforme configuração da malha
    cfg = str(configuracao or "retangular").lower().replace(" ", "_")
    r: Optional[float] = None

    if cfg == "retangular":
        L = _float(dimensoes.get("largura_m"))
        C = _float(dimensoes.get("comprimento_m"))
        if L and C:
            r = math.sqrt(L * C / math.pi)
    elif cfg == "hastes_alinhadas":
        e = _float(dimensoes.get("espacamento_m"))
        n = _float(dimensoes.get("n_hastes"))
        if e and n:
            r = e * (n - 1) / 2
    elif cfg == "quadrado":
        diag = _float(dimensoes.get("diagonal_m"))
        if diag:
            r = diag / 2
    elif cfg == "cabo":
        comp = _float(dimensoes.get("comprimento_m"))
        if comp:
            r = comp / 2
    else:
        # Fallback: r direto
        r = _float(dimensoes.get("r_m"))

    if r is None or r <= 0:
        return {
            "erro": f"Dimensoes da malha insuficientes para configuracao '{configuracao}'.",
            "rho_aparente": None,
        }

    # 4. theta e delta
    theta = r / deq
    delta = rho_infinito / rho_eq if rho_eq > 0 else 1.0

    # 5. N da tabela
    N = _interpolar_N(theta, delta)

    # 6. rho_aparente = N × rho_eq
    rho_aparente = round(N * rho_eq, 2)

    resultado.update({
        "deq_m": round(deq, 3),
        "rho_eq": round(rho_eq, 3),
        "r_m": round(r, 3),
        "theta": round(theta, 4),
        "delta": round(delta, 4),
        "N": N,
        "rho_aparente": rho_aparente,
        "configuracao": configuracao,
        "rho_infinito": rho_infinito,
    })
    return resultado


# ---------------------------------------------------------------------------
# Função principal (compatível com router existente)
# ---------------------------------------------------------------------------

def calcular_aterramento(dados: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calcula sistema de aterramento com método Wenner completo (Aula 1 P2).
    Mantém todas as chaves legadas no retorno para compatibilidade.
    Aceita dois formatos de medições:
      - Formato legado: "medicoes": [{"espacamento_a_m": a, "resistencia_ohm": R, ...}, ...]
      - Formato novo:   "medicoes_dict": {a: [R1, R2, ...]}
    """
    dados = dados or {}

    status = "OK"
    itens: List[Dict[str, str]] = []

    # ── 1. Parâmetros gerais ──────────────────────────────────────────────────
    p = _float(dados.get("profundidade_hastes_m"), 0.4) or 0.4

    # ── 2. Medições — suporte a ambos os formatos ─────────────────────────────
    medicoes_dict_raw = dados.get("medicoes_dict")
    medicoes_lista_raw = dados.get("medicoes") or []

    # Converter formato legado (lista) → dict {a: [R]}
    if medicoes_dict_raw and isinstance(medicoes_dict_raw, dict):
        medicoes_dict: Dict[float, List[float]] = {
            float(k): (v if isinstance(v, list) else [v])
            for k, v in medicoes_dict_raw.items()
        }
    else:
        medicoes_dict = {}
        if isinstance(medicoes_lista_raw, list):
            for med in medicoes_lista_raw:
                if not isinstance(med, dict):
                    continue
                a_val = _float(med.get("espacamento_a_m") or med.get("espacamento") or med.get("a"))
                r_val = _float(med.get("resistencia_ohm") or med.get("resistencia") or med.get("r"))
                if a_val and r_val and a_val > 0 and r_val > 0:
                    medicoes_dict.setdefault(a_val, []).append(r_val)

    # ── 3. Calcular Wenner com fatores K ─────────────────────────────────────
    wenner_result: Dict[str, Any] = {}
    resistividades_medias: Dict[float, float] = {}
    n_descartados_total = 0

    if medicoes_dict:
        wenner_result = calcular_wenner(medicoes_dict, p)
        resistividades_medias = wenner_result.get("medias_validas", {})
        n_descartados_total = sum(wenner_result.get("descartados", {}).values())

        if n_descartados_total > 0:
            itens.append(_item(
                "Desvio de medicoes",
                "ALERTA",
                f"{n_descartados_total} medicao(oes) descartada(s) por desvio > 50% da media (NBR 7117)."
            ))
            status = status_mais_grave(status, "ALERTA")

    # ── 4. Resistividade média geral (de todas as medições válidas) ───────────
    todos_rhos = [rho for rhos in wenner_result.get("validos", {}).values() for rho in rhos]
    media_geral = sum(todos_rhos) / len(todos_rhos) if todos_rhos else None
    menor = min(todos_rhos) if todos_rhos else None
    maior = max(todos_rhos) if todos_rhos else None
    variacao = (
        ((maior - menor) / media_geral * 100)
        if media_geral and menor is not None and maior is not None
        else None
    )
    classificacao = _classificar_solo(media_geral)

    if not todos_rhos:
        itens.append(_item("Medicoes Wenner", "CRITICO",
            "Nenhuma medicao valida cadastrada para calculo de resistividade."))
        status = status_mais_grave(status, "CRITICO")
    elif len(todos_rhos) < 3:
        itens.append(_item("Quantidade de medicoes", "ALERTA",
            "Poucas medicoes validas; recomenda-se ampliar a campanha de medicao."))
        status = status_mais_grave(status, "ALERTA")

    if variacao is not None and variacao > 50:
        itens.append(_item("Variacao de resistividade", "ALERTA",
            f"Grande variacao entre medicoes ({variacao:.2f}%)."))
        status = status_mais_grave(status, "ALERTA")

    # ── 5. Resistividade aparente (se estratificação informada) ───────────────
    estratificacao = dados.get("estratificacao") or []
    rho_infinito = _float(dados.get("rho_infinito"))
    configuracao_malha = _str(dados.get("configuracao_malha"), "retangular")
    dimensoes_malha = dados.get("dimensoes_malha") or {}
    aparente_result: Dict[str, Any] = {}

    if estratificacao and rho_infinito is not None:
        aparente_result = calcular_resistividade_aparente(
            estratificacao, configuracao_malha, dimensoes_malha, rho_infinito
        )
        if aparente_result.get("erro"):
            itens.append(_item("Resistividade aparente", "ALERTA", aparente_result["erro"]))
            status = status_mais_grave(status, "ALERTA")

    # ── 6. Status final ───────────────────────────────────────────────────────
    if not itens:
        itens.append(_item(
            "Sistema de aterramento",
            "OK",
            "Medicoes Wenner validas e consistentes para estimativa de resistividade aparente."
        ))

    status_final = normalizar_status(status)
    mensagem = next(
        (item["mensagem"] for item in itens if normalizar_status(item["status"]) == status_final),
        itens[0]["mensagem"]
    )

    # ── 7. Retorno — mantém chaves legadas + adiciona novas ──────────────────
    return {
        # ── Chaves legadas (não renomear) ──
        "tipo_aterramento":      _campo_texto(dados, "tipo_aterramento", "tipo", "tipoAterramento", "tipo_aterramento_sistema"),
        "finalidade":            _campo_texto(dados, "finalidade", "finalidade_aterramento"),
        "observacoes_tecnicas":  _campo_texto(dados, "observacoes_tecnicas", "observacoes", "nota_tecnica"),
        "medicoes":              list(medicoes_lista_raw) if isinstance(medicoes_lista_raw, list) else [],
        "formula":               "rho(a) = K(a) x R(a)  [p=0,40m]  |  rho = 4*pi*a*R / (corr. profundidade)",
        "resistividade_media":   _round(media_geral, 3),
        "menor_resistividade":   _round(menor, 3),
        "maior_resistividade":   _round(maior, 3),
        "variacao_percentual":   _round(variacao, 3),
        "classificacao_solo":    classificacao,
        "status":                status_final,
        "mensagem":              mensagem,
        "itens":                 itens,

        # ── Chaves novas (Aula 1 P2) ──
        "profundidade_hastes_m":          p,
        "medicoes_dict":                  medicoes_dict,
        "resistividades_calculadas":      wenner_result.get("resistividades", {}),
        "medias_brutas":                  wenner_result.get("medias_brutas", {}),
        "desvios_pct":                    wenner_result.get("desvios_pct", {}),
        "resistividades_validas":         wenner_result.get("validos", {}),
        "resistividades_medias_validas":  resistividades_medias,
        "n_medicoes_descartadas":         n_descartados_total,
        "estratificacao":                 estratificacao,
        "rho_infinito":                   rho_infinito,
        "configuracao_malha":             configuracao_malha,
        "dimensoes_malha":                dimensoes_malha,
        "deq_m":                          aparente_result.get("deq_m"),
        "rho_eq":                         aparente_result.get("rho_eq"),
        "theta":                          aparente_result.get("theta"),
        "delta":                          aparente_result.get("delta"),
        "N":                              aparente_result.get("N"),
        "rho_aparente":                   aparente_result.get("rho_aparente"),
        "status_final":                   status_final,
    }
