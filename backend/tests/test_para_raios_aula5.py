import sys
sys.path.insert(0, '.')
from app.services.para_raios import calcular_para_raios

# Gabarito Aula 5: 138kV, aterrado solidamente, poluicao medio, Dm=400mm
r = calcular_para_raios({
    "tensao_sistema_kv": 138,
    "tipo_aterramento": "solidamente_aterrado",
    "nivel_poluicao": "medio",
    "diametro_medio_mm": 400,
})

erros = []

def chk(campo, obtido, esperado, tolerancia=0.5):
    ok = abs(float(obtido) - float(esperado)) <= tolerancia if obtido is not None else False
    simbolo = "OK" if ok else "FALHA"
    print(f"  [{simbolo}] {campo}: {obtido}  (esperado: {esperado})")
    if not ok:
        erros.append(campo)

def chk_str(campo, obtido, esperado):
    ok = str(obtido) == str(esperado)
    simbolo = "OK" if ok else "FALHA"
    print(f"  [{simbolo}] {campo}: {obtido!r}  (esperado: {esperado!r})")
    if not ok:
        erros.append(campo)

print("\n=== GABARITO AULA 5 — Para-raios 138kV aterrado solidamente ===\n")
chk("FA",              r["fa"],                 0.8,   0.001)
chk("VMAX classe kV",  r["vmax_classe_kv"],     145,   0.1)
chk("Vn calculado kV", r["vn_calculado_kv"],    116,   0.1)
chk("Vn comercial kV", r["vn_comercial_kv"],    120,   0.1)
chk("kD",              r["kd"],                 1.1,   0.001)
chk("Desc mm",         r["desc_mm"],            3190,  1.0)
chk("NBI kVp",         r["nbi_equipamento_kvp"],550,   0.1)
chk("Disruptiva FO",   r["disruptiva_frente_onda"], 330, 0.1)
chk("Residual 20kA",   r["residual_20ka"],      390,   0.1)
chk("Disruptiva FI",   r["disruptiva_fi"],      218,   0.1)
chk("MP1 %",           r["mp1_pct"],            92.0,  1.0)
chk("MP2 %",           r["mp2_pct"],            41.0,  1.0)
chk("MP3 %",           r["mp3_pct"],            109.0, 1.0)
chk_str("status_mp1",  r["status_mp1"],         "OK")
chk_str("status_mp2",  r["status_mp2"],         "OK")
chk_str("status_mp3",  r["status_mp3"],         "OK")
chk_str("status_final",r["status_final"],       "OK")

print()
if erros:
    print(f"RESULTADO: {len(erros)} falha(s) — {erros}")
    sys.exit(1)
else:
    print("RESULTADO: TODOS OS CAMPOS CORRETOS - Gabarito aprovado!")

# Teste extra: projeto sem dados (nao deve lancar excecao)
print("\n=== Teste: dados vazios (projeto novo) ===")
r2 = calcular_para_raios({})
print(f"  status: {r2['status_final']} (esperado: ALERTA)")
assert r2["status_final"] == "ALERTA", "Dados vazios devem retornar ALERTA"
print("  [OK] Dados vazios retornam ALERTA corretamente")

print("\nTodos os testes passaram.")
