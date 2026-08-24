"""test_protecoes_endpoint.py — Testes end-to-end do endpoint Fase 3.

Testa GET /api/projetos/:id/protecoes/circuitos com banco in-memory SQLite.

Fixes aplicados:
- StaticPool: garante que TODAS as conexões do engine in-memory usem o mesmo
  banco (sem StaticPool, cada nova conexão vê um banco vazio diferente).
- MockUsuario: evita lazy-load de ORM atravessando sessões distintas.

Cobre:
  1. Projeto com 2 circuitos calculados → retorna dados corretos
  2. Projeto sem circuitos → 200 com array vazio (não erro)
  3. Projeto inexistente → 404 JSON (do router, não do catch-all)
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-e2e")

# ── Importações ───────────────────────────────────────────────────────────────
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool  # FIX: compartilha conexão in-memory

from app.database import Base, get_db
import app.models  # registra todos os modelos com Base

# ── Engine in-memory com StaticPool ──────────────────────────────────────────
# StaticPool garante que todos os .connect() retornem a MESMA conexão,
# portanto as tabelas criadas por create_all() ficam visíveis em todas as
# sessões subsequentes.
TEST_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSession = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=TEST_ENGINE,
    expire_on_commit=False,  # FIX: evita reload automático após commit
)

Base.metadata.create_all(bind=TEST_ENGINE)


def _override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


# ── Mock simples de usuário (sem ORM, sem lazy-load) ─────────────────────────
class MockUsuario:
    """Substituto leve para o modelo Usuario — sem SQLAlchemy tracking.

    Retornar um ORM instance de uma sessão diferente pode disparar
    SELECT inesperado. Este mock evita isso completamente.
    """
    def __init__(self, id: int, email: str, nome: str = "Eng. Teste",
                 crea: str = None, empresa: str = None):
        self.id = id
        self.email = email
        self.nome = nome
        self.crea = crea
        self.empresa = empresa
        self._id = id  # alias compatível com MongoDB-style


# ── Import app e override de dependências ────────────────────────────────────
from fastapi.testclient import TestClient
from main import app
from app.routers.auth import usuario_atual

app.dependency_overrides[get_db] = _override_get_db

# Usuário mock global (id=1 — deve coincidir com os registros criados no DB)
_MOCK_USER = MockUsuario(id=1, email="teste@calccabos.test")


def _override_usuario_atual():
    return _MOCK_USER


app.dependency_overrides[usuario_atual] = _override_usuario_atual

# ── Importações de modelos após configuração ─────────────────────────────────
from app.models.circuito import Circuito, TipoCabo
from app.models.projeto import Projeto, ContextoNormativo
from app.models.usuario import Usuario
from app.services.calculo import calcular_circuito


def _reset_db():
    """Limpa e recria todas as tabelas entre testes."""
    Base.metadata.drop_all(bind=TEST_ENGINE)
    Base.metadata.create_all(bind=TEST_ENGINE)


def _criar_usuario(db, user_id: int = 1):
    """Cria usuário com ID explícito correspondente ao MockUsuario."""
    u = Usuario(
        id=user_id,
        nome="Eng. Teste",
        email="teste@calccabos.test",
        senha_hash="hash_dummy",
        ativo=True,
    )
    db.add(u)
    db.flush()
    return u


# ===========================================================================
# TESTE 1 — Projeto com 2 circuitos calculados
# ===========================================================================

def test_fase7_protecoes_com_circuitos():
    """Fase 7: Retorna 200 com dados de proteção de 2 circuitos calculados."""
    _reset_db()
    db = TestSession()

    _criar_usuario(db)
    projeto = Projeto(
        usuario_id=1,
        nome="Projeto E2E",
        contexto=ContextoNormativo.industrial,
        tensao_ref=380,
    )
    db.add(projeto)
    db.flush()

    # Circuito 1: Motor 75 kW em bandeja (CP-001 reproduzido)
    c1 = Circuito(
        projeto_id=projeto.id,
        descricao="Motor Bomba",
        tag="M-001",
        tensao=380, potencia_kw=75.0, fator_potencia=0.87,
        distancia_m=50.0, tipo_cabo=TipoCabo.CU_PVC,
        temp_ambiente=30, fases=3, agrupamento=4,
        metodo_instalacao="TRAY", formacao=1, ordem=1,
    )
    r1 = calcular_circuito(c1, "industrial")
    for k, v in r1.items():
        if hasattr(c1, k):
            setattr(c1, k, v)
    db.add(c1)

    # Circuito 2: Iluminação 5 kW em eletroduto
    c2 = Circuito(
        projeto_id=projeto.id,
        descricao="Painel Iluminação",
        tag="IL-001",
        tensao=380, potencia_kw=5.0, fator_potencia=0.92,
        distancia_m=30.0, tipo_cabo=TipoCabo.CU_PVC,
        temp_ambiente=30, fases=3, agrupamento=1,
        metodo_instalacao="ELETRODUTO", formacao=1, ordem=2,
    )
    r2 = calcular_circuito(c2, "industrial")
    for k, v in r2.items():
        if hasattr(c2, k):
            setattr(c2, k, v)
    db.add(c2)
    db.commit()

    pid = projeto.id
    db.close()

    client = TestClient(app)
    resp = client.get(f"/api/projetos/{pid}/protecoes/circuitos")

    assert resp.status_code == 200, f"Esperado 200, obtido {resp.status_code}: {resp.text}"
    body = resp.json()

    assert body["projetoId"] == pid
    assert body["totalCircuitos"] == 2

    protecoes = body["protecoes"]
    assert len(protecoes) == 2

    p1 = next(p for p in protecoes if p["circuitoTag"] == "M-001")
    assert p1["secao"] is not None
    assert p1["disjuntor"] is not None
    assert p1["correnteProjetada"] is not None
    # CP-001: K2=0.77 → corrente corrigida maior → seção maior
    assert p1["secao"] >= 25, f"M-001 seção esperada ≥25mm², obtida {p1['secao']}"

    p2 = next(p for p in protecoes if p["circuitoTag"] == "IL-001")
    assert p2["secao"] is not None

    print(f"  PASS  protecoes_com_circuitos ✅")
    print(f"         M-001:  secao={p1['secao']}mm², disj={p1['disjuntor']}A, "
          f"Ib={p1['correnteProjetada']:.1f}A, status={p1['protecaoStatus']}")
    print(f"         IL-001: secao={p2['secao']}mm², disj={p2['disjuntor']}A, "
          f"Ib={p2['correnteProjetada']:.1f}A, status={p2['protecaoStatus']}")


# ===========================================================================
# TESTE 2 — Projeto sem circuitos (edge case)
# ===========================================================================

def test_fase7_protecoes_projeto_sem_circuitos():
    """Fase 7: Projeto sem circuitos → 200 com protecoes=[] (não erro 500)."""
    _reset_db()
    db = TestSession()
    _criar_usuario(db)
    projeto = Projeto(
        usuario_id=1,
        nome="Projeto Vazio",
        contexto=ContextoNormativo.industrial,
        tensao_ref=380,
    )
    db.add(projeto)
    db.commit()
    pid = projeto.id
    db.close()

    client = TestClient(app)
    resp = client.get(f"/api/projetos/{pid}/protecoes/circuitos")

    assert resp.status_code == 200, f"Esperado 200, obtido {resp.status_code}: {resp.text}"
    body = resp.json()
    assert body["totalCircuitos"] == 0
    assert body["protecoes"] == []
    print("  PASS  protecoes_projeto_sem_circuitos → 200 [] ✅")


# ===========================================================================
# TESTE 3 — Projeto inexistente (404 do router, não do catch-all)
# ===========================================================================

def test_fase7_protecoes_projeto_inexistente():
    """Fase 7: ID inexistente → 404 JSON do router (não do catch-all SPA)."""
    _reset_db()
    db = TestSession()
    _criar_usuario(db)
    db.commit()
    db.close()

    client = TestClient(app)
    resp = client.get("/api/projetos/99999/protecoes/circuitos")

    assert resp.status_code == 404, f"Esperado 404, obtido {resp.status_code}"
    body = resp.json()
    # 404 do ROUTER tem "detail", o catch-all tem "error": "Route not found"
    assert body.get("error") != "Route not found", (
        "404 veio do catch-all SPA em vez do router! Verificar ordem de rotas."
    )
    assert "detail" in body, f"Esperado 'detail' no body, obtido: {body}"
    print(f"  PASS  protecoes_projeto_inexistente → 404 JSON router ✅ detail={body['detail']!r}")


# ===========================================================================
# Runner manual
# ===========================================================================
if __name__ == "__main__":
    tests = [
        test_fase7_protecoes_com_circuitos,
        test_fase7_protecoes_projeto_sem_circuitos,
        test_fase7_protecoes_projeto_inexistente,
    ]
    passed = 0
    failed = 0
    for t in tests:
        try:
            t()
            passed += 1
        except AssertionError as e:
            print(f"  FAIL  {t.__name__}: {e}")
            failed += 1
        except Exception as e:
            import traceback
            print(f"  ERROR {t.__name__}: {type(e).__name__}: {e}")
            traceback.print_exc()
            failed += 1
    print(f"\n{passed} passed, {failed} failed")
    sys.exit(0 if failed == 0 else 1)
