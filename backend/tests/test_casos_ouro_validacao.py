"""Casos de ouro para validacao tecnica do CalcCabos.

Os casos sao pequenos e rastreaveis. Eles nao comprovam conformidade normativa
nem substituem validacao profissional do projeto.
"""

import json
import math
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.services.calculo import calcular_circuito
from app.services.projeto_eletrico import calcular_transformador


ROOT = Path(__file__).resolve().parents[2]
CASES_FILE = ROOT / "validation" / "golden-cases" / "casos_ouro.json"


def _namespace(data):
    defaults = {
        "descricao": "Caso de ouro",
        "tag": "GOLD-001",
        "potencia_kva": None,
        "corrente_informada": None,
        "comprimento_real": None,
        "isc_local": None,
        "tempo_atuacao": None,
        "disjuntor_corrente_nominal": None,
        "disjuntor_tensao_nominal": None,
        "disjuntor_icu": None,
        "disjuntor_curva": None,
        "disjuntor_fabricante": None,
        "modo_dimensionamento": "manual",
        "modo_selecao_componentes": "manual",
    }
    defaults.update(data)
    return SimpleNamespace(**defaults)


def _get_path(data, dotted):
    current = data
    for part in dotted.split("."):
        current = current[part]
    return current


@pytest.fixture(scope="module")
def golden_cases():
    with CASES_FILE.open("r", encoding="utf-8") as fh:
        return json.load(fh)["cases"]


@pytest.mark.parametrize("case_id", [
    "aula2-trifasico-potencia-ativa-4500w-440v-fp085",
    "aula2-motor-potencia-util-1000kw-4kv-fp085-eta09",
])
def test_casos_ouro_corrente(case_id, golden_cases):
    case = next(item for item in golden_cases if item["id"] == case_id)
    resultado = calcular_circuito(_namespace(case["input"]))

    for field, expected in case["expected"].items():
        tolerance = case.get("tolerance", {}).get(field, 0.0)
        assert resultado[field] == pytest.approx(expected, abs=tolerance)


def test_caso_ouro_transformador(golden_cases):
    case = next(item for item in golden_cases if item["id"] == "aula2-transformador-1000kva-13800-220")
    resultado = calcular_transformador(case["input"])

    for field, expected in case["expected"].items():
        tolerance = case.get("tolerance", {}).get(field, 0.0)
        assert resultado[field] == pytest.approx(expected, abs=tolerance)


def test_caso_ouro_protecao_sem_dados_nao_avaliada(golden_cases):
    case = next(item for item in golden_cases if item["id"] == "protecao-sem-dados-nao-avaliada")
    resultado = calcular_circuito(_namespace(case["input"]))

    for field, expected in case["expected"].items():
        assert _get_path(resultado, field) == expected
    assert resultado["protecao_status"] != "OK"


def test_caso_ouro_secao_final_maior_criterio_aplicavel(golden_cases):
    case = next(item for item in golden_cases if item["id"] == "secao-final-maior-criterio-aplicavel")
    resultado = calcular_circuito(_namespace(case["input"]))
    aplicaveis = [
        criterio["required_section_mm2"]
        for criterio in resultado["criterios"].values()
        if criterio["required_section_mm2"] is not None
    ]

    assert aplicaveis
    assert resultado["secao_mm2"] == max(aplicaveis)
    assert resultado["decisao"]["adopted_section_mm2"] == resultado["secao_mm2"]


def test_caso_ouro_formula_manual_trifasica_permanece_rastreavel(golden_cases):
    case = next(item for item in golden_cases if item["id"] == "aula2-trifasico-potencia-ativa-4500w-440v-fp085")
    entrada = case["input"]
    esperado_manual = entrada["potencia_kw"] * 1000 / (
        math.sqrt(3) * entrada["tensao"] * entrada["fator_potencia"]
    )
    assert esperado_manual == pytest.approx(case["expected"]["corrente_projeto"], abs=0.001)
