"""
Gabarito Etapa 4 — queda_tensao_acumulada nunca None e status correto.

Caso: C-01 raiz 2.5%, C-02 filho 2.0% (pai C-01), C-03 neto 1.0% (pai C-02)
Esperado:
  C-01: acumulada=2.5%  → OK
  C-02: acumulada=4.5%  → ALERTA (>4.25 = 5*0.85)
  C-03: acumulada=5.5%  → CRITICO (>5%)
"""
import sys
sys.path.insert(0, '.')

from app.services.calculo import calcular_circuito
from app.services.validacao_normativa import validar_circuito_normativo

erros = []

def chk(label, obtido, esperado, tol=0.05):
    ok = abs(float(obtido) - float(esperado)) <= tol if obtido is not None else False
    sim = "OK" if ok else "FALHA"
    print(f"  [{sim}] {label}: {obtido}  (esperado: {esperado})")
    if not ok:
        erros.append(label)

def chk_str(label, obtido, esperado):
    ok = str(obtido) == str(esperado)
    sim = "OK" if ok else "FALHA"
    print(f"  [{sim}] {label}: {obtido!r}  (esperado: {esperado!r})")
    if not ok:
        erros.append(label)


# ── Teste 1: circuito raiz — queda_tensao_alimentador = None ───────────────
print("\n=== TESTE 1: Circuito raiz com queda_tensao_alimentador=None ===")

class FakeCircuito:
    """Simula um objeto SQLAlchemy minimamente."""
    def __init__(self, **kw):
        defaults = {
            "tensao": 380, "potencia_kw": 10, "fator_potencia": 0.85,
            "distancia_m": 50, "tipo_cabo": "CU-PVC", "temp_ambiente": 30,
            "fases": 3, "agrupamento": 1, "formacao": 1,
            "metodo_instalacao": "TRAY", "corrente_ac_dc": "AC",
            "fator_demanda": 1.0, "fator_eficiencia": 1.0,
            "potencia_kva": None, "usar_kva_informado": False,
            "isc_local": 5.0, "tempo_atuacao": 0.1,
            "queda_tensao_alimentador": None,  # ← raiz, None no banco
            "modo_dimensionamento": "manual",
            "disjuntor_corrente_nominal": 25, "disjuntor_icu": 6,
            "disjuntor_tensao_nominal": 380, "disjuntor_curva": "C",
            "disjuntor_fabricante": None, "comprimento_real": None,
            "modo_selecao_componentes": "manual", "tag": "C-01",
            "descricao": "Carga teste", "from_barramento": None,
            "to_equipamento": None, "protection_device": None,
        }
        defaults.update(kw)
        for k, v in defaults.items():
            setattr(self, k, v)

c1 = FakeCircuito(queda_tensao_alimentador=None)
r1 = calcular_circuito(c1, "industrial")
print(f"  queda_tensao_acumulada = {r1['queda_tensao_acumulada']}  (nunca deve ser None)")
assert r1["queda_tensao_acumulada"] is not None, "FALHA: queda_tensao_acumulada é None!"
chk_str("queda_tensao_acumulada is not None", "OK", "OK")
# Sem pai: acumulada deve ser igual ao trecho
chk("acumulada == trecho (raiz)", r1["queda_tensao_acumulada"], r1["queda_tensao_pct"], 0.001)


# ── Teste 2: validação normativa com ΔV acumulada > 5% → CRITICO ────────────
print("\n=== TESTE 2: ΔV acumulada 5.5% → CRITICO ===")
dados_critico = {
    "corrente_projeto": 20,
    "corrente_corrigida": 22,
    "corrente_condutor": 28,
    "formacao": 1,
    "disjuntor_corrente_nominal": 25,
    "disjuntor_icu": 6,
    "isc_local": 5.0,
    "tensao": 380,
    "queda_tensao_pct": 1.0,
    "queda_tensao_acumulada": 5.5,   # > 5% → CRITICO
    "queda_tensao_max": 7.0,
}
v2 = validar_circuito_normativo(dados_critico, "industrial")
chk_str("status CRITICO (acum 5.5%)", v2["validacao_status"], "CRITICO")
assert "acumulada" in v2["validacao_mensagem"].lower() or "acum" in v2["validacao_mensagem"].lower(), \
    f"Mensagem deveria mencionar 'acumulada': {v2['validacao_mensagem']}"
print(f"  mensagem: {v2['validacao_mensagem']}")


# ── Teste 3: ΔV acumulada 4.5% → ALERTA ─────────────────────────────────────
print("\n=== TESTE 3: ΔV acumulada 4.5% → ALERTA ===")
dados_alerta = {**dados_critico, "queda_tensao_acumulada": 4.5}
v3 = validar_circuito_normativo(dados_alerta, "industrial")
chk_str("status ALERTA (acum 4.5%)", v3["validacao_status"], "ALERTA")


# ── Teste 4: ΔV acumulada 2.5% → OK (sem alertas de queda) ──────────────────
print("\n=== TESTE 4: ΔV acumulada 2.5% → OK ===")
dados_ok = {**dados_critico, "queda_tensao_acumulada": 2.5, "isc_local": None}
v4 = validar_circuito_normativo(dados_ok, "industrial")
# Pode ter ALERTA por Icc ausente, mas não deve ser CRITICO por queda
assert v4["validacao_status"] != "CRITICO" or "acumulada" not in v4.get("validacao_mensagem",""), \
    "Não deve ser CRITICO por queda quando acum=2.5%"
print(f"  status: {v4['validacao_status']} (não deve ser CRITICO por queda) [OK]")


# ── Teste 5: offshore — limite 3% ─────────────────────────────────────────────
print("\n=== TESTE 5: Offshore — limite 3%, acumulada 3.5% → CRITICO ===")
dados_off = {**dados_critico, "queda_tensao_acumulada": 3.5}
v5 = validar_circuito_normativo(dados_off, "offshore")
chk_str("status CRITICO offshore (acum 3.5%)", v5["validacao_status"], "CRITICO")
print(f"  mensagem: {v5['validacao_mensagem']}")


print()
if erros:
    print(f"RESULTADO: {len(erros)} falha(s) — {erros}")
    sys.exit(1)
else:
    print("RESULTADO: TODOS OS TESTES PASSARAM - Etapa 4 aprovada!")
