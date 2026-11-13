import { Building2, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { cnpj } from '../lib/format.js';

/**
 * Escolha da empresa de trabalho.
 * Contador: lista da carteira. Cliente: cartão da própria empresa (com
 * seletor só se ele tiver acesso a mais de uma).
 */
export default function CompanySelector({ className = 'mb-6' }) {
  const { user, selectedCompany, setEmpresaId } = useAuth();
  if (!user) return null;

  const select = (
    <div className="relative">
      <Building2 className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
      <select
        aria-label="Empresa selecionada"
        value={selectedCompany?.id || ''}
        onChange={(e) => setEmpresaId(Number(e.target.value) || null)}
        className="w-full appearance-none truncate rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Selecione uma empresa</option>
        {user.empresas.map((e) => (
          <option value={e.id} key={e.id}>
            {e.nome} — {cnpj(e.cnpj)}{e.status === 'INATIVO' ? ' (inativa)' : ''}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
    </div>
  );

  if (user.tipo === 'CLIENTE') {
    return (
      <div className={`rounded-lg border border-blue-200 bg-blue-50 p-4 ${className}`}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-blue-700">Sua empresa</p>
            {user.empresas.length > 1 ? (
              <div className="mt-1">{select}</div>
            ) : (
              <>
                <p className="truncate font-semibold text-blue-900">{selectedCompany?.razaoSocial || selectedCompany?.nome}</p>
                <p className="text-xs text-blue-600">CNPJ: {cnpj(selectedCompany?.cnpj)}</p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-gray-200 bg-white p-4 ${className}`}>
      <p className="mb-2 text-sm font-medium text-gray-700">Empresa selecionada</p>
      {select}
      {!selectedCompany && (
        <p className="mt-2 text-xs text-amber-700">Selecione uma empresa para acessar documentos, lançamentos e plano de contas.</p>
      )}
      {selectedCompany?.status === 'INATIVO' && (
        <p className="mt-2 text-xs text-amber-700">Esta empresa está inativa: consulta liberada, novos documentos e lançamentos bloqueados.</p>
      )}
    </div>
  );
}
