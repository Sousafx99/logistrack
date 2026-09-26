import { useState, useMemo } from 'react';
import { Truck, CheckCircle, Clock, AlertTriangle, User, Phone, Edit2, RotateCcw, Calendar, Navigation, Layers, X, Filter } from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { PerfilMotoristaModal } from '../components/motorista/PerfilMotoristaModal';

export function StatusFrota() {
  const { entregas, devolucoes, motoristas, cargasFinalizadas, globalFilters, setGlobalFilters, atualizarMotoristaAdmin } = useStore();
  const dataSelecionada = globalFilters.data; // use the same global date filter
  
  const [motoristaEditando, setMotoristaEditando] = useState(null);
  const [filtroStatusCard, setFiltroStatusCard] = useState('TODOS');

  const frotaStats = useMemo(() => {
    const entregasDoDia = (entregas || []).filter(e => {
      const p = (e.placa || '').trim().toUpperCase();
      return e.data === dataSelecionada && p && p !== 'SEM PLACA' && p !== 'NULL';
    });
    
    // Devoluções registradas para a data selecionada
    const devDoDia = (devolucoes || []).filter(d => {
      const dataDev = d.data ? (d.data.length >= 10 ? d.data.slice(0, 10) : d.data) : '';
      return dataDev === dataSelecionada;
    });

    // Cargas finalizadas registradas para a data selecionada
    const finalizadosDoDia = (cargasFinalizadas || []).filter(cf => cf.data === dataSelecionada);

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
        if (pCf && pCf === c.placa) return true;
        return c.notas.some(n => n.carga && n.carga === cf.carga);
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
  }, [entregas, devolucoes, cargasFinalizadas, dataSelecionada]);

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
    // Pegamos as devoluções que foram geradas no dia selecionado (d.data é string ISO ou YYYY-MM-DD)
    const doDia = (devolucoes || []).filter(d => {
      const dataDev = d.data ? (d.data.length >= 10 ? d.data.slice(0, 10) : d.data) : '';
      return dataDev === dataSelecionada;
    });
    
    const agrupado = {};
    doDia.forEach(d => {
      const p = (d.placa || '').trim().toUpperCase() || 'SEM PLACA';
      if (!agrupado[p]) agrupado[p] = 0;
      agrupado[p] += 1;
    });

    return Object.entries(agrupado).map(([placa, qtd]) => ({ placa, qtd }));
  }, [devolucoes, dataSelecionada]);

  const handleCardClick = (tipo) => {
    setFiltroStatusCard(prev => prev === tipo ? 'TODOS' : tipo);
  };

  return (
    <div className="space-y-3 w-full pb-20">
      {/* Barra de Controles: Legenda Organizada em Chips + Seletor de Data */}
      <div className="bg-background-secondary/80 border border-border-secondary rounded-2xl p-2.5 sm:p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shadow-sm">
        {/* Seletor de Data (No topo no mobile com visual destacado, e à direita no desktop) */}
        <div className="flex items-center justify-between sm:justify-start gap-2 bg-background-primary border border-border-secondary px-3 py-1.5 rounded-xl shadow-inner sm:order-2 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <Calendar size={14} className="text-info" />
            <span className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider">Data:</span>
          </div>
          <input 
            type="date"
            value={dataSelecionada}
            onChange={(e) => {
              if (e.target.value) setGlobalFilters({ data: e.target.value });
            }}
            className="text-xs font-bold text-text-primary bg-background-secondary sm:bg-transparent border border-border-tertiary sm:border-none px-2 py-0.5 sm:p-0 rounded-md focus:outline-none cursor-pointer"
          />
        </div>

        {/* Itens da Legenda Organizados em Chips Compactos */}
        <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] text-text-secondary sm:order-1 flex-1">
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
      </div>

      {/* 5 Cards de Status do Topo (Total, Em Rota, Com Devolução, Retornando, Finalizados) com Função de Filtro */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-2.5">
        {/* 1. TOTAL */}
        <button
          type="button"
          onClick={() => handleCardClick('TODOS')}
          className={cn(
            "glass-panel p-2.5 sm:p-3 rounded-xl text-center border-b-4 border-info transition-all duration-200 cursor-pointer text-left sm:text-center group relative overflow-hidden",
            filtroStatusCard === 'TODOS' ? "ring-2 ring-info shadow-md bg-info/10 scale-[1.02]" : "hover:bg-background-secondary/80 opacity-90 hover:opacity-100 hover:scale-[1.01]"
          )}
        >
          <div className="flex items-center justify-between sm:justify-center gap-1.5 mb-1">
            <Truck size={16} className="text-info" />
            <span className="text-[9px] sm:text-[10px] uppercase font-bold text-text-tertiary">Total</span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-text-primary">{frotaStats.totais.totalCarros}</p>
        </button>

        {/* 2. EM ROTA */}
        <button
          type="button"
          onClick={() => handleCardClick('EM_ROTA')}
          className={cn(
            "glass-panel p-2.5 sm:p-3 rounded-xl text-center border-b-4 border-warning transition-all duration-200 cursor-pointer text-left sm:text-center group relative overflow-hidden",
            filtroStatusCard === 'EM_ROTA' ? "ring-2 ring-warning shadow-md bg-warning/10 scale-[1.02]" : "hover:bg-background-secondary/80 opacity-90 hover:opacity-100 hover:scale-[1.01]"
          )}
        >
          <div className="flex items-center justify-between sm:justify-center gap-1.5 mb-1">
            <Clock size={16} className="text-warning" />
            <span className="text-[9px] sm:text-[10px] uppercase font-bold text-text-tertiary">Em Rota</span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-text-primary">{frotaStats.totais.emRota}</p>
        </button>

        {/* 3. COM DEVOLUÇÃO */}
        <button
          type="button"
          onClick={() => handleCardClick('COM_DEVOLUCAO')}
          className={cn(
            "glass-panel p-2.5 sm:p-3 rounded-xl text-center border-b-4 border-danger transition-all duration-200 cursor-pointer text-left sm:text-center group relative overflow-hidden",
            filtroStatusCard === 'COM_DEVOLUCAO' ? "ring-2 ring-danger shadow-md bg-danger/10 scale-[1.02]" : "hover:bg-background-secondary/80 opacity-90 hover:opacity-100 hover:scale-[1.01]"
          )}
        >
          <div className="flex items-center justify-between sm:justify-center gap-1.5 mb-1">
            <RotateCcw size={16} className="text-danger" />
            <span className="text-[9px] sm:text-[10px] uppercase font-bold text-text-tertiary">Com Devolução</span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-danger">{frotaStats.totais.comDevolucao}</p>
        </button>

        {/* 4. RETORNANDO */}
        <button
          type="button"
          onClick={() => handleCardClick('RETORNANDO')}
          className={cn(
            "glass-panel p-2.5 sm:p-3 rounded-xl text-center border-b-4 border-blue-500 transition-all duration-200 cursor-pointer text-left sm:text-center group relative overflow-hidden",
            filtroStatusCard === 'RETORNANDO' ? "ring-2 ring-blue-500 shadow-md bg-blue-500/10 scale-[1.02]" : "hover:bg-background-secondary/80 opacity-90 hover:opacity-100 hover:scale-[1.01]"
          )}
        >
          <div className="flex items-center justify-between sm:justify-center gap-1.5 mb-1">
            <Navigation size={16} className="text-blue-500" />
            <span className="text-[9px] sm:text-[10px] uppercase font-bold text-text-tertiary">Retornando</span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-text-primary">{frotaStats.totais.retornando}</p>
        </button>

        {/* 5. FINALIZADOS */}
        <button
          type="button"
          onClick={() => handleCardClick('FINALIZADOS')}
          className={cn(
            "glass-panel p-2.5 sm:p-3 rounded-xl text-center border-b-4 border-success transition-all duration-200 cursor-pointer text-left sm:text-center group relative overflow-hidden col-span-2 sm:col-span-1",
            filtroStatusCard === 'FINALIZADOS' ? "ring-2 ring-success shadow-md bg-success/10 scale-[1.02]" : "hover:bg-background-secondary/80 opacity-90 hover:opacity-100 hover:scale-[1.01]"
          )}
        >
          <div className="flex items-center justify-between sm:justify-center gap-1.5 mb-1">
            <CheckCircle size={16} className="text-success" />
            <span className="text-[9px] sm:text-[10px] uppercase font-bold text-text-tertiary">Finalizados</span>
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

      {/* Grid de Carros (2 colunas no Mobile, 3 colunas no Desktop) */}
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
            return (
              <div 
                key={carro.placa} 
                className={cn(
                  "glass-panel p-2.5 sm:p-3.5 rounded-xl transition-all border-l-4 flex flex-col justify-between shadow-sm",
                  carro.status === 'Finalizado' ? 'border-success opacity-85' : carro.status === 'Retornando' ? 'border-blue-500' : 'border-warning',
                  carro.temDevolucao && 'ring-1 ring-danger/30'
                )}
              >
                <div>
                  {/* Topo do Card: Placa e Status */}
                  <div className="flex justify-between items-start gap-1 mb-2">
                    <div>
                      <span className="text-xs sm:text-sm font-black bg-background-secondary px-2 py-0.5 rounded-md border border-border-tertiary shadow-sm tracking-wide block">
                        {carro.placa}
                      </span>
                      <span className={cn(
                        "text-[9px] font-bold uppercase px-1.5 py-0.2 rounded-full mt-1 inline-block",
                        carro.status === 'Finalizado' ? "text-success bg-success/10" : carro.status === 'Retornando' ? "text-blue-400 bg-blue-500/10" : "text-warning bg-warning/10"
                      )}>
                        {carro.status}
                      </span>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className={cn(
                        "text-lg sm:text-xl font-black leading-none block",
                        carro.pendentes === 0 ? "text-success" : "text-text-primary"
                      )}>
                        {carro.pendentes}
                      </span>
                      <span className="text-[9px] uppercase font-bold text-text-tertiary leading-none">
                        {carro.pendentes === 0 ? 'Concluído' : 'Faltam'}
                      </span>
                    </div>
                  </div>

                  {/* Motorista */}
                  <div className="flex items-center justify-between my-2 p-1.5 bg-background-primary rounded-lg border border-border-tertiary text-[11px] gap-1">
                    <div className="flex items-center min-w-0 flex-1">
                      <User size={12} className="text-info flex-shrink-0 mr-1" />
                      <span className="font-medium text-text-secondary truncate text-[10px] sm:text-xs" title={motInfo?.nome || 'Motorista não cadastrado'}>
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
                      className="p-0.5 text-text-tertiary hover:text-info bg-background-secondary rounded flex-shrink-0"
                      title="Editar motorista"
                    >
                      <Edit2 size={11} />
                    </button>
                  </div>
                </div>

                {/* Seção da Barra de Progresso Segmentada */}
                <div className="mt-2 pt-1 border-t border-border-secondary/50">
                  <div className="flex justify-between text-[10px] font-bold text-text-secondary mb-1">
                    <span>{carro.finalizadas}/{carro.total}</span>
                    <span className="text-text-primary">{carro.percentual}%</span>
                  </div>

                  {/* Barra Segmentada Multi-cor */}
                  <div className="w-full bg-background-secondary rounded-full h-2 sm:h-2.5 overflow-hidden border border-border-tertiary flex">
                    {carro.pctEntregues > 0 && (
                      <div 
                        className="bg-success h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
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
                        className="bg-sky-400 h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
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
                        className="bg-danger h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                        style={{ width: `${carro.pctDevolucoes}%` }}
                        title={`Devoluções: ${carro.devolucoes}`}
                      />
                    )}
                    {carro.pctReentregas > 0 && (
                      <div 
                        className="bg-purple-500 h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                        style={{ width: `${carro.pctReentregas}%` }}
                        title={`Reentregas: ${carro.reentregas}`}
                      />
                    )}
                    {carro.pctCargaParada > 0 && (
                      <div 
                        className="bg-yellow-400 h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                        style={{ width: `${carro.pctCargaParada}%` }}
                        title={`Carga parada: ${carro.cargaParada}`}
                      />
                    )}
                  </div>

                  {/* Badges de Resumo Rápido da Barra */}
                  <div className="flex flex-wrap gap-1 mt-1.5 text-[9px] font-semibold">
                    {carro.entregues > 0 && (
                      <span className="px-1 py-0.2 rounded bg-success/10 text-success">
                        {carro.entregues} ok
                      </span>
                    )}
                    {carro.parciais > 0 && (
                      <span className="px-1 py-0.2 rounded bg-orange-500/10 text-orange-400">
                        {carro.parciais} parcial
                      </span>
                    )}
                    {carro.noCliente > 0 && (
                      <span className="px-1 py-0.2 rounded bg-sky-400/10 text-sky-400">
                        {carro.noCliente} cliente
                      </span>
                    )}
                    {carro.descarregando > 0 && (
                      <span className="px-1 py-0.2 rounded bg-blue-600/15 text-blue-400 font-bold">
                        {carro.descarregando} descarreg
                      </span>
                    )}
                    {carro.devolucoes > 0 && (
                      <span className="px-1 py-0.2 rounded bg-danger/10 text-danger font-bold">
                        {carro.devolucoes} dev
                      </span>
                    )}
                    {carro.reentregas > 0 && (
                      <span className="px-1 py-0.2 rounded bg-purple-500/10 text-purple-400 font-bold">
                        {carro.reentregas} reent
                      </span>
                    )}
                    {carro.cargaParada > 0 && (
                      <span className="px-1 py-0.2 rounded bg-yellow-400/10 text-yellow-400 font-bold">
                        {carro.cargaParada} parada
                      </span>
                    )}
                    {carro.apenasPendentes > 0 && (
                      <span className="px-1 py-0.2 rounded bg-background-secondary text-text-tertiary">
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
