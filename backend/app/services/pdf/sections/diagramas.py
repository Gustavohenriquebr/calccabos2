# backend/app/services/pdf/sections/diagramas.py
"""Single-line diagram renderer for the CalcCabos memorial PDF."""
from __future__ import annotations
from typing import Any, List

from reportlab.graphics.shapes import Drawing, Line, Rect, String
from reportlab.lib import colors
from reportlab.lib.units import cm

from app.services.pdf.estilos import PETROBRAS_BLUE, GRID
from app.services.pdf.formatters import _nd, _texto_curto
from app.services.pdf.helpers import _ctx, _status_final
from app.services.pdf.formatters import _cor_status_pdf, _cabo_circuito_pdf, _disjuntor_circuito_pdf
from app.services.projeto_eletrico import calcular_transformador, carregar_json
from app.services.protecao import validar_protecao_geral


def _bloco_diagrama(drawing: Drawing, x, y, w, h, titulo: str, linhas: List[str], fill, stroke=None):
    """Draw a labelled rectangle block inside a Drawing."""
    if stroke is None:
        stroke = GRID
    drawing.add(Rect(x, y, w, h, fillColor=fill, strokeColor=stroke, strokeWidth=1))
    drawing.add(String(
        x + w / 2, y + h - 11,
        _texto_curto(titulo, 36),
        fontName="Helvetica-Bold", fontSize=7, fillColor=colors.black, textAnchor="middle",
    ))
    for index, linha in enumerate(linhas[:4]):
        drawing.add(String(
            x + w / 2, y + h - 24 - index * 10,
            _texto_curto(linha, 48),
            fontName="Helvetica", fontSize=6.2,
            fillColor=colors.HexColor("#475569"), textAnchor="middle",
        ))


def render_diagrama_unifilar(dto, styles: dict) -> List:
    """Return a list containing the single-line diagram Drawing.

    FASE 5: Pure renderer — receives DTO, performs no calculations.

    Parameters
    ----------
    dto : dict | (projeto, circuitos)
        Either a MemorialDTO dict (Fase 5) or the legacy tuple/namespace for
        backward compatibility.
    """
    # --- DTO extraction (Fase 5 path) ---
    if isinstance(dto, dict):
        transformador = dto.get("transformador", {})
        protecao_geral = dto.get("protecao_geral", {})
        tensao_secundaria = dto.get("tensao_secundaria")
        circuitos = dto.get("circuitos", [])
        projeto_dto = dto.get("projeto", {})
        ctx_val = projeto_dto.get("contexto", "industrial")
        tensao_ref = projeto_dto.get("tensao_ref")
        tensao_secundaria = tensao_secundaria or tensao_ref
    else:
        # Legacy fallback: dto is actually (projeto, circuitos) pair
        projeto, circuitos = dto if isinstance(dto, tuple) else (dto, [])
        from app.services.projeto_eletrico import calcular_transformador, carregar_json
        from app.services.protecao import validar_protecao_geral
        transformador = calcular_transformador(carregar_json(getattr(projeto, "transformador_dados", None)))
        protecao_geral = validar_protecao_geral(carregar_json(getattr(projeto, "protecao_geral_dados", None)), transformador)
        tensao_secundaria = transformador.get("tensao_secundaria") or getattr(projeto, "tensao_ref", None)
        ctx_val = getattr(projeto, "contexto", "industrial")
        tensao_ref = getattr(projeto, "tensao_ref", None)

    circuitos_visiveis = circuitos[:6]
    ocultos = max(len(circuitos) - len(circuitos_visiveis), 0)

    largura = 34 * cm
    altura = max(13 * cm, 7.8 * cm + max(len(circuitos_visiveis), 1) * 1.35 * cm)
    desenho = Drawing(largura, altura)

    tronco_x = 4.2 * cm
    box_x = 1.0 * cm
    box_w = 6.4 * cm
    top_y = altura - 1.15 * cm

    desenho.add(String(largura / 2, altura - 0.45 * cm, "Diagrama unifilar simplificado",
                       fontName="Helvetica-Bold", fontSize=10, fillColor=PETROBRAS_BLUE, textAnchor="middle"))

    entrada_y = top_y - 1.25 * cm
    _bloco_diagrama(
        desenho, box_x, entrada_y, box_w, 1.25 * cm, "Entrada de Energia",
        [f"Tensao: {_nd(tensao_ref, 0)} V", f"Contexto: {_ctx(ctx_val) or 'N/D'}"],
        colors.HexColor("#F8FAFC"),
    )
    desenho.add(Line(tronco_x, entrada_y, tronco_x, entrada_y - 0.45 * cm,
                     strokeColor=colors.HexColor("#334155"), strokeWidth=1.4))

    transformador_y = entrada_y - 1.9 * cm
    _bloco_diagrama(
        desenho, box_x, transformador_y, box_w, 1.45 * cm, "Transformador",
        [
            f"Potencia: {_nd(transformador.get('potencia_kva'), 1)} kVA",
            f"Prim/Sec: {transformador.get('tensao_primaria_formatada') or _nd(transformador.get('tensao_primaria'), 0)} / "
            f"{transformador.get('tensao_secundaria_formatada') or (_nd(tensao_secundaria, 0) + ' V')}",
            f"Icc sec.: {_nd(transformador.get('corrente_curto_secundario_ka'), 2)} kA",
        ],
        colors.HexColor("#EFF6FF"), colors.HexColor("#2563EB"),
    )
    disjuntor_y = transformador_y - 1.55 * cm
    _bloco_diagrama(
        desenho, box_x, disjuntor_y, box_w, 1.05 * cm, "Disjuntor geral",
        [f"In: {_nd(protecao_geral.get('in'), 0)} A",
         f"Icu: {_nd(protecao_geral.get('icu'), 1)} kA | {protecao_geral.get('status') or 'N/D'}"],
        colors.HexColor("#FFF7ED"), colors.HexColor("#C2410C"),
    )
    desenho.add(Line(tronco_x, transformador_y, tronco_x, disjuntor_y + 1.05 * cm,
                     strokeColor=colors.HexColor("#334155"), strokeWidth=1.4))

    barramento_y = disjuntor_y - 1.55 * cm
    desenho.add(Line(tronco_x, disjuntor_y, tronco_x, barramento_y + 1.10 * cm,
                     strokeColor=colors.HexColor("#334155"), strokeWidth=1.4))
    _bloco_diagrama(
        desenho, box_x, barramento_y, box_w, 1.10 * cm, "Barramento principal",
        [f"Tensao: {_nd(tensao_secundaria, 0)} V", f"Circuitos: {len(circuitos)}"],
        colors.HexColor("#F1F5F9"), colors.HexColor("#0F172A"),
    )

    if not circuitos_visiveis:
        _bloco_diagrama(desenho, 10.0 * cm, barramento_y - 1.2 * cm, 9.0 * cm, 1.0 * cm,
                        "Sem circuitos", ["Nenhum ramal cadastrado."], colors.HexColor("#F8FAFC"))
        return [desenho]

    primeiro_y = barramento_y - 0.95 * cm
    ultimo_y = primeiro_y - (len(circuitos_visiveis) - 1) * 1.35 * cm
    desenho.add(Line(tronco_x, barramento_y, tronco_x, ultimo_y,
                     strokeColor=colors.HexColor("#0F172A"), strokeWidth=2.0))

    for index, c in enumerate(circuitos_visiveis):
        y = primeiro_y - index * 1.35 * cm
        status = _status_final(c)
        cor = _cor_status_pdf(status)
        nome = getattr(c, "tag", None) or getattr(c, "descricao", None) or f"Circuito {index + 1}"
        desenho.add(Line(tronco_x, y, 8.1 * cm, y, strokeColor=cor, strokeWidth=1.4))
        _bloco_diagrama(desenho, 8.1 * cm, y - 0.35 * cm, 2.6 * cm, 0.7 * cm,
                        "DJ", [_disjuntor_circuito_pdf(c)], colors.white, cor)
        desenho.add(Line(10.7 * cm, y, 11.6 * cm, y, strokeColor=cor, strokeWidth=1.4))
        _bloco_diagrama(
            desenho, 11.6 * cm, y - 0.55 * cm, 20.6 * cm, 1.1 * cm, nome,
            [
                f"Ib: {_nd(getattr(c, 'corrente_projeto', None) or getattr(c, 'corrente_nominal', None), 1)} A",
                f"Cabo: {_cabo_circuito_pdf(c)} | Icc: {_nd(getattr(c, 'isc_local', None), 2)} kA | Status: {status}",
            ],
            colors.white, cor,
        )

    if ocultos:
        desenho.add(String(11.6 * cm, 0.55 * cm,
                           f"+ {ocultos} circuito(s) adicionais listados nas tabelas do memorial.",
                           fontName="Helvetica", fontSize=7, fillColor=colors.HexColor("#64748B")))
    return [desenho]

