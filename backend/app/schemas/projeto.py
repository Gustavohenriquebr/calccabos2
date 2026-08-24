from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.models.projeto import ContextoNormativo

class ProjetoBase(BaseModel):
    nome: str
    descricao: Optional[str] = None
    cliente: Optional[str] = None
    contexto: ContextoNormativo = ContextoNormativo.industrial
    tensao_ref: int = 380

class ProjetoCreate(ProjetoBase):
    pass

class ProjetoUpdate(ProjetoBase):
    pass

class ProjetoRead(ProjetoBase):
    id: int
    usuario_id: int
    criado_em: datetime
    # FIX: atualizado_em uses onupdate=func.now() — NULL for new rows, must be Optional.
    atualizado_em: Optional[datetime] = None

    # JSON blob fields stored as TEXT in the DB
    transformador_dados: Optional[str] = None
    sistema_trifasico_dados: Optional[str] = None
    protecao_geral_dados: Optional[str] = None
    para_raios_dados: Optional[str] = None
    aterramento_dados: Optional[str] = None
    areas_classificadas_dados: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
