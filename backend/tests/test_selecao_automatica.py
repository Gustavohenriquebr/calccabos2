import unittest
from types import SimpleNamespace

from app.services.calculo import calcular_circuito


def circuito_base(**overrides):
    dados = {
        "descricao": "Alimentador geral",
        "tag": "C-001",
        "tensao": 380,
        "potencia_kw": 15,
        "potencia_kva": None,
        "fator_potencia": 0.86,
        "fator_eficiencia": 1.0,
        "fator_demanda": 1.0,
        "distancia_m": 60,
        "comprimento_real": None,
        "tipo_cabo": "CU-XLPE",
        "temp_ambiente": 30,
        "fases": 3,
        "agrupamento": 1,
        "formacao": 1,
        "metodo_instalacao": "TRAY",
        "corrente_ac_dc": "AC",
        "isc_local": 10,
        "tempo_atuacao": 0.1,
        "queda_tensao_alimentador": 0,
        "disjuntor_corrente_nominal": 16,
        "disjuntor_tensao_nominal": 380,
        "disjuntor_icu": 6,
        "disjuntor_curva": "C",
        "disjuntor_fabricante": "Teste",
    }
    dados.update(overrides)
    return SimpleNamespace(**dados)


class SelecaoAutomaticaTest(unittest.TestCase):
    def test_projeto_antigo_sem_modo_nao_quebra_e_fica_manual(self):
        c = circuito_base()
        resultado = calcular_circuito(c, "industrial")
        self.assertEqual(resultado["modo_dimensionamento"], "manual")
        self.assertEqual(resultado["disjuntor_corrente_nominal"], 16)

    def test_manual_preserva_disjuntor_informado(self):
        c = circuito_base(modo_dimensionamento="manual", disjuntor_corrente_nominal=16)
        resultado = calcular_circuito(c, "industrial")
        self.assertEqual(resultado["disjuntor_corrente_nominal"], 16)
        self.assertNotEqual(resultado["protecao_status"], "OK")

    def test_automatico_respeita_in_iz_icu_e_curva_c_em_carga_geral(self):
        c = circuito_base(modo_dimensionamento="automatico")
        resultado = calcular_circuito(c, "industrial")
        ib = resultado["corrente_projeto"]
        iz = resultado["cabo_sugerido_ampacidade"]
        in_disj = resultado["disjuntor_sugerido_in"]
        icu = resultado["disjuntor_sugerido_icu"]
        self.assertGreaterEqual(in_disj, ib)
        self.assertLessEqual(in_disj, iz)
        self.assertGreaterEqual(icu, c.isc_local)
        self.assertEqual(resultado["disjuntor_sugerido_curva"], "C")
        self.assertLessEqual(resultado["queda_tensao_acumulada"], resultado["queda_tensao_max"])

    def test_automatico_motor_recebe_curva_d(self):
        c = circuito_base(descricao="Motor bomba", tag="M-101", fator_eficiencia=0.94, modo_dimensionamento="automatico")
        resultado = calcular_circuito(c, "industrial")
        self.assertEqual(resultado["disjuntor_sugerido_curva"], "D")

    def test_automatico_aumenta_cabo_para_manter_in_menor_ou_igual_iz(self):
        c = circuito_base(
            modo_dimensionamento="automatico",
            tipo_cabo="CU-PVC",
            potencia_kw=43,
            fator_potencia=1.0,
            fator_eficiencia=1.0,
            distancia_m=20,
            isc_local=1,
        )
        resultado = calcular_circuito(c, "industrial")
        self.assertEqual(resultado["disjuntor_sugerido_in"], 80)
        self.assertGreaterEqual(resultado["cabo_sugerido_ampacidade"], resultado["disjuntor_sugerido_in"])
        self.assertEqual(resultado["cabo_sugerido_secao"], 25)

    def test_automatico_sem_icu_compativel_vira_critico_com_motivo(self):
        c = circuito_base(modo_dimensionamento="automatico", isc_local=130)
        resultado = calcular_circuito(c, "industrial")
        self.assertEqual(resultado["selecao_componentes_status"], "CRITICO")
        self.assertIn("Nenhum Icu comercial atende", resultado["selecao_componentes_justificativa"])
        self.assertIn(resultado["status"], ("erro", "alerta"))


if __name__ == "__main__":
    unittest.main()
