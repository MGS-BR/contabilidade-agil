import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { exigirEmpresa, somenteContador } from '../auth.js';
import { badRequest, notFound } from '../errors.js';

const router = Router();

const SELECT_LANCAMENTO = `
  SELECT l.id, l.cliente_id AS "empresaId", COALESCE(c.nome_fantasia, c.razao_social) AS empresa,
         l.data_lancamento AS data, l.descricao, l.valor_total AS "valorTotal", l.origem, l.status,
         l.motivo_reprovacao AS "motivoReprovacao", l.criado_em AS "criadoEm", l.aprovado_em AS "aprovadoEm",
         ua.nome AS "aprovadoPor",
         EXISTS (SELECT 1 FROM exportacao_lancamento el WHERE el.lancamento_id = l.id) AS exportado,
         (SELECT json_agg(json_build_object('id', i.id, 'conta', cc.codigo, 'contaNome', cc.nome,
                   'tipo', i.tipo_movimento, 'valor', i.valor, 'historico', i.historico) ORDER BY i.id)
            FROM item_lancamento i JOIN conta_contabil cc ON cc.id = i.conta_contabil_id
           WHERE i.lancamento_id = l.id) AS itens,
         CASE WHEN d.id IS NULL THEN NULL ELSE json_build_object(
           'id', d.id, 'nome', d.nome_arquivo, 'tipo', d.tipo_documento, 'formato', d.formato,
           'status', d.status, 'dataUpload', d.data_upload,
           'confianca', a.nivel_confianca, 'faixa', fn_classificar_confianca(a.nivel_confianca),
           'motor', a.motor, 'dados', a.dados_extraidos) END AS documento,
         (SELECT json_agg(json_build_object('acao', r.acao, 'observacao', r.observacao,
                   'usuario', ur.nome, 'data', r.data_revisao) ORDER BY r.data_revisao)
            FROM revisao_contabil r JOIN usuario ur ON ur.id = r.usuario_id
           WHERE r.lancamento_id = l.id) AS revisoes
  FROM lancamento l
  JOIN cliente c ON c.id = l.cliente_id
  LEFT JOIN usuario ua ON ua.id = l.aprovado_por
  LEFT JOIN documento d ON d.id = l.documento_id
  LEFT JOIN analise_documento a ON a.documento_id = d.id`;

router.get('/lancamentos', somenteContador, async (req, res) => {
  const empresaId = exigirEmpresa(req, req.query.empresa);
  const { rows } = await query(
    `${SELECT_LANCAMENTO} WHERE l.cliente_id = $1
     ORDER BY CASE WHEN l.status IN ('PENDENTE','CORRIGIDO') THEN 0 ELSE 1 END, l.data_lancamento DESC, l.id DESC`,
    [empresaId],
  );
  res.json(rows);
});

async function lancamentoDoUsuario(req) {
  const { rows } = await query('SELECT id, cliente_id, status FROM lancamento WHERE id = $1', [req.params.id]);
  if (!rows[0]) throw notFound('Lançamento não encontrado.');
  exigirEmpresa(req, rows[0].cliente_id);
  return rows[0];
}

/** Valida as partidas vindas da tela e converte para o formato da procedure. */
function normalizarItens(itens) {
  if (!Array.isArray(itens) || itens.length < 2) throw badRequest('Informe ao menos duas partidas (débito e crédito).');
  return itens.map((it, i) => {
    const conta = String(it.conta || '').trim().split(' ')[0]; // aceita "1.1.01.001 - Caixa"
    const valor = Number(it.valor);
    if (!conta) throw badRequest(`Partida ${i + 1}: informe a conta contábil.`);
    if (!['D', 'C'].includes(it.tipo)) throw badRequest(`Partida ${i + 1}: escolha débito ou crédito.`);
    if (!(valor > 0)) throw badRequest(`Partida ${i + 1}: o valor precisa ser maior que zero.`);
    return { conta, tipo: it.tipo, valor: Math.round(valor * 100) / 100, historico: it.historico || null };
  });
}

// Novo lançamento manual (simples ou múltiplo) — sp_registrar_lancamento.
router.post('/lancamentos', somenteContador, async (req, res) => {
  const empresaId = exigirEmpresa(req, req.body?.empresaId);
  const descricao = String(req.body?.descricao || '').trim();
  const data = req.body?.data;
  if (!descricao) throw badRequest('Informe a descrição do lançamento.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data || '')) throw badRequest('Informe a data do lançamento.');
  const itens = normalizarItens(req.body?.itens);
  const r = await withTransaction(req.usuario.id, (db) =>
    db.query("CALL sp_registrar_lancamento($1, $2, $3, $4, $5, NULL, 'MANUAL', NULL, NULL)", [
      empresaId, req.usuario.id, data, descricao, JSON.stringify(itens),
    ]),
  );
  res.status(201).json({ id: r.rows[0].p_lancamento_id, status: r.rows[0].p_status });
});

// Correção de uma sugestão (RF22, RF25): troca as partidas, marca como
// CORRIGIDO e registra a revisão. Partidas dobradas são conferidas no
// COMMIT pelo constraint trigger deferido.
router.put('/lancamentos/:id', somenteContador, async (req, res) => {
  const l = await lancamentoDoUsuario(req);
  if (!['PENDENTE', 'CORRIGIDO'].includes(l.status)) throw badRequest(`Lançamento ${l.status.toLowerCase()} não pode ser editado.`);
  const descricao = String(req.body?.descricao || '').trim();
  const data = req.body?.data;
  if (!descricao) throw badRequest('Informe a descrição do lançamento.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data || '')) throw badRequest('Informe a data do lançamento.');
  const itens = normalizarItens(req.body?.itens);
  const observacao = String(req.body?.observacao || '').trim() || 'Partidas ajustadas pelo contador.';

  await withTransaction(req.usuario.id, async (db) => {
    const resp = await db.query('SELECT fn_usuario_responsavel($1, $2) AS ok', [req.usuario.id, l.cliente_id]);
    if (!resp.rows[0].ok) throw badRequest('Você não é o contador responsável por esta empresa.');
    await db.query("UPDATE lancamento SET data_lancamento = $2, descricao = $3, status = 'CORRIGIDO' WHERE id = $1", [l.id, data, descricao]);
    await db.query('DELETE FROM item_lancamento WHERE lancamento_id = $1', [l.id]);
    for (const it of itens) {
      const c = await db.query('SELECT id FROM conta_contabil WHERE cliente_id = $1 AND codigo = $2', [l.cliente_id, it.conta]);
      if (!c.rows[0]) throw badRequest(`A conta ${it.conta} não existe no plano desta empresa.`);
      await db.query(
        'INSERT INTO item_lancamento (lancamento_id, conta_contabil_id, tipo_movimento, valor, historico) VALUES ($1,$2,$3,$4,$5)',
        [l.id, c.rows[0].id, it.tipo, it.valor, it.historico],
      );
    }
    await db.query("INSERT INTO revisao_contabil (lancamento_id, usuario_id, acao, observacao) VALUES ($1, $2, 'CORRECAO', $3)", [l.id, req.usuario.id, observacao]);
  });
  res.json({ id: l.id, status: 'CORRIGIDO' });
});

router.delete('/lancamentos/:id', somenteContador, async (req, res) => {
  const l = await lancamentoDoUsuario(req);
  await withTransaction(req.usuario.id, (db) => db.query('DELETE FROM lancamento WHERE id = $1', [l.id]));
  res.status(204).end();
});

// Aprovação (RF23, RN01) — sp_aprovar_lancamento.
router.post('/lancamentos/:id/aprovar', somenteContador, async (req, res) => {
  const l = await lancamentoDoUsuario(req);
  const obs = String(req.body?.observacao || '').trim() || null;
  const r = await withTransaction(req.usuario.id, (db) =>
    db.query('CALL sp_aprovar_lancamento($1, $2, $3, NULL)', [l.id, req.usuario.id, obs]),
  );
  res.json({ id: l.id, status: 'APROVADO', documentoStatus: r.rows[0].p_documento_status });
});

// Reprovação de uma sugestão com justificativa (o documento continua
// guardado; para pedir reenvio, use "Rejeitar documento").
router.post('/lancamentos/:id/reprovar', somenteContador, async (req, res) => {
  const l = await lancamentoDoUsuario(req);
  const motivo = String(req.body?.motivo || '').trim();
  if (motivo.length < 10) throw badRequest('Informe o motivo da reprovação (mínimo 10 caracteres).');
  if (!['PENDENTE', 'CORRIGIDO'].includes(l.status)) throw badRequest(`Lançamento já está ${l.status.toLowerCase()}.`);
  await withTransaction(req.usuario.id, async (db) => {
    const resp = await db.query('SELECT fn_usuario_responsavel($1, $2) AS ok', [req.usuario.id, l.cliente_id]);
    if (!resp.rows[0].ok) throw badRequest('Você não é o contador responsável por esta empresa.');
    await db.query("INSERT INTO revisao_contabil (lancamento_id, usuario_id, acao, observacao) VALUES ($1, $2, 'REPROVACAO', $3)", [l.id, req.usuario.id, motivo]);
    await db.query("UPDATE lancamento SET status = 'REPROVADO', motivo_reprovacao = $2 WHERE id = $1", [l.id, motivo]);
  });
  res.json({ id: l.id, status: 'REPROVADO' });
});

// Exportação CSV (RF26/RF27) — sp_exportar_lancamentos marca os
// lançamentos; o CSV é montado a partir do lote gravado.
router.post('/empresas/:id/exportacoes', somenteContador, async (req, res) => {
  const empresaId = exigirEmpresa(req, req.params.id);
  const { inicio, fim } = req.body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio || '') || !/^\d{4}-\d{2}-\d{2}$/.test(fim || '')) throw badRequest('Informe o período.');
  const r = await withTransaction(req.usuario.id, (db) =>
    db.query('CALL sp_exportar_lancamentos($1, $2, $3, $4, NULL, NULL)', [empresaId, req.usuario.id, inicio, fim]),
  );
  res.status(201).json({ id: r.rows[0].p_exportacao_id, quantidade: r.rows[0].p_qtd });
});

router.get('/exportacoes/:id/csv', somenteContador, async (req, res) => {
  const { rows: ex } = await query('SELECT id, cliente_id, nome_arquivo FROM exportacao WHERE id = $1', [req.params.id]);
  if (!ex[0]) throw notFound('Exportação não encontrada.');
  exigirEmpresa(req, ex[0].cliente_id);
  const { rows } = await query(
    `SELECT l.id, to_char(l.data_lancamento, 'DD/MM/YYYY') AS data, l.descricao, cc.codigo, cc.nome,
            i.tipo_movimento, i.valor, COALESCE(i.historico, '') AS historico
     FROM exportacao_lancamento el
     JOIN lancamento l ON l.id = el.lancamento_id
     JOIN item_lancamento i ON i.lancamento_id = l.id
     JOIN conta_contabil cc ON cc.id = i.conta_contabil_id
     WHERE el.exportacao_id = $1
     ORDER BY l.data_lancamento, l.id, i.id`,
    [ex[0].id],
  );
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const linhas = [['data', 'lancamento', 'descricao', 'conta', 'nome_conta', 'debito', 'credito', 'historico'].join(';')];
  for (const r of rows) {
    const valor = r.valor.toFixed(2).replace('.', ',');
    linhas.push([r.data, r.id, esc(r.descricao), r.codigo, esc(r.nome),
      r.tipo_movimento === 'D' ? valor : '', r.tipo_movimento === 'C' ? valor : '', esc(r.historico)].join(';'));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${ex[0].nome_arquivo}"`);
  res.send('﻿' + linhas.join('\r\n')); // BOM: o Excel abre com acentos corretos
});

export default router;
