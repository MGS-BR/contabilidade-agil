import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../db.js';
import { exigirEmpresa, idsEmpresas, somenteContador } from '../auth.js';
import { badRequest, notFound } from '../errors.js';
import { PLANO_PADRAO } from '../plano-padrao.js';

const router = Router();

const REGIMES = ['SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL', 'MEI'];
const digitos = (v) => String(v ?? '').replace(/\D/g, '');
const texto = (v) => {
  const t = String(v ?? '').trim();
  return t === '' ? null : t;
};

function normalizarEmpresa(body) {
  const e = {
    razaoSocial: texto(body.razaoSocial),
    nomeFantasia: texto(body.nomeFantasia),
    cnpj: digitos(body.cnpj),
    inscricaoEstadual: texto(body.inscricaoEstadual),
    inscricaoMunicipal: texto(body.inscricaoMunicipal),
    regimeTributario: texto(body.regimeTributario),
    cnae: digitos(body.cnae) || null,
    email: texto(body.email)?.toLowerCase() ?? null,
    telefone: texto(body.telefone),
    responsavel: texto(body.responsavel),
    logradouro: texto(body.logradouro),
    cidade: texto(body.cidade),
    uf: texto(body.uf)?.toUpperCase() ?? null,
    cep: digitos(body.cep) || null,
  };
  if (e.inscricaoEstadual && /^isent/i.test(e.inscricaoEstadual)) e.inscricaoEstadual = null;
  const faltando = [];
  if (!e.razaoSocial) faltando.push('Razão social');
  if (!e.cnpj) faltando.push('CNPJ');
  if (!e.email) faltando.push('E-mail');
  if (!e.uf) faltando.push('UF');
  if (faltando.length) throw badRequest(`Preencha: ${faltando.join(', ')}.`);
  if (e.cnpj.length !== 14) throw badRequest('CNPJ deve ter 14 dígitos.');
  if (!REGIMES.includes(e.regimeTributario)) throw badRequest('Selecione o regime tributário.');
  return e;
}

const SELECT_EMPRESA = `
  SELECT c.id, c.razao_social AS "razaoSocial", c.nome_fantasia AS "nomeFantasia", c.cnpj,
         c.inscricao_estadual AS "inscricaoEstadual", c.inscricao_municipal AS "inscricaoMunicipal",
         c.regime_tributario AS "regimeTributario", c.cnae, c.email, c.telefone, c.responsavel,
         c.logradouro, c.cidade, c.uf, c.cep, c.status, c.criado_em AS "criadoEm",
         (SELECT count(*) FROM documento d WHERE d.cliente_id = c.id)::int AS documentos,
         (SELECT count(*) FROM lancamento l WHERE l.cliente_id = c.id)::int AS lancamentos,
         (SELECT count(*) FROM lancamento l WHERE l.cliente_id = c.id
            AND l.status IN ('PENDENTE','CORRIGIDO'))::int AS "lancamentosPendentes",
         GREATEST(c.atualizado_em,
                  (SELECT max(d.data_upload) FROM documento d WHERE d.cliente_id = c.id),
                  (SELECT max(l.atualizado_em) FROM lancamento l WHERE l.cliente_id = c.id)) AS "ultimaAtualizacao",
         (SELECT string_agg(u.nome, ', ' ORDER BY u.nome) FROM usuario_cliente uc
            JOIN usuario u ON u.id = uc.usuario_id
           WHERE uc.cliente_id = c.id AND uc.papel = 'RESPONSAVEL') AS contadores
  FROM cliente c`;

// Lista as empresas da carteira do usuário
router.get('/', async (req, res) => {
  const { rows } = await query(
    `${SELECT_EMPRESA} WHERE c.id = ANY($1) ORDER BY COALESCE(c.nome_fantasia, c.razao_social)`,
    [idsEmpresas(req)],
  );
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const id = exigirEmpresa(req, req.params.id);
  const { rows } = await query(`${SELECT_EMPRESA} WHERE c.id = $1`, [id]);
  if (!rows[0]) throw notFound();
  res.json(rows[0]);
});

// Cadastra empresa, vincula o contador como responsável, copia o plano
// de contas padrão e (opcional) cria o acesso do cliente — tudo numa transação.
router.post('/', somenteContador, async (req, res) => {
  const e = normalizarEmpresa(req.body || {});
  const acessoEmail = texto(req.body?.acessoEmail)?.toLowerCase();
  const acessoSenha = String(req.body?.acessoSenha || '');
  const acessoNome = texto(req.body?.acessoNome) || e.responsavel || e.razaoSocial;
  if (acessoEmail && acessoSenha.length < 6) throw badRequest('A senha inicial do cliente precisa ter ao menos 6 caracteres.');

  const id = await withTransaction(req.usuario.id, async (db) => {
    const { rows } = await db.query(
      `INSERT INTO cliente (escritorio_id, razao_social, nome_fantasia, cnpj, inscricao_estadual, inscricao_municipal,
                            regime_tributario, cnae, email, telefone, responsavel, logradouro, cidade, uf, cep)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
      [req.usuario.escritorioId, e.razaoSocial, e.nomeFantasia, e.cnpj, e.inscricaoEstadual, e.inscricaoMunicipal,
        e.regimeTributario, e.cnae, e.email, e.telefone, e.responsavel, e.logradouro, e.cidade, e.uf, e.cep],
    );
    const clienteId = rows[0].id;
    await db.query("INSERT INTO usuario_cliente (usuario_id, cliente_id, papel) VALUES ($1, $2, 'RESPONSAVEL')", [req.usuario.id, clienteId]);

    await db.query(
      `INSERT INTO conta_contabil (cliente_id, codigo, nome, tipo, natureza, analitica)
       SELECT $1, p->>0, p->>1, p->>2, p->>3, (p->>4)::boolean FROM jsonb_array_elements($2::jsonb) p`,
      [clienteId, JSON.stringify(PLANO_PADRAO)],
    );
    await db.query(
      `UPDATE conta_contabil f SET conta_pai_id = p.id
       FROM conta_contabil p
       WHERE f.cliente_id = $1 AND p.cliente_id = $1 AND f.codigo LIKE '%.%'
         AND p.codigo = regexp_replace(f.codigo, '\\.[0-9]+$', '')`,
      [clienteId],
    );

    if (acessoEmail) {
      const hash = await bcrypt.hash(acessoSenha, 10);
      const u = await db.query(
        `INSERT INTO usuario (escritorio_id, nome, email, senha_hash, perfil) VALUES ($1,$2,$3,$4,'CLIENTE') RETURNING id`,
        [req.usuario.escritorioId, acessoNome, acessoEmail, hash],
      );
      await db.query("INSERT INTO usuario_cliente (usuario_id, cliente_id, papel) VALUES ($1, $2, 'ACESSO')", [u.rows[0].id, clienteId]);
    }
    return clienteId;
  });
  const { rows } = await query(`${SELECT_EMPRESA} WHERE c.id = $1`, [id]);
  res.status(201).json(rows[0]);
});

router.put('/:id', somenteContador, async (req, res) => {
  const id = exigirEmpresa(req, req.params.id);
  const e = normalizarEmpresa(req.body || {});
  await withTransaction(req.usuario.id, (db) =>
    db.query(
      `UPDATE cliente SET razao_social=$2, nome_fantasia=$3, cnpj=$4, inscricao_estadual=$5, inscricao_municipal=$6,
              regime_tributario=$7, cnae=$8, email=$9, telefone=$10, responsavel=$11, logradouro=$12,
              cidade=$13, uf=$14, cep=$15
       WHERE id = $1`,
      [id, e.razaoSocial, e.nomeFantasia, e.cnpj, e.inscricaoEstadual, e.inscricaoMunicipal, e.regimeTributario,
        e.cnae, e.email, e.telefone, e.responsavel, e.logradouro, e.cidade, e.uf, e.cep],
    ),
  );
  const { rows } = await query(`${SELECT_EMPRESA} WHERE c.id = $1`, [id]);
  res.json(rows[0]);
});

// Ativar/inativar (RF06). Empresas não são excluídas: o histórico
// fiscal precisa ficar guardado (RN02/RN07).
router.patch('/:id/status', somenteContador, async (req, res) => {
  const id = exigirEmpresa(req, req.params.id);
  const status = req.body?.status;
  if (!['ATIVO', 'INATIVO'].includes(status)) throw badRequest('Status inválido.');
  await withTransaction(req.usuario.id, (db) => db.query('UPDATE cliente SET status = $2 WHERE id = $1', [id, status]));
  res.json({ id, status });
});

export default router;
