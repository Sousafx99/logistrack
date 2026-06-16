import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Plus, RotateCcw, Search, Trash2, Edit2, Filter, Clock, User, Printer } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Badge } from '../components/ui/Badge';
import { MOTIVOS_DEVOLUCAO } from '../data/mockData';
import { cn } from '../lib/utils';

export function Devolucoes() {
  const { devolucoes, adicionarDevolucao, atualizarStatusDevolucao, removerDevolucao, editarDevolucao, currentUser } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [editandoDevolucao, setEditandoDevolucao] = useState(null);
  
  // Novos modais
  const [alterandoStatus, setAlterandoStatus] = useState(null);
  const [verHistorico, setVerHistorico] = useState(null);
  const [novaObservacaoStatus, setNovaObservacaoStatus] = useState('');
  const [novoStatusSelecionado, setNovoStatusSelecionado] = useState('');

  const { globalFilters, setGlobalFilters } = useStore();
  
  const busca = globalFilters.devolucoes.busca;
  const dataSelecionada = globalFilters.data;
  const placaSelecionada = globalFilters.devolucoes.placa;
  const statusSelecionado = globalFilters.devolucoes.status;

  const setBusca = (val) => setGlobalFilters({ devolucoes: { ...globalFilters.devolucoes, busca: val }});
  const setDataSelecionada = (val) => setGlobalFilters({ data: val });
  const setPlacaSelecionada = (val) => setGlobalFilters({ devolucoes: { ...globalFilters.devolucoes, placa: val }});
  const setStatusSelecionado = (val) => setGlobalFilters({ devolucoes: { ...globalFilters.devolucoes, status: val }});

  // Form State
  const [novaDevolucao, setNovaDevolucao] = useState({
    nota: '',
    tipo: 'Total',
    quantidadeKg: '',
    status: 'Pendente de recebimento',
    observacao: ''
  });

  const placasDisponiveis = useMemo(() => {
    const plates = new Set(devolucoes.filter(d => d.data.startsWith(dataSelecionada)).map(d => d.placa).filter(Boolean));
    return Array.from(plates).sort();
  }, [devolucoes, dataSelecionada]);

  const devolucoesFiltradas = useMemo(() => {
    return devolucoes.filter(d => {
      const matchData = d.data.startsWith(dataSelecionada);
      const matchPlaca = placaSelecionada ? d.placa === placaSelecionada : true;
      const matchStatus = statusSelecionado ? d.status === statusSelecionado : true;
      const term = busca.toLowerCase();
      const matchBusca = term ? (d.nota.includes(term) || d.status.toLowerCase().includes(term) || (d.placa && d.placa.toLowerCase().includes(term))) : true;
      
      return matchData && matchPlaca && matchStatus && matchBusca;
    });
  }, [devolucoes, dataSelecionada, placaSelecionada, statusSelecionado, busca]);

  const handleSubmit = (e) => {
    e.preventDefault();
    adicionarDevolucao({
      ...novaDevolucao,
      quantidadeKg: parseFloat(novaDevolucao.quantidadeKg)
    });
    setShowModal(false);
    setNovaDevolucao({
      nota: '', tipo: 'Total', quantidadeKg: '', status: 'Pendente de recebimento', observacao: ''
    });
  };

  const handleDelete = (id) => {
    if (confirm("Tem certeza que deseja remover este lançamento de devolução?")) {
      removerDevolucao(id);
    }
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    editarDevolucao(editandoDevolucao.id, {
      observacao: editandoDevolucao.observacao,
    });
    setEditandoDevolucao(null);
  };

  const handleStatusSubmit = (e) => {
    e.preventDefault();
    if (novoStatusSelecionado) {
      atualizarStatusDevolucao(alterandoStatus.id, novoStatusSelecionado, novaObservacaoStatus);
    }
    setAlterandoStatus(null);
    setNovaObservacaoStatus('');
    setNovoStatusSelecionado('');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Devoluções</h2>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-info text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center shadow-sm"
        >
          <Plus size={16} className="mr-1" /> Nova
        </button>
      </div>

      {/* Filtros */}
      <div className="glass-panel p-4 rounded-xl space-y-3">
        <div className="flex items-center text-xs uppercase font-bold text-text-tertiary mb-2">
          <Filter size={14} className="mr-1" /> Filtros
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-text-tertiary mb-1">Data</label>
            <input 
              type="date" 
              value={dataSelecionada}
              onChange={(e) => { setDataSelecionada(e.target.value); setPlacaSelecionada(''); }}
              className="w-full bg-background-primary border border-border-secondary rounded-lg px-3 py-2 text-sm focus:ring-info font-bold"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-text-tertiary mb-1">Placa</label>
            <select 
              value={placaSelecionada}
              onChange={(e) => setPlacaSelecionada(e.target.value)}
              className="w-full bg-background-primary border border-border-secondary rounded-lg px-3 py-2 text-sm focus:ring-info font-bold"
            >
              <option value="">Todas as Placas</option>
              {placasDisponiveis.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-text-tertiary mb-1">Status</label>
            <select 
              value={statusSelecionado}
              onChange={(e) => setStatusSelecionado(e.target.value)}
              className="w-full bg-background-primary border border-border-secondary rounded-lg px-3 py-2 text-sm focus:ring-info font-bold"
            >
              <option value="">Todos</option>
              <option value="Pendente de recebimento">Pendente de recebimento</option>
              <option value="Em conferência">Em conferência</option>
              <option value="Recebido">Recebido</option>
              <option value="Lançamento realizado">Lançamento realizado</option>
              <option value="Bloqueio">Bloqueio</option>
            </select>
          </div>
        </div>
        <div className="relative mt-2">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input 
            type="text" 
            placeholder="Buscar por NF, Placa..." 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-background-primary border border-border-secondary rounded-xl pl-10 pr-4 py-2 text-sm shadow-sm"
          />
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {devolucoesFiltradas.length === 0 ? (
          <div className="text-center text-text-tertiary py-8">
            <RotateCcw className="mx-auto h-10 w-10 mb-2 opacity-50" />
            <p>Nenhuma devolução encontrada.</p>
          </div>
        ) : (
          devolucoesFiltradas.map(dev => (
            <div key={dev.id} className={cn("glass-panel p-4 rounded-xl border-l-4", dev.tipo === 'Reentrega' ? 'border-warning shadow-[0_0_8px_rgba(245,158,11,0.1)]' : 'border-transparent')}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    {dev.placa && (
                      <span className="text-[10px] font-bold bg-background-secondary px-2 py-0.5 rounded text-text-secondary border border-border-tertiary">
                        {dev.placa}
                      </span>
                    )}
                    <h3 className="font-semibold">NF: {dev.nota}</h3>
                  </div>
                  <p className="text-xs text-text-secondary mt-1">{new Date(dev.data).toLocaleDateString('pt-BR')}</p>
                </div>
                <div className="text-right flex flex-col items-end">
                  <div className="flex gap-3 mb-2 items-center">
                    <button onClick={() => window.open(`/imprimir-guia/${dev.id}`, '_blank')} className="text-text-tertiary hover:text-text-primary transition-colors" title="Imprimir Guia"><Printer size={16} /></button>
                    {currentUser?.role !== 'Operacao' && (
                      <button onClick={() => setEditandoDevolucao(dev)} className="text-info hover:text-info/80 transition-colors" title="Editar Motivo"><Edit2 size={16} /></button>
                    )}
                    <button onClick={() => setVerHistorico(dev)} className="text-text-tertiary hover:text-text-primary transition-colors" title="Histórico"><Clock size={16} /></button>
                    <button onClick={() => handleDelete(dev.id)} className="text-danger hover:text-danger/80 transition-colors" title="Excluir"><Trash2 size={16} /></button>
                  </div>
                  <span className="block font-semibold text-danger">{(dev.quantidadeKg || 0).toFixed(3)} kg</span>
                  <span className="text-xs text-text-secondary font-medium">{dev.tipo}</span>
                </div>
              </div>
              
              {dev.itens && dev.itens.length > 0 && (
                <div className="mt-2 bg-background-secondary p-2 rounded-lg text-xs space-y-1">
                  <span className="font-bold text-text-primary block mb-1">Itens Devolvidos:</span>
                  {dev.itens.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-text-secondary">
                      <span className="truncate pr-2">- {item.descricao} ({item.codigo})</span>
                      <span className="flex-shrink-0 font-medium">{item.qtd} cx | {item.peso.toFixed(3)}kg</span>
                    </div>
                  ))}
                </div>
              )}

              {dev.observacao && (
                <p className="text-sm bg-background-secondary p-2 rounded-md mt-2 text-text-secondary italic border border-border-tertiary">
                  Motivo: "{dev.observacao}"
                </p>
              )}

              <div className="mt-4 pt-3 border-t border-border-tertiary flex items-center justify-between">
                <Badge status={dev.status === 'Pendente de recebimento' ? 'Pendente' : (dev.status === 'Recebido' || dev.status === 'Lançamento realizado') ? 'Entrega total' : dev.status === 'Em conferência' ? 'No cliente' : 'Devolução total'}>
                  {dev.status}
                </Badge>
                
                <button 
                  onClick={() => {
                    setAlterandoStatus(dev);
                    setNovoStatusSelecionado(dev.status);
                  }}
                  className="bg-info/10 text-info hover:bg-info/20 border border-info/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                >
                  Mudar Status
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Nova Devolução */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-background-primary w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border-tertiary flex justify-between items-center bg-background-secondary">
              <h3 className="font-semibold">Lançar Devolução</h3>
              <button onClick={() => setShowModal(false)} className="text-text-tertiary text-xl leading-none">&times;</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Nota Fiscal</label>
                  <input required type="text" value={novaDevolucao.nota} onChange={e => setNovaDevolucao({...novaDevolucao, nota: e.target.value})} className="w-full bg-background-secondary border-none rounded-lg p-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Tipo</label>
                  <select value={novaDevolucao.tipo} onChange={e => setNovaDevolucao({...novaDevolucao, tipo: e.target.value})} className="w-full bg-background-secondary border-none rounded-lg p-2 text-sm">
                    <option className="bg-slate-900 text-white">Total</option>
                    <option className="bg-slate-900 text-white">Parcial</option>
                    <option className="bg-slate-900 text-white">Devolução de gramatura</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Quantidade (kg)</label>
                <input required type="number" step="0.001" value={novaDevolucao.quantidadeKg} onChange={e => setNovaDevolucao({...novaDevolucao, quantidadeKg: e.target.value})} className="w-full bg-background-secondary border-none rounded-lg p-2 text-sm" placeholder="Ex: 18.5" />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Motivo / Observação</label>
                <select 
                  required
                  value={novaDevolucao.observacao} 
                  onChange={e => setNovaDevolucao({...novaDevolucao, observacao: e.target.value})} 
                  className="w-full bg-background-secondary border-none rounded-lg p-2 text-sm"
                >
                  <option value="" disabled>Selecione um motivo...</option>
                  {MOTIVOS_DEVOLUCAO.map(m => (
                    <option key={m} value={m} className="bg-slate-900 text-white">
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <button type="submit" className="w-full bg-info text-white font-semibold rounded-xl py-3 mt-2 hover:bg-info/90">
                Salvar Devolução
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Motivo */}
      {editandoDevolucao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-background-primary w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border-tertiary flex justify-between items-center bg-background-secondary">
              <h3 className="font-semibold">Editar Motivo (NF: {editandoDevolucao.nota})</h3>
              <button onClick={() => setEditandoDevolucao(null)} className="text-text-tertiary text-xl leading-none">&times;</button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Motivo Principal</label>
                <select 
                  required
                  value={editandoDevolucao.observacao} 
                  onChange={e => setEditandoDevolucao({...editandoDevolucao, observacao: e.target.value})} 
                  className="w-full bg-background-secondary border-none rounded-lg p-2 text-sm"
                >
                  <option value="" disabled>Selecione um motivo...</option>
                  <option value="Aguardando preenchimento do Monitoramento" className="bg-slate-900 text-warning font-bold">Pendente de preenchimento</option>
                  {MOTIVOS_DEVOLUCAO.map(m => (
                    <option key={m} value={m} className="bg-slate-900 text-white">
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <button type="submit" className="w-full bg-info text-white font-semibold rounded-xl py-3 mt-2 hover:bg-info/90">
                Salvar Alterações
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Alterar Status (Novo fluxo com Histórico) */}
      {alterandoStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-background-primary w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border-tertiary flex justify-between items-center bg-background-secondary">
              <h3 className="font-semibold">Alterar Status (NF: {alterandoStatus.nota})</h3>
              <button onClick={() => { setAlterandoStatus(null); setNovoStatusSelecionado(''); setNovaObservacaoStatus(''); }} className="text-text-tertiary text-xl leading-none">&times;</button>
            </div>
            
            <form onSubmit={handleStatusSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Novo Status</label>
                <select 
                  required
                  value={novoStatusSelecionado} 
                  onChange={e => setNovoStatusSelecionado(e.target.value)} 
                  className="w-full bg-background-secondary border-none rounded-lg p-2 text-sm font-semibold"
                >
                  <option value="" disabled>Selecione...</option>
                  <option value="Pendente de recebimento" className="bg-slate-900 text-white">Pendente de recebimento</option>
                  <option value="Em conferência" className="bg-slate-900 text-white">Em conferência</option>
                  <option value="Recebido" className="bg-slate-900 text-white">Recebido</option>
                  <option value="Lançamento realizado" className="bg-slate-900 text-white">Lançamento realizado</option>
                  <option value="Bloqueio" className="bg-slate-900 text-white">Bloqueio</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Observação Adicional (Opcional)</label>
                <textarea 
                  value={novaObservacaoStatus}
                  onChange={e => setNovaObservacaoStatus(e.target.value)}
                  className="w-full bg-background-secondary border-none rounded-lg p-3 text-sm h-24 resize-none focus:ring-1 focus:ring-info"
                  placeholder="Justifique a mudança de status se necessário..."
                />
              </div>

              <button type="submit" className="w-full bg-info text-white font-semibold rounded-xl py-3 mt-2 hover:bg-info/90 disabled:opacity-50 transition-opacity" disabled={!novoStatusSelecionado}>
                Confirmar Status
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ver Histórico */}
      {verHistorico && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-background-primary w-full max-w-md rounded-2xl shadow-xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="px-4 py-3 border-b border-border-tertiary flex justify-between items-center bg-background-secondary">
              <h3 className="font-semibold flex items-center gap-2"><Clock size={18} className="text-info" /> Histórico da Devolução</h3>
              <button onClick={() => setVerHistorico(null)} className="text-text-tertiary hover:text-text-primary text-xl leading-none">&times;</button>
            </div>
            
            <div className="p-4 overflow-y-auto space-y-4 flex-1 hide-scrollbar">
              <div className="mb-4">
                <span className="text-xs text-text-secondary uppercase font-bold block mb-1">Nota Fiscal</span>
                <span className="text-lg font-bold text-text-primary">{verHistorico.nota}</span>
              </div>

              {verHistorico.historico && verHistorico.historico.length > 0 ? (
                <div className="relative border-l-2 border-border-tertiary ml-2 pl-5 space-y-6">
                  {verHistorico.historico.map((hist, idx) => {
                    const isLast = idx === verHistorico.historico.length - 1;
                    return (
                      <div key={idx} className="relative">
                        {/* Timeline dot */}
                        <div className={cn(
                          "absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-background-primary",
                          isLast ? "bg-info" : "bg-text-tertiary"
                        )}></div>
                        
                        <div className="mb-1 flex justify-between items-start">
                          <Badge status={hist.status === 'Pendente de recebimento' ? 'Pendente' : (hist.status === 'Recebido' || hist.status === 'Lançamento realizado') ? 'Entrega total' : hist.status === 'Em conferência' ? 'No cliente' : 'Devolução total'}>
                            {hist.status}
                          </Badge>
                          <span className="text-[10px] text-text-tertiary font-medium">
                            {new Date(hist.data).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        
                        <div className="bg-background-secondary p-3 rounded-xl border border-border-tertiary mt-2">
                          <div className="flex items-center gap-1.5 mb-2 border-b border-border-tertiary/50 pb-2">
                            <User size={12} className="text-info" />
                            <span className="text-[10px] font-bold text-text-secondary uppercase">{hist.role || 'Desconhecido'}</span>
                          </div>
                          {hist.observacao ? (
                            <p className="text-xs text-text-primary leading-relaxed">"{hist.observacao}"</p>
                          ) : (
                            <p className="text-xs text-text-tertiary italic">Sem observações.</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10 text-text-tertiary text-sm glass-panel rounded-xl">
                  <Clock className="mx-auto mb-3 opacity-20" size={32} />
                  <p className="font-medium">Nenhum histórico registrado.</p>
                  <p className="text-xs opacity-70 mt-1">Devoluções antigas não possuem histórico.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
