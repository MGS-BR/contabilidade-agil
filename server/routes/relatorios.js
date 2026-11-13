import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { exigirEmpresa, idsEmpresas, somenteContador } from '../auth.js';
import { badRequest, notFound } from '../errors.js';
import { gerarConteudo } from '../relatorios-dados.js';

const router = Router();

const TIPOS = ['BALANCO', 'BALANCETE', 'DRE', 'RAZAO', 'DIARIO'];
const dataValida = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');

const SELECT_RELATORIO = `
  SELECT r.id, r.cliente_id AS "empresaId", COALESCE(c.nome_fantasia, c.razao_social) AS empresa,
         c.razao_social AS "razaoSocial", c.cnpj,
         r.tipo, r.periodo_inicio AS "periodoInicio", r.periodo_fim AS "periodoFim",
         r.data_geracao AS "dataGeracao", u.nome AS "geradoPor",
         r.enviado_cliente AS "enviadoCliente", r.enviado_em AS "enviadoEm"
  FROM relatorio r
  JOIN cliente c ON c.id = r.cliente_id
  JOIN usuario u ON u.id = r.gerado_por`;

// Contador vê todos os relatórios da carteira; cliente só os liberados (enviados).
router.get('/relatorios', async (req, res) => {
  const params = [idsEmpresas(req)];
  let filtro = 'r.cliente_id = ANY($1)';
  if (req.query.empresa && req.query.empresa !== 'all') {
    params[0] = [exigirEmpresa(req, req.query.empresa)];
  }
  if (req.usuario.perfil === 'CLIENTE') filtro += ' AND r.enviado_cliente';
  const { rows } = await query(`${SELECT_RELATORIO} WHERE ${filtro} ORDER BY r.data_geracao DESC, r.id DESC`, params);
  res.json(rows);
});

router.post('/relatorios', somenteContador, async (req, res) => {
  const empresaId = exigirEmpresa(req, req.body?.empresaId);
  const { tipo, inicio, fim } = req.body || {};
  if (!TIPOS.includes(tipo)) throw badRequest('Tipo de relatório inválido.');
  if (!dataValida(inicio) || !dataValida(fim)) throw badRequest('Informe o período.');
  const { rows } = await withTransaction(req.usuario.id, (db) =>
    db.query(
      'INSERT INTO relatorio (cliente_id, gerado_por, tipo, periodo_inicio, periodo_fim) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [empresaId, req.usuario.id, tipo, inicio, fim],
    ),
  );
  const r = await query(`${SELECT_RELATORIO} WHERE r.id = $1`, [rows[0].id]);
  res.status(201).json(r.rows[0]);
});

async function relatorioDoUsuario(req) {
  const { rows } = await query(`${SELECT_RELATORIO} WHERE r.id = $1`, [req.params.id]);
  const r = rows[0];
  if (!r) throw notFound('Relatório não encontrado.');
  exigirEmpresa(req, r.empresaId);
  if (req.usuario.perfil === 'CLIENTE' && !r.enviadoCliente) throw notFound('Relatório não encontrado.');
  return r;
}

router.post('/relatorios/:id/enviar', somenteContador, async (req, res) => {
  const r = await relatorioDoUsuario(req);
  await withTransaction(req.usuario.id, (db) =>
    db.query('UPDATE relatorio SET enviado_cliente = TRUE, enviado_em = now() WHERE id = $1 AND NOT enviado_cliente', [r.id]),
  );
  res.json({ id: r.id, enviadoCliente: true });
});

// Metadados + conteúdo calculado na hora a partir dos lançamentos aprovados.
router.get('/relatorios/:id', async (req, res) => {
  const r = await relatorioDoUsuario(req);
  const conteudo = await gerarConteudo(r.tipo, r.empresaId, r.periodoInicio, r.periodoFim);
  res.json({ ...r, conteudo });
});

export default router;
