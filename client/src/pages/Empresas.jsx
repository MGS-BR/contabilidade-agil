import { useMemo, useState } from 'react';
import { BadgeCheck, Building2, Eye, FileText, KeyRound, Mail, MapPin, Phone, Plus, Power, Save, Search, SquarePen, TrendingUp, User, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { cep, cnae, cnpj, dataHora } from '../lib/format.js';
import { REGIMES, UFS, rotuloRegime } from '../lib/dominio.js';
import { Alert, Badge, Button, Campo, EmptyState, Loading, Modal, PageHeader, inputClass } from '../components/ui.jsx';

const VAZIO = {
  id: null, razaoSocial: '', nomeFantasia: '', cnpj: '', inscricaoEstadual: '', inscricaoMunicipal: '',
  regimeTributario: 'SIMPLES_NACIONAL', cnae: '', email: '', telefone: '', responsavel: '',
  logradouro: '', cidade: '', uf: 'SP', cep: '', acessoNome: '', acessoEmail: '', acessoSenha: '',
};

function FormEmpresa({ inicial, onSalvo, onCancelar }) {
  const [f, setF] = useState(inicial);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const set = (campo) => (e) => setF((x) => ({ ...x, [campo]: e.target.value }));

  const salvar = async () => {
    setErro('');
    setSalvando(true);
    try {
      const r = await api(f.id ? `/empresas/${f.id}` : '/empresas', { method: f.id ? 'PUT' : 'POST', body: f });
      onSalvo(r, Boolean(f.id));
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-gray-900">{f.id ? `Editar ${f.nomeFantasia || f.razaoSocial}` : 'Cadastrar cliente/empresa'}</h3>
          <p className="mt-1 text-sm text-gray-600">Dados fiscais, contato e endereço. Campos com * são obrigatórios.</p>
        </div>
        <button type="button" onClick={onCancelar} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Fechar formulário"><X className="h-5 w-5" /></button>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Campo label="Razão social *" className="xl:col-span-2"><input value={f.razaoSocial} onChange={set('razaoSocial')} placeholder="Ex.: Empresa ABC Ltda" className={inputClass} /></Campo>
        <Campo label="Nome fantasia"><input value={f.nomeFantasia} onChange={set('nomeFantasia')} placeholder="Ex.: ABC Comércio" className={inputClass} /></Campo>
        <Campo label="CNPJ *" dica="Os dígitos verificadores são conferidos pelo banco.">
          <input value={cnpj(f.cnpj)} onChange={(e) => setF((x) => ({ ...x, cnpj: e.target.value.replace(/\D/g, '') }))} inputMode="numeric" placeholder="00.000.000/0000-00" className={inputClass} />
        </Campo>
        <Campo label="Inscrição estadual"><input value={f.inscricaoEstadual} onChange={set('inscricaoEstadual')} placeholder="Número ou Isento" className={inputClass} /></Campo>
        <Campo label="Inscrição municipal"><input value={f.inscricaoMunicipal} onChange={set('inscricaoMunicipal')} className={inputClass} /></Campo>
        <Campo label="Regime tributário *">
          <select value={f.regimeTributario} onChange={set('regimeTributario')} className={inputClass}>
            {REGIMES.map((r) => <option key={r.valor} value={r.valor}>{r.rotulo}</option>)}
          </select>
        </Campo>
        <Campo label="CNAE principal"><input value={cnae(f.cnae)} onChange={(e) => setF((x) => ({ ...x, cnae: e.target.value.replace(/\D/g, '') }))} inputMode="numeric" placeholder="00.00-0-00" className={inputClass} /></Campo>
        <Campo label="Responsável"><input value={f.responsavel} onChange={set('responsavel')} className={inputClass} /></Campo>
        <Campo label="E-mail *"><input type="email" value={f.email} onChange={set('email')} placeholder="empresa@email.com.br" className={inputClass} /></Campo>
        <Campo label="Telefone"><input value={f.telefone} onChange={set('telefone')} inputMode="tel" placeholder="(15) 00000-0000" className={inputClass} /></Campo>
        <Campo label="Endereço" className="xl:col-span-2"><input value={f.logradouro} onChange={set('logradouro')} placeholder="Rua, número e complemento" className={inputClass} /></Campo>
        <Campo label="Cidade"><input value={f.cidade} onChange={set('cidade')} className={inputClass} /></Campo>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="UF *">
            <select value={f.uf} onChange={set('uf')} className={inputClass}>{UFS.map((u) => <option key={u}>{u}</option>)}</select>
          </Campo>
          <Campo label="CEP"><input value={cep(f.cep)} onChange={(e) => setF((x) => ({ ...x, cep: e.target.value.replace(/\D/g, '') }))} inputMode="numeric" placeholder="00000-000" className={inputClass} /></Campo>
        </div>
      </div>

      {!f.id && (
        <fieldset className="mt-6 rounded-lg border border-dashed border-gray-300 p-4">
          <legend className="flex items-center gap-2 px-2 text-sm font-medium text-gray-700"><KeyRound className="h-4 w-4" /> Acesso do cliente (opcional)</legend>
          <p className="mb-3 text-xs text-gray-500">Cria o login que a empresa usa para enviar documentos e ver relatórios.</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Campo label="Nome"><input value={f.acessoNome} onChange={set('acessoNome')} className={inputClass} /></Campo>
            <Campo label="E-mail de login"><input type="email" value={f.acessoEmail} onChange={set('acessoEmail')} className={inputClass} autoComplete="off" /></Campo>
            <Campo label="Senha inicial (mín. 6)"><input type="password" value={f.acessoSenha} onChange={set('acessoSenha')} className={inputClass} autoComplete="new-password" /></Campo>
          </div>
        </fieldset>
      )}

      <Alert tipo="erro" className="mt-4">{erro}</Alert>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button icon={Save} onClick={salvar} carregando={salvando}>Salvar cadastro</Button>
        <Button variante="secundario" onClick={onCancelar}>Cancelar</Button>
      </div>
    </section>
  );
}

export default function Empresas({ onNavegar }) {
  const { atualizarUsuario, setEmpresaId } = useAuth();
  const { dados, erro, carregando, recarregar } = useApi('/empresas');
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState(null);
  const [detalhe, setDetalhe] = useState(null);
  const [aviso, setAviso] = useState(null);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const digitos = q.replace(/\D/g, '');
    return (dados || []).filter((e) => !q ||
      e.razaoSocial.toLowerCase().includes(q) || (e.nomeFantasia || '').toLowerCase().includes(q) ||
      (e.responsavel || '').toLowerCase().includes(q) || (digitos && e.cnpj.includes(digitos)));
  }, [dados, busca]);

  const salvo = async (empresa, edicao) => {
    setForm(null);
    setAviso({ tipo: 'sucesso', texto: edicao ? 'Cadastro atualizado.' : `${empresa.razaoSocial} cadastrada com o plano de contas padrão.` });
    await Promise.all([recarregar(), atualizarUsuario()]);
  };

  const alternarStatus = async (e) => {
    const status = e.status === 'ATIVO' ? 'INATIVO' : 'ATIVO';
    try {
      await api(`/empresas/${e.id}/status`, { method: 'PATCH', body: { status } });
      setAviso({ tipo: 'sucesso', texto: `${e.nomeFantasia || e.razaoSocial} ${status === 'ATIVO' ? 'reativada' : 'inativada. O histórico continua guardado'}.` });
      setDetalhe(null);
      await Promise.all([recarregar(), atualizarUsuario()]);
    } catch (err) {
      setAviso({ tipo: 'erro', texto: err.message });
    }
  };

  const abrirEm = (e, pagina) => {
    setEmpresaId(e.id);
    onNavegar(pagina);
  };

  const editar = (e) => {
    setForm({ ...VAZIO, ...Object.fromEntries(Object.entries(e).map(([k, v]) => [k, v ?? ''])) });
    setDetalhe(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div>
      <PageHeader
        title="Clientes / Empresas"
        description="Cadastro e gerenciamento das empresas atendidas pelo escritório"
        action={<Button icon={Plus} onClick={() => setForm({ ...VAZIO })}>Nova empresa</Button>}
      />
      {aviso && <Alert tipo={aviso.tipo} className="mb-4" onClose={() => setAviso(null)}>{aviso.texto}</Alert>}
      {form && <FormEmpresa key={form.id || 'nova'} inicial={form} onSalvo={salvo} onCancelar={() => setForm(null)} />}

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input type="search" placeholder="Buscar por razão social, nome fantasia, responsável ou CNPJ..." value={busca} onChange={(e) => setBusca(e.target.value)} className={`${inputClass} pl-10`} aria-label="Buscar empresas" />
        </div>
      </div>

      {erro && <Alert tipo="erro" className="mb-4">{erro}</Alert>}
      {carregando && !dados ? (
        <Loading />
      ) : filtradas.length === 0 ? (
        <EmptyState icon={Building2} title="Nenhuma empresa encontrada">Ajuste a busca ou cadastre uma nova empresa.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {filtradas.map((e) => (
            <article key={e.id} className={`rounded-lg border bg-white p-4 transition-shadow hover:shadow-lg sm:p-6 ${e.status === 'INATIVO' ? 'border-gray-200 opacity-75' : 'border-gray-200'}`}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-100"><Building2 className="h-6 w-6 text-blue-600" /></div>
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-gray-900">{e.nomeFantasia || e.razaoSocial}</h3>
                    <p className="truncate text-sm text-gray-600">{e.razaoSocial}</p>
                    <p className="mt-1 text-xs text-gray-500">CNPJ: {cnpj(e.cnpj)}</p>
                  </div>
                </div>
                <Badge className={e.status === 'ATIVO' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}>{e.status === 'ATIVO' ? 'Ativa' : 'Inativa'}</Badge>
              </div>
              <div className="mb-4 grid grid-cols-3 gap-3 rounded-lg bg-gray-50 p-3 sm:p-4">
                <div>
                  <p className="mb-1 flex items-center gap-1.5 text-xs text-gray-600"><FileText className="h-4 w-4" />Docs</p>
                  <p className="text-lg font-semibold text-gray-900">{e.documentos}</p>
                </div>
                <div>
                  <p className="mb-1 flex items-center gap-1.5 text-xs text-gray-600"><TrendingUp className="h-4 w-4" />Lançam.</p>
                  <p className="text-lg font-semibold text-gray-900">{e.lancamentos}{e.lancamentosPendentes > 0 && <span className="ml-1 text-xs font-normal text-yellow-700">({e.lancamentosPendentes} a revisar)</span>}</p>
                </div>
                <div className="min-w-0">
                  <p className="mb-1 flex items-center gap-1.5 text-xs text-gray-600"><BadgeCheck className="h-4 w-4" />Regime</p>
                  <p className="text-sm font-medium text-gray-700">{rotuloRegime(e.regimeTributario)}</p>
                </div>
              </div>
              <div className="mb-4 space-y-2 text-sm text-gray-600">
                {e.responsavel && <p className="flex items-center gap-2"><User className="h-4 w-4 shrink-0 text-gray-400" /><span className="truncate">{e.responsavel}</span></p>}
                <p className="flex items-center gap-2"><Mail className="h-4 w-4 shrink-0 text-gray-400" /><span className="truncate">{e.email}</span></p>
                {e.telefone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0 text-gray-400" />{e.telefone}</p>}
                {(e.logradouro || e.cidade) && <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" /><span>{[e.logradouro, [e.cidade, e.uf].filter(Boolean).join('/')].filter(Boolean).join(' - ')}</span></p>}
              </div>
              <div className="flex items-center gap-2">
                <Button variante="suaveAzul" icon={Eye} onClick={() => setDetalhe(e)} className="flex-1">Visualizar</Button>
                <button type="button" onClick={() => editar(e)} className="rounded-lg p-2 text-gray-600 hover:bg-blue-50 hover:text-blue-600" title="Editar" aria-label={`Editar ${e.razaoSocial}`}><SquarePen className="h-4 w-4" /></button>
                <button type="button" onClick={() => alternarStatus(e)} className={`rounded-lg p-2 ${e.status === 'ATIVO' ? 'text-gray-600 hover:bg-red-50 hover:text-red-600' : 'text-green-700 hover:bg-green-50'}`}
                  title={e.status === 'ATIVO' ? 'Inativar' : 'Reativar'} aria-label={`${e.status === 'ATIVO' ? 'Inativar' : 'Reativar'} ${e.razaoSocial}`}>
                  <Power className="h-4 w-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {dados && filtradas.length > 0 && <p className="mt-6 text-sm text-gray-600">Mostrando {filtradas.length} de {dados.length} empresa(s)</p>}

      <Modal aberto={Boolean(detalhe)} titulo={detalhe?.nomeFantasia || detalhe?.razaoSocial || ''} onClose={() => setDetalhe(null)} largura="max-w-2xl"
        rodape={detalhe && <>
          <Button variante="secundario" onClick={() => abrirEm(detalhe, 'documentos')}>Documentos</Button>
          <Button variante="secundario" onClick={() => abrirEm(detalhe, 'lancamentos')}>Lançamentos</Button>
          <Button variante="secundario" onClick={() => abrirEm(detalhe, 'plano-de-contas')}>Plano de contas</Button>
          <Button icon={SquarePen} onClick={() => editar(detalhe)}>Editar</Button>
        </>}>
        {detalhe && (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {[
              ['Razão social', detalhe.razaoSocial], ['CNPJ', cnpj(detalhe.cnpj)],
              ['Inscrição estadual', detalhe.inscricaoEstadual || 'Isento'], ['Inscrição municipal', detalhe.inscricaoMunicipal],
              ['Regime tributário', rotuloRegime(detalhe.regimeTributario)], ['CNAE', detalhe.cnae && cnae(detalhe.cnae)],
              ['Responsável', detalhe.responsavel], ['E-mail', detalhe.email], ['Telefone', detalhe.telefone],
              ['Endereço', [detalhe.logradouro, detalhe.cidade && `${detalhe.cidade}/${detalhe.uf}`, detalhe.cep && cep(detalhe.cep)].filter(Boolean).join(' - ')],
              ['Contadores responsáveis', detalhe.contadores], ['Situação', detalhe.status === 'ATIVO' ? 'Ativa' : 'Inativa'],
              ['Cliente desde', dataHora(detalhe.criadoEm)], ['Última movimentação', dataHora(detalhe.ultimaAtualizacao)],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{k}</dt>
                <dd className="break-words text-gray-900">{v || '—'}</dd>
              </div>
            ))}
          </dl>
        )}
      </Modal>
    </div>
  );
}
