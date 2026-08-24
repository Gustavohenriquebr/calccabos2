# estilos.py – definições de cores e constantes de layout para PDFs

from reportlab.lib import colors

# Cores da identidade visual CalcCabos
PETROBRAS_BLUE = colors.HexColor("#003087")
LIGHT_BLUE = colors.HexColor("#EAF1FB")
LIGHT_GRAY = colors.HexColor("#F5F7FA")
GRID = colors.HexColor("#CBD5E1")
OK_FILL = colors.HexColor("#D9F2E3")
ALERT_FILL = colors.HexColor("#FFF3BF")
CRITICAL_FILL = colors.HexColor("#FFD6D6")
DARK_NAVY = colors.HexColor("#0F172A")
SLATE = colors.HexColor("#334155")
SURFACE = colors.HexColor("#F8FAFC")
BORDER_SOFT = colors.HexColor("#E2E8F0")

# Dimensões padrão (cm) – podem ser ajustadas em layout.py se necessário
PAGE_SIZE = (842, 595)  # A3 landscape in points roughly (not used diretamente)
