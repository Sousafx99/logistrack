import { useState, useMemo } from 'react';
import { DollarSign, Search, Check, X, Package } from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { Badge } from '../components/ui/Badge';

export function Despesas() {
  const { despesas, atualizarStatusDespesa } = useStore();
  const [filtroStatus, setFiltroStatus] = useState('Pendente');
  const [filtroPlaca, setFiltroPlaca] = useState('Todos');
  const [filtroTipo, setFiltroTipo] = useState('Todos');
  const [busca, setBusca] = useState('');
  const [filtroData, setFiltroData] = useState('');

  // Opções únicas para filtros
  const { listaPlacas, listaTipos } = useMemo(() => {
    const placasSet = new Set();
    const tiposSet = new Set([
      'Descarregamento',
      'Pedágio',
      'Balsa',
      'Ajudante extra',
      'Impressão',
      'Pernoite',
      'Outro'
    ]);

    (despesas || []).forEach(d => {
      if (d.motorista_placa) placasSet.add(d.motorista_placa.toUpperCase());
      if (d.tipo) tiposSet.add(d.tipo);
    });

    return {
      listaPlacas: Array.from(placasSet).sort(),
      listaTipos: Array.from(tiposSet).sort()
    };
  }, [despesas]);

  const despesasFiltradas = useMemo(() => {
    return (despesas || []).filter(d => {
      if (filtroStatus !== 'Todos' && d.status !== filtroStatus) return false;
      if (filtroPlaca !== 'Todos' && (d.motorista_placa || '').toUpperCase() !== filtroPlaca.toUpperCase()) return false;
      if (filtroTipo !== 'Todos' && d.tipo !== filtroTipo) return false;
      if (filtroData && !d.data_solicitacao?.startsWith(filtroData)) return false;
      if (busca) {
        const termo = busca.toLowerCase();
        return (
          d.motorista_placa?.toLowerCase().includes(termo) ||
          d.nome_recebedor?.toLowerCase().includes(termo) ||
          d.tipo?.toLowerCase().includes(termo) ||
          d.chave_pix?.toLowerCase().includes(termo) ||
          d.observacao?.toLowerCase().includes(termo)
        );
      }
      return true;
    }).sort((a, b) => new Date(b.data_solicitacao || b.criadoEm || 0) - new Date(a.data_solicitacao || a.criadoEm || 0));
  }, [despesas, filtroStatus, filtroPlaca, filtroTipo, filtroData, busca]);

  const handleAprovar = (id) => {
    if (confirm('Confirmar aprovação desta despesa? Lembre-se de realizar o pagamento PIX.')) {
      atualizarStatusDespesa(id, 'Aprovado');
    }
  };

  const handleRejeitar = (id) => {
    const motivo = prompt('Informe o motivo da recusa (opcional):');
    if (motivo !== null) {
      atualizarStatusDespesa(id, 'Rejeitado', motivo);
    }
  };

  const stats = useMemo(() => {
    const list = despesas || [];
    const totalVal = list.filter(d => d.status !== 'Rejeitado').reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
    const pendentesCount = list.filter(d => d.status === 'Pendente').length;
    const aprovadosCount = list.filter(d => d.status === 'Aprovado').length;
    const rejeitadosCount = list.filter(d => d.status === 'Rejeitado').length;
    return { totalVal, pendentesCount, aprovadosCount, rejeitadosCount };
  }, [despesas]);

  const temFiltroAtivo = filtroPlaca !== 'Todos' || filtroTipo !== 'Todos' || filtroData !== '' || busca !== '';

  const limparFiltros = () => {
    setFiltroPlaca('Todos');
    setFiltroTipo('Todos');
    setFiltroData('');
    setBusca('');
  };

  return (
    <div className="space-y-4 w-full pb-20">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <DollarSign className="text-info" /> Gestão de Custos / Despesas
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            Solicitações de reembolso e pagamentos extras da frota.
          </p>
        </div>
      </div>

      {/* Cards de Métricas Topo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-panel p-4 rounded-xl border-b-4 border-info">
          <p className="text-[10px] uppercase font-bold text-text-tertiary">Total em Custos</p>
          <p className="text-2xl font-black text-text-primary mt-1">R$ {stats.totalVal.toFixed(2)}</p>
          <p className="text-[11px] text-text-muted mt-0.5">Soma de aprovados e pendentes</p>
        </div>

        <div className="glass-panel p-4 rounded-xl border-b-4 border-warning">
          <p className="text-[10px] uppercase font-bold text-text-tertiary">Pendentes de Aprovação</p>
          <p className="text-2xl font-black text-warning mt-1">{stats.pendentesCount}</p>
          <p className="text-[11px] text-text-muted mt-0.5">Aguardando conferência</p>
        </div>

        <div className="glass-panel p-4 rounded-xl border-b-4 border-success">
          <p className="text-[10px] uppercase font-bold text-text-tertiary">Aprovados</p>
          <p className="text-2xl font-black text-success mt-1">{stats.aprovadosCount}</p>
          <p className="text-[11px] text-text-muted mt-0.5">Pagamentos autorizados</p>
        </div>

        <div className="glass-panel p-4 rounded-xl border-b-4 border-danger">
          <p className="text-[10px] uppercase font-bold text-text-tertiary">Rejeitados</p>
          <p className="text-2xl font-black text-danger mt-1">{stats.rejeitadosCount}</p>
          <p className="text-[11px] text-text-muted mt-0.5">Recusados pela gestão</p>
        </div>
      </div>

      {/* Painel de Filtros e Busca */}
      <div className="glass-panel p-4 rounded-xl border border-border-secondary space-y-3">
        {/* Linha 1: Busca e Data */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 flex items-center bg-background-primary border border-border-secondary rounded-lg px-3 py-1 focus-within:border-info">
            <Search size={18} className="text-text-tertiary mr-2 shrink-0" />
            <input 
              type="text" 
              placeholder="Buscar por placa, recebedor, motivo ou chave PIX..." 
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full text-sm bg-transparent border-none py-1.5 focus:ring-0 placeholder:text-text-tertiary/70 text-text-primary outline-none"
            />
            {busca && (
              <button onClick={() => setBusca('')} className="text-text-tertiary hover:text-text-primary p-1 cursor-pointer">
                <X size={16} />
              </button>
            )}
          </div>

          <div>
            <input
              type="date"
              value={filtroData}
              onChange={(e) => setFiltroData(e.target.value)}
              className="w-full px-3 py-2 bg-background-primary border border-border-secondary rounded-lg text-sm font-bold text-text-primary focus:ring-2 focus:ring-info outline-none"
            />
          </div>
        </div>

        {/* Linha 2: Filtros de Placa, Tipo e Botão de Limpar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1 border-t border-border-tertiary">
          {/* Filtro de Placa */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-text-tertiary mb-1">
              Placa do Veículo
            </label>
            <select
              value={filtroPlaca}
              onChange={(e) => setFiltroPlaca(e.target.value)}
              className="w-full bg-background-primary border border-border-secondary rounded-lg px-3 py-1.5 text-xs font-semibold text-text-primary focus:ring-2 focus:ring-info outline-none"
            >
              <option value="Todos">Todas as Placas</option>
              {listaPlacas.map(placa => (
                <option key={placa} value={placa}>{placa}</option>
              ))}
            </select>
          </div>

          {/* Filtro de Tipo de Despesa */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-text-tertiary mb-1">
              Tipo de Despesa
            </label>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="w-full bg-background-primary border border-border-secondary rounded-lg px-3 py-1.5 text-xs font-semibold text-text-primary focus:ring-2 focus:ring-info outline-none"
            >
              <option value="Todos">Todos os Tipos</option>
              {listaTipos.map(tipo => (
                <option key={tipo} value={tipo}>{tipo}</option>
              ))}
            </select>
          </div>

          {/* Botão Limpar Filtros */}
          <div className="flex items-end">
            {temFiltroAtivo ? (
              <button
                onClick={limparFiltros}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-background-secondary hover:bg-background-tertiary border border-border-secondary rounded-lg text-xs font-bold text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              >
                <X size={14} />
                <span>Limpar Filtros</span>
              </button>
            ) : (
              <div className="text-[11px] text-text-muted self-center">
                Filtros específicos desativados
              </div>
            )}
          </div>
        </div>

        {/* Linha 3: Status Pills */}
        <div className="flex gap-2 border-t border-border-tertiary pt-3 overflow-x-auto scrollbar-none">
          {[
            { id: 'Pendente', label: 'Pendentes', count: stats.pendentesCount },
            { id: 'Aprovado', label: 'Aprovados', count: stats.aprovadosCount },
            { id: 'Rejeitado', label: 'Rejeitados', count: stats.rejeitadosCount },
            { id: 'Todos', label: 'Todos', count: (despesas || []).length }
          ].map(st => (
            <button
              key={st.id}
              onClick={() => setFiltroStatus(st.id)}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5",
                filtroStatus === st.id 
                  ? "bg-info text-white shadow-xs" 
                  : "bg-background-secondary text-text-secondary hover:text-text-primary hover:bg-background-tertiary"
              )}
            >
              <span>{st.label}</span>
              <span className={cn(
                "px-1.5 py-0.2 rounded-full text-[10px] font-black",
                filtroStatus === st.id ? "bg-white/20 text-white" : "bg-background-tertiary text-text-tertiary"
              )}>
                {st.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Grade de Solicitações */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {despesasFiltradas.length === 0 ? (
          <div className="col-span-full text-center text-text-tertiary py-12 glass-panel rounded-xl">
            <DollarSign className="mx-auto h-12 w-12 mb-3 opacity-20" />
            <p className="text-sm font-medium">Nenhuma solicitação de despesa encontrada.</p>
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
                  {despesa.observacaoMonitoramento && (
                    <div className="mt-2 p-2 rounded-lg bg-background-primary/80 border border-border-tertiary text-xs">
                      <span className="text-text-tertiary font-bold uppercase text-[10px] block mb-0.5">Parecer do Monitoramento:</span>
                      <p className="text-text-secondary italic">"{despesa.observacaoMonitoramento}"</p>
                    </div>
                  )}
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

                {despesa.notas_vinculadas && despesa.notas_vinculadas.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border-tertiary">
                    <span className="text-[10px] text-text-tertiary font-bold uppercase block mb-1">Notas Vinculadas:</span>
                    <div className="flex flex-wrap gap-1">
                      {despesa.notas_vinculadas.map(nota => (
                        <span key={nota} className="inline-flex items-center gap-1 bg-background-secondary text-text-secondary border border-border-tertiary px-1.5 py-0.5 rounded text-[10px] font-bold">
                          <Package size={10} /> {nota}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
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
