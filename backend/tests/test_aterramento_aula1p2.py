"""
Gabarito Aula 1 P2 - Aterramento / Metodo Wenner

Medicoes:
  a=1m,  R=25.20 -> rho = 7.694037 x 25.20 = 193.89 ohm.m
  a=2m,  R=48.30 -> rho = 13.39432 x 48.30 = 646.95 ohm.m
  a=4m,  R=10.24 -> rho = 25.56577 x 10.24 = 261.79 ohm.m
  a=8m,  R=5.32  -> rho = 50.48453 x 5.32  = 268.58 ohm.m

Resistividade aparente (malha 80x90m):
  Estratificacao: d1=4m rho1=220, d2=5m rho2=330, d3=4m rho3=240, d4=4m rho4=260, rho_inf=52
  deq = 4+5+4+4 = 17m
  rho_eq = 17 / (4/220 + 5/330 + 4/240 + 4/260) = 260 ohm.m
  r = sqrt(80*90/pi) = 47.87m
  theta = 47.87/17 = 2.81
  delta = 52/260 = 0.2
  N = 0.7 (do grafico, delta=0.2, theta~2.8)
  rho_a = 0.7 x 260 = 182 ohm.m
"""
import sys
sys.path.insert(0, '.')
from app.services.aterramento import calcular_wenner, calcular_resistividade_aparente, calcular_aterramento

erros = []

def chk(label, obtido, esperado, tol=2.0):
    ok = abs(float(obtido) - float(esperado)) <= tol if obtido is not None else False
    print(f"  [{'OK' if ok else 'FALHA'}] {label}: {obtido}  (esperado: {esperado})")
    if not ok:
        erros.append(label)

def chk_str(label, obtido, esperado):
    ok = str(obtido) == str(esperado)
    print(f"  [{'OK' if ok else 'FALHA'}] {label}: {obtido!r}  (esperado: {esperado!r})")
    if not ok:
        erros.append(label)


# ── TESTE 1: Fatores K e calculo Wenner ──────────────────────────────────────
print("\n=== TESTE 1: Calculo Wenner com fatores K ===")
medicoes_dict = {
    1:  [25.20],
    2:  [48.30],
    4:  [10.24],
    8:  [5.32],
}
w = calcular_wenner(medicoes_dict, p=0.4)
print("  Resistividades calculadas:")
# Gabarito
esperados = {1: 193.89, 2: 646.95, 4: 261.79, 8: 268.58}
for a, esperado in sorted(esperados.items()):
    obtido = w["resistividades"].get(float(a), [None])[0]
    chk(f"  rho(a={a}m)", obtido, esperado, tol=2.0)


# ── TESTE 2: Resistividade aparente (malha 80x90m) ───────────────────────────
print("\n=== TESTE 2: Resistividade aparente malha 80x90m ===")
estratificacao = [
    {"espessura_m": 4, "resistividade_ohm_m": 220},
    {"espessura_m": 5, "resistividade_ohm_m": 330},
    {"espessura_m": 4, "resistividade_ohm_m": 240},
    {"espessura_m": 4, "resistividade_ohm_m": 260},
]
ap = calcular_resistividade_aparente(
    estratificacao,
    "retangular",
    {"largura_m": 80, "comprimento_m": 90},
    rho_infinito=52,
)
print(f"  Resultado: {ap}")
chk("deq_m",      ap.get("deq_m"),     17,     0.01)
chk("rho_eq",     ap.get("rho_eq"),    260,    3.0)
chk("r_m",        ap.get("r_m"),       47.87,  0.5)
chk("theta",      ap.get("theta"),     2.81,   0.1)
chk("delta",      ap.get("delta"),     0.2,    0.01)
chk("N",          ap.get("N"),         0.85,   0.2)   # tabela interpolada, tolerancia generosa
chk("rho_aparente", ap.get("rho_aparente"), 182, 30)  # tolerancia por interpolacao


# ── TESTE 3: funcao principal calcular_aterramento com medicoes_dict ─────────
print("\n=== TESTE 3: calcular_aterramento com medicoes_dict ===")
r = calcular_aterramento({
    "medicoes_dict": {1: [25.20], 2: [48.30], 4: [10.24], 8: [5.32]},
    "profundidade_hastes_m": 0.4,
    "estratificacao": estratificacao,
    "rho_infinito": 52,
    "configuracao_malha": "retangular",
    "dimensoes_malha": {"largura_m": 80, "comprimento_m": 90},
})
chk("resistividade_media", r.get("resistividade_media"), 342, 100)  # media dos 4 pontos
chk("deq_m",               r.get("deq_m"),              17,    0.1)
chk("rho_aparente",        r.get("rho_aparente"),       182,   30)
# Nunca deve ser None
assert r.get("resistividade_media") is not None, "resistividade_media is None!"
assert r.get("status") is not None, "status is None!"
print(f"  status: {r['status']}")

# Chaves legadas devem existir
for chave in ["tipo_aterramento", "formula", "resistividade_media", "status", "mensagem", "itens"]:
    assert chave in r, f"Chave legada ausente: {chave}"
    print(f"  [OK] chave legada '{chave}' presente")


# ── TESTE 4: dados vazios nao deve lancar excecao ─────────────────────────────
print("\n=== TESTE 4: dados vazios ===")
r4 = calcular_aterramento({})
chk_str("status dados vazios", r4["status"], "CRITICO")
print(f"  mensagem: {r4['mensagem']}")


print()
if erros:
    print(f"RESULTADO: {len(erros)} falha(s) - {erros}")
    sys.exit(1)
else:
    print("RESULTADO: TODOS OS TESTES PASSARAM - Etapa 5 aprovada!")
