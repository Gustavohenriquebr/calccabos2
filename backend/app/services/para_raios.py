"""
Serviço de cálculo de para-raios de linha.
Referência normativa: Aula 5 — Prof. Armando, Unisanta (09/03/2026)
Fórmulas:
    MP1 = ((1,15 × NBI) / Disruptiva_Frente_Onda - 1) × 100  → critério > 20%
    MP2 = (NBI / Residual_20kA - 1) × 100                    → critério > 20%
    MP3 = ((0,83 × NBI) / Disruptiva_FI - 1) × 100           → critério > 15%
"""
from typing import Any, Dict, List, Optional

from app.services.status_utils import normalizar_status, numero_finito, status_mais_grave

# ---------------------------------------------------------------------------
# Tabelas normativas embutidas
# ---------------------------------------------------------------------------

# Tensões nominais comerciais disponíveis (kVef)
VN_COMERCIAIS: List[float] = [7.5, 10.5, 12, 15, 18, 60, 72, 96, 108, 120, 138]

# Classes de tensão VMAX (kV fase-fase máxima de operação)
CLASSES_VMAX: List[float] = [15, 36.2, 72.5, 92, 145, 242, 362, 460, 550]

# Distância específica de escoamento por nível de poluição (mm/kV)
D_ESPECIFICA: Dict[str, float] = {
    "leve":         16.0,
    "medio":        20.0,
    "pesado":       25.0,
    "muito_pesado": 31.0,
}

# Correntes nominais de descarga disponíveis (kA)
CORRENTES_NOMINAIS_KA: List[float] = [5.0, 10.0, 15.0, 20.0, 40.0]

# Características elétricas por Vn do para-raios (kVef → kVp ou kVef)
# Colunas: disruptiva_frente_onda | residual_10ka | residual_20ka | disruptiva_fi
TABELA_PARARAIOS: Dict[float, Dict[str, float]] = {
    7.5:  {"disruptiva_frente_onda": 26,  "residual_10ka": 24,  "residual_20ka": 27,  "disruptiva_fi": 13},
    10.5: {"disruptiva_frente_onda": 37,  "residual_10ka": 34,  "residual_20ka": 38,  "disruptiva_fi": 19},
    12:   {"disruptiva_frente_onda": 40,  "residual_10ka": 39,  "residual_20ka": 43,  "disruptiva_fi": 21},
    15:   {"disruptiva_frente_onda": 50,  "residual_10ka": 48,  "residual_20ka": 54,  "disruptiva_fi": 26},
    18:   {"disruptiva_frente_onda": 60,  "residual_10ka": 58,  "residual_20ka": 65,  "disruptiva_fi": 32},
    60:   {"disruptiva_frente_onda": 171, "residual_10ka": 180, "residual_20ka": 195, "disruptiva_fi": 105},
    72:   {"disruptiva_frente_onda": 196, "residual_10ka": 216, "residual_20ka": 234, "disruptiva_fi": 126},
    96:   {"disruptiva_frente_onda": 252, "residual_10ka": 288, "residual_20ka": 312, "disruptiva_fi": 168},
    108:  {"disruptiva_frente_onda": 297, "residual_10ka": 324, "residual_20ka": 351, "disruptiva_fi": 190},
    120:  {"disruptiva_frente_onda": 330, "residual_10ka": 360, "residual_20ka": 390, "disruptiva_fi": 218},
    138:  {"disruptiva_frente_onda": 380, "residual_10ka": 414, "residual_20ka": 449, "disruptiva_fi": 254},
}

# NBI dos equipamentos protegidos por classe de tensão VMAX (kVp)
TABELA_NBI_EQUIPAMENTO: Dict[float, Dict[str, float]] = {
    15:   {"aterrado": 95,   "nao_aterrado": 110},
    36.2: {"aterrado": 150,  "nao_aterrado": 170},
    72.5: {"aterrado": 325,  "nao_aterrado": 350},
    92:   {"aterrado": 380,  "nao_aterrado": 450},
    145:  {"aterrado": 550,  "nao_aterrado": 650},
    242:  {"aterrado": 850,  "nao_aterrado": 950},
    362:  {"aterrado": 1050, "nao_aterrado": 1175},
    460:  {"aterrado": 1425, "nao_aterrado": 1550},
}

# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------

def _float(valor: Any, padrao: Optional[float] = None) -> Optional[float]:
    return numero_finito(valor, padrao)


def _str(valor: Any, padrao: str = "") -> str:
    return str(valor or padrao).strip()


def _round(valor: Optional[float], casas: int = 2) -> Optional[float]:
    return round(valor, casas) if valor is not None else None


def _item(criterio: str, status: str, mensagem: str) -> Dict[str, str]:
    return {"criterio": criterio, "status": normalizar_status(status), "mensagem": mensagem}


def _selecionar_vmax(tensao_sistema_kv: float) -> float:
    """Retorna o menor VMAX da tabela de classes que seja >= tensao_sistema_kv."""
    for classe in sorted(CLASSES_VMAX):
        if classe >= tensao_sistema_kv:
            return classe
    return CLASSES_VMAX[-1]


def _selecionar_vn_comercial(vn_calculado: float) -> float:
    """Retorna o menor Vn comercial >= vn_calculado."""
    for vn in sorted(VN_COMERCIAIS):
        if vn >= vn_calculado:
            return vn
    return VN_COMERCIAIS[-1]


def _calcular_fa(tipo_aterramento: str) -> float:
    """
    FA = 0.8 para neutro solidamente aterrado.
    FA = 1.0 para neutro isolado, aterrado por resistência ou delta.
    """
    t = _str(tipo_aterramento).lower()
    if t in ("solidamente_aterrado", "solido", "aterrado_solido", "solidamente aterrado"):
        return 0.8
    return 1.0


def _calcular_kd(diametro_medio_mm: Optional[float]) -> float:
    """
    kD por diâmetro médio do invólucro:
      < 300  → 1.0
      300–499 → 1.1
      ≥ 500  → 1.2
    """
    if diametro_medio_mm is None:
        return 1.0
    d = float(diametro_medio_mm)
    if d < 300:
        return 1.0
    if d < 500:
        return 1.1
    return 1.2


def _selecionar_nbi(vmax_kv: float, tipo_aterramento: str) -> Optional[float]:
    """Busca NBI na tabela pela classe VMAX mais próxima acima."""
    chave_aterr = "aterrado" if _calcular_fa(tipo_aterramento) == 0.8 else "nao_aterrado"
    for classe in sorted(TABELA_NBI_EQUIPAMENTO.keys()):
        if classe >= vmax_kv:
            return TABELA_NBI_EQUIPAMENTO[classe][chave_aterr]
    return None


def _status_margem(mp: float, criterio: float) -> str:
    """
    OK      → mp > criterio
    ALERTA  → 0 < mp <= criterio
    CRITICO → mp <= 0
    """
    if mp > criterio:
        return "OK"
    if mp > 0:
        return "ALERTA"
    return "CRITICO"


def _corrente_nominal_padrao(vmax_kv: float, corrente_informada: Optional[float]) -> float:
    """
    Valida a corrente informada. Para VMAX >= 72.5 kV nunca usar 5 kA.
    Se não informada, sugere 10 kA para sistemas >= 72.5 kV, 5 kA abaixo.
    """
    if corrente_informada is not None and corrente_informada in CORRENTES_NOMINAIS_KA:
        if vmax_kv >= 72.5 and corrente_informada == 5.0:
            return 10.0  # força mínimo de 10 kA
        return corrente_informada
    return 10.0 if vmax_kv >= 72.5 else 5.0


# ---------------------------------------------------------------------------
# Função principal
# ---------------------------------------------------------------------------

def calcular_para_raios(dados: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calcula para-raios de linha conforme Aula 5 (Prof. Armando, Unisanta).
    Todos os campos novos são adicionados ao dict de retorno sem remover
    as chaves legadas, garantindo compatibilidade com projetos existentes.
    """
    dados = dados or {}

    # ------------------------------------------------------------------
    # 1. Entradas brutas (compatibilidade com campos legados e novos)
    # ------------------------------------------------------------------
    tensao_sistema_kv  = _float(dados.get("tensao_sistema_kv") or dados.get("tensao_trabalho_sistema"))
    tipo_aterramento   = _str(dados.get("tipo_aterramento") or dados.get("tipo_aterramento_sistema"), "solidamente_aterrado")
    nivel_poluicao     = _str(dados.get("nivel_poluicao"), "medio")
    diametro_medio_mm  = _float(dados.get("diametro_medio_mm"))
    corrente_inf_ka    = _float(dados.get("corrente_nominal_ka") or dados.get("corrente_nominal_descarga"))
    # NBI pode ser informado manualmente (sobrescreve tabela)
    nbi_manual         = _float(dados.get("nbi_equipamento_kvp") or dados.get("nbi_equipamento_protegido"))

    status = "OK"
    itens: List[Dict[str, str]] = []

    # ------------------------------------------------------------------
    # 2. Fator de Aterramento (FA)
    # ------------------------------------------------------------------
    fa = _calcular_fa(tipo_aterramento)

    # ------------------------------------------------------------------
    # 3. Classe de tensão VMAX
    # ------------------------------------------------------------------
    if tensao_sistema_kv is None:
        # Fallback para campo legado
        vmax = _float(dados.get("classe_tensao_vmax"))
    else:
        vmax = _selecionar_vmax(tensao_sistema_kv)

    if vmax is None:
        itens.append(_item("Vn mínimo", "ALERTA",
            "Tensão do sistema não informada; não é possível calcular Vn mínimo."))
        status = status_mais_grave(status, "ALERTA")

    # ------------------------------------------------------------------
    # 4. Vn calculado e Vn comercial
    # ------------------------------------------------------------------
    vn_calculado  = round(fa * vmax, 3) if vmax is not None else None
    vn_comercial  = _selecionar_vn_comercial(vn_calculado) if vn_calculado is not None else None

    # Compatibilidade: se usuário informou Vn manualmente, usar como override
    vn_manual = _float(dados.get("tensao_nominal_escolhida_vn") or dados.get("vn_comercial_kv"))
    if vn_manual is not None:
        vn_comercial = vn_manual

    if vn_comercial is None:
        itens.append(_item("Vn comercial", "ALERTA",
            "Não foi possível selecionar Vn comercial; verifique a tensão do sistema."))
        status = status_mais_grave(status, "ALERTA")
    elif vn_calculado is not None and vn_comercial < vn_calculado:
        itens.append(_item("Vn comercial", "CRITICO",
            f"Vn comercial ({vn_comercial} kV) menor que Vn mínimo calculado ({vn_calculado:.3f} kV)."))
        status = status_mais_grave(status, "CRITICO")

    # ------------------------------------------------------------------
    # 5. Corrente nominal padronizada
    # ------------------------------------------------------------------
    corrente_nominal_ka = _corrente_nominal_padrao(vmax or 0, corrente_inf_ka)

    # ------------------------------------------------------------------
    # 6. Distância de escoamento
    # ------------------------------------------------------------------
    kd = _calcular_kd(diametro_medio_mm)
    d_esp = D_ESPECIFICA.get(nivel_poluicao.lower().replace(" ", "_"))

    if d_esp is None:
        # Fallback para campo legado
        d_esp = _float(dados.get("distancia_especifica_escoamento"))

    desc_mm: Optional[float] = None
    if d_esp is not None and vmax is not None:
        desc_mm = round(d_esp * vmax * kd, 1)
    else:
        itens.append(_item("Escoamento", "ALERTA",
            "Nível de poluição ou Vmax ausente; distância de escoamento não calculada."))
        status = status_mais_grave(status, "ALERTA")

    # ------------------------------------------------------------------
    # 7. Características do para-raios (tabela por Vn comercial)
    # ------------------------------------------------------------------
    caract = TABELA_PARARAIOS.get(vn_comercial) if vn_comercial is not None else None

    # Fallback para campos legados (inseridos manualmente pelo usuário)
    disruptiva_frente_onda = (
        caract["disruptiva_frente_onda"] if caract
        else _float(dados.get("disruptiva_frente_onda") or dados.get("tensao_disruptiva"))
    )
    residual_20ka = (
        caract["residual_20ka"] if caract
        else _float(dados.get("residual_20ka") or dados.get("tensao_residual"))
    )
    disruptiva_fi = (
        caract["disruptiva_fi"] if caract
        else _float(dados.get("disruptiva_fi"))
    )

    if caract is None and vn_comercial is not None:
        itens.append(_item("Tabela para-raios", "ALERTA",
            f"Vn={vn_comercial} kV não encontrado na tabela; use campos manuais."))
        status = status_mais_grave(status, "ALERTA")

    # ------------------------------------------------------------------
    # 8. NBI do equipamento protegido
    # ------------------------------------------------------------------
    if nbi_manual is not None:
        nbi = nbi_manual
    elif vmax is not None:
        nbi = _selecionar_nbi(vmax, tipo_aterramento)
    else:
        nbi = None

    if nbi is None:
        itens.append(_item("NBI equipamento", "ALERTA",
            "NBI do equipamento protegido não determinado; informe manualmente."))
        status = status_mais_grave(status, "ALERTA")

    # ------------------------------------------------------------------
    # 9. Margens de proteção MP1, MP2, MP3
    # ------------------------------------------------------------------
    mp1 = mp2 = mp3 = None
    status_mp1 = status_mp2 = status_mp3 = "ALERTA"

    if nbi is not None and disruptiva_frente_onda is not None and disruptiva_frente_onda > 0:
        mp1 = round((1.15 * nbi / disruptiva_frente_onda - 1) * 100, 2)
        status_mp1 = _status_margem(mp1, 20.0)
        if status_mp1 != "OK":
            itens.append(_item("MP1 – Frente de onda",
                status_mp1,
                f"MP1={mp1:.1f}% (critério >20%). Disruptiva frente onda={disruptiva_frente_onda}kVp."))
            status = status_mais_grave(status, status_mp1)
    else:
        itens.append(_item("MP1 – Frente de onda", "ALERTA",
            "NBI ou tensão disruptiva de frente de onda ausente; MP1 não calculável."))
        status = status_mais_grave(status, "ALERTA")

    if nbi is not None and residual_20ka is not None and residual_20ka > 0:
        mp2 = round((nbi / residual_20ka - 1) * 100, 2)
        status_mp2 = _status_margem(mp2, 20.0)
        if status_mp2 != "OK":
            itens.append(_item("MP2 – Residual 20kA",
                status_mp2,
                f"MP2={mp2:.1f}% (critério >20%). Tensão residual 20kA={residual_20ka}kVp."))
            status = status_mais_grave(status, status_mp2)
    else:
        itens.append(_item("MP2 – Residual 20kA", "ALERTA",
            "NBI ou tensão residual 20kA ausente; MP2 não calculável."))
        status = status_mais_grave(status, "ALERTA")

    if nbi is not None and disruptiva_fi is not None and disruptiva_fi > 0:
        mp3 = round((0.83 * nbi / disruptiva_fi - 1) * 100, 2)
        status_mp3 = _status_margem(mp3, 15.0)
        if status_mp3 != "OK":
            itens.append(_item("MP3 – Freq. industrial",
                status_mp3,
                f"MP3={mp3:.1f}% (critério >15%). Disruptiva freq. ind.={disruptiva_fi}kVef."))
            status = status_mais_grave(status, status_mp3)
    else:
        itens.append(_item("MP3 – Freq. industrial", "ALERTA",
            "NBI ou tensão disruptiva de frequência industrial ausente; MP3 não calculável."))
        status = status_mais_grave(status, "ALERTA")

    # ------------------------------------------------------------------
    # 10. Mensagem consolidada e status final
    # ------------------------------------------------------------------
    if not itens:
        itens.append(_item("Para-raios de linha", "OK",
            "Para-raios validado: MP1, MP2 e MP3 atendem os critérios normativos."))

    status_final = normalizar_status(status)
    mensagem = next(
        (item["mensagem"] for item in itens if item["status"] == status_final),
        itens[0]["mensagem"]
    )

    # ------------------------------------------------------------------
    # 11. Retorno — mantém chaves legadas + adiciona chaves novas
    # ------------------------------------------------------------------
    return {
        # ── Chaves legadas (não renomear) ──
        "tag":                          _str(dados.get("tag")),
        "ponto_instalacao":             _str(dados.get("ponto_instalacao")),
        "tensao_trabalho_sistema":      tensao_sistema_kv,
        "classe_tensao_vmax":           vmax,
        "tipo_aterramento_sistema":     tipo_aterramento,
        "fator_aterramento_fa":         fa,
        "tensao_nominal_escolhida_vn":  vn_comercial,   # chave legada
        "corrente_nominal_descarga":    corrente_nominal_ka,
        "frequencia":                   _float(dados.get("frequencia"), 60.0),
        "distancia_especifica_escoamento": d_esp,
        "diametro_medio_fator_kd":      kd,
        "nbi_equipamento_protegido":    nbi,            # chave legada
        "tensao_residual":              residual_20ka,  # chave legada (≈ residual_20ka)
        "tensao_disruptiva":            disruptiva_frente_onda,  # chave legada
        "observacoes_tecnicas":         _str(dados.get("observacoes_tecnicas")),
        "vn_minimo":                    _round(vn_calculado, 3),
        "distancia_escoamento":         desc_mm,
        "margem_protecao_pct":          mp2,  # compatibilidade — mantém campo genérico
        "status":                       status_final,
        "mensagem":                     mensagem,
        "itens":                        itens,

        # ── Chaves novas (Aula 5) ──
        "tensao_sistema_kv":            tensao_sistema_kv,
        "tipo_aterramento":             tipo_aterramento,
        "vmax_classe_kv":               vmax,
        "fa":                           fa,
        "vn_calculado_kv":              _round(vn_calculado, 3),
        "vn_comercial_kv":              vn_comercial,
        "corrente_nominal_ka":          corrente_nominal_ka,
        "nivel_poluicao":               nivel_poluicao,
        "diametro_medio_mm":            diametro_medio_mm,
        "kd":                           kd,
        "desc_mm":                      desc_mm,
        "nbi_equipamento_kvp":          nbi,
        "disruptiva_frente_onda":       disruptiva_frente_onda,
        "residual_20ka":                residual_20ka,
        "disruptiva_fi":                disruptiva_fi,
        "mp1_pct":                      mp1,
        "mp2_pct":                      mp2,
        "mp3_pct":                      mp3,
        "status_mp1":                   status_mp1,
        "status_mp2":                   status_mp2,
        "status_mp3":                   status_mp3,
        "status_final":                 status_final,
    }
