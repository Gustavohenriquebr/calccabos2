import math
from types import SimpleNamespace

import pytest

from app.services.calculo import calcular_circuito


def circuito(**overrides):
    dados = {
        "descricao": "Circuito de referência",
        "tag": "REF-001",
        "configuracao_eletrica": "ac_trifasico",
        "referencia_tensao": "fase_fase",
        "modo_entrada": "potencia_ativa",
        "base_potencia": "entrada_eletrica",
        "tensao": 380,
        "potencia_kw": 15,
        "potencia_kva": None,
        "corrente_informada": None,
        "fator_potencia": 0.92,
        "fator_eficiencia": 1.0,
        "fator_demanda": 1.0,
        "distancia_m": 20,
        "comprimento_real": None,
        "tipo_cabo": "CU-PVC",
        "temp_ambiente": 30,
        "fases": 3,
        "agrupamento": 1,
        "formacao": 1,
        "metodo_instalacao": "TRAY",
        "corrente_ac_dc": "AC",
        "isc_local": None,
        "tempo_atuacao": None,
        "queda_tensao_alimentador": 0,
        "queda_tensao_limite": 5,
        "aplicacao_circuito": "GERAL",
        "secao_minima_aplicacao": 2.5,
        "modo_dimensionamento": "manual",
        "disjuntor_corrente_nominal": None,
        "disjuntor_tensao_nominal": None,
        "disjuntor_icu": None,
        "disjuntor_curva": None,
        "disjuntor_fabricante": None,
    }
    dados.update(overrides)
    return SimpleNamespace(**dados)


def test_corrente_monofasica_referencia():
    resultado = calcular_circuito(circuito(
        configuracao_eletrica="ac_monofasico",
        referencia_tensao="fase_neutro",
        tensao=127,
        potencia_kw=2.2,
        fator_potencia=1.0,
    ))
    assert resultado["corrente_projeto"] == pytest.approx(17.323, abs=0.01)
    assert "√3" not in resultado["memorial"]["steps"][0]["formula"]


def test_corrente_trifasica_referencia():
    resultado = calcular_circuito(circuito())
    esperado = 15000 / (math.sqrt(3) * 380 * 0.92)
    assert resultado["corrente_projeto"] == pytest.approx(esperado, abs=0.01)
    assert "√3" in resultado["memorial"]["steps"][0]["formula"]


def test_corrente_cc_referencia_sem_fp_ou_raiz_de_tres():
    resultado = calcular_circuito(circuito(
        configuracao_eletrica="dc",
        referencia_tensao="cc",
        corrente_ac_dc="DC",
        tensao=600,
        potencia_kw=10,
        fator_potencia=None,
    ))
    assert resultado["corrente_projeto"] == pytest.approx(16.667, abs=0.01)
    formula = resultado["memorial"]["steps"][0]["formula"]
    assert "fp" not in formula.lower()
    assert "√3" not in formula


def test_curva_tempo_corrente_documentada_pode_liberar_atuacao():
    resultado = calcular_circuito(circuito(
        isc_local=10,
        disjuntor_corrente_nominal=32,
        disjuntor_icu=25,
        disjuntor_curva="C",
        disjuntor_fabricante="Fabricante de teste",
        protecao_curva_fonte="datasheet://fabricante/modelo",
        protecao_curva_pontos=[
            {"multiplo_in": 5, "tempo_max_s": 0.2},
            {"multiplo_in": 250, "tempo_max_s": 0.05},
        ],
        tempo_atuacao=0.1,
    ))
    verificacao = resultado["protecao_verificacoes"]["automatic_disconnection"]
    assert verificacao["status"] == "OK"
    assert resultado["protecao_status"] == "OK"


def test_curva_fora_da_faixa_nao_e_extrapolada():
    resultado = calcular_circuito(circuito(
        isc_local=0.1,
        disjuntor_corrente_nominal=32,
        disjuntor_icu=25,
        disjuntor_curva="C",
        disjuntor_fabricante="Fabricante de teste",
        protecao_curva_fonte="datasheet://fabricante/modelo",
        protecao_curva_pontos=[{"multiplo_in": 5, "tempo_max_s": 0.2}],
        tempo_atuacao=0.1,
    ))
    assert resultado["protecao_verificacoes"]["automatic_disconnection"]["status"] == "NOT_EVALUATED"


def test_kva_monofasico_e_legado_bifasico_usam_sobre_v_nao_sobre_2v():
    comum = dict(
        configuracao_eletrica="ac_monofasico",
        referencia_tensao="fase_fase",
        modo_entrada="potencia_aparente",
        usar_kva_informado=True,
        potencia_kw=0,
        potencia_kva=10,
        tensao=220,
    )
    novo = calcular_circuito(circuito(**comum))
    legado = calcular_circuito(circuito(
        **{k: v for k, v in comum.items() if k not in {"configuracao_eletrica", "referencia_tensao"}},
        configuracao_eletrica=None,
        fases=2,
    ))
    esperado = 10000 / 220
    assert novo["corrente_projeto"] == pytest.approx(esperado, abs=0.01)
    assert legado["corrente_projeto"] == pytest.approx(esperado, abs=0.01)


def test_corrente_informada_e_potencia_mecanica_tem_semantica_explicita():
    por_corrente = calcular_circuito(circuito(
        modo_entrada="corrente_informada",
        corrente_informada=30,
        potencia_kw=0,
        fator_demanda=0.8,
    ))
    entrada = calcular_circuito(circuito(potencia_kw=9, fator_eficiencia=0.9, base_potencia="entrada_eletrica"))
    saida = calcular_circuito(circuito(potencia_kw=9, fator_eficiencia=0.9, base_potencia="saida_mecanica"))
    assert por_corrente["corrente_projeto"] == pytest.approx(24.0)
    assert saida["corrente_projeto"] > entrada["corrente_projeto"]


def test_fp_menor_nao_reduz_corrente():
    alto = calcular_circuito(circuito(fator_potencia=0.95))
    baixo = calcular_circuito(circuito(fator_potencia=0.65))
    assert baixo["corrente_projeto"] > alto["corrente_projeto"]


def test_distancia_maior_nao_reduz_queda_quando_secao_permanece_igual():
    curto = calcular_circuito(circuito(potencia_kw=2, fator_potencia=1, distancia_m=10))
    longo = calcular_circuito(circuito(potencia_kw=2, fator_potencia=1, distancia_m=20))
    assert longo["secao_mm2"] == curto["secao_mm2"]
    assert longo["queda_tensao_pct"] >= curto["queda_tensao_pct"]


def test_in_menor_que_ib_bloqueia():
    resultado = calcular_circuito(circuito(disjuntor_corrente_nominal=20))
    assert resultado["criterios"]["protection"]["status"] == "BLOCKED"
    assert resultado["resultado"]["status"] == "BLOCKED"


def test_in_maior_que_iz_corrigida_bloqueia():
    resultado = calcular_circuito(circuito(
        disjuntor_corrente_nominal=1000,
        agrupamento=9,
        metodo_instalacao="ELETRODUTO",
        tipo_cabo="CU-PVC",
    ))
    assert resultado["disjuntor_corrente_nominal"] > resultado["ampacidade_corrigida_total"]
    assert resultado["criterios"]["protection"]["status"] == "BLOCKED"


def test_protecao_e_curto_sem_dados_nao_sao_ok():
    resultado = calcular_circuito(circuito())
    assert resultado["criterios"]["protection"]["status"] == "NOT_EVALUATED"
    assert resultado["criterios"]["short_circuit"]["status"] == "NOT_EVALUATED"
    assert resultado["protecao_status"] != "OK"


def test_secao_final_e_maior_ou_igual_a_todos_criterios_aplicaveis():
    resultado = calcular_circuito(circuito(
        distancia_m=180,
        secao_minima_aplicacao=6,
        disjuntor_corrente_nominal=32,
        isc_local=8,
        tempo_atuacao=0.1,
        disjuntor_icu=10,
        disjuntor_curva="C",
        disjuntor_fabricante="Fabricante de referência",
    ))
    adotada = resultado["secao_mm2"]
    aplicaveis = [
        item["required_section_mm2"]
        for item in resultado["criterios"].values()
        if item["required_section_mm2"] is not None
    ]
    assert all(adotada >= secao for secao in aplicaveis)
    assert adotada == max(aplicaveis)
    assert resultado["decisao"]["adopted_section_mm2"] == adotada


def test_premissas_sao_expostas_e_entrada_essencial_ausente_bloqueia():
    sem_opcionais = circuito()
    del sem_opcionais.temp_ambiente
    del sem_opcionais.metodo_instalacao
    resultado = calcular_circuito(sem_opcionais)
    campos = {item["field"] for item in resultado["premissas"]}
    assert {"temp_ambiente", "metodo_instalacao"}.issubset(campos)

    bloqueado = calcular_circuito(circuito(potencia_kw=0, potencia_kva=None, corrente_informada=None))
    assert bloqueado["resultado"]["status"] == "BLOCKED"
    assert any(alerta["blocking"] for alerta in bloqueado["alertas"])
