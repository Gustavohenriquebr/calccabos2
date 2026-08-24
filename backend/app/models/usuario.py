from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Usuario(Base):
    __tablename__ = "usuarios"

    id         = Column(Integer, primary_key=True, index=True)
    nome       = Column(String(100), nullable=False)
    email      = Column(String(150), unique=True, index=True, nullable=False)
    senha_hash = Column(String(255), nullable=False)
    crea       = Column(String(50), nullable=True)
    empresa    = Column(String(150), nullable=True)
    ativo      = Column(Boolean, default=True)
    criado_em  = Column(DateTime(timezone=True), server_default=func.now())

    projetos = relationship("Projeto", back_populates="usuario")
