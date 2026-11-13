import { useEffect } from 'react';
import { BookOpen, Building2, ChartColumn, FileText, House, LogOut, TrendingUp, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { iniciais } from '../lib/format.js';

export const MENU_CONTADOR = [
  { id: 'dashboard', label: 'Dashboard', icon: House },
  { id: 'documentos', label: 'Documentos', icon: FileText },
  { id: 'lancamentos', label: 'Lançamentos', icon: TrendingUp },
  { id: 'empresas', label: 'Empresas', icon: Building2 },
  { id: 'plano-de-contas', label: 'Plano de Contas', icon: BookOpen },
  { id: 'relatorios', label: 'Relatórios', icon: ChartColumn },
];

export const MENU_CLIENTE = [
  { id: 'dashboard', label: 'Meu Painel', icon: House },
  { id: 'documentos', label: 'Enviar Documentos', icon: FileText },
  { id: 'relatorios', label: 'Relatórios', icon: ChartColumn },
];

/**
 * Menu lateral. Em telas grandes (lg, ≥1024px) fica fixo ao lado do
 * conteúdo; em telas menores vira uma gaveta que abre pelo botão do
 * cabeçalho — antes ele ocupava 256px fixos e espremia o conteúdo no celular.
 */
export default function Sidebar({ paginaAtual, onNavegar, aberto, onFechar }) {
  const { user, logout } = useAuth();
  const itens = user?.tipo === 'CONTADOR' ? MENU_CONTADOR : MENU_CLIENTE;

  useEffect(() => {
    if (!aberto) return undefined;
    const tecla = (e) => e.key === 'Escape' && onFechar();
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [aberto, onFechar]);

  return (
    <>
      {aberto && <div className="fixed inset-0 z-30 bg-gray-900/40 lg:hidden" onClick={onFechar} aria-hidden="true" />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col border-r border-gray-200 bg-white transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-64 lg:translate-x-0 ${aberto ? 'translate-x-0 shadow-xl' : '-translate-x-full'}`}
        aria-label="Menu principal"
      >
        <div className="flex items-start justify-between border-b border-gray-200 p-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Contabilidade Ágil</h1>
            <p className="mt-1 text-sm text-gray-500">Sistema de Gestão Contábil</p>
          </div>
          <button type="button" onClick={onFechar} className="-mr-2 rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden" aria-label="Fechar menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-1">
            {itens.map(({ id, label, icon: Icon }) => {
              const ativo = paginaAtual === id;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => onNavegar(id)}
                    aria-current={ativo ? 'page' : undefined}
                    className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors ${ativo ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span>{label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t border-gray-200 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100">
              <span className="font-medium text-blue-700">{iniciais(user?.nome)}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{user?.nome}</p>
              <p className="truncate text-xs text-gray-500">{user?.email}</p>
              <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs ${user?.tipo === 'CONTADOR' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                {user?.tipo === 'CONTADOR' ? 'Contador' : 'Cliente'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-red-700 transition-colors hover:bg-red-100"
          >
            <LogOut className="h-4 w-4" />
            <span className="text-sm font-medium">Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
}
