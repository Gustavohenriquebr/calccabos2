import math
from typing import Optional, Dict, Any

# Aula 4 - Prof. Armando
# Mudança 1 — Tabela de tensões nominais normalizadas (IEC/NBR)
TENSOES_NOMINAIS_KV = [7.2, 15, 24.2, 36.2, 72.5, 92, 145, 242, 362, 460, 550]

# Aula 4 - Prof. Armando
# Mudança 2 — Série normalizada de correntes nominais (A)
IN_SERIE_A = [400, 600, 800, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300]

# Aula 4 - Prof. Armando
# Mudança 4 — Tabela normativa de NBI por classe de tensão
# Tupla: (solidamente aterrado, não aterrado) em kVp
NBI_TABELA = {
    15:   (95,   110),
    36.2: (150,  170),
    72.5: (325,  350),
    92:   (380,  450),
    145:  (550,  650),
    242:  (850,  950),
    362:  (1050, 1175),
    460:  (1425, 1550),
    550:  (1550, 1675),
    800:  (1900, 2100),
}

# Aula 4 - Prof. Armando
# Mudança 5 — Série normalizada de capacidade de interrupção Icu (kA)
ICU_SERIE_KA = [8, 10, 12.5, 16, 20, 25, 31.5, 40, 50, 63, 80, 100]


def selecionar_tensao_nominal(tensao_sistema: float) -> Optional[float]:
    """
    Aula 4 - Prof. Armando
    Seleciona o menor valor normalizado de tensão nominal onde Vn >= tensao_sistema.
    """
    for vn in TENSOES_NOMINAIS_KV:
        if vn >= tensao_sistema:
            return vn
    return None


def selecionar_corrente_nominal(corrente_calculada: float) -> Optional[int]:
    """
    Aula 4 - Prof. Armando
    Seleciona o menor valor normalizado de corrente nominal onde In >= corrente_calculada.
    """
    for in_a in IN_SERIE_A:
        if in_a >= corrente_calculada:
            return in_a
    return None


def selecionar_icu(icc_local: float) -> Optional[float]:
    """
    Aula 4 - Prof. Armando
    Seleciona o menor valor normalizado de Icu onde Icu >= icc_local.
    """
    for icu in ICU_SERIE_KA:
        if icu >= icc_local:
            return icu
    return None


def selecionar_nbi(classe_kv: float, solidamente_aterrado: bool) -> Optional[int]:
    """
    Aula 4 - Prof. Armando
    Retorna o NBI (kVp) para a classe de tensão e tipo de aterramento informados.
    col = 0 para solidamente aterrado, col = 1 para não aterrado.
    """
    col = 0 if solidamente_aterrado else 1
    entrada = NBI_TABELA.get(classe_kv)
    if entrada is None:
        return None
    return entrada[col]


def selecionar_disjuntor(
    corrente_projeto: float,
    icc_calculada: float,
    tensao_kv: float,
    db_session=None,
    aplicacao: str = "MT",
    solidamente_aterrado: bool = True,
) -> Optional[Dict[str, Any]]:
    """
    Seleciona automaticamente um disjuntor industrial que atenda aos critérios:
    - In disjuntor >= corrente_projeto  (série normalizada IN_SERIE_A)
    - Icu disjuntor >= Icc calculada    (série normalizada ICU_SERIE_KA)
    - Vn disjuntor >= tensao_kv         (tabela TENSOES_NOMINAIS_KV)
    - NBI determinado pela tabela normativa NBI_TABELA
    """
    try:
        corrente_projeto = float(corrente_projeto)
        icc_calculada = float(icc_calculada)
        tensao_kv = float(tensao_kv)
    except (TypeError, ValueError):
        return None

    if math.isnan(corrente_projeto) or math.isinf(corrente_projeto) or corrente_projeto < 0:
        return None
    if math.isnan(icc_calculada) or math.isinf(icc_calculada) or icc_calculada < 0:
        return None
    if math.isnan(tensao_kv) or math.isinf(tensao_kv) or tensao_kv <= 0:
        return None

    if db_session:
        from app.models.disjuntor import DisjuntorCatalogo
        disjuntor_db = db_session.query(DisjuntorCatalogo).filter(
            DisjuntorCatalogo.in_a >= corrente_projeto,
            DisjuntorCatalogo.icc_ka >= icc_calculada,
            DisjuntorCatalogo.vn_kv_max >= tensao_kv,
            DisjuntorCatalogo.aplicacao == aplicacao,
            DisjuntorCatalogo.is_active == True
        ).order_by(DisjuntorCatalogo.in_a.asc(), DisjuntorCatalogo.icc_ka.asc()).first()

        if disjuntor_db:
            # Aula 4 - Prof. Armando
            # NBI agora vem da tabela normativa, não do campo estático nbi_kvp
            classe_selecionada = selecionar_tensao_nominal(tensao_kv)
            nbi = selecionar_nbi(classe_selecionada, solidamente_aterrado) if classe_selecionada else None

            return {
                "fabricante": disjuntor_db.fabricante,
                "modelo": disjuntor_db.modelo,
                "corrente_nominal": disjuntor_db.in_a,
                "capacidade_interrupcao": disjuntor_db.icc_ka,
                "tensao_nominal": disjuntor_db.vn_kv_max,
                "tecnologia": disjuntor_db.meio_extincao,
                "nbi": nbi,
            }

    # Aula 4 - Prof. Armando
    # Fallback interno usando séries normalizadas (Mudanças 1, 2, 4 e 5)
    vn_selecionada = selecionar_tensao_nominal(tensao_kv)
    if vn_selecionada is None:
        return None

    in_selecionado = selecionar_corrente_nominal(corrente_projeto)
    if in_selecionado is None:
        return None

    icu_selecionado = selecionar_icu(icc_calculada)
    if icu_selecionado is None:
        return None

    nbi_selecionado = selecionar_nbi(vn_selecionada, solidamente_aterrado)

    # Catálogo de referência para associar fabricante/modelo/tecnologia
    catalogo = [
        {"fabricante": "ABB",       "modelo": "VD4",    "corrente_nominal": 630,  "capacidade_interrupcao": 25,   "tensao_nominal": 17.5, "tecnologia": "Vacuo"},
        {"fabricante": "Siemens",   "modelo": "Sion",   "corrente_nominal": 800,  "capacidade_interrupcao": 31.5, "tensao_nominal": 17.5, "tecnologia": "Vacuo"},
        {"fabricante": "Schneider", "modelo": "Evolis", "corrente_nominal": 1250, "capacidade_interrupcao": 40,   "tensao_nominal": 24,   "tecnologia": "Vacuo"},
        {"fabricante": "Eaton",     "modelo": "W-VACi", "corrente_nominal": 2000, "capacidade_interrupcao": 50,   "tensao_nominal": 17.5, "tecnologia": "Vacuo"},
    ]

    # Tenta associar um fabricante/modelo do catálogo que cubra os valores normalizados
    referencia = None
    for d in sorted(catalogo, key=lambda x: (x["corrente_nominal"], x["capacidade_interrupcao"])):
        if (d["corrente_nominal"] >= in_selecionado
                and d["capacidade_interrupcao"] >= icu_selecionado
                and d["tensao_nominal"] >= vn_selecionada):
            referencia = d
            break

    fabricante  = referencia["fabricante"]  if referencia else "A definir"
    modelo      = referencia["modelo"]      if referencia else "A definir"
    tecnologia  = referencia["tecnologia"]  if referencia else "Vacuo"

    return {
        "fabricante": fabricante,
        "modelo": modelo,
        "corrente_nominal": in_selecionado,         # série IN_SERIE_A
        "capacidade_interrupcao": icu_selecionado,  # série ICU_SERIE_KA
        "tensao_nominal": vn_selecionada,           # tabela TENSOES_NOMINAIS_KV
        "tecnologia": tecnologia,
        "nbi": nbi_selecionado,                     # tabela NBI_TABELA
    }
