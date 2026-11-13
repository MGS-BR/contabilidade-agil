/**
 * Testes de integração da API contra um PostgreSQL real.
 *
 *   DATABASE_URL=postgres://usuario:senha@localhost:5432/banco_de_teste npm test
 *
 * ATENÇÃO: o banco indicado é APAGADO e recriado (npm run db:reset).
 */
import '../server/env.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { setupDatabase } from '../server/setup-db.js';
import { pool } from '../server/db.js';

let server;
let base;

before(async () => {
  await setupDatabase({ reset: true, log: () => {} });
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  server?.close();
  await pool.end();
});

async function api(method, path, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(base + path, { method, headers, body: payload });
  const tipo = res.headers.get('content-type') || '';
  const data = tipo.includes('json') ? await res.json() : await res.text();
  return { status: res.status, data, headers: res.headers };
}

async function login(email, perfil) {
  const r = await api('POST', '/auth/login', { body: { email, senha: 'senha123', perfil } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.data.token;
}

const CARLOS = 'carlos.silva@agilcontabil.com.br'; // contador das empresas 1–5
const MARIANA = 'mariana.costa@agilcontabil.com.br'; // contador das empresas 6–10
const JOAO = 'joao@abccomercio.com.br'; // cliente da ABC (1) e do Comércio Silva (4)

test('health check conecta no banco', async () => {
  const r = await api('GET', '/health');
  assert.equal(r.status, 200);
  assert.equal(r.data.ok, true);
});

test('login: senha errada, aba errada, conta de serviço e admin são barrados', async () => {
  assert.equal((await api('POST', '/auth/login', { body: { email: CARLOS, senha: 'errada' } })).status, 401);
  const aba = await api('POST', '/auth/login', { body: { email: CARLOS, senha: 'senha123', perfil: 'CLIENTE' } });
  assert.equal(aba.status, 403);
  assert.match(aba.data.erro, /Contador/);
  assert.equal((await api('POST', '/auth/login', { body: { email: 'ia@agilcontabil.com.br', senha: 'senha123' } })).status, 401);
  assert.equal((await api('POST', '/auth/login', { body: { email: 'fernanda.rocha@agilcontabil.com.br', senha: 'senha123' } })).status, 403);
  assert.equal((await api('GET', '/empresas')).status, 401);
});

test('login do contador traz a carteira; do cliente, só as próprias empresas', async () => {
  const r = await api('POST', '/auth/login', { body: { email: CARLOS, senha: 'senha123', perfil: 'CONTADOR' } });
  assert.equal(r.data.usuario.tipo, 'CONTADOR');
  assert.deepEqual(r.data.usuario.empresas.map((e) => e.id).sort((a, b) => a - b), [1, 2, 3, 4, 5]);
  const c = await api('POST', '/auth/login', { body: { email: JOAO, senha: 'senha123', perfil: 'CLIENTE' } });
  assert.deepEqual(c.data.usuario.empresas.map((e) => e.id).sort(), [1, 4]);
});

test('controle de acesso por empresa', async () => {
  const carlos = await login(CARLOS);
  const joao = await login(JOAO);
  assert.equal((await api('GET', '/documentos?empresa=6', { token: carlos })).status, 403);
  assert.equal((await api('GET', '/documentos?empresa=1', { token: joao })).status, 200);
  assert.equal((await api('GET', '/documentos?empresa=2', { token: joao })).status, 403);
  assert.equal((await api('GET', '/lancamentos?empresa=1', { token: joao })).status, 403); // cliente não acessa lançamentos
});

test('dashboard do contador usa números reais', async () => {
  const r = await api('GET', '/dashboard/contador', { token: await login(CARLOS) });
  assert.equal(r.status, 200);
  assert.ok(r.data.lancamentosPendentes >= 3);
  assert.equal(r.data.documentosRecentes.length, 5);
  assert.ok(r.data.painel.every((p) => [1, 2, 3, 4, 5].includes(p.empresaId)));
});

test('empresas: CNPJ inválido é recusado; cadastro válido cria plano de contas e acesso do cliente', async () => {
  const carlos = await login(CARLOS);
  const empresa = {
    razaoSocial: 'Papelaria Teste Ltda', nomeFantasia: 'Papelaria Teste', regimeTributario: 'SIMPLES_NACIONAL',
    email: 'contato@papelariateste.com.br', uf: 'SP', cidade: 'Sorocaba', cep: '18035-000',
    acessoEmail: 'dono@papelariateste.com.br', acessoSenha: 'senha123', acessoNome: 'Dono da Papelaria',
  };
  const ruim = await api('POST', '/empresas', { token: carlos, body: { ...empresa, cnpj: '12.345.678/0001-90' } });
  assert.equal(ruim.status, 400);
  assert.match(ruim.data.erro, /CNPJ inválido/);

  const ok = await api('POST', '/empresas', { token: carlos, body: { ...empresa, cnpj: '68.135.792/0001-45' } });
  assert.equal(ok.status, 201, JSON.stringify(ok.data));
  const contas = await api('GET', `/empresas/${ok.data.id}/contas`, { token: carlos });
  assert.equal(contas.data.length, 51);
  assert.ok(contas.data.find((c) => c.codigo === '1.1.01.001').contaPaiId);

  const dup = await api('POST', '/empresas', { token: carlos, body: { ...empresa, acessoEmail: '', cnpj: '68135792000145' } });
  assert.equal(dup.status, 409);

  const cliente = await login('dono@papelariateste.com.br', 'CLIENTE');
  assert.ok(cliente);
});

test('plano de contas: criar, regras de hierarquia e exclusão protegida', async () => {
  const carlos = await login(CARLOS);
  const nova = await api('POST', '/empresas/1/contas', { token: carlos, body: { codigo: '3.1.01.007', nome: 'Seguros' } });
  assert.equal(nova.status, 201, JSON.stringify(nova.data));
  const sobAnalitica = await api('POST', '/empresas/1/contas', { token: carlos, body: { codigo: '1.1.01.001.01', nome: 'X' } });
  assert.equal(sobAnalitica.status, 400);
  const semPai = await api('POST', '/empresas/1/contas', { token: carlos, body: { codigo: '9.9.9', nome: 'X' } });
  assert.equal(semPai.status, 400);

  const contas = (await api('GET', '/empresas/1/contas', { token: carlos })).data;
  const bancos = contas.find((c) => c.codigo === '1.1.01.002');
  assert.equal(bancos.temMovimento, true);
  const del = await api('DELETE', `/contas/${bancos.id}`, { token: carlos });
  assert.equal(del.status, 409);
  assert.match(del.data.erro, /lançamentos/);
  assert.equal((await api('DELETE', `/contas/${nova.data.id}`, { token: carlos })).status, 204);
});

test('lançamentos: manual balanceado nasce aprovado; desbalanceado é barrado', async () => {
  const carlos = await login(CARLOS);
  const ruim = await api('POST', '/lancamentos', { token: carlos, body: {
    empresaId: 1, data: '2026-11-12', descricao: 'Teste',
    itens: [{ conta: '1.1.01.001', tipo: 'D', valor: 100 }, { conta: '4.1.01.001', tipo: 'C', valor: 90 }] } });
  assert.equal(ruim.status, 400);
  assert.match(ruim.data.erro, /Débitos/);

  const ok = await api('POST', '/lancamentos', { token: carlos, body: {
    empresaId: 1, data: '2026-11-12', descricao: 'Compra de cadeira',
    itens: [{ conta: '1.2.03.001 - Móveis e Utensílios', tipo: 'D', valor: 899.9 }, { conta: '1.1.01.002', tipo: 'C', valor: 899.9 }] } });
  assert.equal(ok.status, 201, JSON.stringify(ok.data));
  assert.equal(ok.data.status, 'APROVADO');
});

test('lançamentos: aprovar, corrigir, reprovar e imutabilidade', async () => {
  const carlos = await login(CARLOS);
  const mariana = await login(MARIANA);

  assert.equal((await api('POST', '/lancamentos/1/aprovar', { token: mariana })).status, 403);
  const ap = await api('POST', '/lancamentos/1/aprovar', { token: carlos, body: { observacao: 'Conferido' } });
  assert.equal(ap.status, 200, JSON.stringify(ap.data));
  assert.equal(ap.data.documentoStatus, 'APROVADO');

  const editarAprovado = await api('PUT', '/lancamentos/1', { token: carlos, body: {
    data: '2026-11-09', descricao: 'x', itens: [{ conta: '1.1.01.001', tipo: 'D', valor: 1 }, { conta: '1.1.01.002', tipo: 'C', valor: 1 }] } });
  assert.equal(editarAprovado.status, 400);
  assert.equal((await api('DELETE', '/lancamentos/1', { token: carlos })).status, 400);

  // Corrige a sugestão 18 (ABC): valor muda, status vira CORRIGIDO
  const corr = await api('PUT', '/lancamentos/18', { token: carlos, body: {
    data: '2026-11-11', descricao: 'Serviço de limpeza - NF 980 (corrigido)', observacao: 'Desconto de R$ 50 não lido pela IA.',
    itens: [{ conta: '3.1.01.006', tipo: 'D', valor: 1400 }, { conta: '2.1.02.001', tipo: 'C', valor: 1400 }] } });
  assert.equal(corr.status, 200, JSON.stringify(corr.data));
  const lista = (await api('GET', '/lancamentos?empresa=1', { token: carlos })).data;
  const l18 = lista.find((l) => l.id === 18);
  assert.equal(l18.status, 'CORRIGIDO');
  assert.equal(l18.valorTotal, 1400);
  assert.equal(l18.revisoes.at(-1).acao, 'CORRECAO');

  // Correção desbalanceada: o constraint trigger desfaz tudo no COMMIT
  const desb = await api('PUT', '/lancamentos/18', { token: carlos, body: {
    data: '2026-11-11', descricao: 'x', itens: [{ conta: '3.1.01.006', tipo: 'D', valor: 10 }, { conta: '2.1.02.001', tipo: 'C', valor: 9 }] } });
  assert.equal(desb.status, 400);
  assert.match(desb.data.erro, /Partidas dobradas/);
  const depois = (await api('GET', '/lancamentos?empresa=1', { token: carlos })).data.find((l) => l.id === 18);
  assert.equal(depois.valorTotal, 1400);

  assert.equal((await api('POST', '/lancamentos/19/reprovar', { token: carlos, body: { motivo: 'curto' } })).status, 400);
  const rep = await api('POST', '/lancamentos/19/reprovar', { token: carlos, body: { motivo: 'Valor diverge do comprovante enviado.' } });
  assert.equal(rep.status, 200);

  // A auditoria registrou quem aprovou
  const { rows } = await pool.query(
    "SELECT usuario_app_id FROM contabil.log_auditoria WHERE tabela = 'lancamento' AND registro_id = 1 AND operacao = 'U' ORDER BY id DESC LIMIT 1");
  assert.equal(rows[0].usuario_app_id, 3);
});

test('documentos: upload, duplicidade, XML com chave, formato errado e download', async () => {
  const joao = await login(JOAO, 'CLIENTE');
  const pdf = Buffer.from('%PDF-1.4 nota fiscal de teste ' + Date.now());
  const form = new FormData();
  form.append('tipo', 'NOTA_FISCAL');
  form.append('arquivos', new Blob([pdf], { type: 'application/pdf' }), 'nota_teste.pdf');
  form.append('arquivos', new Blob(['texto'], { type: 'text/plain' }), 'errado.txt');
  const up = await api('POST', '/empresas/1/documentos', { token: joao, form });
  assert.equal(up.status, 201, JSON.stringify(up.data));
  assert.equal(up.data[0].ok, true);
  assert.equal(up.data[0].status, 'PENDENTE');
  assert.equal(up.data[1].ok, false);

  const form2 = new FormData();
  form2.append('tipo', 'NOTA_FISCAL');
  form2.append('arquivos', new Blob([pdf]), 'copia.pdf');
  const dup = await api('POST', '/empresas/1/documentos', { token: joao, form: form2 });
  assert.match(dup.data[0].erro, /já foi enviado/);

  const chave = '35261112345678000195550010000099991000000017';
  const xml = `<?xml version="1.0"?><nfeProc><NFe><infNFe Id="NFe${chave}"></infNFe></NFe></nfeProc>`;
  const form3 = new FormData();
  form3.append('tipo', 'XML_NFE');
  form3.append('arquivos', new Blob([xml]), 'nfe_9999.xml');
  const x = await api('POST', '/empresas/1/documentos', { token: joao, form: form3 });
  assert.equal(x.data[0].status, 'IMPORTADO');
  assert.equal(x.data[0].chaveNFe, chave);

  const down = await fetch(`${base}/documentos/${up.data[0].id}/arquivo`, { headers: { Authorization: `Bearer ${joao}` } });
  assert.equal(down.status, 200);
  assert.equal(Buffer.from(await down.arrayBuffer()).toString(), pdf.toString());

  const semArquivo = await api('GET', '/documentos/1/arquivo', { token: joao });
  assert.equal(semArquivo.status, 404);

  const outra = new FormData();
  outra.append('tipo', 'NOTA_FISCAL');
  outra.append('arquivos', new Blob(['x']), 'a.pdf');
  assert.equal((await api('POST', '/empresas/2/documentos', { token: joao, form: outra })).status, 403);
});

test('documentos: rejeição exige justificativa e reprova as sugestões', async () => {
  const mariana = await login(MARIANA);
  assert.equal((await api('POST', '/documentos/20/rejeitar', { token: mariana, body: { motivo: 'ruim' } })).status, 400);
  const r = await api('POST', '/documentos/20/rejeitar', { token: mariana, body: { motivo: 'Boleto sem autenticação; envie o comprovante.' } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.lancamentosReprovados, 1);
});

test('relatórios: gerar, conteúdo fecha, cliente só vê depois de liberado', async () => {
  const carlos = await login(CARLOS);
  const joao = await login(JOAO, 'CLIENTE');
  const bal = await api('POST', '/relatorios', { token: carlos, body: { empresaId: 1, tipo: 'BALANCETE', inicio: '2026-10-01', fim: '2026-11-30' } });
  assert.equal(bal.status, 201);
  const conteudo = (await api('GET', `/relatorios/${bal.data.id}`, { token: carlos })).data.conteudo;
  assert.ok(conteudo.linhas.length > 0);
  assert.equal(Math.round(conteudo.totais.debito * 100), Math.round(conteudo.totais.credito * 100));

  const balanco = await api('POST', '/relatorios', { token: carlos, body: { empresaId: 1, tipo: 'BALANCO', inicio: '2026-01-01', fim: '2026-11-30' } });
  assert.equal((await api('GET', `/relatorios/${balanco.data.id}`, { token: carlos })).data.conteudo.fechado, true);

  for (const tipo of ['DRE', 'RAZAO', 'DIARIO']) {
    const r = await api('POST', '/relatorios', { token: carlos, body: { empresaId: 1, tipo, inicio: '2026-10-01', fim: '2026-11-30' } });
    assert.equal((await api('GET', `/relatorios/${r.data.id}`, { token: carlos })).status, 200, tipo);
  }

  assert.equal((await api('GET', `/relatorios/${bal.data.id}`, { token: joao })).status, 404);
  assert.equal((await api('POST', `/relatorios/${bal.data.id}/enviar`, { token: carlos })).status, 200);
  assert.equal((await api('GET', `/relatorios/${bal.data.id}`, { token: joao })).status, 200);
  const visiveis = (await api('GET', '/relatorios', { token: joao })).data;
  assert.ok(visiveis.every((r) => r.enviadoCliente));
});

test('exportação CSV não repete lançamentos (RF27)', async () => {
  const carlos = await login(CARLOS);
  const ex = await api('POST', '/empresas/2/exportacoes', { token: carlos, body: { inicio: '2026-11-01', fim: '2026-11-30' } });
  assert.equal(ex.status, 201, JSON.stringify(ex.data));
  assert.ok(ex.data.quantidade >= 1);
  const resp = await fetch(`${base}/exportacoes/${ex.data.id}/csv`, { headers: { Authorization: `Bearer ${carlos}` } });
  const bytes = Buffer.from(await resp.arrayBuffer());
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]); // BOM UTF-8 (Excel)
  assert.ok(bytes.subarray(3).toString('utf8').startsWith('data;lancamento'));
  const de_novo = await api('POST', '/empresas/2/exportacoes', { token: carlos, body: { inicio: '2026-11-01', fim: '2026-11-30' } });
  assert.equal(de_novo.status, 404);
});

test('dashboard do cliente calcula indicadores do período', async () => {
  const joao = await login(JOAO, 'CLIENTE');
  const r = await api('GET', '/dashboard/cliente?empresa=1&inicio=2026-01-01&fim=2026-11-30', { token: joao });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.meses.length, 11);
  assert.ok(r.data.totais.receita > 0);
  assert.ok(r.data.indicadores.caixaFinal > 0);
  assert.equal((await api('GET', '/dashboard/cliente?empresa=1&inicio=2026-12-01&fim=2026-01-01', { token: joao })).status, 400);
});
