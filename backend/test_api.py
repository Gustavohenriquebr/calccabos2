import asyncio
import httpx
from io import BytesIO
from openpyxl import Workbook

async def test_api():
    wb = Workbook()
    ws = wb.active
    ws.append(["nome", "potencia", "tensao", "fp", "comprimento"])
    ws.append(["Circuito 1", 10, 380, 0.85, 100])
    stream = BytesIO()
    wb.save(stream)
    stream.seek(0)
    
    # Wait for the backend to be running or we can just call the endpoint.
    # Actually, we can just call the router functions directly.
    from app.routers.circuitos import preview_importar_circuitos
    from fastapi import UploadFile
    from fastapi.datastructures import FormData
    import starlette.datastructures as datastructures
    
    # Create mock UploadFile
    upload_file = UploadFile(filename="teste.xlsx", file=stream)
    
    # We can't easily mock Depends without a real request.
    # Let's just test `preview_importacao` from `importador_circuitos`
    from app.services.importador_circuitos import preview_importacao
    
    try:
        res = preview_importacao("teste.xlsx", stream.read())
        print("Success:", res)
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(test_api())
