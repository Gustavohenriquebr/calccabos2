from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum, Boolean, Text, JSON, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum

class TipoCabo(str, enum.Enum):
    CU_PVC  = "CU-PVC"
    CU_XLPE = "CU-XLPE"
    AL_PVC  = "AL-PVC"
    AL_XLPE = "AL-XLPE"

class Circuito(Base):
    __tablename__ = "circuitos"

    id           = Column(Integer, primary_key=True, index=True)
    projeto_id   = Column(Integer, ForeignKey("projetos.id"), nullable=False)
    ordem        = Column(Integer, default=0)
    descricao    = Column(String(200), nullable=False)
    tensao       = Column(Float, default=380)
    potencia_kw  = Column(Float, nullable=False)
    # --- MT/AT fields (nullable) ---
    classe_tensao_kv = Column(Float, nullable=True)
    nbi_kv = Column(Float, nullable=True)
    tafi_ka = Column(Float, nullable=True)
    sequencia_operacao = Column(String(30), nullable=True)
    meio_extincao = Column(String(30), nullable=True)
    tipo_acionamento = Column(String(30), nullable=True)
    acessorios = Column(JSON, nullable=True)
    modelo = Column(String(80), nullable=True)
    norma_referencia = Column(String(80), nullable=True)
    fator_potencia = Column(Float, default=0.85)
    distancia_m  = Column(Float, nullable=False)
    tipo_cabo    = Column(Enum(TipoCabo), default=TipoCabo.CU_PVC)
    temp_ambiente = Column(Float, default=30)
    fases        = Column(Integer, default=3)
    agrupamento  = Column(Integer, default=1)

    # Dados executivos de entrada
    tag               = Column(String(80), nullable=True)
    from_barramento   = Column(String(120), nullable=True)
    to_equipamento    = Column(String(120), nullable=True)
    protection_device = Column(String(40), nullable=True)
    modo_dimensionamento = Column(String(20), default="manual")
    modo_selecao_componentes = Column(String(20), default="manual")
    disjuntor_tensao_nominal = Column(Float, nullable=True)
    disjuntor_corrente_nominal = Column(Float, nullable=True)
    disjuntor_icu = Column(Float, nullable=True)
    disjuntor_curva = Column(String(30), nullable=True)
    disjuntor_fabricante = Column(String(80), nullable=True)
    corrente_ac_dc    = Column(String(10), default="AC")
    potencia_kva      = Column(Float, nullable=True)
    usar_kva_informado = Column(Boolean, default=False)
    fator_demanda     = Column(Float, default=1.0)
    fator_eficiencia  = Column(Float, default=1.0)
    metodo_instalacao = Column(String(30), default="TRAY")
    formacao          = Column(Integer, default=1)
    comprimento_real  = Column(Float, nullable=True)
    queda_tensao_alimentador = Column(Float, default=0.0)

    # Resultados calculados
    corrente_nominal = Column(Float, nullable=True)
    secao_mm2        = Column(Float, nullable=True)
    disjuntor_a      = Column(Float, nullable=True)
    queda_tensao_pct = Column(Float, nullable=True)
    secao_pe_mm2     = Column(Float, nullable=True)
    ampacidade       = Column(Float, nullable=True)
    status           = Column(String(10), nullable=True)

    # Resultados executivos calculados
    corrente_projeto       = Column(Float, nullable=True)
    corrente_corrigida     = Column(Float, nullable=True)
    fator_k1               = Column(Float, nullable=True)
    fator_k2               = Column(Float, nullable=True)
    fator_k3               = Column(Float, nullable=True)
    corrente_condutor      = Column(Float, nullable=True)
    tensao_fase            = Column(Float, nullable=True)
    isc_local              = Column(Float, nullable=True)
    isc_cabo               = Column(Float, nullable=True)
    tempo_atuacao          = Column(Float, nullable=True)
    secao_joule            = Column(Float, nullable=True)
    impedancia_rdc         = Column(Float, nullable=True)
    impedancia_rac         = Column(Float, nullable=True)
    impedancia_xl          = Column(Float, nullable=True)
    queda_tensao_max       = Column(Float, nullable=True)
    queda_tensao_acumulada = Column(Float, nullable=True)
    tipo_cabo_comercial    = Column(String(80), nullable=True)
    nota_tecnica           = Column(Text, nullable=True)
    revisao                = Column(String(10), nullable=True)
    status_final           = Column(String(30), nullable=True)
    protecao_status        = Column(String(30), nullable=True)
    protecao_nota          = Column(Text, nullable=True)
    validacao_status       = Column(String(30), nullable=True)
    validacao_mensagem     = Column(Text, nullable=True)
    validacao_detalhes     = Column(Text, nullable=True)
    cabo_sugerido_secao    = Column(Float, nullable=True)
    cabo_sugerido_tipo_comercial = Column(String(80), nullable=True)
    cabo_sugerido_ampacidade = Column(Float, nullable=True)
    disjuntor_sugerido_in  = Column(Float, nullable=True)
    disjuntor_sugerido_icu = Column(Float, nullable=True)
    disjuntor_sugerido_curva = Column(String(30), nullable=True)
    selecao_componentes_status = Column(String(30), nullable=True)
    selecao_componentes_justificativa = Column(Text, nullable=True)

    criado_em     = Column(DateTime(timezone=True), server_default=func.now())
    atualizado_em = Column(DateTime(timezone=True), onupdate=func.now())

    projeto = relationship("Projeto", back_populates="circuitos")

    # ── Performance indexes ─────────────────────────────────────────────────
    # ix_circuitos_projeto_ordem: composite covering index for the single most
    # common query: WHERE projeto_id = ? ORDER BY ordem.
    # With 100k circuits across all projects, this eliminates full-table scans.
    __table_args__ = (
        Index("ix_circuitos_projeto_ordem", "projeto_id", "ordem"),
    )
