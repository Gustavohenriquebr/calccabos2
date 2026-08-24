from pydantic import BaseModel
from typing import Optional

class DisjuntorCatalogoBase(BaseModel):
    fabricante: str
    modelo: str
    aplicacao: str
    vn_kv_min: float
    vn_kv_max: float
    in_a: float
    icc_ka: float
    nbi_kvp: Optional[float] = None
    meio_extincao: Optional[str] = None
    tipo_acionamento: Optional[str] = None
    numero_polos: int = 3
    curva: Optional[str] = None
    categoria_iec: Optional[str] = None
    is_active: bool = True

class DisjuntorCatalogoCreate(DisjuntorCatalogoBase):
    pass

class DisjuntorCatalogoResponse(DisjuntorCatalogoBase):
    id: int

    class Config:
        from_attributes = True
