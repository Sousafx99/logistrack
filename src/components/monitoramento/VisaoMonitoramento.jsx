import { useState, useMemo, useRef } from 'react';
import { format, isBefore, parseISO, startOfDay } from 'date-fns';
import { Truck, MapPin, Package as PackageIcon, User, AlertTriangle, Filter, Search, FileText, Hash, X, ChevronDown, ChevronUp, Gauge, Clock, Timer, CheckCircle2, LayoutGrid, List, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { STATUS_OPTIONS } from '../../data/mockData';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/utils';
import { DevolucaoModal } from '../ui/DevolucaoModal';
import { VisaoCardsVeiculos } from './VisaoCardsVeiculos';

const formatarHora = (isoStr) => {
  if (!isoStr) return '--:--';
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
};

const formatarDuracao = (minutos) => {
  if (minutos === null || minutos === undefined || isNaN(minutos)) return null;
  const m = Math.max(0, Math.round(minutos));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem} min`;
  return `${h}h ${rem}min`;
};

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
  const [modoVisualizacao, setModoVisualizacao] = useState('veiculos');
  
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
      const p = (e.placa || '').trim().toUpperCase();
      if (!p || p === 'SEM PLACA' || p === 'NULL' || p === 'UNDEFINED') return;
      if (!stats[p]) {
        stats[p] = { total: 0, pendentes: 0, finalizadas: 0, cargaParada: 0 };
      }
      stats[p].total += 1;
      if (e.status === 'Carga parada') {
        stats[p].cargaParada += 1;
        stats[p].finalizadas += 1;
      } else if (finalizadasSet.has(e.status)) {
        stats[p].finalizadas += 1;
      } else {
        stats[p].pendentes += 1;
      }
    });
    return stats;
  }, [entregas, datasEfetivas, mostraTodas, finalizadasSet]);

  const placasDisponiveis = useMemo(() => {
    const subset = mostraTodas ? entregas : entregas.filter(e => datasEfetivas.includes(e.data));
    const plates = new Set(
      subset
        .map(e => (e.placa || '').trim().toUpperCase())
        .filter(p => p && p !== 'SEM PLACA' && p !== 'NULL' && p !== 'UNDEFINED')
    );
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
          const p = (e.placa || '').trim().toUpperCase();
          if (!p || p === 'SEM PLACA') return false;
          return (placasStats[p]?.pendentes || 0) > 0;
        });
      }
    } else {
      // Placas selecionadas explicitamente pelo usuário
      filtradas = filtradas.filter(e => placasSelecionadas.includes((e.placa || '').trim().toUpperCase()));
    }

    const finalizadas = ['Entrega total', 'Entrega parcial', 'Devolução total', 'Reentrega', 'Carga parada'];
    filtradas = filtradas.filter(e => {
      const dataIso = e.data ? parseISO(e.data) : new Date();
      const isAtrasadaPendente = e.data ? isBefore(dataIso, startOfDay(new Date())) && !finalizadas.includes(e.status) : false;
      
      switch (statusSelecionado) {
        case 'Em Aberto': return !finalizadas.includes(e.status) || isAtrasadaPendente;
        case 'Pendente': return e.status === 'Pendente';
        case 'No cliente': return e.status === 'No cliente' || e.status === 'Descarregando';
        case 'Entregue': return e.status === 'Entrega total';
        case 'Carga parada': return e.status === 'Carga parada';
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
      baseEntregas = baseEntregas.filter(e => placasSelecionadas.includes((e.placa || '').trim().toUpperCase()));
    }

    return {
      'Em Aberto': baseEntregas.filter(e => !finalizadasSet.has(e.status)).length,
      'Pendente': baseEntregas.filter(e => e.status === 'Pendente').length,
      'No cliente': baseEntregas.filter(e => ['No cliente', 'Descarregando'].includes(e.status)).length,
      'Entregue': baseEntregas.filter(e => e.status === 'Entrega total').length,
      'Carga parada': baseEntregas.filter(e => e.status === 'Carga parada').length,
      'Devolução': baseEntregas.filter(e => ['Devolução total', 'Entrega parcial'].includes(e.status)).length,
      'Reentrega': baseEntregas.filter(e => e.status === 'Reentrega').length,
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

  const totalVeiculosFiltrados = useMemo(() => {
    const plates = new Set(
      entregasFiltradas
        .map(e => (e.placa || '').trim().toUpperCase())
        .filter(p => p && p !== 'SEM PLACA' && p !== 'NULL' && p !== 'UNDEFINED')
    );
    return plates.size;
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
    <div className="space-y-4 w-full pb-20">
      
      {/* TOOLBAR UNIFICADA (BUSCA + DATAS + STATUS + CARROSSEL DE PLACAS) */}
      <div className="glass-panel p-3.5 rounded-2xl border border-border-secondary/80 shadow-md space-y-3">
        
        {/* LINHA 1: BUSCA AMPLA + FILTRO DE DATA RÁPIDO */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Campo de Busca Livre */}
          <div className="flex-1 flex items-center bg-background-secondary/70 border border-border-secondary px-3 py-1.5 rounded-xl focus-within:border-info focus-within:ring-1 focus-within:ring-info transition-all shadow-inner">
            <Search size={16} className="text-text-tertiary mr-2.5 flex-shrink-0" />
            <input 
              type="text" 
              placeholder="Buscar RCA, Cód. Cliente, Pedido, Cliente, NF..." 
              value={buscaTexto}
              onChange={(e) => setBuscaTexto(e.target.value)}
              className="w-full text-xs font-medium bg-transparent border-none p-0 focus:ring-0 placeholder:text-text-tertiary/70 text-text-primary outline-none"
            />
            {buscaTexto && (
              <button 
                onClick={() => setBuscaTexto('')} 
                className="text-text-tertiary hover:text-text-primary p-0.5 rounded transition-colors text-xs font-bold"
                title="Limpar busca"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filtro de Datas Integrado */}
          <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => setGlobalFilters({
                visaoMonitoramento: {
                  ...globalFilters.visaoMonitoramento,
                  datas: mostraTodas ? [] : ['TODAS'],
                  placas: []
                }
              })}
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border whitespace-nowrap shadow-sm",
                mostraTodas 
                  ? "bg-primary text-white border-primary shadow-primary/20" 
                  : "bg-background-secondary text-text-secondary border-border-tertiary hover:bg-border-tertiary hover:text-text-primary"
              )}
            >
              Todas as Datas
            </button>

            {!mostraTodas && datasSelecionadas.map(d => (
              <div key={d} className="bg-info text-white text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm whitespace-nowrap">
                <span>{new Date(d).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</span>
                <button onClick={() => toggleData(d)} className="hover:text-white/70" title="Remover data">
                  <X size={12} />
                </button>
              </div>
            ))}

            {!mostraTodas && datasSelecionadas.length === 0 && (
              <div className="bg-background-secondary border border-border-secondary text-text-secondary text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 whitespace-nowrap">
                <Calendar size={13} className="text-info" />
                <span>{new Date(globalFilters.data).toLocaleDateString('pt-BR', {timeZone: 'UTC'})} (Hoje)</span>
              </div>
            )}

            {!mostraTodas && (
              <div className="relative flex items-center" title="Selecionar outra data">
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
                  className="bg-background-secondary/80 border border-dashed border-border-tertiary text-text-secondary rounded-lg px-2 py-1 text-xs focus:ring-info font-bold outline-none cursor-pointer hover:border-info transition-colors"
                />
              </div>
            )}
          </div>
        </div>

        {/* LINHA 2: FILTRO DE PLACAS ADAPTÁVEL (ESTILO PLACAS VEICULARES - CENTRALIZADO) */}
        <div className="pt-2.5 border-t border-border-secondary/60 flex flex-wrap items-center justify-center gap-1.5">
          {/* Botão Todas as Placas */}
          <button
            onClick={() => setPlacasSelecionadas([])}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-2 whitespace-nowrap shadow-sm font-mono",
              placasSelecionadas.length === 0 
                ? "bg-primary text-white border-primary shadow-primary/20" 
                : "bg-background-secondary text-text-secondary border-border-tertiary hover:bg-border-tertiary hover:text-text-primary"
            )}
          >
            <Truck size={13} className={placasSelecionadas.length === 0 ? "text-white" : "text-primary"} />
            <span>Todas as Placas</span>
            {(() => {
              const totalEmRota = Object.entries(placasStats).filter(([placa, s]) => placa && s.pendentes > 0).length;
              return (
                <span className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded font-bold font-sans",
                  placasSelecionadas.length === 0 ? "bg-white/20 text-white" : "bg-border-tertiary text-text-secondary"
                )}>
                  {totalEmRota} ativas
                </span>
              );
            })()}
          </button>

          {/* Badges de Placas Individuais (Estilo Placa Veicular / Mono) */}
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
                  "px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 whitespace-nowrap shadow-sm font-mono tracking-wider",
                  isSelected 
                    ? "bg-info text-white border-info shadow-info/20 ring-1 ring-info" 
                    : isConcluido
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                      : "bg-background-secondary text-text-primary border-border-tertiary hover:bg-border-tertiary hover:border-text-tertiary"
                )}
                title={isConcluido ? `${placa}: Todas as entregas concluídas` : `${placa}: ${pendentes} de ${total} entregas pendentes`}
              >
                <span>{placa}</span>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded font-bold font-sans",
                  isSelected
                    ? "bg-white/20 text-white"
                    : isConcluido
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                )}>
                  {isConcluido ? "✓ 0" : pendentes}
                </span>
              </button>
            );
          })}
        </div>

        {/* LINHA 3: CHIPS DE STATUS OPERACIONAL (PILLS OVAIS COM PONTOS COLORIDOS - CENTRALIZADO & ADAPTÁVEL) */}
        <div className="pt-2 border-t border-border-secondary/60 flex flex-wrap items-center justify-center gap-1.5">
          {[
            { label: 'Em Aberto', key: 'Em Aberto', dot: 'bg-primary', activeClass: 'bg-primary/20 text-primary-light border-primary/60 ring-1 ring-primary/40 shadow-sm' },
            { label: 'Pendente', key: 'Pendente', dot: 'bg-amber-400', activeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/60 ring-1 ring-amber-500/40 shadow-sm' },
            { label: 'No cliente', key: 'No cliente', dot: 'bg-sky-400', activeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/60 ring-1 ring-sky-500/40 shadow-sm' },
            { label: 'Entregue', key: 'Entregue', dot: 'bg-emerald-400', activeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 ring-1 ring-emerald-500/40 shadow-sm' },
            { label: 'Carga parada', key: 'Carga parada', dot: 'bg-orange-400', activeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/60 ring-1 ring-orange-500/40 shadow-sm' },
            { label: 'Devolução', key: 'Devolução', dot: 'bg-rose-400', activeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/60 ring-1 ring-rose-500/40 shadow-sm' },
            { label: 'Reentrega', key: 'Reentrega', dot: 'bg-purple-400', activeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/60 ring-1 ring-purple-500/40 shadow-sm' },
          ].map(item => {
            const isSelected = statusSelecionado === item.key;
            const count = stats[item.key] || 0;
            return (
              <button
                key={item.key}
                onClick={() => setStatusSelecionado(item.key)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap border transition-all flex items-center gap-1.5",
                  isSelected 
                    ? item.activeClass 
                    : "bg-background-secondary/50 text-text-secondary border-border-tertiary hover:bg-background-secondary hover:text-text-primary"
                )}
              >
                <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", item.dot)} />
                <span>{item.label}</span>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                  isSelected 
                    ? "bg-white/20 text-inherit" 
                    : count > 0 ? "bg-background-tertiary text-text-secondary" : "bg-transparent text-text-tertiary"
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SELETOR DE MODO CENTRALIZADO (SEM TEXTO RESUMO) */}
      <div className="flex items-center justify-center pt-1 pb-1">
        <div className="flex items-center gap-1 bg-background-secondary/80 p-1 rounded-xl border border-border-secondary/70 shadow-xs">
          <button
            onClick={() => setModoVisualizacao('veiculos')}
            className={cn(
              "flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all select-none cursor-pointer",
              modoVisualizacao === 'veiculos'
                ? "bg-primary text-white shadow-xs shadow-primary/20"
                : "text-text-secondary hover:text-text-primary hover:bg-background-tertiary"
            )}
            title="Visualização em cards de veículos e rotas"
          >
            <LayoutGrid size={14} className={cn(modoVisualizacao === 'veiculos' ? "stroke-[2.5px]" : "stroke-2")} />
            <span>Cards de Veículos</span>
          </button>
          
          <button
            onClick={() => setModoVisualizacao('detalhada')}
            className={cn(
              "flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all select-none cursor-pointer",
              modoVisualizacao === 'detalhada'
                ? "bg-primary text-white shadow-xs shadow-primary/20"
                : "text-text-secondary hover:text-text-primary hover:bg-background-tertiary"
            )}
            title="Visualização detalhada por cliente e notas"
          >
            <List size={14} className={cn(modoVisualizacao === 'detalhada' ? "stroke-[2.5px]" : "stroke-2")} />
            <span>Lista Detalhada</span>
          </button>
        </div>
      </div>

      {modoVisualizacao === 'veiculos' ? (
        <VisaoCardsVeiculos 
          entregasFiltradas={entregasFiltradas}
          todasEntregas={entregas}
          onStatusChange={handleStatusChange}
          onAbrirDevolucao={(entrega, tipo) => setDevolucaoEmAndamento({ entrega, tipo })}
        />
      ) : (
        <>
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

            // Métricas de Tempo e Estadia do Grupo de Notas do Cliente
            const chegadas = grupo.entregas.map(e => e.horaChegada).filter(Boolean).sort();
            const saidas = grupo.entregas.map(e => e.horaSaida).filter(Boolean).sort();
            const horaChegadaGrupo = chegadas[0] || null;
            const horaSaidaGrupo = saidas.length > 0 ? saidas[saidas.length - 1] : null;

            const isEmAtendimentoGrupo = grupo.entregas.some(e => ['No cliente', 'Descarregando'].includes(e.status));
            const todosFinalizadosGrupo = grupo.entregas.length > 0 && grupo.entregas.every(e => 
              ['Entrega total', 'Entrega parcial', 'Devolução total', 'Reentrega', 'Carga parada'].includes(e.status)
            );

            let tempoAtendimentoAtual = null;
            if (isEmAtendimentoGrupo && horaChegadaGrupo) {
              const diffMin = Math.max(0, Math.round((Date.now() - new Date(horaChegadaGrupo).getTime()) / 60000));
              tempoAtendimentoAtual = formatarDuracao(diffMin);
            }

            let tempoTotalGrupoMin = null;
            if (horaChegadaGrupo && horaSaidaGrupo) {
              tempoTotalGrupoMin = Math.max(0, Math.round((new Date(horaSaidaGrupo).getTime() - new Date(horaChegadaGrupo).getTime()) / 60000));
            } else if (grupo.entregas.some(e => e.tempoMinutos !== undefined && e.tempoMinutos !== null)) {
              const maxTempo = Math.max(...grupo.entregas.map(e => Number(e.tempoMinutos) || 0));
              tempoTotalGrupoMin = maxTempo;
            }

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

                {/* Faixa de Horários e Tempo de Permanência no Cliente */}
                {(horaChegadaGrupo || horaSaidaGrupo || isEmAtendimentoGrupo) && (
                  <div className="bg-background-primary/40 px-4 py-2 border-b border-border-secondary flex items-center justify-between flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-3 flex-wrap">
                      {horaChegadaGrupo && (
                        <span className="inline-flex items-center gap-1 font-semibold text-text-secondary">
                          <Clock size={13} className="text-info" />
                          Chegada: <strong className="text-text-primary">{formatarHora(horaChegadaGrupo)}</strong>
                        </span>
                      )}
                      {horaSaidaGrupo && (
                        <span className="inline-flex items-center gap-1 font-semibold text-text-secondary">
                          <CheckCircle2 size={13} className="text-success" />
                          Saída: <strong className="text-text-primary">{formatarHora(horaSaidaGrupo)}</strong>
                        </span>
                      )}
                    </div>

                    <div>
                      {isEmAtendimentoGrupo && horaChegadaGrupo ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                          No cliente há {tempoAtendimentoAtual || 'poucos instantes'}
                        </span>
                      ) : tempoTotalGrupoMin !== null ? (
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border shadow-sm",
                          tempoTotalGrupoMin <= 45
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : tempoTotalGrupoMin <= 90
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                        )}>
                          <Timer size={13} />
                          Estadia: {formatarDuracao(tempoTotalGrupoMin)}
                          {tempoTotalGrupoMin > 90 && <span className="text-[10px] ml-1 uppercase font-black">(Excedido)</span>}
                        </span>
                      ) : null}
                    </div>
                  </div>
                )}

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

                         {/* Horários da Nota Individual */}
                         {(entrega.horaChegada || entrega.horaSaida || entrega.tempoFormatado) && (
                           <div className="flex flex-wrap items-center gap-3 text-[11px] text-text-secondary bg-background-primary/50 px-2.5 py-1.5 rounded-lg border border-border-tertiary mb-3">
                             {entrega.horaChegada && (
                               <div className="flex items-center gap-1">
                                 <Clock size={12} className="text-info" />
                                 <span>Chegada: <strong>{formatarHora(entrega.horaChegada)}</strong></span>
                               </div>
                             )}
                             {entrega.horaSaida && (
                               <div className="flex items-center gap-1">
                                 <CheckCircle2 size={12} className="text-success" />
                                 <span>Saída: <strong>{formatarHora(entrega.horaSaida)}</strong></span>
                               </div>
                             )}
                             {entrega.tempoFormatado && (
                               <div className="flex items-center gap-1 font-bold text-text-primary ml-auto">
                                 <Timer size={12} className="text-primary" />
                                 <span>Tempo: {entrega.tempoFormatado}</span>
                               </div>
                             )}
                           </div>
                         )}

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
      </>
      )}

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
