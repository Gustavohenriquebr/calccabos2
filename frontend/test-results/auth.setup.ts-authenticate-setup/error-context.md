# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.setup.ts >> authenticate
- Location: tests/auth.setup.ts:5:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('input[name="email"]')

```

# Page snapshot

```yaml
- generic [ref=f1e3]:
  - banner [ref=f1e4]:
    - generic [ref=f1e5]:
      - button "CalcCabos Memorial elétrico industrial" [ref=f1e6] [cursor=pointer]:
        - generic [ref=f1e12]:
          - generic [ref=f1e13]: CalcCabos
          - generic [ref=f1e14]: Memorial elétrico industrial
      - generic [ref=f1e15]:
        - button "Entrar" [ref=f1e16] [cursor=pointer]
        - button "Criar conta grátis" [ref=f1e17] [cursor=pointer]
  - main [ref=f1e18]:
    - generic [ref=f1e20]:
      - generic [ref=f1e21]:
        - generic [ref=f1e22]: Plataforma para engenharia elétrica industrial
        - heading "Dimensione cabos industriais com a precisão que a norma exige." [level=1] [ref=f1e25]
        - paragraph [ref=f1e26]: Cálculo, validação de proteções e memorial técnico em um único fluxo — do transformador ao último circuito, com apoio de IA.
        - generic [ref=f1e27]:
          - button "Criar conta grátis" [ref=f1e28] [cursor=pointer]
          - button "Entrar" [ref=f1e29] [cursor=pointer]
        - generic [ref=f1e30]:
          - generic [ref=f1e31]: OK
          - generic [ref=f1e35]: ALERTA
          - generic [ref=f1e39]: CRÍTICO
      - generic [ref=f1e43]:
        - generic [ref=f1e45]:
          - generic [ref=f1e46]:
            - generic [ref=f1e47]: Projeto executivo
            - generic [ref=f1e48]: Subestação Industrial QGBT-01
          - generic [ref=f1e49]: ALERTA
        - generic [ref=f1e53]:
          - generic [ref=f1e55]:
            - generic [ref=f1e56]: Circuitos calculados
            - generic [ref=f1e57]: "128"
          - generic [ref=f1e63]:
            - generic [ref=f1e64]: Pendências críticas
            - generic [ref=f1e65]: "2"
          - generic [ref=f1e71]:
            - generic [ref=f1e72]: Memoriais exportados
            - generic [ref=f1e73]: PDF / Excel
          - generic [ref=f1e78]:
            - generic [ref=f1e79]: Central de pendências
            - generic [ref=f1e80]:
              - generic [ref=f1e81]:
                - generic [ref=f1e82]: Para-raios incompleto
                - generic [ref=f1e83]: ALERTA
              - generic [ref=f1e87]:
                - generic [ref=f1e88]: Equipamento sem proteção Ex
                - generic [ref=f1e89]: CRÍTICO
    - generic [ref=f1e98]:
      - generic [ref=f1e99]:
        - generic [ref=f1e100]: BENEFÍCIOS
        - heading "Do cálculo à documentação, num fluxo único." [level=2] [ref=f1e101]
        - paragraph [ref=f1e102]: O CalcCabos organiza cálculo, validação e documentação para projetos industriais.
      - generic [ref=f1e103]:
        - generic [ref=f1e105]:
          - heading "Dimensionamento de cabos" [level=3] [ref=f1e111]
          - paragraph [ref=f1e112]: Corrente de projeto, ampacidade, queda de tensão e critérios de seleção.
        - generic [ref=f1e114]:
          - heading "Validação automática" [level=3] [ref=f1e120]
          - paragraph [ref=f1e121]: Status técnico por circuito e módulo para revisar pendências com clareza.
        - generic [ref=f1e123]:
          - heading "Proteções e Icc" [level=3] [ref=f1e128]
          - paragraph [ref=f1e129]: Disjuntores, Icu, curto-circuito e verificações de compatibilidade.
        - generic [ref=f1e131]:
          - heading "Memorial PDF/Excel" [level=3] [ref=f1e136]
          - paragraph [ref=f1e137]: Documentação técnica exportável para revisão, auditoria e emissão.
        - generic [ref=f1e139]:
          - heading "Diagrama unifilar" [level=3] [ref=f1e146]
          - paragraph [ref=f1e147]: Representação simples do projeto, transformador, barramento e circuitos.
        - generic [ref=f1e149]:
          - heading "Agente com IA" [level=3] [ref=f1e154]
          - paragraph [ref=f1e155]: Apoio para explicar cálculos, pendências e decisões técnicas.
    - generic [ref=f1e161]:
      - generic [ref=f1e162]:
        - generic [ref=f1e163]: MÓDULOS
        - heading "Um ambiente completo" [level=2] [ref=f1e164]
        - paragraph [ref=f1e165]: Estruture o memorial elétrico industrial além da tabela de cabos.
      - generic [ref=f1e166]:
        - generic [ref=f1e167]: "# Transformador / Entrada"
        - generic [ref=f1e169]: "# Sistema elétrico"
        - generic [ref=f1e171]: "# Circuitos"
        - generic [ref=f1e173]: "# Cabos"
        - generic [ref=f1e175]: "# Proteções"
        - generic [ref=f1e177]: "# Para-raios"
        - generic [ref=f1e179]: "# Aterramento"
        - generic [ref=f1e181]: "# Áreas classificadas"
        - generic [ref=f1e183]: "# Memorial"
        - generic [ref=f1e185]: "# Diagrama unifilar"
        - generic [ref=f1e187]: "# Agente IA"
    - generic [ref=f1e194]:
      - generic [ref=f1e195]:
        - generic [ref=f1e196]: COMO FUNCIONA
        - heading "Do cadastro do projeto à documentação final" [level=2] [ref=f1e197]
      - generic [ref=f1e198]:
        - generic [ref=f1e201]:
          - generic [ref=f1e202]: "1"
          - heading "Crie um projeto" [level=3] [ref=f1e203]
          - paragraph [ref=f1e204]: Defina cliente, contexto normativo e tensão de referência.
        - generic [ref=f1e206]:
          - generic [ref=f1e207]: "2"
          - heading "Cadastre a entrada" [level=3] [ref=f1e208]
          - paragraph [ref=f1e209]: Informe transformador, sistema elétrico e premissas principais.
        - generic [ref=f1e211]:
          - generic [ref=f1e212]: "3"
          - heading "Importe ou crie circuitos" [level=3] [ref=f1e213]
          - paragraph [ref=f1e214]: Monte a lista de cargas manualmente ou por planilha.
        - generic [ref=f1e216]:
          - generic [ref=f1e217]: "4"
          - heading "Valide pendências" [level=3] [ref=f1e218]
          - paragraph [ref=f1e219]: Revise alertas, críticos, proteções, Icc e documentação técnica.
        - generic [ref=f1e221]:
          - generic [ref=f1e222]: "5"
          - heading "Gere o memorial" [level=3] [ref=f1e223]
          - paragraph [ref=f1e224]: Exporte PDF/Excel e use a IA para apoiar a revisão.
    - generic [ref=f1e230]:
      - generic [ref=f1e231]:
        - generic [ref=f1e232]: PARA QUEM É
        - heading "Feito para quem assina o projeto" [level=2] [ref=f1e233]
      - generic [ref=f1e234]:
        - generic [ref=f1e235]: Engenheiros eletricistas
        - generic [ref=f1e241]: Projetistas industriais
        - generic [ref=f1e247]: Empresas de manutenção
        - generic [ref=f1e253]: Consultorias técnicas
        - generic [ref=f1e259]: Estudantes de engenharia
        - generic [ref=f1e265]: Times de engenharia industrial
    - generic [ref=f1e274]:
      - generic [ref=f1e275]:
        - generic [ref=f1e276]: Ambiente técnico de projeto elétrico
        - heading "Comece seu próximo memorial industrial." [level=2] [ref=f1e281]
        - paragraph [ref=f1e282]: Crie projetos, valide pendências e gere documentação técnica com mais clareza.
      - generic [ref=f1e283]:
        - button "Entrar" [ref=f1e284] [cursor=pointer]
        - button "Criar conta grátis" [ref=f1e285] [cursor=pointer]
```

# Test source

```ts
  1  | import { test as setup, expect } from '@playwright/test';
  2  | 
  3  | const authFile = 'playwright/.auth/user.json';
  4  | 
  5  | setup('authenticate', async ({ page }) => {
  6  |   await page.goto('/');
  7  |   console.log('localStorage antes:', await page.evaluate(() => JSON.stringify(localStorage)));
  8  |   await page.goto('/login');
  9  |   
  10 |   // Using exact names from the Login component
> 11 |   await page.fill('input[name="email"]', 'engenheiro@industria.com');
     |              ^ Error: page.fill: Test timeout of 30000ms exceeded.
  12 |   await page.fill('input[name="senha"]', 'Admin123!');
  13 |   
  14 |   // Wait for actual API response
  15 |   const loginResponse = page.waitForResponse(res => 
  16 |     res.url().includes('/auth/login') && (res.status() === 200 || res.status() === 201)
  17 |   );
  18 |   
  19 |   // If account doesn't exist, we fallback to registration
  20 |   // First try login
  21 |   await page.click('button[type="submit"]');
  22 |   const res = await loginResponse;
  23 |   
  24 |   if (res.status() !== 200) {
  25 |     // Attempt registration
  26 |     await page.getByText('Criar conta').click();
  27 |     await page.fill('input[name="nome"]', 'Engenheiro Teste');
  28 |     await page.fill('input[name="email"]', 'engenheiro@industria.com');
  29 |     await page.fill('input[name="senha"]', 'Admin123!');
  30 |     
  31 |     const regResponse = page.waitForResponse(r => r.url().includes('/auth/registro'));
  32 |     await page.click('button[type="submit"]');
  33 |     await regResponse;
  34 |   }
  35 |   
  36 |   // Verify Dashboard loaded
  37 |   await page.waitForURL('/dashboard');
  38 |   await expect(page.getByTestId('btn-novo-projeto-header')).toBeVisible();
  39 | 
  40 |   // Save auth state (localStorage)
  41 |   await page.context().storageState({ path: authFile });
  42 | });
  43 | 
```