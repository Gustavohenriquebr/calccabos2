import { test, expect } from '@playwright/test';
import fs from 'fs';

test('Diagnostic Login', async ({ page, context }) => {
  const errors = [];
  const consoleLogs = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleLogs.push(msg.text());
    }
  });

  page.on('pageerror', error => {
    errors.push(error.message);
  });

  console.log('--- DIAGNOSTIC SCRIPT START ---');

  try {
    // 3. Verifique se há um token antigo em localStorage
    await page.goto('http://localhost:5173/');
    await page.waitForLoadState('domcontentloaded');

    let token = await page.evaluate(() => localStorage.getItem('token'));
    console.log(`[DIAGNOSTIC_TOKEN] Token before /login navigation: ${token}`);

    // 1 & 2. Vá até http://localhost:5173/login
    await page.goto('http://localhost:5173/login');
    await page.waitForTimeout(3000); 

    console.log(`[DIAGNOSTIC_URL] Current URL after /login navigation: ${page.url()}`);

    await page.screenshot({ path: '/Users/guga/Desktop/calccabos-main/frontend/login-diagnostic.png' });
    console.log('[DIAGNOSTIC_SCREENSHOT] Screenshot saved to frontend/login-diagnostic.png');

  } catch (error) {
    console.error('Navigation failed:', error);
  }

  console.log('--- CONSOLE ERRORS ---');
  consoleLogs.forEach(err => console.log(`[CONSOLE_ERROR] ${err}`));

  console.log('--- PAGE ERRORS ---');
  errors.forEach(err => console.log(`[PAGE_ERROR] ${err}`));
  
  // Create a JSON output to easily parse
  fs.writeFileSync('diagnostic-results.json', JSON.stringify({
      token,
      url: page.url(),
      consoleLogs,
      pageErrors: errors
  }, null, 2));
});
