import math

def corrente_trifasica(s_kva: float, v_kv: float) -> float:
    """
    Calcula a corrente nominal trifásica.
    I = S / (√3 × V)
    s_kva: Potência aparente em kVA
    v_kv: Tensão nominal em kV (fase-fase)
    Retorna a corrente em Amperes (A).
    """
    try:
        s_kva = float(s_kva)
        v_kv = float(v_kv)
    except (TypeError, ValueError):
        return 0.0

    if v_kv <= 0 or math.isnan(v_kv) or math.isinf(v_kv):
        return 0.0
    if s_kva < 0 or math.isnan(s_kva) or math.isinf(s_kva):
        return 0.0

    return s_kva / (math.sqrt(3) * v_kv)

def curto_por_transformador(s_kva: float, v_kv: float, z_pct: float) -> float:
    """
    Calcula a corrente de curto-circuito simétrica nos terminais de um transformador.
    Icc = (1 / (Z%/100)) × (S / (√3 × V))
    """
    try:
        z_pct = float(z_pct)
    except (TypeError, ValueError):
        return 0.0

    if z_pct <= 0 or math.isnan(z_pct) or math.isinf(z_pct):
        return 0.0

    i_nom = corrente_trifasica(s_kva, v_kv)
    return (1.0 / (z_pct / 100.0)) * i_nom

# Aula 4 - Prof. Armando
def icc_concessionaria(pcc_gva: float, tensao_kv: float) -> float:
    """
    Calcula a corrente de curto-circuito a partir da potência de curto-circuito
    fornecida pela concessionária.
    Icc = Pcc / (√3 × V)
    pcc_gva: Potência de curto-circuito em GVA
    tensao_kv: Tensão nominal em kV (fase-fase)
    Retorna a corrente em Amperes (A).
    """
    try:
        pcc_gva = float(pcc_gva)
        tensao_kv = float(tensao_kv)
    except (TypeError, ValueError):
        return 0.0

    if pcc_gva <= 0 or math.isnan(pcc_gva) or math.isinf(pcc_gva):
        return 0.0
    if tensao_kv <= 0 or math.isnan(tensao_kv) or math.isinf(tensao_kv):
        return 0.0

    # Icc = Pcc / (√3 × V)
    return (pcc_gva * 1e9) / (math.sqrt(3) * tensao_kv * 1e3)

def curto_equivalente(icc_fontes: list[float]) -> float:
    """
    Calcula o curto-circuito equivalente de múltiplas fontes em paralelo.
    Icc_eq = Soma(Icc_i)
    """
    if not icc_fontes:
        return 0.0

    icc_eq = 0.0
    for icc in icc_fontes:
        try:
            icc = float(icc)
            if not (math.isnan(icc) or math.isinf(icc) or icc < 0):
                icc_eq += icc
        except (TypeError, ValueError):
            pass
    return icc_eq
