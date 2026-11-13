const FUSO = 'America/Sao_Paulo';

const moedaFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const moeda = (v) => moedaFmt.format(Number(v) || 0);

/** R$ 8,3 mil / R$ 1,2 mi — para cartões pequenos */
export function moedaCurta(v) {
  const n = Number(v) || 0;
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (abs >= 10_000) return `R$ ${(n / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return moeda(n);
}

export const numero = (v, casas = 2) =>
  v === null || v === undefined ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

export const percentual = (v, casas = 1) =>
  v === null || v === undefined ? '—' : `${(Number(v) * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;

/** 'AAAA-MM-DD' → 'DD/MM/AAAA' (sem passar por Date, para não mudar o dia) */
export const data = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');

/** Timestamp ISO → 'DD/MM/AAAA HH:MM' no horário de Brasília */
export function dataHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
/** '2026-10' → 'Out/26' */
export const mesCurto = (am) => {
  const [a, m] = am.split('-');
  return `${MESES[Number(m) - 1]}/${a.slice(2)}`;
};

/** Data de hoje em Brasília, 'AAAA-MM-DD' */
export function hojeISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date());
}

export function inicioDoMes(iso = hojeISO()) {
  return `${iso.slice(0, 7)}-01`;
}

export function fimDoMes(iso = hojeISO()) {
  const [a, m] = iso.split('-').map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return `${iso.slice(0, 7)}-${String(ultimo).padStart(2, '0')}`;
}

/** Primeiro dia do mês, n meses antes do mês de referência */
export function mesesAtras(n, iso = hojeISO()) {
  const [a, m] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 - n, 1));
  return d.toISOString().slice(0, 10);
}

export function cnpj(v) {
  const d = String(v || '').replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function cep(v) {
  const d = String(v || '').replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function cnae(v) {
  const d = String(v || '').replace(/\D/g, '').slice(0, 7);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{2})(\d)/, '$1.$2-$3')
    .replace(/-(\d)(\d{1,2})$/, '-$1-$2');
}

export function tamanhoArquivo(bytes) {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} MB`;
}

/** Aceita "1.234,56", "1234,56" ou "1234.56" */
export function lerValor(v) {
  const s = String(v ?? '').trim();
  if (!s) return 0;
  const normal = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(normal);
  return Number.isFinite(n) ? n : NaN;
}

export const iniciais = (nome = '') =>
  nome.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
