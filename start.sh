#!/usr/bin/env bash

# ==============================================================================
# CalcCabos — Launcher LOCAL (Python FastAPI + React)
# ==============================================================================
# Arquitetura local:
#   ┌─────────────────────────────────────────────────────────┐
#   │  Browser → http://127.0.0.1:5173                       │
#   │     FastAPI Python (porta 8000) — auth, projetos,       │
#   │     circuitos, relatórios, agente, serve SPA estática   │
#   │     Banco: SQLite (backend/calccabos.db) — persistente  │
#   └─────────────────────────────────────────────────────────┘
#
# O backend-node (Express + MongoDB) é usado apenas no deploy Render.
# Para uso local, tudo passa pelo FastAPI em Python.
#
# USO:
#   chmod +x start.sh
#   ./start.sh
#
# PARAR: Ctrl+C encerra todos os processos
# ==============================================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_DIR="$ROOT_DIR/backend"

# ── Cores ─────────────────────────────────────────────────────────────────────
CYAN='\033[0;36m'
GREEN='\033[0;32m'
MAGENTA='\033[0;35m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
RESET='\033[0m'

echo -e "${CYAN}${BOLD}"
echo "╔═══════════════════════════════════════════════╗"
echo "║   ⚡ CalcCabos — Launcher Local               ║"
echo "║   Python FastAPI (8000) + React (5173)        ║"
echo "╚═══════════════════════════════════════════════╝"
echo -e "${RESET}"

# ── 1. Garantir frontend/.env aponta para FastAPI (porta 8000) ────────────────
echo "VITE_API_URL=http://127.0.0.1:8000" > "$FRONTEND_DIR/.env"
echo -e "${GREEN}[ENV]${RESET} frontend/.env → VITE_API_URL=http://127.0.0.1:8000 ${GREEN}✓${RESET}"

# ── 2. Detectar executável Python/uvicorn (suporta venv) ─────────────────────
UVICORN_BIN="uvicorn"
if [ -f "$BACKEND_DIR/venv/bin/uvicorn" ]; then
  UVICORN_BIN="$BACKEND_DIR/venv/bin/uvicorn"
  echo -e "${GREEN}[ENV]${RESET} venv detectado: usando $UVICORN_BIN"
fi

# ── 3. Verificar dependências mínimas ────────────────────────────────────────
if ! command -v node >/dev/null 2>&1; then
  echo -e "${RED}[ERRO]${RESET} Node.js não encontrado. Instale de https://nodejs.org"
  exit 1
fi
if ! "$UVICORN_BIN" --version >/dev/null 2>&1; then
  echo -e "${RED}[ERRO]${RESET} uvicorn não encontrado. Rode: pip install uvicorn fastapi"
  exit 1
fi

# ── 4. Encerrar processos anteriores nas portas 8000 e 5173 ──────────────────
for PORT in 8000 5173; do
  PIDS=$(lsof -t -i:"$PORT" 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo -e "${YELLOW}[STOP]${RESET} Liberando porta $PORT (PID: $PIDS)"
    kill -9 $PIDS 2>/dev/null || true
    sleep 0.5
  fi
done

# ── 5. Instalar dependências do frontend se necessário ───────────────────────
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  echo -e "${MAGENTA}[FRONTEND]${RESET} Instalando dependências (npm install)..."
  (cd "$FRONTEND_DIR" && npm install --silent)
fi

# ── 6. Encerrar todos os filhos ao sair (Ctrl+C) ─────────────────────────────
cleanup() {
  echo -e "\n${YELLOW}[STOP]${RESET} Encerrando todos os serviços... ✓"
  kill 0 2>/dev/null || true
}
trap cleanup INT TERM

# ── 7. Iniciar serviços com logs coloridos ────────────────────────────────────
echo ""
echo -e "${CYAN}[PYTHON]${RESET} FastAPI iniciando em ${BOLD}http://127.0.0.1:8000${RESET}"
echo -e "${MAGENTA}[FRONTEND]${RESET} React/Vite iniciando em ${BOLD}http://127.0.0.1:5173${RESET}"
echo ""
echo -e "${YELLOW}────────────────── LOGS ──────────────────────────${RESET}"
echo ""

(
  cd "$BACKEND_DIR"
  "$UVICORN_BIN" main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload \
    --log-level info \
    2>&1 | while IFS= read -r line; do
      echo -e "${CYAN}[PYTHON]${RESET} $line"
    done
) &

# Aguardar FastAPI estar pronto antes de iniciar o frontend
echo -e "${YELLOW}[WAIT]${RESET} Aguardando FastAPI ficar pronto..."
for i in $(seq 1 20); do
  if curl -sf http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
    echo -e "${GREEN}[READY]${RESET} FastAPI pronto! ✓"
    break
  fi
  sleep 0.5
done

(
  cd "$FRONTEND_DIR"
  npm run dev 2>&1 | while IFS= read -r line; do
    echo -e "${MAGENTA}[FRONTEND]${RESET} $line"
  done
) &

echo ""
echo -e "${GREEN}${BOLD}Serviços rodando:${RESET}"
echo -e "  ${CYAN}●${RESET} FastAPI (Python) → ${BOLD}http://127.0.0.1:8000${RESET}"
echo -e "  ${MAGENTA}●${RESET} React (Vite)     → ${BOLD}http://127.0.0.1:5173${RESET}"
echo ""
echo -e "${YELLOW}Pressione Ctrl+C para encerrar tudo.${RESET}"

wait
