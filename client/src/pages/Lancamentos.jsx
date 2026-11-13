import { useMemo, useState } from 'react';
import {
  Bot, CopyPlus, Download, Eye, FileText, Funnel, Plus, Save, Search, SquarePen, ThumbsDown, ThumbsUp,
  Trash2, TrendingDown, TrendingUp, TriangleAlert, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api, abrirArquivo } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { data, dataHora, fimDoMes, hojeISO, inicioDoMes, lerValor, moeda } from '../lib/format.js';
import { ORIGEM_LANCAMENTO, STATUS_LANCAMENTO, rotuloTipoDocumento } from '../lib/dominio.js';
import CompanySelector from '../components/CompanySelector.jsx';
import { Alert, Badge, Button, Campo, EmptyState, Loading, Modal, PageHeader, inputClass } from '../components/ui.jsx';

const novaPartida = (conta = '') => ({ chave: Math.random().toString(36).slice(2), conta, debito: '', credito: '' });
const formVazio = () => ({ id: null, data: hojeISO(), descricao: '', observacao: '', itens: [novaPartida(), novaPartida()] });

/** Formulário de lançamento simples/múltiplo (novo ou correção de sugestão). */
function FormLancamento({ form, setForm, contas, onSalvar, onCancelar, salvando, erro }) {
  const totalD = form.itens.reduce((s, i) => s + (lerValor(i.debito) || 0), 0);
  const totalC = form.itens.reduce((s, i) => s + (lerValor(i.credito) || 0), 0);
  const balanceado = Math.abs(totalD - totalC) < 0.005 && totalD > 0;
  const mudar = (chave, campo, valor) => setForm((f) => ({ ...f, itens: f.itens.map((i) => (i.chave === chave ? { ...i, [campo]: valor } : i)) }));

  return (
    <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-gray-900">{form.id ? 'Corrigir lançamento' : 'Novo lançamento'}</h3>
          <p className="text-sm text-gray-600">Adicione quantas partidas precisar. O sistema só salva com débitos iguais aos créditos.</p>
        </div>
        <button type="button" onClick={onCancelar} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Fechar formulário">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-[180px_1fr]">
        <Campo label="Data">
          <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} className={inputClass} />
        </Campo>
        <Campo label="Descrição (histórico)">
          <input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Ex.: Pagamento de fornecedor com juros" className={inputClass} />
        </Campo>
        {form.id && (
          <Campo label="O que foi corrigido" className="md:col-span-2" dica="Fica registrado no histórico de revisões (usado para melhorar a IA).">
            <input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} placeholder="Ex.: IA classificou como despesa; o correto é estoque." className={inputClass} />
          </Campo>
        )}
      </div>

      <div className="space-y-3 md:space-y-0">
        <div className="hidden grid-cols-[1fr_150px_150px_44px] gap-3 px-1 pb-2 text-xs font-medium text-gray-600 md:grid">
          <span>Conta contábil</span><span className="text-right">Débito</span><span className="text-right">Crédito</span><span />
        </div>
        {form.itens.map((i, idx) => (
          <div key={i.chave} className="grid grid-cols-2 gap-2 rounded-lg border border-gray-200 p-3 md:grid-cols-[1fr_150px_150px_44px] md:gap-3 md:border-0 md:p-1">
            <input list="contas-analiticas" value={i.conta} onChange={(e) => mudar(i.chave, 'conta', e.target.value)} placeholder="Digite o código ou nome da conta" className={`${inputClass} col-span-2 md:col-span-1`} aria-label={`Conta da partida ${idx + 1}`} />
            <input inputMode="decimal" value={i.debito} onChange={(e) => mudar(i.chave, 'debito', e.target.value)} placeholder="Débito" className={`${inputClass} text-right`} aria-label={`Débito da partida ${idx + 1}`} />
            <input inputMode="decimal" value={i.credito} onChange={(e) => mudar(i.chave, 'credito', e.target.value)} placeholder="Crédito" className={`${inputClass} text-right`} aria-label={`Crédito da partida ${idx + 1}`} />
            <button type="button" disabled={form.itens.length <= 2} onClick={() => setForm((f) => ({ ...f, itens: f.itens.filter((x) => x.chave !== i.chave) }))}
              className="col-span-2 justify-self-end rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-30 md:col-span-1" aria-label={`Remover partida ${idx + 1}`}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <datalist id="contas-analiticas">
          {contas.map((c) => <option key={c.id} value={`${c.codigo} - ${c.nome}`} />)}
        </datalist>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-gray-50 px-4 py-3 text-sm">
        <span className="font-medium text-gray-900">Totais</span>
        <span className="flex flex-wrap items-center gap-4">
          <span>Débitos <strong className="text-red-600">{moeda(totalD)}</strong></span>
          <span>Créditos <strong className="text-green-600">{moeda(totalC)}</strong></span>
          {balanceado ? <Badge className="bg-green-100 text-green-700">Balanceado</Badge> : <Badge className="bg-red-100 text-red-700">Diferença {moeda(Math.abs(totalD - totalC))}</Badge>}
        </span>
      </div>

      <Alert tipo="erro" className="mt-3">{erro}</Alert>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button variante="suave" icon={CopyPlus} onClick={() => setForm((f) => ({ ...f, itens: [...f.itens, novaPartida()] }))}>Adicionar partida</Button>
        <Button icon={Save} onClick={onSalvar} carregando={salvando}>{form.id ? 'Salvar correção' : 'Salvar lançamento'}</Button>
      </div>
    </section>
  );
}

/** Painel do documento de origem, para conferir a sugestão da IA. */
function PainelDocumento({ lancamento, onAprovar, onReprovar, onFechar, onAbrirArquivo }) {
  const doc = lancamento.documento;
  const dados = doc.dados && typeof doc.dados === 'object' ? Object.entries(doc.dados) : [];
  const pendente = ['PENDENTE', 'CORRIGIDO'].includes(lancamento.status);
  return (
    <aside className="h-fit rounded-lg border border-blue-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">Documento para conferência</h3>
        </div>
        <button type="button" onClick={onFechar} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100" aria-label="Fechar painel do documento"><X className="h-4 w-4" /></button>
      </div>
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <p className="break-all font-medium text-gray-900">{doc.nome}</p>
        <p className="text-sm text-gray-600">{rotuloTipoDocumento(doc.tipo)} · enviado em {dataHora(doc.dataUpload)}</p>
        <Button variante="primario" icon={Eye} onClick={() => onAbrirArquivo(doc)} className="mt-3 w-full">Visualizar arquivo</Button>
      </div>
      <div className="mt-4 space-y-2 text-sm">
        <p>
          <strong>Leitura:</strong> {doc.motor === 'OCR_IA' ? 'OCR + IA' : doc.motor === 'XML_PARSER' ? 'XML da NF-e' : doc.motor === 'JSON_IMPORT' ? 'Importação JSON' : '—'}
          {doc.confianca !== null && <> · confiança <strong>{Math.round(doc.confianca)}%</strong> ({doc.faixa.toLowerCase()})</>}
        </p>
        {dados.length > 0 && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg bg-gray-50 p-3 text-xs">
            {dados.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="font-medium capitalize text-gray-600">{k.replaceAll('_', ' ')}</dt>
                <dd className="break-words text-gray-900">{Array.isArray(v) ? v.join(', ') : v === null ? '—' : String(v)}</dd>
              </div>
            ))}
          </dl>
        )}
        <p><strong>Valor do lançamento:</strong> {moeda(lancamento.valorTotal)}</p>
      </div>
      {doc.faixa === 'BAIXA' && (
        <div className="mt-4 flex gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
          <TriangleAlert className="h-5 w-5 shrink-0" />
          <span>Confiança baixa: confira valor, data e contas com atenção antes de aprovar.</span>
        </div>
      )}
      {pendente && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variante="sucesso" onClick={onAprovar}>Aprovar</Button>
          <Button variante="perigo" onClick={onReprovar}>Reprovar</Button>
        </div>
      )}
    </aside>
  );
}

export default function Lancamentos() {
  const { selectedCompany } = useAuth();
  const empresaId = selectedCompany?.id;
  const lista = useApi(empresaId ? `/lancamentos?empresa=${empresaId}` : null);
  const plano = useApi(empresaId ? `/empresas/${empresaId}/contas` : null);
  const contas = useMemo(() => (plano.dados || []).filter((c) => c.analitica && c.ativa), [plano.dados]);

  const [filtro, setFiltro] = useState('all');
  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState(null);
  const [form, setForm] = useState(null);
  const [erroForm, setErroForm] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [reprovar, setReprovar] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [excluir, setExcluir] = useState(null);
  const [exportar, setExportar] = useState(null);
  const inativa = selectedCompany?.status === 'INATIVO';

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (lista.dados || []).filter((l) =>
      (filtro === 'all' || l.status === filtro || l.origem === filtro) &&
      (!q || l.descricao.toLowerCase().includes(q) || l.documento?.nome.toLowerCase().includes(q) ||
        l.itens.some((i) => i.conta.includes(q) || i.contaNome.toLowerCase().includes(q))));
  }, [lista.dados, filtro, busca]);

  const executar = async (fn, sucesso) => {
    setAviso(null);
    try {
      await fn();
      setAviso({ tipo: 'sucesso', texto: sucesso });
      lista.recarregar();
      plano.recarregar();
      return true;
    } catch (err) {
      setAviso({ tipo: 'erro', texto: err.message });
      return false;
    }
  };

  const salvar = async () => {
    setErroForm('');
    const itens = [];
    for (const [idx, i] of form.itens.entries()) {
      const d = lerValor(i.debito);
      const c = lerValor(i.credito);
      if (Number.isNaN(d) || Number.isNaN(c)) return setErroForm(`Partida ${idx + 1}: valor inválido.`);
      if (!i.conta.trim()) return setErroForm(`Partida ${idx + 1}: informe a conta.`);
      if ((d > 0) === (c > 0)) return setErroForm(`Partida ${idx + 1}: preencha débito OU crédito (um dos dois).`);
      itens.push({ conta: i.conta.trim(), tipo: d > 0 ? 'D' : 'C', valor: d > 0 ? d : c });
    }
    setSalvando(true);
    try {
      const corpo = { empresaId, data: form.data, descricao: form.descricao, observacao: form.observacao, itens };
      if (form.id) await api(`/lancamentos/${form.id}`, { method: 'PUT', body: corpo });
      else await api('/lancamentos', { method: 'POST', body: corpo });
      setAviso({ tipo: 'sucesso', texto: form.id ? 'Lançamento corrigido. Ele continua aguardando aprovação.' : 'Lançamento manual registrado e aprovado.' });
      setForm(null);
      lista.recarregar();
      plano.recarregar();
    } catch (err) {
      setErroForm(err.message);
    } finally {
      setSalvando(false);
    }
  };

  const editar = (l) => {
    setErroForm('');
    setForm({
      id: l.id, data: l.data, descricao: l.descricao, observacao: '',
      itens: l.itens.map((i) => ({ ...novaPartida(`${i.conta} - ${i.contaNome}`), debito: i.tipo === 'D' ? String(i.valor).replace('.', ',') : '', credito: i.tipo === 'C' ? String(i.valor).replace('.', ',') : '' })),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const aprovar = (l) => executar(() => api(`/lancamentos/${l.id}/aprovar`, { method: 'POST', body: {} }), `"${l.descricao}" aprovado.`);

  const confirmarReprovacao = async () => {
    const ok = await executar(() => api(`/lancamentos/${reprovar.id}/reprovar`, { method: 'POST', body: { motivo } }), 'Sugestão reprovada e mantida no histórico.');
    if (ok) setReprovar(null);
  };

  const confirmarExclusao = async () => {
    const ok = await executar(() => api(`/lancamentos/${excluir.id}`, { method: 'DELETE' }), 'Lançamento excluído.');
    setExcluir(null);
    if (ok && selecionado === excluir.id) setSelecionado(null);
  };

  const confirmarExportacao = async () => {
    try {
      const r = await api(`/empresas/${empresaId}/exportacoes`, { method: 'POST', body: { inicio: exportar.inicio, fim: exportar.fim } });
      await abrirArquivo(`/exportacoes/${r.id}/csv`, { baixar: true, nome: `lancamentos_${exportar.inicio}_${exportar.fim}.csv` });
      setAviso({ tipo: 'sucesso', texto: `${r.quantidade} lançamento(s) exportado(s). Eles não sairão de novo em outra exportação.` });
      setExportar(null);
      lista.recarregar();
    } catch (err) {
      setAviso({ tipo: 'erro', texto: err.message });
      setExportar(null);
    }
  };

  const abrirDoc = async (doc) => {
    try {
      await abrirArquivo(`/documentos/${doc.id}/arquivo`);
    } catch (err) {
      setAviso({ tipo: 'aviso', texto: err.message });
    }
  };

  return (
    <div>
      <PageHeader
        title="Lançamentos Contábeis"
        description="Revise sugestões da IA, confira o documento e registre lançamentos simples ou múltiplos"
        action={empresaId ? (
          <>
            <Button variante="secundario" icon={Download} onClick={() => setExportar({ inicio: inicioDoMes(), fim: fimDoMes() })}>Exportar CSV</Button>
            {!inativa && <Button icon={Plus} onClick={() => { setErroForm(''); setForm(formVazio()); }}>Novo lançamento</Button>}
          </>
        ) : null}
      />
      <CompanySelector />

      {!empresaId ? (
        <EmptyState icon={TrendingUp} title="Selecione uma empresa">Para revisar e gerenciar lançamentos, selecione uma empresa acima.</EmptyState>
      ) : (
        <>
          {aviso && <Alert tipo={aviso.tipo} className="mb-4" onClose={() => setAviso(null)}>{aviso.texto}</Alert>}
          {form && (
            <FormLancamento form={form} setForm={setForm} contas={contas} onSalvar={salvar} onCancelar={() => setForm(null)} salvando={salvando} erro={erroForm} />
          )}

          <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input type="search" placeholder="Buscar por descrição, documento ou conta..." value={busca} onChange={(e) => setBusca(e.target.value)} className={`${inputClass} pl-10`} aria-label="Buscar lançamentos" />
              </div>
              <div className="flex items-center gap-2">
                <Funnel className="h-5 w-5 shrink-0 text-gray-400" />
                <select value={filtro} onChange={(e) => setFiltro(e.target.value)} className={`${inputClass} md:w-52`} aria-label="Filtrar lançamentos">
                  <option value="all">Todos</option>
                  <option value="PENDENTE">Pendentes</option>
                  <option value="CORRIGIDO">Corrigidos</option>
                  <option value="APROVADO">Aprovados</option>
                  <option value="REPROVADO">Reprovados</option>
                  <option value="IA">Gerados por IA</option>
                  <option value="IMPORTACAO">Importados (XML/JSON)</option>
                  <option value="MANUAL">Manuais</option>
                </select>
              </div>
            </div>
          </div>

          {lista.erro && <Alert tipo="erro" className="mb-4">{lista.erro}</Alert>}
          {lista.carregando && !lista.dados ? (
            <Loading />
          ) : filtrados.length === 0 ? (
            <EmptyState icon={TrendingUp} title="Nenhum lançamento encontrado">
              {lista.dados?.length ? 'Ajuste a busca ou o filtro.' : 'Esta empresa ainda não tem lançamentos.'}
            </EmptyState>
          ) : (
            <div className="space-y-4">
              {filtrados.map((l) => {
                const pendente = ['PENDENTE', 'CORRIGIDO'].includes(l.status);
                const aberto = selecionado === l.id && l.documento;
                const totalD = l.itens.filter((i) => i.tipo === 'D').reduce((s, i) => s + i.valor, 0);
                const totalC = l.itens.filter((i) => i.tipo === 'C').reduce((s, i) => s + i.valor, 0);
                const ultimaRevisao = l.revisoes?.at(-1);
                return (
                  <div key={l.id} className={aberto ? 'grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]' : ''}>
                    {/* @container: o layout do cartão segue a largura do próprio cartão
                        (que encolhe quando o painel do documento abre ao lado). */}
                    <article className={`@container overflow-hidden rounded-lg border bg-white ${aberto ? 'border-blue-400 shadow-sm' : 'border-gray-200'}`}>
                      <div className="p-4 sm:p-5">
                        <div className="mb-4 flex flex-col gap-4 @4xl:flex-row @4xl:items-start @4xl:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold text-gray-900">{l.descricao}</h3>
                              <Badge className={STATUS_LANCAMENTO[l.status].cor}>{STATUS_LANCAMENTO[l.status].rotulo}</Badge>
                              <Badge className="bg-purple-100 text-purple-700" icon={l.origem === 'IA' ? Bot : undefined}>{ORIGEM_LANCAMENTO[l.origem]}</Badge>
                              {l.itens.length > 2 && <Badge className="bg-indigo-100 text-indigo-700">Múltiplo</Badge>}
                              {l.exportado && <Badge className="bg-gray-100 text-gray-700">Exportado</Badge>}
                            </div>
                            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-600">
                              <span>{data(l.data)}</span><span aria-hidden="true">•</span>
                              <span className="font-medium text-gray-900">{moeda(l.valorTotal)}</span>
                              {l.documento && <><span aria-hidden="true">•</span><span className="break-all">{l.documento.nome}</span></>}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {pendente && (
                              <>
                                <Button variante="suaveVerde" icon={ThumbsUp} onClick={() => aprovar(l)}>Aprovar</Button>
                                <Button variante="suaveVermelho" icon={ThumbsDown} onClick={() => { setReprovar(l); setMotivo(''); }}>Reprovar</Button>
                                <Button variante="suaveAzul" icon={SquarePen} onClick={() => editar(l)}>Corrigir</Button>
                                <Button variante="suave" icon={Trash2} onClick={() => setExcluir(l)} aria-label={`Excluir ${l.descricao}`} />
                              </>
                            )}
                            {l.documento && (
                              <Button variante="suave" icon={Eye} onClick={() => setSelecionado(aberto ? null : l.id)}>{aberto ? 'Ocultar documento' : 'Documento'}</Button>
                            )}
                          </div>
                        </div>
                        {/* Partidas em lista quando o cartão é estreito (celular) */}
                        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 text-sm @lg:hidden">
                          {l.itens.map((i) => (
                            <li key={i.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                              <span className="min-w-0"><span className="block font-mono text-xs text-gray-500">{i.conta}</span>{i.contaNome}</span>
                              <span className={`shrink-0 text-right font-medium ${i.tipo === 'D' ? 'text-red-600' : 'text-green-600'}`}>
                                <span className="block text-[10px] font-normal uppercase text-gray-500">{i.tipo === 'D' ? 'Débito' : 'Crédito'}</span>{moeda(i.valor)}
                              </span>
                            </li>
                          ))}
                          <li className="flex justify-between bg-gray-50 px-3 py-2 font-medium"><span>Total</span><span>{moeda(totalD)}</span></li>
                        </ul>
                        <div className="hidden overflow-x-auto rounded-lg border border-gray-200 @lg:block">
                          <table className="w-full text-sm">
                            <thead className="border-b border-gray-200 bg-gray-50 text-xs text-gray-600">
                              <tr>
                                <th className="px-4 py-2 text-left font-medium">Conta contábil</th>
                                <th className="px-4 py-2 text-right font-medium">Débito</th>
                                <th className="px-4 py-2 text-right font-medium">Crédito</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {l.itens.map((i) => (
                                <tr key={i.id}>
                                  <td className="px-4 py-2.5 text-gray-900"><span className="font-mono text-xs text-gray-500">{i.conta}</span> {i.contaNome}</td>
                                  <td className="whitespace-nowrap px-4 py-2.5 text-right">
                                    {i.tipo === 'D' ? <span className="inline-flex items-center gap-1 font-medium text-red-600"><TrendingDown className="h-4 w-4" />{moeda(i.valor)}</span> : <span className="text-gray-400">—</span>}
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-2.5 text-right">
                                    {i.tipo === 'C' ? <span className="inline-flex items-center gap-1 font-medium text-green-600"><TrendingUp className="h-4 w-4" />{moeda(i.valor)}</span> : <span className="text-gray-400">—</span>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="border-t border-gray-200 bg-gray-50 font-medium">
                              <tr>
                                <td className="px-4 py-2 text-gray-900">Total</td>
                                <td className="px-4 py-2 text-right text-red-600">{moeda(totalD)}</td>
                                <td className="px-4 py-2 text-right text-green-600">{moeda(totalC)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                          Criado em {dataHora(l.criadoEm)}
                          {l.aprovadoEm && ` • aprovado por ${l.aprovadoPor} em ${dataHora(l.aprovadoEm)}`}
                          {l.motivoReprovacao && ` • ${l.motivoReprovacao}`}
                          {ultimaRevisao?.acao === 'CORRECAO' && ` • corrigido por ${ultimaRevisao.usuario}: ${ultimaRevisao.observacao}`}
                        </p>
                      </div>
                    </article>
                    {aberto && (
                      <PainelDocumento lancamento={l} onAprovar={() => aprovar(l)} onReprovar={() => { setReprovar(l); setMotivo(''); }} onFechar={() => setSelecionado(null)} onAbrirArquivo={abrirDoc} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {lista.dados && filtrados.length > 0 && (
            <p className="mt-4 text-sm text-gray-600">Mostrando {filtrados.length} de {lista.dados.length} lançamento(s)</p>
          )}
        </>
      )}

      <Modal aberto={Boolean(reprovar)} titulo="Reprovar sugestão" onClose={() => setReprovar(null)}
        rodape={<><Button variante="secundario" onClick={() => setReprovar(null)}>Cancelar</Button><Button variante="perigo" onClick={confirmarReprovacao} disabled={motivo.trim().length < 10}>Reprovar</Button></>}>
        <p className="mb-3 text-sm text-gray-600">O lançamento <strong>{reprovar?.descricao}</strong> fica no histórico como reprovado.</p>
        <Campo label="Motivo (mínimo 10 caracteres)">
          <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} className={inputClass} placeholder="Ex.: Valor diverge do comprovante enviado." />
        </Campo>
      </Modal>

      <Modal aberto={Boolean(excluir)} titulo="Excluir lançamento" onClose={() => setExcluir(null)}
        rodape={<><Button variante="secundario" onClick={() => setExcluir(null)}>Cancelar</Button><Button variante="perigo" onClick={confirmarExclusao}>Excluir</Button></>}>
        <p className="text-sm text-gray-600">Excluir <strong>{excluir?.descricao}</strong>? Só lançamentos ainda não aprovados podem ser excluídos.</p>
      </Modal>

      <Modal aberto={Boolean(exportar)} titulo="Exportar lançamentos aprovados (CSV)" onClose={() => setExportar(null)}
        rodape={<><Button variante="secundario" onClick={() => setExportar(null)}>Cancelar</Button><Button icon={Download} onClick={confirmarExportacao}>Exportar</Button></>}>
        <p className="mb-4 text-sm text-gray-600">Saem só lançamentos aprovados do período que ainda não foram exportados, para não duplicar no sistema contábil.</p>
        {exportar && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo label="De"><input type="date" value={exportar.inicio} onChange={(e) => setExportar({ ...exportar, inicio: e.target.value })} className={inputClass} /></Campo>
            <Campo label="Até"><input type="date" value={exportar.fim} onChange={(e) => setExportar({ ...exportar, fim: e.target.value })} className={inputClass} /></Campo>
          </div>
        )}
      </Modal>
    </div>
  );
}
