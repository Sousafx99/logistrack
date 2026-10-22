import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause, 
  Truck,
  Clock,
  Timer,
  CheckCircle2,
  AlertTriangle,
  Package,
  Zap,
  Target,
  TrendingUp,
  Flag,
  ShieldCheck,
  Scale,
  DollarSign
} from 'lucide-react';

const formatarMoeda = (val) => {
  if (val === null || val === undefined || isNaN(Number(val))) return 'R$ 0,00';
  return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatarPeso = (val) => {
  if (val === null || val === undefined || isNaN(Number(val))) return '0 kg';
  return `${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg`;
};

export function PainelVeiculoDestaque({ 
  veiculo, 
  currentIndex = 1, 
  totalCount = 1, 
  onPrev, 
  onNext,
  autoPlay = true,
  onToggleAutoPlay,
  tempoRotacao = 10,
  mostrarApenasEmRota = true,
  onToggleFiltroEmRota,
  totalVeiculosGeral = 0,
  totalVeiculosEmRota = 0
}) {
  const onNextRef = useRef(onNext);
  useEffect(() => {
    onNextRef.current = onNext;
  }, [onNext]);

  // Estado do Carrossel de Eficiência da Rota (lado direito: 5 cards)
  // Card 0: Previsão de Término (ETA)
  // Card 1: Ritmo & Tempo Médio por Ponto
  // Card 2: Assertividade da Rota
  // Card 3: Peso & Volume da Carga
  // Card 4: Faturamento da Carga
  const [slideEficiencia, setSlideEficiencia] = useState(0);
  const [segundoPlaca, setSegundoPlaca] = useState(0);

  // Reinicia o slide da telemetria para 0 (Previsão de Término) e segundo para 0 SEMPRE que a placa mudar
  useEffect(() => {
    setSlideEficiencia(0);
    setSegundoPlaca(0);
  }, [veiculo?.placa]);

  // Temporizador Casado: 20s por veículo e 4s por card de telemetria (5 cards x 4s = 20s)
  useEffect(() => {
    if (!veiculo || totalCount < 1) return;

    // Se autoPlay estiver pausado (ex: placa selecionada em Status por Veículo ou pausada manualmente)
    if (!autoPlay) {
      return;
    }

    // Quando autoPlay está ativo: contagem casada de 20s (4s por card)
    const interval = setInterval(() => {
      setSegundoPlaca(prevSeg => {
        const proximoSeg = prevSeg + 1;

        // A cada 4 segundos, avança o card de telemetria (cards 0, 1, 2, 3, 4)
        if (proximoSeg < 20) {
          const proximoSlide = Math.floor(proximoSeg / 4);
          setSlideEficiencia(proximoSlide);
          return proximoSeg;
        }

        // Ao completar 20 segundos:
        // 1. Reseta o slide para 0 (Previsão de Término)
        // 2. Se houver veículos, avança para a próxima placa
        setSlideEficiencia(0);
        if (totalCount > 1 && onNextRef.current) {
          onNextRef.current();
        }
        return 0;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoPlay, totalCount, veiculo?.placa]);

  if (!veiculo) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200/80 dark:border-zinc-800 shadow-sm flex flex-col items-center justify-center min-h-[300px] text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 mb-3">
          <CheckCircle2 size={28} />
        </div>
        <h4 className="text-base font-bold text-zinc-900 dark:text-white">
          Todas as entregas foram finalizadas!
        </h4>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm">
          Não há nenhum veículo com entregas pendentes ou em andamento no momento.
        </p>
        {onToggleFiltroEmRota && (
          <button
            onClick={onToggleFiltroEmRota}
            className="mt-4 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
          >
            Visualizar todos os veículos finalizados
          </button>
        )}
      </div>
    );
  }

  const {
    placa = 'S/ PLACA',
    motoristaNome = '',
    rota = '',
    carga = '',
    total = 0,
    pesoTotal = 0,
    valorTotal = 0,
    pendentes = 0,
    noCliente = 0,
    descarregando = 0,
    parciais = 0,
    entregues = 0,
    devolucoes = 0,
    cargaParada = 0,
    reentregas = 0,
    pedidos = []
  } = veiculo;

  // Cálculo de percentual de conclusão
  const finalizadas = entregues + devolucoes + parciais + reentregas + cargaParada;
  const percentualConclusao = total > 0 ? Math.round((entregues / total) * 100) : 0;
  const percentualFinalizadas = total > 0 ? Math.round((finalizadas / total) * 100) : 0;

  // Lista dos 8 status rigorosamente mapeados com cores oficiais e barras proporcionais
  const statusLista = [
    { key: 'pendente', label: 'Pendente', count: pendentes, dot: 'bg-amber-500', bar: 'bg-amber-500', text: 'text-amber-500 dark:text-amber-400', border: 'border-amber-500/30', bgLight: 'bg-amber-500/10' },
    { key: 'noCliente', label: 'No Cliente', count: noCliente, dot: 'bg-sky-500', bar: 'bg-sky-500', text: 'text-sky-500 dark:text-sky-400', border: 'border-sky-500/30', bgLight: 'bg-sky-500/10' },
    { key: 'descarregando', label: 'Descarregando', count: descarregando, dot: 'bg-blue-600', bar: 'bg-blue-600', text: 'text-blue-500 dark:text-blue-400', border: 'border-blue-600/30', bgLight: 'bg-blue-600/10' },
    { key: 'parciais', label: 'Entrega Parcial', count: parciais, dot: 'bg-orange-500', bar: 'bg-orange-500', text: 'text-orange-500 dark:text-orange-400', border: 'border-orange-500/30', bgLight: 'bg-orange-500/10' },
    { key: 'entregues', label: 'Entrega Total', count: entregues, dot: 'bg-emerald-500', bar: 'bg-emerald-500', text: 'text-emerald-500 dark:text-emerald-400', border: 'border-emerald-500/30', bgLight: 'bg-emerald-500/10' },
    { key: 'devolucoes', label: 'Devolução Total', count: devolucoes, dot: 'bg-rose-500', bar: 'bg-rose-500', text: 'text-rose-500 dark:text-rose-400', border: 'border-rose-500/30', bgLight: 'bg-rose-500/10' },
    { key: 'cargaParada', label: 'Carga Parada', count: cargaParada, dot: 'bg-yellow-400', bar: 'bg-yellow-400', text: 'text-yellow-400', border: 'border-yellow-400/30', bgLight: 'bg-yellow-400/10' },
    { key: 'reentregas', label: 'Reentrega', count: reentregas, dot: 'bg-purple-500', bar: 'bg-purple-500', text: 'text-purple-500 dark:text-purple-400', border: 'border-purple-500/30', bgLight: 'bg-purple-500/10' },
  ];

  // Apenas os status que o veículo realmente possui nesta carga (count > 0)
  const statusAtivos = statusLista.filter(st => st.count > 0);

  // Paginação dos status (máximo 3 por card, sem barra de rolagem, alternando como cards se houver mais de 3)
  const totalPaginasStatus = Math.ceil(statusAtivos.length / 3) || 1;
  const duracaoPorPagina = totalPaginasStatus > 1 ? Math.floor(20 / totalPaginasStatus) : 20;
  const paginaStatus = totalPaginasStatus > 1 
    ? Math.min(totalPaginasStatus - 1, Math.floor(segundoPlaca / duracaoPorPagina)) 
    : 0;
  const statusExibidos = statusAtivos.slice(paginaStatus * 3, (paginaStatus + 1) * 3);

  // Status operacional atual do veículo para o badge do banner
  let statusOperacional = { label: 'Em Trânsito', dot: 'bg-emerald-400', text: 'text-emerald-400' };
  if (descarregando > 0) {
    statusOperacional = { label: 'Descarregando', dot: 'bg-blue-500', text: 'text-blue-400' };
  } else if (noCliente > 0) {
    statusOperacional = { label: 'No Cliente', dot: 'bg-sky-400', text: 'text-sky-400' };
  } else if (pendentes > 0 && (entregues > 0 || parciais > 0)) {
    statusOperacional = { label: 'Em Trânsito', dot: 'bg-emerald-400', text: 'text-emerald-400' };
  } else if (pendentes === total && total > 0) {
    statusOperacional = { label: 'Aguardando Início', dot: 'bg-amber-400', text: 'text-amber-400' };
  } else if (finalizadas === total && total > 0) {
    statusOperacional = { label: 'Rota Finalizada', dot: 'bg-emerald-500', text: 'text-emerald-400' };
  }

  // Ocorrências da rota (devoluções, parciais, reentregas, carga parada)
  const totalOcorrencias = devolucoes + parciais + reentregas + cargaParada;
  const totalProcessadas = entregues + totalOcorrencias;

  // Assertividade com base nas entregas realizadas sem ocorrências
  // Conforme regra de negócio: 0 entregas é 0% e baixíssima eficiência!
  let taxaAssertividade = 0;
  let labelEficiencia = 'Baixíssima Eficiência';
  let corClassEficiencia = 'text-rose-600 dark:text-rose-400';
  let badgeClassEficiencia = 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30';

  if (entregues > 0) {
    if (totalProcessadas > 0) {
      taxaAssertividade = Math.round((entregues / totalProcessadas) * 100);
    } else if (total > 0) {
      taxaAssertividade = Math.round((entregues / total) * 100);
    } else {
      taxaAssertividade = 100;
    }

    if (taxaAssertividade >= 95) {
      labelEficiencia = 'Alta Eficiência';
      corClassEficiencia = 'text-emerald-600 dark:text-emerald-400';
      badgeClassEficiencia = 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
    } else if (taxaAssertividade >= 85) {
      labelEficiencia = 'Boa Eficiência';
      corClassEficiencia = 'text-blue-600 dark:text-blue-400';
      badgeClassEficiencia = 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30';
    } else if (taxaAssertividade >= 70) {
      labelEficiencia = 'Média Eficiência';
      corClassEficiencia = 'text-amber-600 dark:text-amber-400';
      badgeClassEficiencia = 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30';
    } else {
      labelEficiencia = 'Baixa Eficiência';
      corClassEficiencia = 'text-rose-600 dark:text-rose-400';
      badgeClassEficiencia = 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30';
    }
  }

  // Cálculos de Telemetria & Eficiência Dinâmica:
  // 1. Média de minutos por entrega (estimada ou baseada no histórico)
  const tempoMedioMinutos = 22; // média operacional de Salvador / RMS
  const entregasPorHora = (60 / tempoMedioMinutos).toFixed(1);

  // 2. Previsão de finalização (ETA)
  const minutosRestantes = (pendentes * tempoMedioMinutos) + (descarregando > 0 ? 15 : 0) + (noCliente > 0 ? 10 : 0);
  const dataPrevisao = new Date(Date.now() + minutosRestantes * 60000);
  const horaFormatadaEta = dataPrevisao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const horasRestantesText = minutosRestantes >= 60 
    ? `~${Math.floor(minutosRestantes / 60)}h ${minutosRestantes % 60}m`
    : `~${minutosRestantes} min`;

  // 3. Cálculos de Faturamento & Carga
  const valorEntregue = Array.isArray(pedidos)
    ? pedidos
        .filter(p => {
          const st = String(p.status || '').toLowerCase();
          return st.includes('total') && st.includes('entrega');
        })
        .reduce((acc, curr) => acc + Number(curr.valor || 0), 0)
    : 0;

  const ticketMedio = total > 0 ? (valorTotal / total) : 0;
  const pesoMedio = total > 0 ? (pesoTotal / total) : 0;
  const percentualValorEntregue = valorTotal > 0 ? Math.round((valorEntregue / valorTotal) * 100) : 0;

  // Cálculos do medidor circular (SVG Donut) baseado na assertividade
  const RAIO_EFIC = 34;
  const CIRC_EFIC = 2 * Math.PI * RAIO_EFIC;
  const strokeOffset = CIRC_EFIC - (Math.min(taxaAssertividade, 100) / 100) * CIRC_EFIC;
  const corEficiencia = entregues === 0 
    ? '#f43f5e' 
    : (taxaAssertividade >= 90 ? '#10b981' : (taxaAssertividade >= 70 ? '#f59e0b' : '#f43f5e'));

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 sm:p-5 border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
      {/* Banner Principal com Placa em Amarelo sobre Preto */}
      <div className="bg-black dark:bg-zinc-950 rounded-xl px-4 py-3.5 border border-zinc-800/80 shadow-inner flex flex-col justify-between relative overflow-hidden mb-3.5">
        <div className="flex items-center justify-between w-full">
          {/* Lado Esquerdo: Carga, Quantidade de Notas e Status Operacional */}
          <div className="flex flex-col min-w-0 pr-2">
            <div className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${statusOperacional.dot} shadow-[0_0_8px_currentColor] animate-pulse shrink-0`} />
              <span className={`text-xs uppercase font-extrabold tracking-wider ${statusOperacional.text}`}>
                {statusOperacional.label}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              {carga && (
                <span className="text-xs text-zinc-300 font-mono">
                  Carga: <strong className="text-white font-bold">{carga}</strong>
                </span>
              )}
              {carga && <span className="text-zinc-600">•</span>}
              <span className="text-xs text-zinc-300 font-mono font-bold">
                {total} {total === 1 ? 'nota' : 'notas'}
              </span>
            </div>
          </div>

          {/* Centro: Placa em destaque amarelo ouro + Nome do motorista logo abaixo */}
          <div className="flex flex-col items-center justify-center text-center px-2">
            <div className="font-mono font-black text-2xl sm:text-3xl md:text-4xl tracking-widest text-[#facc15] drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] leading-none">
              {placa}
            </div>
            {motoristaNome && (
              <span className="text-xs sm:text-sm font-bold text-zinc-300 uppercase tracking-wide truncate max-w-[160px] sm:max-w-[240px] mt-1" title={motoristaNome}>
                {motoristaNome}
              </span>
            )}
          </div>

          {/* Lado Direito: Contador de Placas, Status de AutoPlay e Setas de Navegação */}
          <div className="flex items-center gap-1.5 shrink-0 pl-2">
            <span className="font-mono font-bold text-xs sm:text-sm px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200">
              {currentIndex} / {totalCount}
            </span>
            <button
              onClick={() => {
                setSlideEficiencia(0);
                setSegundoPlaca(0);
                if (onPrev) onPrev();
              }}
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-colors cursor-pointer"
              title="Veículo anterior (reinicia na Previsão de Término)"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => {
                setSlideEficiencia(0);
                setSegundoPlaca(0);
                if (onNext) onNext();
              }}
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-colors cursor-pointer"
              title="Próximo veículo (reinicia na Previsão de Término)"
            >
              <ChevronRight size={18} />
            </button>
            {onToggleAutoPlay && (
              <button
                onClick={() => {
                  if (!autoPlay) {
                    setSlideEficiencia(0);
                    setSegundoPlaca(0);
                  }
                  onToggleAutoPlay();
                }}
                className={`px-2 py-1.5 rounded-lg border transition-all cursor-pointer text-xs flex items-center gap-1 font-bold ${
                  autoPlay 
                    ? 'bg-zinc-900 hover:bg-zinc-800 text-emerald-400 border-zinc-800 shadow-xs' 
                    : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40'
                }`}
                title={autoPlay ? "Pausar alternância automática (20s)" : "Retomar alternância automática de placas"}
              >
                {autoPlay ? <Pause size={13} /> : <Play size={13} />}
                <span className="font-mono text-[11px]">{autoPlay ? `${20 - segundoPlaca}s` : 'Pausado'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Área Inferior: Status da Carga Detalhados (Esquerda) + Carrossel de Telemetria e Eficiência (Direita) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
        
        {/* Lado Esquerdo: Status da Carga Detalhados (Até 3 por card, sem scrollbar, alternando se houver mais de 3) */}
        <div className="flex flex-col justify-between min-h-[195px]">
          <div>
            <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">
              <div className="flex items-center gap-1.5">
                <Package size={14} className="text-zinc-400 shrink-0" />
                <span className="font-extrabold text-xs">Status da Carga</span>
                {totalPaginasStatus > 1 && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    Card {paginaStatus + 1}/{totalPaginasStatus}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold text-zinc-400">
                  {statusAtivos.length} {statusAtivos.length === 1 ? 'status ativo' : 'status ativos'}
                </span>
                {totalPaginasStatus > 1 && (
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPaginasStatus }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setSegundoPlaca(i * duracaoPorPagina)}
                        className={`h-1.5 rounded-full transition-all cursor-pointer ${
                          paginaStatus === i 
                            ? 'w-4 bg-amber-500' 
                            : 'w-1.5 bg-zinc-300 dark:bg-zinc-700 hover:bg-zinc-400'
                        }`}
                        title={`Ir para card ${i + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {statusAtivos.length === 0 ? (
              <div className="text-xs text-zinc-400 italic p-4 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl my-auto">
                Nenhum status registrado
              </div>
            ) : (
              <div key={paginaStatus} className="space-y-1.5 overflow-hidden animate-fadeIn">
                {statusExibidos.map(st => {
                  const perc = total > 0 ? Math.round((st.count / total) * 100) : 0;
                  return (
                    <div 
                      key={st.key} 
                      className={`py-2 px-3 rounded-xl border ${st.border} ${st.bgLight} transition-all relative overflow-hidden`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0 pr-1">
                          <span className={`w-2.5 h-2.5 rounded-full ${st.dot} shadow-[0_0_8px_currentColor] shrink-0`} />
                          <span className="font-extrabold text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm truncate">
                            {st.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`font-mono font-black text-sm sm:text-base ${st.text}`}>
                            {st.count} {st.count === 1 ? 'nota' : 'notas'}
                          </span>
                          <span className="text-[10px] sm:text-xs font-mono font-bold px-1.5 py-0.5 rounded-md bg-black/10 dark:bg-white/10 text-zinc-700 dark:text-zinc-300">
                            {perc}%
                          </span>
                        </div>
                      </div>
                      {/* Barra de Proporção Individual */}
                      <div className="w-full h-1.5 bg-black/10 dark:bg-white/10 rounded-full mt-1.5 overflow-hidden">
                        <div 
                          className={`h-full ${st.bar} rounded-full transition-all duration-500`}
                          style={{ width: `${perc}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Lado Direito: Carrossel de Telemetria & Eficiência Operacional (Adaptação Claro/Escuro) */}
        <div 
          className="bg-zinc-50/80 dark:bg-zinc-950 rounded-xl p-3.5 border border-zinc-200/90 dark:border-zinc-800/90 shadow-xs flex flex-col justify-between text-zinc-900 dark:text-zinc-100 relative overflow-hidden min-h-[195px]"
        >
          {/* Cabeçalho do Carrossel com Abas/Ícones de Navegação (Sem bolinha pulsante) */}
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800/80 pb-2 mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Telemetria da Rota
              </span>
            </div>

            {/* Abas com Ícones para Navegação Direta entre os 5 Cards */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSlideEficiencia(0)}
                className={`p-1.5 rounded-md transition-all cursor-pointer ${
                  slideEficiencia === 0 
                    ? 'bg-amber-400 text-zinc-950 font-bold shadow-xs' 
                    : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                }`}
                title="1. Previsão de Término (ETA)"
              >
                <Flag size={14} />
              </button>
              <button
                onClick={() => setSlideEficiencia(1)}
                className={`p-1.5 rounded-md transition-all cursor-pointer ${
                  slideEficiencia === 1 
                    ? 'bg-amber-400 text-zinc-950 font-bold shadow-xs' 
                    : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                }`}
                title="2. Tempo Médio por Entrega"
              >
                <Clock size={14} />
              </button>
              <button
                onClick={() => setSlideEficiencia(2)}
                className={`p-1.5 rounded-md transition-all cursor-pointer ${
                  slideEficiencia === 2 
                    ? 'bg-amber-400 text-zinc-950 font-bold shadow-xs' 
                    : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                }`}
                title="3. Assertividade da Rota"
              >
                <Target size={14} />
              </button>
              <button
                onClick={() => setSlideEficiencia(3)}
                className={`p-1.5 rounded-md transition-all cursor-pointer ${
                  slideEficiencia === 3 
                    ? 'bg-amber-400 text-zinc-950 font-bold shadow-xs' 
                    : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                }`}
                title="4. Peso & Carga do Veículo"
              >
                <Scale size={14} />
              </button>
              <button
                onClick={() => setSlideEficiencia(4)}
                className={`p-1.5 rounded-md transition-all cursor-pointer ${
                  slideEficiencia === 4 
                    ? 'bg-amber-400 text-zinc-950 font-bold shadow-xs' 
                    : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                }`}
                title="5. Faturamento da Carga"
              >
                <DollarSign size={14} />
              </button>
            </div>
          </div>

          {/* CONTEÚDO DOS CARDS DO CARROSSEL (FONTES MAIORES E MAIS DESTACADAS) */}
          <div className="flex-1 flex flex-col justify-center min-h-[125px]">
            {/* Card 0: Previsão de Término (ETA) */}
            {slideEficiencia === 0 && (
              <div className="flex flex-col justify-between h-full animate-fadeIn">
                <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
                  <span className="flex items-center gap-1.5 font-black text-zinc-900 dark:text-zinc-100 text-sm sm:text-base">
                    <Timer size={16} className="text-amber-500 shrink-0" />
                    Previsão de Término (ETA)
                  </span>
                  <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-extrabold">
                    {finalizadas === total ? 'Finalizada' : horasRestantesText}
                  </span>
                </div>

                <div className="my-auto py-1">
                  {finalizadas === total ? (
                    <div className="flex items-center gap-2.5">
                      <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                        <CheckCircle2 size={26} />
                      </div>
                      <div>
                        <div className="font-mono font-black text-xl sm:text-2xl text-emerald-600 dark:text-emerald-400 leading-tight">
                          ROTA FINALIZADA
                        </div>
                        <div className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                          100% das entregas concluídas
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono font-black text-3xl sm:text-4xl tracking-tight text-zinc-900 dark:text-white">
                          ~{horaFormatadaEta}
                        </span>
                        <span className="text-sm sm:text-base text-amber-600 dark:text-amber-400 font-black">
                          ({horasRestantesText})
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 font-medium">
                        {pendentes} {pendentes === 1 ? 'entrega restante' : 'entregas restantes'} no roteiro
                      </p>
                    </div>
                  )}
                </div>

                {/* Barra de progresso da jornada */}
                <div className="w-full mt-auto">
                  <div className="w-full h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-amber-500 via-sky-500 to-emerald-500 transition-all duration-500"
                      style={{ width: `${percentualFinalizadas}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 font-mono font-bold">
                    <span>Início</span>
                    <span>{percentualFinalizadas}% Concluído</span>
                    <span>Término</span>
                  </div>
                </div>
              </div>
            )}

            {/* Card 1: Tempo Médio por Entrega */}
            {slideEficiencia === 1 && (
              <div className="flex flex-col justify-between h-full animate-fadeIn">
                <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
                  <span className="flex items-center gap-1.5 font-black text-zinc-900 dark:text-zinc-100 text-sm sm:text-base">
                    <Clock size={16} className="text-sky-500 shrink-0" />
                    Tempo Médio por Ponto
                  </span>
                  <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-sky-500/10 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/30 font-extrabold flex items-center gap-1">
                    <Zap size={12} /> {entregasPorHora} entregas/h
                  </span>
                </div>

                <div className="my-auto py-1 flex items-center justify-between">
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono font-black text-3xl sm:text-4xl tracking-tight text-zinc-900 dark:text-white">
                        ~{tempoMedioMinutos}
                      </span>
                      <span className="text-sm font-extrabold text-sky-600 dark:text-sky-400 uppercase">min / parada</span>
                    </div>
                    <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 font-medium">
                      Tempo médio entre chegada e conferência
                    </p>
                  </div>
                  <div className="px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-right shadow-xs">
                    <div className="text-[11px] uppercase font-bold text-zinc-400">Ritmo</div>
                    <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">Normal</div>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 font-medium">
                  <span>Descarga ativa: <strong className="text-zinc-900 dark:text-white font-mono font-bold">{descarregando}</strong></span>
                  <span>No cliente: <strong className="text-zinc-900 dark:text-white font-mono font-bold">{noCliente}</strong></span>
                </div>
              </div>
            )}

            {/* Card 2: Assertividade & Sucesso da Rota */}
            {slideEficiencia === 2 && (
              <div className="flex flex-col justify-between h-full animate-fadeIn">
                <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
                  <span className="flex items-center gap-1.5 font-black text-zinc-900 dark:text-zinc-100 text-sm sm:text-base">
                    <Target size={16} className="text-emerald-500 shrink-0" />
                    Assertividade da Rota
                  </span>
                  <span className={`text-xs font-mono px-2.5 py-0.5 rounded-full border font-extrabold ${badgeClassEficiencia}`}>
                    {taxaAssertividade}% Sucesso
                  </span>
                </div>

                <div className="my-auto py-1 flex items-center justify-around gap-3">
                  {/* Gauge Donut */}
                  <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                    <svg viewBox="0 0 90 90" className="w-full h-full -rotate-90">
                      <circle cx="45" cy="45" r={RAIO_EFIC} fill="transparent" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" strokeWidth="8" />
                      <circle
                        cx="45" cy="45" r={RAIO_EFIC} fill="transparent"
                        stroke={corEficiencia}
                        strokeWidth="8"
                        strokeDasharray={CIRC_EFIC}
                        strokeDashoffset={strokeOffset}
                        strokeLinecap="round"
                        className="transition-all duration-500"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                      <span className="font-mono font-black text-base text-zinc-900 dark:text-white leading-none">
                        {taxaAssertividade}%
                      </span>
                    </div>
                  </div>

                  {/* Detalhe Numérico */}
                  <div className="space-y-1.5 text-xs sm:text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Concluídas:
                      </span>
                      <span className="font-mono font-black text-zinc-900 dark:text-white text-sm sm:text-base">{entregues}/{total}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 font-medium">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        Ocorrências:
                      </span>
                      <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-sm sm:text-base">{totalOcorrencias}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                  <span className="font-medium">Confiabilidade:</span>
                  <span className={`font-black text-xs sm:text-sm ${corClassEficiencia}`}>{labelEficiencia}</span>
                </div>
              </div>
            )}

            {/* Card 3: Peso & Carga do Veículo */}
            {slideEficiencia === 3 && (
              <div className="flex flex-col justify-between h-full animate-fadeIn">
                <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
                  <span className="flex items-center gap-1.5 font-black text-zinc-900 dark:text-zinc-100 text-sm sm:text-base">
                    <Scale size={16} className="text-amber-500 shrink-0" />
                    Peso & Carga do Veículo
                  </span>
                  <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-extrabold">
                    {total} NFs
                  </span>
                </div>

                <div className="my-auto py-1 grid grid-cols-2 gap-2.5">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
                    <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase block">Peso Total</span>
                    <span className="font-mono font-black text-base sm:text-lg text-zinc-900 dark:text-white block mt-0.5 truncate" title={formatarPeso(pesoTotal)}>
                      {pesoTotal > 0 ? formatarPeso(pesoTotal) : '—'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
                    <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase block">Média p/ Nota</span>
                    <span className="font-mono font-black text-base sm:text-lg text-zinc-900 dark:text-white block mt-0.5 truncate" title={formatarPeso(pesoMedio)}>
                      {pesoMedio > 0 ? formatarPeso(pesoMedio) : '—'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                  <span className="font-medium">Densidade Operacional:</span>
                  <span className="font-mono font-black text-zinc-900 dark:text-white">
                    {pesoTotal > 0 ? `${(pesoTotal / 1000).toFixed(2)} ton` : '—'}
                  </span>
                </div>
              </div>
            )}

            {/* Card 4: Faturamento da Carga */}
            {slideEficiencia === 4 && (
              <div className="flex flex-col justify-between h-full animate-fadeIn">
                <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
                  <span className="flex items-center gap-1.5 font-black text-zinc-900 dark:text-zinc-100 text-sm sm:text-base">
                    <DollarSign size={16} className="text-emerald-500 shrink-0" />
                    Faturamento da Carga
                  </span>
                  <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-extrabold">
                    {percentualValorEntregue}% Entregue
                  </span>
                </div>

                <div className="my-auto py-1 grid grid-cols-2 gap-2.5">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
                    <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase block">Valor Total</span>
                    <span className="font-mono font-black text-base sm:text-lg text-emerald-600 dark:text-emerald-400 block mt-0.5 truncate" title={formatarMoeda(valorTotal)}>
                      {valorTotal > 0 ? formatarMoeda(valorTotal) : '—'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
                    <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase block">Ticket Médio</span>
                    <span className="font-mono font-black text-base sm:text-lg text-zinc-900 dark:text-white block mt-0.5 truncate" title={formatarMoeda(ticketMedio)}>
                      {ticketMedio > 0 ? formatarMoeda(ticketMedio) : '—'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                  <span className="font-medium">Já Entregue: <strong className="text-emerald-600 dark:text-emerald-400 font-mono font-black">{formatarMoeda(valorEntregue)}</strong></span>
                  <span className="font-medium">A Entregar: <strong className="text-zinc-700 dark:text-zinc-300 font-mono font-black">{formatarMoeda(Math.max(0, valorTotal - valorEntregue))}</strong></span>
                </div>
              </div>
            )}
          </div>

          {/* Dots Indicadores dos 5 Cards de Telemetria */}
          <div className="flex items-center justify-center gap-1.5 mt-2 pt-1.5 border-t border-zinc-200 dark:border-zinc-800/80">
            {[0, 1, 2, 3, 4].map(idx => (
              <button
                key={idx}
                onClick={() => setSlideEficiencia(idx)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  slideEficiencia === idx 
                    ? 'w-5 bg-amber-500 dark:bg-amber-400' 
                    : 'w-1.5 bg-zinc-300 dark:bg-zinc-700 hover:bg-zinc-400 dark:hover:bg-zinc-500'
                }`}
                title={`Ir para card ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Barra de Progresso Multi-Segmentada de Conclusão da Rota */}
      <div className="mt-3.5 pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
        <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">
          <span className="flex items-center gap-1.5">
            <TrendingUp size={14} className="text-zinc-400" />
            Progresso Geral da Rota
          </span>
          <span className="font-mono text-zinc-800 dark:text-zinc-200">
            {finalizadas} de {total} notas ({percentualConclusao}%)
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex">
          {entregues > 0 && (
            <div 
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${(entregues / total) * 100}%` }}
              title={`Entrega total: ${entregues}`}
            />
          )}
          {noCliente > 0 && (
            <div 
              className="h-full bg-sky-500 transition-all duration-300"
              style={{ width: `${(noCliente / total) * 100}%` }}
              title={`No cliente: ${noCliente}`}
            />
          )}
          {descarregando > 0 && (
            <div 
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${(descarregando / total) * 100}%` }}
              title={`Descarregando: ${descarregando}`}
            />
          )}
          {parciais > 0 && (
            <div 
              className="h-full bg-orange-500 transition-all duration-300"
              style={{ width: `${(parciais / total) * 100}%` }}
              title={`Entrega parcial: ${parciais}`}
            />
          )}
          {devolucoes > 0 && (
            <div 
              className="h-full bg-rose-600 transition-all duration-300"
              style={{ width: `${(devolucoes / total) * 100}%` }}
              title={`Devolução total: ${devolucoes}`}
            />
          )}
          {reentregas > 0 && (
            <div 
              className="h-full bg-purple-600 transition-all duration-300"
              style={{ width: `${(reentregas / total) * 100}%` }}
              title={`Reentrega: ${reentregas}`}
            />
          )}
          {cargaParada > 0 && (
            <div 
              className="h-full bg-yellow-500 transition-all duration-300"
              style={{ width: `${(cargaParada / total) * 100}%` }}
              title={`Carga parada: ${cargaParada}`}
            />
          )}
        </div>
      </div>
    </div>
  );
}

