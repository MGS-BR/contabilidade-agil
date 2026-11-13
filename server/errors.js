export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const badRequest = (msg) => new HttpError(400, msg);
export const forbidden = (msg = 'Você não tem acesso a este recurso.') => new HttpError(403, msg);
export const notFound = (msg = 'Registro não encontrado.') => new HttpError(404, msg);

// Mensagens amigáveis para as constraints do banco (nome → texto).
const CONSTRAINTS = {
  ck_cliente_cnpj_dv: 'CNPJ inválido: confira os dígitos verificadores.',
  ck_cliente_cnpj: 'CNPJ deve ter 14 dígitos.',
  uq_cliente_escritorio_cnpj: 'Já existe uma empresa com este CNPJ no escritório.',
  ck_cliente_cep: 'CEP deve ter 8 dígitos.',
  ck_cliente_cnae: 'CNAE deve ter 7 dígitos.',
  ck_cliente_uf: 'UF inválida.',
  ck_cliente_email: 'E-mail da empresa inválido.',
  ck_cliente_regime: 'Regime tributário inválido.',
  uq_usuario_email: 'Já existe um usuário com este e-mail.',
  ck_usuario_email: 'E-mail de acesso inválido.',
  uq_documento_hash: 'Este arquivo já foi enviado para esta empresa.',
  uq_documento_chave: 'Esta NF-e (mesma chave de acesso) já foi enviada para esta empresa.',
  ck_documento_tamanho: 'Arquivo vazio ou maior que 10 MB.',
  ck_documento_tipo_formato: 'O formato do arquivo não combina com o tipo de documento escolhido.',
  ck_documento_rejeicao: 'Informe uma justificativa com pelo menos 10 caracteres.',
  uq_conta_cliente_codigo: 'Já existe uma conta com este código no plano desta empresa.',
  ck_conta_codigo: 'Código da conta inválido (use o formato 1.1.01.001).',
  fk_item_conta: 'A conta tem lançamentos e não pode ser excluída. Inative-a.',
  fk_conta_pai: 'A conta tem subcontas e não pode ser excluída.',
  ck_revisao_obs: 'Informe uma observação.',
  ck_relatorio_periodo: 'A data final precisa ser igual ou posterior à inicial.',
  ck_exportacao_periodo: 'A data final precisa ser igual ou posterior à inicial.',
};

/** Converte erros do PostgreSQL em respostas HTTP com mensagem em português. */
export function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ erro: err.message });
  }
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ erro: 'Arquivo maior que 10 MB.' });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido.' });
  }
  if (err?.code && typeof err.code === 'string' && err.code.length === 5) {
    const friendly = err.constraint && CONSTRAINTS[err.constraint];
    const map = {
      '23505': 409, // unique
      '23503': 409, // foreign key
      '23514': 400, // check
      '23000': 400, // integrity (triggers)
      '22023': 400, // invalid parameter
      '22P02': 400, // invalid text representation
      '22007': 400, // invalid datetime
      '22008': 400,
      'P0001': 400, // raise exception
      'P0002': 404, // no_data_found
      '42501': 403, // insufficient_privilege
      '40001': 409, // serialization_failure
    };
    const status = map[err.code];
    if (status) {
      return res.status(status).json({ erro: friendly || err.message });
    }
  }
  console.error('[erro]', err);
  return res.status(500).json({ erro: 'Erro interno no servidor.' });
}
