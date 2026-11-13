import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

/**
 * Carrega dados da API e expõe { dados, erro, carregando, recarregar }.
 * Passe caminho = null para não carregar (ex.: empresa ainda não escolhida).
 * Respostas fora de ordem (usuário trocou de empresa rápido) são ignoradas.
 */
export function useApi(caminho) {
  const [estado, setEstado] = useState({ dados: null, erro: null, carregando: Boolean(caminho) });
  const seq = useRef(0);

  const recarregar = useCallback(async () => {
    if (!caminho) {
      setEstado({ dados: null, erro: null, carregando: false });
      return;
    }
    const meu = ++seq.current;
    setEstado((s) => ({ ...s, carregando: true, erro: null }));
    try {
      const dados = await api(caminho);
      if (meu === seq.current) setEstado({ dados, erro: null, carregando: false });
    } catch (err) {
      if (meu === seq.current) setEstado({ dados: null, erro: err.message, carregando: false });
    }
  }, [caminho]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  return { ...estado, recarregar };
}
