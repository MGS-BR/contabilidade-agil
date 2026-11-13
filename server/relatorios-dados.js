import { query } from './db.js';

/**
 * Monta o conteúdo de cada relatório a partir dos lançamentos APROVADOS
 * (RN01: só o que o contador aprovou entra em relatório).
 */

// Saldo anterior, movimento e saldo final de cada conta analítica.
async function balancete(clienteId, inicio, fim) {
  const { rows } = await query(
    `SELECT cc.codigo, cc.nome, cc.tipo, cc.natureza,
            COALESCE(SUM(CASE WHEN l.data_lancamento < $2 THEN
                (CASE WHEN i.tipo_movimento = cc.natureza THEN i.valor ELSE -i.valor END) END), 0) AS "saldoAnterior",
            COALESCE(SUM(i.valor) FILTER (WHERE i.tipo_movimento = 'D' AND l.data_lancamento BETWEEN $2 AND $3), 0) AS debito,
            COALESCE(SUM(i.valor) FILTER (WHERE i.tipo_movimento = 'C' AND l.data_lancamento BETWEEN $2 AND $3), 0) AS credito,
            COALESCE(SUM(CASE WHEN i.tipo_movimento = cc.natureza THEN i.valor ELSE -i.valor END), 0) AS "saldoFinal"
     FROM conta_contabil cc
     JOIN item_lancamento i ON i.conta_contabil_id = cc.id
     JOIN lancamento l ON l.id = i.lancamento_id AND l.status = 'APROVADO' AND l.data_lancamento <= $3
     WHERE cc.cliente_id = $1
     GROUP BY cc.id
     ORDER BY string_to_array(cc.codigo, '.')::int[]`,
    [clienteId, inicio, fim],
  );
  const totais = rows.reduce((t, r) => ({ debito: t.debito + r.debito, credito: t.credito + r.credito }), { debito: 0, credito: 0 });
  return { linhas: rows, totais };
}

// Receitas e despesas do período, por conta.
async function dre(clienteId, inicio, fim) {
  const { rows } = await query(
    `SELECT cc.codigo, cc.nome, cc.tipo,
            SUM(CASE WHEN i.tipo_movimento = cc.natureza THEN i.valor ELSE -i.valor END) AS valor
     FROM conta_contabil cc
     JOIN item_lancamento i ON i.conta_contabil_id = cc.id
     JOIN lancamento l ON l.id = i.lancamento_id AND l.status = 'APROVADO'
                      AND l.data_lancamento BETWEEN $2 AND $3
     WHERE cc.cliente_id = $1 AND cc.tipo IN ('RECEITA', 'DESPESA')
     GROUP BY cc.id
     ORDER BY string_to_array(cc.codigo, '.')::int[]`,
    [clienteId, inicio, fim],
  );
  const receitas = rows.filter((r) => r.tipo === 'RECEITA');
  const despesas = rows.filter((r) => r.tipo === 'DESPESA');
  const totalReceitas = receitas.reduce((s, r) => s + r.valor, 0);
  const totalDespesas = despesas.reduce((s, r) => s + r.valor, 0);
  return { receitas, despesas, totalReceitas, totalDespesas, resultado: totalReceitas - totalDespesas };
}

// Saldos acumulados até a data final. O resultado (receitas − despesas)
// ainda não encerrado entra no patrimônio líquido.
async function balanco(clienteId, _inicio, fim) {
  const { rows } = await query(
    `SELECT cc.codigo, cc.nome, cc.tipo,
            SUM(CASE WHEN i.tipo_movimento = cc.natureza THEN i.valor ELSE -i.valor END) AS saldo
     FROM conta_contabil cc
     JOIN item_lancamento i ON i.conta_contabil_id = cc.id
     JOIN lancamento l ON l.id = i.lancamento_id AND l.status = 'APROVADO' AND l.data_lancamento <= $2
     WHERE cc.cliente_id = $1
     GROUP BY cc.id
     HAVING SUM(CASE WHEN i.tipo_movimento = cc.natureza THEN i.valor ELSE -i.valor END) <> 0
     ORDER BY string_to_array(cc.codigo, '.')::int[]`,
    [clienteId, fim],
  );
  const soma = (tipo) => rows.filter((r) => r.tipo === tipo).reduce((s, r) => s + r.saldo, 0);
  const resultado = soma('RECEITA') - soma('DESPESA');
  const ativo = rows.filter((r) => r.tipo === 'ATIVO');
  const passivo = rows.filter((r) => r.tipo === 'PASSIVO');
  const patrimonio = [...rows.filter((r) => r.tipo === 'PATRIMONIO'),
    ...(resultado !== 0 ? [{ codigo: '—', nome: 'Resultado do exercício (não encerrado)', tipo: 'PATRIMONIO', saldo: resultado }] : [])];
  const totalAtivo = soma('ATIVO');
  const totalPassivo = soma('PASSIVO');
  const totalPatrimonio = soma('PATRIMONIO') + resultado;
  return {
    ativo, passivo, patrimonio, totalAtivo, totalPassivo, totalPatrimonio,
    fechado: Math.abs(totalAtivo - (totalPassivo + totalPatrimonio)) < 0.005,
  };
}

// Razão: uma seção por conta com movimento, usando fn_razao_conta.
async function razao(clienteId, inicio, fim) {
  const { rows: contas } = await query(
    `SELECT DISTINCT cc.id, cc.codigo, cc.nome
     FROM conta_contabil cc
     JOIN item_lancamento i ON i.conta_contabil_id = cc.id
     JOIN lancamento l ON l.id = i.lancamento_id AND l.status = 'APROVADO' AND l.data_lancamento BETWEEN $2 AND $3
     WHERE cc.cliente_id = $1
     ORDER BY cc.codigo`,
    [clienteId, inicio, fim],
  );
  const secoes = [];
  for (const c of contas) {
    const { rows } = await query(
      `SELECT data_lancamento AS data, lancamento_id AS "lancamentoId", historico, debito, credito, saldo
       FROM fn_razao_conta($1, $2, $3)`,
      [c.id, inicio, fim],
    );
    secoes.push({ codigo: c.codigo, nome: c.nome, movimentos: rows });
  }
  return { contas: secoes };
}

// Diário: lançamentos em ordem cronológica com as partidas.
async function diario(clienteId, inicio, fim) {
  const { rows } = await query(
    `SELECT l.id, l.data_lancamento AS data, l.descricao, l.valor_total AS valor,
            json_agg(json_build_object('conta', cc.codigo, 'nome', cc.nome, 'tipo', i.tipo_movimento, 'valor', i.valor)
                     ORDER BY i.tipo_movimento DESC, i.id) AS partidas
     FROM lancamento l
     JOIN item_lancamento i ON i.lancamento_id = l.id
     JOIN conta_contabil cc ON cc.id = i.conta_contabil_id
     WHERE l.cliente_id = $1 AND l.status = 'APROVADO' AND l.data_lancamento BETWEEN $2 AND $3
     GROUP BY l.id
     ORDER BY l.data_lancamento, l.id`,
    [clienteId, inicio, fim],
  );
  return { lancamentos: rows, total: rows.reduce((s, r) => s + r.valor, 0) };
}

const GERADORES = { BALANCETE: balancete, DRE: dre, BALANCO: balanco, RAZAO: razao, DIARIO: diario };

export function gerarConteudo(tipo, clienteId, inicio, fim) {
  return GERADORES[tipo](clienteId, inicio, fim);
}
