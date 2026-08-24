import { Page, expect, BrowserContext } from '@playwright/test';

// ── Test Data ──
export const TEST_USER = {
  nome: 'Engenheiro Teste',
  email: 'engenheiro@industria.com',
  senha: 'Admin123!',
};

export const TEST_PROJECT = {
  nome: 'Subestação Industrial SE-01',
  cliente: 'Petrobras REPAR',
  descricao: 'Projeto de teste funcional E2E — CalcCabos',
  contexto: 'industrial',
  tensao_ref: '380',
};

export const TEST_TRANSFORMER = {
  potencia_kva: '1000',
  tensao_primaria: '13800',
  tensao_secundaria: '380',
  impedancia_percentual: '5.75',
  frequencia: '60',
};

export const TEST_SISTEMA = {
  potencia_ativa_kw: '150',
  potencia_aparente_kva: '176',
  potencia_reativa_kvar: '92',
  tensao_linha: '380',
  corrente_linha: '267',
  fator_potencia: '0.85',
  rendimento: '0.95',
};

export const TEST_CIRCUIT = {
  tag: 'C-01',
  descricao: 'Motor bomba centrífuga',
  from_barramento: 'QGBT-01',
  to_equipamento: 'BC-101',
  potencia_kw: '15',
  tensao: '380',
  fator_potencia: '0.85',
  fator_eficiencia: '0.92',
  fator_demanda: '1',
  distancia_m: '45',
  fases: '3',
  agrupamento: '1',
  formacao: '1',
  temp_ambiente: '30',
};

// ── Result Tracking ──
export interface StepResult {
  step: string;
  action: string;
  expected: string;
  actual: string;
  status: 'PASSOU' | 'FALHOU' | 'PARCIAL' | 'BLOQUEADO';
  screenshot?: string;
  consoleErrors?: string[];
  networkErrors?: string[];
  notes?: string;
}

export const results: StepResult[] = [];

export function recordResult(result: StepResult) {
  results.push(result);
}

// ── Console & Network Error Capture ──
export function setupErrorCapture(page: Page) {
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(`[console.error] ${msg.text()}`);
    }
  });

  page.on('requestfailed', (req) => {
    networkErrors.push(`[network] ${req.method()} ${req.url()} — ${req.failure()?.errorText}`);
  });

  page.on('response', (res) => {
    if (res.status() >= 400) {
      networkErrors.push(`[HTTP ${res.status()}] ${res.request().method()} ${res.url()}`);
    }
  });

  return { consoleErrors, networkErrors };
}

// ── Login Helper ──
export async function loginIfNeeded(page: Page) {
  // Navigate to app first so localStorage is accessible
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  // Check if already logged in via localStorage
  let token = '';
  try {
    token = await page.evaluate(() => localStorage.getItem('token') || '');
  } catch {
    token = '';
  }

  if (token) {
    // Already authenticated — navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    return;
  }

  // Go to login page
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Fill login form — the app uses name="email" and name="senha"
  await page.fill('input[name="email"]', TEST_USER.email);
  await page.fill('input[name="senha"]', TEST_USER.senha);

  // Intercept the API call before clicking
  const loginResponsePromise = page.waitForResponse(
    (res) => res.url().includes('/auth/login') && (res.status() === 200 || res.status() === 201),
    { timeout: 15000 }
  ).catch(() => null);

  await page.click('button[type="submit"]');
  const res = await loginResponsePromise;

  if (!res || res.status() !== 200) {
    // Try registration — it's a tab on the same /login page
    console.log('Login failed or account not found, switching to registration...');
    // Click the "Criar conta" tab pill
    await page.getByText('Criar conta').click();
    await page.waitForTimeout(400); // animation

    // Fill registration fields
    await page.fill('input[name="nome"]', TEST_USER.nome);
    await page.fill('input[name="email"]', TEST_USER.email);
    await page.fill('input[name="senha"]', TEST_USER.senha);

    const regResponsePromise = page.waitForResponse(
      (r) => r.url().includes('/auth/registro') && (r.status() === 200 || r.status() === 201),
      { timeout: 15000 }
    );
    await page.click('button[type="submit"]');
    await regResponsePromise;
  }

  // After login/register the app navigates to '/' (landing page) — then go to dashboard
  await page.waitForURL(/^http:\/\/localhost:5173(\/)?$|\/dashboard/, { timeout: 15000 });
  if (!page.url().includes('/dashboard')) {
    await page.goto('/dashboard');
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
  }
}

// ── Toast Waiting ──
export async function waitForToast(page: Page, textOrPattern: string | RegExp, timeout = 8000): Promise<string> {
  const toastLocator = page.locator('[class*="toast"], [role="status"], [data-sonner-toast]');
  
  // Also check for react-hot-toast notifications
  const hotToast = page.locator('div[style*="translate"]').filter({ hasText: textOrPattern instanceof RegExp ? textOrPattern : new RegExp(textOrPattern, 'i') });
  
  try {
    // react-hot-toast creates divs with specific styles
    await expect(hotToast.first()).toBeVisible({ timeout });
    const text = await hotToast.first().textContent();
    return text || '';
  } catch {
    // Fallback — just wait a bit for the API to respond
    await page.waitForTimeout(2000);
    return '';
  }
}

// ── Fill Input Robustly ──
export async function fillInput(page: Page, selector: string, value: string) {
  const input = page.locator(selector);
  await input.waitFor({ state: 'visible', timeout: 5000 });
  await input.click();
  await input.fill('');
  await input.fill(value);
}

// ── Navigate to a project tab ──
export async function navigateToTab(page: Page, tabId: string) {
  const tab = page.locator(`[data-testid="aba-${tabId}"]`);
  await tab.waitFor({ state: 'visible', timeout: 5000 });
  await tab.click();
  await page.waitForTimeout(1000); // Let the tab content load
}

// ── Generate Markdown Report ──
export function generateReport(results: StepResult[]): string {
  const lines: string[] = [
    '# Teste Funcional End-to-End',
    '',
    `**Data de execução:** ${new Date().toISOString().split('T')[0]}`,
    `**Ambiente:** Local (Mac) — Playwright Chromium`,
    '',
    '## Resumo',
    '',
    `| Indicador | Valor |`,
    `|-----------|-------|`,
    `| Total de passos | ${results.length} |`,
    `| Passou | ${results.filter((r) => r.status === 'PASSOU').length} |`,
    `| Falhou | ${results.filter((r) => r.status === 'FALHOU').length} |`,
    `| Parcial | ${results.filter((r) => r.status === 'PARCIAL').length} |`,
    `| Bloqueado | ${results.filter((r) => r.status === 'BLOQUEADO').length} |`,
    '',
    '---',
    '',
  ];

  for (const r of results) {
    const emoji = r.status === 'PASSOU' ? '✅' : r.status === 'FALHOU' ? '❌' : r.status === 'PARCIAL' ? '⚠️' : '🚫';
    lines.push(`## ${emoji} ${r.step}`);
    lines.push('');
    lines.push(`- **Ação tentada:** ${r.action}`);
    lines.push(`- **Resultado esperado:** ${r.expected}`);
    lines.push(`- **Resultado real:** ${r.actual}`);
    lines.push(`- **Status:** ${r.status}`);
    if (r.notes) lines.push(`- **Notas:** ${r.notes}`);
    if (r.screenshot) lines.push(`- **Screenshot:** \`${r.screenshot}\``);
    if (r.consoleErrors?.length) {
      lines.push(`- **Erros de console:**`);
      r.consoleErrors.slice(0, 5).forEach((e) => lines.push(`  - \`${e}\``));
    }
    if (r.networkErrors?.length) {
      lines.push(`- **Erros de network:**`);
      r.networkErrors.slice(0, 5).forEach((e) => lines.push(`  - \`${e}\``));
    }
    lines.push('');
  }

  return lines.join('\n');
}
