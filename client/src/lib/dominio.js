// Vocabulário do domínio: rótulos e cores dos status (mesmos valores dos CHECKs do banco).

export const STATUS_DOCUMENTO = {
  PENDENTE: { rotulo: 'Aguardando análise', cor: 'bg-gray-100 text-gray-700' },
  PROCESSANDO: { rotulo: 'Processando', cor: 'bg-yellow-100 text-yellow-800' },
  ANALISADO: { rotulo: 'Analisado', cor: 'bg-blue-100 text-blue-700' },
  IMPORTADO: { rotulo: 'Importado', cor: 'bg-indigo-100 text-indigo-700' },
  APROVADO: { rotulo: 'Aprovado', cor: 'bg-green-100 text-green-700' },
  REJEITADO: { rotulo: 'Rejeitado', cor: 'bg-red-100 text-red-700' },
  FALHA: { rotulo: 'Falha na leitura', cor: 'bg-orange-100 text-orange-800' },
};

export const STATUS_LANCAMENTO = {
  PENDENTE: { rotulo: 'Pendente', cor: 'bg-yellow-100 text-yellow-800' },
  CORRIGIDO: { rotulo: 'Corrigido', cor: 'bg-blue-100 text-blue-700' },
  APROVADO: { rotulo: 'Aprovado', cor: 'bg-green-100 text-green-700' },
  REPROVADO: { rotulo: 'Reprovado', cor: 'bg-red-100 text-red-700' },
};

export const ORIGEM_LANCAMENTO = {
  IA: 'IA',
  MANUAL: 'Manual',
  IMPORTACAO: 'Importação',
};

export const TIPOS_DOCUMENTO = [
  { valor: 'NOTA_FISCAL', rotulo: 'Nota Fiscal', descricao: 'PDF, JPG ou PNG para leitura por OCR e IA', aceitos: '.pdf,.jpg,.jpeg,.png' },
  { valor: 'COMPROVANTE', rotulo: 'Comprovante de pagamento', descricao: 'Recibos, boletos e comprovantes bancários', aceitos: '.pdf,.jpg,.jpeg,.png' },
  { valor: 'EXTRATO', rotulo: 'Extrato bancário', descricao: 'Extratos em PDF ou imagem', aceitos: '.pdf,.jpg,.jpeg,.png' },
  { valor: 'XML_NFE', rotulo: 'XML de NF-e', descricao: 'Importação direta, sem IA (a chave de acesso é lida do XML)', aceitos: '.xml' },
  { valor: 'JSON_CONTABIL', rotulo: 'JSON contábil', descricao: 'Importação direta, sem IA', aceitos: '.json' },
  { valor: 'CONTRATO', rotulo: 'Contrato', descricao: 'Documentos de apoio para auditoria', aceitos: '.pdf,.jpg,.jpeg,.png' },
  { valor: 'OUTRO', rotulo: 'Outro documento', descricao: 'Arquivo contábil complementar', aceitos: '.pdf,.jpg,.jpeg,.png,.xml,.json' },
];

export const rotuloTipoDocumento = (v) => TIPOS_DOCUMENTO.find((t) => t.valor === v)?.rotulo || v;

export const REGIMES = [
  { valor: 'SIMPLES_NACIONAL', rotulo: 'Simples Nacional' },
  { valor: 'LUCRO_PRESUMIDO', rotulo: 'Lucro Presumido' },
  { valor: 'LUCRO_REAL', rotulo: 'Lucro Real' },
  { valor: 'MEI', rotulo: 'MEI/SIMEI' },
];
export const rotuloRegime = (v) => REGIMES.find((r) => r.valor === v)?.rotulo || v;

export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR',
  'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

export const TIPOS_CONTA = {
  ATIVO: 'bg-blue-100 text-blue-700',
  PASSIVO: 'bg-red-100 text-red-700',
  PATRIMONIO: 'bg-purple-100 text-purple-700',
  RECEITA: 'bg-green-100 text-green-700',
  DESPESA: 'bg-yellow-100 text-yellow-800',
};

export const TIPOS_RELATORIO = [
  { id: 'BALANCO', nome: 'Balanço Patrimonial', descricao: 'Ativos, passivos e patrimônio líquido da empresa' },
  { id: 'BALANCETE', nome: 'Balancete', descricao: 'Resumo de saldos por conta' },
  { id: 'DRE', nome: 'DRE', descricao: 'Demonstração do Resultado do Exercício' },
  { id: 'RAZAO', nome: 'Razão', descricao: 'Extrato detalhado por conta' },
  { id: 'DIARIO', nome: 'Diário', descricao: 'Lançamentos em ordem cronológica' },
];
export const nomeRelatorio = (id) => TIPOS_RELATORIO.find((t) => t.id === id)?.nome || id;

/** Monta a árvore do plano de contas a partir da lista plana da API. */
export function montarArvore(contas) {
  const porId = new Map(contas.map((c) => [c.id, { ...c, subcontas: [] }]));
  const raizes = [];
  for (const c of porId.values()) {
    if (c.contaPaiId && porId.has(c.contaPaiId)) porId.get(c.contaPaiId).subcontas.push(c);
    else raizes.push(c);
  }
  return raizes;
}
