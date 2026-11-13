import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CircleAlert, CircleCheckBig, Info, LoaderCircle, X } from 'lucide-react';

/** Título da página. Em telas estreitas o botão de ação desce para baixo do título. */
export function PageHeader({ title, description, action }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-2xl font-semibold text-gray-900">{title}</h2>
        {description && <p className="mt-1 text-gray-600">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </div>
  );
}

const CORES_CARD = {
  blue: 'bg-blue-50 text-blue-700',
  green: 'bg-green-50 text-green-700',
  yellow: 'bg-yellow-50 text-yellow-700',
  purple: 'bg-purple-50 text-purple-700',
};

export function StatCard({ title, value, icon: Icon, color = 'blue', helper }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
      <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg ${CORES_CARD[color]}`}>
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mb-1 text-sm text-gray-600">{title}</h3>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      {helper && <p className="mt-2 text-xs text-gray-500">{helper}</p>}
    </div>
  );
}

export function Badge({ className = 'bg-gray-100 text-gray-700', children, icon: Icon }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${className}`}>
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-8 text-center sm:p-12">
      {Icon && <Icon className="mx-auto mb-4 h-12 w-12 text-gray-400" />}
      <h3 className="mb-2 font-medium text-gray-900">{title}</h3>
      {children && <div className="text-sm text-gray-600">{children}</div>}
    </div>
  );
}

const ALERTAS = {
  info: { cor: 'border-blue-200 bg-blue-50 text-blue-800', icone: Info },
  sucesso: { cor: 'border-green-200 bg-green-50 text-green-800', icone: CircleCheckBig },
  erro: { cor: 'border-red-200 bg-red-50 text-red-800', icone: CircleAlert },
  aviso: { cor: 'border-yellow-200 bg-yellow-50 text-yellow-800', icone: CircleAlert },
};

export function Alert({ tipo = 'info', children, onClose, className = '' }) {
  if (!children) return null;
  const { cor, icone: Icone } = ALERTAS[tipo];
  return (
    <div role={tipo === 'erro' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${cor} ${className}`}>
      <Icone className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1 break-words">{children}</div>
      {onClose && (
        <button type="button" onClick={onClose} className="rounded p-0.5 opacity-70 hover:opacity-100" aria-label="Fechar aviso">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function Spinner({ className = 'h-5 w-5' }) {
  return <LoaderCircle className={`animate-spin ${className}`} aria-hidden="true" />;
}

export function Loading({ texto = 'Carregando...' }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-lg border border-gray-200 bg-white p-10 text-gray-600">
      <Spinner /> {texto}
    </div>
  );
}

/** Diálogo modal acessível (Esc fecha, foco vai para o diálogo). */
export function Modal({ aberto, titulo, onClose, children, largura = 'max-w-lg', rodape, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!aberto) return undefined;
    const tecla = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', tecla);
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = '';
    };
  }, [aberto, onClose]);
  if (!aberto) return null;
  // Portal no <body>: fica fora do #root, o que permite imprimir só o modal.
  return createPortal(
    <div className="modal-overlay fixed inset-0 z-50 flex items-end justify-center bg-gray-900/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl outline-none sm:rounded-2xl ${largura} ${className}`}
      >
        <div className="nao-imprimir flex items-center justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <h3 className="font-semibold text-gray-900">{titulo}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {rodape && <div className="nao-imprimir flex flex-wrap justify-end gap-2 border-t border-gray-200 px-5 py-3">{rodape}</div>}
      </div>
    </div>,
    document.body,
  );
}

const BOTOES = {
  primario: 'bg-blue-600 text-white hover:bg-blue-700',
  sucesso: 'bg-green-600 text-white hover:bg-green-700',
  perigo: 'bg-red-600 text-white hover:bg-red-700',
  secundario: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
  suave: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
  suaveAzul: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
  suaveVerde: 'bg-green-50 text-green-700 hover:bg-green-100',
  suaveVermelho: 'bg-red-50 text-red-700 hover:bg-red-100',
};

export function Button({ variante = 'primario', icon: Icon, carregando, children, className = '', ...props }) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || carregando}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${BOTOES[variante]} ${className}`}
    >
      {carregando ? <Spinner className="h-4 w-4" /> : Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

export const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100';

export function Campo({ label, children, className = '', dica }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium text-gray-700">{label}</span>
      {children}
      {dica && <span className="mt-1 block text-xs text-gray-500">{dica}</span>}
    </label>
  );
}
