# backend/app/services/pdf/sections/__init__.py
"""PDF section renderers for CalcCabos.

Each submodule renders a specific part of the memorial PDF:

  capa.py       – cover page and header block
  tabelas.py    – all ReportLab Table builders
  diagramas.py  – single-line diagram (Drawing)
  tecnico.py    – technical sections (Transformador, Sistema, Para-raios …)
  resumo.py     – summary table and criteria
  conclusoes.py – technical conclusions flowables

Public re-exports so callers can do:
    from app.services.pdf.sections import render_capa, render_resumo
"""
from .capa import render_capa, render_cabecalho
from .tabelas import (
    render_tabela_dados,
    render_tabela_principal,
    render_tabela_protecao,
    render_tabela_validacao,
    render_tabela_automaticos,
    render_tabela_circuitos_memorial,
    render_tabela_medicoes_aterramento,
    render_tabela_areas_classificadas,
)
from .diagramas import render_diagrama_unifilar
from .tecnico import render_secoes_memorial
from .resumo import render_sumario
from .conclusoes import render_conclusoes

__all__ = [
    "render_capa",
    "render_cabecalho",
    "render_tabela_dados",
    "render_tabela_principal",
    "render_tabela_protecao",
    "render_tabela_validacao",
    "render_tabela_automaticos",
    "render_tabela_circuitos_memorial",
    "render_tabela_medicoes_aterramento",
    "render_tabela_areas_classificadas",
    "render_diagrama_unifilar",
    "render_secoes_memorial",
    "render_sumario",
    "render_conclusoes",
]
