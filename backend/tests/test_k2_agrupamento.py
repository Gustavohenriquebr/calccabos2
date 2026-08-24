"""test_k2_agrupamento.py — Testes unitários para o fator de agrupamento K2.

Valida que o software usa a tabela correta da NBR 5410 Tabela 42 baseada
no método de instalação, conforme investigação INVESTIGACAO_K2.md.

Bug anterior: K2=0.65 retornado para todos os métodos (só coluna eletroduto).
Correção: K2=0.77 para bandeja (TRAY), K2=0.65 para eletroduto (CONDUIT).
"""
import sys
import os
import types

# ---------------------------------------------------------------------------
# Setup: allow import from backend/app without a running server
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Stub modules that require DB / third-party libs not needed for unit tests
for mod in [
    "app.database",
    "app.models",
    "app.models.circuito",
    "app.models.projeto",
    "app.models.usuario",
    "app.models.disjuntor",
    "sqlalchemy",
    "sqlalchemy.orm",
    "sqlalchemy.sql",
]:
    if mod not in sys.modules:
        sys.modules[mod] = types.ModuleType(mod)

# Provide minimal enum stub for TipoCabo
import enum as _enum
class _TipoCabo(str, _enum.Enum):
    CU_PVC  = "CU-PVC"
    CU_XLPE = "CU-XLPE"
    AL_PVC  = "AL-PVC"
    AL_XLPE = "AL-XLPE"

sys.modules["app.models.circuito"].TipoCabo = _TipoCabo

# Now safe to import the calculation service
from app.services.calculo import (
    FATOR_AGRUP_POR_METODO,
    FATOR_METODO,
    _FATOR_AGRUP_BANDEJA,
    _FATOR_AGRUP_ELETRODUTO,
    calcular_circuito,
)


# ---------------------------------------------------------------------------
# Helper: minimal circuit object
# ---------------------------------------------------------------------------
class CircuitoSimples:
    """Objeto mínimo simulando um Circuito do banco de dados."""
    def __init__(self, **kwargs):
        defaults = {
            "descricao": "Teste K2",
            "tag": "TC-001",
            "tensao": 380,
            "potencia_kw": 75.0,
            "fator_potencia": 0.87,
            "distancia_m": 50,
            "comprimento_real": None,
            "tipo_cabo": "CU-PVC",
            "temp_ambiente": 30,
            "fases": 3,
            "agrupamento": 4,
            "formacao": 1,
            "metodo_instalacao": "TRAY",
            "corrente_ac_dc": "AC",
            "potencia_kva": None,
            "usar_kva_informado": False,
            "fator_demanda": 1.0,
            "fator_eficiencia": 1.0,
            "isc_local": 0,
            "tempo_atuacao": 0.1,
            "queda_tensao_alimentador": 0.0,
            "modo_dimensionamento": "manual",
            "modo_selecao_componentes": "manual",
            "disjuntor_corrente_nominal": None,
            "disjuntor_tensao_nominal": None,
            "disjuntor_icu": None,
            "disjuntor_curva": None,
            "disjuntor_fabricante": None,
        }
        defaults.update(kwargs)
        for k, v in defaults.items():
            setattr(self, k, v)


# ===========================================================================
# TESTES DAS TABELAS ESTÁTICAS
# ===========================================================================

def test_tabela_bandeja_4_circuitos():
    """NBR 5410 Tab.42 coluna A: K2=0.77 para 4 circuitos em bandeja."""
    assert _FATOR_AGRUP_BANDEJA[4] == 0.77, (
        f"Esperado 0.77 (bandeja 4 circ.), obtido {_FATOR_AGRUP_BANDEJA[4]}"
    )

def test_tabela_eletroduto_4_circuitos():
    """NBR 5410 Tab.42 coluna B: K2=0.65 para 4 circuitos em eletroduto."""
    assert _FATOR_AGRUP_ELETRODUTO[4] == 0.65, (
        f"Esperado 0.65 (eletroduto 4 circ.), obtido {_FATOR_AGRUP_ELETRODUTO[4]}"
    )

def test_metodo_tray_usa_tabela_bandeja():
    assert FATOR_AGRUP_POR_METODO["TRAY"] is _FATOR_AGRUP_BANDEJA

def test_metodo_bandejamento_usa_tabela_bandeja():
    assert FATOR_AGRUP_POR_METODO["BANDEJAMENTO"] is _FATOR_AGRUP_BANDEJA

def test_metodo_air_usa_tabela_bandeja():
    assert FATOR_AGRUP_POR_METODO["AIR"] is _FATOR_AGRUP_BANDEJA

def test_metodo_ar_livre_usa_tabela_bandeja():
    assert FATOR_AGRUP_POR_METODO["AR_LIVRE"] is _FATOR_AGRUP_BANDEJA

def test_metodo_conduit_usa_tabela_eletroduto():
    assert FATOR_AGRUP_POR_METODO["CONDUIT"] is _FATOR_AGRUP_ELETRODUTO

def test_metodo_eletroduto_usa_tabela_eletroduto():
    assert FATOR_AGRUP_POR_METODO["ELETRODUTO"] is _FATOR_AGRUP_ELETRODUTO

def test_metodo_direct_usa_tabela_eletroduto():
    assert FATOR_AGRUP_POR_METODO["DIRECT"] is _FATOR_AGRUP_ELETRODUTO

def test_metodo_enterrado_usa_tabela_eletroduto():
    assert FATOR_AGRUP_POR_METODO["ENTERRADO"] is _FATOR_AGRUP_ELETRODUTO


# ===========================================================================
# TESTE CP-001 — CASO REPORTADO PELO AVALIADOR
# 75 kW, 380 V, FP=0.87, 4 circuitos agrupados, BANDEJA (TRAY)
# K2 esperado: 0.77
# ===========================================================================

def test_cp001_k2_bandeja_4_circuitos():
    """CP-001: 75kW/380V/FP=0.87/4 circ/TRAY → K2 deve ser 0.77 (não 0.65)."""
    circ = CircuitoSimples(
        potencia_kw=75.0,
        tensao=380,
        fator_potencia=0.87,
        agrupamento=4,
        metodo_instalacao="TRAY",
    )
    resultado = calcular_circuito(circ, "industrial")
    k2 = resultado["fator_k2"]
    assert k2 == 0.77, (
        f"CP-001 FALHOU: K2 esperado=0.77 (bandeja, NBR 5410 Tab.42 col.A), "
        f"obtido={k2}. Bug de indexação na tabela de agrupamento."
    )

def test_cp001_k2_eletroduto_4_circuitos():
    """Controle: mesmo cenário em ELETRODUTO → K2 deve ser 0.65."""
    circ = CircuitoSimples(
        potencia_kw=75.0,
        tensao=380,
        fator_potencia=0.87,
        agrupamento=4,
        metodo_instalacao="ELETRODUTO",
    )
    resultado = calcular_circuito(circ, "industrial")
    k2 = resultado["fator_k2"]
    assert k2 == 0.65, (
        f"Controle FALHOU: K2 esperado=0.65 (eletroduto, NBR 5410 Tab.42 col.B), "
        f"obtido={k2}."
    )


# ===========================================================================
# TESTES ADICIONAIS — VALORES PARA 1, 2, 3, 5, 9 CIRCUITOS EM BANDEJA
# ===========================================================================

def test_bandeja_agrupamento_1():
    circ = CircuitoSimples(agrupamento=1, metodo_instalacao="TRAY")
    r = calcular_circuito(circ, "industrial")
    assert r["fator_k2"] == 1.00

def test_bandeja_agrupamento_2():
    circ = CircuitoSimples(agrupamento=2, metodo_instalacao="TRAY")
    r = calcular_circuito(circ, "industrial")
    assert r["fator_k2"] == 0.88

def test_bandeja_agrupamento_3():
    circ = CircuitoSimples(agrupamento=3, metodo_instalacao="TRAY")
    r = calcular_circuito(circ, "industrial")
    assert r["fator_k2"] == 0.82

def test_bandeja_agrupamento_5():
    circ = CircuitoSimples(agrupamento=5, metodo_instalacao="TRAY")
    r = calcular_circuito(circ, "industrial")
    assert r["fator_k2"] == 0.73

def test_bandeja_agrupamento_9():
    circ = CircuitoSimples(agrupamento=9, metodo_instalacao="TRAY")
    r = calcular_circuito(circ, "industrial")
    assert r["fator_k2"] == 0.70


# ===========================================================================
# FASE 5 — AUDITORIA COMPLETA: cross-check FATOR_METODO × FATOR_AGRUP_POR_METODO
# Garante que NENHUM método aceito pelo sistema fica sem coluna K2 própria.
# ===========================================================================

def test_fase5_todos_metodos_cobertos():
    """FASE 5: Todo método em FATOR_METODO deve ter entrada em FATOR_AGRUP_POR_METODO."""
    metodos_sem_cobertura = [
        m for m in FATOR_METODO if m not in FATOR_AGRUP_POR_METODO
    ]
    assert metodos_sem_cobertura == [], (
        f"Métodos sem coluna K2 própria (caem no default incorreto): {metodos_sem_cobertura}\n"
        f"FATOR_METODO keys: {sorted(FATOR_METODO.keys())}\n"
        f"FATOR_AGRUP_POR_METODO keys: {sorted(FATOR_AGRUP_POR_METODO.keys())}"
    )

def test_fase5_bandeja_nao_usa_tabela_eletroduto():
    """FASE 5: Nenhum método de bandeja/ar livre deve usar a tabela de eletroduto."""
    metodos_bandeja = ["TRAY", "BANDEJAMENTO", "AIR", "AR_LIVRE"]
    for m in metodos_bandeja:
        tabela = FATOR_AGRUP_POR_METODO[m]
        assert tabela is not _FATOR_AGRUP_ELETRODUTO, (
            f"BUG: método '{m}' (bandeja) está usando a tabela de eletroduto!"
        )
        assert tabela is _FATOR_AGRUP_BANDEJA, (
            f"BUG: método '{m}' (bandeja) não aponta para _FATOR_AGRUP_BANDEJA!"
        )

def test_fase5_eletroduto_nao_usa_tabela_bandeja():
    """FASE 5: Nenhum método de eletroduto/enterrado deve usar a tabela de bandeja."""
    metodos_eletroduto = ["CONDUIT", "ELETRODUTO", "DIRECT", "ENTERRADO"]
    for m in metodos_eletroduto:
        tabela = FATOR_AGRUP_POR_METODO[m]
        assert tabela is not _FATOR_AGRUP_BANDEJA, (
            f"BUG: método '{m}' (eletroduto) está usando a tabela de bandeja!"
        )
        assert tabela is _FATOR_AGRUP_ELETRODUTO, (
            f"BUG: método '{m}' (eletroduto) não aponta para _FATOR_AGRUP_ELETRODUTO!"
        )

def test_fase5_cobertura_simetrica():
    """FASE 5: FATOR_AGRUP_POR_METODO não deve ter chaves extra que não existem em FATOR_METODO."""
    chaves_extras = [
        m for m in FATOR_AGRUP_POR_METODO if m not in FATOR_METODO
    ]
    assert chaves_extras == [], (
        f"Chaves em FATOR_AGRUP_POR_METODO sem correspondência em FATOR_METODO: {chaves_extras}"
    )

def test_fase5_audit_tabela_completa():
    """FASE 5: Tabela de auditoria completa — todos os 8 métodos validados."""
    AUDITORIA_ESPERADA = {
        # método        tabela_correta          k2_para_4_circ
        "TRAY":         (_FATOR_AGRUP_BANDEJA,    0.77),
        "BANDEJAMENTO": (_FATOR_AGRUP_BANDEJA,    0.77),
        "AIR":          (_FATOR_AGRUP_BANDEJA,    0.77),
        "AR_LIVRE":     (_FATOR_AGRUP_BANDEJA,    0.77),
        "CONDUIT":      (_FATOR_AGRUP_ELETRODUTO, 0.65),
        "ELETRODUTO":   (_FATOR_AGRUP_ELETRODUTO, 0.65),
        "DIRECT":       (_FATOR_AGRUP_ELETRODUTO, 0.65),
        "ENTERRADO":    (_FATOR_AGRUP_ELETRODUTO, 0.65),
    }
    erros = []
    for metodo, (tabela_esperada, k2_esperado) in AUDITORIA_ESPERADA.items():
        tabela_real = FATOR_AGRUP_POR_METODO.get(metodo)
        if tabela_real is None:
            erros.append(f"  {metodo}: NÃO ENCONTRADO em FATOR_AGRUP_POR_METODO")
            continue
        if tabela_real is not tabela_esperada:
            erros.append(f"  {metodo}: tabela errada (esperada={'bandeja' if tabela_esperada is _FATOR_AGRUP_BANDEJA else 'eletroduto'})")
        k2_real = tabela_real.get(4)
        if k2_real != k2_esperado:
            erros.append(f"  {metodo}: K2[4]={k2_real} esperado={k2_esperado}")

    assert not erros, "Auditoria K2 falhou:\n" + "\n".join(erros)


# ===========================================================================
# Runner manual (sem pytest)
# ===========================================================================
if __name__ == "__main__":
    tests = [
        test_tabela_bandeja_4_circuitos,
        test_tabela_eletroduto_4_circuitos,
        test_metodo_tray_usa_tabela_bandeja,
        test_metodo_bandejamento_usa_tabela_bandeja,
        test_metodo_air_usa_tabela_bandeja,
        test_metodo_ar_livre_usa_tabela_bandeja,
        test_metodo_conduit_usa_tabela_eletroduto,
        test_metodo_eletroduto_usa_tabela_eletroduto,
        test_metodo_direct_usa_tabela_eletroduto,
        test_metodo_enterrado_usa_tabela_eletroduto,
        test_cp001_k2_bandeja_4_circuitos,
        test_cp001_k2_eletroduto_4_circuitos,
        test_bandeja_agrupamento_1,
        test_bandeja_agrupamento_2,
        test_bandeja_agrupamento_3,
        test_bandeja_agrupamento_5,
        test_bandeja_agrupamento_9,
        # Fase 5 — auditoria completa
        test_fase5_todos_metodos_cobertos,
        test_fase5_bandeja_nao_usa_tabela_eletroduto,
        test_fase5_eletroduto_nao_usa_tabela_bandeja,
        test_fase5_cobertura_simetrica,
        test_fase5_audit_tabela_completa,
    ]
    passed = 0
    failed = 0
    for t in tests:
        try:
            t()
            print(f"  PASS  {t.__name__}")
            passed += 1
        except AssertionError as e:
            print(f"  FAIL  {t.__name__}: {e}")
            failed += 1
        except Exception as e:
            print(f"  ERROR {t.__name__}: {type(e).__name__}: {e}")
            failed += 1
    print(f"\n{passed} passed, {failed} failed")
    sys.exit(0 if failed == 0 else 1)
