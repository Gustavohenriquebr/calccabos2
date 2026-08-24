#!/usr/bin/env bash
# Shell launcher script for CalcCabos (Linux / macOS)

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

if [ -f "$DIR/calccabos_launcher.py" ]; then
    python3 "$DIR/calccabos_launcher.py"
else
    cd "$DIR/backend" && python3 -m uvicorn main:app --host 127.0.0.1 --port 8000 &
    sleep 3
    cd "$DIR/frontend" && npm run dev &
    sleep 3
    if command -v open > /dev/null; then
        open "http://127.0.0.1:5173"
    elif command -v xdg-open > /dev/null; then
        xdg-open "http://127.0.0.1:5173"
    fi
    wait
fi
