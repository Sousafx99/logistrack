import { useState, useMemo, useRef, useEffect } from 'react';
import { format, isBefore, parseISO, startOfDay } from 'date-fns';
import { Truck, MapPin, Package as PackageIcon, User, AlertTriangle, Filter, Search, FileText, Hash, X, ChevronDown, ChevronUp, Gauge, Clock, Timer, CheckCircle2, LayoutGrid, List, Calendar, ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { STATUS_OPTIONS } from '../../data/mockData';
import { Badge } from '../ui/Badge';
import { cn, normalizarRCA } from '../../lib/utils';
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

const formatarData = (dataStr) => {
  if (!dataStr) return '--/--/----';
  try {
    const parts = String(dataStr).split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dataStr);
    return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  } catch {
    return String(dataStr);
  }
};

export function VisaoMonitoramento() {
  const { 
    entregas, 
    motoristas = [], 
    atualizarStatusEntrega, 
    transferirPlaca, 
    moverParaEstoque, 
    registrarDevolucao, 
    atualizarStatusEntregaEmMassa, 
    transferirPlacaEmMassa, 
    moverParaEstoqueEmMassa, 
    toggleCanhotoEmMassa,
    alterarDataEntrega,
    alterarDataEntregaEmMassa
  } = useStore();

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
  const [mostrarConcluidas, setMostrarConcluidas] = useState(false);
  
  // Estados para Lote
  const [selectedNotas, setSelectedNotas] = useState([]);
  const [acaoLote, setAcaoLote] = useState(null);
  const [novoStatusLote, setNovoStatusLote] = useState('');
  const [novaPlacaLote, setNovaPlacaLote] = useState('');
  const [novaDataLote, setNovaDataLote] = useState('');
  const [dropdownPlacasAberto, setDropdownPlacasAberto] = useState(false);
  const [modalDataIndividual, setModalDataIndividual] = useState(null); // { entrega, novaData }

  // Controle de Visibilidade da Barra Fixa Superior (para mostrar Dock Flutuante apenas quando fora da tela)
  const topBarRef = useRef(null);
  const [topBarVisivel, setTopBarVisivel] = useState(true);

  // Lista de todas as placas cadastradas no sistema (entregas e motoristas)
  const todasPlacasSistema = useMemo(() => {
    const set = new Set();
    (entregas || []).forEach(e => {
      const p = (e.placa || '').trim().toUpperCase();
      if (p && p !== 'SEM PLACA' && p !== 'NULL' && p !== 'UNDEFINED') set.add(p);
    });
    (motoristas || []).forEach(m => {
      const p = (m.placa || '').trim().toUpperCase();
      if (p && p !== 'SEM PLACA' && p !== 'NULL' && p !== 'UNDEFINED') set.add(p);
    });
    return Array.from(set).sort();
  }, [entregas, motoristas]);

  useEffect(() => {
    const el = topBarRef.current;
    if (!el) {
      setTopBarVisivel(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setTopBarVisivel(entry.isIntersecting);
      },
      {
        threshold: 0.05,
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [modoVisualizacao]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (acaoLote) {
          setAcaoLote(null);
          setNovoStatusLote('');
          setNovaPlacaLote('');
          setNovaDataLote('');
          setDropdownPlacasAberto(false);
        } else if (modalDataIndividual) {
          setModalDataIndividual(null);
        } else if (selectedNotas.length > 0) {
          setSelectedNotas([]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [acaoLote, modalDataIndividual, selectedNotas.length]);

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

  const { placasAtivas, placasConcluidas, placasDisponiveis } = useMemo(() => {
    const subset = mostraTodas ? entregas : entregas.filter(e => datasEfetivas.includes(e.data));
    const plates = Array.from(new Set(
      subset
        .map(e => (e.placa || '').trim().toUpperCase())
        .filter(p => p && p !== 'SEM PLACA' && p !== 'NULL' && p !== 'UNDEFINED')
    ));

    const ativas = [];
    const concluidas = [];

    plates.forEach(p => {
      const pend = placasStats[p]?.pendentes || 0;
      if (pend > 0) {
        ativas.push(p);
      } else {
        concluidas.push(p);
      }
    });

    ativas.sort((a, b) => {
      const pendA = placasStats[a]?.pendentes || 0;
      const pendB = placasStats[b]?.pendentes || 0;
      if (pendA !== pendB) return pendB - pendA;
      return a.localeCompare(b);
    });

    concluidas.sort((a, b) => a.localeCompare(b));

    // Se o usuário selecionou uma placa concluída individualmente, garante que ela apareça mesmo se mostrarConcluidas estiver false
    const concluidasExibidas = mostrarConcluidas 
      ? concluidas 
      : concluidas.filter(p => placasSelecionadas.includes(p));

    return {
      placasAtivas: ativas,
      placasConcluidas: concluidas,
      placasDisponiveis: [...ativas, ...concluidasExibidas]
    };
  }, [entregas, datasEfetivas, mostraTodas, placasStats, mostrarConcluidas, placasSelecionadas]);

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
    // Se mostrarConcluidas for falso e estiver em Em Aberto ou Pendente, filtra apenas veículos com pendências
    if (placasSelecionadas.length === 0) {
      if (!mostrarConcluidas && (statusSelecionado === 'Em Aberto' || statusSelecionado === 'Pendente')) {
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
        case 'Todos':
        case 'TODOS':
        case 'Sem filtro':
          return true;
        case 'Em Aberto': return !finalizadas.includes(e.status) || isAtrasadaPendente;
        case 'Pendente': return e.status === 'Pendente';
        case 'No cliente': return e.status === 'No cliente';
        case 'Descarregando': return e.status === 'Descarregando';
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
        (normalizarRCA(e.rca)?.toLowerCase() || '').includes(term) ||
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
      'Todos': baseEntregas.length,
      'Em Aberto': baseEntregas.filter(e => !finalizadasSet.has(e.status)).length,
      'Pendente': baseEntregas.filter(e => e.status === 'Pendente').length,
      'No cliente': baseEntregas.filter(e => e.status === 'No cliente').length,
      'Descarregando': baseEntregas.filter(e => e.status === 'Descarregando').length,
      'Entregue': baseEntregas.filter(e => e.status === 'Entrega total').length,
      'Carga parada': baseEntregas.filter(e => e.status === 'Carga parada').length,
      'Devolução': baseEntregas.filter(e => ['Devolução total', 'Entrega parcial'].includes(e.status)).length,
      'Reentrega': baseEntregas.filter(e => e.status === 'Reentrega').length,
    };
  }, [entregas, placasSelecionadas, datasEfetivas, mostraTodas, finalizadasSet]);

  const statusDisponiveis = useMemo(() => {
    const lista = [
      { label: 'Todos', key: 'Todos', dot: 'bg-primary', activeClass: 'bg-primary text-white border-primary shadow-sm font-bold' },
      { label: 'Em Aberto', key: 'Em Aberto', dot: 'bg-amber-400', activeClass: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/60 ring-1 ring-amber-500/40 shadow-sm' },
      { label: 'Pendente', key: 'Pendente', dot: 'bg-zinc-400', activeClass: 'bg-zinc-500/20 text-zinc-700 dark:text-zinc-300 border-zinc-500/60 ring-1 ring-zinc-500/40 shadow-sm' },
      { label: 'No cliente', key: 'No cliente', dot: 'bg-sky-400', activeClass: 'bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-500/60 ring-1 ring-sky-500/40 shadow-sm' },
      { label: 'Descarregando', key: 'Descarregando', dot: 'bg-blue-600', activeClass: 'bg-blue-600/20 text-blue-700 dark:text-blue-300 border-blue-600/60 ring-1 ring-blue-600/40 shadow-sm' },
      { label: 'Entregue', key: 'Entregue', dot: 'bg-emerald-400', activeClass: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/60 ring-1 ring-emerald-500/40 shadow-sm' },
      { label: 'Carga parada', key: 'Carga parada', dot: 'bg-yellow-400', activeClass: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/60 ring-1 ring-yellow-500/40 shadow-sm' },
      { label: 'Devolução', key: 'Devolução', dot: 'bg-rose-400', activeClass: 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/60 ring-1 ring-rose-500/40 shadow-sm' },
      { label: 'Reentrega', key: 'Reentrega', dot: 'bg-purple-400', activeClass: 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/60 ring-1 ring-purple-500/40 shadow-sm' },
    ];

    // 'Todos' sempre fica disponível para o usuário visualizar todas as entregas sem restrição de status
    const outrosDisponiveis = lista.slice(1).filter(item => (stats[item.key] || 0) > 0);
    return [lista[0], ...outrosDisponiveis];
  }, [stats]);

  // Se o status selecionado não existir mais entre os disponíveis com contagem > 0, redefine automaticamente
  useEffect(() => {
    if (statusDisponiveis.length > 0 && !statusDisponiveis.some(s => s.key === statusSelecionado)) {
      setStatusSelecionado(statusDisponiveis[0].key);
    }
  }, [statusDisponiveis, statusSelecionado]);

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

          {/* Filtro de Datas Integrado (Centralizado) */}
          <div className="flex items-center justify-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5 sm:pb-0 flex-wrap sm:flex-nowrap w-full md:w-auto">
            <button
              onClick={() => setGlobalFilters({
                visaoMonitoramento: {
                  ...globalFilters.visaoMonitoramento,
                  datas: mostraTodas ? [] : ['TODAS'],
                  placas: []
                }
              })}
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border whitespace-nowrap shadow-sm shrink-0",
                mostraTodas 
                  ? "bg-primary text-white border-primary shadow-primary/20" 
                  : "bg-background-secondary text-text-secondary border-border-tertiary hover:bg-border-tertiary hover:text-text-primary"
              )}
            >
              Todas as Datas
            </button>

            {!mostraTodas && datasSelecionadas.map(d => (
              <div key={d} className="bg-info text-white text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm whitespace-nowrap shrink-0">
                <span>{new Date(d).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</span>
                <button onClick={() => toggleData(d)} className="hover:text-white/70" title="Remover data">
                  <X size={12} />
                </button>
              </div>
            ))}

            {!mostraTodas && datasSelecionadas.length === 0 && (
              <div className="bg-background-secondary border border-border-secondary text-text-secondary text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0">
                <Calendar size={13} className="text-info" />
                <span>
                  {new Date(globalFilters.data).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}
                  {globalFilters.data === format(new Date(), 'yyyy-MM-dd') ? ' (Hoje)' : ' (Última Rota)'}
                </span>
              </div>
            )}

            {!mostraTodas && (
              <label 
                onClick={(e) => {
                  try {
                    const input = e.currentTarget.querySelector('input[type="date"]');
                    if (input && typeof input.showPicker === 'function') {
                      input.showPicker();
                    }
                  } catch (err) {}
                }}
                className="relative flex items-center bg-background-secondary border border-border-secondary hover:border-info text-text-secondary hover:text-text-primary px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm whitespace-nowrap gap-1 shrink-0"
                title="Selecionar outra data no calendário"
              >
                <Calendar size={13} className="text-info" />
                <span>+ Data</span>
                <input 
                  type="date" 
                  value={dateInputValue}
                  onClick={(e) => {
                    e.stopPropagation();
                    try {
                      if (typeof e.target.showPicker === 'function') {
                        e.target.showPicker();
                      }
                    } catch (err) {}
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDateInputValue(val);
                    if (val && !datasSelecionadas.includes(val)) {
                      toggleData(val);
                      setTimeout(() => setDateInputValue(''), 100);
                    }
                  }}
                  className="absolute top-0 right-0 h-full w-64 sm:w-72 opacity-0 pointer-events-auto cursor-pointer"
                />
              </label>
            )}
          </div>
        </div>

        {/* LINHA 2: FILTRO DE PLACAS ADAPTÁVEL (DESKTOP: GRADE CENTRALIZADA / MOBILE: LINHA DESLIZANTE COMPACTA) */}
        <div className="pt-2 border-t border-border-secondary/60">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 px-0.5 justify-start sm:justify-center sm:flex-wrap">
            {/* Botão Todas as Placas */}
            <button
              onClick={() => setPlacasSelecionadas([])}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-2 whitespace-nowrap shadow-sm font-mono shrink-0",
                placasSelecionadas.length === 0 
                  ? "bg-primary text-white border-primary shadow-primary/20" 
                  : "bg-background-secondary text-text-secondary border-border-tertiary hover:bg-border-tertiary hover:text-text-primary"
              )}
            >
              <Truck size={13} className={placasSelecionadas.length === 0 ? "text-white" : "text-primary"} />
              <span>Todas as Placas</span>
              {(() => {
                const totalEmRota = placasAtivas.length;
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

            {/* Badges de Placas Individuais (Ativas por padrão) */}
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
                    "px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 whitespace-nowrap shadow-sm font-mono tracking-wider shrink-0",
                    isSelected 
                      ? "bg-info text-white border-info shadow-info/20 ring-1 ring-info" 
                      : isConcluido
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
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
                        ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40"
                        : "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40"
                  )}>
                    {isConcluido ? "✓ 0" : pendentes}
                  </span>
                </button>
              );
            })}

            {/* Botão de Toggle para Mostrar/Ocultar Veículos 100% Concluídos */}
            {placasConcluidas.length > 0 && (
              <button
                onClick={() => setMostrarConcluidas(prev => !prev)}
                className={cn(
                  "px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 whitespace-nowrap shadow-xs shrink-0 font-sans",
                  mostrarConcluidas
                    ? "bg-background-tertiary text-text-secondary border-border-secondary hover:text-text-primary"
                    : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20"
                )}
                title={mostrarConcluidas ? "Ocultar veículos já finalizados" : "Visualizar veículos que já concluíram 100% da rota"}
              >
                <CheckCircle2 size={13} className={mostrarConcluidas ? "text-text-tertiary" : "text-emerald-500"} />
                <span>{mostrarConcluidas ? "Ocultar Concluídos" : `+ Concluídos (${placasConcluidas.length})`}</span>
              </button>
            )}
          </div>
        </div>

        {/* LINHA 3: CHIPS DE STATUS OPERACIONAL INTELIGENTES (OCULTA STATUS ZERADOS) */}
        {statusDisponiveis.length > 0 && (
          <div className="pt-2 border-t border-border-secondary/60">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 px-0.5 justify-start sm:justify-center sm:flex-wrap">
              {statusDisponiveis.map(item => {
                const isSelected = statusSelecionado === item.key;
                const count = stats[item.key] || 0;
                return (
                  <button
                    key={item.key}
                    onClick={() => setStatusSelecionado(isSelected && item.key !== 'Todos' ? 'Todos' : item.key)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap border transition-all flex items-center gap-1.5 shrink-0 cursor-pointer",
                      isSelected 
                        ? item.activeClass 
                        : "bg-background-secondary/60 text-text-secondary border-border-tertiary hover:bg-background-secondary hover:text-text-primary"
                    )}
                  >
                    <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", item.dot)} />
                    <span>{item.label}</span>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                      isSelected 
                        ? (item.key === 'Todos' ? "bg-white/20 text-white font-black" : "bg-primary/20 text-inherit font-black") 
                        : "bg-background-tertiary text-text-secondary"
                    )}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* SELETOR DE MODO CENTRALIZADO (SEM TEXTO RESUMO) */}
      <div className="flex items-center justify-center pt-1 pb-1">
        <div className="flex items-center gap-1 bg-background-secondary/80 p-1 rounded-xl border border-border-secondary/70 shadow-xs w-full sm:w-auto max-w-sm sm:max-w-none">
          <button
            onClick={() => setModoVisualizacao('veiculos')}
            className={cn(
              "flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-1.5 rounded-lg text-xs font-bold transition-all select-none cursor-pointer",
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
              "flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-1.5 rounded-lg text-xs font-bold transition-all select-none cursor-pointer",
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
          {/* Barra Superior de Seleção e Ações em Lote (Dock Fixo no Topo da Lista) */}
          {clientesAgrupados.length > 0 && (
            <div 
              ref={topBarRef}
              className={cn(
                "relative transition-all rounded-xl p-2.5 sm:p-3 my-2 border backdrop-blur-md",
                selectedNotas.length > 0
                  ? "bg-background-primary/95 border-info/50 shadow-lg ring-1 ring-info/20"
                  : "bg-background-secondary/60 border-border-secondary/70"
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                {/* Checkbox e Contador */}
                <div className="flex items-center gap-2.5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm font-bold text-text-secondary hover:text-text-primary transition-colors select-none">
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
                    <span>Selecionar Todas ({entregasFiltradas.length})</span>
                  </label>

                  {selectedNotas.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-info text-white shadow-xs animate-in fade-in">
                      <span>{selectedNotas.length}</span>
                      <span className="hidden sm:inline font-bold">selecionada(s)</span>
                    </span>
                  )}
                </div>

                {/* Ações Imediatas no Topo (ao alcance do clique) */}
                {selectedNotas.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 animate-in fade-in slide-in-from-right-2">
                    <button
                      onClick={() => setAcaoLote('status')}
                      className="inline-flex items-center gap-1.5 bg-info hover:bg-info/90 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
                      title="Alterar status de todas as notas selecionadas"
                    >
                      <Zap size={13} className="fill-current" />
                      <span>Status</span>
                    </button>

                    <button
                      onClick={() => setAcaoLote('placa')}
                      className="inline-flex items-center gap-1.5 bg-background-primary hover:bg-background-secondary text-text-primary border border-border-tertiary px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
                      title="Transferir placa das notas selecionadas"
                    >
                      <Truck size={13} className="text-info" />
                      <span>Transf. Placa</span>
                    </button>

                    <button
                      onClick={() => {
                        setNovaDataLote('');
                        setAcaoLote('data');
                      }}
                      className="inline-flex items-center gap-1.5 bg-background-primary hover:bg-background-secondary text-text-primary border border-border-tertiary px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
                      title="Alterar data de entrega das notas selecionadas"
                    >
                      <Calendar size={13} className="text-purple-400" />
                      <span>Mudar Data</span>
                    </button>

                    <button
                      onClick={() => {
                        toggleCanhotoEmMassa(selectedNotas, true);
                        setSelectedNotas([]);
                      }}
                      className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
                      title="Dar baixa no canhoto para as notas selecionadas"
                    >
                      <CheckCircle2 size={13} />
                      <span>Canhoto OK</span>
                    </button>

                    <button
                      onClick={() => setSelectedNotas([])}
                      className="inline-flex items-center gap-1 text-text-tertiary hover:text-text-primary px-2 py-1.5 rounded-lg text-xs font-bold hover:bg-border-tertiary transition-colors cursor-pointer ml-1"
                      title="Limpar seleção (Esc)"
                    >
                      <X size={14} />
                      <span className="hidden md:inline">Desmarcar</span>
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] text-text-tertiary hidden sm:inline italic">
                    Dica: selecione notas para alterar status, transferir placa ou dar baixa em lote
                  </span>
                )}
              </div>
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
                            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                               <h4 className="font-bold text-text-primary text-sm">NF: {entrega.nota}</h4>
                               <Badge status={entrega.status}>{entrega.status}</Badge>
                               {entrega.dataFaturamento && entrega.data && entrega.dataFaturamento !== entrega.data && (
                                 <span 
                                   className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shadow-xs"
                                   title={`Data de Faturamento Original: ${formatarData(entrega.dataFaturamento)} | Data Operacional de Entrega: ${formatarData(entrega.data)}`}
                                 >
                                   <Calendar size={10} />
                                   Fat: {formatarData(entrega.dataFaturamento)}
                                 </span>
                               )}
                               {entrega.placaOriginal && entrega.placa && entrega.placaOriginal !== entrega.placa && (
                                 <span 
                                   className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs"
                                   title={`Placa Original da Importação: ${entrega.placaOriginal} | Veículo Atual: ${entrega.placa}`}
                                 >
                                   <Truck size={10} />
                                   Orig: {entrega.placaOriginal}
                                 </span>
                               )}
                            </div>
                            <span className="font-bold text-text-primary text-xs">{entrega.peso.toFixed(1)} kg</span>
                         </div>
                         
                         <div className="flex gap-4 text-[11px] text-text-tertiary mb-3 font-medium">
                            <div className="flex items-center"><FileText size={12} className="mr-1 opacity-70" /> Ped: {entrega.pedido || 'N/A'}</div>
                            <div className="flex items-center"><User size={12} className="mr-1 opacity-70" /> RCA: {normalizarRCA(entrega.rca) || 'N/A'}</div>
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
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div>
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
                              
                              <div>
                                <label className="text-[10px] uppercase font-bold text-text-tertiary block mb-1">Placa</label>
                                {acaoId === entrega.id ? (
                                  <div className="flex gap-1 h-[34px]">
                                    <input 
                                      type="text" 
                                      placeholder="Placa" 
                                      className="w-full bg-background-primary border border-info rounded-lg px-2 text-[11px] uppercase focus:ring-1 focus:ring-info font-bold"
                                      value={novaPlaca}
                                      onChange={(e) => setNovaPlaca(e.target.value.toUpperCase())}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && novaPlaca.trim()) {
                                          transferirPlaca(entrega.id, novaPlaca.trim());
                                          setAcaoId(null);
                                          setNovaPlaca('');
                                        } else if (e.key === 'Escape') {
                                          setAcaoId(null);
                                          setNovaPlaca('');
                                        }
                                      }}
                                      autoFocus
                                    />
                                    <button 
                                      onClick={() => {
                                        if(novaPlaca.trim()) transferirPlaca(entrega.id, novaPlaca.trim());
                                        setAcaoId(null);
                                        setNovaPlaca('');
                                      }}
                                      className="bg-info text-white px-2 rounded-lg text-[11px] font-bold cursor-pointer hover:bg-info/90"
                                    >
                                      OK
                                    </button>
                                  </div>
                                ) : (
                                  <button 
                                    onClick={() => setAcaoId(entrega.id)}
                                    className="w-full h-[34px] text-[11px] font-bold text-info bg-info/10 rounded-lg hover:bg-info/20 transition-colors border border-info/20 flex items-center justify-center gap-1 cursor-pointer"
                                  >
                                    <Truck size={12} />
                                    <span>Transf. Placa</span>
                                  </button>
                                )}
                              </div>

                              <div>
                                <label className="text-[10px] uppercase font-bold text-text-tertiary block mb-1">Data Entrega</label>
                                <button 
                                  onClick={() => setModalDataIndividual({ entrega, novaData: entrega.data || '' })}
                                  className="w-full h-[34px] text-[11px] font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 rounded-lg transition-colors border border-purple-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                                  title="Alterar data de entrega desta nota"
                                >
                                  <Calendar size={12} />
                                  <span>{formatarData(entrega.data)}</span>
                                </button>
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

      {/* Floating Action Dock Centralizado (Aparece SOMENTE quando o dock fixo do topo NÃO estiver visível) */}
      {selectedNotas.length > 0 && !topBarVisivel && (
        <div className="fixed bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 z-40 bg-zinc-900/95 text-zinc-100 backdrop-blur-xl border border-zinc-700/80 rounded-2xl p-2 sm:px-3 sm:py-2 shadow-2xl flex items-center gap-2 sm:gap-3 animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-2 pl-1 pr-2 border-r border-zinc-700/80">
             <span className="bg-info text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shadow-xs">
               {selectedNotas.length}
             </span>
             <span className="text-xs font-bold text-zinc-200 hidden sm:inline">
               selecionada{selectedNotas.length > 1 ? 's' : ''}
             </span>
          </div>

          <div className="flex items-center gap-1.5">
             <button 
               onClick={() => setAcaoLote('status')} 
               className="bg-info hover:bg-info/90 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
               title="Alterar status em lote"
             >
               <Zap size={13} className="fill-current" />
               <span>Status</span>
             </button>

             <button 
               onClick={() => setAcaoLote('placa')} 
               className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 px-3 py-1.5 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
               title="Transferir placa em lote"
             >
               <Truck size={13} className="text-info" />
               <span>Transf.</span>
             </button>

             <button 
               onClick={() => {
                 setNovaDataLote('');
                 setAcaoLote('data');
               }} 
               className="bg-zinc-800 hover:bg-zinc-700 text-purple-300 border border-zinc-700 px-3 py-1.5 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
               title="Alterar data de entrega em lote"
             >
               <Calendar size={13} className="text-purple-400" />
               <span>Data</span>
             </button>

             <button 
               onClick={() => { toggleCanhotoEmMassa(selectedNotas, true); setSelectedNotas([]); }} 
               className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
               title="Dar baixa em canhoto em lote"
             >
               <CheckCircle2 size={13} />
               <span>Canhoto OK</span>
             </button>

             <button 
               onClick={() => setSelectedNotas([])} 
               className="text-zinc-400 hover:text-white p-1.5 rounded-xl hover:bg-zinc-800 transition-colors cursor-pointer"
               title="Limpar seleção (Esc)"
             >
               <X size={16}/>
             </button>
          </div>
        </div>
      )}

      {/* Modais de Lote */}
      {acaoLote === 'status' && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => { setAcaoLote(null); setNovoStatusLote(''); }}
        >
          <div 
            className="bg-background-primary rounded-2xl w-full max-w-sm p-5 border border-border-secondary shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3 border-b border-border-secondary/60 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-info/10 text-info rounded-lg">
                  <Zap size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-text-primary">Alterar Status em Lote</h3>
                  <p className="text-[11px] text-text-tertiary">{selectedNotas.length} nota(s) selecionada(s)</p>
                </div>
              </div>
              <button 
                onClick={() => { setAcaoLote(null); setNovoStatusLote(''); }}
                className="text-text-tertiary hover:text-text-primary p-1 rounded-lg hover:bg-background-secondary transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <select 
               value={novoStatusLote}
               onChange={(e) => setNovoStatusLote(e.target.value)}
               className="w-full bg-background-secondary border border-border-tertiary rounded-xl p-2.5 mb-4 text-xs font-bold text-text-primary focus:ring-2 focus:ring-info outline-none cursor-pointer"
               autoFocus
            >
               <option value="">Selecione o novo status...</option>
               {STATUS_OPTIONS.filter(o => o !== 'Entrega parcial').map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
               ))}
            </select>
            <div className="flex justify-end gap-2">
               <button 
                 onClick={() => { setAcaoLote(null); setNovoStatusLote(''); }} 
                 className="px-3.5 py-2 text-xs font-bold text-text-secondary hover:bg-border-tertiary rounded-xl transition-colors cursor-pointer"
               >
                 Cancelar
               </button>
               <button 
                 disabled={!novoStatusLote}
                 onClick={async () => {
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
               }} className="bg-info text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer">
                 Confirmar
               </button>
            </div>
          </div>
        </div>
      )}

      {acaoLote === 'placa' && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => { setAcaoLote(null); setNovaPlacaLote(''); setDropdownPlacasAberto(false); }}
        >
          <div 
            className="bg-background-primary rounded-2xl w-full max-w-sm p-5 border border-border-secondary shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 border-b border-border-secondary/60 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-info/10 text-info rounded-lg">
                  <Truck size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-text-primary">Transferir Placa em Lote</h3>
                  <p className="text-[11px] text-text-tertiary">{selectedNotas.length} nota(s) selecionada(s)</p>
                </div>
              </div>
              <button 
                onClick={() => { setAcaoLote(null); setNovaPlacaLote(''); setDropdownPlacasAberto(false); }}
                className="text-text-tertiary hover:text-text-primary p-1 rounded-lg hover:bg-background-secondary transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="relative">
              <label className="block text-[11px] font-bold text-text-secondary uppercase mb-1.5">
                Nova Placa do Veículo
              </label>

              {/* Seletor Customizado de Placas (Largura Total da Barra) */}
              <div className="relative w-full">
                <input 
                  type="text" 
                  placeholder="SELECIONE OU DIGITE A PLACA..." 
                  value={novaPlacaLote}
                  onFocus={() => setDropdownPlacasAberto(true)}
                  onChange={(e) => {
                    setNovaPlacaLote(e.target.value.toUpperCase());
                    setDropdownPlacasAberto(true);
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && novaPlacaLote.trim()) {
                      setDropdownPlacasAberto(false);
                      await transferirPlacaEmMassa(selectedNotas, novaPlacaLote.trim());
                      setSelectedNotas([]);
                      setAcaoLote(null);
                      setNovaPlacaLote('');
                    } else if (e.key === 'Escape') {
                      if (dropdownPlacasAberto) {
                        setDropdownPlacasAberto(false);
                      } else {
                        setAcaoLote(null);
                        setNovaPlacaLote('');
                      }
                    }
                  }}
                  className="w-full bg-background-secondary border border-border-tertiary focus:border-info rounded-xl py-2.5 pl-3.5 pr-9 text-xs font-bold text-text-primary focus:ring-2 focus:ring-info uppercase outline-none font-mono tracking-wider transition-all placeholder:text-text-tertiary"
                  autoFocus
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setDropdownPlacasAberto(prev => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
                >
                  <ChevronDown size={16} className={cn("transition-transform duration-150", dropdownPlacasAberto && "rotate-180 text-info")} />
                </button>

                {/* Dropdown com a Largura Exata da Barra (w-full) */}
                {dropdownPlacasAberto && (() => {
                  const busca = (novaPlacaLote || '').trim().toUpperCase();
                  const placasFiltradas = todasPlacasSistema.filter(p => p.includes(busca));

                  return (
                    <>
                      {/* Backdrop invisível para clique fora */}
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setDropdownPlacasAberto(false)} 
                      />

                      <div className="absolute top-full left-0 right-0 w-full mt-1 z-50 bg-background-primary dark:bg-zinc-900 border border-border-secondary rounded-xl shadow-2xl max-h-48 overflow-y-auto custom-scrollbar p-1 divide-y divide-border-secondary/30 animate-in fade-in zoom-in-95 duration-100">
                        {placasFiltradas.length > 0 ? (
                          placasFiltradas.map(p => {
                            const isSelected = busca === p;
                            return (
                              <button
                                key={p}
                                type="button"
                                onClick={() => {
                                  setNovaPlacaLote(p);
                                  setDropdownPlacasAberto(false);
                                }}
                                className={cn(
                                  "w-full text-left px-3 py-2 rounded-lg text-xs font-mono font-bold transition-colors flex items-center justify-between cursor-pointer",
                                  isSelected
                                    ? "bg-info text-white font-black"
                                    : "text-text-primary hover:bg-background-secondary hover:text-info"
                                )}
                              >
                                <span>{p}</span>
                                {isSelected && <CheckCircle2 size={13} className="text-white" />}
                              </button>
                            );
                          })
                        ) : (
                          <div className="px-3 py-2 text-center text-xs text-text-tertiary font-medium">
                            {busca ? (
                              <span>Placa não cadastrada. Clique em <strong>Confirmar</strong> para usar <strong>{busca}</strong></span>
                            ) : (
                              <span>Nenhuma placa cadastrada</span>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5 pt-3 border-t border-border-secondary/60">
               <button 
                 onClick={() => { setAcaoLote(null); setNovaPlacaLote(''); setDropdownPlacasAberto(false); }} 
                 className="px-3.5 py-2 text-xs font-bold text-text-secondary hover:bg-border-tertiary rounded-xl transition-colors cursor-pointer"
               >
                 Cancelar
               </button>
               <button 
                 disabled={!novaPlacaLote.trim()}
                 onClick={async () => {
                  if(novaPlacaLote.trim()) {
                     await transferirPlacaEmMassa(selectedNotas, novaPlacaLote.trim());
                     setSelectedNotas([]);
                     setAcaoLote(null);
                     setNovaPlacaLote('');
                     setDropdownPlacasAberto(false);
                  }
               }} className="bg-info text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer">
                 Confirmar
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Mudança de Data em Lote */}
      {acaoLote === 'data' && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => { setAcaoLote(null); setNovaDataLote(''); }}
        >
          <div 
            className="bg-background-primary rounded-2xl w-full max-w-sm p-5 border border-border-secondary shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 border-b border-border-secondary/60 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-500/10 text-purple-400 rounded-lg">
                  <Calendar size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-text-primary">Mudar Data em Lote</h3>
                  <p className="text-[11px] text-text-tertiary">{selectedNotas.length} nota(s) selecionada(s)</p>
                </div>
              </div>
              <button 
                onClick={() => { setAcaoLote(null); setNovaDataLote(''); }}
                className="text-text-tertiary hover:text-text-primary p-1 rounded-lg hover:bg-background-secondary transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-text-secondary uppercase mb-1.5">
                  Nova Data de Entrega (Operacional)
                </label>
                <input 
                  type="date" 
                  value={novaDataLote}
                  onChange={(e) => setNovaDataLote(e.target.value)}
                  className="w-full bg-background-secondary border border-border-tertiary focus:border-purple-500 rounded-xl py-2.5 px-3.5 text-xs font-bold text-text-primary focus:ring-2 focus:ring-purple-500 outline-none transition-all cursor-pointer"
                  autoFocus
                />
              </div>

              {/* Botões rápidos */}
              <div className="flex items-center gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    const hoje = new Date().toISOString().split('T')[0];
                    setNovaDataLote(hoje);
                  }}
                  className="flex-1 py-1.5 px-2 bg-background-secondary hover:bg-border-tertiary text-[11px] font-bold text-text-primary rounded-lg border border-border-tertiary transition-colors cursor-pointer text-center"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const am = new Date();
                    am.setDate(am.getDate() + 1);
                    setNovaDataLote(am.toISOString().split('T')[0]);
                  }}
                  className="flex-1 py-1.5 px-2 bg-background-secondary hover:bg-border-tertiary text-[11px] font-bold text-text-primary rounded-lg border border-border-tertiary transition-colors cursor-pointer text-center"
                >
                  Amanhã
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5 pt-3 border-t border-border-secondary/60">
              <button 
                onClick={() => { setAcaoLote(null); setNovaDataLote(''); }} 
                className="px-3.5 py-2 text-xs font-bold text-text-secondary hover:bg-border-tertiary rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                disabled={!novaDataLote}
                onClick={async () => {
                  if (novaDataLote) {
                    await alterarDataEntregaEmMassa(selectedNotas, novaDataLote);
                    setSelectedNotas([]);
                    setAcaoLote(null);
                    setNovaDataLote('');
                  }
                }}
                className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Mudança de Data Individual */}
      {modalDataIndividual && modalDataIndividual.entrega && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setModalDataIndividual(null)}
        >
          <div 
            className="bg-background-primary rounded-2xl w-full max-w-sm p-5 border border-border-secondary shadow-2xl animate-in zoom-in-95 duration-150 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border-secondary/60">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-500/10 text-purple-400 rounded-lg">
                  <Calendar size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-text-primary">Mudar Data da Entrega</h3>
                  <p className="text-[11px] text-text-tertiary">
                    NF: {modalDataIndividual.entrega.nota} • {modalDataIndividual.entrega.cliente}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setModalDataIndividual(null)}
                className="text-text-tertiary hover:text-text-primary p-1 rounded-lg hover:bg-background-secondary transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-background-secondary/60 p-3 rounded-xl border border-border-secondary/60 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-text-tertiary font-medium">Data Faturamento (Raiz):</span>
                  <span className="text-text-primary font-mono font-bold">
                    {formatarData(modalDataIndividual.entrega.dataFaturamento || modalDataIndividual.entrega.data)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-tertiary font-medium">Data Operacional Atual:</span>
                  <span className="text-purple-600 dark:text-purple-400 font-mono font-bold">
                    {formatarData(modalDataIndividual.entrega.data)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-text-secondary uppercase mb-1.5">
                  Nova Data de Entrega (Operacional)
                </label>
                <input 
                  type="date" 
                  value={modalDataIndividual.novaData}
                  onChange={(e) => setModalDataIndividual(prev => ({ ...prev, novaData: e.target.value }))}
                  className="w-full bg-background-secondary border border-border-tertiary focus:border-purple-500 rounded-xl py-2.5 px-3.5 text-xs font-bold text-text-primary focus:ring-2 focus:ring-purple-500 outline-none transition-all cursor-pointer"
                  autoFocus
                />
              </div>

              {/* Botões rápidos */}
              <div className="flex items-center gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    const hoje = new Date().toISOString().split('T')[0];
                    setModalDataIndividual(prev => ({ ...prev, novaData: hoje }));
                  }}
                  className="flex-1 py-1.5 px-2 bg-background-secondary hover:bg-border-tertiary text-[11px] font-bold text-text-primary rounded-lg border border-border-tertiary transition-colors cursor-pointer text-center"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const am = new Date();
                    am.setDate(am.getDate() + 1);
                    setModalDataIndividual(prev => ({ ...prev, novaData: am.toISOString().split('T')[0] }));
                  }}
                  className="flex-1 py-1.5 px-2 bg-background-secondary hover:bg-border-tertiary text-[11px] font-bold text-text-primary rounded-lg border border-border-tertiary transition-colors cursor-pointer text-center"
                >
                  Amanhã
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5 pt-3 border-t border-border-secondary/60">
              <button 
                onClick={() => setModalDataIndividual(null)} 
                className="px-3.5 py-2 text-xs font-bold text-text-secondary hover:bg-border-tertiary rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                disabled={!modalDataIndividual.novaData}
                onClick={async () => {
                  if (modalDataIndividual.novaData) {
                    await alterarDataEntrega(modalDataIndividual.entrega.id, modalDataIndividual.novaData);
                    setModalDataIndividual(null);
                  }
                }}
                className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
