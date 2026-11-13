import { useState } from 'react';
import { Building2, Lock, Mail, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert, Spinner } from '../components/ui.jsx';

// Contas da carga inicial do banco (db/02_dml_carga_inicial.sql) — para a banca e testes.
const DEMO = {
  CONTADOR: { email: 'carlos.silva@agilcontabil.com.br', descricao: 'Carlos Silva — carteira com 5 empresas' },
  CLIENTE: { email: 'joao@abccomercio.com.br', descricao: 'João Silva — Empresa ABC e Comércio Silva' },
};

export default function Login() {
  const { login } = useAuth();
  const [perfil, setPerfil] = useState('CONTADOR');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [lembrar, setLembrar] = useState(true);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await login(email.trim(), senha, perfil, lembrar);
    } catch (err) {
      setErro(err.message);
      setEnviando(false);
    }
  };

  const usarDemo = () => {
    setEmail(DEMO[perfil].email);
    setSenha('senha123');
    setErro('');
  };

  const aba = (valor, rotulo, Icone) => (
    <button
      type="button"
      onClick={() => {
        setPerfil(valor);
        setErro('');
      }}
      aria-pressed={perfil === valor}
      className={`flex-1 rounded-lg px-4 py-3 font-medium transition-all ${perfil === valor ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
    >
      <span className="flex items-center justify-center gap-2">
        <Icone className="h-4 w-4" />
        {rotulo}
      </span>
    </button>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <div className="w-full max-w-md">
        <div className="overflow-hidden rounded-2xl bg-white shadow-xl">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-center text-white sm:p-8">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
              <Building2 className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold">Contabilidade Ágil</h1>
            <p className="mt-2 text-blue-100">Sistema de Gestão Contábil</p>
          </div>
          <div className="p-6 sm:p-8">
            <div className="mb-6 flex gap-2">
              {aba('CONTADOR', 'Contador', User)}
              {aba('CLIENTE', 'Cliente', Building2)}
            </div>
            <form onSubmit={entrar} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-gray-700">E-mail</span>
                <span className="relative block">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={perfil === 'CONTADOR' ? 'contador@escritorio.com.br' : 'voce@suaempresa.com.br'}
                    className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </span>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-gray-700">Senha</span>
                <span className="relative block">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </span>
              </label>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <span className="text-gray-600">Lembrar-me</span>
                </label>
                <span className="text-gray-500">Esqueceu a senha? Fale com o escritório.</span>
              </div>
              <Alert tipo="erro">{erro}</Alert>
              <button
                type="submit"
                disabled={enviando}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 font-medium text-white shadow-md transition-colors hover:bg-blue-700 disabled:opacity-70"
              >
                {enviando && <Spinner className="h-4 w-4" />}
                Entrar
              </button>
            </form>
            <div className="mt-6 border-t border-gray-200 pt-6 text-sm">
              <p className="text-center text-gray-600">
                {perfil === 'CONTADOR'
                  ? 'Acesso completo para gerenciar a carteira de empresas'
                  : 'Acompanhe a contabilidade da sua empresa em tempo real'}
              </p>
              <button type="button" onClick={usarDemo} className="mt-3 w-full rounded-lg border border-dashed border-blue-300 px-3 py-2 text-left text-blue-700 hover:bg-blue-50">
                <span className="block font-medium">Usar conta de demonstração</span>
                <span className="block text-xs text-blue-600">{DEMO[perfil].descricao} · senha123</span>
              </button>
            </div>
          </div>
        </div>
        <p className="mt-6 text-center text-sm text-gray-600">© 2026 Contabilidade Ágil. Todos os direitos reservados.</p>
      </div>
    </div>
  );
}
