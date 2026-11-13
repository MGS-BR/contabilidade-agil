import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { exigirEmpresa, somenteContador } from '../auth.js';
import { badRequest, notFound } from '../errors.js';

const router = Router();

const TIPOS = ['ATIVO', 'PASSIVO', 'PATRIMONIO', 'RECEITA', 'DESPESA'];

// Plano de contas da empresa (lista plana ordenada; a árvore é montada no front).
// O saldo usa fn_saldo_conta, que soma as subcontas por CTE recursiva.
router.get('/empresas/:id/contas', async (req, res) => {
  const id = exigirEmpresa(req, req.params.id);
  const { rows } = await query(
    `SELECT cc.id, cc.codigo, cc.nome, cc.tipo, cc.natureza, cc.analitica, cc.ativa,
            cc.conta_pai_id AS "contaPaiId",
            fn_saldo_conta(cc.id) AS saldo,
            EXISTS (SELECT 1 FROM item_lancamento i WHERE i.conta_contabil_id = cc.id) AS "temMovimento",
            EXISTS (SELECT 1 FROM conta_contabil f WHERE f.conta_pai_id = cc.id) AS "temSubcontas"
     FROM conta_contabil cc
     WHERE cc.cliente_id = $1
     ORDER BY string_to_array(cc.codigo, '.')::int[]`,
    [id],
  );
  res.json(rows);
});

router.post('/empresas/:id/contas', somenteContador, async (req, res) => {
  const clienteId = exigirEmpresa(req, req.params.id);
  const codigo = String(req.body?.codigo || '').trim();
  const nome = String(req.body?.nome || '').trim();
  const analitica = req.body?.analitica !== false;
  if (!/^[0-9]+(\.[0-9]+)*$/.test(codigo)) throw badRequest('Código inválido. Use o formato 1.1.01.001.');
  if (!nome) throw badRequest('Informe o nome da conta.');

  let tipo = req.body?.tipo;
  let natureza = req.body?.natureza;
  let contaPaiId = null;
  if (codigo.includes('.')) {
    const codigoPai = codigo.replace(/\.[0-9]+$/, '');
    const { rows } = await query(
      'SELECT id, tipo, natureza, analitica FROM conta_contabil WHERE cliente_id = $1 AND codigo = $2',
      [clienteId, codigoPai],
    );
    const pai = rows[0];
    if (!pai) throw badRequest(`A conta superior ${codigoPai} não existe. Crie-a primeiro.`);
    if (pai.analitica) throw badRequest(`A conta ${codigoPai} é analítica e não pode ter subcontas.`);
    contaPaiId = pai.id;
    tipo = pai.tipo; // subconta herda tipo e natureza do grupo
    natureza = pai.natureza;
  } else if (!TIPOS.includes(tipo) || !['D', 'C'].includes(natureza)) {
    throw badRequest('Conta de primeiro nível precisa de tipo e natureza.');
  }

  const conta = await withTransaction(req.usuario.id, async (db) => {
    const { rows } = await db.query(
      `INSERT INTO conta_contabil (cliente_id, conta_pai_id, codigo, nome, tipo, natureza, analitica)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [clienteId, contaPaiId, codigo, nome, tipo, natureza, analitica],
    );
    return rows[0];
  });
  res.status(201).json(conta);
});

async function contaDoUsuario(req) {
  const { rows } = await query('SELECT id, cliente_id FROM conta_contabil WHERE id = $1', [req.params.id]);
  if (!rows[0]) throw notFound('Conta não encontrada.');
  exigirEmpresa(req, rows[0].cliente_id);
  return rows[0];
}

// Edita nome e situação. O código não muda: ele identifica a conta nos
// relatórios e na exportação.
router.put('/contas/:id', somenteContador, async (req, res) => {
  const conta = await contaDoUsuario(req);
  const nome = String(req.body?.nome || '').trim();
  if (!nome) throw badRequest('Informe o nome da conta.');
  const ativa = req.body?.ativa !== false;
  await withTransaction(req.usuario.id, (db) =>
    db.query('UPDATE conta_contabil SET nome = $2, ativa = $3 WHERE id = $1', [conta.id, nome, ativa]),
  );
  res.json({ id: conta.id, nome, ativa });
});

// Exclusão: o ON DELETE RESTRICT do banco impede apagar conta com
// lançamentos ou subcontas; o erro volta como mensagem amigável.
router.delete('/contas/:id', somenteContador, async (req, res) => {
  const conta = await contaDoUsuario(req);
  await withTransaction(req.usuario.id, (db) => db.query('DELETE FROM conta_contabil WHERE id = $1', [conta.id]));
  res.status(204).end();
});

export default router;
