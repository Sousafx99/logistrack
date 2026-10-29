import { useState, useMemo } from 'react';
import { Truck, CheckCircle, Clock, AlertTriangle, User, Phone, Edit2, RotateCcw, Calendar, Navigation, Layers, X, Filter, Route, LayoutGrid, LocateFixed } from 'lucide-react';
import { format } from 'date-fns';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { PerfilMotoristaModal } from '../components/motorista/PerfilMotoristaModal';
import { MapaRastreamentoFrota } from '../components/monitoramento/MapaRastreamentoFrota';

export function StatusFrota() {
  const {
    currentUser,
    entregas,
    devolucoes,
    motoristas,
    cargasFinalizadas,
    rastreamentoFrota = [],
    rotasGps = [],
    clientesGeoloc = [],
    globalFilters,
    setGlobalFilters,
    atualizarMotoristaAdmin
  } = useStore();
  
  const isMonitoramento = currentUser?.role === 'Monitoramento';
  
  const datasSelecionadas = globalFilters.visaoMonitoramento?.datas || [];
  const mostraTodas = datasSelecionadas.includes('TODAS');
  const datasEfetivas = mostraTodas ? [] : (datasSelecionadas.length > 0 ? datasSelecionadas : [globalFilters.data]);
  const [dateInputValue, setDateInputValue] = useState('');

  // Lista dinâmica de datas que efetivamente possuem entregas no banco
  const datasComCarga = useMemo(() => {
    const map = {};
    (entregas || []).forEach(e => {
      if (e.data) {
        map[e.data] = (map[e.data] || 0) + 1;
      }
    });
    return Object.entries(map)
      .map(([data, count]) => ({ data, count }))
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [entregas]);

  const selecionarDataUnica = (d) => {
    setGlobalFilters({
      data: d,
      visaoMonitoramento: {
        ...globalFilters.visaoMonitoramento,
        datas: [d],
        placas: []
      }
    });
  };

  const selecionarTodasDatas = () => {
    setGlobalFilters({
      visaoMonitoramento: {
        ...globalFilters.visaoMonitoramento,
        datas: ['TODAS'],
        placas: []
      }
    });
  };

  const toggleData = (d) => {
    selecionarDataUnica(d);
  };
  
  const [motoristaEditando, setMotoristaEditando] = useState(null);
  const [filtroStatusCard, setFiltroStatusCard] = useState('TODOS');
  const [modoExibicao, setModoExibicao] = useState('CARDS');
  const [placaMapaFoco, setPlacaMapaFoco] = useState('');
  const modoEfetivo = isMonitoramento ? modoExibicao : 'CARDS';

  const frotaStats = useMemo(() => {
    const entregasDoDia = (entregas || []).filter(e => {
      const p = (e.placa || '').trim().toUpperCase();
      const matchData = mostraTodas ? true : datasEfetivas.includes(e.data);
      return matchData && p && p !== 'SEM PLACA' && p !== 'NULL';
    });
    
    // Devoluções registradas para as datas selecionadas
    const devDoDia = (devolucoes || []).filter(d => {
      const dataDev = d.data ? (d.data.length >= 10 ? d.data.slice(0, 10) : d.data) : '';
      return mostraTodas ? true : datasEfetivas.includes(dataDev);
    });

    // Cargas finalizadas registradas para as datas selecionadas
    const finalizadosDoDia = (cargasFinalizadas || []).filter(cf => {
      return mostraTodas ? true : datasEfetivas.includes(cf.data);
    });

    const agrupado = {};
    const finalizadasSet = new Set(['Entrega total', 'Entrega parcial', 'Devolução total', 'Reentrega', 'Carga parada']);

    entregasDoDia.forEach(e => {
      const p = (e.placa || '').trim().toUpperCase();
      if (!agrupado[p]) {
        agrupado[p] = { 
          placa: p, 
          total: 0, 
          finalizadas: 0, 
          pendentes: 0,
          entregues: 0,
          parciais: 0,
          noCliente: 0,
          descarregando: 0,
          devolucoes: 0,
          reentregas: 0,
          cargaParada: 0,
          apenasPendentes: 0,
          notas: []
        };
      }
      agrupado[p].total += 1;
      agrupado[p].notas.push(e);

      if (e.status === 'Entrega total') {
        agrupado[p].entregues += 1;
      } else if (e.status === 'Entrega parcial') {
        agrupado[p].parciais += 1;
      } else if (e.status === 'No cliente') {
        agrupado[p].noCliente += 1;
      } else if (e.status === 'Descarregando') {
        agrupado[p].descarregando += 1;
      } else if (e.status === 'Devolução total') {
        agrupado[p].devolucoes += 1;
      } else if (e.status === 'Reentrega') {
        agrupado[p].reentregas += 1;
      } else if (e.status === 'Carga parada') {
        agrupado[p].cargaParada += 1;
      } else {
        agrupado[p].apenasPendentes += 1;
      }

      if (finalizadasSet.has(e.status)) {
        agrupado[p].finalizadas += 1;
      } else {
        agrupado[p].pendentes += 1;
      }
    });

    const carros = Object.values(agrupado).map(c => {
      // Cruzar com o módulo de devoluções para identificar registros extras de devolução/reentrega
      const devsDoCarro = devDoDia.filter(d => {
        if (d.placa && d.placa.trim().toUpperCase() === c.placa) return true;
        const ent = c.notas.find(e => String(e.nota) === String(d.nota));
        return !!ent;
      });

      const totalDevolucaoRegistrada = Math.max(
        c.devolucoes,
        devsDoCarro.filter(d => d.tipo !== 'Reentrega' && d.tratamento !== 'Reentrega').length
      );

      const totalReentregaRegistrada = Math.max(
        c.reentregas,
        devsDoCarro.filter(d => d.tipo === 'Reentrega' || d.tratamento === 'Reentrega').length
      );

      const temDevolucao = totalDevolucaoRegistrada > 0 || c.devolucoes > 0 || c.parciais > 0;
      const temReentrega = totalReentregaRegistrada > 0 || c.reentregas > 0;

      // Verificar se o veículo finalizou a viagem
      const isFinalizado = finalizadosDoDia.some(cf => {
        const pCf = (cf.placa || '').trim().toUpperCase();
        if (pCf) return pCf === c.placa;
        return c.notas.some(n => n.carga && n.carga !== 'CARGA PARADA' && n.carga !== 'Sem Carga' && n.carga === cf.carga);
      });

      let statusCalculado = 'Em Rota';
      if (c.pendentes === 0) {
        statusCalculado = isFinalizado ? 'Finalizado' : 'Retornando';
      }

      const pctEntregues = c.total > 0 ? (c.entregues / c.total) * 100 : 0;
      const pctParciais = c.total > 0 ? (c.parciais / c.total) * 100 : 0;
      const pctNoCliente = c.total > 0 ? (c.noCliente / c.total) * 100 : 0;
      const pctDescarregando = c.total > 0 ? (c.descarregando / c.total) * 100 : 0;
      const pctDevolucoes = c.total > 0 ? (totalDevolucaoRegistrada / c.total) * 100 : 0;
      const pctReentregas = c.total > 0 ? (totalReentregaRegistrada / c.total) * 100 : 0;
      const pctCargaParada = c.total > 0 ? (c.cargaParada / c.total) * 100 : 0;
      const percentual = Math.round((c.finalizadas / c.total) * 100) || 0;

      return {
        ...c,
        devolucoes: totalDevolucaoRegistrada,
        reentregas: totalReentregaRegistrada,
        temDevolucao,
        temReentrega,
        isFinalizado,
        percentual,
        pctEntregues,
        pctParciais,
        pctNoCliente,
        pctDescarregando,
        pctDevolucoes,
        pctReentregas,
        pctCargaParada,
        status: statusCalculado
      };
    });

    // Ordenação Inteligente:
    // Carros no topo: que têm entregas pendentes e/ou devolução que ainda NÃO tenham finalizado a viagem
    carros.sort((a, b) => {
      const getTier = (c) => {
        if (c.status === 'Em Rota') {
          // Em rota com devolução ou reentrega: Prioridade Máxima
          if (c.temDevolucao || c.devolucoes > 0 || c.reentregas > 0) return 0;
          return 1; // Em rota com entregas pendentes
        }
        if (c.status === 'Retornando') {
          if (c.temDevolucao || c.devolucoes > 0 || c.reentregas > 0) return 2;
          return 3;
        }
        // Finalizados ficam por último
        return 4;
      };

      const tierA = getTier(a);
      const tierB = getTier(b);

      if (tierA !== tierB) {
        return tierA - tierB;
      }

      // Desempate dentro de 'Em Rota': quem falta menos aparece em cima para acompanhar conclusão
      if (a.status === 'Em Rota' && b.status === 'Em Rota') {
        if (a.pendentes !== b.pendentes) {
          return a.pendentes - b.pendentes;
        }
      }

      return a.placa.localeCompare(b.placa);
    });

    const totais = {
      totalCarros: carros.length,
      emRota: carros.filter(c => c.status === 'Em Rota').length,
      comDevolucao: carros.filter(c => c.temDevolucao || c.devolucoes > 0 || c.reentregas > 0).length,
      retornando: carros.filter(c => c.status === 'Retornando').length,
      finalizados: carros.filter(c => c.status === 'Finalizado').length
    };

    return { carros, totais };
  }, [entregas, devolucoes, cargasFinalizadas, datasEfetivas, mostraTodas]);

  // Lista de carros filtrada pelo card selecionado
  const carrosFiltrados = useMemo(() => {
    return frotaStats.carros.filter(carro => {
      if (filtroStatusCard === 'TODOS') return true;
      if (filtroStatusCard === 'EM_ROTA') return carro.status === 'Em Rota';
      if (filtroStatusCard === 'COM_DEVOLUCAO') return carro.temDevolucao || carro.devolucoes > 0 || carro.reentregas > 0;
      if (filtroStatusCard === 'RETORNANDO') return carro.status === 'Retornando';
      if (filtroStatusCard === 'FINALIZADOS') return carro.status === 'Finalizado';
      return true;
    });
  }, [frotaStats.carros, filtroStatusCard]);

  const retornosDoDia = useMemo(() => {
    // Pegamos as devoluções que foram geradas para as datas selecionadas
    const doDia = (devolucoes || []).filter(d => {
      const dataDev = d.data ? (d.data.length >= 10 ? d.data.slice(0, 10) : d.data) : '';
      return mostraTodas ? true : datasEfetivas.includes(dataDev);
    });
    
    const agrupado = {};
    doDia.forEach(d => {
      const p = (d.placa || '').trim().toUpperCase() || 'SEM PLACA';
      if (!agrupado[p]) agrupado[p] = 0;
      agrupado[p] += 1;
    });

    return Object.entries(agrupado).map(([placa, qtd]) => ({ placa, qtd }));
  }, [devolucoes, datasEfetivas, mostraTodas]);

  const handleCardClick = (tipo) => {
    setFiltroStatusCard(prev => prev === tipo ? 'TODOS' : tipo);
  };

  return (
    <div className="space-y-3 w-full pb-20">
      {/* Barra de Controles: Legenda Organizada em Chips + Seletor de Data Padrão */}
      <div className="bg-background-secondary/80 border border-border-secondary rounded-2xl p-2.5 sm:p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-sm">
        
        {/* Itens da Legenda Organizados em Chips Compactos */}
        <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] text-text-secondary order-2 md:order-1 flex-1">
          <div className="flex items-center gap-1.5 bg-background-primary/70 px-2 py-1 rounded-lg border border-border-tertiary/40">
            <span className="w-2.5 h-2.5 rounded-full bg-success flex-shrink-0"></span>
            <span className="truncate font-medium">Total</span>
          </div>
          <div className="flex items-center gap-1.5 bg-background-primary/70 px-2 py-1 rounded-lg border border-border-tertiary/40">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 flex-shrink-0"></span>
            <span className="truncate font-medium">Parcial</span>
          </div>
          <div className="flex items-center gap-1.5 bg-background-primary/70 px-2 py-1 rounded-lg border border-border-tertiary/40">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 flex-shrink-0"></span>
            <span className="truncate font-medium">No Cliente</span>
          </div>
          <div className="flex items-center gap-1.5 bg-background-primary/70 px-2 py-1 rounded-lg border border-border-tertiary/40">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 flex-shrink-0"></span>
            <span className="truncate font-medium">Descarregando</span>
          </div>
          <div className="flex items-center gap-1.5 bg-background-primary/70 px-2 py-1 rounded-lg border border-border-tertiary/40">
            <span className="w-2.5 h-2.5 rounded-full bg-danger flex-shrink-0"></span>
            <span className="truncate font-medium">Devolução</span>
          </div>
          <div className="flex items-center gap-1.5 bg-background-primary/70 px-2 py-1 rounded-lg border border-border-tertiary/40">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 flex-shrink-0"></span>
            <span className="truncate font-medium">Reentrega</span>
          </div>
          <div className="flex items-center gap-1.5 bg-background-primary/70 px-2 py-1 rounded-lg border border-border-tertiary/40">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 flex-shrink-0"></span>
            <span className="truncate font-medium">Carga Parada</span>
          </div>
          <div className="flex items-center gap-1.5 bg-background-primary/70 px-2 py-1 rounded-lg border border-border-tertiary/40 col-span-3 sm:col-span-1 justify-center sm:justify-start">
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-500 border border-border-secondary flex-shrink-0"></span>
            <span className="truncate font-medium">Pendente</span>
          </div>
        </div>

        {/* Seletor de Modo (Cards vs Mapa GPS) + Seletor de Data Padrão Unificado */}
        <div className="flex items-center justify-center md:justify-end gap-1.5 overflow-x-auto scrollbar-none pb-0.5 sm:pb-0 flex-wrap sm:flex-nowrap order-1 md:order-2 shrink-0">
          {isMonitoramento && (
            <div className="inline-flex items-center bg-background-primary p-0.5 rounded-xl border border-border-secondary mr-1 shrink-0">
              <button
                type="button"
                onClick={() => setModoExibicao('CARDS')}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer",
                  modoEfetivo === 'CARDS'
                    ? "bg-info text-white shadow-xs"
                    : "text-text-secondary hover:text-text-primary"
                )}
              >
                <LayoutGrid size={13} />
                <span>Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setModoExibicao('MAPA')}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer",
                  modoEfetivo === 'MAPA'
                    ? "bg-primary text-white shadow-xs"
                    : "text-text-secondary hover:text-text-primary"
                )}
              >
                <Route size={13} />
                <span>Mapa &amp; Trajeto</span>
              </button>
            </div>
          )}

          <button
            onClick={() => setGlobalFilters({
              visaoMonitoramento: {
                ...globalFilters.visaoMonitoramento,
                datas: mostraTodas ? [] : ['TODAS'],
                placas: []
              }
            })}
            className={cn(
              "px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border whitespace-nowrap shadow-sm shrink-0 cursor-pointer",
              mostraTodas 
                ? "bg-primary text-white border-primary shadow-primary/20" 
                : "bg-background-secondary text-text-secondary border-border-tertiary hover:bg-border-tertiary hover:text-text-primary"
            )}
          >
            Todas as Datas
          </button>

          {/* Pílulas Diretas para as Datas com Cargas no Banco */}
          {datasComCarga.map(({ data, count }) => {
            const isSelected = !mostraTodas && datasEfetivas.includes(data);
            const isHoje = data === format(new Date(), 'yyyy-MM-dd');
            return (
              <button
                key={data}
                onClick={() => selecionarDataUnica(data)}
                className={cn(
                  "px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border whitespace-nowrap shadow-sm shrink-0 flex items-center gap-1.5 cursor-pointer",
                  isSelected 
                    ? "bg-info text-white border-info shadow-info/20 ring-1 ring-info" 
                    : "bg-background-secondary text-text-secondary border-border-secondary hover:border-info hover:text-text-primary"
                )}
                title={`Visualizar frota de ${new Date(data).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}`}
              >
                <Calendar size={12} className={isSelected ? "text-white" : "text-info"} />
                <span>{new Date(data).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</span>
                <span className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                  isSelected ? "bg-white/20 text-white" : "bg-border-tertiary text-text-tertiary"
                )}>
                  {count}
                </span>
                {isHoje && <span className="text-[9px] uppercase tracking-wider opacity-85">(Hoje)</span>}
              </button>
            );
          })}

          {/* Caso uma data arbitrária sem cargas tenha sido selecionada pelo calendário */}
          {!mostraTodas && datasEfetivas.length > 0 && !datasComCarga.some(d => d.data === datasEfetivas[0]) && (
            <div className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm whitespace-nowrap shrink-0">
              <Calendar size={12} className="text-amber-400" />
              <span>{new Date(datasEfetivas[0]).toLocaleDateString('pt-BR', {timeZone: 'UTC'})} (0)</span>
              <button 
                onClick={() => {
                  if (datasComCarga.length > 0) selecionarDataUnica(datasComCarga[0].data);
                  else selecionarTodasDatas();
                }} 
                className="hover:text-white cursor-pointer" 
                title="Remover data vazia"
              >
                <X size={12} />
              </button>
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
                  if (val) {
                    selecionarDataUnica(val);
                    setTimeout(() => setDateInputValue(''), 100);
                  }
                }}
                className="absolute top-0 right-0 h-full w-full opacity-0 pointer-events-auto cursor-pointer"
              />
            </label>
          )}
        </div>
      </div>

      {/* 5 Cards de Status do Topo (Total, Em Rota, Com Devolução, Retornando, Finalizados) com Função de Filtro */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-2.5">
        {/* 1. TOTAL */}
        <button
          type="button"
          onClick={() => handleCardClick('TODOS')}
          className={cn(
            "glass-panel p-2.5 sm:p-3 rounded-xl text-center border-b-4 border-info transition-all duration-200 cursor-pointer text-left sm:text-center group relative overflow-hidden",
            filtroStatusCard === 'TODOS' ? "ring-2 ring-info shadow-md bg-info/10 scale-[1.02]" : "hover:bg-background-secondary opacity-90 hover:opacity-100 hover:scale-[1.01]"
          )}
        >
          <div className="flex items-center justify-between sm:justify-center gap-1.5 mb-1">
            <Truck size={16} className="text-info" />
            <span className="text-[10px] sm:text-[11px] uppercase font-extrabold text-text-secondary dark:text-text-tertiary">Total</span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-text-primary">{frotaStats.totais.totalCarros}</p>
        </button>

        {/* 2. EM ROTA */}
        <button
          type="button"
          onClick={() => handleCardClick('EM_ROTA')}
          className={cn(
            "glass-panel p-2.5 sm:p-3 rounded-xl text-center border-b-4 border-warning transition-all duration-200 cursor-pointer text-left sm:text-center group relative overflow-hidden",
            filtroStatusCard === 'EM_ROTA' ? "ring-2 ring-warning shadow-md bg-warning/10 scale-[1.02]" : "hover:bg-background-secondary opacity-90 hover:opacity-100 hover:scale-[1.01]"
          )}
        >
          <div className="flex items-center justify-between sm:justify-center gap-1.5 mb-1">
            <Clock size={16} className="text-warning" />
            <span className="text-[10px] sm:text-[11px] uppercase font-extrabold text-text-secondary dark:text-text-tertiary">Em Rota</span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-text-primary">{frotaStats.totais.emRota}</p>
        </button>

        {/* 3. COM DEVOLUÇÃO */}
        <button
          type="button"
          onClick={() => handleCardClick('COM_DEVOLUCAO')}
          className={cn(
            "glass-panel p-2.5 sm:p-3 rounded-xl text-center border-b-4 border-danger transition-all duration-200 cursor-pointer text-left sm:text-center group relative overflow-hidden",
            filtroStatusCard === 'COM_DEVOLUCAO' ? "ring-2 ring-danger shadow-md bg-danger/10 scale-[1.02]" : "hover:bg-background-secondary opacity-90 hover:opacity-100 hover:scale-[1.01]"
          )}
        >
          <div className="flex items-center justify-between sm:justify-center gap-1.5 mb-1">
            <RotateCcw size={16} className="text-danger" />
            <span className="text-[10px] sm:text-[11px] uppercase font-extrabold text-text-secondary dark:text-text-tertiary">Com Devolução</span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-danger">{frotaStats.totais.comDevolucao}</p>
        </button>

        {/* 4. RETORNANDO */}
        <button
          type="button"
          onClick={() => handleCardClick('RETORNANDO')}
          className={cn(
            "glass-panel p-2.5 sm:p-3 rounded-xl text-center border-b-4 border-blue-500 transition-all duration-200 cursor-pointer text-left sm:text-center group relative overflow-hidden",
            filtroStatusCard === 'RETORNANDO' ? "ring-2 ring-blue-500 shadow-md bg-blue-500/10 scale-[1.02]" : "hover:bg-background-secondary opacity-90 hover:opacity-100 hover:scale-[1.01]"
          )}
        >
          <div className="flex items-center justify-between sm:justify-center gap-1.5 mb-1">
            <Navigation size={16} className="text-blue-500" />
            <span className="text-[10px] sm:text-[11px] uppercase font-extrabold text-text-secondary dark:text-text-tertiary">Retornando</span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-text-primary">{frotaStats.totais.retornando}</p>
        </button>

        {/* 5. FINALIZADOS */}
        <button
          type="button"
          onClick={() => handleCardClick('FINALIZADOS')}
          className={cn(
            "glass-panel p-2.5 sm:p-3 rounded-xl text-center border-b-4 border-success transition-all duration-200 cursor-pointer text-left sm:text-center group relative overflow-hidden col-span-2 sm:col-span-1",
            filtroStatusCard === 'FINALIZADOS' ? "ring-2 ring-success shadow-md bg-success/10 scale-[1.02]" : "hover:bg-background-secondary opacity-90 hover:opacity-100 hover:scale-[1.01]"
          )}
        >
          <div className="flex items-center justify-between sm:justify-center gap-1.5 mb-1">
            <CheckCircle size={16} className="text-success" />
            <span className="text-[10px] sm:text-[11px] uppercase font-extrabold text-text-secondary dark:text-text-tertiary">Finalizados</span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-text-primary">{frotaStats.totais.finalizados}</p>
        </button>
      </div>

      {/* Indicador de Filtro Ativo */}
      {filtroStatusCard !== 'TODOS' && (
        <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-info/10 border border-info/20 text-xs text-info">
          <span className="font-semibold flex items-center gap-1.5">
            <Filter size={13} /> Filtrando por:{' '}
            <strong className="underline">
              {filtroStatusCard === 'EM_ROTA' && 'Em Rota'}
              {filtroStatusCard === 'COM_DEVOLUCAO' && 'Com Devolução'}
              {filtroStatusCard === 'RETORNANDO' && 'Retornando'}
              {filtroStatusCard === 'FINALIZADOS' && 'Finalizados'}
            </strong>{' '}
            ({carrosFiltrados.length} {carrosFiltrados.length === 1 ? 'veículo' : 'veículos'})
          </span>
          <button
            type="button"
            onClick={() => setFiltroStatusCard('TODOS')}
            className="flex items-center gap-1 text-[11px] font-bold text-text-secondary hover:text-danger p-1 rounded transition-colors"
          >
            <X size={13} /> Limpar Filtro
          </button>
        </div>
      )}

      {/* Alerta de Placas com Retorno */}
      {retornosDoDia.length > 0 && filtroStatusCard !== 'FINALIZADOS' && (
        <div className="glass-panel p-2.5 sm:p-3 rounded-xl border-l-4 border-danger bg-danger/5">
          <h3 className="text-xs font-bold text-danger uppercase flex items-center gap-1.5 mb-1.5">
            <AlertTriangle size={14} /> Atenção: Retorno de Mercadoria
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {retornosDoDia.map(carro => (
              <div key={`retorno-${carro.placa}`} className="bg-danger/10 border border-danger/20 px-2 py-1 rounded-lg flex items-center gap-1.5">
                <span className="font-bold text-danger text-xs">{carro.placa}</span>
                <span className="text-[10px] bg-danger text-white px-1.5 py-0.2 rounded-full font-bold">
                  {carro.qtd} {carro.qtd === 1 ? 'ocorrência' : 'ocorrências'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modo Mapa ao Vivo & Trajeto GPS - Exclusivo para Monitoramento */}
      {isMonitoramento && modoEfetivo === 'MAPA' && (
        <MapaRastreamentoFrota
          carros={carrosFiltrados}
          rastreamentoFrota={rastreamentoFrota}
          rotasGps={rotasGps}
          clientesGeoloc={clientesGeoloc}
          motoristas={motoristas}
          datasEfetivas={datasEfetivas}
          mostraTodas={mostraTodas}
          placaSelecionada={placaMapaFoco}
          onSelectPlaca={(p) => setPlacaMapaFoco(p)}
        />
      )}

      {/* Grid de Carros (2 colunas no Mobile, 3 colunas no Desktop) */}
      {modoEfetivo === 'CARDS' && (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 gap-2.5 sm:gap-4 pb-20">
        {carrosFiltrados.length === 0 ? (
          <div className="col-span-full text-center text-text-tertiary py-8 glass-panel rounded-xl">
            <Truck className="mx-auto h-10 w-10 mb-2 opacity-50" />
            <p className="text-xs font-medium">
              {filtroStatusCard !== 'TODOS' ? 'Nenhum veículo encontrado para o filtro selecionado.' : 'Nenhuma placa com entregas registradas para esta data.'}
            </p>
            {filtroStatusCard !== 'TODOS' && (
              <button 
                onClick={() => setFiltroStatusCard('TODOS')}
                className="mt-2 text-xs text-info font-bold hover:underline"
              >
                Ver todos os veículos
              </button>
            )}
          </div>
        ) : (
          carrosFiltrados.map(carro => {
            const motInfo = (motoristas || []).find(m => m.placa === carro.placa);
            const hojeIso = new Date().toISOString().slice(0, 10);
            const liveGps = (rastreamentoFrota || []).find(
              r => String(r.placa || r.id || '').trim().toUpperCase() === carro.placa &&
                (mostraTodas || !r.data || datasEfetivas.includes(r.data) || r.data === hojeIso)
            );
            const rotaDoDia = (rotasGps || []).find(
              rg => String(rg.placa || '').trim().toUpperCase() === carro.placa &&
                (mostraTodas || !rg.data || datasEfetivas.includes(rg.data))
            );
            const qtdPontosGps = Array.isArray(rotaDoDia?.pontos) ? rotaDoDia.pontos.length : 0;
            const temSinalGps = Boolean(liveGps?.lat || qtdPontosGps > 0);
            const gpsDesligado = liveGps && liveGps.gpsAtivo === false;

            return (
              <div 
                key={carro.placa} 
                className={cn(
                  "glass-panel p-2.5 sm:p-3.5 rounded-xl transition-all border-l-4 flex flex-col justify-between shadow-sm hover:shadow-md",
                  carro.status === 'Finalizado' ? 'border-success' : carro.status === 'Retornando' ? 'border-blue-500' : 'border-warning',
                  carro.temDevolucao && 'ring-1 ring-danger/40'
                )}
              >
                <div>
                  {/* Topo do Card: Placa e Status */}
                  <div className="flex justify-between items-start gap-1 mb-2">
                    <div>
                      <span className="text-xs sm:text-sm font-black bg-background-secondary px-2 py-0.5 rounded-md border border-border-secondary shadow-xs tracking-wide block text-text-primary">
                        {carro.placa}
                      </span>
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        <span className={cn(
                          "text-[9px] font-black uppercase px-2 py-0.5 rounded-md inline-block border",
                          carro.status === 'Finalizado' 
                            ? "text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/30" 
                            : carro.status === 'Retornando' 
                              ? "text-blue-800 dark:text-blue-300 bg-blue-500/10 dark:bg-blue-500/15 border-blue-500/30" 
                              : "text-amber-800 dark:text-amber-300 bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/30"
                        )}>
                          {carro.status}
                        </span>
                        {isMonitoramento && temSinalGps && (
                          <button
                            type="button"
                            onClick={() => {
                              setPlacaMapaFoco(carro.placa);
                              setModoExibicao('MAPA');
                            }}
                            className={cn(
                              "text-[9px] font-bold px-1.5 py-0.5 rounded-md inline-flex items-center gap-1 border cursor-pointer transition-colors",
                              gpsDesligado
                                ? "bg-danger/10 text-danger border-danger/30 hover:bg-danger/20"
                                : "bg-info/10 text-info border-info/30 hover:bg-info/20"
                            )}
                            title="Abrir mapa e linha do trajeto percorrido"
                          >
                            <LocateFixed size={10} />
                            <span>{gpsDesligado ? 'GPS Off' : qtdPontosGps > 1 ? `Trajeto (${qtdPontosGps})` : 'Ver Mapa'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className={cn(
                        "text-lg sm:text-xl font-black leading-none block",
                        carro.pendentes === 0 ? "text-success" : "text-text-primary"
                      )}>
                        {carro.pendentes}
                      </span>
                      <span className="text-[9px] uppercase font-extrabold text-text-secondary dark:text-text-tertiary leading-none">
                        {carro.pendentes === 0 ? 'Concluído' : 'Faltam'}
                      </span>
                    </div>
                  </div>

                  {/* Motorista */}
                  <div className="flex items-center justify-between my-2 p-1.5 bg-background-secondary rounded-lg border border-border-secondary text-[11px] gap-1">
                    <div className="flex items-center min-w-0 flex-1">
                      <User size={12} className="text-info flex-shrink-0 mr-1" />
                      <span className="font-bold text-text-primary truncate text-[10px] sm:text-xs" title={motInfo?.nome || 'Motorista não cadastrado'}>
                        {motInfo?.nome ? motInfo.nome.split(' ')[0] : 'Sem cadastro'}
                      </span>
                      {motInfo?.whatsapp && (
                        <a 
                          href={`https://wa.me/55${motInfo.whatsapp.replace(/\D/g, '')}`} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-success hover:text-success/80 ml-1 p-0.5"
                          title="WhatsApp"
                        >
                          <Phone size={11} />
                        </a>
                      )}
                      {(motInfo?.chavePix || motInfo?.pix) && (
                        <span 
                          className="ml-1 text-[9px] font-bold px-1.5 py-0.2 bg-info/10 text-info border border-info/20 rounded font-mono truncate max-w-[70px] cursor-help"
                          title={`Chave PIX: ${motInfo.chavePix || motInfo.pix}`}
                        >
                          PIX
                        </span>
                      )}
                    </div>
                    <button 
                      onClick={() => setMotoristaEditando({ placa: carro.placa, ...motInfo })} 
                      className="p-1 text-text-secondary hover:text-info bg-background-primary border border-border-secondary rounded flex-shrink-0 cursor-pointer shadow-xs"
                      title="Editar motorista"
                    >
                      <Edit2 size={11} />
                    </button>
                  </div>
                </div>

                {/* Seção da Barra de Progresso Segmentada */}
                <div className="mt-2 pt-1 border-t border-border-secondary">
                  <div className="flex justify-between text-[10px] font-bold text-text-secondary mb-1">
                    <span>{carro.finalizadas}/{carro.total}</span>
                    <span className="text-text-primary">{carro.percentual}%</span>
                  </div>

                  {/* Barra Segmentada Multi-cor */}
                  <div className="w-full bg-slate-200 dark:bg-zinc-800 rounded-full h-2 sm:h-2.5 overflow-hidden border border-slate-300 dark:border-zinc-700 flex">
                    {carro.pctEntregues > 0 && (
                      <div 
                        className="bg-emerald-600 dark:bg-emerald-500 h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                        style={{ width: `${carro.pctEntregues}%` }}
                        title={`Entrega total: ${carro.entregues}`}
                      />
                    )}
                    {carro.pctParciais > 0 && (
                      <div 
                        className="bg-orange-500 h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                        style={{ width: `${carro.pctParciais}%` }}
                        title={`Entrega parcial: ${carro.parciais}`}
                      />
                    )}
                    {carro.pctNoCliente > 0 && (
                      <div 
                        className="bg-sky-500 h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                        style={{ width: `${carro.pctNoCliente}%` }}
                        title={`No cliente: ${carro.noCliente}`}
                      />
                    )}
                    {carro.pctDescarregando > 0 && (
                      <div 
                        className="bg-blue-600 h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                        style={{ width: `${carro.pctDescarregando}%` }}
                        title={`Descarregando: ${carro.descarregando}`}
                      />
                    )}
                    {carro.pctDevolucoes > 0 && (
                      <div 
                        className="bg-rose-600 dark:bg-rose-500 h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                        style={{ width: `${carro.pctDevolucoes}%` }}
                        title={`Devoluções: ${carro.devolucoes}`}
                      />
                    )}
                    {carro.pctReentregas > 0 && (
                      <div 
                        className="bg-purple-600 dark:bg-purple-500 h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                        style={{ width: `${carro.pctReentregas}%` }}
                        title={`Reentregas: ${carro.reentregas}`}
                      />
                    )}
                    {carro.pctCargaParada > 0 && (
                      <div 
                        className="bg-yellow-500 h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                        style={{ width: `${carro.pctCargaParada}%` }}
                        title={`Carga parada: ${carro.cargaParada}`}
                      />
                    )}
                  </div>

                  {/* Badges de Resumo Rápido da Barra */}
                  <div className="flex flex-wrap gap-1 mt-1.5 text-[9px] font-bold">
                    {carro.entregues > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                        {carro.entregues} ok
                      </span>
                    )}
                    {carro.parciais > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-800 dark:text-orange-300 border border-orange-500/30">
                        {carro.parciais} parcial
                      </span>
                    )}
                    {carro.noCliente > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-800 dark:text-sky-300 border border-sky-500/30">
                        {carro.noCliente} cliente
                      </span>
                    )}
                    {carro.descarregando > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-600/15 text-blue-800 dark:text-blue-300 border border-blue-600/30">
                        {carro.descarregando} descarreg
                      </span>
                    )}
                    {carro.devolucoes > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-500/30">
                        {carro.devolucoes} dev
                      </span>
                    )}
                    {carro.reentregas > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-800 dark:text-purple-300 border border-purple-500/30">
                        {carro.reentregas} reent
                      </span>
                    )}
                    {carro.cargaParada > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-yellow-500/15 text-amber-900 dark:text-yellow-300 border border-yellow-500/30">
                        {carro.cargaParada} parada
                      </span>
                    )}
                    {carro.apenasPendentes > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-background-secondary text-text-secondary border border-border-secondary">
                        {carro.apenasPendentes} pend
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      )}

      <PerfilMotoristaModal
        isOpen={!!motoristaEditando}
        dadosIniciais={motoristaEditando}
        onClose={() => setMotoristaEditando(null)}
        onSave={async (dados) => {
          if (motoristaEditando?.placa) {
            await atualizarMotoristaAdmin(motoristaEditando.placa, dados);
          }
          setMotoristaEditando(null);
        }}
      />
    </div>
  );
}
