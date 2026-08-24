# backend/app/services/pdf/formatters.py
"""Shared text/number/status formatting helpers for PDF generation.

Every function here is a pure utility: no I/O, no DB access, no ReportLab
state.  They are deliberately framework-agnostic so that Excel and IA
layers can also import them without pulling in the PDF dependencies.
"""
from __future__ import annotations

from reportlab.lib import colors as _colors

from .estilos import OK_FILL, ALERT_FILL, CRITICAL_FILL


# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------

def _txt(valor, padrao: str = "-") -> str:
    """Return a clean string representation of *valor*.

    Recognises known status tokens and leaves them upper-cased; all other
    values are returned as-is (or as *padrao* when falsy).
    """
    if valor is None or valor == "":
        return padrao
    texto = str(valor).strip()
    upper = texto.upper().replace("_", " ")
    if upper in {"OK", "ALERTA", "CRITICO", "CRITICO", "NAO CALCULADO", "NAO CALCULADO"}:
        return upper
    return texto


def _texto_curto(valor, limite: int = 48) -> str:
    """Truncate *valor* to *limite* characters, appending '...' if needed."""
    texto = str(valor or "N/D")
    return texto if len(texto) <= limite else f"{texto[:limite - 3]}..."


# ---------------------------------------------------------------------------
# Number helpers
# ---------------------------------------------------------------------------

def _fmt(valor, casas: int = 2, vazio: str = "N/D") -> str:
    """Format a numeric *valor* to a fixed number of decimal *casas*.

    Returns *vazio* for ``None`` values.  Integer-like floats are shown
    without a decimal separator.
    """
    if valor is None:
        return vazio
    try:
        numero = float(valor)
    except (TypeError, ValueError):
        return _txt(valor)
    if numero.is_integer():
        return str(int(numero))
    return f"{numero:.{casas}f}"


def _nd(valor, casas: int = 2) -> str:
    """Shorthand for _fmt with 'N/D' placeholder."""
    return _fmt(valor, casas, "N/D")


# ---------------------------------------------------------------------------
# Boolean / check helpers
# ---------------------------------------------------------------------------

def _ck(ok) -> str:
    """Return 'OK' or 'NOK' based on a truthy *ok* value."""
    return "OK" if ok else "NOK"


# ---------------------------------------------------------------------------
# Status / colour helpers
# ---------------------------------------------------------------------------

def _cor_status_pdf(status):
    """Return a ReportLab color object matching a status string."""
    texto = str(status or "").upper()
    if "OK" in texto:
        return _colors.HexColor("#16A34A")
    if "ALERTA" in texto:
        return _colors.HexColor("#D97706")
    if "CR" in texto:
        return _colors.HexColor("#DC2626")
    return _colors.HexColor("#64748B")


# ---------------------------------------------------------------------------
# Circuit-specific helpers
# ---------------------------------------------------------------------------

def _cabo_circuito_pdf(c) -> str:
    """Return a human-readable cable designation for circuit *c*."""
    return (
        getattr(c, "cabo_sugerido_tipo_comercial", None)
        or getattr(c, "tipo_cabo_comercial", None)
        or (
            f"#{_nd(getattr(c, 'secao_mm2', None), 0)}mm2"
            if getattr(c, "secao_mm2", None)
            else "N/D"
        )
    )


def _disjuntor_circuito_pdf(c) -> str:
    """Return a human-readable circuit-breaker designation for circuit *c*."""
    corrente = (
        getattr(c, "disjuntor_sugerido_in", None)
        or getattr(c, "disjuntor_corrente_nominal", None)
        or getattr(c, "disjuntor_a", None)
    )
    icu = getattr(c, "disjuntor_sugerido_icu", None) or getattr(c, "disjuntor_icu", None)
    curva = getattr(c, "disjuntor_sugerido_curva", None) or getattr(c, "disjuntor_curva", None)
    sufixo_curva = f" / {curva}" if curva else ""
    return f"{_nd(corrente, 0)}A / {_nd(icu, 1)}kA{sufixo_curva}"
