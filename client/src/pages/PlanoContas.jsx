import { useMemo, useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, Plus, Save, Search, SquarePen, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { moeda } from '../lib/format.js';
import { TIPOS_CONTA, montarArvore } from '../lib/dominio.js';
import CompanySelector from '../components/CompanySelector.jsx';
import { Alert, Badge, Button, Campo, EmptyState, Loading, Modal, PageHeader, inputClass } from '../components/ui.jsx';

/** Filtra a árvore mantendo os ancestrais das contas encontradas. */
function filtrar(nos, q) {
  if (!q) return nos;
  return nos.reduce((acc, n) => {
    const sub = filtrar(n.subcontas, q);
    if (n.nome.toLowerCase().includes(q) || n.codigo.startsWith(q) || sub.length) acc.push({ ...n, subcontas: sub });
    return acc;
  }, []);
}

const todosCodigos = (nos) => nos.flatMap((n) => (n.subcontas.length ? [n.codigo, ...todosCodigos(n.subcontas)] : []));

export default function PlanoContas() {
  const { selectedCompany } = useAuth();
  const empresaId = selectedCompany?.id;
  const { dados, erro, carregando, recarregar } = useApi(empresaId ? `/empresas/${empresaId}/contas` : null);
  const [busca, setBusca] = useState('');
  const [abertos, setAbertos] = useState(null); // null = padrão (dois primeiros níveis)
  const [aviso, setAviso] = useState(null);
  const [nova, setNova] = useState(null);
  const [edicao, setEdicao] = useState(null);
  const [excluir, setExcluir] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const arvore = useMemo(() => montarArvore(dados || []), [dados]);
  const q = busca.trim().toLowerCase();
  const visivel = useMemo(() => filtrar(arvore, q), [arvore, q]);
  const padrao = useMemo(() => new Set((dados || []).filter((c) => c.codigo.split('.').length <= 2).map((c) => c.codigo)), [dados]);
  const estaAberto = (codigo) => (q ? true : (abertos ?? padrao).has(codigo));
  const alternar = (codigo) => {
    const s = new Set(abertos ?? padrao);
    if (s.has(codigo)) s.delete(codigo);
    else s.add(codigo);
    setAbertos(s);
  };

  const executar = async (fn, ok) => {
    setSalvando(true);
    try {
      await fn();
      setAviso({ tipo: 'sucesso', texto: ok });
      recarregar();
      return true;
    } catch (err) {
      setAviso({ tipo: 'erro', texto: err.message });
      return false;
    } finally {
      setSalvando(false);
    }
  };

  const criar = async () => {
    const corpo = { codigo: nova.codigo.trim(), nome: nova.nome.trim(), analitica: nova.analitica, tipo: nova.tipo, natureza: nova.natureza };
    if (await executar(() => api(`/empresas/${empresaId}/contas`, { method: 'POST', body: corpo }), `Conta ${corpo.codigo} criada.`)) setNova(null);
  };
  const salvarEdicao = async () => {
    if (await executar(() => api(`/contas/${edicao.id}`, { method: 'PUT', body: { nome: edicao.nome, ativa: edicao.ativa } }), 'Conta atualizada.')) setEdicao(null);
  };
  const confirmarExclusao = async () => {
    await executar(() => api(`/contas/${excluir.id}`, { method: 'DELETE' }), `Conta ${excluir.codigo} excluída.`);
    setExcluir(null);
  };

  const linha = (n, nivel = 0) => {
    const temFilhos = n.subcontas.length > 0;
    const aberto = estaAberto(n.codigo);
    return (
      <div key={n.id}>
        <div className={`flex items-center gap-2 border-b border-gray-100 py-2.5 pr-2 hover:bg-gray-50 sm:pr-3 ${nivel === 0 ? 'bg-gray-50' : ''} ${n.ativa ? '' : 'opacity-60'}`}
          style={{ paddingLeft: `${8 + Math.min(nivel, 4) * 16}px` }}>
          {temFilhos ? (
            <button type="button" onClick={() => alternar(n.codigo)} className="shrink-0 rounded p-1 hover:bg-gray-200" aria-label={`${aberto ? 'Recolher' : 'Expandir'} ${n.nome}`} aria-expanded={aberto}>
              {aberto ? <ChevronDown className="h-4 w-4 text-gray-600" /> : <ChevronRight className="h-4 w-4 text-gray-600" />}
            </button>
          ) : <span className="w-6 shrink-0" />}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className={`font-mono text-sm text-gray-700 ${nivel === 0 ? 'font-semibold' : ''}`}>{n.codigo}</span>
              <span className={`text-gray-900 ${nivel === 0 ? 'font-semibold' : ''}`}>{n.nome}</span>
              <span className="flex flex-wrap gap-1">
                <Badge className={TIPOS_CONTA[n.tipo]}>{n.tipo === 'PATRIMONIO' ? 'PATRIMÔNIO' : n.tipo}</Badge>
                {!n.analitica && <Badge className="bg-gray-100 text-gray-600">Sintética</Badge>}
                {!n.ativa && <Badge className="bg-gray-200 text-gray-700">Inativa</Badge>}
              </span>
            </div>
          </div>
          <span className={`hidden w-32 shrink-0 text-right text-sm sm:block ${n.saldo < 0 ? 'text-red-600' : 'text-gray-700'}`}>{n.saldo === 0 ? '—' : moeda(n.saldo)}</span>
          <div className="flex shrink-0 items-center">
            <button type="button" onClick={() => setEdicao({ ...n })} className="rounded-lg p-2 text-gray-600 hover:bg-blue-50 hover:text-blue-600" title="Editar" aria-label={`Editar ${n.codigo}`}>
              <SquarePen className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setExcluir(n)} disabled={n.temMovimento || n.temSubcontas}
              className="rounded-lg p-2 text-gray-600 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
              title={n.temMovimento ? 'Conta com lançamentos: inative em vez de excluir' : n.temSubcontas ? 'Conta com subcontas' : 'Excluir'} aria-label={`Excluir ${n.codigo}`}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        {temFilhos && aberto && n.subcontas.map((s) => linha(s, nivel + 1))}
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title="Plano de Contas"
        description="Estrutura de contas contábeis específica de cada empresa"
        action={empresaId ? <Button icon={Plus} onClick={() => setNova({ codigo: '', nome: '', analitica: true, tipo: 'ATIVO', natureza: 'D' })}>Nova conta</Button> : null}
      />
      <CompanySelector />
      {!empresaId ? (
        <EmptyState icon={BookOpen} title="Selecione uma empresa">Cada empresa tem seu próprio plano de contas. Selecione uma empresa acima.</EmptyState>
      ) : (
        <>
          {aviso && <Alert tipo={aviso.tipo} className="mb-4" onClose={() => setAviso(null)}>{aviso.texto}</Alert>}
          {nova && (
            <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
              <h3 className="mb-1 font-semibold text-gray-900">Nova conta</h3>
              <p className="mb-4 text-sm text-gray-600">A conta superior é deduzida do código (ex.: 3.1.01.007 fica dentro de 3.1.01) e passa o tipo e a natureza.</p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[180px_1fr_auto] md:items-end">
                <Campo label="Código"><input value={nova.codigo} onChange={(e) => setNova({ ...nova, codigo: e.target.value })} placeholder="3.1.01.007" className={`${inputClass} font-mono`} /></Campo>
                <Campo label="Nome"><input value={nova.nome} onChange={(e) => setNova({ ...nova, nome: e.target.value })} placeholder="Ex.: Seguros" className={inputClass} /></Campo>
                <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
                  <input type="checkbox" checked={nova.analitica} onChange={(e) => setNova({ ...nova, analitica: e.target.checked })} className="rounded border-gray-300" />
                  Analítica (recebe lançamentos)
                </label>
                {nova.codigo && !nova.codigo.includes('.') && (
                  <>
                    <Campo label="Tipo (grupo de primeiro nível)">
                      <select value={nova.tipo} onChange={(e) => setNova({ ...nova, tipo: e.target.value })} className={inputClass}>
                        {Object.keys(TIPOS_CONTA).map((t) => <option key={t}>{t}</option>)}
                      </select>
                    </Campo>
                    <Campo label="Natureza">
                      <select value={nova.natureza} onChange={(e) => setNova({ ...nova, natureza: e.target.value })} className={inputClass}>
                        <option value="D">Devedora</option>
                        <option value="C">Credora</option>
                      </select>
                    </Campo>
                  </>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button icon={Save} onClick={criar} carregando={salvando}>Criar conta</Button>
                <Button variante="secundario" onClick={() => setNova(null)}>Cancelar</Button>
              </div>
            </section>
          )}

          <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input type="search" placeholder="Buscar por código ou nome da conta..." value={busca} onChange={(e) => setBusca(e.target.value)} className={`${inputClass} pl-10`} aria-label="Buscar contas" />
            </div>
          </div>

          {erro && <Alert tipo="erro" className="mb-4">{erro}</Alert>}
          {carregando && !dados ? (
            <Loading />
          ) : visivel.length === 0 ? (
            <EmptyState icon={Search} title="Nenhuma conta encontrada">Tente ajustar a busca.</EmptyState>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 p-3 sm:p-4">
                <div className="flex gap-4">
                  <button type="button" onClick={() => setAbertos(new Set(todosCodigos(arvore)))} className="text-sm text-blue-600 hover:text-blue-700">Expandir tudo</button>
                  <button type="button" onClick={() => setAbertos(new Set())} className="text-sm text-blue-600 hover:text-blue-700">Recolher tudo</button>
                </div>
                <span className="hidden text-xs font-medium uppercase tracking-wide text-gray-500 sm:block sm:pr-24">Saldo (aprovados)</span>
              </div>
              <div>{visivel.map((n) => linha(n))}</div>
            </div>
          )}
          {dados && <p className="mt-4 text-sm text-gray-600">{dados.length} contas · {dados.filter((c) => c.analitica).length} analíticas</p>}
        </>
      )}

      <Modal aberto={Boolean(edicao)} titulo={`Editar conta ${edicao?.codigo || ''}`} onClose={() => setEdicao(null)}
        rodape={<><Button variante="secundario" onClick={() => setEdicao(null)}>Cancelar</Button><Button icon={Save} onClick={salvarEdicao} carregando={salvando}>Salvar</Button></>}>
        {edicao && (
          <div className="space-y-4">
            <Campo label="Nome"><input value={edicao.nome} onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })} className={inputClass} /></Campo>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={edicao.ativa} onChange={(e) => setEdicao({ ...edicao, ativa: e.target.checked })} className="rounded border-gray-300" />
              Conta ativa (desmarque para impedir novos lançamentos nela)
            </label>
            <p className="text-xs text-gray-500">O código não muda: ele identifica a conta nos relatórios e nas exportações.</p>
          </div>
        )}
      </Modal>

      <Modal aberto={Boolean(excluir)} titulo="Excluir conta" onClose={() => setExcluir(null)}
        rodape={<><Button variante="secundario" onClick={() => setExcluir(null)}>Cancelar</Button><Button variante="perigo" onClick={confirmarExclusao} carregando={salvando}>Excluir</Button></>}>
        <p className="text-sm text-gray-600">Excluir a conta <strong>{excluir?.codigo} — {excluir?.nome}</strong>?</p>
      </Modal>
    </div>
  );
}
