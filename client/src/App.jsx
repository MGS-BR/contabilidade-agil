import { useCallback, useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { useAuth } from './context/AuthContext.jsx';
import Sidebar, { MENU_CLIENTE, MENU_CONTADOR } from './components/Sidebar.jsx';
import { Loading } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import DashboardContador from './pages/DashboardContador.jsx';
import DashboardCliente from './pages/DashboardCliente.jsx';
import Documentos from './pages/Documentos.jsx';
import Lancamentos from './pages/Lancamentos.jsx';
import Empresas from './pages/Empresas.jsx';
import PlanoContas from './pages/PlanoContas.jsx';
import Relatorios from './pages/Relatorios.jsx';

// Navegação pelo hash da URL (#/lancamentos): recarregar a página e o
// botão "voltar" do navegador mantêm a tela.
const paginaDoHash = () => window.location.hash.replace(/^#\/?/, '') || 'dashboard';

export default function App() {
  const { user, carregando } = useAuth();
  const [pagina, setPagina] = useState(paginaDoHash);
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    const mudou = () => setPagina(paginaDoHash());
    window.addEventListener('hashchange', mudou);
    return () => window.removeEventListener('hashchange', mudou);
  }, []);

  const navegar = useCallback((id) => {
    window.location.hash = `/${id}`;
    setMenuAberto(false);
    window.scrollTo({ top: 0 });
  }, []);
  const fecharMenu = useCallback(() => setMenuAberto(false), []);

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Loading texto="Abrindo sua sessão..." />
      </div>
    );
  }
  if (!user) return <Login />;

  const contador = user.tipo === 'CONTADOR';
  const itens = contador ? MENU_CONTADOR : MENU_CLIENTE;
  const atual = itens.some((i) => i.id === pagina) ? pagina : 'dashboard';
  const titulo = itens.find((i) => i.id === atual)?.label;

  const telas = {
    dashboard: contador ? <DashboardContador onNavegar={navegar} /> : <DashboardCliente />,
    documentos: <Documentos />,
    lancamentos: <Lancamentos />,
    empresas: <Empresas onNavegar={navegar} />,
    'plano-de-contas': <PlanoContas />,
    relatorios: <Relatorios />,
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar paginaAtual={atual} onNavegar={navegar} aberto={menuAberto} onFechar={fecharMenu} />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Cabeçalho só no celular/tablet: abre o menu */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <button type="button" onClick={() => setMenuAberto(true)} className="-ml-1 rounded-lg p-2 text-gray-700 hover:bg-gray-100" aria-label="Abrir menu">
            <Menu className="h-6 w-6" />
          </button>
          <div className="min-w-0">
            <p className="text-xs text-gray-500">Contabilidade Ágil</p>
            <p className="truncate font-semibold text-gray-900">{titulo}</p>
          </div>
        </header>
        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{telas[atual]}</div>
        </main>
      </div>
    </div>
  );
}
