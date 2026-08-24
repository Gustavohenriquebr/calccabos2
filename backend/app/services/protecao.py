"""
Serviço de validação de proteções elétricas.

Inclui:
  - validar_protecao_geral()      → disjuntor geral BT (In/Icu vs barramento/Icc trafo)
  - validar_protecao_circuito()   → disjuntor de circuito BT (Ib/Iz/Icu)
  - calcular_disjuntor_mtat()     → disjuntor MT/AT com NBI e TAFI (Aula 4 Prof. Armando)
"""
import math
from typing import Any, Dict, List, Optional

from app.services.status_utils import normalizar_status, numero_finito, status_mais_grave

# ---------------------------------------------------------------------------
# Tabelas normativas — Disjuntores MT/AT (Aula 4)
# ---------------------------------------------------------------------------

# Tensões nominais padronizadas dos disjuntores MT/AT (kV)
VN_NOMINAIS_MTAT: List[float] = [7.2, 15, 24.2, 36.2, 72.5, 92, 145, 242, 362, 460, 550]

# Correntes nominais padronizadas (A)
IN_PADRONIZADOS: List[float] = [400, 600, 800, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300]

# Capacidades de interrupção padronizadas (kA)
ICC_PADRONIZADOS: List[float] = [8, 10, 12.5, 16, 20, 25, 31.5, 40, 50, 63, 80, 100]

# NBI (kVp) e TAFI (kVef) por Vn nominal do disjuntor e tipo de aterramento
TABELA_NBI_TAFI: Dict[float, Dict[str, float]] = {
    7.2:  {"nbi_aterrado": 40,   "nbi_nao_aterrado": 60,   "tafi_aterrado": 20,  "tafi_nao_aterrado": 20},
    15:   {"nbi_aterrado": 95,   "nbi_nao_aterrado": 110,  "tafi_aterrado": 34,  "tafi_nao_aterrado": 34},
    24.2: {"nbi_aterrado": 125,  "nbi_nao_aterrado": 150,  "tafi_aterrado": 50,  "tafi_nao_aterrado": 50},
    36.2: {"nbi_aterrado": 150,  "nbi_nao_aterrado": 170,  "tafi_aterrado": 70,  "tafi_nao_aterrado": 70},
    72.5: {"nbi_aterrado": 325,  "nbi_nao_aterrado": 350,  "tafi_aterrado": 140, "tafi_nao_aterrado": 140},
    92:   {"nbi_aterrado": 380,  "nbi_nao_aterrado": 450,  "tafi_aterrado": 185, "tafi_nao_aterrado": 185},
    145:  {"nbi_aterrado": 550,  "nbi_nao_aterrado": 650,  "tafi_aterrado": 230, "tafi_nao_aterrado": 275},
    242:  {"nbi_aterrado": 850,  "nbi_nao_aterrado": 950,  "tafi_aterrado": 360, "tafi_nao_aterrado": 395},
    362:  {"nbi_aterrado": 1050, "nbi_nao_aterrado": 1175, "tafi_aterrado": 450, "tafi_nao_aterrado": 520},
    460:  {"nbi_aterrado": 1425, "nbi_nao_aterrado": 1550, "tafi_aterrado": 620, "tafi_nao_aterrado": 700},
}

# ---------------------------------------------------------------------------
# Helpers internos para MT/AT
# ---------------------------------------------------------------------------

def _prox_padronizado(valor: float, lista: List[float]) -> Optional[float]:
    """Retorna o menor valor da lista que seja >= valor."""
    for v in sorted(lista):
        if v >= valor:
            return v
    return None  # valor acima do máximo disponível


def _selecionar_vn_nominal(tensao_trabalho_kv: float) -> Optional[float]:
    """
    Retorna o menor Vn nominal padronizado tal que Vn_nominal > tensao_trabalho_kv.
    Ex: 88 kV de trabalho → 92 kV nominal.
    """
    for vn in sorted(VN_NOMINAIS_MTAT):
        if vn > tensao_trabalho_kv:
            return vn
    return None


def _calcular_icc_trafo(s_mva: float, z_percent: float, v_secundario_kv: float) -> float:
    """
    Icc_trafo = (1/z%) × S_MVA×10⁶ / (√3 × V_sec_kV×10³)   [kA]
    """
    if z_percent <= 0 or v_secundario_kv <= 0:
        return 0.0
    icc_a = (1.0 / (z_percent / 100.0)) * (s_mva * 1e6) / (math.sqrt(3) * v_secundario_kv * 1e3)
    return round(icc_a / 1000.0, 4)  # kA


def _calcular_icc_conc(scc_gva: float, v_trabalho_kv: float) -> float:
    """
    Icc_conc = Scc_GVA×10⁹ / (√3 × V_kV×10³)   [kA]
    """
    if v_trabalho_kv <= 0:
        return 0.0
    icc_a = (scc_gva * 1e9) / (math.sqrt(3) * v_trabalho_kv * 1e3)
    return round(icc_a / 1000.0, 4)  # kA


def _calcular_in(s_mva: float, v_trabalho_kv: float) -> float:
    """
    In_calc = S_MVA×10⁶ / (√3 × V_kV×10³)   [A]
    """
    if v_trabalho_kv <= 0:
        return 0.0
    return round((s_mva * 1e6) / (math.sqrt(3) * v_trabalho_kv * 1e3), 2)


def calcular_disjuntor_mtat(dados: Dict[str, Any]) -> Dict[str, Any]:
    """
    Dimensiona e valida disjuntor de média/alta tensão conforme Aula 4.

    Entradas esperadas no dict `dados`:
        tensao_trabalho_kv      (kV) — obrigatório
        s_mva                   (MVA) — potência vista pelo disjuntor
        z_percent               (%) — impedância do trafo (opcional)
        tipo_aterramento        "solidamente_aterrado" | "outros"
        scc_concessionaria_gva  (GVA) — Scc da concessionária (opcional)
        n_trafos_paralelo       int (padrão 1)
        crescimento_carga_pct   float % (padrão 0)
        tag                     str

    Retorno: dict com todos os campos calculados e status_final.
    """
    dados = dados or {}

    def _f(campo, pad=None):
        return numero_finito(dados.get(campo), pad)

    def _s(campo, pad=""):
        return str(dados.get(campo) or pad).strip()

    tag                  = _s("tag", "DJ-MT/AT")
    v_trabalho_kv        = _f("tensao_trabalho_kv") or _f("vn_trabalho_kv")
    s_mva                = _f("s_mva")
    z_percent            = _f("z_percent")
    tipo_aterramento     = _s("tipo_aterramento", "solidamente_aterrado")
    scc_gva              = _f("scc_concessionaria_gva")
    n_trafos             = max(int(_f("n_trafos_paralelo") or 1), 1)
    crescimento_pct      = _f("crescimento_carga_pct", 0.0)
    observacao           = _s("observacao")

    status = "OK"
    itens: List[Dict[str, str]] = []

    def _add(criterio, st, msg):
        itens.append({"criterio": criterio, "status": normalizar_status(st), "mensagem": msg})

    # ------------------------------------------------------------------
    # 1. Tensão nominal do disjuntor
    # ------------------------------------------------------------------
    vn_nominal_kv: Optional[float] = None
    if v_trabalho_kv is None:
        _add("Vn nominal", "ALERTA", "Tensão de trabalho não informada; Vn nominal não calculável.")
        status = status_mais_grave(status, "ALERTA")
    else:
        vn_nominal_kv = _selecionar_vn_nominal(v_trabalho_kv)
        if vn_nominal_kv is None:
            _add("Vn nominal", "ALERTA",
                 f"Tensão de trabalho {v_trabalho_kv} kV acima das tabelas normativas disponíveis.")
            status = status_mais_grave(status, "ALERTA")

    # ------------------------------------------------------------------
    # 2. Corrente nominal — aplicar crescimento de carga
    # ------------------------------------------------------------------
    in_calculado_a: Optional[float] = None
    in_dj_a: Optional[float] = None
    if s_mva is not None and v_trabalho_kv:
        s_dim = s_mva * (1.0 + (crescimento_pct or 0.0) / 100.0)
        in_calculado_a = _calcular_in(s_dim, v_trabalho_kv)
        in_dj_a = _prox_padronizado(in_calculado_a, IN_PADRONIZADOS)
        if in_dj_a is None:
            _add("In padronizado", "ALERTA",
                 f"In calculado ({in_calculado_a:.1f}A) acima do máximo padronizado (6300A).")
            status = status_mais_grave(status, "ALERTA")
    else:
        _add("Corrente nominal", "ALERTA", "S_MVA ou tensão de trabalho ausente; In não calculável.")
        status = status_mais_grave(status, "ALERTA")

    # ------------------------------------------------------------------
    # 3. Corrente de curto-circuito
    # ------------------------------------------------------------------
    icc_calculado_ka: Optional[float] = None
    fonte_icc = "—"

    if scc_gva is not None and v_trabalho_kv:
        # Prioritário: Icc pela concessionária
        icc_calculado_ka = _calcular_icc_conc(scc_gva, v_trabalho_kv)
        fonte_icc = f"concessionária (Scc={scc_gva}GVA)"
    elif z_percent is not None and s_mva is not None and v_trabalho_kv:
        # Fallback: Icc pelo transformador
        icc_1trafo = _calcular_icc_trafo(s_mva, z_percent, v_trabalho_kv)
        icc_calculado_ka = round(icc_1trafo * n_trafos, 4)
        fonte_icc = f"trafo {n_trafos}× (Z={z_percent}%)"
    else:
        _add("Icc", "ALERTA", "Scc da concessionária e Z% do trafo ausentes; Icc não calculável.")
        status = status_mais_grave(status, "ALERTA")

    icc_dj_ka: Optional[float] = None
    if icc_calculado_ka is not None:
        icc_dj_ka = _prox_padronizado(icc_calculado_ka, ICC_PADRONIZADOS)
        if icc_dj_ka is None:
            _add("Icc padronizado", "CRITICO",
                 f"Icc calculado ({icc_calculado_ka:.3f}kA) acima do máximo padronizado (100kA).")
            status = status_mais_grave(status, "CRITICO")

    # ------------------------------------------------------------------
    # 4. NBI e TAFI pela tabela
    # ------------------------------------------------------------------
    nbi_kvp: Optional[float] = None
    tafi_kvef: Optional[float] = None
    chave_aterr = (
        "aterrado"
        if "solidamente" in tipo_aterramento.lower() or tipo_aterramento.lower() in ("aterrado", "solido")
        else "nao_aterrado"
    )

    if vn_nominal_kv is not None:
        tab = TABELA_NBI_TAFI.get(vn_nominal_kv)
        if tab:
            nbi_kvp  = tab[f"nbi_{chave_aterr}"]
            tafi_kvef = tab[f"tafi_{chave_aterr}"]
        else:
            _add("NBI/TAFI", "ALERTA",
                 f"Vn={vn_nominal_kv} kV não encontrado na tabela NBI/TAFI.")
            status = status_mais_grave(status, "ALERTA")

    # ------------------------------------------------------------------
    # 5. Status final
    # ------------------------------------------------------------------
    if not itens:
        _add("Disjuntor MT/AT", "OK",
             f"Disjuntor MT/AT dimensionado: Vn={vn_nominal_kv}kV, "
             f"In={in_dj_a}A, Icc={icc_dj_ka}kA — via {fonte_icc}.")

    status_final = normalizar_status(status)
    mensagem = next(
        (i["mensagem"] for i in itens if i["status"] == status_final),
        itens[0]["mensagem"]
    )

    return {
        # Entradas
        "tag":                      tag,
        "tipo_disjuntor":           "MT/AT",
        "tensao_trabalho_kv":       v_trabalho_kv,
        "vn_trabalho_kv":           v_trabalho_kv,
        "s_mva":                    s_mva,
        "z_percent":                z_percent,
        "tipo_aterramento":         tipo_aterramento,
        "scc_concessionaria_gva":   scc_gva,
        "n_trafos_paralelo":        n_trafos,
        "crescimento_carga_pct":    crescimento_pct,
        "observacao":               observacao,
        # Resultados
        "vn_nominal_kv":            vn_nominal_kv,
        "in_calculado_a":           in_calculado_a,
        "in_dj_a":                  in_dj_a,
        "icc_calculado_ka":         icc_calculado_ka,
        "icc_dj_ka":                icc_dj_ka,
        "fonte_icc":                fonte_icc,
        "nbi_kvp":                  nbi_kvp,
        "tafi_kvef":                tafi_kvef,
        # Status
        "status_final":             status_final,
        "mensagem":                 mensagem,
        "itens":                    itens,
        # Compatibilidade com campo legado
        "status":                   status_final,
    }


def _float(valor: Any, padrao: Optional[float] = None) -> Optional[float]:
    return numero_finito(valor, padrao)


def _str(valor: Any, padrao: str = "") -> str:
    return str(valor or padrao).strip()


def _status_mais_grave(atual: str, novo: str) -> str:
    return status_mais_grave(atual, novo)


def _nota(status: str, mensagem: str) -> Dict[str, str]:
    return {"status": status, "mensagem": mensagem}


def _dados_geral(dados: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(dados, dict):
        return {}
    geral = dados.get("geral")
    if isinstance(geral, dict):
        return geral
    disjuntor_geral = dados.get("disjuntor_geral")
    if isinstance(disjuntor_geral, dict):
        return disjuntor_geral
    return dados


def _primeiro_numero(dados: Dict[str, Any], *campos: str) -> Optional[float]:
    for campo in campos:
        valor = _float(dados.get(campo))
        if valor is not None:
            return valor
    return None


def _primeiro_texto(dados: Dict[str, Any], padrao: str, *campos: str) -> str:
    for campo in campos:
        valor = _str(dados.get(campo))
        if valor:
            return valor
    return padrao


def validar_protecao_geral(dados: Dict[str, Any], transformador: Dict[str, Any]) -> Dict[str, Any]:
    dados = _dados_geral(dados)
    in_disjuntor = _primeiro_numero(dados, "in", "In", "corrente_nominal", "corrente_nominal_a", "disjuntor_corrente_nominal")
    icu = _primeiro_numero(dados, "icu", "Icu", "icu_ka", "capacidade_interrupcao", "capacidade_interrupcao_ka", "disjuntor_icu")
    tag = _primeiro_texto(dados, "DJ-GERAL", "tag", "identificacao", "nome")
    tipo = _primeiro_texto(dados, "ACB", "tipo", "protection_device", "dispositivo").upper()
    vn = _primeiro_numero(dados, "vn", "Vn", "tensao_nominal", "tensao_nominal_v", "disjuntor_tensao_nominal")
    curva = _primeiro_texto(dados, "C", "curva", "curve").upper()
    fabricante = _primeiro_texto(dados, "", "fabricante", "manufacturer")
    corrente_barramento = _float(transformador.get("corrente_nominal_secundario"))
    icc_transformador = _float(transformador.get("corrente_curto_secundario_ka"))

    status = "OK"
    notas = []

    if in_disjuntor is None or in_disjuntor <= 0:
        notas.append(_nota("ALERTA", "Corrente nominal In do disjuntor geral não informada."))
        status = _status_mais_grave(status, "ALERTA")
    elif corrente_barramento is None or corrente_barramento <= 0:
        notas.append(_nota("ALERTA", "Corrente do barramento não disponível; cadastre o transformador para validar In."))
        status = _status_mais_grave(status, "ALERTA")
    elif in_disjuntor < corrente_barramento:
        notas.append(_nota("CRITICO", f"Disjuntor geral inadequado: In ({in_disjuntor:g}A) menor que corrente do barramento ({corrente_barramento:.2f}A)."))
        status = _status_mais_grave(status, "CRITICO")
    elif in_disjuntor < corrente_barramento * 1.00:
        notas.append(_nota("ALERTA", f"Margem baixa: In ({in_disjuntor:g}A) próximo da corrente do barramento ({corrente_barramento:.2f}A)."))
        status = _status_mais_grave(status, "ALERTA")

    if icu is None or icu <= 0:
        notas.append(_nota("ALERTA", "Capacidade de interrupção Icu do disjuntor geral não informada."))
        status = _status_mais_grave(status, "ALERTA")
    elif icc_transformador is None or icc_transformador <= 0:
        notas.append(_nota("ALERTA", "Icc do transformador não disponível; cadastre Z% e potência para validar Icu."))
        status = _status_mais_grave(status, "ALERTA")
    elif icu < icc_transformador:
        notas.append(_nota("CRITICO", f"Disjuntor geral inadequado: Icu ({icu:g}kA) menor que Icc do transformador ({icc_transformador:.2f}kA)."))
        status = _status_mais_grave(status, "CRITICO")
    elif icu < icc_transformador * 1.20:
        notas.append(_nota("ALERTA", f"Margem baixa: Icu ({icu:g}kA) próximo do Icc do transformador ({icc_transformador:.2f}kA)."))
        status = _status_mais_grave(status, "ALERTA")

    if not notas:
        notas.append(_nota("OK", "Disjuntor geral conforme para corrente do barramento e Icc do transformador."))

    return {
        "in": in_disjuntor,
        "icu": icu,
        "tag": tag,
        "tipo": tipo,
        "vn": vn,
        "curva": curva or "C",
        "fabricante": fabricante,
        "corrente_barramento": corrente_barramento,
        "icc_transformador": icc_transformador,
        "status": normalizar_status(status),
        "mensagem": next((n["mensagem"] for n in notas if n["status"] == status), notas[0]["mensagem"]),
        "itens": [{**nota, "status": normalizar_status(nota.get("status"))} for nota in notas],
    }


def validar_protecao_circuito(circuito: Any) -> Dict[str, Any]:
    ib = _float(getattr(circuito, "corrente_projeto", None) or getattr(circuito, "corrente_nominal", None))
    formacao = max(int(_float(getattr(circuito, "formacao", None), 1) or 1), 1)
    iz_base = _float(
        getattr(circuito, "cabo_sugerido_ampacidade", None)
        or getattr(circuito, "corrente_condutor", None)
        or getattr(circuito, "ampacidade", None)
    )
    iz = iz_base * formacao if iz_base is not None else None
    in_disjuntor = _float(
        getattr(circuito, "disjuntor_corrente_nominal", None)
        or getattr(circuito, "disjuntor_sugerido_in", None)
        or getattr(circuito, "disjuntor_a", None)
    )
    icu = _float(getattr(circuito, "disjuntor_icu", None) or getattr(circuito, "disjuntor_sugerido_icu", None))
    icc = _float(getattr(circuito, "isc_local", None))
    curva = _str(getattr(circuito, "disjuntor_curva", None) or getattr(circuito, "disjuntor_sugerido_curva", None), "C").upper()
    # NBR 5410 §5.3.4.2 — Icc mínimo no fim da linha (calculado em _isc_no_fim via calculo.py)
    isc_cabo = _float(getattr(circuito, "isc_cabo", None))

    status = "OK"
    notas = []

    if in_disjuntor is None or in_disjuntor <= 0:
        notas.append(_nota("CRITICO", "In do disjuntor não informado."))
        status = _status_mais_grave(status, "CRITICO")
    elif ib is None or ib <= 0:
        notas.append(_nota("ALERTA", "Ib não disponível para validar In >= Ib."))
        status = _status_mais_grave(status, "ALERTA")
    elif in_disjuntor < ib:
        notas.append(_nota("CRITICO", f"In ({in_disjuntor:g}A) menor que Ib ({ib:.2f}A)."))
        status = _status_mais_grave(status, "CRITICO")

    if in_disjuntor is not None and iz is not None and in_disjuntor > iz:
        notas.append(_nota("CRITICO", f"In ({in_disjuntor:g}A) maior que Iz/capacidade do cabo ({iz:.2f}A)."))
        status = _status_mais_grave(status, "CRITICO")
    elif iz is None:
        notas.append(_nota("ALERTA", "Iz/capacidade do cabo não disponível para validar In <= Iz."))
        status = _status_mais_grave(status, "ALERTA")

    if icu is None or icu <= 0:
        notas.append(_nota("ALERTA", "Icu do disjuntor não informado."))
        status = _status_mais_grave(status, "ALERTA")
    elif icc is None or icc <= 0:
        notas.append(_nota("ALERTA", "Icc do circuito não disponível para validar Icu >= Icc."))
        status = _status_mais_grave(status, "ALERTA")
    elif icu < icc:
        notas.append(_nota("CRITICO", f"Icu ({icu:g}kA) menor que Icc ({icc:.2f}kA)."))
        status = _status_mais_grave(status, "CRITICO")

    # ── Verificação B — NBR 5410 seção 5.3.4.2 ──────────────────────────────
    # Garante que o dispositivo de proteção dispara magneticamente em curto
    # ocorrido no fim do condutor (ponto mais desfavorável do circuito).
    # Critério: Icc_mínimo_fim_da_linha >= In × 1,45
    if in_disjuntor is not None and in_disjuntor > 0 and isc_cabo is not None and isc_cabo > 0:
        icc_min_a = isc_cabo * 1000          # kA → A
        limiar_b  = in_disjuntor * 1.45      # margem de 45% exigida pela norma
        if icc_min_a < limiar_b:
            notas.append(_nota(
                "CRITICO",
                f"VER_B (NBR 5410 §5.3.4.2): In×1,45 ({limiar_b:.1f}A) > "
                f"Icc_fim ({icc_min_a:.1f}A) — "
                f"disjuntor pode não disparar magneticamente em curto no fim da linha."
            ))
            status = _status_mais_grave(status, "CRITICO")

    if not notas:
        notas.append(_nota("OK", "Proteção do circuito conforme: In >= Ib, In <= Iz, Icu >= Icc e Verificação B (NBR 5410 §5.3.4.2)."))

    return {
        "id": getattr(circuito, "id", None),
        "tag": getattr(circuito, "tag", None),
        "descricao": getattr(circuito, "descricao", None),
        "protection_device": getattr(circuito, "protection_device", None),
        "in": in_disjuntor,
        "icu": icu,
        "curva": curva,
        "ib": ib,
        "iz": iz,
        "icc": icc,
        "isc_cabo": isc_cabo,
        "status": normalizar_status(status),
        "mensagem": next((n["mensagem"] for n in notas if n["status"] == status), notas[0]["mensagem"]),
        "itens": [{**nota, "status": normalizar_status(nota.get("status"))} for nota in notas],
    }
