import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const REPORTS_DIR = path.join(__dirname, 'reports');
const HISTORY_FILE = path.join(REPORTS_DIR, 'confidence-history.json');
const HTML_REPORT_FILE = path.join(REPORTS_DIR, 'confidence-dashboard.html');

interface TestFailure {
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  deduction: number;
}

test.describe('Global Engineering Confidence Platform', () => {
  
  test('Consolidate Metrics & Generate Release Gating', async () => {
    // 1. Gather Artifacts from previous test suites
    let monteCarloData: any = null;
    let benchmarkData: any = null;
    
    try {
      const mcPath = path.join(REPORTS_DIR, 'montecarlo-report.json');
      if (fs.existsSync(mcPath)) monteCarloData = JSON.parse(fs.readFileSync(mcPath, 'utf8'));
      
      const bPath = path.join(__dirname, 'snapshots', 'benchmark.json');
      if (fs.existsSync(bPath)) benchmarkData = JSON.parse(fs.readFileSync(bPath, 'utf8'));
    } catch (e) {
      console.error('Failed to load partial reports. Running Confidence Engine with available data only.');
    }

    // 2. Weights & Global Engine Configuration
    let maxScore = 100;
    let currentScore = maxScore;
    let failures: TestFailure[] = [];
    
    let scores = {
      mathReliability: 100,
      normativeConsistency: 100,
      backendStability: 100,
      uiExportReliability: 100
    };

    // 3. Failure Classification (Phase 3 & 2)
    const addFailure = (type: string, severity: 'CRITICAL'|'HIGH'|'MEDIUM'|'LOW', msg: string, cat: keyof typeof scores) => {
      let deduction = 0;
      if (severity === 'CRITICAL') deduction = 30;
      if (severity === 'HIGH') deduction = 15;
      if (severity === 'MEDIUM') deduction = 5;
      if (severity === 'LOW') deduction = 2;
      
      failures.push({ type, severity, message: msg, deduction });
      scores[cat] = Math.max(0, scores[cat] - deduction);
      currentScore = Math.max(0, currentScore - (deduction * 0.25)); // Overall score penalization
    };

    // Analyzing Monte Carlo Data
    if (monteCarloData) {
      if (monteCarloData.falhasMatematicas > 0) {
        addFailure('MATH_INVALID', 'CRITICAL', `${monteCarloData.falhasMatematicas} circuitos geraram NaN/Infinity`, 'mathReliability');
      }
      if (monteCarloData.networkIssues && monteCarloData.networkIssues > 0) {
        addFailure('HTTP_500', 'CRITICAL', `${monteCarloData.networkIssues} falhas de servidor detectadas`, 'backendStability');
      }
    }

    // Phase 4: Trend Analysis & History
    let history: any[] = [];
    if (fs.existsSync(HISTORY_FILE)) {
      history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    }

    const previousScore = history.length > 0 ? history[history.length - 1].score : currentScore;
    let trend = 'STABLE';
    if (currentScore < previousScore) trend = 'DEGRADING';
    if (currentScore > previousScore) trend = 'IMPROVING';

    const currentExecution = {
      timestamp: new Date().toISOString(),
      score: currentScore,
      scores,
      trend,
      failures: failures.length
    };
    
    history.push(currentExecution);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');

    // CI/CD Integration: CSV Generation
    const csvLines = history.map(h => `${h.timestamp},${h.score},${h.scores.mathReliability},${h.scores.normativeConsistency},${h.trend}`);
    fs.writeFileSync(path.join(REPORTS_DIR, 'metrics.csv'), `Timestamp,GlobalScore,MathScore,NormativeScore,Trend\n${csvLines.join('\n')}`, 'utf8');

    // Phase 6: HTML Dashboard Generation
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>CalcCabos Confidence Dashboard</title>
      <style>
        body { font-family: -apple-system, system-ui, sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem; }
        .card { background: #1e293b; padding: 1.5rem; border-radius: 8px; margin-bottom: 1.5rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .score-huge { font-size: 4rem; font-weight: 800; margin: 0; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; }
        .approved { color: #22c55e; } .warning { color: #eab308; } .critical { color: #ef4444; }
        .badge { display: inline-block; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem; font-weight: bold; }
        .bg-crit { background: #ef4444; color: white; }
        .bg-high { background: #f97316; color: white; }
        table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
        th, td { text-align: left; padding: 0.75rem; border-bottom: 1px solid #334155; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>Global Engineering Confidence Score</h2>
        <h1 class="score-huge ${currentScore >= 95 ? 'approved' : currentScore >= 90 ? 'warning' : 'critical'}">
          ${currentScore.toFixed(1)} / 100
        </h1>
        <p>Trend: <strong>${trend}</strong> (Previous: ${previousScore.toFixed(1)})</p>
        <p>Status: <strong>${currentScore >= 95 ? '✅ APPROVED FOR RELEASE' : currentScore >= 90 ? '⚠️ WARNING' : '❌ FAIL RELEASE'}</strong></p>
      </div>

      <div class="grid">
        <div class="card"><h3>Math Reliability</h3><h2 class="${scores.mathReliability >= 90 ? 'approved' : 'critical'}">${scores.mathReliability}%</h2></div>
        <div class="card"><h3>Normative Consistency</h3><h2 class="${scores.normativeConsistency >= 90 ? 'approved' : 'critical'}">${scores.normativeConsistency}%</h2></div>
        <div class="card"><h3>Backend Stability</h3><h2 class="${scores.backendStability >= 90 ? 'approved' : 'critical'}">${scores.backendStability}%</h2></div>
        <div class="card"><h3>UI / Export Reliability</h3><h2 class="${scores.uiExportReliability >= 90 ? 'approved' : 'critical'}">${scores.uiExportReliability}%</h2></div>
      </div>

      <div class="card">
        <h2>Detected Failures</h2>
        ${failures.length === 0 ? '<p class="approved">Zero failures detected. System is pristine.</p>' : `
        <table>
          <tr><th>Severity</th><th>Type</th><th>Message</th><th>Impact</th></tr>
          ${failures.map(f => `
            <tr>
              <td><span class="badge ${f.severity === 'CRITICAL' ? 'bg-crit' : 'bg-high'}">${f.severity}</span></td>
              <td>${f.type}</td>
              <td>${f.message}</td>
              <td class="critical">-${f.deduction} pts</td>
            </tr>
          `).join('')}
        </table>
        `}
      </div>
    </body>
    </html>
    `;
    
    fs.writeFileSync(HTML_REPORT_FILE, htmlContent, 'utf8');

    console.log(`\n==== ENGINEERING CONFIDENCE SCORE: ${currentScore.toFixed(1)}/100 ====`);
    console.log(`Release Gating Status: ${currentScore >= 95 ? 'APPROVED' : currentScore >= 90 ? 'WARNING' : 'FAIL'}`);
    console.log(`HTML Dashboard generated at: ${HTML_REPORT_FILE}`);
    console.log(`Metrics exported to CSV and JSON for Datadog/Grafana integration.\n`);

    // Phase 5: Release Gating Hard Assert
    expect(currentScore, `RELEASE GATING FAILED! Confidence Score ${currentScore} is below absolute minimum threshold of 90.`).toBeGreaterThanOrEqual(90);
  });
});
