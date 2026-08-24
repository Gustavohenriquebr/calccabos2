from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict

class UsuarioBase(BaseModel):
    nome: str
    email: str
    crea: Optional[str] = None
    empresa: Optional[str] = None

class RegistroSchema(UsuarioBase):
    senha: str

class UsuarioRead(UsuarioBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

class TokenSchema(BaseModel):
    access_token: str
    token_type: str
    usuario: UsuarioRead
