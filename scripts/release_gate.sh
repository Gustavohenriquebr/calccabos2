#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "CalcCabos release gate"

echo "[1/4] verificando diff"
git diff --check

echo "[2/4] verificando arquivos sensiveis rastreados"
tracked_sensitive="$(git ls-files | rg '(^|/)(\.env($|\.)|credentials?\.|secrets?\.|.*\.pem$|.*\.key$)' | rg -v '(^|/)\.env\.example$' || true)"
if [[ -n "$tracked_sensitive" ]]; then
  echo "Arquivos potencialmente sensiveis rastreados:" >&2
  printf '%s\n' "$tracked_sensitive" >&2
  exit 1
fi

echo "[3/4] executando validacao tecnica"
./scripts/run_validation.sh

if [[ "${RUN_PUBLIC_SMOKE:-0}" == "1" ]]; then
  echo "[4/4] executando smoke test publico"
  ./scripts/smoke_public.sh
else
  echo "[4/4] smoke publico ignorado; use RUN_PUBLIC_SMOKE=1 para executa-lo"
fi

echo "Release gate concluido"
