from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict
from app.models.circuito import TipoCabo

class CircuitoBase(BaseModel):
    descricao: str
    tensao: float = 380
    potencia_kw: float
    fator_potencia: float = 0.85
    distancia_m: float
    tipo_cabo: TipoCabo = TipoCabo.CU_PVC
    temp_ambiente: float = 30
    fases: int = 3
    agrupamento: int = 1
    ordem: int = 0
    tag: Optional[str] = None
    from_barramento: Optional[str] = None
    to_equipamento: Optional[str] = None
    protection_device: Optional[str] = None
    modo_dimensionamento: str = "manual"
    modo_selecao_componentes: str = "manual"
    disjuntor_tensao_nominal: Optional[float] = None
    disjuntor_corrente_nominal: Optional[float] = None
    disjuntor_icu: Optional[float] = None
    disjuntor_curva: Optional[str] = None
    disjuntor_fabricante: Optional[str] = None
    corrente_ac_dc: str = "AC"
    potencia_kva: Optional[float] = None
    usar_kva_informado: bool = False
    fator_demanda: float = 1.0
    fator_eficiencia: float = 1.0
    metodo_instalacao: str = "TRAY"
    formacao: int = 1
    comprimento_real: Optional[float] = None
    queda_tensao_alimentador: float = 0.0
    isc_local: Optional[float] = None
    tempo_atuacao: Optional[float] = None
    revisao: Optional[str] = None
    nota_tecnica: Optional[str] = None
    # MT/AT optional fields
    classe_tensao_kv: Optional[float] = None
    nbi_kv: Optional[float] = None
    tafi_ka: Optional[float] = None
    sequencia_operacao: Optional[str] = None
    meio_extincao: Optional[str] = None
    tipo_acionamento: Optional[str] = None
    acessorios: Optional[dict] = None
    modelo: Optional[str] = None
    norma_referencia: Optional[str] = None

class CircuitoCreate(CircuitoBase):
    projeto_id: int

class CircuitoUpdate(CircuitoBase):
    # FIX: All fields Optional to support partial updates without 422 errors.
    # The frontend always sends complete payloads via normalizarPayload(), but
    # this makes the API robust to any partial-update client.
    descricao: Optional[str] = None
    potencia_kw: Optional[float] = None
    distancia_m: Optional[float] = None

class CircuitoRead(CircuitoCreate):
    id: int

    # --- Calculated fields (read-only, set by calcular_circuito) ---
    # FIX: Use exact ORM field names. Previous aliases like corrente_projeto_a
    # do not exist on the model and always returned None via from_attributes.
    corrente_nominal: Optional[float] = None
    corrente_projeto: Optional[float] = None
    corrente_corrigida: Optional[float] = None
    fator_k1: Optional[float] = None
    fator_k2: Optional[float] = None
    fator_k3: Optional[float] = None
    secao_mm2: Optional[float] = None
    disjuntor_a: Optional[float] = None
    queda_tensao_pct: Optional[float] = None
    queda_tensao_max: Optional[float] = None
    queda_tensao_acumulada: Optional[float] = None
    secao_pe_mm2: Optional[float] = None
    ampacidade: Optional[float] = None
    corrente_condutor: Optional[float] = None
    ampacidade_corrigida_total: Optional[float] = None
    tensao_fase: Optional[float] = None
    isc_cabo: Optional[float] = None
    secao_joule: Optional[float] = None
    impedancia_rdc: Optional[float] = None
    impedancia_rac: Optional[float] = None
    impedancia_xl: Optional[float] = None
    tipo_cabo_comercial: Optional[str] = None
    # Component selection results
    cabo_sugerido_secao: Optional[float] = None
    cabo_sugerido_tipo_comercial: Optional[str] = None
    cabo_sugerido_ampacidade: Optional[float] = None
    disjuntor_sugerido_in: Optional[float] = None
    disjuntor_sugerido_icu: Optional[float] = None
    disjuntor_sugerido_curva: Optional[str] = None
    selecao_componentes_status: Optional[str] = None
    selecao_componentes_justificativa: Optional[str] = None
    # Protection & validation results
    protecao_status: Optional[str] = None
    protecao_nota: Optional[str] = None
    protecao_avaliacao_status: Optional[str] = None
    protecao_verificacoes: Optional[Dict[str, Any]] = None
    validacao_status: Optional[str] = None
    validacao_mensagem: Optional[str] = None
    validacao_detalhes: Optional[str] = None
    # Final status
    status: Optional[str] = None
    status_final: Optional[str] = None
    resultado: Optional[Dict[str, Any]] = None
    criterios: Optional[Dict[str, Any]] = None
    decisao: Optional[Dict[str, Any]] = None
    memorial: Optional[Dict[str, Any]] = None
    alertas: Optional[List[Dict[str, Any]]] = None
    premissas: Optional[List[Dict[str, Any]]] = None
    limitacoes: Optional[List[str]] = None
    metadados_calculo: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)

class ImportarConfirmarPayload(BaseModel):
    projeto_id: int
    linhas: List[Dict[str, Any]]
    mapeamento_usuario: Optional[Dict[str, str]] = None
