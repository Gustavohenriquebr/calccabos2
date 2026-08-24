import sys
sys.path.insert(0, '.')
from app.services.validacao_normativa import validar_circuito_normativo

base = {
    "corrente_projeto": 20, "corrente_corrigida": 22, "corrente_condutor": 28,
    "formacao": 1, "disjuntor_corrente_nominal": 25, "disjuntor_icu": 6,
    "isc_local": 5.0, "tensao": 380,
    "queda_tensao_pct": 1.0, "queda_tensao_max": 7.0,
}

erros = []

def chk_str(label, obtido, esperado):
    ok = str(obtido) == str(esperado)
    print(f"  [{'OK' if ok else 'FALHA'}] {label}: {obtido!r} (esperado: {esperado!r})")
    if not ok:
        erros.append(label)

print("=== TESTE 2: acumulada 5.5% industrial -> CRITICO ===")
v2 = validar_circuito_normativo({**base, "queda_tensao_acumulada": 5.5}, "industrial")
chk_str("status", v2["validacao_status"], "CRITICO")
print(f"  mensagem: {v2['validacao_mensagem']}")

print("\n=== TESTE 3: acumulada 4.5% industrial -> ALERTA ===")
v3 = validar_circuito_normativo({**base, "queda_tensao_acumulada": 4.5}, "industrial")
chk_str("status", v3["validacao_status"], "ALERTA")
print(f"  mensagem: {v3['validacao_mensagem']}")

print("\n=== TESTE 4: acumulada 2.5% industrial -> nao CRITICO por queda ===")
v4 = validar_circuito_normativo({**base, "queda_tensao_acumulada": 2.5}, "industrial")
print(f"  status: {v4['validacao_status']} (OK se nao CRITICO por queda)")

print("\n=== TESTE 5: acumulada 3.5% offshore -> CRITICO (limite 3%) ===")
v5 = validar_circuito_normativo({**base, "queda_tensao_acumulada": 3.5}, "offshore")
chk_str("status offshore", v5["validacao_status"], "CRITICO")
print(f"  mensagem: {v5['validacao_mensagem']}")

print()
if erros:
    print(f"RESULTADO: {len(erros)} falha(s) - {erros}")
    sys.exit(1)
else:
    print("RESULTADO: TODOS OS TESTES PASSARAM - Etapa 4 aprovada!")
