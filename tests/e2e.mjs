/**
 * Teste de ponta a ponta no navegador (Playwright + Chrome instalado).
 *
 *   BASE_URL=http://localhost:3000 CHROME_PATH=/caminho/do/chrome npm run test:e2e
 *
 * Use um banco recém-criado (npm run db:reset): o teste aprova lançamentos,
 * envia arquivos e gera relatórios.
 *
 * Verifica, em desktop, tablet e celular:
 *   - todas as telas abrem sem erro no console;
 *   - nenhuma tela tem rolagem horizontal (conteúdo "vazando" da largura);
 *   - os fluxos principais funcionam (aprovar, lançar, enviar arquivo,
 *     gerar e liberar relatório, cadastrar conta, validação de CNPJ).
 * Capturas de tela vão para tests/screenshots/.
 */
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const OUT = new URL('./screenshots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const TELAS = { desktop: [1440, 900], tablet: [820, 1180], celular: [390, 844] };
const CONTADOR = ['Dashboard', 'Documentos', 'Lançamentos', 'Empresas', 'Plano de Contas', 'Relatórios'];
const CLIENTE = ['Meu Painel', 'Enviar Documentos', 'Relatórios'];

const falhas = [];
const ok = [];
const check = (cond, msg) => (cond ? ok.push(msg) : falhas.push(msg));

async function entrar(page, perfil) {
  await page.goto(BASE);
  await page.getByRole('button', { name: perfil === 'CONTADOR' ? 'Contador' : 'Cliente', exact: true }).click();
  await page.getByRole('button', { name: /Usar conta de demonstração/ }).click();
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.locator('main').waitFor();
}

async function irPara(page, nome, larguraMenuFixo) {
  if (!larguraMenuFixo) await page.getByRole('button', { name: 'Abrir menu' }).click();
  await page.locator('aside nav button', { hasText: nome }).first().click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(200);
}

async function semVazamento(page, rotulo) {
  const { sw, w } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
  check(sw <= w, `${rotulo}: sem rolagem horizontal (scrollWidth ${sw} / largura ${w})`);
}

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });

for (const [tela, [w, h]] of Object.entries(TELAS)) {
  for (const perfil of ['CONTADOR', 'CLIENTE']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'pt-BR' });
    const page = await ctx.newPage();
    const erros = [];
    page.on('console', (m) => m.type() === 'error' && !/status of 404/.test(m.text()) && erros.push(m.text()));
    page.on('pageerror', (e) => erros.push(String(e)));

    if (perfil === 'CONTADOR') {
      await page.goto(BASE);
      await page.screenshot({ path: `${OUT}${tela}_login.png`, fullPage: true });
      await semVazamento(page, `${tela} login`);
    }
    await entrar(page, perfil);
    const menuFixo = w >= 1024;

    for (const nome of perfil === 'CONTADOR' ? CONTADOR : CLIENTE) {
      await irPara(page, nome, menuFixo);
      const seletor = page.getByLabel('Empresa selecionada');
      if (perfil === 'CONTADOR' && (await seletor.count()) && !(await seletor.inputValue())) {
        await seletor.selectOption('1');
        await page.waitForLoadState('networkidle');
      }
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT}${tela}_${perfil.toLowerCase()}_${nome.replace(/\s+/g, '-').toLowerCase()}.png`, fullPage: true });
      await semVazamento(page, `${tela} ${perfil} ${nome}`);
    }
    if (!menuFixo) {
      await page.getByRole('button', { name: 'Abrir menu' }).click();
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${OUT}${tela}_${perfil.toLowerCase()}_menu-aberto.png` });
      check(await page.locator('aside').isVisible(), `${tela} ${perfil}: menu abre como gaveta`);
      await page.keyboard.press('Escape');
    }
    check(erros.length === 0, `${tela} ${perfil}: sem erros no console${erros.length ? ` → ${erros.slice(0, 3).join(' | ')}` : ''}`);
    await ctx.close();
  }
}

// ---------------- Fluxos (desktop) ----------------
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR', acceptDownloads: true });
  const page = await ctx.newPage();
  await entrar(page, 'CONTADOR');

  // Aprovar a sugestão da IA (lançamento da NF 145, ABC)
  await irPara(page, 'Lançamentos', true);
  await page.getByLabel('Empresa selecionada').selectOption('1');
  await page.waitForLoadState('networkidle');
  const card = page.locator('article', { hasText: 'NF 145 Fornecedor Delta' });
  await card.getByRole('button', { name: 'Documento' }).click();
  await page.screenshot({ path: `${OUT}fluxo_painel-documento.png`, fullPage: true });
  await card.getByRole('button', { name: 'Aprovar' }).click();
  await page.getByText(/aprovado\./).waitFor();
  check(await card.getByText('Aprovado', { exact: true }).isVisible(), 'Fluxo: aprovar sugestão da IA');

  // Novo lançamento manual
  await page.getByRole('button', { name: 'Novo lançamento' }).click();
  await page.getByLabel('Descrição (histórico)').fill('Compra de impressora (teste E2E)');
  await page.getByLabel('Conta da partida 1').fill('1.2.03.003 - Computadores e Periféricos');
  await page.getByLabel('Débito da partida 1').fill('1.250,00');
  await page.getByLabel('Conta da partida 2').fill('1.1.01.002 - Bancos Conta Movimento');
  await page.getByLabel('Crédito da partida 2').fill('1250');
  await page.getByRole('button', { name: 'Salvar lançamento' }).click();
  await page.getByText('Lançamento manual registrado e aprovado.').waitFor();
  check(await page.locator('article', { hasText: 'Compra de impressora (teste E2E)' }).isVisible(), 'Fluxo: lançamento manual com partidas');

  // Reprovar exige motivo
  const pend = page.locator('article', { hasText: 'Serviço de limpeza' });
  await pend.getByRole('button', { name: 'Reprovar' }).click();
  const botaoReprovar = page.getByRole('dialog').getByRole('button', { name: 'Reprovar' });
  check(await botaoReprovar.isDisabled(), 'Fluxo: reprovar sem motivo fica bloqueado');
  await page.getByRole('dialog').locator('textarea').fill('Valor não confere com a nota enviada.');
  await botaoReprovar.click();
  await page.getByText('Sugestão reprovada').waitFor();
  check(true, 'Fluxo: reprovar com motivo');

  // Upload de documento
  await irPara(page, 'Documentos', true);
  await page.locator('input[type=file]').setInputFiles({ name: 'nota_e2e.pdf', mimeType: 'application/pdf', buffer: Buffer.from(`%PDF-1.4 e2e ${Date.now()}`) });
  await page.getByRole('button', { name: 'Enviar para processamento' }).click();
  await page.getByText(/1 de 1 arquivo/).waitFor();
  check(await page.getByRole('cell', { name: /nota_e2e\.pdf/ }).first().isVisible(), 'Fluxo: upload aparece no histórico');

  // Relatório: gerar, visualizar e liberar
  await irPara(page, 'Relatórios', true);
  await page.getByLabel('Período inicial').fill('2026-10-01');
  await page.getByLabel('Período final').fill('2026-11-30');
  await page.getByRole('button', { name: 'Gerar relatório' }).click();
  await page.getByRole('dialog').getByText('Saldo final').waitFor();
  await page.screenshot({ path: `${OUT}fluxo_relatorio-balancete.png`, fullPage: true });
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: `${OUT}fluxo_relatorio-balancete.pdf`, format: 'A4' });
  await page.emulateMedia({ media: 'screen' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Enviar ao cliente' }).first().click();
  await page.getByText(/liberado para/).waitFor();
  check(true, 'Fluxo: gerar, visualizar (PDF) e liberar relatório');

  // Empresa com CNPJ inválido
  await irPara(page, 'Empresas', true);
  await page.getByRole('button', { name: 'Nova empresa' }).click();
  await page.getByLabel('Razão social *').fill('Teste CNPJ Ltda');
  await page.getByLabel('CNPJ *').fill('12345678000190');
  await page.getByLabel('E-mail *').fill('teste@teste.com.br');
  await page.getByRole('button', { name: 'Salvar cadastro' }).click();
  const erroCnpj = await page.getByText(/CNPJ inválido/).waitFor({ timeout: 5000 }).then(() => true, () => false);
  check(erroCnpj, 'Fluxo: CNPJ inválido é recusado pelo banco');

  // Nova conta no plano
  await irPara(page, 'Plano de Contas', true);
  await page.getByRole('button', { name: 'Nova conta' }).click();
  await page.getByLabel('Código').fill('3.1.01.007');
  await page.getByLabel('Nome', { exact: true }).fill('Seguros');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.getByText('Conta 3.1.01.007 criada.').waitFor();
  check(true, 'Fluxo: nova conta no plano');
  await ctx.close();

  // Cliente vê o relatório liberado
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR' });
  const p2 = await ctx2.newPage();
  await entrar(p2, 'CLIENTE');
  await irPara(p2, 'Relatórios', false);
  check(await p2.getByRole('button', { name: 'Visualizar / PDF' }).first().isVisible(), 'Fluxo: cliente vê relatório liberado');
  await ctx2.close();
}

await browser.close();
const relatorio = [`OK (${ok.length}):`, ...ok.map((m) => `  ✓ ${m}`), `FALHAS (${falhas.length}):`, ...falhas.map((m) => `  ✗ ${m}`)].join('\n');
writeFileSync(`${OUT}resultado.txt`, relatorio);
console.log(relatorio);
process.exit(falhas.length ? 1 : 0);
