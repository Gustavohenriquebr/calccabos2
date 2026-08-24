#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "== CalcCabos: bateria de validacao tecnica =="

echo
echo "[1/5] Backend Python - casos tecnicos e didaticos"
cd "$ROOT_DIR/backend"
PYTHON_BIN="python3"
if [ -x "$ROOT_DIR/backend/venv/bin/python" ]; then
  PYTHON_BIN="$ROOT_DIR/backend/venv/bin/python"
fi
"$PYTHON_BIN" -m pytest \
  tests/test_casos_ouro_validacao.py \
  tests/test_metamorficos_validacao.py \
  tests/test_tensao_parametrizada.py \
  tests/test_motor_cabos_auditavel.py \
  tests/test_casos_didaticos_aula2.py \
  tests/test_k2_agrupamento.py \
  tests/test_queda_acumulada_etapa4.py \
  tests/test_etapa4_validacao.py \
  tests/test_selecao_automatica.py \
  tests/test_protecao_mtat_aula4.py \
  tests/test_aterramento_aula1p2.py \
  tests/test_para_raios_aula5.py \
  tests/test_pdf_module.py

echo
echo "[2/5] Backend Python - smoke tests legados"
"$PYTHON_BIN" -m pytest test_xlsx.py

echo
echo "[3/5] Backend Node - seguranca, relatorios e API"
cd "$ROOT_DIR/backend-node"
npm test

echo
echo "[4/5] Frontend - utilitarios de importacao e unifilar"
cd "$ROOT_DIR/frontend"
node --test tests/unifilar-model.test.mjs
npm run test:importer

echo
echo "[5/5] Frontend - build"
npm run build

echo
echo "Validacao tecnica concluida. Revise docs/VALIDACAO_TECNICA.md para limites e pendencias."
