from types import SimpleNamespace

import pytest

from app.services.calculo import calcular_circuito
from app.services.tensao import analisar_tensao


@pytest.mark.parametrize(
    ("valor", "unidade", "esperado"),
    [
        (380, "V", "BT"),
        (13.8, "kV", "MT"),
        (69, "kV", "AT"),
        (500, "kV", "EAT"),
        (1000, "kV", "UAT"),
    ],
)
def test_classificacao_automatica_ac(valor, unidade, esperado):
    tensao = analisar_tensao(
        valor=valor,
        unidade=unidade,
        tipo_sistema="AC",
        referencia="fase_fase",
        fases=3,
        contexto_aplicacao="industrial",
    )

    assert tensao["classificacao"] == esperado
    assert tensao["tipo_sistema"] == "AC"


def test_tensao_dc_classificada_como_cc_e_nivel_registrado():
    tensao = analisar_tensao(
        valor=500,
        unidade="kV",
        tipo_sistema="DC",
        referencia="bipolar",
        contexto_aplicacao="transmissao",
    )

    assert tensao["classificacao"] == "CC"
    assert tensao["tensao_kv"] == 500
    assert any(alerta["code"] == "DC_SYSTEM_RULES" for alerta in tensao["alertas"])


def test_calculo_dc_nao_usa_fp_nem_raiz_de_tres():
    circuito = SimpleNamespace(
        descricao="Elo CC didatico",
        tensao=500,
        tensao_unidade="kV",
        tipo_sistema_tensao="DC",
        referencia_tensao_dc="bipolar",
        potencia_kw=100,
        fator_potencia=0.2,
        distancia_m=10,
        tipo_cabo="CU-PVC",
        temp_ambiente=30,
        fases=1,
        agrupamento=1,
        metodo_instalacao="TRAY",
        fator_demanda=1,
        fator_eficiencia=1,
        configuracao_eletrica="dc",
        corrente_ac_dc="DC",
    )

    resultado = calcular_circuito(circuito)
    memorial_corrente = resultado["memorial"]["steps"][0]

    assert resultado["metadados_calculo"]["tensao"]["classificacao"] == "CC"
    assert resultado["corrente_projeto"] == pytest.approx(0.2, rel=1e-6)
    assert "√3" not in memorial_corrente["formula"]
    assert "fp" not in memorial_corrente["formula"].lower()


def test_tensao_ausente_bloqueia_calculo():
    circuito = SimpleNamespace(
        descricao="Circuito sem tensao",
        tensao=None,
        potencia_kw=1,
        fator_potencia=0.92,
        distancia_m=10,
        tipo_cabo="CU-PVC",
        temp_ambiente=30,
        fases=3,
        agrupamento=1,
        metodo_instalacao="TRAY",
        fator_demanda=1,
        fator_eficiencia=1,
    )

    resultado = calcular_circuito(circuito)

    assert resultado["status_final"] == "CRITICO"
    assert resultado["metadados_calculo"]["tensao"]["classificacao"] == "NAO_INFORMADA"
    assert any(alerta["code"] == "MISSING_VOLTAGE" for alerta in resultado["alertas"])


def test_tensao_alta_nao_gera_aprovacao_falsa():
    circuito = SimpleNamespace(
        descricao="Alimentador AT didatico",
        tensao=69,
        tensao_unidade="kV",
        tipo_sistema_tensao="AC",
        referencia_tensao="fase_fase",
        contexto_aplicacao="subestacao",
        potencia_kw=1000,
        fator_potencia=0.92,
        distancia_m=50,
        tipo_cabo="CU-XLPE",
        temp_ambiente=30,
        fases=3,
        agrupamento=1,
        metodo_instalacao="TRAY",
        fator_demanda=1,
        fator_eficiencia=1,
    )

    resultado = calcular_circuito(circuito)

    assert resultado["metadados_calculo"]["tensao"]["classificacao"] == "AT"
    assert resultado["status_final"] != "OK"
    assert any(alerta["code"] == "HIGH_VOLTAGE_LIMITED_VALIDATION" for alerta in resultado["alertas"])
