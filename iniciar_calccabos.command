#!/usr/bin/env bash
# macOS double-clickable launcher script for CalcCabos

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=========================================="
echo " Iniciando CalcCabos Local (macOS)"
echo "=========================================="
echo ""

if [ -f "$DIR/calccabos_launcher.py" ]; then
    python3 "$DIR/calccabos_launcher.py"
else
    echo "Iniciando backend FastAPI..."
    cd "$DIR/backend"
    python3 -m uvicorn main:app --host 127.0.0.1 --port 8000 &
    BACKEND_PID=$!
    
    sleep 3
    echo "Iniciando frontend Vite..."
    cd "$DIR/frontend"
    npm run dev &
    FRONTEND_PID=$!
    
    sleep 3
    echo "Abrindo navegador..."
    open "http://127.0.0.1:5173"
    
    trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM EXIT
    wait
fi
