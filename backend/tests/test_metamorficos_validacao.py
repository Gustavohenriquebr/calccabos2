"""Testes metamorficos de validacao tecnica.

Esses testes verificam invariantes esperadas do motor sem depender de um unico
gabarito numerico. Falhas aqui devem ser revisadas tecnicamente antes de mudar
o motor.
"""

from types import SimpleNamespace

import pytest

from app.services.calculo import calcular_circuito


def circuito(**overrides):
    data = {
        "descricao": "Circuito metamorfico",
        "tag": "META-001",
        "configuracao_eletrica": "ac_trifasico",
        "referencia_tensao": "fase_fase",
        "modo_entrada": "potencia_ativa",
        "base_potencia": "entrada_eletrica",
        "tensao": 380,
        "potencia_kw": 12,
        "potencia_kva": None,
        "corrente_informada": None,
        "fator_potencia": 0.9,
        "fator_eficiencia": 1.0,
        "fator_demanda": 1.0,
        "distancia_m": 30,
        "comprimento_real": None,
        "tipo_cabo": "CU-PVC",
        "temp_ambiente": 30,
        "fases": 3,
        "agrupamento": 1,
        "formacao": 1,
        "metodo_instalacao": "TRAY",
        "corrente_ac_dc": "AC",
        "queda_tensao_alimentador": 0,
        "queda_tensao_limite": 5,
        "aplicacao_circuito": "GERAL",
        "secao_minima_aplicacao": 2.5,
        "modo_dimensionamento": "manual",
        "modo_selecao_componentes": "manual",
        "isc_local": None,
        "tempo_atuacao": None,
        "disjuntor_corrente_nominal": None,
        "disjuntor_tensao_nominal": None,
        "disjuntor_icu": None,
        "disjuntor_curva": None,
        "disjuntor_fabricante": None,
    }
    data.update(overrides)
    return SimpleNamespace(**data)


def test_aumentar_potencia_nao_reduz_corrente():
    menor = calcular_circuito(circuito(potencia_kw=8))
    maior = calcular_circuito(circuito(potencia_kw=16))
    assert maior["corrente_projeto"] >= menor["corrente_projeto"]


def test_reduzir_fp_nao_reduz_corrente():
    fp_alto = calcular_circuito(circuito(fator_potencia=0.95))
    fp_baixo = calcular_circuito(circuito(fator_potencia=0.7))
    assert fp_baixo["corrente_projeto"] >= fp_alto["corrente_projeto"]


def test_aumentar_distancia_nao_reduz_queda_quando_secao_igual():
    curto = calcular_circuito(circuito(potencia_kw=2, fator_potencia=1, distancia_m=10))
    longo = calcular_circuito(circuito(potencia_kw=2, fator_potencia=1, distancia_m=25))
    assert longo["secao_mm2"] == curto["secao_mm2"]
    assert longo["queda_tensao_pct"] >= curto["queda_tensao_pct"]


def test_agrupamento_desfavoravel_nao_melhora_secao():
    isolado = calcular_circuito(circuito(potencia_kw=20, agrupamento=1, metodo_instalacao="TRAY"))
    agrupado = calcular_circuito(circuito(potencia_kw=20, agrupamento=4, metodo_instalacao="TRAY"))
    assert agrupado["secao_mm2"] >= isolado["secao_mm2"]


def test_secao_final_maior_ou_igual_a_todos_os_criterios():
    resultado = calcular_circuito(circuito(
        distancia_m=140,
        secao_minima_aplicacao=6,
        disjuntor_corrente_nominal=40,
        isc_local=8,
        tempo_atuacao=0.1,
        disjuntor_icu=10,
        disjuntor_curva="C",
    ))
    aplicaveis = [
        criterio["required_section_mm2"]
        for criterio in resultado["criterios"].values()
        if criterio["required_section_mm2"] is not None
    ]
    assert all(resultado["secao_mm2"] >= secao for secao in aplicaveis)


def test_falta_de_dado_essencial_nao_vira_ok():
    resultado = calcular_circuito(circuito(potencia_kw=0, potencia_kva=None, corrente_informada=None))
    assert resultado["resultado"]["status"] == "BLOCKED"
    assert resultado["status_final"] == "CRITICO"
    assert any(alerta["blocking"] for alerta in resultado["alertas"])


def test_relatorio_final_deve_ser_bloqueado_com_circuito_blocked():
    resultado = calcular_circuito(circuito(disjuntor_corrente_nominal=5))
    assert resultado["resultado"]["status"] == "BLOCKED"
    assert resultado["criterios"]["protection"]["status"] == "BLOCKED"
