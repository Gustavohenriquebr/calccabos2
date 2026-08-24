/**
 * Script to generate test-circuits.xlsx for E2E import test.
 * Uses the `xlsx` package already in the frontend dependencies.
 *
 * Run: node tests/e2e/fixtures/generate-test-xlsx.mjs
 */
import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const data = [
  {
    'TAG': 'C-02',
    'Descrição': 'Compressor de ar industrial',
    'Potência (kW)': 22,
    'Tensão (V)': 380,
    'Fator de Potência': 0.82,
    'Distância (m)': 60,
    'Tipo Cabo': 'CU-PVC',
    'Método Instalação': 'CONDUIT',
    'Fases': 3,
    'Temperatura Ambiente': 30,
  },
  {
    'TAG': 'C-03',
    'Descrição': 'Iluminação galpão produção',
    'Potência (kW)': 5,
    'Tensão (V)': 220,
    'Fator de Potência': 0.92,
    'Distância (m)': 30,
    'Tipo Cabo': 'CU-PVC',
    'Método Instalação': 'CONDUIT',
    'Fases': 1,
    'Temperatura Ambiente': 30,
  },
];

const ws = XLSX.utils.json_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Circuitos');

const outPath = join(__dirname, 'test-circuits.xlsx');
XLSX.writeFile(wb, outPath);

console.log(`✅ Created ${outPath}`);
