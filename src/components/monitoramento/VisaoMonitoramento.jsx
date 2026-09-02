import { useState, useMemo } from 'react';
import { format, isBefore, parseISO, startOfDay } from 'date-fns';
import { Truck, MapPin, Package as PackageIcon, User, AlertTriangle, Filter, Search, FileText, Hash, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { STATUS_OPTIONS } from '../../data/mockData';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/utils';
import { DevolucaoModal } from '../ui/DevolucaoModal';

export function VisaoMonitoramento() {
  const { entregas, atualizarStatusEntrega, transferirPlaca, moverParaEstoque, registrarDevolucao, atualizarStatusEntregaEmMassa, transferirPlacaEmMassa, moverParaEstoqueEmMassa, toggleCanhotoEmMassa } = useStore();

  const { globalFilters, setGlobalFilters } = useStore();
  const datasSelecionadas = globalFilters.visaoMonitoramento.datas || [];
  const mostraTodas = datasSelecionadas.includes('TODAS');
  const datasEfetivas = mostraTodas ? [] : (datasSelecionadas.length > 0 ? datasSelecionadas : [globalFilters.data]);
  const placasSelecionadas = globalFilters.visaoMonitoramento.placas;
  const statusSelecionado = globalFilters.visaoMonitoramento.status;
  const buscaTexto = globalFilters.visaoMonitoramento.busca;

  const setDatasSelecionadas = (val) => setGlobalFilters({
    visaoMonitoramento: { ...globalFilters.visaoMonitoramento, datas: typeof val === 'function' ? val(datasSelecionadas) : val }
  });
  
  const toggleData = (d) => {
    let currentDatas = datasSelecionadas.filter(x => x !== 'TODAS');
    const newDatas = currentDatas.includes(d) 
      ? currentDatas.filter(x => x !== d) 
      : [...currentDatas, d];
      
    setGlobalFilters({
      visaoMonitoramento: {
        ...globalFilters.visaoMonitoramento,
        datas: newDatas,
        placas: []
      }
    });
  };

  const setPlacasSelecionadas = (val) => setGlobalFilters({ 
    visaoMonitoramento: { ...globalFilters.visaoMonitoramento, placas: typeof val === 'function' ? val(placasSelecionadas) : val }
  });
  const setStatusSelecionado = (val) => setGlobalFilters({ 
    visaoMonitoramento: { ...globalFilters.visaoMonitoramento, status: val }
  });
  const setBuscaTexto = (val) => setGlobalFilters({ 
    visaoMonitoramento: { ...globalFilters.visaoMonitoramento, busca: val }
  });
  
  const [expandidoId, setExpandidoId] = useState(null);
  const [clientesExpandidos, setClientesExpandidos] = useState({});
  const [acaoId, setAcaoId] = useState(null);
  const [novaPlaca, setNovaPlaca] = useState('');
  const [devolucaoEmAndamento, setDevolucaoEmAndamento] = useState(null);
  const [dateInputValue, setDateInputValue] = useState('');
  
  // Estados para Lote
  const [selectedNotas, setSelectedNotas] = useState([]);
  const [acaoLote, setAcaoLote] = useState(null);
  const [novoStatusLote, setNovoStatusLote] = useState('');
  const [novaPlacaLote, setNovaPlacaLote] = useState('');

  const toggleNota = (id) => {
    setSelectedNotas(prev => prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]);
  };

  const toggleGrupo = (grupoEntregas, e) => {
    e.stopPropagation();
    const ids = grupoEntregas.map(ent => ent.id);
    const allSelected = ids.every(id => selectedNotas.includes(id));
    if (allSelected) {
      setSelectedNotas(prev => prev.filter(id => !ids.includes(id)));
    } else {
      setSelectedNotas(prev => Array.from(new Set([...prev, ...ids])));
    }
  };

  const finalizadasSet = useMemo(() => new Set(['Entrega total', 'Entrega parcial', 'Devolução total', 'Reentrega', 'Carga parada']), []);

  const placasStats = useMemo(() => {
    const subset = mostraTodas ? entregas : entregas.filter(e => datasEfetivas.includes(e.data));
    const stats = {};
    
    subset.forEach(e => {
      const p = e.placa || 'Sem Placa';
      if (!stats[p]) {
        stats[p] = { total: 0, pendentes: 0, finalizadas: 0 };
      }
      stats[p].total += 1;
      if (finalizadasSet.has(e.status)) {
        stats[p].finalizadas += 1;
      } else {
        stats[p].pendentes += 1;
      }
    });
    return stats;
  }, [entregas, datasEfetivas, mostraTodas, finalizadasSet]);

  const placasDisponiveis = useMemo(() => {
    const subset = mostraTodas ? entregas : entregas.filter(e => datasEfetivas.includes(e.data));
    const plates = new Set(subset.map(e => e.placa).filter(Boolean));
    return Array.from(plates).sort((a, b) => {
      const pendA = placasStats[a]?.pendentes || 0;
      const pendB = placasStats[b]?.pendentes || 0;
      // Coloca em primeiro as placas com mais pendências
      if (pendA !== pendB) return pendB - pendA;
      return a.localeCompare(b);
    });
  }, [entregas, datasEfetivas, mostraTodas, placasStats]);

  const togglePlaca = (placa) => {
    setPlacasSelecionadas(prev => {
      if (prev.includes(placa)) return prev.filter(p => p !== placa);
      return [...prev, placa];
    });
  };

  const entregasFiltradas = useMemo(() => {
    let filtradas = entregas;
    if (!mostraTodas) {
      filtradas = filtradas.filter(e => datasEfetivas.includes(e.data));
    }

    // Se "Todas as Placas" estiver selecionado (sem placas marcadas manualmente):
    // Desconsidera placas que NÃO possuem nenhuma entrega pendente nas visualizações operacionais
    if (placasSelecionadas.length === 0) {
      if (statusSelecionado === 'Em Aberto' || statusSelecionado === 'Pendente') {
        filtradas = filtradas.filter(e => {
          const p = e.placa || 'Sem Placa';
          return (placasStats[p]?.pendentes || 0) > 0;
        });
      }
    } else {
      // Placas selecionadas explicitamente pelo usuário
      filtradas = filtradas.filter(e => placasSelecionadas.includes(e.placa));
    }

    const finalizadas = ['Entrega total', 'Entrega parcial', 'Devolução total', 'Reentrega', 'Carga parada'];
    filtradas = filtradas.filter(e => {
      const dataIso = e.data ? parseISO(e.data) : new Date();
      const isAtrasadaPendente = e.data ? isBefore(dataIso, startOfDay(new Date())) && !finalizadas.includes(e.status) : false;
      
      switch (statusSelecionado) {
        case 'Em Aberto': return !finalizadas.includes(e.status) || isAtrasadaPendente;
        case 'Pendente': return e.status === 'Pendente';
        case 'No cliente': return e.status === 'No cliente' || e.status === 'Descarregando';
        case 'Entregue': return e.status === 'Entrega total' || e.status === 'Carga parada';
        case 'Devolução': return e.status === 'Devolução total' || e.status === 'Entrega parcial';
        case 'Reentrega': return e.status === 'Reentrega';
        default: return true;
      }
    });

    if (buscaTexto.trim()) {
      const term = buscaTexto.toLowerCase();
      filtradas = filtradas.filter(e => 
        (e.rca?.toLowerCase() || '').includes(term) ||
        (e.codCliente?.toString() || '').includes(term) ||
        (e.pedido?.toString() || '').includes(term) ||
        (e.cliente?.toLowerCase() || '').includes(term) ||
        (e.nota?.toString() || '').includes(term)
      );
    }

    return [...filtradas].sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
  }, [entregas, placasSelecionadas, statusSelecionado, buscaTexto, datasEfetivas, mostraTodas, placasStats]);

  const stats = useMemo(() => {
    let baseEntregas = mostraTodas ? entregas : entregas.filter(e => datasEfetivas.includes(e.data));
    if (placasSelecionadas.length > 0) {
      baseEntregas = baseEntregas.filter(e => placasSelecionadas.includes(e.placa));
    }

    return {
      'Em Aberto': baseEntregas.filter(e => !finalizadasSet.has(e.status)).length,
      'Pendente': baseEntregas.filter(e => e.status === 'Pendente').length,
      'No cliente': baseEntregas.filter(e => ['No cliente', 'Descarregando'].includes(e.status)).length,
      'Entregue': baseEntregas.filter(e => ['Entrega total', 'Carga parada'].includes(e.status)).length,
      'Devolução': baseEntregas.filter(e => ['Devolução total', 'Entrega parcial'].includes(e.status)).length,
      'Reentrega': baseEntregas.filter(e => ['Reentrega'].includes(e.status)).length,
    };
  }, [entregas, placasSelecionadas, datasEfetivas, mostraTodas, finalizadasSet]);

  const clientesAgrupados = useMemo(() => {
    const map = new Map();
    entregasFiltradas.forEach(entrega => {
      const key = `${entrega.placa}-${entrega.codCliente || ''}-${entrega.cliente}`;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          codCliente: entrega.codCliente,
          cliente: entrega.cliente,
          bairro: entrega.bairro,
          placa: entrega.placa,
          entregas: []
        });
      }
      map.get(key).entregas.push(entrega);
    });

    const result = Array.from(map.values());
    
    result.forEach(grupo => {
      grupo.entregas.sort((a, b) => (Number(a.nota) || 0) - (Number(b.nota) || 0));
    });

    return result.sort((a, b) => {
      const minA = a.entregas[0] ? (Number(a.entregas[0].nota) || 0) : 0;
      const minB = b.entregas[0] ? (Number(b.entregas[0].nota) || 0) : 0;
      return minA - minB;
    });
  }, [entregasFiltradas]);

  const handleStatusChange = (entrega, novoStatus) => {
    if (novoStatus === 'Devolução total' || novoStatus === 'Entrega parcial') {
      const tipo = novoStatus === 'Devolução total' ? 'Total' : 'Parcial';
      setDevolucaoEmAndamento({ entrega, tipo });
    } else {
      atualizarStatusEntrega(entrega.id, novoStatus);
    }
  };

  const toggleDetalhes = (id) => setExpandidoId(expandidoId === id ? null : id);
  const toggleCliente = (id) => setClientesExpandidos(prev => ({...prev, [id]: !prev[id]}));

  return (
    <div className="space-y-4 pb-20">
      
      {/* Filtro de Datas Múltiplas */}
      <div className="glass-panel p-4 rounded-xl space-y-3">
        <label className="text-xs uppercase font-bold text-text-tertiary flex items-center mb-2">
          Filtro de Datas
        </label>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={() => setGlobalFilters({
              visaoMonitoramento: {
                ...globalFilters.visaoMonitoramento,
                datas: mostraTodas ? [] : ['TODAS'],
                placas: []
              }
            })}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
              mostraTodas 
                ? "bg-primary text-white border-primary shadow-md shadow-primary/20" 
                : "bg-background-secondary text-text-secondary border-border-tertiary hover:bg-border-tertiary"
            )}
          >
            Todas as Datas
          </button>
          
          {!mostraTodas && datasSelecionadas.map(d => (
            <div key={d} className="bg-info text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-2">
              {new Date(d).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}
              <button onClick={() => toggleData(d)} className="hover:text-white/70">
                <X size={14} />
              </button>
            </div>
          ))}
          {!mostraTodas && datasSelecionadas.length === 0 && (
            <div className="bg-background-secondary border border-border-secondary text-text-secondary text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-2">
              {new Date(globalFilters.data).toLocaleDateString('pt-BR', {timeZone: 'UTC'})} (Dia Atual)
            </div>
          )}
          
          {!mostraTodas && (
            <input 
              type="date" 
              value={dateInputValue}
              onChange={(e) => {
                const val = e.target.value;
                setDateInputValue(val);
                if (val && !datasSelecionadas.includes(val)) {
                  toggleData(val);
                  setTimeout(() => setDateInputValue(''), 100);
                }
              }}
              className="bg-transparent border border-dashed border-border-tertiary text-text-secondary rounded-lg px-2 py-1.5 text-xs focus:ring-info font-bold outline-none"
              title="Adicionar Data"
            />
          )}
        </div>
      </div>

      {/* Filtro de Placas */}
      <div className="glass-panel p-4 rounded-xl space-y-3">
        <div className="flex justify-between items-center">
          <label className="text-xs uppercase font-bold text-text-tertiary flex items-center">
            <Truck size={14} className="mr-1.5" />
            Filtrar por Placa
          </label>
          <span className="text-[11px] text-text-tertiary font-medium">
            {placasSelecionadas.length === 0 ? "Mostrando apenas veículos com entregas pendentes" : `${placasSelecionadas.length} placa(s) selecionada(s)`}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setPlacasSelecionadas([])}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5",
              placasSelecionadas.length === 0 
                ? "bg-primary text-white border-primary shadow-md shadow-primary/20" 
                : "bg-background-secondary text-text-secondary border-border-tertiary hover:bg-border-tertiary"
            )}
          >
            <span>Todas as Placas</span>
            {(() => {
              const totalEmRota = Object.values(placasStats).filter(s => s.pendentes > 0).length;
              return (
                <span className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                  placasSelecionadas.length === 0 ? "bg-white/20 text-white" : "bg-border-tertiary text-text-secondary"
                )}>
                  {totalEmRota} ativas
                </span>
              );
            })()}
          </button>
          {placasDisponiveis.map(placa => {
            const isSelected = placasSelecionadas.includes(placa);
            const pendentes = placasStats[placa]?.pendentes || 0;
            const total = placasStats[placa]?.total || 0;
            const isConcluido = pendentes === 0 && total > 0;

            return (
              <button
                key={placa}
                onClick={() => togglePlaca(placa)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5",
                  isSelected 
                    ? "bg-info text-white border-info shadow-md shadow-info/20" 
                    : isConcluido
                      ? "bg-success/10 text-success border-success/30 hover:bg-success/20"
                      : "bg-background-secondary text-text-secondary border-border-tertiary hover:bg-border-tertiary"
                )}
                title={isConcluido ? "Todas as entregas concluídas" : `${pendentes} de ${total} entregas pendentes`}
              >
                <span>{placa}</span>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                  isSelected
                    ? "bg-white/20 text-white"
                    : isConcluido
                      ? "bg-success text-white"
                      : "bg-warning/20 text-warning border border-warning/40"
                )}>
                  {isConcluido ? "✓ 0" : pendentes}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Barra de Busca Livre */}
      <div className="glass-panel px-3 py-2.5 rounded-xl flex items-center border border-border-secondary focus-within:border-info focus-within:ring-1 focus-within:ring-info transition-all">
        <Search size={18} className="text-text-tertiary mr-2 flex-shrink-0" />
        <input 
          type="text" 
          placeholder="Buscar RCA, Cód. Cliente, Pedido, Nome..." 
          value={buscaTexto}
          onChange={(e) => setBuscaTexto(e.target.value)}
          className="w-full text-sm bg-transparent border-none px-1 py-1 focus:ring-0 placeholder:text-text-tertiary/70"
        />
        {buscaTexto && (
          <button onClick={() => setBuscaTexto('')} className="text-text-tertiary hover:text-text-primary p-1">
            &times;
          </button>
        )}
      </div>

      {/* Chips de Filtro de Status */}
      <div className="flex space-x-2 overflow-x-auto hide-scrollbar pb-1">
        {['Em Aberto', 'Pendente', 'No cliente', 'Entregue', 'Devolução', 'Reentrega'].map(visao => (
          <button
            key={visao}
            onClick={() => setStatusSelecionado(visao)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors",
              statusSelecionado === visao 
                ? "bg-info text-white border-info shadow-sm" 
                : "bg-background-primary text-text-secondary border-border-tertiary hover:bg-background-secondary"
            )}
          >
            {visao} ({stats[visao] || 0})
          </button>
        ))}
      </div>

      {/* Selecionar Tudo */}
      {clientesAgrupados.length > 0 && (
        <div className="flex justify-between items-center px-2 mt-4">
          <label className="flex items-center space-x-2 cursor-pointer text-sm font-bold text-text-secondary hover:text-text-primary transition-colors">
            <input 
              type="checkbox"
              checked={entregasFiltradas.length > 0 && entregasFiltradas.every(e => selectedNotas.includes(e.id))}
              onChange={(e) => {
                if (e.target.checked) {
                  const todosIds = entregasFiltradas.map(e => e.id);
                  const novos = [...new Set([...selectedNotas, ...todosIds])];
                  setSelectedNotas(novos);
                } else {
                  const idsParaRemover = entregasFiltradas.map(e => e.id);
                  setSelectedNotas(selectedNotas.filter(id => !idsParaRemover.includes(id)));
                }
              }}
              className="w-4 h-4 rounded border-border-tertiary text-info focus:ring-info bg-background-primary cursor-pointer transition-all"
            />
            <span>Selecionar Todas as Visíveis ({entregasFiltradas.length})</span>
          </label>
        </div>
      )}

      {/* Grid de Entregas (Agrupado por Cliente) */}
      <div className="space-y-4 mt-2">
        {clientesAgrupados.length === 0 ? (
          <div className="text-center text-text-tertiary py-10 glass-panel rounded-xl">
            <Filter className="mx-auto h-12 w-12 mb-3 opacity-20" />
            <p className="text-sm font-medium">Nenhum resultado encontrado para estes filtros.</p>
            <button 
              onClick={() => { setPlacasSelecionadas([]); setStatusSelecionado('Em Aberto'); setBuscaTexto(''); }}
              className="mt-4 text-xs font-bold text-info hover:underline"
            >
              Limpar Filtros
            </button>
          </div>
        ) : (
          clientesAgrupados.map(grupo => {
            const pesoTotal = grupo.entregas.reduce((acc, curr) => acc + (Number(curr.peso) || 0), 0);
            const isAtrasada = grupo.entregas.some(e => e.data && isBefore(parseISO(e.data), startOfDay(new Date())));
            const isExpanded = !!clientesExpandidos[grupo.id];

            return (
              <div key={grupo.id} className={cn(
                "glass-panel rounded-xl transition-all overflow-hidden border-2",
                isAtrasada ? 'border-danger/50 shadow-[0_0_8px_rgba(239,68,68,0.2)]' : 'border-info/20'
              )}>
                {/* Cabeçalho do Cliente (Monitoramento) */}
                <div 
                  onClick={() => toggleCliente(grupo.id)}
                  className="bg-background-secondary/50 p-4 border-b border-border-secondary flex items-start cursor-pointer hover:bg-background-secondary/70 transition-colors"
                >
                   <div className="mr-3 mt-1" onClick={e => e.stopPropagation()}>
                      <input 
                         type="checkbox" 
                         checked={grupo.entregas.length > 0 && grupo.entregas.every(e => selectedNotas.includes(e.id))}
                         onChange={(e) => toggleGrupo(grupo.entregas, e)}
                         className="w-3.5 h-3.5 rounded-full border-border-tertiary text-info focus:ring-info bg-background-primary cursor-pointer transition-all"
                      />
                   </div>
                   <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-bold bg-background-primary px-2 py-0.5 rounded text-text-secondary border border-border-tertiary shadow-sm">
                          {grupo.placa}
                        </span>
                      </div>
                      <h3 className="font-bold text-text-primary text-base leading-tight mb-1">{grupo.cliente}</h3>
                      <div className="flex flex-wrap gap-2 text-xs text-text-secondary mt-2">
                        <div className="flex items-center"><Hash size={14} className="mr-1 opacity-70 text-info" /> {grupo.codCliente || 'S/N'}</div>
                        <div className="flex items-center"><MapPin size={14} className="mr-1 opacity-70 text-warning" /> {grupo.bairro}</div>
                      </div>
                   </div>
                   <div className="text-right pl-2 shrink-0 flex flex-col items-end">
                      <span className="block font-black text-info text-lg leading-none">{pesoTotal.toFixed(1)} <span className="text-[10px] font-bold text-text-tertiary">kg</span></span>
                      <span className="text-[10px] uppercase font-bold text-text-tertiary mt-1">{grupo.entregas.length} {grupo.entregas.length === 1 ? 'nota' : 'notas'}</span>
                      <div className="mt-2 bg-background-primary p-1 rounded-md border border-border-tertiary">
                        {isExpanded ? <ChevronUp size={16} className="text-text-primary" /> : <ChevronDown size={16} className="text-text-primary" />}
                      </div>
                   </div>
                </div>

                {/* Lista de Notas Fiscais */}
                {isExpanded && (
                <div className="p-3 space-y-3 bg-background-primary/30">
                  {grupo.entregas.map(entrega => {
                    const isExpanded = expandidoId === entrega.id;
                    const entregaAtrasada = entrega.data ? isBefore(parseISO(entrega.data), startOfDay(new Date())) : false;

                    return (
                      <div key={entrega.id} className={cn(
                        "bg-background-secondary rounded-lg p-3 border relative pl-10",
                        entregaAtrasada ? 'border-danger/30 shadow-sm' : 'border-border-tertiary',
                        selectedNotas.includes(entrega.id) ? 'border-info/50 shadow-[0_0_8px_rgba(56,189,248,0.15)]' : ''
                      )}>
                         <div className="absolute left-3 top-3">
                            <input 
                               type="checkbox" 
                               checked={selectedNotas.includes(entrega.id)}
                               onChange={() => toggleNota(entrega.id)}
                               className="w-3.5 h-3.5 rounded-full border-border-tertiary text-info focus:ring-info bg-background-primary cursor-pointer transition-all"
                            />
                         </div>

                         {entregaAtrasada && (
                           <div className="flex items-center text-danger text-[10px] mb-2 font-bold uppercase tracking-wider">
                             <AlertTriangle size={12} className="mr-1 flex-shrink-0" />
                             Nota Antiga ({format(parseISO(entrega.data), 'dd/MM/yyyy')})
                           </div>
                         )}

                         <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center space-x-2">
                               <h4 className="font-bold text-text-primary text-sm">NF: {entrega.nota}</h4>
                               <Badge status={entrega.status}>{entrega.status}</Badge>
                            </div>
                            <span className="font-bold text-text-primary text-xs">{entrega.peso.toFixed(1)} kg</span>
                         </div>
                         
                         <div className="flex gap-4 text-[11px] text-text-tertiary mb-3 font-medium">
                            <div className="flex items-center"><FileText size={12} className="mr-1 opacity-70" /> Ped: {entrega.pedido || 'N/A'}</div>
                            <div className="flex items-center"><User size={12} className="mr-1 opacity-70" /> RCA: {entrega.rca || 'N/A'}</div>
                            <div className="flex items-center"><PackageIcon size={12} className="mr-1 opacity-70" /> Carga: {entrega.carga || 'N/A'}</div>
                         </div>

                          <div className="mb-3">
                            <button 
                              onClick={() => toggleDetalhes(entrega.id)}
                              className="flex items-center justify-between w-full text-xs font-bold text-text-secondary bg-background-primary rounded-lg px-3 py-2 hover:bg-border-tertiary transition-colors border border-border-secondary"
                            >
                              <span className="flex items-center">
                                <PackageIcon size={14} className="mr-2 text-info" /> 
                                Ver Itens {entrega.itens?.length ? `(${entrega.itens.length})` : ''}
                              </span>
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                            
                            {isExpanded && (
                              <div className="mt-2 bg-background-primary rounded-lg p-3 space-y-2 border border-border-secondary">
                                {entrega.itens && entrega.itens.length > 0 ? (
                                  entrega.itens.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-xs border-b border-border-tertiary last:border-0 pb-2 last:pb-0">
                                      <div className="flex-1 pr-2">
                                        <span className="font-semibold block text-text-primary">{item.descricao}</span>
                                        <span className="text-text-tertiary text-[10px] font-medium">Cód: {item.codigo}</span>
                                      </div>
                                      <div className="text-right flex-shrink-0">
                                        <span className="block font-bold text-text-primary">{item.qtd} cx</span>
                                        <span className="text-text-tertiary text-[10px] font-medium">{item.peso.toFixed(3)} kg</span>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-[11px] text-text-tertiary text-center py-2 font-medium">Sem itens detalhados</div>
                                )}

                                {entrega.historico && entrega.historico.length > 0 && (
                                  <div className="mt-4 pt-3 border-t border-border-tertiary">
                                    <h5 className="text-[10px] uppercase font-bold text-text-tertiary mb-2 flex items-center gap-1">
                                      <FileText size={10} /> Histórico de Alterações
                                    </h5>
                                    <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                                      {entrega.historico.map((h, hIdx) => (
                                        <div key={hIdx} className="text-[11px] pl-2 border-l-2 border-border-tertiary">
                                          <div className="flex justify-between items-start mb-0.5">
                                            <span className="font-semibold text-text-primary">{h.status}</span>
                                            <span className="text-[9px] text-text-tertiary whitespace-nowrap ml-2">
                                              {new Date(h.data).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                          </div>
                                          <div className="text-text-secondary text-[10px] leading-tight mt-0.5">
                                            <span className="font-medium mr-1 text-text-primary">{h.role}:</span>
                                            {h.observacao}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Ações da Operação */}
                          <div className="pt-3 border-t border-border-secondary">
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <label className="text-[10px] uppercase font-bold text-text-tertiary block mb-1">Status da NF</label>
                                <select 
                                  value={entrega.status}
                                  onChange={(e) => handleStatusChange(entrega, e.target.value)}
                                  className="w-full bg-background-primary border border-border-secondary rounded-lg px-2 py-2 text-[11px] text-text-primary font-bold focus:ring-2 focus:ring-info"
                                >
                                  {STATUS_OPTIONS.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              </div>
                              
                              <div className="flex-[1.2]">
                                <label className="text-[10px] uppercase font-bold text-text-tertiary block mb-1">Placa</label>
                                {acaoId === entrega.id ? (
                                  <div className="flex gap-1 h-[34px]">
                                    <input 
                                      type="text" 
                                      placeholder="Placa" 
                                      className="w-full bg-background-primary border border-info rounded-lg px-2 text-[11px] uppercase focus:ring-1 focus:ring-info font-bold"
                                      value={novaPlaca}
                                      onChange={(e) => setNovaPlaca(e.target.value.toUpperCase())}
                                    />
                                    <button 
                                      onClick={() => {
                                        if(novaPlaca) transferirPlaca(entrega.id, novaPlaca);
                                        setAcaoId(null);
                                        setNovaPlaca('');
                                      }}
                                      className="bg-info text-white px-2 rounded-lg text-[11px] font-bold"
                                    >
                                      OK
                                    </button>
                                  </div>
                                ) : (
                                  <button 
                                    onClick={() => setAcaoId(entrega.id)}
                                    className="w-full h-[34px] text-[11px] font-bold text-info bg-info/10 rounded-lg hover:bg-info/20 transition-colors border border-info/20"
                                  >
                                    Transf. Placa
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                      </div>
                    );
                  })}
                </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {devolucaoEmAndamento && (
        <DevolucaoModal 
          isOpen={true}
          entrega={devolucaoEmAndamento.entrega}
          tipo={devolucaoEmAndamento.tipo}
          onClose={() => setDevolucaoEmAndamento(null)}
          onConfirm={(tipo, itens, motivo) => {
            registrarDevolucao(devolucaoEmAndamento.entrega.id, tipo, itens, motivo);
            setDevolucaoEmAndamento(null);
          }}
        />
      )}

      {/* Floating Action Bar (Lote) */}
      {selectedNotas.length > 0 && (
        <div className="fixed bottom-20 left-4 right-4 bg-background-primary shadow-xl border border-info rounded-xl p-3 flex flex-wrap gap-2 items-center justify-between z-40 animate-in slide-in-from-bottom-5">
          <div className="text-sm font-bold text-info flex items-center">
             <span className="bg-info text-white w-6 h-6 rounded-full flex items-center justify-center mr-2">{selectedNotas.length}</span>
             <span className="hidden sm:inline">Selecionadas</span>
          </div>
          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
             <button onClick={() => setAcaoLote('status')} className="bg-info text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-md whitespace-nowrap">Status</button>
             <button onClick={() => setAcaoLote('placa')} className="bg-info text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-md whitespace-nowrap">Transf.</button>
             <button onClick={() => { toggleCanhotoEmMassa(selectedNotas, true); setSelectedNotas([]); }} className="bg-info text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-md whitespace-nowrap">Canhoto OK</button>
             <button onClick={() => setSelectedNotas([])} className="text-text-tertiary px-2 py-1.5 rounded-lg text-xs font-bold hover:bg-border-tertiary flex-shrink-0"><X size={16}/></button>
          </div>
        </div>
      )}

      {/* Modais de Lote */}
      {acaoLote === 'status' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background-primary rounded-xl w-full max-w-sm p-4 border border-border-secondary shadow-2xl">
            <h3 className="text-lg font-black text-text-primary mb-4">Alterar Status em Lote</h3>
            <select 
               value={novoStatusLote}
               onChange={(e) => setNovoStatusLote(e.target.value)}
               className="w-full bg-background-secondary border border-border-tertiary rounded-lg p-2 mb-4 text-sm font-bold text-text-primary focus:ring-2 focus:ring-info"
            >
               <option value="">Selecione o novo status...</option>
               {STATUS_OPTIONS.filter(o => o !== 'Entrega parcial').map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
               ))}
            </select>
            <div className="flex justify-end gap-2">
               <button onClick={() => { setAcaoLote(null); setNovoStatusLote(''); }} className="px-4 py-2 text-xs font-bold text-text-secondary hover:bg-border-tertiary rounded-lg transition-colors">Cancelar</button>
               <button onClick={async () => {
                  if(novoStatusLote) {
                     if(novoStatusLote === 'Devolução total') {
                         await Promise.all(selectedNotas.map(id => registrarDevolucao(id, 'Total', [], 'Devolução em lote')));
                     } else {
                         await atualizarStatusEntregaEmMassa(selectedNotas, novoStatusLote);
                     }
                     setSelectedNotas([]);
                     setAcaoLote(null);
                     setNovoStatusLote('');
                  }
               }} className="bg-info text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md hover:brightness-110">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {acaoLote === 'placa' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background-primary rounded-xl w-full max-w-sm p-4 border border-border-secondary shadow-2xl">
            <h3 className="text-lg font-black text-text-primary mb-4">Transferir Placa em Lote</h3>
            <input 
               type="text" 
               placeholder="Digite a nova placa" 
               value={novaPlacaLote}
               onChange={(e) => setNovaPlacaLote(e.target.value.toUpperCase())}
               className="w-full bg-background-secondary border border-border-tertiary rounded-lg p-2 mb-4 text-sm font-bold text-text-primary focus:ring-2 focus:ring-info uppercase"
            />
            <div className="flex justify-end gap-2">
               <button onClick={() => { setAcaoLote(null); setNovaPlacaLote(''); }} className="px-4 py-2 text-xs font-bold text-text-secondary hover:bg-border-tertiary rounded-lg transition-colors">Cancelar</button>
               <button onClick={async () => {
                  if(novaPlacaLote) {
                     await transferirPlacaEmMassa(selectedNotas, novaPlacaLote);
                     setSelectedNotas([]);
                     setAcaoLote(null);
                     setNovaPlacaLote('');
                  }
               }} className="bg-info text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md hover:brightness-110">Confirmar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
