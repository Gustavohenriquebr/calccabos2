import json
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

results = {}

# HEALTH
r = client.get("/api/health")
results["health"] = {"status": r.status_code, "data": r.json() if r.text else None}

# REGISTRO
reg_data = {"nome": "Eng. Senior Avaliador", "email": "avaliador@calccabos.test", "senha": "Senha@2026", "crea": "SP-123456", "empresa": "Petrobras S.A."}
r = client.post("/api/auth/registro", json=reg_data)
results["registro"] = {"status": r.status_code, "data": r.json() if r.text else None}

# LOGIN
login_data = {"email": "avaliador@calccabos.test", "senha": "Senha@2026"}
r = client.post("/api/auth/login", json=login_data)
results["login"] = {"status": r.status_code, "data": r.json() if r.text else None}
token = r.json().get("access_token") if r.status_code == 200 else ""
headers = {"Authorization": f"Bearer {token}"}

# CRIAR PROJETO
proj_data = {"nome": "Planta Compressores P-55 — Petrobras", "cliente": "Petrobras S.A.", "descricao": "Dimensionamento elétrico da planta de compressores da plataforma P-55, Bacia de Santos. Projeto conforme N-1997 Rev.B e N-2040 Rev.F.", "contexto": "industrial", "tensao_ref": 380, "normaVersao": "NBR 5410:2004 + N-2040 Rev.F", "responsavelTecnico": "Eng. Gustavo Henrique CREA-SP 12121"}
r = client.post("/api/projetos", json=proj_data, headers=headers)
results["criar_projeto"] = {"status": r.status_code, "data": r.json() if r.text else None}
projeto_id = r.json().get("id") if r.status_code == 200 else None

print(json.dumps(results, indent=2))
