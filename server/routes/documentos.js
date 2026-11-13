import { Router } from 'express';
import multer from 'multer';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { query, withTransaction } from '../db.js';
import { exigirEmpresa, somenteContador } from '../auth.js';
import { badRequest, notFound } from '../errors.js';
import { abrirArquivo, arquivoExiste, salvarArquivo } from '../storage.js';

const router = Router();

const MAX_BYTES = 10 * 1024 * 1024; // RF09
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 20 } });

const IMAGEM_PDF = ['pdf', 'jpg', 'jpeg', 'png'];
export const TIPOS_DOCUMENTO = {
  NOTA_FISCAL: IMAGEM_PDF,
  COMPROVANTE: IMAGEM_PDF,
  EXTRATO: IMAGEM_PDF,
  XML_NFE: ['xml'],
  JSON_CONTABIL: ['json'],
  CONTRATO: IMAGEM_PDF,
  OUTRO: [...IMAGEM_PDF, 'xml', 'json'],
};

/** Chave de acesso de 44 dígitos de um XML de NF-e, se houver. */
export function extrairChaveNFe(buffer) {
  const xml = buffer.toString('utf8');
  const m = xml.match(/<chNFe>\s*(\d{44})\s*<\/chNFe>/) || xml.match(/Id\s*=\s*"NFe(\d{44})"/);
  return m ? m[1] : null;
}

const SELECT_DOCUMENTO = `
  SELECT d.id, d.cliente_id AS "empresaId", COALESCE(c.nome_fantasia, c.razao_social) AS empresa,
         d.nome_arquivo AS "nomeArquivo", d.tipo_documento AS tipo, d.formato, d.tamanho_bytes AS tamanho,
         d.tipo_processamento AS processamento, d.status, d.motivo_rejeicao AS "motivoRejeicao",
         d.chave_acesso_nfe AS "chaveNFe", d.data_upload AS "dataUpload", d.caminho_arquivo AS caminho,
         u.nome AS "enviadoPor",
         a.nivel_confianca AS confianca, fn_classificar_confianca(a.nivel_confianca) AS "faixaConfianca",
         a.status AS "statusAnalise",
         EXISTS (SELECT 1 FROM lancamento l WHERE l.documento_id = d.id AND l.status = 'APROVADO') AS lancado,
         (SELECT max(l.aprovado_em) FROM lancamento l WHERE l.documento_id = d.id) AS "dataLancamento"
  FROM documento d
  JOIN cliente c ON c.id = d.cliente_id
  JOIN usuario u ON u.id = d.enviado_por
  LEFT JOIN analise_documento a ON a.documento_id = d.id`;

router.get('/documentos', async (req, res) => {
  const empresaId = exigirEmpresa(req, req.query.empresa);
  const params = [empresaId];
  let filtro = '';
  if (req.query.status && req.query.status !== 'all') {
    params.push(req.query.status);
    filtro += ` AND d.status = $${params.length}`;
  }
  if (req.query.q) {
    params.push(`%${String(req.query.q).toLowerCase()}%`);
    filtro += ` AND (lower(d.nome_arquivo) LIKE $${params.length} OR lower(d.tipo_documento) LIKE $${params.length})`;
  }
  const { rows } = await query(
    `${SELECT_DOCUMENTO} WHERE d.cliente_id = $1 ${filtro} ORDER BY d.data_upload DESC, d.id DESC`,
    params,
  );
  for (const r of rows) {
    r.temArquivo = await arquivoExiste(r.caminho);
    delete r.caminho;
  }
  res.json(rows);
});

// Upload (RF08–RF10, RF12, RN04). Cada arquivo é gravado na sua própria
// transação: um duplicado não impede os outros de entrarem.
router.post('/empresas/:id/documentos', upload.array('arquivos', 20), async (req, res) => {
  const clienteId = exigirEmpresa(req, req.params.id);
  const tipo = req.body?.tipo;
  const aceitos = TIPOS_DOCUMENTO[tipo];
  if (!aceitos) throw badRequest('Tipo de documento inválido.');
  if (!req.files?.length) throw badRequest('Adicione pelo menos um arquivo.');
  const empresa = req.usuario.empresas.find((e) => e.id === clienteId);
  if (empresa?.status === 'INATIVO') throw badRequest('Empresa inativa não recebe documentos.');

  const resultados = [];
  for (const f of req.files) {
    // multer entrega o nome em latin1; converte para UTF-8 (acentos)
    const nome = Buffer.from(f.originalname, 'latin1').toString('utf8');
    const ext = path.extname(nome).slice(1).toLowerCase();
    if (!aceitos.includes(ext)) {
      resultados.push({ nomeArquivo: nome, ok: false, erro: `Formato .${ext || '?'} não aceito para este tipo.` });
      continue;
    }
    const hash = createHash('sha256').update(f.buffer).digest('hex');
    const chave = ext === 'xml' ? extrairChaveNFe(f.buffer) : null;
    const caminho = `clientes/${clienteId}/${hash}.${ext}`;
    const direto = ext === 'xml' || ext === 'json';
    try {
      const doc = await withTransaction(req.usuario.id, async (db) => {
        const { rows } = await db.query(
          `INSERT INTO documento (cliente_id, enviado_por, nome_arquivo, tipo_documento, formato, tamanho_bytes,
                                  hash_sha256, chave_acesso_nfe, caminho_arquivo, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id, status, tipo_processamento AS processamento`,
          [clienteId, req.usuario.id, nome, tipo, ext.toUpperCase(), f.size, hash, chave, caminho,
            direto ? 'IMPORTADO' : 'PENDENTE'],
        );
        await salvarArquivo(caminho, f.buffer); // se falhar, a transação é desfeita
        return rows[0];
      });
      resultados.push({ nomeArquivo: nome, ok: true, ...doc, tamanho: f.size, chaveNFe: chave });
    } catch (err) {
      const msg = {
        uq_documento_hash: 'Este arquivo já foi enviado para esta empresa.',
        uq_documento_chave: 'Esta NF-e já foi enviada para esta empresa.',
        ck_documento_tamanho: 'Arquivo vazio.',
      }[err.constraint];
      if (!msg) throw err;
      resultados.push({ nomeArquivo: nome, ok: false, erro: msg });
    }
  }
  res.status(201).json(resultados);
});

router.get('/documentos/:id/arquivo', async (req, res) => {
  const { rows } = await query(
    'SELECT cliente_id, nome_arquivo, formato, caminho_arquivo FROM documento WHERE id = $1',
    [req.params.id],
  );
  const d = rows[0];
  if (!d) throw notFound('Documento não encontrado.');
  exigirEmpresa(req, d.cliente_id);
  if (!(await arquivoExiste(d.caminho_arquivo))) {
    throw notFound('O arquivo não está disponível no servidor (documento de demonstração ou armazenamento temporário reiniciado).');
  }
  const tipos = { PDF: 'application/pdf', JPG: 'image/jpeg', JPEG: 'image/jpeg', PNG: 'image/png', XML: 'application/xml', JSON: 'application/json' };
  res.setHeader('Content-Type', tipos[d.formato] || 'application/octet-stream');
  const disposicao = req.query.download ? 'attachment' : 'inline';
  res.setHeader('Content-Disposition', `${disposicao}; filename*=UTF-8''${encodeURIComponent(d.nome_arquivo)}`);
  abrirArquivo(d.caminho_arquivo).pipe(res);
});

// Rejeição com justificativa (RF24): usa a procedure do banco, que
// reprova os lançamentos sugeridos e registra a revisão.
router.post('/documentos/:id/rejeitar', somenteContador, async (req, res) => {
  const { rows } = await query('SELECT cliente_id FROM documento WHERE id = $1', [req.params.id]);
  if (!rows[0]) throw notFound('Documento não encontrado.');
  exigirEmpresa(req, rows[0].cliente_id);
  const motivo = String(req.body?.motivo || '').trim();
  const r = await withTransaction(req.usuario.id, (db) =>
    db.query('CALL sp_reprovar_documento($1, $2, $3, NULL)', [Number(req.params.id), req.usuario.id, motivo]),
  );
  res.json({ lancamentosReprovados: r.rows[0].p_qtd_reprovados });
});

export default router;
