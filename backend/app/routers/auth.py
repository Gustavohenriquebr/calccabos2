from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.schemas.usuario import RegistroSchema, TokenSchema, UsuarioRead
from passlib.context import CryptContext
try:
    import jwt
    JWTError = getattr(jwt, "PyJWTError", Exception)
except ImportError:
    from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from app.database import get_db
from app.models.usuario import Usuario
from app.config import settings

router = APIRouter()
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2 = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)
MIN_PASSWORD_LENGTH = 8
WEAK_PASSWORDS = {"12345678", "password", "password1", "senha123", "admin123", "calccabos"}


class LoginJSON(BaseModel):
    email: Optional[str] = None
    senha: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None


def criar_token(data: dict):
    # FIX: datetime.utcnow() is deprecated in Python 3.12+. Use timezone-aware datetime.
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({**data, "exp": exp}, settings.SECRET_KEY, algorithm="HS256")

def validar_senha(senha: str) -> Optional[str]:
    value = str(senha or "")
    normalized = value.strip().lower()

    if len(value) < MIN_PASSWORD_LENGTH:
        return f"A senha deve ter no mínimo {MIN_PASSWORD_LENGTH} caracteres."
    if not any(ch.isalpha() for ch in value) or not any(ch.isdigit() for ch in value):
        return "A senha deve conter pelo menos uma letra e um número."
    if normalized in WEAK_PASSWORDS:
        return "Use uma senha menos previsível."
    return None

def usuario_atual(token: str = Depends(oauth2), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Token inválido")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")
    u = db.query(Usuario).filter(Usuario.email == email).first()
    if not u:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")
    return u
@router.post("/registro", response_model=TokenSchema)
def registro(dados: RegistroSchema, db: Session = Depends(get_db)):
    email_clean = (dados.email or "").strip().lower()
    if not email_clean:
        raise HTTPException(status_code=400, detail="E-mail é obrigatório.")
    if not dados.nome or not dados.nome.strip():
        raise HTTPException(status_code=400, detail="Nome é obrigatório.")
    erro_senha = validar_senha(dados.senha)
    if erro_senha:
        raise HTTPException(status_code=400, detail=erro_senha)

    # Check for existing email
    if db.query(Usuario).filter(Usuario.email == email_clean).first():
        raise HTTPException(status_code=400, detail="Não foi possível concluir o cadastro com os dados informados.")

    # Create new user with hashed password
    hashed_password = pwd_ctx.hash(dados.senha)
    u = Usuario(
        nome=dados.nome.strip(),
        email=email_clean,
        senha_hash=hashed_password,
        crea=(dados.crea or "").strip() or None,
        empresa=(dados.empresa or "").strip() or None,
    )
    # Insert safely
    try:
        db.add(u)
        db.commit()
        db.refresh(u)
    except Exception as e:
        from sqlalchemy.exc import IntegrityError
        db.rollback()
        if isinstance(e, IntegrityError):
            raise HTTPException(status_code=400, detail="Não foi possível concluir o cadastro com os dados informados.")
        raise HTTPException(status_code=500, detail="Erro ao cadastrar usuário.")
    token = criar_token({"sub": u.email})
    return {"access_token": token, "token_type": "bearer", "usuario": {"id": u.id, "nome": u.nome, "email": u.email, "crea": u.crea, "empresa": u.empresa}}

@router.post("/login", response_model=TokenSchema)
async def login(request: Request, db: Session = Depends(get_db)):
    """Aceita JSON {email, senha} do frontend React OU multipart/form-data OAuth2."""
    email = None
    senha = None

    content_type = request.headers.get("content-type", "")

    if "application/json" in content_type:
        body = await request.json()
        email = (body.get("email") or body.get("username") or "").strip().lower()
        senha = body.get("senha") or body.get("password") or ""
    else:
        # OAuth2PasswordRequestForm / multipart / urlencoded
        form = await request.form()
        email = (form.get("username") or form.get("email") or "").strip().lower()
        senha = form.get("password") or form.get("senha") or ""

    if not email or not senha:
        raise HTTPException(status_code=400, detail="E-mail e senha são obrigatórios")

    u = db.query(Usuario).filter(Usuario.email == email).first()
    if not u or not pwd_ctx.verify(str(senha), u.senha_hash):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")

    token = criar_token({"sub": u.email})
    return {"access_token": token, "token_type": "bearer", "usuario": {"id": u.id, "nome": u.nome, "email": u.email, "crea": u.crea, "empresa": u.empresa}}


@router.get("/me", response_model=UsuarioRead)
def me(u: Usuario = Depends(usuario_atual)):
    return u
