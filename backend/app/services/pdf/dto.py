# backend/app/services/pdf/dto.py
"""Typed DTOs for the CalcCabos PDF / Excel / IA layer.

FASE 6 ADDITIONS
----------------
* ``CircuitoDTO`` – flat, serialisable representation of one circuit.
* ``ProtecaoDTO`` – protection device data (disjuntor/fusível).
* ``AmpacidadeDTO`` – cable sizing and ampacity data.
* ``QuedaTensaoDTO`` – voltage drop data.
* ``IccDTO`` – short-circuit current data.
* ``DotDict`` – dict subclass that also supports attribute access, allowing
  existing code using ``c.tag`` to continue working with DTO objects.

Design principles
-----------------
* All fields use Python primitives (str, int, float, list, dict) so that
  the DTO is JSON-serialisable and safely passable to AI / dashboard layers.
* ``DotDict`` enables a smooth migration: sections written against ORM attrs
  (``c.tag``) continue to work without modification against ``CircuitoDTO``
  instances.
* ``total=False`` lets callers omit optional fields.
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional
try:
    from typing import TypedDict
except ImportError:
    from typing_extensions import TypedDict  # type: ignore


# ---------------------------------------------------------------------------
# DotDict — dict with attribute-style access
# ---------------------------------------------------------------------------

class DotDict(dict):
    """dict subclass with attribute-access support.

    Allows both ``d["key"]`` and ``d.key`` so that sections written against
    ORM attribute access continue to work with CircuitoDTO objects.

    ``None`` is returned for missing keys (never raises AttributeError).
    """
    __getattr__ = dict.get          # type: ignore[assignment]
    __setattr__ = dict.__setitem__  # type: ignore[assignment]
    __delattr__ = dict.__delitem__  # type: ignore[assignment]

    def __repr__(self):
        return f"DotDict({dict.__repr__(self)})"


# ---------------------------------------------------------------------------
# Sub-DTOs (TypedDicts for type-checking / IDE support)
# ---------------------------------------------------------------------------

class ProtecaoDTO(TypedDict, total=False):
    """Protection device (circuit breaker / fuse) data."""
    device: Optional[str]               # protection_device field
    tensao_nominal: Optional[float]     # disjuntor_tensao_nominal
    curva: Optional[str]                # disjuntor_curva
    corrente_nominal: Optional[float]   # disjuntor_corrente_nominal or disjuntor_a
    icu: Optional[float]                # disjuntor_icu
    status: Optional[str]               # protecao_status
    nota: Optional[str]                 # protecao_nota
    # Automatic selection
    disjuntor_sugerido_in: Optional[float]
    disjuntor_sugerido_icu: Optional[float]
    disjuntor_sugerido_curva: Optional[str]


class AmpacidadeDTO(TypedDict, total=False):
    """Cable sizing and ampacity data."""
    corrente_condutor: Optional[float]
    ampacidade: Optional[float]
    formacao: Optional[int]
    secao_mm2: Optional[float]
    secao_pe_mm2: Optional[float]
    tipo_cabo: Optional[str]
    tipo_cabo_comercial: Optional[str]
    metodo_instalacao: Optional[str]
    fator_k1: Optional[float]
    fator_k2: Optional[float]
    fator_k3: Optional[float]
    cabo_sugerido_tipo_comercial: Optional[str]
    cabo_sugerido_ampacidade: Optional[float]
    ok: Optional[bool]


class QuedaTensaoDTO(TypedDict, total=False):
    """Voltage drop data."""
    pct: Optional[float]            # queda_tensao_pct
    acumulada: Optional[float]      # queda_tensao_acumulada
    calculada: Optional[float]      # resolved value: acumulada or pct
    max: Optional[float]            # queda_tensao_max
    ok: Optional[bool]
    impedancia_rdc: Optional[float]
    impedancia_rac: Optional[float]
    impedancia_xl: Optional[float]
    distancia_m: Optional[float]
    comprimento_real: Optional[float]


class IccDTO(TypedDict, total=False):
    """Short-circuit current data."""
    isc_local: Optional[float]
    isc_cabo: Optional[float]
    tempo_atuacao: Optional[float]


class CircuitoDTO(TypedDict, total=False):
    """Complete, serialisable representation of one circuit.

    Added MT/AT fields (nullable) and legacy aliases for backward compatibility.
    """
    # --- Identification ---
    id: Optional[int]
    tag: Optional[str]
    descricao: Optional[str]
    tag_ou_descricao: str           # tag if set, else descricao (pre-resolved)
    from_barramento: Optional[str]
    to_equipamento: Optional[str]
    revisao: Optional[str]
    nota_tecnica: Optional[str]
    protection_device: Optional[str]
    # Legacy aliases for protection device fields
    corrente_nominal_in: Optional[float] = None  # alias of disjuntor_corrente_nominal
    corrente_curto_icc: Optional[float] = None  # alias of isc_local
    duracao_curto_s: Optional[float] = None    # alias of tempo_atuacao
    fabricante: Optional[str] = None           # alias of disjuntor_fabricante
    # --- Electrical basics ---
    tensao: Optional[float]
    fases: Optional[int]
    corrente_ac_dc: Optional[str]
    potencia_kw: Optional[float]
    potencia_kva: Optional[float]
    fator_potencia: Optional[float]
    fator_eficiencia: Optional[float]
    fator_demanda: Optional[float]
    distancia_m: Optional[float]
    # MT/AT specific fields
    classe_tensao_kv: Optional[float]
    nbi_kv: Optional[float]
    tafi_ka: Optional[float]
    sequencia_operacao: Optional[str]
    meio_extincao: Optional[str]
    tipo_acionamento: Optional[str]
    acessorios: Optional[List[Any]]
    modelo: Optional[str]
    norma_referencia: Optional[str]
    # --- Corrente ---
    corrente_projeto: Optional[float]
    corrente_nominal: Optional[float]
    corrente_corrigida: Optional[float]
    ib: Optional[float]         # resolved: corrente_projeto or corrente_nominal
    ib_corr: Optional[float]    # corrente_corrigida
    # --- Status ---
    status: Optional[str]
    status_final: Optional[str]
    # --- Validação normativa ---
    validacao_status: Optional[str]
    validacao_mensagem: Optional[str]
    # --- Seleção automática ---
    modo_dimensionamento: Optional[str]
    modo_selecao_componentes: Optional[str]
    selecao_componentes_status: Optional[str]
    selecao_componentes_justificativa: Optional[str]
    # --- Protection (flat) ---
    disjuntor_tensao_nominal: Optional[float]
    disjuntor_curva: Optional[str]
    disjuntor_corrente_nominal: Optional[float]
    disjuntor_a: Optional[float]
    disjuntor_icu: Optional[float]
    protecao_status: Optional[str]
    protecao_nota: Optional[str]
    disjuntor_sugerido_in: Optional[float]
    disjuntor_sugerido_icu: Optional[float]
    disjuntor_sugerido_curva: Optional[str]
    # --- Ampacidade ---
    corrente_condutor: Optional[float]
    ampacidade: Optional[float]
    formacao: Optional[int]
    secao_mm2: Optional[float]
    secao_pe_mm2: Optional[float]
    tipo_cabo: Optional[str]
    tipo_cabo_comercial: Optional[str]
    metodo_instalacao: Optional[str]
    fator_k1: Optional[float]
    fator_k2: Optional[float]
    fator_k3: Optional[float]
    cabo_sugerido_tipo_comercial: Optional[float]
    cabo_sugerido_ampacidade: Optional[float]
    # --- Queda de tensão ---
    queda_tensao_pct: Optional[float]
    queda_tensao_acumulada: Optional[float]
    queda_tensao_max: Optional[float]
    queda_tensao_calculada: Optional[float]
    queda_tensao_ok: Optional[bool]
    impedancia_rdc: Optional[float]
    impedancia_rac: Optional[float]
    impedancia_xl: Optional[float]
    comprimento_real: Optional[float]
    # --- ICC ---
    isc_local: Optional[float]
    isc_cabo: Optional[float]
    tempo_atuacao: Optional[float]
    # Nested sub-DTOs
    _protecao: Optional[ProtecaoDTO]
    _ampacidade: Optional[AmpacidadeDTO]
    _queda_tensao: Optional[QuedaTensaoDTO]
    _icc: Optional[IccDTO]

    """Complete, serialisable representation of one circuit.

    At runtime, instances are ``DotDict`` objects (returned by
    ``data_provider.map_circuito_to_dto()``), which support both
    dict-style and attribute-style field access.
    """
    # --- Identification ---
    id: Optional[int]
    tag: Optional[str]
    descricao: Optional[str]
    tag_ou_descricao: str           # tag if set, else descricao (pre-resolved)
    from_barramento: Optional[str]
    to_equipamento: Optional[str]
    revisao: Optional[str]
    nota_tecnica: Optional[str]
    protection_device: Optional[str]

    # --- Electrical basics ---
    tensao: Optional[float]
    fases: Optional[int]
    corrente_ac_dc: Optional[str]
    potencia_kw: Optional[float]
    potencia_kva: Optional[float]
    fator_potencia: Optional[float]
    fator_eficiencia: Optional[float]
    fator_demanda: Optional[float]
    distancia_m: Optional[float]

    # --- Corrente ---
    corrente_projeto: Optional[float]
    corrente_nominal: Optional[float]
    corrente_corrigida: Optional[float]
    ib: Optional[float]         # resolved: corrente_projeto or corrente_nominal
    ib_corr: Optional[float]    # corrente_corrigida

    # --- Status ---
    status: Optional[str]
    status_final: Optional[str]     # pre-resolved final status (OK/ALERTA/CRITICO)

    # --- Validação normativa ---
    validacao_status: Optional[str]
    validacao_mensagem: Optional[str]

    # --- Seleção automática ---
    modo_dimensionamento: Optional[str]
    modo_selecao_componentes: Optional[str]
    selecao_componentes_status: Optional[str]
    selecao_componentes_justificativa: Optional[str]

    # --- Flat fields (mirrors of sub-DTO fields, for backward compat) ---
    # Protecao
    disjuntor_tensao_nominal: Optional[float]
    disjuntor_curva: Optional[str]
    disjuntor_corrente_nominal: Optional[float]
    disjuntor_a: Optional[float]
    disjuntor_icu: Optional[float]
    protecao_status: Optional[str]
    protecao_nota: Optional[str]
    disjuntor_sugerido_in: Optional[float]
    disjuntor_sugerido_icu: Optional[float]
    disjuntor_sugerido_curva: Optional[str]

    # Ampacidade
    corrente_condutor: Optional[float]
    ampacidade: Optional[float]
    formacao: Optional[int]
    secao_mm2: Optional[float]
    secao_pe_mm2: Optional[float]
    tipo_cabo: Optional[str]
    tipo_cabo_comercial: Optional[str]
    metodo_instalacao: Optional[str]
    fator_k1: Optional[float]
    fator_k2: Optional[float]
    fator_k3: Optional[float]
    cabo_sugerido_tipo_comercial: Optional[str]
    cabo_sugerido_ampacidade: Optional[float]

    # Queda de tensão
    queda_tensao_pct: Optional[float]
    queda_tensao_acumulada: Optional[float]
    queda_tensao_max: Optional[float]
    queda_tensao_calculada: Optional[float]   # pre-resolved value
    impedancia_rdc: Optional[float]
    impedancia_rac: Optional[float]
    impedancia_xl: Optional[float]
    comprimento_real: Optional[float]

    # ICC
    isc_local: Optional[float]
    isc_cabo: Optional[float]
    tempo_atuacao: Optional[float]

    # --- Nested sub-DTOs (for structured consumers like AI/dashboard) ---
    _protecao: Optional[ProtecaoDTO]
    _ampacidade: Optional[AmpacidadeDTO]
    _queda_tensao: Optional[QuedaTensaoDTO]
    _icc: Optional[IccDTO]


# ---------------------------------------------------------------------------
# Project-level DTOs (existing, kept for reference)
# ---------------------------------------------------------------------------

class ProjetoDTO(TypedDict, total=False):
    id: Optional[int]
    nome: str
    cliente: str
    tensao_ref: Optional[float]
    contexto: str
    revisao: str


class TransformadorDTO(TypedDict, total=False):
    potencia_kva: Optional[float]
    tensao_primaria: Optional[float]
    tensao_secundaria: Optional[float]
    tensao_primaria_formatada: Optional[str]
    tensao_secundaria_formatada: Optional[str]
    impedancia_percentual: Optional[float]
    corrente_nominal_primario: Optional[float]
    corrente_nominal_secundario: Optional[float]
    corrente_curto_secundario_ka: Optional[float]
    ligacao_primaria: Optional[str]
    ligacao_secundaria: Optional[str]
    relacao_transformacao: Optional[float]
    frequencia: Optional[float]
    observacoes: Optional[str]


class SistemaTrifasicoDTO(TypedDict, total=False):
    potencia_nominal_cargas_kw: Optional[float]
    potencia_ativa_eletrica_kw: Optional[float]
    potencia_ativa_kw: Optional[float]
    potencia_aparente_kva: Optional[float]
    potencia_reativa_kvar: Optional[float]
    tensao_linha: Optional[float]
    corrente_linha: Optional[float]
    fator_potencia: Optional[float]
    rendimento: Optional[float]
    ligacao: Optional[str]
    tensao_fase: Optional[float]
    corrente_fase: Optional[float]


class ContagemsDTO(TypedDict):
    total: int
    ok: int
    alertas: int
    criticos: int
    status: str


class ProtecoesContagemDTO(TypedDict):
    ok: int
    alerta: int
    critico: int


class ModulosContagemDTO(TypedDict):
    ok: int
    alerta: int
    critico: int


class ResumoGlobalDTO(TypedDict, total=False):
    total: int
    ok: int
    alertas: int
    criticos: int
    status: str
    protecoes: ProtecoesContagemDTO
    modulos: Dict[str, Any]
    criticos_modulos: List[str]
    alertas_modulos: List[str]
    modulos_contagem: ModulosContagemDTO
    motivo_status: str


class MetricasQuedaDTO(TypedDict, total=False):
    total: int
    qt_max: float
    fora_limite: int


class MetricasIccDTO(TypedDict, total=False):
    icc_max: float
    sem_icc: int


class MetricasAmpacidadeDTO(TypedDict, total=False):
    total: int
    ok: int
    alertas: int
    criticos: int


# ---------------------------------------------------------------------------
# Root DTO
# ---------------------------------------------------------------------------

class MemorialDTO(TypedDict, total=False):
    """Complete project memorial DTO.

    Produced by ``data_provider.get_memorial_data()`` and consumed by all
    PDF section renderers, the Excel exporter, and the AI assistant.

    FASE 6 additions:
    * ``circuitos_dto`` – list of DotDict (CircuitoDTO), ORM-free
    * DotDict instances support both ``c["tag"]`` and ``c.tag``
    """
    # Identification
    projeto: ProjetoDTO

    # Technical modules (computed)
    transformador: TransformadorDTO
    sistema_trifasico: SistemaTrifasicoDTO
    protecao_geral: Dict[str, Any]
    para_raios: Dict[str, Any]
    aterramento: Dict[str, Any]
    areas_classificadas: Dict[str, Any]
    modulos: Dict[str, Any]

    # Derived scalars
    tensao_secundaria: Optional[float]
    icc_max: float
    sem_icc: int
    qt_max: float
    automaticos: int
    selecao_critica: int
    fora_qt: int

    # Circuits — ORM objects (backward compat, will be removed in Fase 7)
    circuitos: List[Any]
    circuitos_alerta: List[Any]
    circuitos_criticos: List[Any]

    # Circuits — pure DTOs (Fase 6, ORM-free)
    circuitos_dto: List[DotDict]             # same ordering as circuitos
    circuitos_dto_alerta: List[DotDict]
    circuitos_dto_criticos: List[DotDict]

    # Aggregated statuses
    resumo_global: ResumoGlobalDTO
    circuito_resumo: ContagemsDTO
    protecoes_status: ProtecoesContagemDTO
    status_geral: str

    # Technical conclusions
    conclusoes_tecnicas: List[str]

    # AI-friendly / dashboard fields
    top_riscos: List[str]
    pendencias_criticas: List[str]
    alertas_modulos: List[str]
    resumo_executivo: str

    # KPI metric groups
    metricas_ampacidade: MetricasAmpacidadeDTO
    metricas_protecao: ProtecoesContagemDTO
    metricas_queda_tensao: MetricasQuedaDTO
    metricas_icc: MetricasIccDTO
