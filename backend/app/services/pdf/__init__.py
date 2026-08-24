"""backend/app/services/pdf/__init__.py

Marks the pdf directory as a Python package and re-exports the key symbols
so that other modules can do: from app.services.pdf import PETROBRAS_BLUE
"""
from .estilos import (
    PETROBRAS_BLUE,
    LIGHT_BLUE,
    LIGHT_GRAY,
    GRID,
    OK_FILL,
    ALERT_FILL,
    CRITICAL_FILL,
    DARK_NAVY,
    SLATE,
    SURFACE,
    BORDER_SOFT,
)

__all__ = [
    "PETROBRAS_BLUE",
    "LIGHT_BLUE",
    "LIGHT_GRAY",
    "GRID",
    "OK_FILL",
    "ALERT_FILL",
    "CRITICAL_FILL",
    "DARK_NAVY",
    "SLATE",
    "SURFACE",
    "BORDER_SOFT",
]
