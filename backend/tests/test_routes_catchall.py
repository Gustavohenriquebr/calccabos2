"""test_routes_catchall.py — Fase 8: Verificação de ordem e colisão de rotas.

Garante que:
1. O catch-all /api/{full_path:path} está registrado APÓS todas as rotas /api/*
   concretas — ou seja, nenhuma rota real é interceptada por ele.
2. Rotas conhecidas da API retornam 401 (não autenticado) ou dados válidos,
   NUNCA {"error": "Route not found"} que indica interceptação pelo catch-all.
3. Rotas inexistentes retornam 404 com body {"error": "Route not found"}.
"""
import sys
import os
import json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-catchall")

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base, get_db
import app.models  # noqa

TEST_ENGINE = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
TestSession = sessionmaker(autocommit=False, autoflush=False, bind=TEST_ENGINE)
Base.metadata.create_all(bind=TEST_ENGINE)


def _override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


from fastapi.testclient import TestClient
from main import app

app.dependency_overrides[get_db] = _override_get_db

# Rotas conhecidas da API que requerem autenticação.
# Esperamos que retornem 401 (não autenticado) — NUNCA 404 com Route not found.
ROTAS_CONHECIDAS_AUTH_REQUIRED = [
    ("GET",    "/api/projetos"),
    ("GET",    "/api/projetos/1"),
    ("GET",    "/api/projetos/1/protecoes/circuitos"),
    ("GET",    "/api/projetos/1/transformador"),
    ("GET",    "/api/projetos/1/sistema-trifasico"),
    ("GET",    "/api/projetos/1/protecoes"),
    ("GET",    "/api/projetos/1/para-raios"),
    ("GET",    "/api/projetos/1/aterramento"),
    ("GET",    "/api/projetos/1/areas-classificadas"),
    ("GET",    "/api/projetos/1/relatorio/pdf"),
    ("GET",    "/api/projetos/1/relatorio/excel"),
    ("GET",    "/api/relatorios/1/pdf"),
    ("GET",    "/api/relatorios/1/excel"),
    ("GET",    "/api/circuitos/projeto/1"),
    ("DELETE", "/api/circuitos/projeto/1"),
    ("POST",   "/api/auth/login"),
    ("POST",   "/api/auth/registro"),
]

# Rotas que não requerem auth e devem retornar 200 diretamente.
ROTAS_PUBLICAS_200 = [
    ("GET", "/api/health"),
    ("GET", "/api/ready"),
]

# Rotas que definitivamente não existem — devem retornar 404 + Route not found.
ROTAS_INEXISTENTES = [
    ("GET",  "/api/rota-que-nao-existe"),
    ("GET",  "/api/projetos/1/rota-inexistente-qualquer"),
    ("POST", "/api/inventada/endpoint"),
    ("GET",  "/api/projetos/999/outra-rota-falsa"),
]

CATCH_ALL_BODY_INDICATOR = "Route not found"


def test_fase8_rotas_publicas_retornam_200():
    """Fase 8: Rotas públicas (/api/health, /api/ready) retornam 200."""
    client = TestClient(app)
    for method, path in ROTAS_PUBLICAS_200:
        resp = client.request(method, path)
        assert resp.status_code == 200, (
            f"{method} {path}: esperado 200, obtido {resp.status_code}. Body: {resp.text[:200]}"
        )
        body = resp.json()
        assert CATCH_ALL_BODY_INDICATOR not in json.dumps(body), (
            f"{method} {path}: retornou body de catch-all! {body}"
        )
        print(f"  PASS  {method} {path} → 200 ✅")


def test_fase8_rotas_auth_retornam_401_nao_catch_all():
    """Fase 8: Rotas que requerem auth retornam 401, NUNCA são interceptadas pelo catch-all."""
    client = TestClient(app)
    corpo_catch_all_esperado = {"error": CATCH_ALL_BODY_INDICATOR}

    for method, path in ROTAS_CONHECIDAS_AUTH_REQUIRED:
        resp = client.request(method, path)
        body_str = resp.text

        # A rota NÃO deve retornar o corpo do catch-all
        if CATCH_ALL_BODY_INDICATOR in body_str:
            try:
                body = resp.json()
                if body.get("error") == "Route not found":
                    raise AssertionError(
                        f"{method} {path}: rota REAL foi interceptada pelo catch-all! "
                        f"Status={resp.status_code}, body={body}"
                    )
            except (ValueError, KeyError):
                pass

        # Rotas auth devem retornar 401 (sem token) ou 400/422 (input inválido),
        # NUNCA 404 com o body do catch-all
        acceptable = {200, 400, 401, 403, 422}
        # GET de projeto com id=1 que não existe → 404 do ROUTER (com "detail"),
        # não do catch-all (com "error": "Route not found")
        if resp.status_code == 404:
            try:
                body = resp.json()
                assert body.get("error") != "Route not found", (
                    f"{method} {path}: 404 do CATCH-ALL, não do router! body={body}"
                )
                # 404 do router tem "detail", não "error": "Route not found"
                print(f"  INFO  {method} {path} → 404 (router, não catch-all) ✅")
            except ValueError:
                raise AssertionError(f"{method} {path}: 404 com body não-JSON")
        else:
            assert resp.status_code in acceptable, (
                f"{method} {path}: status inesperado {resp.status_code}. body={resp.text[:200]}"
            )
            print(f"  PASS  {method} {path} → {resp.status_code} ✅")


def test_fase8_rotas_inexistentes_retornam_catch_all_404():
    """Fase 8: Rotas inexistentes retornam 404 com body do catch-all."""
    client = TestClient(app)
    for method, path in ROTAS_INEXISTENTES:
        resp = client.request(method, path)
        assert resp.status_code == 404, (
            f"{method} {path}: esperado 404, obtido {resp.status_code}. Body: {resp.text[:200]}"
        )
        try:
            body = resp.json()
        except ValueError:
            raise AssertionError(f"{method} {path}: 404 com body não-JSON: {resp.text[:200]}")

        assert body.get("error") == "Route not found", (
            f"{method} {path}: 404 mas body incorreto: {body}"
        )
        assert "path" in body, f"{method} {path}: campo 'path' ausente no 404: {body}"
        print(f"  PASS  {method} {path} → 404 Route not found ✅")


def test_fase8_ordem_registro_catch_all_e_ultimo():
    """Fase 8: O catch-all /api/{path} deve estar registrado APÓS as rotas concretas.

    Verifica indiretamente: se /api/health retorna 200 (e não 404 catch-all),
    então as rotas concretas foram registradas antes do catch-all.
    """
    client = TestClient(app)

    # /api/health deve retornar 200 sempre, não 404
    resp = client.get("/api/health")
    assert resp.status_code == 200, (
        f"/api/health retornou {resp.status_code} — catch-all pode estar interceptando!"
    )
    body = resp.json()
    assert body.get("error") != "Route not found", (
        "/api/health foi interceptada pelo catch-all! Verificar ordem de registro em main.py"
    )

    # /api/ready também
    resp = client.get("/api/ready")
    assert resp.status_code == 200, (
        f"/api/ready retornou {resp.status_code} — catch-all pode estar interceptando!"
    )

    print(f"  PASS  ordem_registro: /api/health e /api/ready não interceptados pelo catch-all ✅")


# ===========================================================================
# Runner manual
# ===========================================================================
if __name__ == "__main__":
    tests = [
        test_fase8_rotas_publicas_retornam_200,
        test_fase8_rotas_auth_retornam_401_nao_catch_all,
        test_fase8_rotas_inexistentes_retornam_catch_all_404,
        test_fase8_ordem_registro_catch_all_e_ultimo,
    ]
    passed = 0
    failed = 0
    for t in tests:
        print(f"\n── {t.__name__} ──")
        try:
            t()
            passed += 1
        except AssertionError as e:
            print(f"  FAIL  {e}")
            failed += 1
        except Exception as e:
            print(f"  ERROR {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            failed += 1
    print(f"\n{'='*60}")
    print(f"{passed} passed, {failed} failed")
    sys.exit(0 if failed == 0 else 1)
