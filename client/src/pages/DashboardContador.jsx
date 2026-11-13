import { Bot, CircleCheckBig, Clock, FileText, Newspaper, TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useApi } from '../lib/hooks.js';
import { data, dataHora, moeda, numero } from '../lib/format.js';
import { STATUS_DOCUMENTO, STATUS_LANCAMENTO } from '../lib/dominio.js';
import { Alert, Badge, Loading, PageHeader, StatCard } from '../components/ui.jsx';

const AVISOS = [
  { id: 1, titulo: 'Agenda tributária do mês', fonte: 'Receita Federal', tag: 'Fiscal', resumo: 'Conferir vencimentos de obrigações principais e acessórias dos clientes.' },
  { id: 2, titulo: 'Envio de documentos para fechamento', fonte: 'Rotina do escritório', tag: 'Operacional', resumo: 'Priorizar empresas com documentos pendentes antes do fechamento mensal.' },
  { id: 3, titulo: 'Acompanhamento de regimes tributários', fonte: 'Planejamento contábil', tag: 'Tributário', resumo: 'Revisar enquadramento de Simples Nacional, Lucro Presumido e Lucro Real.' },
];

export default function DashboardContador({ onNavegar }) {
  const { setEmpresaId } = useAuth();
  const { dados, erro, carregando } = useApi('/dashboard/contador');

  const abrir = (empresaId, pagina) => {
    setEmpresaId(empresaId);
    onNavegar(pagina);
  };

  return (
    <div>
      <PageHeader title="Dashboard" description="Visão geral da carteira de empresas" />
      {erro && <Alert tipo="erro" className="mb-6">{erro}</Alert>}
      {carregando && !dados && <Loading />}
      {dados && (
        <>
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
            <StatCard title="Documentos pendentes" value={dados.documentosPendentes} icon={FileText} color="blue" helper="Aguardando análise ou aprovação" />
            <StatCard title="Lançamentos a revisar" value={dados.lancamentosPendentes} icon={TrendingUp} color="yellow" helper="Sugestões pendentes ou corrigidas" />
            <StatCard title="Aprovados no mês" value={dados.aprovadosNoMes} icon={CircleCheckBig} color="green" helper="Lançamentos aprovados desde o dia 1º" />
            <StatCard title="Análises com IA" value={dados.analisesIA} icon={Bot} color="purple" helper="Documentos lidos por OCR/IA" />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">Documentos recentes</h3>
              <ul className="space-y-3">
                {dados.documentosRecentes.map((d) => (
                  <li key={d.id}>
                    <button type="button" onClick={() => abrir(d.empresaId, 'documentos')} className="flex w-full items-start gap-3 rounded-lg bg-gray-50 p-3 text-left hover:bg-gray-100">
                      <FileText className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-gray-900">{d.nome}</span>
                        <span className="block truncate text-sm text-gray-500">{d.empresa}</span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <Badge className={STATUS_DOCUMENTO[d.status].cor}>{STATUS_DOCUMENTO[d.status].rotulo}</Badge>
                        <span className="text-xs text-gray-500">{dataHora(d.data).slice(0, 10)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => onNavegar('documentos')} className="mt-4 w-full py-2 text-sm font-medium text-blue-600 hover:text-blue-700">
                Ver todos os documentos
              </button>
            </section>

            <section className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">Lançamentos recentes</h3>
              <ul className="space-y-3">
                {dados.lancamentosRecentes.map((l) => (
                  <li key={l.id}>
                    <button type="button" onClick={() => abrir(l.empresaId, 'lancamentos')} className="flex w-full items-start gap-3 rounded-lg bg-gray-50 p-3 text-left hover:bg-gray-100">
                      <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-gray-900">{l.descricao}</span>
                        <span className="block truncate text-sm text-gray-500">{l.empresa} · {data(l.data)}</span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className="font-medium text-gray-900">{moeda(l.valor)}</span>
                        <Badge className={STATUS_LANCAMENTO[l.status].cor}>{STATUS_LANCAMENTO[l.status].rotulo}</Badge>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => onNavegar('lancamentos')} className="mt-4 w-full py-2 text-sm font-medium text-blue-600 hover:text-blue-700">
                Ver todos os lançamentos
              </button>
            </section>
          </div>

          <section className="mt-6 rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-gray-900">Pendências por empresa</h3>
              <p className="mt-1 text-sm text-gray-600">Tempo médio de revisão e taxa de acerto das sugestões da IA (lançamentos aprovados sem correção).</p>
            </div>
            {dados.painel.length === 0 ? (
              <p className="p-6 text-sm text-gray-600">Nenhuma empresa ativa na carteira.</p>
            ) : (
              <>
                {/* Tabela em telas médias ou maiores */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                      <tr>
                        <th className="px-6 py-3 font-medium">Empresa</th>
                        <th className="px-4 py-3 text-right font-medium">A revisar</th>
                        <th className="px-4 py-3 text-right font-medium">Em processamento</th>
                        <th className="px-4 py-3 text-right font-medium">Falhas</th>
                        <th className="px-4 py-3 text-right font-medium">Tempo médio</th>
                        <th className="px-6 py-3 text-right font-medium">Acerto da IA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {dados.painel.map((p) => (
                        <tr key={p.empresaId} onClick={() => abrir(p.empresaId, 'lancamentos')} className="cursor-pointer hover:bg-gray-50">
                          <td className="px-6 py-3 font-medium text-gray-900">{p.empresa}</td>
                          <td className="px-4 py-3 text-right">{p.pendentes > 0 ? <Badge className="bg-yellow-100 text-yellow-800">{p.pendentes}</Badge> : 0}</td>
                          <td className="px-4 py-3 text-right">{p.emProcessamento}</td>
                          <td className="px-4 py-3 text-right">{p.falhas > 0 ? <Badge className="bg-orange-100 text-orange-800">{p.falhas}</Badge> : 0}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{p.tempoMedioH === null ? '—' : `${numero(p.tempoMedioH, 1)} h`}</td>
                          <td className="px-6 py-3 text-right text-gray-600">{p.acertoIA === null ? '—' : `${numero(p.acertoIA, 0)}%`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Cartões no celular */}
                <ul className="divide-y divide-gray-200 md:hidden">
                  {dados.painel.map((p) => (
                    <li key={p.empresaId}>
                      <button type="button" onClick={() => abrir(p.empresaId, 'lancamentos')} className="w-full p-4 text-left hover:bg-gray-50">
                        <span className="block font-medium text-gray-900">{p.empresa}</span>
                        <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                          <span>A revisar: <strong>{p.pendentes}</strong></span>
                          <span>Em processamento: {p.emProcessamento}</span>
                          <span>Falhas: {p.falhas}</span>
                          <span>Tempo médio: {p.tempoMedioH === null ? '—' : `${numero(p.tempoMedioH, 1)} h`}</span>
                          <span>Acerto IA: {p.acertoIA === null ? '—' : `${numero(p.acertoIA, 0)}%`}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="mt-6 rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Newspaper className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Lembretes para o escritório</h3>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">Painel informativo</span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {AVISOS.map((a) => (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4" key={a.id}>
                  <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-blue-700">{a.tag}</span>
                  <h4 className="mt-2 font-semibold text-gray-900">{a.titulo}</h4>
                  <p className="mt-1 text-xs text-gray-500">{a.fonte}</p>
                  <p className="mt-3 text-sm text-gray-600">{a.resumo}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="mt-6 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
            <div>
              <h4 className="font-medium text-blue-900">Fila de processamento</h4>
              <p className="mt-1 text-sm text-blue-700">
                {dados.aguardandoIA > 0
                  ? `${dados.aguardandoIA} documento(s) aguardando leitura por OCR/IA.`
                  : 'Nenhum documento aguardando leitura por OCR/IA no momento.'}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
