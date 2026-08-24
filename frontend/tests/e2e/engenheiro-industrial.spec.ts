import { test, expect, Page } from '@playwright/test';

let testProjectId: string | null = null;
let consoleErrors: string[] = [];

// Helper to fill a circuit
async function createCircuit(page: Page, data: any) {
  // Wait for modal to be ready
  await page.getByTestId('input-descricao').waitFor({ state: 'visible' });
  
  await page.getByTestId('input-descricao').fill(data.descricao);
  await page.getByTestId('select-tensao').selectOption(data.tensao);
  await page.getByTestId('input-potencia-kw').fill(data.potencia_kw);
  await page.getByTestId('input-fator-potencia').fill(data.fator_potencia);
  await page.getByTestId('input-fator-eficiencia').fill(data.fator_eficiencia);
  await page.getByTestId('input-distancia-m').fill(data.distancia_m);
  await page.getByTestId('select-tipo-cabo').selectOption(data.tipo_cabo);
  
  const savePromise = page.waitForResponse(res => 
    res.url().includes('/circuitos/') && (res.status() === 200 || res.status() === 201)
  );
  await page.getByTestId('btn-salvar-circuito').click();
  const response = await savePromise;
  expect(response.ok()).toBeTruthy();
}

test.describe('Validação E2E - Engenharia Industrial', () => {
  // Run sequentially to carry over state
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(({ page }) => {
    // Monitor console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  test('Criação do Projeto Industrial', async ({ page }) => {
    await page.goto('/dashboard');
    
    const emptyBtn = page.getByTestId('btn-novo-projeto-empty');
    if (await emptyBtn.isVisible()) {
      await emptyBtn.click();
    } else {
      await page.getByTestId('btn-novo-projeto-header').click();
    }

    await page.getByTestId('input-projeto-nome').fill('Refinaria Norte - Unidade E2E');
    
    const createPromise = page.waitForResponse(res => res.url().includes('/projetos/') && res.status() === 200);
    await page.getByTestId('btn-salvar-projeto').click();
    const response = await createPromise;
    const body = await response.json();
    testProjectId = body.id;

    await page.waitForURL(/\/projeto\/\d+/);
    await expect(page.getByText('Refinaria Norte - Unidade E2E')).toBeVisible();
  });

  test('Adição de Cargas Industriais (Múltiplos Circuitos)', async ({ page }) => {
    expect(testProjectId).not.toBeNull();
    await page.goto(`/projeto/${testProjectId}`);
    
    await page.getByTestId('aba-circuitos').click();

    const circuitos = [
      { descricao: 'Bomba de Recalque 01', tensao: '380', potencia_kw: '45', fator_potencia: '0.85', fator_eficiencia: '92', distancia_m: '65', tipo_cabo: 'CU-PVC' },
      { descricao: 'Iluminação Galpão Principal', tensao: '220', potencia_kw: '8', fator_potencia: '0.95', fator_eficiencia: '100', distancia_m: '120', tipo_cabo: 'CU-PVC' },
      { descricao: 'Quadro Tomadas Industriais', tensao: '380', potencia_kw: '30', fator_potencia: '0.80', fator_eficiencia: '100', distancia_m: '30', tipo_cabo: 'CU-XLPE' },
      { descricao: 'Compressor Parafuso', tensao: '380', potencia_kw: '75', fator_potencia: '0.88', fator_eficiencia: '94', distancia_m: '85', tipo_cabo: 'CU-XLPE' },
      { descricao: 'Painel Auxiliar CCM', tensao: '380', potencia_kw: '150', fator_potencia: '0.85', fator_eficiencia: '95', distancia_m: '15', tipo_cabo: 'CU-XLPE' },
    ];

    for (const c of circuitos) {
      await page.getByTestId('btn-novo-circuito').click();
      await createCircuit(page, c);
      await expect(page.getByText(c.descricao)).toBeVisible();
    }
  });

  test('Cálculo em Lote e Validação de Resultados', async ({ page }) => {
    expect(testProjectId).not.toBeNull();
    await page.goto(`/projeto/${testProjectId}`);
    await page.getByTestId('aba-circuitos').click();

    // Disparar cálculo em lote
    const calcPromise = page.waitForResponse(res => res.url().includes('/calcular-lote/') && res.status() === 200);
    await page.getByTestId('btn-calcular-lote').click();
    const calcResponse = await calcPromise;
    const calcResult = await calcResponse.json();
    
    expect(calcResult.erros.length).toBe(0);
    await expect(page.getByText('calculados')).toBeVisible();

    // Recarregar os circuitos para validar
    const circuitosPromise = page.waitForResponse(res => res.url().includes(`/circuitos/projeto/${testProjectId}`) && res.status() === 200);
    await page.reload();
    const res = await circuitosPromise;
    const circuitos = await res.json();

    expect(circuitos.length).toBe(5);

    for (const c of circuitos) {
      // Nenhum campo crítico pode ser nulo ou indefinido após o cálculo
      expect(c.corrente_projeto).not.toBeNull();
      expect(Number.isNaN(c.corrente_projeto)).toBe(false);
      
      expect(c.secao_mm2).not.toBeNull();
      expect(Number.isNaN(c.secao_mm2)).toBe(false);
      
      expect(c.queda_tensao_perc).not.toBeNull();
      expect(Number.isNaN(c.queda_tensao_perc)).toBe(false);
      
      expect(c.status_final).toBeTruthy();
    }

    // Nenhuma exceção de runtime do React foi capturada
    expect(consoleErrors.length).toBe(0);
  });

  test('Validação de Exportação PDF e Excel', async ({ page }) => {
    expect(testProjectId).not.toBeNull();
    await page.goto(`/projeto/${testProjectId}`);
    
    // PDF Export
    const pdfPromise = page.waitForEvent('download');
    await page.getByTestId('btn-exportar-pdf').click();
    const pdfDownload = await pdfPromise;
    expect(pdfDownload.suggestedFilename()).toContain('.pdf');

    // Excel Export
    const excelPromise = page.waitForEvent('download');
    await page.getByTestId('btn-exportar-excel').click();
    const excelDownload = await excelPromise;
    expect(excelDownload.suggestedFilename()).toContain('.xlsx');
  });

  test('Teardown - Limpeza de Banco de Dados', async ({ page }) => {
    if (!testProjectId) return;
    await page.goto('/dashboard');
    
    // Auto-accept delete prompt
    page.on('dialog', dialog => dialog.accept());
    
    const projectCard = page.getByTestId(`projeto-card-${testProjectId}`);
    const deleteBtn = projectCard.locator('button[title="Excluir projeto"]');
    
    const deletePromise = page.waitForResponse(res => res.url().includes(`/projetos/${testProjectId}`) && res.status() === 200);
    await deleteBtn.click();
    await deletePromise;
    
    await expect(projectCard).not.toBeVisible();
  });
});
