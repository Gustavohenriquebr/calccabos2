# backend/app/services/pdf/layout.py
"""Layout helpers and safe-style utilities for PDF generation."""
from __future__ import annotations
import logging

from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT

logger = logging.getLogger(__name__)

DEFAULT_FONT = "Helvetica"
DEFAULT_FONT_BOLD = "Helvetica-Bold"
DEFAULT_FONT_SIZE = 8


def safe_style(styles: dict, key: str, fallback=None):
    """Return the style for *key*, falling back to *fallback* on KeyError.

    If *fallback* is None a minimal ParagraphStyle is constructed so that
    callers never get a KeyError at render time.
    """
    try:
        return styles[key]
    except KeyError:
        logger.warning("PDF style '%s' not found – using fallback.", key)
        if fallback is not None:
            return fallback
        return ParagraphStyle(
            name=f"fallback_{key}",
            fontName=DEFAULT_FONT,
            fontSize=DEFAULT_FONT_SIZE,
            leading=10,
            alignment=TA_LEFT,
        )
