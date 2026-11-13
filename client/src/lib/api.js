// Cliente HTTP da API. O token fica no localStorage ("Lembrar-me") ou no
// sessionStorage (some ao fechar o navegador).
const CHAVE = 'ca_token';

function storage(tipo) {
  try {
    return tipo === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function lerToken() {
  return storage('local')?.getItem(CHAVE) || storage('session')?.getItem(CHAVE) || null;
}

export function salvarToken(token, lembrar) {
  limparToken();
  storage(lembrar ? 'local' : 'session')?.setItem(CHAVE, token);
}

export function limparToken() {
  storage('local')?.removeItem(CHAVE);
  storage('session')?.removeItem(CHAVE);
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function api(caminho, { method = 'GET', body, form } = {}) {
  const headers = {};
  const token = lerToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`/api${caminho}`, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, 'Não foi possível falar com o servidor. Verifique sua conexão.');
  }

  if (res.status === 204) return null;
  const tipo = res.headers.get('content-type') || '';
  const dados = tipo.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    if (res.status === 401 && caminho !== '/auth/login') {
      limparToken();
      window.dispatchEvent(new Event('ca:sessao-expirada'));
    }
    const msg = (dados && dados.erro) || `Erro ${res.status}`;
    throw new ApiError(res.status, msg);
  }
  return dados;
}

/** Baixa um arquivo protegido (precisa do token) e abre ou salva no navegador. */
export async function abrirArquivo(caminho, { nome, baixar = false } = {}) {
  const token = lerToken();
  const res = await fetch(`/api${caminho}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try {
      msg = (await res.json()).erro || msg;
    } catch {
      /* resposta sem JSON */
    }
    throw new ApiError(res.status, msg);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  if (baixar) {
    const a = document.createElement('a');
    a.href = url;
    a.download = nome || 'arquivo';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } else {
    window.open(url, '_blank', 'noopener');
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
