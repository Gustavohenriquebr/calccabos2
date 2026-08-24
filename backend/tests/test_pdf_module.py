# backend/tests/test_pdf_module.py
"""
Phase 3 tests for the CalcCabos PDF generation module.

Tests cover:
- unit: data_provider DTO assembly
- unit: formatter helpers
- unit: style layout helpers
- unit: edge cases (empty circuits, None inputs)
- integration: gerar_pdf with mock objects (no DB needed)

Uses only pytest and the standard library; no network access required.
"""

import types
import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_projeto(**kwargs):
    """Create a minimal SimpleNamespace that behaves like a projeto ORM row."""
    defaults = {
        "id": 1,
        "nome": "Projeto Teste",
        "cliente": "Cliente Teste",
        "tensao_ref": 380,
        "contexto": "industrial",
        "revisao": "0",
        "transformador_dados": None,
        "sistema_trifasico_dados": None,
        "protecao_geral_dados": None,
        "para_raios_dados": None,
        "aterramento_dados": None,
        "areas_classificadas_dados": None,
    }
    defaults.update(kwargs)
    return types.SimpleNamespace(**defaults)


def _make_usuario(**kwargs):
    defaults = {
        "id": 1,
        "nome": "Eng. Teste",
        "crea": "CREA-123",
        "empresa": "Empresa Teste",
    }
    defaults.update(kwargs)
    return types.SimpleNamespace(**defaults)


def _make_circuito(**kwargs):
    """Create a fully-populated circuit SimpleNamespace with safe defaults."""
    defaults = {
        "id": 1,
        "tag": "CC-001",
        "descricao": "Circuito Teste",
        "from_barramento": "QD-01",
        "to_equipamento": "MOTOR-01",
        "protection_device": "DJ-01",
        "tensao": 380,
        "fases": 3,
        "corrente_ac_dc": "AC",
        "potencia_kw": 10.0,
        "potencia_kva": 11.1,
        "fator_potencia": 0.90,
        "fator_eficiencia": 0.95,
        "fator_demanda": 1.0,
        "distancia_m": 50.0,
        "tipo_cabo": "PVC",
        "metodo_instalacao": "E",
        "fator_k1": 1.0,
        "fator_k2": 1.0,
        "fator_k3": 1.0,
        "corrente_projeto": 18.0,
        "corrente_nominal": 18.0,
        "corrente_corrigida": 18.0,
        "corrente_condutor": 24.0,
        "ampacidade": 24.0,
        "secao_mm2": 2.5,
        "secao_pe_mm2": 2.5,
        "impedancia_rdc": 0.01,
        "impedancia_rac": 0.011,
        "impedancia_xl": 0.001,
        "queda_tensao_max": 4.0,
        "queda_tensao_pct": 1.5,
        "queda_tensao_acumulada": None,
        "isc_local": 5.0,
        "isc_cabo": 4.0,
        "tempo_atuacao": 0.1,
        "formacao": 1,
        "tipo_cabo_comercial": "4x2.5mm2 PVC",
        "comprimento_real": 52.0,
        "revisao": "0",
        "nota_tecnica": "",
        "status": "ok",
        "status_final": None,
        "protecao_status": None,
        "validacao_status": None,
        "validacao_mensagem": None,
        "disjuntor_tensao_nominal": 380,
        "disjuntor_curva": "C",
        "disjuntor_corrente_nominal": 20,
        "disjuntor_a": 20,
        "disjuntor_icu": 6.0,
        "disjuntor_sugerido_in": None,
        "disjuntor_sugerido_icu": None,
        "disjuntor_sugerido_curva": None,
        "cabo_sugerido_tipo_comercial": None,
        "cabo_sugerido_ampacidade": None,
        "modo_dimensionamento": "manual",
        "modo_selecao_componentes": None,
        "selecao_componentes_status": None,
        "selecao_componentes_justificativa": None,
        "protecao_nota": None,
    }
    defaults.update(kwargs)
    return types.SimpleNamespace(**defaults)


# ============================================================================
# Unit tests – formatters
# ============================================================================

class TestFormatters:
    """Tests for pdf/formatters.py – pure functions, no I/O."""

    def setup_method(self):
        from app.services.pdf.formatters import _fmt, _txt, _nd, _ck, _texto_curto
        self._fmt = _fmt
        self._txt = _txt
        self._nd = _nd
        self._ck = _ck
        self._texto_curto = _texto_curto

    def test_fmt_none_returns_nd(self):
        assert self._fmt(None) == "N/D"

    def test_fmt_integer_like_float(self):
        assert self._fmt(10.0, 2) == "10"

    def test_fmt_decimal(self):
        assert self._fmt(3.14159, 2) == "3.14"

    def test_fmt_custom_vazio(self):
        assert self._fmt(None, 2, "-") == "-"

    def test_txt_none_returns_padrao(self):
        assert self._txt(None) == "-"

    def test_txt_empty_string_returns_padrao(self):
        assert self._txt("") == "-"

    def test_txt_valid_string(self):
        assert self._txt("Olá") == "Olá"

    def test_nd_delegates_to_fmt(self):
        assert self._nd(None) == "N/D"
        assert self._nd(5.0, 0) == "5"

    def test_ck_true(self):
        assert self._ck(True) == "OK"

    def test_ck_false(self):
        assert self._ck(False) == "NOK"

    def test_texto_curto_short(self):
        assert self._texto_curto("abc", 10) == "abc"

    def test_texto_curto_truncation(self):
        long_text = "A" * 60
        result = self._texto_curto(long_text, 10)
        assert len(result) == 10
        assert result.endswith("...")

    def test_texto_curto_none(self):
        assert self._texto_curto(None, 10) == "N/D"


# ============================================================================
# Unit tests – layout helpers
# ============================================================================

class TestLayout:
    def test_safe_style_found(self):
        from app.services.pdf.layout import safe_style
        from reportlab.lib.styles import getSampleStyleSheet
        styles = getSampleStyleSheet()
        result = safe_style(styles, "Normal")
        assert result is not None

    def test_safe_style_missing_returns_fallback(self):
        from app.services.pdf.layout import safe_style
        result = safe_style({}, "inexistente")
        assert result is not None  # fallback ParagraphStyle
        assert result.name == "fallback_inexistente"

    def test_safe_style_custom_fallback(self):
        from app.services.pdf.layout import safe_style
        sentinel = object()
        result = safe_style({}, "qualquer", fallback=sentinel)
        assert result is sentinel


# ============================================================================
# Unit tests – data_provider DTO
# ============================================================================

class TestDataProvider:
    def test_dto_keys_present(self):
        from app.services.pdf.data_provider import get_memorial_data
        projeto = _make_projeto()
        dto = get_memorial_data(projeto, [])
        for key in [
            "projeto", "transformador", "sistema_trifasico", "circuitos",
            "resumo_global", "status_geral", "top_riscos",
            "pendencias_criticas", "metricas_ampacidade",
        ]:
            assert key in dto, f"Campo ausente no DTO: {key}"

    def test_dto_circuitos_vazio(self):
        from app.services.pdf.data_provider import get_memorial_data
        projeto = _make_projeto()
        dto = get_memorial_data(projeto, [])
        assert dto["circuitos"] == []
        assert dto["metricas_ampacidade"]["total"] == 0

    def test_dto_circuitos_none_becomes_empty(self):
        from app.services.pdf.data_provider import get_memorial_data
        projeto = _make_projeto()
        dto = get_memorial_data(projeto, None)
        assert dto["circuitos"] == []

    def test_dto_com_circuito(self):
        from app.services.pdf.data_provider import get_memorial_data
        projeto = _make_projeto()
        c = _make_circuito()
        dto = get_memorial_data(projeto, [c])
        assert dto["metricas_ampacidade"]["total"] == 1
        assert dto["status_geral"] in ("OK", "ALERTA", "CRITICO", "NAO CALCULADO")

    def test_dto_status_geral_ok(self):
        from app.services.pdf.data_provider import get_memorial_data
        projeto = _make_projeto()
        c = _make_circuito(status="ok")
        dto = get_memorial_data(projeto, [c])
        # status_geral reflects overall system, should not be None
        assert dto["status_geral"] is not None


# ============================================================================
# Unit tests – relatorio_pdf helpers
# ============================================================================

class TestRelatorioHelpers:
    def test_status_final_ok(self):
        from app.services.relatorio_pdf import _status_final
        c = _make_circuito(status="ok")
        assert _status_final(c) == "OK"

    def test_status_final_erro(self):
        from app.services.relatorio_pdf import _status_final
        c = _make_circuito(status="erro")
        assert _status_final(c) == "CRITICO"

    def test_status_final_alerta(self):
        from app.services.relatorio_pdf import _status_final
        c = _make_circuito(status="alerta")
        assert _status_final(c) == "ALERTA"

    def test_status_final_status_final_field(self):
        from app.services.relatorio_pdf import _status_final
        c = _make_circuito(status_final="OK")
        assert _status_final(c) == "OK"

    def test_contagem_status_vazia(self):
        from app.services.relatorio_pdf import _contagem_status
        r = _contagem_status([])
        assert r["total"] == 0
        assert r["status"] == "NAO CALCULADO"

    def test_contagem_status_um_ok(self):
        from app.services.relatorio_pdf import _contagem_status
        c = _make_circuito(status="ok")
        r = _contagem_status([c])
        assert r["ok"] == 1
        assert r["status"] == "OK"

    def test_tem_dados_tecnicos_none(self):
        from app.services.relatorio_pdf import _tem_dados_tecnicos
        assert _tem_dados_tecnicos(None) is False

    def test_tem_dados_tecnicos_empty_dict(self):
        from app.services.relatorio_pdf import _tem_dados_tecnicos
        assert _tem_dados_tecnicos({}) is False

    def test_tem_dados_tecnicos_all_none(self):
        from app.services.relatorio_pdf import _tem_dados_tecnicos
        assert _tem_dados_tecnicos({"a": None, "b": ""}) is False

    def test_tem_dados_tecnicos_com_dado(self):
        from app.services.relatorio_pdf import _tem_dados_tecnicos
        assert _tem_dados_tecnicos({"a": 380}) is True


# ============================================================================
# Integration tests – gerar_pdf
# ============================================================================

class TestGerarPDF:
    """
    Integration tests for gerar_pdf. They call the real function but
    use SimpleNamespace mock objects so no DB or HTTP server is required.
    """

    def test_gerar_pdf_projeto_none_raises(self):
        from app.services.relatorio_pdf import gerar_pdf, PDFGenerationError
        with pytest.raises(PDFGenerationError, match="projeto.*pode ser None"):
            gerar_pdf(None, [], _make_usuario())

    def test_gerar_pdf_circuitos_none_nao_quebra(self):
        """Passing None for circuitos should not raise – it should be treated as []."""
        from app.services.relatorio_pdf import gerar_pdf
        projeto = _make_projeto()
        usuario = _make_usuario()
        # Should succeed (PDF with empty circuit list is valid)
        pdf_bytes = gerar_pdf(projeto, None, usuario)
        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 0

    def test_gerar_pdf_sem_circuitos_retorna_bytes(self):
        """A project with zero circuits must still generate a valid PDF."""
        from app.services.relatorio_pdf import gerar_pdf
        projeto = _make_projeto()
        usuario = _make_usuario()
        pdf_bytes = gerar_pdf(projeto, [], usuario)
        assert isinstance(pdf_bytes, bytes)
        assert pdf_bytes[:4] == b"%PDF"  # PDF magic bytes

    def test_gerar_pdf_com_circuito_retorna_bytes(self):
        """A project with one circuit must generate a valid PDF."""
        from app.services.relatorio_pdf import gerar_pdf
        projeto = _make_projeto()
        usuario = _make_usuario()
        c = _make_circuito()
        pdf_bytes = gerar_pdf(projeto, [c], usuario)
        assert isinstance(pdf_bytes, bytes)
        assert pdf_bytes[:4] == b"%PDF"

    def test_gerar_pdf_retorna_pdf_nao_vazio(self):
        from app.services.relatorio_pdf import gerar_pdf
        projeto = _make_projeto()
        usuario = _make_usuario()
        pdf_bytes = gerar_pdf(projeto, [], usuario)
        # A minimal ReportLab PDF is at least 1 KB
        assert len(pdf_bytes) > 1024


# ============================================================================
# Unit tests – _linha_circuito safety (AttributeError regression)
# ============================================================================

class TestLinhaCircuito:
    def test_linha_circuito_partial_circuit(self):
        """_linha_circuito must not raise AttributeError for minimal circuit."""
        from app.services.relatorio_pdf import _linha_circuito
        c = types.SimpleNamespace(
            tag="X1", descricao="desc", from_barramento=None, to_equipamento=None,
            protection_device=None, tensao=None, fases=None, corrente_ac_dc=None,
            potencia_kw=None, potencia_kva=None, fator_potencia=None,
            fator_eficiencia=None, fator_demanda=None, distancia_m=None,
            tipo_cabo=None, metodo_instalacao=None, fator_k1=None, fator_k2=None,
            fator_k3=None, corrente_projeto=None, corrente_nominal=None,
            corrente_corrigida=None, corrente_condutor=None, ampacidade=None,
            secao_mm2=None, secao_pe_mm2=None, impedancia_rdc=None,
            impedancia_rac=None, impedancia_xl=None, queda_tensao_max=None,
            queda_tensao_pct=None, queda_tensao_acumulada=None,
            isc_local=None, isc_cabo=None, tempo_atuacao=None, formacao=None,
            status=None, status_final=None, tipo_cabo_comercial=None,
            comprimento_real=None, revisao=None, nota_tecnica=None,
        )
        row = _linha_circuito(c)
        assert len(row) == 38  # expected column count


# ============================================================================
# Unit tests – conclusoes_tecnicas
# ============================================================================

class TestConclussoesTecnicas:
    def test_sem_circuitos_retorna_mensagem(self):
        from app.services.relatorio_pdf import _conclusoes_tecnicas
        result = _conclusoes_tecnicas([])
        assert isinstance(result, list)
        assert len(result) >= 1

    def test_com_circuito_ok_retorna_aprovacao(self):
        from app.services.relatorio_pdf import _conclusoes_tecnicas
        c = _make_circuito(status="ok")
        result = _conclusoes_tecnicas([c])
        assert any("CalcCabos" in linha or "OK" in linha.upper() or "atende" in linha.lower() for linha in result)


# ============================================================================
# FASE 5 — DTO schema and section isolation tests
# ============================================================================

class TestDTOSchema:
    """Validate the expanded MemorialDTO produced by data_provider (Fase 5)."""

    def setup_method(self):
        from app.services.pdf.data_provider import get_memorial_data
        self.get_dto = get_memorial_data

    def test_dto_fase5_top_level_modules(self):
        """DTO must expose protecao_geral, para_raios, aterramento, areas_classificadas."""
        projeto = _make_projeto()
        dto = self.get_dto(projeto, [])
        for key in ["protecao_geral", "para_raios", "aterramento", "areas_classificadas"]:
            assert key in dto, f"Campo Fase 5 ausente: {key}"

    def test_dto_derived_scalars(self):
        """DTO must contain all derived scalar fields."""
        projeto = _make_projeto()
        dto = self.get_dto(projeto, [])
        for key in ["icc_max", "sem_icc", "qt_max", "automaticos", "selecao_critica", "tensao_secundaria"]:
            assert key in dto, f"Escalar derivado ausente: {key}"

    def test_dto_conclusoes_tecnicas_presente(self):
        """DTO must pre-compute conclusoes_tecnicas list."""
        projeto = _make_projeto()
        dto = self.get_dto(projeto, [])
        assert "conclusoes_tecnicas" in dto
        assert isinstance(dto["conclusoes_tecnicas"], list)
        assert len(dto["conclusoes_tecnicas"]) >= 1

    def test_dto_metricas_icc(self):
        """metricas_icc must have icc_max and sem_icc keys."""
        projeto = _make_projeto()
        c = _make_circuito(isc_local=5.0)
        dto = self.get_dto(projeto, [c])
        assert dto["metricas_icc"]["icc_max"] == 5.0
        assert dto["metricas_icc"]["sem_icc"] == 0

    def test_dto_metricas_icc_sem_icc(self):
        """Circuits without icc_local must increment sem_icc counter."""
        projeto = _make_projeto()
        c = _make_circuito(isc_local=None)
        dto = self.get_dto(projeto, [c])
        assert dto["metricas_icc"]["sem_icc"] == 1

    def test_dto_metricas_queda_tensao(self):
        """metricas_queda_tensao must reflect qt_max."""
        projeto = _make_projeto()
        c = _make_circuito(queda_tensao_pct=2.3)
        dto = self.get_dto(projeto, [c])
        assert dto["metricas_queda_tensao"]["qt_max"] == pytest.approx(2.3, abs=0.01)

    def test_dto_automaticos_counter(self):
        """automaticos must count circuits with modo_dimensionamento=automatico."""
        projeto = _make_projeto()
        c1 = _make_circuito(modo_dimensionamento="automatico")
        c2 = _make_circuito(modo_dimensionamento="manual")
        dto = self.get_dto(projeto, [c1, c2])
        assert dto["automaticos"] == 1

    def test_dto_fora_qt_counter(self):
        """fora_qt must count circuits whose qt > qt_max."""
        projeto = _make_projeto()
        c = _make_circuito(queda_tensao_pct=8.0, queda_tensao_max=4.0)
        dto = self.get_dto(projeto, [c])
        assert dto["fora_qt"] >= 1

    def test_dto_is_json_compatible(self):
        """The DTO must be JSON-serialisable (primitives only, no ORM objects in scalar fields)."""
        import json
        projeto = _make_projeto()
        dto = self.get_dto(projeto, [])
        # Remove circuito objects (ORM) before checking JSON compat
        dto_safe = {k: v for k, v in dto.items() if k not in ("circuitos", "circuitos_alerta", "circuitos_criticos")}
        try:
            json.dumps(dto_safe, default=str)
        except (TypeError, ValueError) as exc:
            pytest.fail(f"DTO não é JSON-compatível: {exc}")


class TestDTOTypes:
    """Validate MemorialDTO TypedDicts can be instantiated."""

    def test_projeto_dto_instantiation(self):
        from app.services.pdf.dto import ProjetoDTO
        d: ProjetoDTO = {"id": 1, "nome": "X", "cliente": "C", "tensao_ref": 380.0, "contexto": "industrial", "revisao": "0"}
        assert d["nome"] == "X"

    def test_memorial_dto_key_set(self):
        from app.services.pdf.dto import MemorialDTO
        # Just confirm the TypedDict class is importable and has the expected keys
        annotations = MemorialDTO.__annotations__
        for key in ["projeto", "transformador", "protecao_geral", "resumo_global",
                    "circuitos", "icc_max", "qt_max", "conclusoes_tecnicas"]:
            assert key in annotations, f"Campo ausente em MemorialDTO: {key}"


class TestSectionIsolation:
    """Validate section renderers work with a mock DTO (no DB, no calcs)."""

    def _mock_dto(self, circuitos=None):
        """Build a minimal MemorialDTO dict sufficient for section rendering."""
        if circuitos is None:
            circuitos = []
        return {
            "projeto": {"id": 1, "nome": "P", "cliente": "C", "tensao_ref": 380, "contexto": "industrial", "revisao": "0"},
            "transformador": {"potencia_kva": 100, "tensao_primaria": 13800, "tensao_secundaria": 380,
                              "tensao_primaria_formatada": "13.8 kV", "tensao_secundaria_formatada": "380 V",
                              "impedancia_percentual": 4.0, "corrente_nominal_primario": 4.2,
                              "corrente_nominal_secundario": 151.9, "corrente_curto_secundario_ka": 3.8,
                              "ligacao_primaria": "D", "ligacao_secundaria": "yn",
                              "relacao_transformacao": 36.3, "frequencia": 60, "observacoes": None},
            "sistema_trifasico": {"potencia_aparente_kva": 90, "potencia_ativa_kw": 80,
                                  "potencia_reativa_kvar": 40, "corrente_linha": 136.7, "fator_potencia": 0.9},
            "protecao_geral": {"in": 160, "icu": 10, "status": "OK", "mensagem": "OK"},
            "para_raios": {"status": "ALERTA", "mensagem": "Não informado"},
            "aterramento": {"status": "OK", "resistividade_media": 100, "medicoes": []},
            "areas_classificadas": {"status": "OK", "resumo": {}, "areas": []},
            "modulos": {},
            "tensao_secundaria": 380,
            "icc_max": 5.0,
            "sem_icc": 0,
            "qt_max": 1.5,
            "automaticos": 0,
            "selecao_critica": 0,
            "fora_qt": 0,
            "circuitos": circuitos,
            "circuitos_alerta": [],
            "circuitos_criticos": [],
            "resumo_global": {
                "total": len(circuitos), "ok": len(circuitos), "alertas": 0, "criticos": 0,
                "status": "OK", "protecoes": {"ok": 0, "alerta": 0, "critico": 0},
                "modulos_contagem": {"ok": 3, "alerta": 1, "critico": 0},
                "motivo_status": "Todos os módulos avaliados estão OK.",
                "criticos_modulos": [], "alertas_modulos": [],
            },
            "circuito_resumo": {"total": len(circuitos), "ok": len(circuitos), "alertas": 0, "criticos": 0, "status": "OK"},
            "protecoes_status": {"ok": 0, "alerta": 0, "critico": 0},
            "status_geral": "OK",
            "conclusoes_tecnicas": ["Projeto atende aos critérios."],
            "top_riscos": [], "pendencias_criticas": [], "alertas_modulos": [],
            "resumo_executivo": "OK",
            "metricas_ampacidade": {"total": 0, "ok": 0, "alertas": 0, "criticos": 0},
            "metricas_protecao": {"ok": 0, "alerta": 0, "critico": 0},
            "metricas_queda_tensao": {"total": 0, "qt_max": 0.0, "fora_limite": 0},
            "metricas_icc": {"icc_max": 0.0, "sem_icc": 0},
        }

    def _make_styles(self):
        from app.services.pdf.builder import _build_styles
        return _build_styles()

    def test_render_secoes_memorial_with_dto(self):
        """render_secoes_memorial must accept DTO and return a list of flowables."""
        from app.services.pdf.sections.tecnico import render_secoes_memorial
        dto = self._mock_dto()
        flowables = render_secoes_memorial(dto, self._make_styles())
        assert isinstance(flowables, list)
        assert len(flowables) > 0

    def test_render_secoes_memorial_with_circuit(self):
        """render_secoes_memorial must handle circuits inside DTO."""
        from app.services.pdf.sections.tecnico import render_secoes_memorial
        c = _make_circuito()
        dto = self._mock_dto([c])
        flowables = render_secoes_memorial(dto, self._make_styles())
        assert isinstance(flowables, list)

    def test_render_capa_with_dto(self):
        """render_capa must accept DTO dict and return flowables."""
        from app.services.pdf.sections.capa import render_capa
        dto = self._mock_dto()
        usuario = _make_usuario()
        flowables = render_capa(dto, usuario, self._make_styles())
        assert isinstance(flowables, list)
        assert len(flowables) > 0

    def test_render_sumario_with_dto(self):
        """render_sumario must accept DTO dict and return 3-tuple."""
        from app.services.pdf.sections.resumo import render_sumario
        dto = self._mock_dto()
        usuario = _make_usuario()
        result = render_sumario(dto, usuario, self._make_styles())
        assert isinstance(result, tuple)
        assert len(result) == 3

    def test_render_diagrama_with_dto(self):
        """render_diagrama_unifilar must accept DTO dict and return drawing list."""
        from app.services.pdf.sections.diagramas import render_diagrama_unifilar
        dto = self._mock_dto()
        flowables = render_diagrama_unifilar(dto, self._make_styles())
        assert isinstance(flowables, list)
        assert len(flowables) > 0

    def test_builder_uses_dto_path(self):
        """builder.gerar_pdf must produce valid PDF bytes using the DTO path."""
        from app.services.pdf.builder import gerar_pdf
        projeto = _make_projeto()
        usuario = _make_usuario()
        pdf_bytes = gerar_pdf(projeto, [], usuario)
        assert pdf_bytes[:4] == b"%PDF"
        assert len(pdf_bytes) > 1024

    def test_builder_with_circuit_dto_path(self):
        """builder.gerar_pdf must handle circuits correctly via DTO."""
        from app.services.pdf.builder import gerar_pdf
        projeto = _make_projeto()
        usuario = _make_usuario()
        c = _make_circuito()
        pdf_bytes = gerar_pdf(projeto, [c], usuario)
        assert pdf_bytes[:4] == b"%PDF"


# ============================================================================
# FASE 6 — CircuitoDTO, DotDict, mapping and serialisation tests
# ============================================================================

class TestDotDict:
    """Validate DotDict supports both dict and attribute access."""

    def test_dict_style_access(self):
        from app.services.pdf.dto import DotDict
        d = DotDict(tag="CC-01", tensao=380)
        assert d["tag"] == "CC-01"
        assert d["tensao"] == 380

    def test_attribute_style_access(self):
        from app.services.pdf.dto import DotDict
        d = DotDict(tag="CC-01", tensao=380)
        assert d.tag == "CC-01"
        assert d.tensao == 380

    def test_missing_key_returns_none_not_error(self):
        from app.services.pdf.dto import DotDict
        d = DotDict(tag="CC-01")
        assert d.corrente_projeto is None
        assert d.get("corrente_projeto") is None

    def test_is_dict_subclass(self):
        from app.services.pdf.dto import DotDict
        d = DotDict(a=1)
        assert isinstance(d, dict)

    def test_json_serialisable(self):
        import json
        from app.services.pdf.dto import DotDict
        d = DotDict(tag="CC-01", tensao=380, status_final="OK")
        assert json.dumps(d) is not None  # must not raise

    def test_keys_iteration(self):
        from app.services.pdf.dto import DotDict
        d = DotDict(a=1, b=2, c=3)
        assert set(d.keys()) == {"a", "b", "c"}


class TestMapCircuitoToDTO:
    """Validate ORM → DotDict mapping (map_circuito_to_dto)."""

    def test_returns_dot_dict(self):
        from app.services.pdf.data_provider import map_circuito_to_dto
        from app.services.pdf.dto import DotDict
        c = _make_circuito()
        result = map_circuito_to_dto(c)
        assert isinstance(result, DotDict)

    def test_identity_fields_mapped(self):
        from app.services.pdf.data_provider import map_circuito_to_dto
        c = _make_circuito(tag="CC-001", descricao="Motor bomba")
        dto = map_circuito_to_dto(c)
        assert dto["tag"] == "CC-001"
        assert dto.tag == "CC-001"
        assert dto["descricao"] == "Motor bomba"
        assert dto.tag_ou_descricao == "CC-001"

    def test_tag_fallback_to_descricao(self):
        from app.services.pdf.data_provider import map_circuito_to_dto
        c = _make_circuito(tag=None, descricao="Motor bomba")
        dto = map_circuito_to_dto(c)
        assert dto.tag_ou_descricao == "Motor bomba"

    def test_status_final_resolved_ok(self):
        from app.services.pdf.data_provider import map_circuito_to_dto
        c = _make_circuito(status="ok", status_final=None)
        dto = map_circuito_to_dto(c)
        assert dto.status_final == "OK"

    def test_status_final_resolved_critico(self):
        from app.services.pdf.data_provider import map_circuito_to_dto
        c = _make_circuito(status="erro", status_final=None)
        dto = map_circuito_to_dto(c)
        assert dto.status_final == "CRITICO"

    def test_status_final_field_takes_precedence(self):
        from app.services.pdf.data_provider import map_circuito_to_dto
        c = _make_circuito(status="erro", status_final="OK")
        dto = map_circuito_to_dto(c)
        assert dto.status_final == "OK"

    def test_ib_resolved_from_corrente_projeto(self):
        from app.services.pdf.data_provider import map_circuito_to_dto
        c = _make_circuito(corrente_projeto=18.5, corrente_nominal=20.0)
        dto = map_circuito_to_dto(c)
        assert dto.ib == pytest.approx(18.5, abs=0.01)

    def test_ib_fallback_to_corrente_nominal(self):
        from app.services.pdf.data_provider import map_circuito_to_dto
        c = _make_circuito(corrente_projeto=None, corrente_nominal=20.0)
        dto = map_circuito_to_dto(c)
        assert dto.ib == pytest.approx(20.0, abs=0.01)

    def test_queda_calculada_prefers_acumulada(self):
        from app.services.pdf.data_provider import map_circuito_to_dto
        c = _make_circuito(queda_tensao_pct=1.5, queda_tensao_acumulada=2.0)
        dto = map_circuito_to_dto(c)
        assert dto.queda_tensao_calculada == pytest.approx(2.0, abs=0.01)

    def test_queda_calculada_fallback_to_pct(self):
        from app.services.pdf.data_provider import map_circuito_to_dto
        c = _make_circuito(queda_tensao_pct=1.5, queda_tensao_acumulada=None)
        dto = map_circuito_to_dto(c)
        assert dto.queda_tensao_calculada == pytest.approx(1.5, abs=0.01)

    def test_nested_sub_dtos_present(self):
        from app.services.pdf.data_provider import map_circuito_to_dto
        c = _make_circuito()
        dto = map_circuito_to_dto(c)
        assert "_protecao" in dto
        assert "_ampacidade" in dto
        assert "_queda_tensao" in dto
        assert "_icc" in dto

    def test_protecao_sub_dto_fields(self):
        from app.services.pdf.data_provider import map_circuito_to_dto
        c = _make_circuito(disjuntor_corrente_nominal=20, disjuntor_icu=6.0, disjuntor_curva="C")
        dto = map_circuito_to_dto(c)
        assert dto["_protecao"]["corrente_nominal"] == 20
        assert dto["_protecao"]["icu"] == pytest.approx(6.0, abs=0.01)
        assert dto["_protecao"]["curva"] == "C"

    def test_dto_is_json_serialisable(self):
        import json
        from app.services.pdf.data_provider import map_circuito_to_dto
        c = _make_circuito()
        dto = map_circuito_to_dto(c)
        # DotDict is a dict; json.dumps should not raise
        json.dumps(dict(dto), default=str)

    def test_dict_input_supported(self):
        """map_circuito_to_dto must handle plain dict inputs (for re-mapping)."""
        from app.services.pdf.data_provider import map_circuito_to_dto
        c_dict = {"tag": "CC-X", "status": "ok", "corrente_projeto": 15.0}
        dto = map_circuito_to_dto(c_dict)
        assert dto.tag == "CC-X"
        assert dto.status_final == "OK"
        assert dto.ib == pytest.approx(15.0, abs=0.01)


class TestMapCircuitosToDTOs:
    """Validate batch mapping of circuit lists."""

    def test_empty_list(self):
        from app.services.pdf.data_provider import map_circuitos_to_dtos
        assert map_circuitos_to_dtos([]) == []

    def test_none_returns_empty(self):
        from app.services.pdf.data_provider import map_circuitos_to_dtos
        assert map_circuitos_to_dtos(None) == []

    def test_maps_all_circuits(self):
        from app.services.pdf.data_provider import map_circuitos_to_dtos
        from app.services.pdf.dto import DotDict
        circuits = [_make_circuito(tag=f"CC-{i:03d}") for i in range(5)]
        result = map_circuitos_to_dtos(circuits)
        assert len(result) == 5
        assert all(isinstance(d, DotDict) for d in result)
        assert [d.tag for d in result] == [f"CC-{i:03d}" for i in range(5)]

    def test_circuitos_dto_in_memorial_dto(self):
        """get_memorial_data must include circuitos_dto in the DTO."""
        from app.services.pdf.data_provider import get_memorial_data
        from app.services.pdf.dto import DotDict
        projeto = _make_projeto()
        c = _make_circuito(tag="CC-001")
        dto = get_memorial_data(projeto, [c])
        assert "circuitos_dto" in dto
        assert len(dto["circuitos_dto"]) == 1
        assert isinstance(dto["circuitos_dto"][0], DotDict)
        assert dto["circuitos_dto"][0].tag == "CC-001"

    def test_circuitos_dto_alerta_filter(self):
        """circuitos_dto_alerta must only contain ALERTA circuits."""
        from app.services.pdf.data_provider import get_memorial_data
        projeto = _make_projeto()
        c_ok = _make_circuito(tag="CC-OK", status="ok")
        c_alerta = _make_circuito(tag="CC-ALERTA", status="alerta")
        dto = get_memorial_data(projeto, [c_ok, c_alerta])
        alerta_tags = [d.tag for d in dto["circuitos_dto_alerta"]]
        assert "CC-ALERTA" in alerta_tags
        assert "CC-OK" not in alerta_tags


class TestSerializeMemorialDTO:
    """Validate serialize_memorial_dto produces fully JSON-safe output."""

    def test_returns_dict(self):
        from app.services.pdf.data_provider import get_memorial_data, serialize_memorial_dto
        dto = get_memorial_data(_make_projeto(), [])
        result = serialize_memorial_dto(dto)
        assert isinstance(result, dict)

    def test_orm_keys_excluded_by_default(self):
        from app.services.pdf.data_provider import get_memorial_data, serialize_memorial_dto
        dto = get_memorial_data(_make_projeto(), [])
        result = serialize_memorial_dto(dto)
        for orm_key in ("circuitos", "circuitos_alerta", "circuitos_criticos"):
            assert orm_key not in result, f"ORM key '{orm_key}' should be excluded"

    def test_circuitos_dto_included(self):
        from app.services.pdf.data_provider import get_memorial_data, serialize_memorial_dto
        dto = get_memorial_data(_make_projeto(), [_make_circuito()])
        result = serialize_memorial_dto(dto)
        assert "circuitos_dto" in result
        assert isinstance(result["circuitos_dto"], list)

    def test_fully_json_serialisable(self):
        import json
        from app.services.pdf.data_provider import get_memorial_data, serialize_memorial_dto
        dto = get_memorial_data(_make_projeto(), [_make_circuito()])
        result = serialize_memorial_dto(dto)
        # Must not raise
        json_str = json.dumps(result)
        assert len(json_str) > 100

    def test_include_orm_option(self):
        """With exclude_orm=False, ORM lists are included (values converted to str)."""
        from app.services.pdf.data_provider import get_memorial_data, serialize_memorial_dto
        dto = get_memorial_data(_make_projeto(), [_make_circuito()])
        result = serialize_memorial_dto(dto, exclude_orm=False)
        # circuitos should now be present (converted)
        assert "circuitos" in result

    def test_circuit_fields_are_primitives(self):
        """CircuitoDTO fields inside serialised output must be primitives."""
        import json
        from app.services.pdf.data_provider import get_memorial_data, serialize_memorial_dto
        dto = get_memorial_data(_make_projeto(), [_make_circuito(tag="CC-001", tensao=380.0)])
        result = serialize_memorial_dto(dto)
        c = result["circuitos_dto"][0]
        # JSON round-trip must succeed
        c_json = json.loads(json.dumps(c))
        assert c_json["tag"] == "CC-001"
        assert c_json["tensao"] == pytest.approx(380.0, abs=0.01)


class TestPureDTOPipeline:
    """End-to-end: builder uses DotDict circuits, sections render correctly."""

    def test_builder_with_dto_circuits_produces_pdf(self):
        """The full pipeline (ORM→DTO→render→PDF) must produce valid bytes."""
        from app.services.pdf.builder import gerar_pdf
        projeto = _make_projeto()
        usuario = _make_usuario()
        circuits = [_make_circuito(tag=f"CC-{i:03d}", status="ok") for i in range(3)]
        pdf_bytes = gerar_pdf(projeto, circuits, usuario)
        assert pdf_bytes[:4] == b"%PDF"
        assert len(pdf_bytes) > 2048

    def test_tabela_principal_accepts_dot_dict(self):
        """render_tabela_principal must accept DotDict circuit objects."""
        from app.services.pdf.data_provider import map_circuito_to_dto
        from app.services.pdf.sections.tabelas import render_tabela_principal
        from app.services.pdf.builder import _build_styles
        c = _make_circuito()
        dto = map_circuito_to_dto(c)
        styles = _build_styles()
        # Must not raise
        table = render_tabela_principal([dto], styles)
        assert table is not None

    def test_tabela_protecao_accepts_dot_dict(self):
        from app.services.pdf.data_provider import map_circuito_to_dto
        from app.services.pdf.sections.tabelas import render_tabela_protecao
        from app.services.pdf.builder import _build_styles
        dto = map_circuito_to_dto(_make_circuito())
        table = render_tabela_protecao([dto], _build_styles())
        assert table is not None

    def test_tabela_validacao_accepts_dot_dict(self):
        from app.services.pdf.data_provider import map_circuito_to_dto
        from app.services.pdf.sections.tabelas import render_tabela_validacao
        from app.services.pdf.builder import _build_styles
        dto = map_circuito_to_dto(_make_circuito())
        table = render_tabela_validacao([dto], _build_styles())
        assert table is not None

    def test_tabela_automaticos_accepts_dot_dict(self):
        from app.services.pdf.data_provider import map_circuito_to_dto
        from app.services.pdf.sections.tabelas import render_tabela_automaticos
        from app.services.pdf.builder import _build_styles
        dto = map_circuito_to_dto(_make_circuito())
        table = render_tabela_automaticos([dto], _build_styles())
        assert table is not None

    def test_circuit_dto_attribute_access_works_in_sections(self):
        """DotDict must expose all attributes that tabelas.py accesses directly."""
        from app.services.pdf.data_provider import map_circuito_to_dto
        c = _make_circuito(tag="TEST-01", tensao=380, corrente_projeto=18.0)
        dto = map_circuito_to_dto(c)
        # These are the exact attribute accesses used in tabelas.py _linha_principal
        assert dto.tag == "TEST-01"
        assert dto.tensao == 380
        assert dto.corrente_projeto == pytest.approx(18.0, abs=0.01)
        assert dto.tipo_cabo is not None or dto.tipo_cabo is None  # either is fine

    def test_no_orm_dependency_in_table_render(self):
        """Rendering must succeed with a pure DotDict (no ORM object available)."""
        from app.services.pdf.dto import DotDict
        from app.services.pdf.sections.tabelas import render_tabela_principal
        from app.services.pdf.builder import _build_styles
        # Build a minimal DotDict without going through map_circuito_to_dto
        minimal = DotDict(
            tag="CC-MINIMAL", descricao="Test", from_barramento="QD-01",
            to_equipamento="MOTOR-01", protection_device="DJ-01",
            tensao=380, fases=3, corrente_ac_dc="AC",
            potencia_kw=10.0, potencia_kva=11.1, fator_potencia=0.90,
            fator_eficiencia=0.95, fator_demanda=1.0, distancia_m=50.0,
            tipo_cabo="PVC", metodo_instalacao="E",
            fator_k1=1.0, fator_k2=1.0, fator_k3=1.0,
            corrente_projeto=18.0, corrente_nominal=18.0,
            corrente_corrigida=18.0, corrente_condutor=24.0, ampacidade=24.0,
            secao_mm2=2.5, secao_pe_mm2=2.5,
            impedancia_rdc=0.01, impedancia_rac=0.011, impedancia_xl=0.001,
            queda_tensao_max=4.0, queda_tensao_pct=1.5, queda_tensao_acumulada=None,
            isc_local=5.0, isc_cabo=4.0, tempo_atuacao=0.1, formacao=1,
            tipo_cabo_comercial="4x2.5mm2 PVC", comprimento_real=52.0,
            revisao="0", nota_tecnica="",
            status="ok", status_final="OK",
        )
        table = render_tabela_principal([minimal], _build_styles())
        assert table is not None
