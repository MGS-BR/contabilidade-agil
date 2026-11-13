import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, CircleCheckBig, Clock, DollarSign, FileText, Info, Scale, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useApi } from '../lib/hooks.js';
import { dataHora, fimDoMes, mesCurto, mesesAtras, moeda, moedaCurta, numero, percentual } from '../lib/format.js';
import { STATUS_DOCUMENTO, rotuloTipoDocumento } from '../lib/dominio.js';
import CompanySelector from '../components/CompanySelector.jsx';
import { Alert, Badge, EmptyState, Loading, PageHeader, inputClass } from '../components/ui.jsx';

const CORES_DESPESA = ['#0284c7', '#16a34a', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#64748b'];

/** Meio-círculo da margem de lucro (0% a 100%). */
function Gauge({ valor }) {
  const v = valor === null ? 0 : Math.max(0, Math.min(1, valor));
  const comprimento = Math.PI * 80;
  return (
    <svg viewBox="0 0 200 110" className="mx-auto w-full max-w-[220px]" role="img" aria-label={`Margem de lucro ${percentual(valor)}`}>
      <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#e2e8f0" strokeWidth="18" strokeLinecap="round" />
      <path
        d="M20 100 A80 80 0 0 1 180 100"
        fill="none"
        stroke={valor !== null && valor < 0 ? '#ef4444' : '#0284c7'}
        strokeWidth="18"
        strokeLinecap="round"
        strokeDasharray={`${comprimento * v} ${comprimento}`}
      />
    </svg>
  );
}

/** Barras de receita e despesa por mês, com o lucro em linha de pontos. */
function GraficoResultados({ meses }) {
  const max = Math.max(1, ...meses.flatMap((m) => [m.receita, m.despesa]));
  const semDados = meses.every((m) => m.receita === 0 && m.despesa === 0);
  const rolagem = useRef(null);
  // Em telas estreitas o gráfico rola: começa mostrando os meses mais recentes.
  useEffect(() => {
    if (rolagem.current) rolagem.current.scrollLeft = rolagem.current.scrollWidth;
  }, [meses]);
  return (
    <div>
      {semDados && <p className="mb-2 text-sm text-slate-500">Nenhum lançamento aprovado no período.</p>}
      <div ref={rolagem} className="overflow-x-auto pb-1">
        <div className="flex h-48 items-end gap-2 border-b border-slate-200" style={{ minWidth: `${meses.length * 44}px` }}>
          {meses.map((m) => (
            <div key={m.mes} className="flex h-full flex-1 flex-col items-center justify-end" title={`${mesCurto(m.mes)} — Receita ${moeda(m.receita)} · Despesa ${moeda(m.despesa)} · Lucro ${moeda(m.lucro)}`}>
              <div className="flex h-[85%] items-end gap-1">
                <span className="w-3 rounded-t bg-lime-400" style={{ height: `${(m.receita / max) * 100}%` }} />
                <span className="w-3 rounded-t bg-sky-600" style={{ height: `${(m.despesa / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-2" style={{ minWidth: `${meses.length * 44}px` }}>
          {meses.map((m) => (
            <div key={m.mes} className="flex-1 text-center">
              <p className="text-[10px] text-slate-500">{mesCurto(m.mes)}</p>
              <p className={`text-[10px] font-medium ${m.lucro < 0 ? 'text-red-600' : 'text-amber-600'}`}>{m.lucro === 0 ? '·' : moedaCurta(m.lucro).replace('R$ ', '')}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-lime-400" />Receita</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-sky-600" />Despesa</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-amber-500" />Lucro do mês</span>
      </div>
    </div>
  );
}

function Rosca({ partes, total }) {
  let acumulado = 0;
  const r = 60;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 160 160" className="mx-auto h-44 w-44" role="img" aria-label={`Total de despesas ${moeda(total)}`}>
      <circle cx="80" cy="80" r={r} fill="none" stroke="#f1f5f9" strokeWidth="22" />
      {total > 0 &&
        partes.map((p, i) => {
          const frac = p.valor / total;
          const el = (
            <circle key={p.codigo} cx="80" cy="80" r={r} fill="none" stroke={CORES_DESPESA[i % CORES_DESPESA.length]} strokeWidth="22"
              strokeDasharray={`${c * frac} ${c}`} strokeDashoffset={-c * acumulado} transform="rotate(-90 80 80)" />
          );
          acumulado += frac;
          return el;
        })}
      <text x="80" y="76" textAnchor="middle" className="fill-slate-500 text-[11px]">Total</text>
      <text x="80" y="94" textAnchor="middle" className="fill-slate-900 text-[13px] font-semibold">{moedaCurta(total)}</text>
    </svg>
  );
}

function Indicador({ title, value, icon: Icon, ajuda }) {
  return (
    <div className="min-h-[96px] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        <span title={ajuda} className="shrink-0 cursor-help"><Info className="h-4 w-4 text-sky-600" /></span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-2xl font-semibold text-slate-900">{value}</p>
        <Icon className="h-7 w-7 shrink-0 text-sky-500" />
      </div>
    </div>
  );
}

const PERIODOS = { '3m': 2, '6m': 5, '12m': 11 };

export default function DashboardCliente() {
  const { selectedCompany } = useAuth();
  const [periodo, setPeriodo] = useState('12m');
  const [custom, setCustom] = useState({ inicio: mesesAtras(11), fim: fimDoMes() });

  const intervalo = useMemo(
    () => (periodo === 'custom' ? custom : { inicio: mesesAtras(PERIODOS[periodo]), fim: fimDoMes() }),
    [periodo, custom],
  );
  const valido = intervalo.inicio && intervalo.fim && intervalo.inicio <= intervalo.fim;
  const caminho = selectedCompany && valido ? `/dashboard/cliente?empresa=${selectedCompany.id}&inicio=${intervalo.inicio}&fim=${intervalo.fim}` : null;
  const { dados, erro, carregando } = useApi(caminho);

  const lancados = dados?.documentos.filter((d) => d.dataLancamento).length ?? 0;
  const totalDespesas = dados?.despesas.reduce((s, d) => s + d.valor, 0) ?? 0;
  const ind = dados?.indicadores;

  return (
    <div>
      <PageHeader title="Painel da Empresa" description="Acompanhe seus indicadores financeiros, documentos e lançamentos" />
      <CompanySelector />
      {!selectedCompany ? (
        <EmptyState icon={FileText} title="Selecione uma empresa" />
      ) : (
        <>
          <section className="mb-8 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm sm:rounded-3xl sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Geral</h2>
                <div className="mt-2 h-1 w-12 rounded-full bg-sky-600" />
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
                Somente lançamentos aprovados pelo contador
              </span>
            </div>

            <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h3 className="font-semibold text-slate-800">Filtros dos gráficos</h3>
                  <p className="text-sm text-slate-500">Altere o período dos indicadores financeiros exibidos.</p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:min-w-[560px]">
                  <label>
                    <span className="mb-1 block text-xs font-medium text-slate-600">Período</span>
                    <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className={inputClass}>
                      <option value="3m">Últimos 3 meses</option>
                      <option value="6m">Últimos 6 meses</option>
                      <option value="12m">Últimos 12 meses</option>
                      <option value="custom">Personalizado</option>
                    </select>
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-medium text-slate-600">Data inicial</span>
                    <input type="date" value={intervalo.inicio} disabled={periodo !== 'custom'} onChange={(e) => setCustom((c) => ({ ...c, inicio: e.target.value }))} className={inputClass} />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-medium text-slate-600">Data final</span>
                    <input type="date" value={intervalo.fim} disabled={periodo !== 'custom'} onChange={(e) => setCustom((c) => ({ ...c, fim: e.target.value }))} className={inputClass} />
                  </label>
                </div>
              </div>
              {!valido && <Alert tipo="aviso" className="mt-3">A data final precisa ser igual ou posterior à inicial.</Alert>}
            </div>

            {erro && <Alert tipo="erro" className="mb-4">{erro}</Alert>}
            {carregando && !dados && <Loading />}
            {dados && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-3">
                  <h3 className="mb-3 font-semibold text-slate-800">Lucratividade</h3>
                  <Gauge valor={ind.margem} />
                  <div className="mt-1 text-center">
                    <p className="text-3xl font-semibold text-slate-900">{percentual(ind.margem)}</p>
                    <p className="text-sm text-slate-600">Margem líquida</p>
                    <p className={`mt-1 text-lg font-semibold ${dados.totais.lucro < 0 ? 'text-red-600' : 'text-slate-800'}`}>{moeda(dados.totais.lucro)}</p>
                    <p className="text-xs text-slate-500">Receita {moedaCurta(dados.totais.receita)} · Despesa {moedaCurta(dados.totais.despesa)}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-2 xl:col-span-9">
                  <h3 className="mb-4 font-semibold text-slate-800">Análise de resultados</h3>
                  <GraficoResultados meses={dados.meses} />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:col-span-2 lg:grid-cols-3 xl:col-span-12">
                  <Indicador title="Liquidez imediata" value={numero(ind.liquidezImediata)} icon={Activity} ajuda="Disponibilidades ÷ passivo circulante, na data final" />
                  <Indicador title="Margem líquida" value={percentual(ind.margem)} icon={TrendingUp} ajuda="Lucro ÷ receita do período" />
                  <Indicador title="ROA" value={percentual(ind.roa)} icon={Scale} ajuda="Lucro do período ÷ ativo total" />
                  <Indicador title="Endividamento" value={numero(ind.endividamento)} icon={TrendingDown} ajuda="Passivo exigível ÷ ativo total" />
                  <Indicador title="Variação de caixa" value={moedaCurta(ind.variacaoCaixa)} icon={DollarSign} ajuda="Disponibilidades no fim − no início do período" />
                  <Indicador title="Caixa e bancos" value={moedaCurta(ind.caixaFinal)} icon={Wallet} ajuda="Saldo das disponibilidades na data final" />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-7">
                  <h3 className="mb-5 font-semibold text-slate-800">Comparação das despesas</h3>
                  {dados.despesas.length === 0 ? (
                    <p className="text-sm text-slate-500">Sem despesas aprovadas no período.</p>
                  ) : (
                    <ul className="space-y-3">
                      {dados.despesas.map((d, i) => {
                        const pct = totalDespesas ? d.valor / totalDespesas : 0;
                        return (
                          <li key={d.codigo} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,180px)_1fr_56px]">
                            <span className="truncate text-sm font-medium text-slate-700">{d.nome}</span>
                            <span className="text-right text-sm text-slate-500 sm:order-last">{percentual(pct, 0)}</span>
                            <span className="col-span-2 h-2 rounded-full bg-slate-100 sm:col-span-1">
                              <span className="block h-2 rounded-full" style={{ width: `${pct * 100}%`, background: CORES_DESPESA[i % CORES_DESPESA.length] }} />
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-5">
                  <h3 className="mb-3 font-semibold text-slate-800">Composição das despesas</h3>
                  <Rosca partes={dados.despesas} total={totalDespesas} />
                  <ul className="mt-3 space-y-1 text-xs text-slate-600">
                    {dados.despesas.map((d, i) => (
                      <li key={d.codigo} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CORES_DESPESA[i % CORES_DESPESA.length] }} />
                        <span className="min-w-0 flex-1 truncate">{d.nome}</span>
                        <span className="shrink-0 font-medium">{moeda(d.valor)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </section>

          {dados && (
            <>
              <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
                {[
                  { rotulo: 'Total de documentos', valor: dados.documentos.length, Icone: FileText, cor: 'bg-blue-100 text-blue-600' },
                  { rotulo: 'Documentos lançados', valor: lancados, Icone: CircleCheckBig, cor: 'bg-green-100 text-green-600' },
                  { rotulo: 'Aguardando lançamento', valor: dados.documentos.length - lancados, Icone: Clock, cor: 'bg-yellow-100 text-yellow-600' },
                ].map(({ rotulo, valor, Icone, cor }) => (
                  <div key={rotulo} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-5">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${cor}`}><Icone className="h-6 w-6" /></div>
                    <div>
                      <p className="text-sm text-gray-600">{rotulo}</p>
                      <p className="text-2xl font-semibold text-gray-900">{valor}</p>
                    </div>
                  </div>
                ))}
              </div>

              <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <div className="border-b border-gray-200 p-4 sm:p-6">
                  <h3 className="font-semibold text-gray-900">Status dos documentos enviados</h3>
                  <p className="mt-1 text-sm text-gray-600">Acompanhe se seus documentos já foram processados e lançados pelo contador (últimos 20).</p>
                </div>
                {dados.documentos.length === 0 ? (
                  <p className="p-6 text-sm text-gray-600">Nenhum documento enviado ainda.</p>
                ) : (
                  <ul className="divide-y divide-gray-200">
                    {dados.documentos.map((d) => (
                      <li key={d.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <FileText className="h-5 w-5 shrink-0 text-gray-400" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-gray-900">{d.nomeArquivo}</p>
                            <p className="text-sm text-gray-500">{rotuloTipoDocumento(d.tipo)} · enviado em {dataHora(d.dataEnvio)}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pl-8 sm:pl-0">
                          {d.dataLancamento ? (
                            <Badge className="bg-green-100 text-green-700" icon={CircleCheckBig}>Lançado em {dataHora(d.dataLancamento).slice(0, 10)}</Badge>
                          ) : (
                            <Badge className={STATUS_DOCUMENTO[d.status].cor} icon={Clock}>{STATUS_DOCUMENTO[d.status].rotulo}</Badge>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
