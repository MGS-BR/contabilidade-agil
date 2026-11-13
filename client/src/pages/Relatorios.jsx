import { useEffect, useMemo, useState } from 'react';
import { Building2, Calendar, ChartColumn, ChartPie, Clock, Eye, FileText, Printer, Receipt, Send, ShieldCheck, TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { cnpj, data, dataHora, fimDoMes, inicioDoMes, moeda } from '../lib/format.js';
import { TIPOS_RELATORIO, nomeRelatorio } from '../lib/dominio.js';
import CompanySelector from '../components/CompanySelector.jsx';
import { Alert, Badge, Button, Campo, Loading, Modal, PageHeader, inputClass } from '../components/ui.jsx';

const ICONES = { BALANCO: ShieldCheck, BALANCETE: ChartColumn, DRE: TrendingUp, RAZAO: FileText, DIARIO: Receipt };

const Num = ({ v, forte }) => <td className={`whitespace-nowrap px-3 py-1.5 text-right tabular-nums ${forte ? 'font-semibold' : ''} ${v < 0 ? 'text-red-600' : ''}`}>{moeda(v)}</td>;
const Th = ({ children, direita }) => <th className={`px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500 ${direita ? 'text-right' : 'text-left'}`}>{children}</th>;

function TabelaContas({ titulo, linhas, total, campo = 'saldo' }) {
  return (
    <div className="mb-6">
      <h4 className="mb-2 font-semibold text-gray-900">{titulo}</h4>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-gray-100">
          {linhas.map((l) => (
            <tr key={l.codigo + l.nome}><td className="px-3 py-1.5 font-mono text-xs text-gray-500">{l.codigo}</td><td className="px-3 py-1.5">{l.nome}</td><Num v={l[campo]} /></tr>
          ))}
          {linhas.length === 0 && <tr><td colSpan={3} className="px-3 py-2 text-gray-500">Sem saldo.</td></tr>}
        </tbody>
        <tfoot className="border-t-2 border-gray-300"><tr><td colSpan={2} className="px-3 py-2 font-semibold">Total</td><Num v={total} forte /></tr></tfoot>
      </table>
    </div>
  );
}

/** Conteúdo calculado pela API para cada tipo de relatório. */
function ConteudoRelatorio({ r }) {
  const c = r.conteudo;
  if (r.tipo === 'BALANCETE') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-gray-300"><tr><Th>Conta</Th><Th direita>Saldo anterior</Th><Th direita>Débitos</Th><Th direita>Créditos</Th><Th direita>Saldo final</Th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {c.linhas.map((l) => (
              <tr key={l.codigo}><td className="px-3 py-1.5"><span className="font-mono text-xs text-gray-500">{l.codigo}</span> {l.nome} <span className="text-xs text-gray-400">({l.natureza})</span></td>
                <Num v={l.saldoAnterior} /><Num v={l.debito} /><Num v={l.credito} /><Num v={l.saldoFinal} forte /></tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-gray-300"><tr><td className="px-3 py-2 font-semibold">Totais do período</td><td /><Num v={c.totais.debito} forte /><Num v={c.totais.credito} forte /><td /></tr></tfoot>
        </table>
        {c.linhas.length === 0 && <p className="p-3 text-sm text-gray-500">Nenhum lançamento aprovado até o fim do período.</p>}
      </div>
    );
  }
  if (r.tipo === 'DRE') {
    return (
      <div>
        <TabelaContas titulo="Receitas" linhas={c.receitas} total={c.totalReceitas} campo="valor" />
        <TabelaContas titulo="(−) Despesas" linhas={c.despesas} total={c.totalDespesas} campo="valor" />
        <div className={`flex justify-between rounded-lg px-3 py-3 font-semibold ${c.resultado < 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-800'}`}>
          <span>{c.resultado < 0 ? 'Prejuízo do período' : 'Lucro do período'}</span><span>{moeda(c.resultado)}</span>
        </div>
      </div>
    );
  }
  if (r.tipo === 'BALANCO') {
    return (
      <div>
        <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-2">
          <TabelaContas titulo="Ativo" linhas={c.ativo} total={c.totalAtivo} />
          <div>
            <TabelaContas titulo="Passivo" linhas={c.passivo} total={c.totalPassivo} />
            <TabelaContas titulo="Patrimônio líquido" linhas={c.patrimonio} total={c.totalPatrimonio} />
          </div>
        </div>
        <p className={`rounded-lg px-3 py-2 text-sm ${c.fechado ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
          Ativo {moeda(c.totalAtivo)} {c.fechado ? '=' : '≠'} Passivo + PL {moeda(c.totalPassivo + c.totalPatrimonio)}
        </p>
      </div>
    );
  }
  if (r.tipo === 'RAZAO') {
    if (!c.contas.length) return <p className="text-sm text-gray-500">Nenhuma conta com movimento aprovado no período.</p>;
    return c.contas.map((conta) => (
      <div key={conta.codigo} className="mb-6 overflow-x-auto break-inside-avoid">
        <h4 className="mb-1 font-semibold text-gray-900"><span className="font-mono text-sm text-gray-500">{conta.codigo}</span> {conta.nome}</h4>
        <table className="w-full min-w-[600px] text-sm">
          <thead className="border-b border-gray-300"><tr><Th>Data</Th><Th>Lanç.</Th><Th>Histórico</Th><Th direita>Débito</Th><Th direita>Crédito</Th><Th direita>Saldo</Th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {conta.movimentos.map((m, i) => (
              <tr key={i} className={m.lancamentoId ? '' : 'bg-gray-50 font-medium'}>
                <td className="whitespace-nowrap px-3 py-1.5">{m.data ? data(m.data) : ''}</td>
                <td className="px-3 py-1.5 text-gray-500">{m.lancamentoId ?? ''}</td>
                <td className="px-3 py-1.5">{m.historico}</td>
                {m.lancamentoId ? <><Num v={m.debito} /><Num v={m.credito} /></> : <><td /><td /></>}
                <Num v={m.saldo} forte />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ));
  }
  // DIÁRIO
  if (!c.lancamentos.length) return <p className="text-sm text-gray-500">Nenhum lançamento aprovado no período.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] text-sm">
        <thead className="border-b border-gray-300"><tr><Th>Data</Th><Th>Nº</Th><Th>Conta / histórico</Th><Th direita>Débito</Th><Th direita>Crédito</Th></tr></thead>
        {c.lancamentos.map((l) => (
          <tbody key={l.id} className="border-b border-gray-200">
            <tr><td className="whitespace-nowrap px-3 pt-2 align-top">{data(l.data)}</td><td className="px-3 pt-2 align-top text-gray-500">{l.id}</td><td colSpan={3} className="px-3 pt-2 font-medium">{l.descricao}</td></tr>
            {l.partidas.map((p, i) => (
              <tr key={i}><td /><td /><td className={`px-3 py-0.5 ${p.tipo === 'C' ? 'pl-8' : ''}`}><span className="font-mono text-xs text-gray-500">{p.conta}</span> {p.nome}</td>
                {p.tipo === 'D' ? <><Num v={p.valor} /><td /></> : <><td /><Num v={p.valor} /></>}</tr>
            ))}
            <tr><td colSpan={5} className="pb-2" /></tr>
          </tbody>
        ))}
        <tfoot className="border-t-2 border-gray-300"><tr><td colSpan={3} className="px-3 py-2 font-semibold">Total movimentado</td><Num v={c.total} forte /><Num v={c.total} forte /></tr></tfoot>
      </table>
    </div>
  );
}

function VisualizadorRelatorio({ id, onClose }) {
  const { dados, erro, carregando } = useApi(id ? `/relatorios/${id}` : null);
  return (
    <Modal aberto={Boolean(id)} titulo={dados ? `${nomeRelatorio(dados.tipo)} — ${dados.empresa}` : 'Relatório'} onClose={onClose} largura="max-w-5xl" className="area-impressao"
      rodape={<><Button variante="secundario" onClick={onClose}>Fechar</Button><Button icon={Printer} onClick={() => window.print()} disabled={!dados}>Imprimir / salvar PDF</Button></>}>
      {erro && <Alert tipo="erro">{erro}</Alert>}
      {carregando && !dados && <Loading texto="Calculando relatório..." />}
      {dados && (
        <div>
          <header className="mb-6 border-b border-gray-200 pb-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Contabilidade Ágil</p>
            <h2 className="text-xl font-semibold text-gray-900">{nomeRelatorio(dados.tipo)}</h2>
            <p className="text-sm text-gray-700">{dados.razaoSocial} · CNPJ {cnpj(dados.cnpj)}</p>
            <p className="text-sm text-gray-600">Período: {data(dados.periodoInicio)} a {data(dados.periodoFim)} · gerado em {dataHora(dados.dataGeracao)} por {dados.geradoPor}</p>
            <p className="mt-1 text-xs text-gray-500">Considera somente lançamentos aprovados pelo contador.</p>
          </header>
          <ConteudoRelatorio r={dados} />
        </div>
      )}
    </Modal>
  );
}

export default function Relatorios() {
  const { user, selectedCompany } = useAuth();
  const cliente = user.tipo === 'CLIENTE';
  const [tipo, setTipo] = useState('BALANCETE');
  const [empresaGerar, setEmpresaGerar] = useState(selectedCompany?.id ? String(selectedCompany.id) : '');
  const [periodo, setPeriodo] = useState({ inicio: inicioDoMes(), fim: fimDoMes() });
  const [filtroEmpresa, setFiltroEmpresa] = useState('all');
  const [aviso, setAviso] = useState(null);
  const [gerando, setGerando] = useState(false);
  const [aberto, setAberto] = useState(null);

  useEffect(() => {
    if (selectedCompany && !empresaGerar) setEmpresaGerar(String(selectedCompany.id));
  }, [selectedCompany, empresaGerar]);

  const caminho = cliente ? (selectedCompany ? `/relatorios?empresa=${selectedCompany.id}` : null) : `/relatorios?empresa=${filtroEmpresa}`;
  const { dados, erro, carregando, recarregar } = useApi(caminho);
  const empresasAtivas = user.empresas.filter((e) => e.status === 'ATIVO');

  const resumo = useMemo(() => {
    const l = dados || [];
    return [
      { rotulo: 'Relatórios gerados', valor: l.length, Icone: FileText, ajuda: 'Controle interno do contador' },
      { rotulo: 'Enviados ao cliente', valor: l.filter((r) => r.enviadoCliente).length, Icone: Send, ajuda: 'Visíveis para a empresa' },
      { rotulo: 'Aguardando envio', valor: l.filter((r) => !r.enviadoCliente).length, Icone: Clock, ajuda: 'Gerados, ainda não liberados' },
      { rotulo: 'Balanços', valor: l.filter((r) => r.tipo === 'BALANCO').length, Icone: ShieldCheck, ajuda: 'Balanço patrimonial' },
    ];
  }, [dados]);

  const gerar = async () => {
    setAviso(null);
    if (!empresaGerar) return setAviso({ tipo: 'aviso', texto: 'Selecione a empresa para gerar o relatório.' });
    if (periodo.inicio > periodo.fim) return setAviso({ tipo: 'aviso', texto: 'A data final precisa ser igual ou posterior à inicial.' });
    setGerando(true);
    try {
      const r = await api('/relatorios', { method: 'POST', body: { empresaId: Number(empresaGerar), tipo, ...periodo } });
      setAviso({ tipo: 'sucesso', texto: `${nomeRelatorio(tipo)} de ${r.empresa} gerado. O cliente só vê depois que você clicar em "Enviar ao cliente".` });
      recarregar();
      setAberto(r.id);
    } catch (err) {
      setAviso({ tipo: 'erro', texto: err.message });
    } finally {
      setGerando(false);
    }
  };

  const enviar = async (r) => {
    try {
      await api(`/relatorios/${r.id}/enviar`, { method: 'POST' });
      setAviso({ tipo: 'sucesso', texto: `${nomeRelatorio(r.tipo)} liberado para ${r.empresa}.` });
      recarregar();
    } catch (err) {
      setAviso({ tipo: 'erro', texto: err.message });
    }
  };

  return (
    <div>
      <PageHeader title="Relatórios Contábeis" description={cliente ? 'Relatórios liberados pelo seu contador' : 'Gere relatórios e escolha quais serão enviados ao cliente'} />
      {cliente && <CompanySelector />}
      {aviso && <Alert tipo={aviso.tipo} className="mb-4" onClose={() => setAviso(null)}>{aviso.texto}</Alert>}

      {!cliente && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {resumo.map(({ rotulo, valor, Icone, ajuda }) => (
              <div key={rotulo} className="rounded-lg border border-gray-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <div><p className="text-sm text-gray-600">{rotulo}</p><p className="mt-1 text-2xl font-semibold text-gray-900">{valor}</p></div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-100 text-blue-600"><Icone className="h-5 w-5" /></div>
                </div>
                <p className="mt-3 text-xs text-gray-500">{ajuda}</p>
              </div>
            ))}
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {TIPOS_RELATORIO.map((t) => {
              const Icone = ICONES[t.id];
              const ativo = tipo === t.id;
              return (
                <button type="button" key={t.id} onClick={() => setTipo(t.id)} aria-pressed={ativo}
                  className={`rounded-lg border-2 p-4 text-left transition-all sm:p-5 ${ativo ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300'}`}>
                  <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-lg ${ativo ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-600'}`}><Icone className="h-6 w-6" /></div>
                  <h3 className={`mb-1 font-semibold ${ativo ? 'text-blue-900' : 'text-gray-900'}`}>{t.nome}</h3>
                  <p className="text-sm text-gray-600">{t.descricao}</p>
                </button>
              );
            })}
          </div>

          <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
            <h3 className="mb-4 font-semibold text-gray-900">Gerar novo relatório</h3>
            <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Campo label="Empresa">
                <span className="relative block">
                  <Building2 className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <select value={empresaGerar} onChange={(e) => setEmpresaGerar(e.target.value)} className={`${inputClass} pl-10`}>
                    <option value="">Selecione uma empresa</option>
                    {empresasAtivas.map((e) => <option value={e.id} key={e.id}>{e.nome}</option>)}
                  </select>
                </span>
              </Campo>
              <Campo label="Tipo de relatório">
                <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputClass}>
                  {TIPOS_RELATORIO.map((t) => <option value={t.id} key={t.id}>{t.nome}</option>)}
                </select>
              </Campo>
              <Campo label="Período inicial">
                <span className="relative block">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input type="date" value={periodo.inicio} onChange={(e) => setPeriodo({ ...periodo, inicio: e.target.value })} className={`${inputClass} pl-10`} />
                </span>
              </Campo>
              <Campo label="Período final">
                <span className="relative block">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input type="date" value={periodo.fim} onChange={(e) => setPeriodo({ ...periodo, fim: e.target.value })} className={`${inputClass} pl-10`} />
                </span>
              </Campo>
            </div>
            <Button icon={ChartColumn} onClick={gerar} carregando={gerando} className="w-full md:w-auto">Gerar relatório</Button>
          </section>
        </>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="font-semibold text-gray-900">{cliente ? 'Relatórios liberados para sua empresa' : 'Relatórios recentes'}</h3>
          {!cliente && (
            <select value={filtroEmpresa} onChange={(e) => setFiltroEmpresa(e.target.value)} className={`${inputClass} sm:w-64`} aria-label="Filtrar por empresa">
              <option value="all">Todas as empresas</option>
              {user.empresas.map((e) => <option value={e.id} key={e.id}>{e.nome}</option>)}
            </select>
          )}
        </div>
        {erro && <Alert tipo="erro">{erro}</Alert>}
        {carregando && !dados ? <Loading /> : (
          <ul className="space-y-3">
            {(dados || []).map((r) => {
              const Icone = ICONES[r.tipo];
              return (
                <li key={r.id} className="flex flex-col gap-4 rounded-lg bg-gray-50 p-4 transition-colors hover:bg-gray-100 md:flex-row md:items-center md:justify-between">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600"><Icone className="h-5 w-5" /></div>
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="font-medium text-gray-900">{nomeRelatorio(r.tipo)}</span>
                        {!cliente && <Badge className="bg-blue-100 text-blue-700">{r.empresa}</Badge>}
                        {!cliente && <Badge className={r.enviadoCliente ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}>{r.enviadoCliente ? 'Enviado ao cliente' : 'Somente contador'}</Badge>}
                      </div>
                      <p className="text-sm text-gray-600">Período: {data(r.periodoInicio)} até {data(r.periodoFim)}</p>
                      <p className="mt-1 text-xs text-gray-500">Gerado em {dataHora(r.dataGeracao)} por {r.geradoPor}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {!cliente && !r.enviadoCliente && <Button variante="sucesso" icon={Send} onClick={() => enviar(r)}>Enviar ao cliente</Button>}
                    <Button icon={Eye} onClick={() => setAberto(r.id)}>Visualizar / PDF</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {dados && dados.length === 0 && (
          <div className="py-12 text-center">
            <ChartPie className="mx-auto mb-4 h-12 w-12 text-gray-400" />
            <h3 className="mb-2 font-medium text-gray-900">Nenhum relatório encontrado</h3>
            <p className="text-sm text-gray-600">{cliente ? 'Ainda não há relatórios liberados para sua empresa.' : 'Ajuste o filtro ou gere um novo relatório.'}</p>
          </div>
        )}
      </section>

      <VisualizadorRelatorio id={aberto} onClose={() => setAberto(null)} />
    </div>
  );
}
