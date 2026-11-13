import { Router } from 'express';
import { query } from '../db.js';
import { exigirEmpresa, idsEmpresas, somenteContador } from '../auth.js';
import { badRequest } from '../errors.js';

const router = Router();

// Painel do contador: números reais da carteira + pendências por empresa
// (vw_painel_pendencias, RF30).
router.get('/dashboard/contador', somenteContador, async (req, res) => {
  const ids = idsEmpresas(req);
  const [cards, docs, lancs, painel] = await Promise.all([
    query(
      `SELECT
         (SELECT count(*) FROM documento WHERE cliente_id = ANY($1)
            AND status IN ('PENDENTE','PROCESSANDO','ANALISADO','IMPORTADO'))::int AS "documentosPendentes",
         (SELECT count(*) FROM lancamento WHERE cliente_id = ANY($1)
            AND status IN ('PENDENTE','CORRIGIDO'))::int AS "lancamentosPendentes",
         (SELECT count(*) FROM lancamento WHERE cliente_id = ANY($1) AND status = 'APROVADO'
            AND aprovado_em >= date_trunc('month', now()))::int AS "aprovadosNoMes",
         (SELECT count(*) FROM analise_documento a JOIN documento d ON d.id = a.documento_id
           WHERE d.cliente_id = ANY($1) AND a.motor = 'OCR_IA')::int AS "analisesIA",
         (SELECT count(*) FROM documento WHERE cliente_id = ANY($1) AND tipo_processamento = 'IA'
            AND status IN ('PENDENTE','PROCESSANDO'))::int AS "aguardandoIA"`,
      [ids],
    ),
    query(
      `SELECT d.id, d.nome_arquivo AS nome, d.status, d.data_upload AS data, d.cliente_id AS "empresaId",
              COALESCE(c.nome_fantasia, c.razao_social) AS empresa
       FROM documento d JOIN cliente c ON c.id = d.cliente_id
       WHERE d.cliente_id = ANY($1) ORDER BY d.data_upload DESC LIMIT 5`,
      [ids],
    ),
    query(
      `SELECT l.id, l.descricao, l.data_lancamento AS data, l.valor_total AS valor, l.status, l.origem,
              l.cliente_id AS "empresaId", COALESCE(c.nome_fantasia, c.razao_social) AS empresa
       FROM lancamento l JOIN cliente c ON c.id = l.cliente_id
       WHERE l.cliente_id = ANY($1) ORDER BY l.criado_em DESC LIMIT 5`,
      [ids],
    ),
    query(
      `SELECT cliente_id AS "empresaId", razao_social AS empresa, documentos_em_processamento AS "emProcessamento",
              documentos_com_falha AS falhas, lancamentos_pendentes AS pendentes,
              tempo_medio_revisao_h AS "tempoMedioH", taxa_acerto_ia_pct AS "acertoIA"
       FROM vw_painel_pendencias
       WHERE cliente_id = ANY($1) AND status = 'ATIVO'
       ORDER BY lancamentos_pendentes DESC, documentos_em_processamento DESC, razao_social`,
      [ids],
    ),
  ]);
  res.json({ ...cards.rows[0], documentosRecentes: docs.rows, lancamentosRecentes: lancs.rows, painel: painel.rows });
});

const dataValida = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');

// Saldo de cada conta analítica até uma data (só aprovados), por tipo/código.
const SALDOS_ATE = `
  SELECT cc.codigo, cc.tipo,
         SUM(CASE WHEN i.tipo_movimento = cc.natureza THEN i.valor ELSE -i.valor END) AS saldo
  FROM conta_contabil cc
  JOIN item_lancamento i ON i.conta_contabil_id = cc.id
  JOIN lancamento l ON l.id = i.lancamento_id AND l.status = 'APROVADO' AND l.data_lancamento <= $2
  WHERE cc.cliente_id = $1
  GROUP BY cc.id`;

async function posicao(empresaId, data) {
  const { rows } = await query(
    `SELECT COALESCE(SUM(saldo) FILTER (WHERE tipo = 'ATIVO'), 0) AS ativo,
            COALESCE(SUM(saldo) FILTER (WHERE tipo = 'PASSIVO'), 0) AS passivo,
            COALESCE(SUM(saldo) FILTER (WHERE codigo LIKE '1.1.01.%'), 0) AS disponivel,
            COALESCE(SUM(saldo) FILTER (WHERE codigo LIKE '2.1.%'), 0) AS "passivoCirculante"
     FROM (${SALDOS_ATE}) s`,
    [empresaId, data],
  );
  return rows[0];
}

// Painel do cliente: indicadores calculados dos lançamentos aprovados.
router.get('/dashboard/cliente', async (req, res) => {
  const empresaId = exigirEmpresa(req, req.query.empresa);
  const { inicio, fim } = req.query;
  if (!dataValida(inicio) || !dataValida(fim) || inicio > fim) throw badRequest('Período inválido.');

  const serie = await query(
    `WITH meses AS (
       SELECT generate_series(date_trunc('month', $2::date), date_trunc('month', $3::date), interval '1 month')::date AS mes)
     SELECT to_char(m.mes, 'YYYY-MM') AS mes,
            COALESCE(SUM(CASE WHEN cc.tipo = 'RECEITA' THEN
                CASE WHEN i.tipo_movimento = cc.natureza THEN i.valor ELSE -i.valor END END), 0) AS receita,
            COALESCE(SUM(CASE WHEN cc.tipo = 'DESPESA' THEN
                CASE WHEN i.tipo_movimento = cc.natureza THEN i.valor ELSE -i.valor END END), 0) AS despesa
     FROM meses m
     LEFT JOIN lancamento l ON l.cliente_id = $1 AND l.status = 'APROVADO'
                           AND l.data_lancamento BETWEEN $2 AND $3
                           AND date_trunc('month', l.data_lancamento) = m.mes
     LEFT JOIN item_lancamento i ON i.lancamento_id = l.id
     LEFT JOIN conta_contabil cc ON cc.id = i.conta_contabil_id
     GROUP BY m.mes ORDER BY m.mes`,
    [empresaId, inicio, fim],
  );
  const meses = serie.rows.map((r) => ({ ...r, lucro: r.receita - r.despesa }));
  const receita = meses.reduce((s, m) => s + m.receita, 0);
  const despesa = meses.reduce((s, m) => s + m.despesa, 0);
  const lucro = receita - despesa;

  const diaAnterior = new Date(`${inicio}T12:00:00Z`);
  diaAnterior.setUTCDate(diaAnterior.getUTCDate() - 1);
  const [posFim, posIni] = await Promise.all([
    posicao(empresaId, fim),
    posicao(empresaId, diaAnterior.toISOString().slice(0, 10)),
  ]);

  const despesas = await query(
    `SELECT grupo.codigo, grupo.nome,
            SUM(CASE WHEN i.tipo_movimento = cc.natureza THEN i.valor ELSE -i.valor END) AS valor
     FROM conta_contabil cc
     JOIN item_lancamento i ON i.conta_contabil_id = cc.id
     JOIN lancamento l ON l.id = i.lancamento_id AND l.status = 'APROVADO' AND l.data_lancamento BETWEEN $2 AND $3
     JOIN conta_contabil grupo ON grupo.cliente_id = cc.cliente_id
                              AND grupo.codigo = array_to_string((string_to_array(cc.codigo, '.'))[1:3], '.')
     WHERE cc.cliente_id = $1 AND cc.tipo = 'DESPESA'
     GROUP BY grupo.codigo, grupo.nome
     ORDER BY valor DESC`,
    [empresaId, inicio, fim],
  );

  const documentos = await query(
    `SELECT d.id, d.nome_arquivo AS "nomeArquivo", d.tipo_documento AS tipo, d.status, d.data_upload AS "dataEnvio",
            (SELECT max(l.aprovado_em) FROM lancamento l WHERE l.documento_id = d.id AND l.status = 'APROVADO') AS "dataLancamento"
     FROM documento d WHERE d.cliente_id = $1 ORDER BY d.data_upload DESC LIMIT 20`,
    [empresaId],
  );

  // Índice só faz sentido com denominador positivo (ex.: sem obrigações a
  // pagar não existe "liquidez"); nesses casos a tela mostra "—".
  const div = (a, b) => (b > 0 ? a / b : null);
  res.json({
    meses,
    totais: { receita, despesa, lucro },
    indicadores: {
      margem: div(lucro, receita),
      liquidezImediata: div(posFim.disponivel, posFim.passivoCirculante),
      // Passivo devedor (ex.: adiantamento a fornecedor) não é dívida: conta como zero.
      endividamento: div(Math.max(posFim.passivo, 0), posFim.ativo),
      roa: div(lucro, posFim.ativo),
      variacaoCaixa: posFim.disponivel - posIni.disponivel,
      caixaFinal: posFim.disponivel,
    },
    despesas: despesas.rows,
    documentos: documentos.rows,
  });
});

export default router;
