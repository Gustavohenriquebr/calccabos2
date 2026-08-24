import sys
import io
import asyncio
from openpyxl import Workbook
from app.services.importador_circuitos import _ler_xlsx, ler_arquivo

def test_ler_xlsx():
    wb = Workbook()
    ws = wb.active
    ws.append(["nome", "potencia", "tensao", "fp", "comprimento"])
    ws.append(["Circuito 1", 10, 380, 0.85, 100])
    ws.append(["Circuito 2", 20, 380, 0.85, 200])
    
    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)
    conteudo = stream.read()
    
    try:
        headers, registros = ler_arquivo("teste.xlsx", conteudo)
        print("Headers:", headers)
        print("Registros:", registros)
    except Exception as e:
        print("Erro:", e)

if __name__ == "__main__":
    test_ler_xlsx()
