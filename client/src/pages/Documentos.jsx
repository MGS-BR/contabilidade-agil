import { useMemo, useState } from 'react';
import { CircleCheckBig, CircleX, CloudUpload, Download, Eye, FileText, Funnel, Info, Search, Send, Trash2, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api, abrirArquivo } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { dataHora, tamanhoArquivo } from '../lib/format.js';
import { STATUS_DOCUMENTO, TIPOS_DOCUMENTO, rotuloTipoDocumento } from '../lib/dominio.js';
import CompanySelector from '../components/CompanySelector.jsx';
import { Alert, Badge, Button, EmptyState, Loading, Modal, PageHeader, inputClass } from '../components/ui.jsx';

const POR_PAGINA = 10;
const MAX_BYTES = 10 * 1024 * 1024;

function PainelUpload({ empresa, onEnviado }) {
  const [tipo, setTipo] = useState('NOTA_FISCAL');
  const [arquivos, setArquivos] = useState([]);
  const [aviso, setAviso] = useState(null);
  const [resultados, setResultados] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const def = TIPOS_DOCUMENTO.find((t) => t.valor === tipo);
  const extensoes = def.aceitos.split(',').map((e) => e.slice(1));

  const adicionar = (lista) => {
    if (!lista) return;
    const todos = Array.from(lista);
    const validos = todos.filter((f) => extensoes.includes(f.name.split('.').pop().toLowerCase()) && f.size <= MAX_BYTES && f.size > 0);
    setArquivos((a) => [...a, ...validos]);
    setAviso(validos.length !== todos.length ? { tipo: 'aviso', texto: 'Alguns arquivos foram ignorados: use os formatos aceitos e no máximo 10 MB por arquivo.' } : null);
  };

  const enviar = async () => {
    if (!arquivos.length) {
      setAviso({ tipo: 'aviso', texto: 'Adicione pelo menos um arquivo para continuar.' });
      return;
    }
    setEnviando(true);
    setAviso(null);
    const form = new FormData();
    form.append('tipo', tipo);
    arquivos.forEach((f) => form.append('arquivos', f, f.name));
    try {
      const r = await api(`/empresas/${empresa.id}/documentos`, { method: 'POST', form });
      setResultados(r);
      setArquivos([]);
      const ok = r.filter((x) => x.ok).length;
      setAviso({ tipo: ok === r.length ? 'sucesso' : 'aviso', texto: `${ok} de ${r.length} arquivo(s) enviado(s). Acompanhe o status no histórico abaixo.` });
      onEnviado();
    } catch (err) {
      setAviso({ tipo: 'erro', texto: err.message });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section id="upload-documentos" className="mb-6 scroll-mt-20 rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Enviar novo documento</h3>
          <p className="mt-1 text-sm text-gray-600">Todo documento fica vinculado à empresa selecionada e ao tipo escolhido.</p>
        </div>
        <span className="self-start rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-700">Máx. 10 MB por arquivo</span>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-700">Tipo de documento</span>
            <select
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value);
                setArquivos([]);
                setAviso(null);
                setResultados([]);
              }}
              className={inputClass}
            >
              {TIPOS_DOCUMENTO.map((t) => <option value={t.valor} key={t.valor}>{t.rotulo}</option>)}
            </select>
          </label>
          <div className="mt-3 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
            <p className="flex gap-2"><Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />{def.descricao}</p>
            <p className="mt-2 text-xs text-gray-500">Formatos aceitos: {def.aceitos.replaceAll(',', ', ')}</p>
          </div>
        </div>
        <div className="lg:col-span-2">
          <span className="mb-2 block text-sm font-medium text-gray-700">Arquivos</span>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              adicionar(e.dataTransfer.files);
            }}
            className="rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/40 p-6 text-center transition-colors hover:bg-blue-50 sm:p-8"
          >
            <CloudUpload className="mx-auto mb-3 h-10 w-10 text-blue-600" />
            <p className="font-medium text-gray-900">Arraste e solte os arquivos aqui</p>
            <p className="mt-1 text-sm text-gray-600">ou selecione no botão abaixo</p>
            <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
              <Upload className="h-4 w-4" />
              Selecionar arquivos
              <input type="file" multiple accept={def.aceitos} className="sr-only" onChange={(e) => { adicionar(e.target.files); e.target.value = ''; }} />
            </label>
          </div>

          {arquivos.length > 0 && (
            <ul className="mt-4 space-y-2">
              {arquivos.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <FileText className="h-5 w-5 shrink-0 text-gray-400" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{f.name}</p>
                      <p className="text-xs text-gray-500">{tamanhoArquivo(f.size)}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setArquivos((a) => a.filter((_, j) => j !== i))} className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600" aria-label={`Remover ${f.name}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {aviso && <Alert tipo={aviso.tipo} className="mt-3" onClose={() => setAviso(null)}>{aviso.texto}</Alert>}

          {resultados.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
              <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-sm font-medium text-gray-900">Resultado do envio</p>
              </div>
              <ul className="divide-y divide-gray-200">
                {resultados.map((r, i) => (
                  <li key={i} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      {r.ok ? <CircleCheckBig className="mt-0.5 h-5 w-5 shrink-0 text-green-600" /> : <CircleX className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />}
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">{r.nomeArquivo}</p>
                        <p className="text-sm text-gray-600">
                          {r.ok
                            ? r.processamento === 'DIRETO'
                              ? `Importado diretamente, sem IA${r.chaveNFe ? ' · chave da NF-e identificada' : ''}.`
                              : 'Recebido. Aguardando leitura por OCR/IA e revisão do contador.'
                            : r.erro}
                        </p>
                      </div>
                    </div>
                    {r.ok && <Badge className={STATUS_DOCUMENTO[r.status].cor}>{STATUS_DOCUMENTO[r.status].rotulo}</Badge>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button variante="sucesso" icon={Send} onClick={enviar} carregando={enviando} className="mt-4 w-full md:w-auto">
            Enviar para processamento
          </Button>
        </div>
      </div>
    </section>
  );
}

export default function Documentos() {
  const { user, selectedCompany } = useAuth();
  const cliente = user.tipo === 'CLIENTE';
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('all');
  const [pagina, setPagina] = useState(1);
  const [aviso, setAviso] = useState(null);
  const [rejeitar, setRejeitar] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const { dados, erro, carregando, recarregar } = useApi(selectedCompany ? `/documentos?empresa=${selectedCompany.id}` : null);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (dados || []).filter(
      (d) => (status === 'all' || d.status === status) &&
        (!q || d.nomeArquivo.toLowerCase().includes(q) || rotuloTipoDocumento(d.tipo).toLowerCase().includes(q)),
    );
  }, [dados, busca, status]);
  const paginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const atual = Math.min(pagina, paginas);
  const visiveis = filtrados.slice((atual - 1) * POR_PAGINA, atual * POR_PAGINA);

  const abrir = async (d, baixar) => {
    try {
      await abrirArquivo(`/documentos/${d.id}/arquivo${baixar ? '?download=1' : ''}`, { nome: d.nomeArquivo, baixar });
    } catch (err) {
      setAviso({ tipo: 'aviso', texto: err.message });
    }
  };

  const confirmarRejeicao = async () => {
    setSalvando(true);
    try {
      const r = await api(`/documentos/${rejeitar.id}/rejeitar`, { method: 'POST', body: { motivo } });
      setAviso({ tipo: 'sucesso', texto: `Documento rejeitado. ${r.lancamentosReprovados} sugestão(ões) de lançamento reprovada(s); o cliente verá a justificativa.` });
      setRejeitar(null);
      recarregar();
    } catch (err) {
      setAviso({ tipo: 'erro', texto: err.message });
      setRejeitar(null);
    } finally {
      setSalvando(false);
    }
  };

  const inativa = selectedCompany?.status === 'INATIVO';
  const acoes = (d) => (
    <div className="flex items-center justify-end gap-1">
      <button type="button" onClick={() => abrir(d, false)} className="rounded-lg p-2 text-gray-600 hover:bg-blue-50 hover:text-blue-600" title="Visualizar" aria-label={`Visualizar ${d.nomeArquivo}`}>
        <Eye className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => abrir(d, true)} className="rounded-lg p-2 text-gray-600 hover:bg-blue-50 hover:text-blue-600" title="Baixar" aria-label={`Baixar ${d.nomeArquivo}`}>
        <Download className="h-4 w-4" />
      </button>
      {!cliente && !['APROVADO', 'REJEITADO'].includes(d.status) && (
        <button type="button" onClick={() => { setRejeitar(d); setMotivo(''); }} className="rounded-lg p-2 text-gray-600 hover:bg-red-50 hover:text-red-600" title="Rejeitar documento" aria-label={`Rejeitar ${d.nomeArquivo}`}>
          <CircleX className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  const statusCelula = (d) => (
    <div className="flex flex-col items-start gap-1">
      <Badge className={STATUS_DOCUMENTO[d.status].cor}>{STATUS_DOCUMENTO[d.status].rotulo}</Badge>
      {d.confianca !== null && <span className="text-xs text-gray-500">Confiança IA: {Math.round(d.confianca)}% ({d.faixaConfianca.toLowerCase()})</span>}
      {d.motivoRejeicao && <span className="max-w-xs whitespace-normal text-xs text-red-700">{d.motivoRejeicao}</span>}
    </div>
  );

  return (
    <div>
      <PageHeader
        title={cliente ? 'Enviar Documentos' : 'Gestão de Documentos'}
        description={cliente ? 'Envie documentos fiscais e contábeis para processamento' : 'Upload, análise automática e histórico de documentos fiscais'}
        action={selectedCompany && !inativa ? (
          <a href="#upload-documentos" onClick={(e) => { e.preventDefault(); document.getElementById('upload-documentos')?.scrollIntoView({ behavior: 'smooth' }); }}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
            <Upload className="h-4 w-4" />
            Fazer upload
          </a>
        ) : null}
      />
      <CompanySelector />

      {!selectedCompany ? (
        <EmptyState icon={FileText} title="Selecione uma empresa">Para enviar e gerenciar documentos, selecione uma empresa acima.</EmptyState>
      ) : (
        <>
          {!inativa && <PainelUpload empresa={selectedCompany} onEnviado={recarregar} />}
          {aviso && <Alert tipo={aviso.tipo} className="mb-4" onClose={() => setAviso(null)}>{aviso.texto}</Alert>}

          <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input type="search" placeholder="Buscar por nome do arquivo ou tipo..." value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} className={`${inputClass} pl-10`} aria-label="Buscar documentos" />
              </div>
              <div className="flex items-center gap-2">
                <Funnel className="h-5 w-5 shrink-0 text-gray-400" />
                <select value={status} onChange={(e) => { setStatus(e.target.value); setPagina(1); }} className={`${inputClass} md:w-56`} aria-label="Filtrar por status">
                  <option value="all">Todos os status</option>
                  {Object.entries(STATUS_DOCUMENTO).map(([v, s]) => <option value={v} key={v}>{s.rotulo}</option>)}
                </select>
              </div>
            </div>
          </div>

          {erro && <Alert tipo="erro" className="mb-4">{erro}</Alert>}
          {carregando && !dados ? (
            <Loading />
          ) : filtrados.length === 0 ? (
            <EmptyState icon={FileText} title="Nenhum documento encontrado">
              {dados?.length ? 'Ajuste a busca ou o filtro de status.' : 'Esta empresa ainda não enviou documentos.'}
            </EmptyState>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              {/* Tabela (telas médias e grandes) */}
              <table className="hidden w-full md:table">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr className="text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <th className="px-6 py-3">Documento</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Envio</th>
                    <th className="px-6 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {visiveis.map((d) => (
                    <tr key={d.id} className="align-top hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-3">
                          <FileText className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
                          <div className="min-w-0">
                            <p className="break-all font-medium text-gray-900">{d.nomeArquivo}</p>
                            <p className="text-xs text-gray-500">{d.formato} · {tamanhoArquivo(d.tamanho)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        <p className="text-gray-700">{rotuloTipoDocumento(d.tipo)}</p>
                        <p className="text-xs text-gray-400">{d.processamento === 'IA' ? 'OCR + IA' : 'Importação direta'}</p>
                      </td>
                      <td className="px-4 py-4">{statusCelula(d)}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">
                        {dataHora(d.dataUpload)}
                        <p className="text-xs text-gray-400">{d.enviadoPor}</p>
                      </td>
                      <td className="px-6 py-4">{acoes(d)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Cartões (celular) */}
              <ul className="divide-y divide-gray-200 md:hidden">
                {visiveis.map((d) => (
                  <li key={d.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <FileText className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
                      <div className="min-w-0 flex-1">
                        <p className="break-all font-medium text-gray-900">{d.nomeArquivo}</p>
                        <p className="text-xs text-gray-500">{rotuloTipoDocumento(d.tipo)} · {dataHora(d.dataUpload)}</p>
                        <div className="mt-2">{statusCelula(d)}</div>
                      </div>
                    </div>
                    <div className="mt-2">{acoes(d)}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {filtrados.length > 0 && (
            <div className="mt-4 flex flex-col gap-3 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
              <p>Mostrando {visiveis.length} de {filtrados.length} documento(s){filtrados.length !== dados.length ? ` (total ${dados.length})` : ''}</p>
              {paginas > 1 && (
                <div className="flex items-center gap-2">
                  <button type="button" disabled={atual === 1} onClick={() => setPagina(atual - 1)} className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50 disabled:opacity-50">Anterior</button>
                  <span className="px-2">{atual} / {paginas}</span>
                  <button type="button" disabled={atual === paginas} onClick={() => setPagina(atual + 1)} className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50 disabled:opacity-50">Próximo</button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <Modal
        aberto={Boolean(rejeitar)}
        titulo="Rejeitar documento"
        onClose={() => setRejeitar(null)}
        rodape={<>
          <Button variante="secundario" onClick={() => setRejeitar(null)}>Cancelar</Button>
          <Button variante="perigo" onClick={confirmarRejeicao} carregando={salvando} disabled={motivo.trim().length < 10}>Rejeitar</Button>
        </>}
      >
        <p className="mb-3 text-sm text-gray-600">
          <strong className="break-all">{rejeitar?.nomeArquivo}</strong> continuará guardado para auditoria. As sugestões de lançamento dele serão reprovadas e o cliente verá a justificativa.
        </p>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-gray-700">Justificativa (mínimo 10 caracteres)</span>
          <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} className={inputClass} placeholder="Ex.: Documento ilegível; reenviar digitalização em melhor resolução." />
        </label>
      </Modal>
    </div>
  );
}
