import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, lerToken, limparToken, salvarToken } from '../lib/api.js';

const AuthContext = createContext(null);
const CHAVE_EMPRESA = 'ca_empresa';

function lerEmpresaSalva() {
  try {
    return Number(window.localStorage.getItem(CHAVE_EMPRESA)) || null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [carregando, setCarregando] = useState(Boolean(lerToken()));
  const [empresaId, setEmpresaId] = useState(lerEmpresaSalva);

  const aplicarUsuario = useCallback((u) => {
    setUser(u);
    // Cliente com uma única empresa: já entra com ela selecionada.
    setEmpresaId((atual) => {
      if (u.empresas.some((e) => e.id === atual)) return atual;
      return u.tipo === 'CLIENTE' || u.empresas.length === 1 ? (u.empresas[0]?.id ?? null) : null;
    });
  }, []);

  // Restaura a sessão ao abrir/recarregar a página.
  useEffect(() => {
    if (!lerToken()) return;
    api('/auth/me')
      .then(({ usuario }) => aplicarUsuario(usuario))
      .catch(() => limparToken())
      .finally(() => setCarregando(false));
  }, [aplicarUsuario]);

  useEffect(() => {
    const sair = () => setUser(null);
    window.addEventListener('ca:sessao-expirada', sair);
    return () => window.removeEventListener('ca:sessao-expirada', sair);
  }, []);

  useEffect(() => {
    try {
      if (empresaId) window.localStorage.setItem(CHAVE_EMPRESA, String(empresaId));
      else window.localStorage.removeItem(CHAVE_EMPRESA);
    } catch {
      /* navegação privada */
    }
  }, [empresaId]);

  const login = useCallback(
    async (email, senha, perfil, lembrar) => {
      const { token, usuario } = await api('/auth/login', { method: 'POST', body: { email, senha, perfil } });
      salvarToken(token, lembrar);
      aplicarUsuario(usuario);
    },
    [aplicarUsuario],
  );

  const logout = useCallback(() => {
    limparToken();
    setUser(null);
    setEmpresaId(null);
  }, []);

  // Recarrega a lista de empresas (ex.: depois de cadastrar uma nova).
  const atualizarUsuario = useCallback(async () => {
    const { usuario } = await api('/auth/me');
    aplicarUsuario(usuario);
  }, [aplicarUsuario]);

  const selectedCompany = useMemo(
    () => user?.empresas.find((e) => e.id === empresaId) || null,
    [user, empresaId],
  );

  const value = useMemo(
    () => ({ user, carregando, login, logout, atualizarUsuario, selectedCompany, setEmpresaId }),
    [user, carregando, login, logout, atualizarUsuario, selectedCompany],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
