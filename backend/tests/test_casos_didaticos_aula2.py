"""Casos didáticos de validação baseados na Aula 2 do material fornecido.

Estes testes verificam consistência numérica e semântica do software. Eles não
constituem comprovação de conformidade normativa nem substituem validação de
projeto por profissional habilitado.
"""

import math
from types import SimpleNamespace

import pytest

from app.services.calculo import calcular_circuito
from app.services.projeto_eletrico import calcular_sistema_trifasico, calcular_transformador


TOLERANCIA_CORRENTE_A = 0.05


def circuito_didatico(**alteracoes):
    dados = {
        "descricao": "Caso didático Aula 2",
        "configuracao_eletrica": "ac_trifasico",
        "referencia_tensao": "fase_fase",
        "modo_entrada": "potencia_ativa",
        "base_potencia": "entrada_eletrica",
        "tensao": 440,
        "potencia_kw": 4.5,
        "potencia_kva": None,
        "corrente_informada": None,
        "fator_potencia": 0.85,
        "fator_eficiencia": 1.0,
        "fator_demanda": 1.0,
        "distancia_m": 20,
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
    dados.update(alteracoes)
    return SimpleNamespace(**dados)


def test_trifasico_por_potencia_ativa_4500w_440v_fp085():
    resultado = calcular_circuito(circuito_didatico())
    esperado = 4500 / (math.sqrt(3) * 440 * 0.85)

    assert esperado == pytest.approx(6.946, abs=0.001)
    assert resultado["corrente_projeto"] == pytest.approx(
        esperado, abs=TOLERANCIA_CORRENTE_A
    )


def test_trifasico_por_corrente_informada_calcula_s_p_q():
    resultado = calcular_sistema_trifasico({
        "tensao_linha": 380,
        "corrente_linha": 125,
        "fator_potencia": 0.8,
    })

    assert resultado["potencia_aparente_kva"] == pytest.approx(82.27, abs=0.02)
    assert resultado["potencia_ativa_kw"] == pytest.approx(65.82, abs=0.02)
    assert resultado["potencia_reativa_kvar"] == pytest.approx(49.36, abs=0.02)


def test_motor_por_potencia_util_aplica_rendimento():
    resultado = calcular_circuito(circuito_didatico(
        tensao=4000,
        potencia_kw=1000,
        fator_potencia=0.85,
        fator_eficiencia=0.9,
        base_potencia="saida_mecanica",
    ))
    esperado = 1_000_000 / (math.sqrt(3) * 4000 * 0.85 * 0.9)

    assert esperado == pytest.approx(188.68, abs=0.01)
    assert resultado["corrente_projeto"] == pytest.approx(
        esperado, abs=TOLERANCIA_CORRENTE_A
    )


def test_semantica_rendimento_distingue_entrada_eletrica_de_saida_util():
    entrada = calcular_circuito(circuito_didatico(
        potencia_kw=100,
        fator_eficiencia=0.8,
        base_potencia="entrada_eletrica",
    ))
    saida = calcular_circuito(circuito_didatico(
        potencia_kw=100,
        fator_eficiencia=0.8,
        base_potencia="saida_mecanica",
    ))

    esperado_entrada = 100_000 / (math.sqrt(3) * 440 * 0.85)
    esperado_saida = esperado_entrada / 0.8
    assert entrada["corrente_projeto"] == pytest.approx(esperado_entrada, abs=0.05)
    assert saida["corrente_projeto"] == pytest.approx(esperado_saida, abs=0.05)
    assert saida["corrente_projeto"] > entrada["corrente_projeto"]


@pytest.mark.parametrize(
    "potencia_kva,tensao_at_v,tensao_bt_v,corrente_at_a,corrente_bt_a",
    [
        (1000, 13_800, 220, 41.84, 2624),
        (7500, 13_800, 4160, 313.8, 1041),
    ],
)
def test_correntes_nominais_transformador_trifasico(
    potencia_kva, tensao_at_v, tensao_bt_v, corrente_at_a, corrente_bt_a
):
    resultado = calcular_transformador({
        "potencia_kva": potencia_kva,
        "tensao_primaria": tensao_at_v,
        # O contrato atual recebe a tensão secundária em volts.
        "tensao_secundaria": tensao_bt_v,
    })

    assert resultado["corrente_nominal_primario"] == pytest.approx(corrente_at_a, abs=0.1)
    assert resultado["corrente_nominal_secundario"] == pytest.approx(corrente_bt_a, abs=1.0)
