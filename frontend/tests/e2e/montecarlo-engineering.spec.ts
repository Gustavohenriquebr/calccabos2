import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const MONTE_CARLO_SIZE = 5000;
let testProjectId: string | null = null;
let networkIssues: string[] = [];

// Deterministic Pseudo-Random Number Generator (PRNG) Seed
function mulberry32(a: number) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

const rng = mulberry32(987654321); // Fixed seed for reproducibility

function randomRange(min: number, max: number) {
  return min + rng() * (max - min);
}

function randomInt(min: number, max: number) {
  return Math.floor(randomRange(min, max + 1));
}

function randomChoice<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

// Random Engine Generator (Phase 1 & 2)
function generateMonteCarloPayload(projectId: string, count: number) {
  const circuitos = [];
  const tipos = ['CU-PVC', 'CU-XLPE', 'AL-PVC', 'AL-XLPE'];
  const metodos = ['TRAY', 'CONDUIT', 'DIRECT', 'AIR'];
  const tensoes = [127, 220, 380, 440, 690, 13800];

  for (let i = 0; i < count; i++) {
    const tensao = randomChoice(tensoes);
    const fases = (tensao === 127 || tensao === 220) ? randomChoice([1, 3]) : 3;
    const potencia_kw = randomRange(0.1, 2500); // Exagerated bounds to stress test
    const fator_potencia = randomRange(0.4, 1.0); // Extreme reactive loads
    const fator_eficiencia = randomRange(0.5, 1.0);
    const distancia_m = randomRange(1, 4000); // From 1 meter to 4 km!
    const temp_ambiente = randomInt(15, 80); // From cool 15C to extreme 80C
    const agrupamento = randomInt(1, 15); // Up to 15 grouped circuits

    circuitos.push({
      projeto_id: parseInt(projectId, 10),
      descricao: `MC-Sim-${i}-${tensao}V`,
      tensao,
      fases,
      potencia_kw: parseFloat(potencia_kw.toFixed(2)),
      fator_potencia: parseFloat(fator_potencia.toFixed(2)),
      fator_eficiencia: parseFloat(fator_eficiencia.toFixed(2)),
      distancia_m: parseFloat(distancia_m.toFixed(1)),
      tipo_cabo: randomChoice(tipos),
      temp_ambiente,
      agrupamento,
      metodo_instalacao: randomChoice(metodos),
      modo_dimensionamento: 'automatico'
    });
  }
  return circuitos;
}

test.describe('Monte Carlo Engineering Validation', () => {
  test.describe.configure({ mode: 'serial', timeout: 300000 }); // 5 minutes timeout for 5000 circuits

  test.beforeEach(({ page }) => {
    page.on('response', response => {
      if (response.status() >= 500) {
        networkIssues.push(`HTTP ${response.status()} at ${response.url()}`);
      }
    });
  });

  test(`Phase 1-4: Inject ${MONTE_CARLO_SIZE} circuits and calculate`, async ({ request }) => {
    console.log(`🚀 Iniciando Injeção Monte Carlo com ${MONTE_CARLO_SIZE} circuitos...`);

    // Criar projeto base
    const projResponse = await request.post('/api/projetos/', {
      data: { nome: `MONTE CARLO v${Date.now()}`, contexto: 'industrial', tensao_ref: 380 }
    });
    expect(projResponse.ok()).toBeTruthy();
    const projBody = await projResponse.json();
    testProjectId = projBody.id;

    // Gerar Dataset Restrito
    const payloads = generateMonteCarloPayload(testProjectId!, MONTE_CARLO_SIZE);
    
    // Chunking to avoid overwhelming the NodeJS test runner memory or backend TCP limits
    const CHUNK_SIZE = 500;
    for (let i = 0; i < payloads.length; i += CHUNK_SIZE) {
      const chunk = payloads.slice(i, i + CHUNK_SIZE);
      await Promise.all(chunk.map(c => request.post('/api/circuitos/', { data: c })));
      console.log(`Injetados ${Math.min(i + CHUNK_SIZE, MONTE_CARLO_SIZE)} / ${MONTE_CARLO_SIZE}`);
    }

    expect(networkIssues.length, `HTTP 500 failures during injection!`).toBe(0);

    console.log('⚡ Disparando Motor de Cálculo do Backend...');
    const t0 = Date.now();
    const calcResponse = await request.post(`/api/circuitos/calcular-lote/${testProjectId}`);
    const t1 = Date.now();
    const calcResult = await calcResponse.json();
    
    console.log(`Cálculo concluído em ${t1 - t0}ms`);
    expect(calcResult.erros.length, 'Batch calculation threw hard errors!').toBe(0);

    // Hard Fail Condition 1: 500 API
    expect(networkIssues.length, `Backend crashed returning HTTP 500 during batch calc`).toBe(0);

    // Coletar dados computados
    const fetchResponse = await request.get(`/api/circuitos/projeto/${testProjectId}`);
    const circuitosCalculados = await fetchResponse.json();

    expect(circuitosCalculados.length).toBe(MONTE_CARLO_SIZE);

    // Phase 5 & 6: Data Structures
    let stats = {
      aprovados: 0,
      criticos: 0,
      alertas: 0,
      sumCorrente: 0,
      sumQT: 0,
      secoes: {} as Record<string, number>,
      falhasMatematicas: 0,
      heatMap: {} as Record<string, number>
    };

    for (const c of circuitosCalculados) {
      // 1. MATHEMATICAL STABILITY (Phase 3)
      // Any NaN, Null, or Negative in physical fields is a Hard Fail
      const isMathInvalid = 
        isNaN(c.corrente_projeto) || c.corrente_projeto === null || c.corrente_projeto < 0 ||
        isNaN(c.secao_mm2) || c.secao_mm2 === null || c.secao_mm2 <= 0 ||
        isNaN(c.queda_tensao_perc) || c.queda_tensao_perc === null || c.queda_tensao_perc < 0 ||
        !isFinite(c.corrente_projeto) || !isFinite(c.secao_mm2);

      if (isMathInvalid) {
        stats.falhasMatematicas++;
        console.error(`🚨 STABILITY FAIL ID ${c.id}: I=${c.corrente_projeto}, S=${c.secao_mm2}, QT=${c.queda_tensao_perc}`);
      }

      // 2. NORMATIVE OUTLIER DETECTION (Phase 4)
      const adm = c.ampacidade_corrigida || c.corrente_admissivel || c.capacidade_conducao;
      if (c.status_final === 'OK' && adm && adm < c.corrente_projeto) {
        // Hard Fail Condition 3: Approved with insufficient ampacity
        stats.falhasMatematicas++;
        console.error(`🚨 SAFETY FAIL ID ${c.id}: Status OK but Ampacity ${adm} < Current ${c.corrente_projeto}`);
      }

      // Heatmap Tracking (What breaks the system?)
      if (c.status_final === 'CRITICO' || isMathInvalid) {
        const heatmapKey = `${c.tipo_cabo}_${c.tensao}V_Group${c.agrupamento > 5 ? '>5' : '<=5'}`;
        stats.heatMap[heatmapKey] = (stats.heatMap[heatmapKey] || 0) + 1;
      }

      // Standard Stats (Phase 5)
      stats.sumCorrente += c.corrente_projeto || 0;
      stats.sumQT += c.queda_tensao_perc || 0;
      const secStr = String(c.secao_mm2 || 'Invalid');
      stats.secoes[secStr] = (stats.secoes[secStr] || 0) + 1;

      if (c.status_final === 'OK') stats.aprovados++;
      else if (c.status_final === 'ALERTA') stats.alertas++;
      else stats.criticos++;
    }

    // Phase 5: Generating Output
    const relatorioJSON = {
      timestamp: new Date().toISOString(),
      executionTimeMs: t1 - t0,
      totalCircuitos: MONTE_CARLO_SIZE,
      falhasMatematicas: stats.falhasMatematicas,
      distribuicaoStatus: {
        OK: stats.aprovados,
        ALERTA: stats.alertas,
        CRITICO: stats.criticos
      },
      medias: {
        correnteProjetoA: +(stats.sumCorrente / MONTE_CARLO_SIZE).toFixed(2),
        quedaTensaoPct: +(stats.sumQT / MONTE_CARLO_SIZE).toFixed(2)
      },
      distribuicaoSecoes: stats.secoes,
      engineeringHeatmapCritico: stats.heatMap
    };

    // Salvar JSON (Phase 7)
    const reportDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir);
    fs.writeFileSync(path.join(reportDir, 'montecarlo-report.json'), JSON.stringify(relatorioJSON, null, 2), 'utf8');

    console.log(`
📊 MONTE CARLO STATISTICAL SUMMARY 
==================================
Total Simulado: ${MONTE_CARLO_SIZE} circuitos
Média Corrente: ${relatorioJSON.medias.correnteProjetoA} A
Média Queda de Tensão: ${relatorioJSON.medias.quedaTensaoPct}%
Aprovados (OK): ${stats.aprovados}
Reprovados (CRITICO): ${stats.criticos}

🔥 ENGINEERING HEATMAP (Top Critical Combos)
----------------------------------
${Object.entries(stats.heatMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}: ${v} falhas`).join('\n')}

📈 HISTOGRAMA DE SEÇÕES (Top 5)
----------------------------------
${Object.entries(stats.secoes).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}mm² : ${v}`).join('\n')}
==================================
    `);

    // Hard Fail Condition 2: Any calculation generated NaN or invalid physics
    expect(stats.falhasMatematicas, `DETECTED ${stats.falhasMatematicas} MATHEMATICAL STABILITY FAILURES`).toBe(0);
  });

  test('Phase 8: Teardown', async ({ request }) => {
    if (testProjectId) {
      console.log(`Limpando projeto Monte Carlo ${testProjectId}...`);
      const deleteRes = await request.delete(`/api/projetos/${testProjectId}`);
      expect(deleteRes.ok()).toBeTruthy();
    }
  });
});
