#!/usr/bin/env bash

# ────────────────────────────────────────────────────────────────────────────
# CalcCabos.command — Duplo clique no Finder para iniciar o sistema
# ────────────────────────────────────────────────────────────────────────────

# Garante que o diretório de trabalho seja a pasta do script
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

# ── Detectar uvicorn (venv ou sistema) ──────────────────────────────────────
if [ -f "$BACKEND_DIR/venv/bin/uvicorn" ]; then
  UVICORN="$BACKEND_DIR/venv/bin/uvicorn"
elif command -v uvicorn >/dev/null 2>&1; then
  UVICORN="uvicorn"
else
  osascript -e 'display alert "CalcCabos" message "uvicorn não encontrado.\nInstale com: pip install uvicorn"'
  exit 1
fi

# ── Garantir frontend/.env aponta para FastAPI ───────────────────────────────
echo "VITE_API_URL=http://127.0.0.1:8000" > "$FRONTEND_DIR/.env"

# ── Liberar portas 8000 e 5173 caso estejam ocupadas ────────────────────────
for PORT in 8000 5173; do
  PIDS=$(lsof -t -i:"$PORT" 2>/dev/null || true)
  [ -n "$PIDS" ] && kill -9 $PIDS 2>/dev/null || true
done
sleep 0.5

# ── Encerrar tudo ao fechar a janela (Ctrl+C ou fechar o Terminal) ───────────
cleanup() {
  echo ""
  echo "🛑 Encerrando CalcCabos..."
  kill 0 2>/dev/null || true
}
trap cleanup INT TERM EXIT

# ── Iniciar FastAPI Python em segundo plano ───────────────────────────────────
echo "🐍 Iniciando FastAPI Python na porta 8000..."
(
  cd "$BACKEND_DIR"
  "$UVICORN" main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload \
    --log-level warning \
    2>&1
) &

# ── Aguardar FastAPI ficar pronto ─────────────────────────────────────────────
echo "⏳ Aguardando backend ficar pronto..."
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
    echo "✅ Backend pronto!"
    break
  fi
  sleep 0.5
done

# ── Iniciar React/Vite em segundo plano ──────────────────────────────────────
echo "⚛️  Iniciando React na porta 5173..."
(
  cd "$FRONTEND_DIR"
  npm run dev --silent 2>&1
) &

# ── Aguardar Vite ficar pronto e abrir o navegador ───────────────────────────
echo "⏳ Aguardando frontend ficar pronto..."
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:5173 >/dev/null 2>&1; then
    echo "✅ Frontend pronto! Abrindo navegador..."
    open "http://127.0.0.1:5173"
    break
  fi
  sleep 0.5
done

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  ⚡ CalcCabos está rodando!              ║"
echo "║                                          ║"
echo "║  🌐 http://127.0.0.1:5173                ║"
echo "║                                          ║"
echo "║  Feche esta janela para encerrar.        ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Mantém o script vivo (e os serviços rodando) até fechar a janela
wait
