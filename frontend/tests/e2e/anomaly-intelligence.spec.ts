import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const REPORTS_DIR = path.join(__dirname, 'reports');
const HISTORY_FILE = path.join(REPORTS_DIR, 'confidence-history.json');
const MC_REPORT_FILE = path.join(REPORTS_DIR, 'montecarlo-report.json');
const INTELLIGENCE_JSON = path.join(REPORTS_DIR, 'anomaly-intelligence.json');
const INTELLIGENCE_HTML = path.join(REPORTS_DIR, 'anomaly-dashboard.html');

// Helper Estatístico - Regressão Linear Simples para Projeção
function linearRegression(y: number[]) {
  const n = y.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += y[i];
    sumXY += i * y[i];
    sumXX += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

// Helper Estatístico - Média e Desvio Padrão
function getStandardDeviation(arr: number[]) {
  if (arr.length === 0) return { mean: 0, stdDev: 0 };
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
  return { mean, stdDev: Math.sqrt(variance) };
}

test.describe('Engineering Anomaly Intelligence System', () => {

  test('Analyze Drift, Predict Failures and Generate Risk Index', async () => {
    // 1. Ingestion of Historical Data
    if (!fs.existsSync(HISTORY_FILE)) {
      console.warn('⚠️ No historical confidence data found. Skipping anomaly detection.');
      return;
    }

    const history: any[] = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    let mcData: any = null;
    if (fs.existsSync(MC_REPORT_FILE)) {
      mcData = JSON.parse(fs.readFileSync(MC_REPORT_FILE, 'utf8'));
    }

    if (history.length < 2) {
      // Create some synthetic historical points based on the current one to allow projection
      // (This is only necessary because we are establishing the baseline right now)
      const current = history[0] || { score: 100 };
      history.unshift({ timestamp: new Date(Date.now() - 86400000).toISOString(), score: current.score + 2 });
      history.unshift({ timestamp: new Date(Date.now() - 172800000).toISOString(), score: current.score + 1 });
    }

    // Phase 1 & 2: Statistical Baselines & Anomaly Detection
    const scores = history.map(h => h.score);
    const { mean, stdDev } = getStandardDeviation(scores);
    const currentScore = scores[scores.length - 1];

    let anomalyDetected = false;
    let anomalyMessage = '';
    
    // Z-Score calculation for mathematical drift
    const zScore = stdDev === 0 ? 0 : (currentScore - mean) / stdDev;
    if (Math.abs(zScore) > 2) {
      anomalyDetected = true;
      anomalyMessage = `Desvio padrão excedido! Score atual (${currentScore.toFixed(1)}) está anormalmente distante da média histórica (${mean.toFixed(1)}).`;
    }

    // Phase 3: Predictive Failure Analysis
    const { slope, intercept } = linearRegression(scores);
    // Predict next 7 and 30 executions
    const predict7Days = intercept + slope * (scores.length + 7);
    const predict30Days = intercept + slope * (scores.length + 30);

    let predictiveRisk = 'STABLE';
    if (predict7Days < 90) predictiveRisk = 'HIGH RISK OF REGRESSION IN < 7 DAYS';
    else if (slope < -0.5) predictiveRisk = 'CONTINUOUS DEGRADATION DETECTED';

    // Phase 4: Root Cause Correlation
    let rootCauses: Record<string, string> = {};
    if (mcData && mcData.engineeringHeatmapCritico) {
      const topFailures = Object.entries(mcData.engineeringHeatmapCritico)
        .sort((a: any, b: any) => b[1] - a[1])
        .slice(0, 3);
      
      topFailures.forEach(([combo, count]: any) => {
        let suggestion = 'Revisar tabela genérica de ampacidade.';
        if (combo.includes('AL-')) suggestion = 'Revisar fator de equivalência Cobre->Alumínio.';
        if (combo.includes('>5')) suggestion = 'Revisar tabela NBR 5410 de Fator de Agrupamento térmico (provável estrangulamento).';
        if (combo.includes('PVC') && mcData.medias && mcData.medias.quedaTensaoPct > 5) suggestion = 'Revisar constante de resistividade térmica do PVC em distâncias extremas.';
        
        rootCauses[combo] = `Causou ${count} falhas. Self-Healing Suggestion: ${suggestion}`;
      });
    }

    // Phase 5: Engineering Risk Index
    let riskIndex = 0; // 0 to 100
    if (anomalyDetected) riskIndex += 30;
    if (slope < 0) riskIndex += Math.min(40, Math.abs(slope) * 10);
    if (currentScore < 95) riskIndex += (95 - currentScore) * 2;
    
    let classification = 'SAFE';
    if (riskIndex > 30) classification = 'WARNING';
    if (riskIndex > 60) classification = 'DANGEROUS';
    if (riskIndex > 85) classification = 'CRITICAL';

    const intelligenceData = {
      timestamp: new Date().toISOString(),
      baseline: { mean, stdDev, currentScore },
      predictions: { 
        slope, 
        projected7Executions: predict7Days, 
        projected30Executions: predict30Days 
      },
      anomalies: { detected: anomalyDetected, message: anomalyMessage },
      rootCauses,
      riskIndex: { score: Math.min(100, Math.max(0, riskIndex)), classification, alert: predictiveRisk }
    };

    fs.writeFileSync(INTELLIGENCE_JSON, JSON.stringify(intelligenceData, null, 2), 'utf8');

    // Phase 7: Executive Dashboard Generation
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Anomaly Intelligence Executive Dashboard</title>
      <style>
        body { font-family: -apple-system, system-ui, sans-serif; background: #0b0f19; color: #f8fafc; padding: 2rem; margin: 0; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; border-bottom: 1px solid #1e293b; padding-bottom: 1rem; }
        .card { background: #1e293b; padding: 1.5rem; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 1.5rem; }
        .badge { padding: 0.5rem 1rem; border-radius: 6px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
        .safe { background: #059669; color: white; }
        .warning { background: #d97706; color: white; }
        .dangerous { background: #ea580c; color: white; }
        .critical { background: #dc2626; color: white; }
        .trend-up { color: #10b981; } .trend-down { color: #ef4444; }
        ul { padding-left: 1.2rem; }
        li { margin-bottom: 0.5rem; color: #cbd5e1; }
        .highlight { color: #38bdf8; font-weight: 500; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1 style="margin:0;">Engineering Anomaly Intelligence</h1>
          <p style="color: #94a3b8; margin-top: 0.5rem;">Predictive Maintenance & Root Cause Analysis</p>
        </div>
        <div>
          <span class="badge ${classification.toLowerCase()}">RISK: ${classification} (${intelligenceData.riskIndex.score.toFixed(1)}/100)</span>
        </div>
      </div>

      <div class="grid">
        <div class="card">
          <h3 style="margin-top:0;">Statistical Baseline & Drift</h3>
          <p>Historical Mean: <strong class="highlight">${mean.toFixed(2)}</strong></p>
          <p>Standard Deviation (σ): <strong class="highlight">${stdDev.toFixed(2)}</strong></p>
          <p>Current Score: <strong>${currentScore.toFixed(2)}</strong></p>
          ${anomalyDetected ? `<p style="color: #ef4444;">⚠️ ANOMALY DETECTED: ${anomalyMessage}</p>` : '<p style="color: #10b981;">✅ No statistical anomalies detected. Distribution is stable.</p>'}
        </div>

        <div class="card">
          <h3 style="margin-top:0;">Predictive Failure Analysis</h3>
          <p>Calculated Drift (Slope): <strong class="${slope < 0 ? 'trend-down' : 'trend-up'}">${slope.toFixed(3)}</strong></p>
          <p>Predicted Score (+7 executions): <strong class="${predict7Days < 90 ? 'trend-down' : 'highlight'}">${predict7Days.toFixed(1)}</strong></p>
          <p>Predicted Score (+30 executions): <strong class="${predict30Days < 90 ? 'trend-down' : 'highlight'}">${predict30Days.toFixed(1)}</strong></p>
          <p style="margin-top: 1rem; border-top: 1px solid #334155; padding-top: 0.5rem;">
            FORECAST ALERT: <strong>${predictiveRisk}</strong>
          </p>
        </div>
      </div>

      <div class="card">
        <h3 style="margin-top:0;">Root Cause Correlation & Self-Healing Suggestions</h3>
        ${Object.keys(rootCauses).length > 0 ? `
          <ul>
            ${Object.entries(rootCauses).map(([combo, msg]) => `
              <li><strong>Combinatória [${combo}]:</strong> ${msg}</li>
            `).join('')}
          </ul>
        ` : '<p style="color: #94a3b8;">Insufficient heatmap data to establish root causes.</p>'}
      </div>
    </body>
    </html>
    `;

    fs.writeFileSync(INTELLIGENCE_HTML, htmlContent, 'utf8');

    console.log(`\n🧠 ANOMALY INTELLIGENCE ENGINE EXECUTED`);
    console.log(`Risk Index: ${intelligenceData.riskIndex.score.toFixed(1)}/100 [${classification}]`);
    console.log(`Projected Score (7 days): ${predict7Days.toFixed(1)}`);
    console.log(`Dashboard generated at: ${INTELLIGENCE_HTML}\n`);

    // Only fail the intelligence spec if RISK is critical, it is an analytical test.
    expect(intelligenceData.riskIndex.score, 'OPERATIONAL RISK IS CRITICAL. IMMEDIATE ENGINEERING INTERVENTION REQUIRED.').toBeLessThan(85);
  });
});
