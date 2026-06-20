import { useState, useMemo } from 'react';
import { DollarSign, Search, Check, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { Badge } from '../components/ui/Badge';

export function Despesas() {
  const { despesas, atualizarStatusDespesa } = useStore();
  const [filtroStatus, setFiltroStatus] = useState('Pendente');
  const [busca, setBusca] = useState('');

  const despesasFiltradas = useMemo(() => {
    return despesas.filter(d => {
      if (filtroStatus !== 'Todos' && d.status !== filtroStatus) return false;
      if (busca) {
        const termo = busca.toLowerCase();
        return (
          d.motorista_placa?.toLowerCase().includes(termo) ||
          d.nome_recebedor?.toLowerCase().includes(termo) ||
          d.tipo?.toLowerCase().includes(termo) ||
          d.chave_pix?.toLowerCase().includes(termo)
        );
      }
      return true;
    }).sort((a, b) => new Date(b.data_solicitacao) - new Date(a.data_solicitacao));
  }, [despesas, filtroStatus, busca]);

  const handleAprovar = (id) => {
    if (confirm('Confirmar aprovação desta despesa? Lembre-se de realizar o pagamento PIX.')) {
      atualizarStatusDespesa(id, 'Aprovado');
    }
  };

  const handleRejeitar = (id) => {
    if (confirm('Tem certeza que deseja rejeitar esta solicitação?')) {
      atualizarStatusDespesa(id, 'Rejeitado');
    }
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-20">
      <div className="glass-panel p-4 rounded-xl flex items-center justify-between border border-border-secondary">
        <div>
          <h2 className="text-xl font-bold text-text-primary flex items-center">
            <DollarSign className="mr-2 text-info" />
            Gestão de Custos / Despesas
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            Solicitações de reembolso e pagamentos extras da frota.
          </p>
        </div>
      </div>

      <div className="glass-panel p-3 rounded-xl flex items-center border border-border-secondary focus-within:border-info transition-all">
        <Search size={18} className="text-text-tertiary mr-2 flex-shrink-0" />
        <input 
          type="text" 
          placeholder="Buscar por placa, nome, tipo ou PIX..." 
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full text-sm bg-transparent border-none px-1 py-1 focus:ring-0 placeholder:text-text-tertiary/70"
        />
        {busca && (
          <button onClick={() => setBusca('')} className="text-text-tertiary hover:text-text-primary p-1">
            <X size={16} />
          </button>
        )}
      </div>

      <div className="flex gap-2 border-b border-border-tertiary pb-2">
        {['Pendente', 'Aprovado', 'Rejeitado', 'Todos'].map(status => (
          <button
            key={status}
            onClick={() => setFiltroStatus(status)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold transition-colors",
              filtroStatus === status 
                ? "bg-info text-white shadow-md shadow-info/20" 
                : "bg-background-secondary text-text-secondary hover:bg-border-tertiary"
            )}
          >
            {status}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {despesasFiltradas.length === 0 ? (
          <div className="text-center text-text-tertiary py-10 glass-panel rounded-xl">
            <DollarSign className="mx-auto h-12 w-12 mb-3 opacity-20" />
            <p className="text-sm font-medium">Nenhuma solicitação encontrada.</p>
          </div>
        ) : (
          despesasFiltradas.map(despesa => (
            <div key={despesa.id} className="glass-panel p-4 rounded-xl border border-border-secondary flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-black bg-background-primary px-2 py-1 rounded text-text-primary border border-border-tertiary shadow-sm">
                    {despesa.motorista_placa}
                  </span>
                  <Badge status={despesa.status}>{despesa.status}</Badge>
                  <span className="text-[10px] font-bold text-text-tertiary">
                    {new Date(despesa.data_solicitacao).toLocaleString('pt-BR')}
                  </span>
                </div>
                
                <div>
                  <h3 className="text-lg font-bold text-info">{despesa.tipo}</h3>
                  <p className="text-sm text-text-secondary mt-1 max-w-md line-clamp-2">
                    {despesa.observacao || 'Sem observações.'}
                  </p>
                </div>

                <div className="bg-background-primary p-3 rounded-lg border border-border-tertiary text-xs">
                  <div className="flex justify-between mb-1">
                    <span className="text-text-tertiary font-bold uppercase">Recebedor:</span>
                    <span className="text-text-primary font-bold">{despesa.nome_recebedor}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="text-text-tertiary font-bold uppercase">Chave PIX:</span>
                    <span className="text-text-primary font-bold">{despesa.chave_pix}</span>
                  </div>
                  <div className="flex justify-between border-t border-border-secondary pt-2 mt-2">
                    <span className="text-text-tertiary font-bold uppercase">Valor Solicitado:</span>
                    <span className="text-success font-black text-base">R$ {despesa.valor?.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {despesa.status === 'Pendente' && (
                <div className="flex sm:flex-col gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                  <button
                    onClick={() => handleAprovar(despesa.id)}
                    className="flex-1 sm:flex-none flex items-center justify-center bg-success hover:bg-success/90 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-success/20 transition-all active:scale-[0.98]"
                  >
                    <Check size={18} className="mr-2" />
                    Aprovar
                  </button>
                  <button
                    onClick={() => handleRejeitar(despesa.id)}
                    className="flex-1 sm:flex-none flex items-center justify-center bg-danger/10 text-danger hover:bg-danger hover:text-white font-bold py-3 px-6 rounded-xl transition-all active:scale-[0.98]"
                  >
                    <X size={18} className="mr-2" />
                    Rejeitar
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
