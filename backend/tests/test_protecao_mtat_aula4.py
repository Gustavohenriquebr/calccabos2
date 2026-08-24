import sys
sys.path.insert(0, '.')
from app.services.protecao import calcular_disjuntor_mtat

erros = []

def chk(label, obtido, esperado, tol=0.1):
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


# ── CASO 1: Trafo 50MVA, 88kV, Z=7%, 1 trafo, aterrado ──────────────────
print("\n=== CASO 1: Trafo 50MVA 88kV Z=7% aterrado ===")
r1 = calcular_disjuntor_mtat({
    "tensao_trabalho_kv": 88,
    "s_mva": 50,
    "z_percent": 7,
    "tipo_aterramento": "solidamente_aterrado",
    "n_trafos_paralelo": 1,
})
chk("Vn nominal kV",    r1["vn_nominal_kv"],   92,     0.1)
chk("In calculado A",   r1["in_calculado_a"],  328,    2.0)
chk("In DJ A",          r1["in_dj_a"],         400,    0.1)
chk("Icc calculado kA", r1["icc_calculado_ka"],4.686,  0.05)
chk("Icc DJ kA",        r1["icc_dj_ka"],       8,      0.1)
chk("NBI kVp",          r1["nbi_kvp"],         380,    0.1)
chk("TAFI kVef",        r1["tafi_kvef"],       185,    0.1)
chk_str("Status final", r1["status_final"],    "OK")


# ── CASO 2: 2 trafos em paralelo (mesmo caso) ────────────────────────────
print("\n=== CASO 2: 2 trafos em paralelo ===")
r2 = calcular_disjuntor_mtat({
    "tensao_trabalho_kv": 88,
    "s_mva": 50,
    "z_percent": 7,
    "tipo_aterramento": "solidamente_aterrado",
    "n_trafos_paralelo": 2,
})
chk("Icc calculado kA (2 trafos)", r2["icc_calculado_ka"], 9.372, 0.05)
chk("Icc DJ kA",                   r2["icc_dj_ka"],        10,    0.1)
chk("Vn nominal kV",               r2["vn_nominal_kv"],    92,    0.1)


# ── CASO 3: Disjuntor principal 230kV concessionária ─────────────────────
print("\n=== CASO 3: Principal 230kV Scc=8GVA, 160MVA +20% crescimento ===")
r3 = calcular_disjuntor_mtat({
    "tensao_trabalho_kv": 230,
    "s_mva": 160,
    "scc_concessionaria_gva": 8,
    "tipo_aterramento": "solidamente_aterrado",
    "crescimento_carga_pct": 20,
})
chk("Vn nominal kV",    r3["vn_nominal_kv"],   242,    0.1)
chk("In calculado A",   r3["in_calculado_a"],  481.9,  3.0)   # 192MVA / (√3×230kV)
chk("In DJ A",          r3["in_dj_a"],         600,    0.1)
chk("Icc calculado kA", r3["icc_calculado_ka"],20.08,  0.1)
chk("Icc DJ kA",        r3["icc_dj_ka"],       25,     0.1)
chk("NBI kVp",          r3["nbi_kvp"],         850,    0.1)
chk("TAFI kVef",        r3["tafi_kvef"],       360,    0.1)
chk_str("Status final", r3["status_final"],    "OK")


# ── Teste: dados vazios nao deve lancar excecao ───────────────────────────
print("\n=== Teste: dados vazios (projeto novo) ===")
r4 = calcular_disjuntor_mtat({})
print(f"  status: {r4['status_final']} (esperado: ALERTA)")
assert r4["status_final"] == "ALERTA", "Dados vazios devem retornar ALERTA"
print("  [OK] Dados vazios retornam ALERTA corretamente")


print()
if erros:
    print(f"RESULTADO: {len(erros)} falha(s) — {erros}")
    sys.exit(1)
else:
    print("RESULTADO: TODOS OS CASOS CORRETOS - Gabarito Aula 4 aprovado!")
