import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  await page.goto('/');
  console.log('localStorage antes:', await page.evaluate(() => JSON.stringify(localStorage)));
  await page.goto('/login');
  
  // Using exact names from the Login component
  await page.fill('input[name="email"]', 'engenheiro@industria.com');
  await page.fill('input[name="senha"]', 'Admin123!');
  
  // Wait for actual API response
  const loginResponse = page.waitForResponse(res => 
    res.url().includes('/auth/login') && (res.status() === 200 || res.status() === 201)
  );
  
  // If account doesn't exist, we fallback to registration
  // First try login
  await page.click('button[type="submit"]');
  const res = await loginResponse;
  
  if (res.status() !== 200) {
    // Attempt registration
    await page.getByText('Criar conta').click();
    await page.fill('input[name="nome"]', 'Engenheiro Teste');
    await page.fill('input[name="email"]', 'engenheiro@industria.com');
    await page.fill('input[name="senha"]', 'Admin123!');
    
    const regResponse = page.waitForResponse(r => r.url().includes('/auth/registro'));
    await page.click('button[type="submit"]');
    await regResponse;
  }
  
  // Verify Dashboard loaded
  await page.waitForURL('/dashboard');
  await expect(page.getByTestId('btn-novo-projeto-header')).toBeVisible();

  // Save auth state (localStorage)
  await page.context().storageState({ path: authFile });
});
