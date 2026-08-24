from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum

class ContextoNormativo(str, enum.Enum):
    industrial   = "industrial"
    offshore     = "offshore"
    hospitalar   = "hospitalar"
    residencial  = "residencial"

class Projeto(Base):
    __tablename__ = "projetos"

    id          = Column(Integer, primary_key=True, index=True)
    usuario_id  = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    nome        = Column(String(200), nullable=False)
    descricao   = Column(Text, nullable=True)
    cliente     = Column(String(200), nullable=True)
    contexto    = Column(Enum(ContextoNormativo), default=ContextoNormativo.industrial)
    tensao_ref  = Column(Integer, default=380)
    transformador_dados = Column(Text, nullable=True)
    sistema_trifasico_dados = Column(Text, nullable=True)
    protecao_geral_dados = Column(Text, nullable=True)
    para_raios_dados = Column(Text, nullable=True)
    aterramento_dados = Column(Text, nullable=True)
    areas_classificadas_dados = Column(Text, nullable=True)
    criado_em   = Column(DateTime(timezone=True), server_default=func.now())
    atualizado_em = Column(DateTime(timezone=True), onupdate=func.now())

    usuario   = relationship("Usuario", back_populates="projetos")
    circuitos = relationship("Circuito", back_populates="projeto", cascade="all, delete-orphan")

    # Explicit composite/covering indexes for scalability
    __table_args__ = (
        # Dashboard: WHERE usuario_id = ? ORDER BY criado_em DESC
        Index("ix_projetos_usuario_criado", "usuario_id", "criado_em"),
    )
