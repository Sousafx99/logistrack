import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { 
  Calendar, 
  MapPin, 
  Truck, 
  Maximize, 
  Minimize,
  RefreshCw,
  Clock,
  Activity,
  CheckCircle2
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { Logo } from '../components/Common/Logo';
import { CardKpisDashboard } from '../components/dashboard/CardKpisDashboard';
import { PainelVeiculoDestaque } from '../components/dashboard/PainelVeiculoDestaque';
import { DistribuicaoStatusBarras } from '../components/dashboard/DistribuicaoStatusBarras';
import { GraficoStatusPorVeiculo } from '../components/dashboard/GraficoStatusPorVeiculo';
import { BannersAlertasDashboard } from '../components/dashboard/BannersAlertasDashboard';

const obterValorNota = (entrega) => {
  if (entrega?.valor !== undefined && entrega?.valor !== null && !isNaN(Number(entrega.valor)) && Number(entrega.valor) > 0) {
    return Number(entrega.valor);
  }
  if (Array.isArray(entrega?.itens) && entrega.itens.length > 0) {
    const soma = entrega.itens.reduce((acc, it) => acc + (Number(it.valor) || 0), 0);
    if (soma > 0) return soma;
  }
  return 0;
};

const formatarData = (dataStr) => {
  if (!dataStr) return '--/--/----';
  try {
    const parts = String(dataStr).split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  } catch {}
  return String(dataStr);
};

export function DashboardLogistico() {
  const { entregas = [], motoristas = [], globalFilters, setGlobalFilters } = useStore();

  const datasSelecionadas = globalFilters.visaoMonitoramento?.datas || [];
  const mostraTodas = datasSelecionadas.includes('TODAS');
  const datasEfetivas = mostraTodas ? [] : (datasSelecionadas.length > 0 ? datasSelecionadas : [globalFilters.data]);

  // Filtro de Rota local para o dashboard
  const [rotaFiltro, setRotaFiltro] = useState('TODAS');

  // Estado do veículo selecionado para o "Veículo em Destaque"
  const [placaSelecionada, setPlacaSelecionada] = useState(null);
  const [autoPlay, setAutoPlay] = useState(true);
  const [mostrarApenasEmRota, setMostrarApenasEmRota] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [horaAtual, setHoraAtual] = useState(new Date());

  const dashboardRef = useRef(null);

  // Relógio em tempo real
  useEffect(() => {
    const timer = setInterval(() => setHoraAtual(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Alternância de tela cheia com foco exclusivo no container do Dashboard (da barra "Dashboard Logístico" para baixo)
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (dashboardRef.current) {
        dashboardRef.current.requestFullscreen().catch(err => {
          console.error("Erro ao ativar tela cheia no elemento do dashboard:", err);
          document.documentElement.requestFullscreen().catch(() => {});
        });
      } else {
        document.documentElement.requestFullscreen().catch(err => console.log(err));
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(err => console.log(err));
      }
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Lista de datas disponíveis no banco de dados
  const datasDisponiveis = useMemo(() => {
    const set = new Set();
    entregas.forEach(e => {
      if (e.data) set.add(e.data);
    });
    return Array.from(set).sort().reverse();
  }, [entregas]);

  // Lista de rotas disponíveis
  const rotasDisponiveis = useMemo(() => {
    const set = new Set();
    entregas.forEach(e => {
      if (e.rota) set.add(String(e.rota).trim().toUpperCase());
    });
    return Array.from(set).sort();
  }, [entregas]);

  // Filtro das entregas ativas conforme data e rota
  const entregasFiltradas = useMemo(() => {
    return entregas.filter(e => {
      const matchData = mostraTodas ? true : datasEfetivas.includes(e.data);
      if (!matchData) return false;

      if (rotaFiltro !== 'TODAS') {
        const r = String(e.rota || '').trim().toUpperCase();
        if (r !== rotaFiltro) return false;
      }

      return true;
    });
  }, [entregas, mostraTodas, datasEfetivas, rotaFiltro]);

  // Agrupamento por Veículo (Placa) com todos os 8 status separados
  const veiculosList = useMemo(() => {
    const map = {};
    const motoristaPorPlaca = {};
    (motoristas || []).forEach(m => {
      if (m.placa) {
        motoristaPorPlaca[m.placa.trim().toUpperCase()] = m.nome;
      }
    });

    entregasFiltradas.forEach(e => {
      const p = (e.placa || '').trim().toUpperCase();
      if (!p || p === 'SEM PLACA' || p === 'NULL' || p === 'UNDEFINED') return;

      if (!map[p]) {
        map[p] = {
          placa: p,
          motoristaNome: e.motorista || motoristaPorPlaca[p] || '',
          rota: e.rota || '',
          carga: e.carga || '',
          total: 0,
          pendentes: 0,
          noCliente: 0,
          descarregando: 0,
          parciais: 0,
          entregues: 0,
          devolucoes: 0,
          cargaParada: 0,
          reentregas: 0
        };
      }

      map[p].total += 1;

      switch (e.status) {
        case 'Pendente':
          map[p].pendentes += 1;
          break;
        case 'No cliente':
          map[p].noCliente += 1;
          break;
        case 'Descarregando':
          map[p].descarregando += 1;
          break;
        case 'Entrega parcial':
          map[p].parciais += 1;
          break;
        case 'Entrega total':
          map[p].entregues += 1;
          break;
        case 'Devolução total':
          map[p].devolucoes += 1;
          break;
        case 'Carga parada':
          map[p].cargaParada += 1;
          break;
        case 'Reentrega':
          map[p].reentregas += 1;
          break;
        default:
          map[p].pendentes += 1;
          break;
      }
    });

    // Ordena pelo maior total de entregas (descendente)
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [entregasFiltradas, motoristas]);

  // Lista dos veículos que NÃO tenham finalizado as entregas (com pendente, no cliente ou descarregando)
  const veiculosEmRota = useMemo(() => {
    return veiculosList.filter(v => (v.pendentes > 0 || v.noCliente > 0 || v.descarregando > 0));
  }, [veiculosList]);

  // Lista efetiva para o carrossel de destaque
  const listaParaDestaque = useMemo(() => {
    if (mostrarApenasEmRota) {
      return veiculosEmRota.length > 0 ? veiculosEmRota : veiculosList;
    }
    return veiculosList;
  }, [mostrarApenasEmRota, veiculosEmRota, veiculosList]);

  // Sincroniza a placa selecionada com a lista de destaque
  useEffect(() => {
    if (listaParaDestaque.length > 0) {
      if (!placaSelecionada || !listaParaDestaque.some(v => v.placa === placaSelecionada)) {
        setPlacaSelecionada(listaParaDestaque[0].placa);
      }
    } else {
      setPlacaSelecionada(null);
    }
  }, [listaParaDestaque, placaSelecionada]);

  // Objeto do veículo atualmente em destaque
  const veiculoDestaque = useMemo(() => {
    if (!placaSelecionada || listaParaDestaque.length === 0) return null;
    return listaParaDestaque.find(v => v.placa === placaSelecionada) || listaParaDestaque[0];
  }, [listaParaDestaque, placaSelecionada]);

  const indexVeiculoDestaque = useMemo(() => {
    if (!veiculoDestaque || listaParaDestaque.length === 0) return 1;
    const idx = listaParaDestaque.findIndex(v => v.placa === veiculoDestaque.placa);
    return idx >= 0 ? idx + 1 : 1;
  }, [listaParaDestaque, veiculoDestaque]);

  // Navegação anterior e próxima para o Veículo em Destaque
  const handlePrevVeiculo = useCallback(() => {
    if (listaParaDestaque.length === 0) return;
    setPlacaSelecionada(curr => {
      const currentIndex = listaParaDestaque.findIndex(v => v.placa === curr);
      const prevIndex = (currentIndex - 1 + listaParaDestaque.length) % listaParaDestaque.length;
      return listaParaDestaque[prevIndex].placa;
    });
  }, [listaParaDestaque]);

  const handleNextVeiculo = useCallback(() => {
    if (listaParaDestaque.length === 0) return;
    setPlacaSelecionada(curr => {
      const currentIndex = listaParaDestaque.findIndex(v => v.placa === curr);
      const nextIndex = (currentIndex + 1) % listaParaDestaque.length;
      return listaParaDestaque[nextIndex].placa;
    });
  }, [listaParaDestaque]);

  // Métricas Globais (KPIs) com suporte a Retornos e Total de Pedidos
  const kpisStats = useMemo(() => {
    const cargasSet = new Set();
    const placasSet = new Set();
    const pedidosSet = new Set();
    let pesoTotal = 0;
    let valorTotal = 0;
    let entregasOk = 0;
    let emAndamento = 0;
    let pendentes = 0;
    let devolucaoTotal = 0;
    let entregaParcial = 0;
    let reentrega = 0;
    let cargaParada = 0;

    // Contadores para o cálculo do OTIF (apenas entregas com veículos/placas vinculadas)
    let totalEntregasComPlaca = 0;
    let entregasOkComPlaca = 0;

    entregasFiltradas.forEach(e => {
      if (e.carga) cargasSet.add(e.carga);
      if (e.pedido) pedidosSet.add(String(e.pedido).trim());
      else if (e.nota) pedidosSet.add(String(e.nota).trim());

      const p = (e.placa || '').trim().toUpperCase();
      const temPlaca = Boolean(p && p !== 'SEM PLACA' && p !== 'NULL' && p !== 'UNDEFINED' && p !== 'S/ PLACA' && p !== 'S/PLACA');

      if (temPlaca) {
        placasSet.add(p);
        totalEntregasComPlaca += 1;
        if (e.status === 'Entrega total') {
          entregasOkComPlaca += 1;
        }
      }

      pesoTotal += Number(e.peso || 0);
      valorTotal += obterValorNota(e);

      if (e.status === 'Entrega total') {
        entregasOk += 1;
      } else if (e.status === 'No cliente' || e.status === 'Descarregando') {
        emAndamento += 1;
      } else if (e.status === 'Pendente') {
        pendentes += 1;
      } else if (e.status === 'Devolução total') {
        devolucaoTotal += 1;
      } else if (e.status === 'Entrega parcial') {
        entregaParcial += 1;
      } else if (e.status === 'Reentrega') {
        reentrega += 1;
      } else if (e.status === 'Carga parada') {
        cargaParada += 1;
      }
    });

    const retornos = devolucaoTotal + entregaParcial + reentrega + cargaParada;
    const total = entregasFiltradas.length;
    const totalPedidos = pedidosSet.size || total;
    
    // OTIF calculado APENAS sobre entregas que têm veículos (placas) vinculados
    const otif = totalEntregasComPlaca > 0 
      ? Math.round((entregasOkComPlaca / totalEntregasComPlaca) * 100) 
      : 0;

    return {
      otif,
      metaOtif: 90,
      totalEntregasComPlaca,
      entregasOkComPlaca,
      totalCargas: cargasSet.size || (total > 0 ? 1 : 0),
      totalPedidos,
      totalVeiculos: placasSet.size,
      pesoTotal,
      valorTotal,
      realizadas: entregasOk,
      emAndamento,
      pendentes,
      retornos,
      detalheRetornos: {
        devolucoes: devolucaoTotal,
        parciais: entregaParcial,
        reentregas: reentrega,
        cargaParada
      },
      totalGeral: total
    };
  }, [entregasFiltradas]);

  // Distribuição geral de status rigorosamente com os 8 status oficiais
  const distribuicaoStatus = useMemo(() => {
    const dist = {
      pendente: 0,
      noCliente: 0,
      descarregando: 0,
      entregaParcial: 0,
      entregaTotal: 0,
      devolucaoTotal: 0,
      cargaParada: 0,
      reentrega: 0
    };

    entregasFiltradas.forEach(e => {
      switch (e.status) {
        case 'Pendente':
          dist.pendente += 1;
          break;
        case 'No cliente':
          dist.noCliente += 1;
          break;
        case 'Descarregando':
          dist.descarregando += 1;
          break;
        case 'Entrega parcial':
          dist.entregaParcial += 1;
          break;
        case 'Entrega total':
          dist.entregaTotal += 1;
          break;
        case 'Devolução total':
          dist.devolucaoTotal += 1;
          break;
        case 'Carga parada':
          dist.cargaParada += 1;
          break;
        case 'Reentrega':
          dist.reentrega += 1;
          break;
        default:
          dist.pendente += 1;
          break;
      }
    });

    return dist;
  }, [entregasFiltradas]);

  return (
    <div 
      ref={dashboardRef} 
      className={`space-y-4 pb-12 transition-colors ${
        isFullscreen 
          ? 'bg-[#0f0f10] text-zinc-100 p-4 sm:p-6 overflow-y-auto h-screen w-screen' 
          : ''
      }`}
    >
      {/* 1. Barra Superior Temática (Header) fiel ao mockup */}
      <div className="bg-[#121212] text-white rounded-2xl px-5 py-3.5 border border-zinc-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Identidade Visual */}
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-white/5 border border-zinc-700/60 p-1 flex items-center justify-center shrink-0 shadow-inner overflow-hidden">
            <img 
              src="/logo-rj-alimentos-alpha.png" 
              alt="Logo RJ Alimentos" 
              className="w-full h-full object-contain" 
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-[#facc15] leading-tight">
                Dashboard Logístico
              </h1>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" title="Monitoramento em Tempo Real" />
            </div>
            <p className="text-xs sm:text-sm text-zinc-300 font-medium">
              Monitoramento de Rotas e Cargas - RJ Alimentos
            </p>
          </div>
        </div>

        {/* Filtros da Barra Superior + Relógio e Tela Cheia */}
        <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto justify-end">
          {/* Relógio Digital */}
          <div className="hidden sm:flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-sm text-zinc-200 font-mono font-bold">
            <Clock size={14} className="text-[#facc15]" />
            <span>{horaAtual.toLocaleTimeString('pt-BR')}</span>
          </div>

          {/* Seletor de Data */}
          <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-sm">
            <Calendar size={14} className="text-[#facc15] shrink-0" />
            <span className="text-xs uppercase font-bold text-zinc-400">Data:</span>
            <select
              value={mostraTodas ? 'TODAS' : (datasEfetivas[0] || '')}
              onChange={(e) => {
                const val = e.target.value;
                setGlobalFilters({
                  visaoMonitoramento: {
                    ...globalFilters.visaoMonitoramento,
                    datas: val === 'TODAS' ? ['TODAS'] : [val]
                  }
                });
              }}
              className="bg-transparent text-white font-bold text-sm cursor-pointer focus:outline-hidden"
            >
              <option value="TODAS" className="bg-zinc-900 text-white">Todas as datas</option>
              {datasDisponiveis.map(d => (
                <option key={d} value={d} className="bg-zinc-900 text-white">
                  {formatarData(d)}
                </option>
              ))}
            </select>
          </div>

          {/* Seletor de Rota */}
          <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-sm">
            <MapPin size={14} className="text-[#facc15] shrink-0" />
            <span className="text-xs uppercase font-bold text-zinc-400">Rota:</span>
            <select
              value={rotaFiltro}
              onChange={(e) => setRotaFiltro(e.target.value)}
              className="bg-transparent text-white font-bold text-sm cursor-pointer focus:outline-hidden"
            >
              <option value="TODAS" className="bg-zinc-900 text-white">Todas as rotas</option>
              {rotasDisponiveis.map(r => (
                <option key={r} value={r} className="bg-zinc-900 text-white">
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Botão de Tela Cheia para TVs de Monitoramento */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-colors cursor-pointer"
            title={isFullscreen ? "Sair da Tela Cheia" : "Modo Tela Cheia (TV)"}
          >
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
        </div>
      </div>

      {/* 2. Linha Superior Horizontal de KPIs (9 Indicadores) */}
      <CardKpisDashboard stats={kpisStats} />

      {/* 3. Meio da Tela: Grid de 2 Colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Lado Esquerdo (6 de 12 colunas): Veículo em Destaque + Alertas e Notificações */}
        <div className="lg:col-span-6 space-y-4">
          <PainelVeiculoDestaque
            veiculo={veiculoDestaque}
            currentIndex={indexVeiculoDestaque}
            totalCount={listaParaDestaque.length}
            onPrev={handlePrevVeiculo}
            onNext={handleNextVeiculo}
            autoPlay={autoPlay}
            onToggleAutoPlay={() => setAutoPlay(!autoPlay)}
            tempoRotacao={10}
            mostrarApenasEmRota={mostrarApenasEmRota}
            onToggleFiltroEmRota={() => setMostrarApenasEmRota(!mostrarApenasEmRota)}
            totalVeiculosGeral={veiculosList.length}
            totalVeiculosEmRota={veiculosEmRota.length}
          />

          {/* Tempo de Atualização (>30 min) e Notificações Operacionais */}
          <BannersAlertasDashboard
            entregas={entregasFiltradas}
            veiculos={veiculosList}
            onSelectVeiculo={(v) => {
              setPlacaSelecionada(v.placa);
            }}
          />
        </div>

        {/* Lado Direito (6 de 12 colunas): Gráfico de Status */}
        <div className="lg:col-span-6">
          <GraficoStatusPorVeiculo
            veiculos={veiculosList}
            veiculoSelecionado={veiculoDestaque}
            onSelectVeiculo={(v) => {
              setPlacaSelecionada(v.placa);
            }}
            distribuicaoGlobal={distribuicaoStatus}
            totalGeralEntregas={kpisStats.totalGeral}
          />
        </div>
      </div>

      {/* 4. Distribuição por Status (ocultada por enquanto conforme solicitação) */}
      {/* <DistribuicaoStatusBarras
        distribuicao={distribuicaoStatus}
        totalGeral={kpisStats.totalGeral}
      /> */}
    </div>
  );
}
