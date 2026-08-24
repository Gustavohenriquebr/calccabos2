#!/usr/bin/env python3
"""
calccabos_launcher.py — Executável/Launcher Local para o CalcCabos.

Funcionalidades:
1. Inicia o servidor backend Python (FastAPI) em http://127.0.0.1:8000
2. Inicia explicitamente o frontend Vite em http://127.0.0.1:5173.
3. Abre o navegador padrão do sistema automaticamente.
4. Gerencia encerramento limpo via Ctrl+C / SIGINT.
"""

import os
import sys
import time
import socket
import subprocess
import webbrowser
import signal
import shutil

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")
DEFAULT_PORT = 8000
DEV_FRONTEND_PORT = 5173

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

def open_browser_when_ready(url, max_attempts=30):
    print(f" Aguardando servidor em {url}...")
    for _ in range(max_attempts):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(1.0)
                port = DEV_FRONTEND_PORT if f":{DEV_FRONTEND_PORT}" in url else DEFAULT_PORT
                if s.connect_ex(('127.0.0.1', port)) == 0:
                    print(f" Servidor pronto! Abrindo navegador em {url}")
                    webbrowser.open(url)
                    return True
        except Exception:
            pass
        time.sleep(0.5)
    print(f" Abrindo navegador diretamente em {url}")
    webbrowser.open(url)
    return False

def main():
    print("=" * 60)
    print("  CalcCabos — Launcher Local Automático")
    print("=" * 60)
    print(f" Pasta Raiz: {ROOT_DIR}")

    processes = []

    def cleanup(sig=None, frame=None):
        print("\n Encerrando processos do CalcCabos...")
        for p in processes:
            try:
                p.terminate()
                p.wait(timeout=2)
            except Exception:
                try:
                    p.kill()
                except Exception:
                    pass
        print(" CalcCabos finalizado.")
        sys.exit(0)

    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    venv_python = os.path.join(BACKEND_DIR, "venv", "bin", "python3")
    if not os.path.exists(venv_python):
        venv_python = os.path.join(BACKEND_DIR, "venv", "bin", "python")
    if sys.platform == "win32":
        venv_python = os.path.join(BACKEND_DIR, "venv", "Scripts", "python.exe")
    
    python_cmd = venv_python if os.path.exists(venv_python) else sys.executable
    uvicorn_bin = os.path.join(os.path.dirname(python_cmd), "uvicorn")

    print("\n [1/2] Iniciando Backend FastAPI (http://127.0.0.1:8000)...")
    env = os.environ.copy()
    env["PYTHONPATH"] = BACKEND_DIR
    env["PORT"] = str(DEFAULT_PORT)
    env["HOST"] = "127.0.0.1"

    if os.path.exists(uvicorn_bin):
        backend_cmd = [uvicorn_bin, "main:app", "--host", "127.0.0.1", "--port", str(DEFAULT_PORT)]
    else:
        backend_cmd = [python_cmd, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", str(DEFAULT_PORT)]

    backend_proc = subprocess.Popen(
        backend_cmd,
        cwd=BACKEND_DIR,
        env=env
    )
    processes.append(backend_proc)

    has_npm = shutil.which("npm") is not None
    target_url = f"http://127.0.0.1:{DEFAULT_PORT}"

    if not has_npm:
        print(" ERRO: npm não encontrado. Instale o Node.js para iniciar o frontend Vite.")
        cleanup()
    if not os.path.exists(os.path.join(FRONTEND_DIR, "package.json")):
        print(f" ERRO: package.json do frontend não encontrado em {FRONTEND_DIR}.")
        cleanup()

    print(" [2/2] Iniciando Frontend Vite Dev Server (http://127.0.0.1:5173)...")
    frontend_proc = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=FRONTEND_DIR,
        shell=(sys.platform == "win32")
    )
    processes.append(frontend_proc)
    target_url = f"http://127.0.0.1:{DEV_FRONTEND_PORT}"

    open_browser_when_ready(target_url)

    print("\n CalcCabos está rodando!")
    print(f" URL: {target_url}")
    print(" Pressione Ctrl+C para encerrar.\n")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        cleanup()

if __name__ == "__main__":
    main()
