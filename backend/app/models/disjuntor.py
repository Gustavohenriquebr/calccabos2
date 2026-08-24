from sqlalchemy import Column, Integer, String, Float, Boolean
from app.database import Base

class DisjuntorCatalogo(Base):
    __tablename__ = "disjuntores_catalogo"

    id = Column(Integer, primary_key=True, index=True)
    fabricante = Column(String, index=True, nullable=False)
    modelo = Column(String, nullable=False)
    aplicacao = Column(String) # BT, MT, AT
    
    # Parâmetros Elétricos Principais
    vn_kv_min = Column(Float, nullable=False)
    vn_kv_max = Column(Float, nullable=False)
    in_a = Column(Float, nullable=False) # Corrente Nominal
    icc_ka = Column(Float, nullable=False) # Capacidade de interrupção
    nbi_kvp = Column(Float) # Nível Básico de Isolamento
    
    # Parâmetros Físicos
    meio_extincao = Column(String) # SF6, Vacuo, Oleo, Ar
    tipo_acionamento = Column(String) # Mola, Magnetico
    numero_polos = Column(Integer, default=3)
    
    # Curva e Categoria
    curva = Column(String) # B, C, D, MA (MT/AT)
    categoria_iec = Column(String) # IEC 60947-2, IEC 62271-100
    
    is_active = Column(Boolean, default=True)
