import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause, 
  Truck,
  Clock,
  Navigation,
  User,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

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

  // Efeito de alternância automática a cada 10 segundos em segundo plano (sem reset por re-render externo)
  useEffect(() => {
    if (!autoPlay || totalCount <= 1) return;

    const interval = setInterval(() => {
      if (onNextRef.current) {
        onNextRef.current();
      }
    }, tempoRotacao * 1000);

    return () => clearInterval(interval);
  }, [autoPlay, totalCount, tempoRotacao]);

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
    pendentes = 0,
    noCliente = 0,
    descarregando = 0,
    parciais = 0,
    entregues = 0,
    devolucoes = 0,
    cargaParada = 0,
    reentregas = 0
  } = veiculo;

  // Cálculo de percentual de conclusão
  const finalizadas = entregues + devolucoes + parciais + reentregas + cargaParada;
  const percentualConclusao = total > 0 ? Math.round((entregues / total) * 100) : 0;

  // Lista dos 8 status rigorosamente na ordem solicitada e com cores oficiais do sistema
  const statusLista = [
    { key: 'pendente', label: 'Pendente', count: pendentes, dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30', bgLight: 'bg-amber-500/5' },
    { key: 'noCliente', label: 'No Cliente', count: noCliente, dot: 'bg-sky-500', text: 'text-sky-600 dark:text-sky-400', border: 'border-sky-500/30', bgLight: 'bg-sky-500/5' },
    { key: 'descarregando', label: 'Descarregando', count: descarregando, dot: 'bg-blue-600', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-600/30', bgLight: 'bg-blue-600/5' },
    { key: 'parciais', label: 'Entrega Parcial', count: parciais, dot: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-500/30', bgLight: 'bg-orange-500/5' },
    { key: 'entregues', label: 'Entrega Total', count: entregues, dot: 'bg-emerald-600', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30', bgLight: 'bg-emerald-500/5' },
    { key: 'devolucoes', label: 'Devolução Total', count: devolucoes, dot: 'bg-rose-600', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-500/30', bgLight: 'bg-rose-500/5' },
    { key: 'cargaParada', label: 'Carga Parada', count: cargaParada, dot: 'bg-yellow-500', text: 'text-yellow-600 dark:text-yellow-400', border: 'border-yellow-500/30', bgLight: 'bg-yellow-500/5' },
    { key: 'reentregas', label: 'Reentrega', count: reentregas, dot: 'bg-purple-600', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/30', bgLight: 'bg-purple-500/5' },
  ];

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 sm:p-5 border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
      {/* Topo: Título + Badge de Rotação + Controles */}
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            VEÍCULO EM DESTAQUE
          </span>
          {mostrarApenasEmRota && (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
              Em Rota ({totalVeiculosEmRota}/{totalVeiculosGeral})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
            {currentIndex} / {totalCount}
          </span>

          {onToggleAutoPlay && (
            <button
              onClick={onToggleAutoPlay}
              className={`p-1 rounded-md transition-colors ${autoPlay ? 'text-amber-500 bg-amber-500/10' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'}`}
              title={autoPlay ? 'Pausar rotação automática' : 'Iniciar rotação automática (10s)'}
            >
              {autoPlay ? <Pause size={14} /> : <Play size={14} />}
            </button>
          )}

          <div className="flex items-center">
            <button
              onClick={onPrev}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Veículo anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={onNext}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Próximo veículo"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Banner Principal com Placa em Amarelo sobre Preto */}
      <div className="bg-black dark:bg-zinc-950 rounded-xl px-4 py-3.5 border border-zinc-800/80 shadow-inner flex items-center justify-between relative overflow-hidden mb-3.5">
        <div className="flex flex-col min-w-0 pr-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)] animate-pulse shrink-0" />
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">
              Em Trânsito
            </span>
          </div>
          {motoristaNome && (
            <span className="text-xs font-bold text-zinc-300 truncate max-w-[150px] sm:max-w-[220px] mt-0.5" title={motoristaNome}>
              {motoristaNome}
            </span>
          )}
          {carga && (
            <span className="text-[10px] text-zinc-500 font-mono">
              Carga: <strong className="text-zinc-400">{carga}</strong>
            </span>
          )}
        </div>

        {/* Placa em destaque amarelo ouro */}
        <div className="text-center font-mono font-black text-2xl sm:text-3xl tracking-widest text-[#facc15] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          {placa}
        </div>

        <div className="text-right shrink-0 pl-2">
          <span className="text-[10px] font-bold text-zinc-400 uppercase block">Total</span>
          <span className="text-sm font-black font-mono text-white">{total} NFs</span>
          <span className="text-[10px] font-mono text-emerald-400 font-bold block">
            {percentualConclusao}% OK
          </span>
        </div>
      </div>

      {/* Grid com os 8 Status na Ordem Rigorosa Solicitada */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {statusLista.map(st => (
          <div 
            key={st.key} 
            className={`flex items-center justify-between p-2 rounded-lg border ${st.border} ${st.bgLight} transition-all`}
          >
            <div className="flex items-center gap-1.5 min-w-0 pr-1">
              <span className={`w-2.5 h-2.5 rounded-sm ${st.dot} shrink-0`} />
              <span className="font-semibold text-zinc-700 dark:text-zinc-200 text-[11px] truncate" title={st.label}>
                {st.label}
              </span>
            </div>
            <span className={`font-mono font-black text-sm shrink-0 ${st.text}`}>
              {st.count}
            </span>
          </div>
        ))}
      </div>

      {/* Barra de Progresso de Conclusão da Rota */}
      <div className="mt-3.5 pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
        <div className="flex items-center justify-between text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">
          <span>Progresso da Rota</span>
          <span className="font-mono text-zinc-700 dark:text-zinc-300">
            {finalizadas} de {total} notas ({percentualConclusao}%)
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex">
          {entregues > 0 && (
            <div 
              className="h-full bg-emerald-600 transition-all duration-300"
              style={{ width: `${(entregues / total) * 100}%` }}
              title={`Entrega total: ${entregues}`}
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
