# backend/app/services/pdf/sections/conclusoes.py
"""Technical conclusions section renderer for the CalcCabos memorial PDF."""
from __future__ import annotations
from typing import Any, Dict, List, Optional

from app.services.pdf.helpers import _conclusoes_tecnicas
from app.services.pdf.sections.tabelas import render_tabela_dados


def render_conclusoes(
    circuitos: List[Any],
    resumo_global: Optional[Dict] = None,
    styles: Optional[dict] = None,
) -> Any:
    """Return a Table Flowable with the technical conclusion lines.

    Parameters
    ----------
    circuitos : list
        List of circuit objects.
    resumo_global : dict, optional
        Pre-computed global summary dict (avoids duplicate calculation).
    styles : dict
        ReportLab stylesheet dict (required when used inside a PDF story).
    """
    linhas = _conclusoes_tecnicas(circuitos, resumo_global)
    if styles is None:
        # Fallback: return raw lines (useful for tests / IA consumption)
        return linhas
    return render_tabela_dados(
        "Conclusão técnica",
        [[f"Item {i}", linha] for i, linha in enumerate(linhas, start=1)],
        styles,
    )
