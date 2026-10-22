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

  // Status que o veículo realmente possui (apenas os ativos com count > 0)
  const statusAtivos = statusLista.filter(st => st.count > 0);

  // Status operacional atual do veículo para o banner
  const statusOperacional = useMemo(() => {
    if (descarregando > 0) return { label: 'Descarregando', dot: 'bg-blue-500', text: 'text-blue-400' };
    if (noCliente > 0) return { label: 'No Cliente', dot: 'bg-sky-400', text: 'text-sky-400' };
    if (pendentes > 0 && (entregues > 0 || parciais > 0)) return { label: 'Em Trânsito', dot: 'bg-emerald-400', text: 'text-emerald-400' };
    if (pendentes === total && total > 0) return { label: 'Aguardando Início', dot: 'bg-amber-400', text: 'text-amber-400' };
    if (finalizadas === total && total > 0) return { label: 'Rota Finalizada', dot: 'bg-emerald-500', text: 'text-emerald-400' };
    return { label: 'Em Trânsito', dot: 'bg-emerald-400', text: 'text-emerald-400' };
  }, [descarregando, noCliente, pendentes, entregues, parciais, finalizadas, total]);

  // Taxa de sucesso sobre finalizadas (entregues vs devoluções)
  const taxaSucesso = (entregues + devolucoes > 0) 
    ? Math.round((entregues / (entregues + devolucoes)) * 100) 
    : 100;

  // Cálculos do medidor de eficiência (SVG Gauge)
  const RAIO_EFIC = 36;
  const CIRC_EFIC = 2 * Math.PI * RAIO_EFIC;
  const strokeOffset = CIRC_EFIC - (Math.min(percentualConclusao, 100) / 100) * CIRC_EFIC;
  const corEficiencia = percentualConclusao >= 80 ? '#10b981' : (percentualConclusao >= 40 ? '#0ea5e9' : '#f59e0b');

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 sm:p-5 border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
      {/* Banner Principal com Placa em Amarelo sobre Preto */}
      <div className="bg-black dark:bg-zinc-950 rounded-xl px-4 py-3.5 border border-zinc-800/80 shadow-inner flex items-center justify-between relative overflow-hidden mb-3.5">
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
          <div className="font-mono font-black text-2xl sm:text-3xl md:text-4xl tracking-widest text-[#facc15] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-none">
            {placa}
          </div>
          {motoristaNome && (
            <span className="text-xs sm:text-sm font-bold text-zinc-300 uppercase tracking-wide truncate max-w-[160px] sm:max-w-[220px] mt-1" title={motoristaNome}>
              {motoristaNome}
            </span>
          )}
        </div>

        {/* Lado Direito: Contador de Placas e Setas de Navegação */}
        <div className="flex items-center gap-1.5 shrink-0 pl-2">
          <span className="font-mono font-bold text-xs sm:text-sm px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200">
            {currentIndex} / {totalCount}
          </span>
          <button
            onClick={onPrev}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-colors cursor-pointer"
            title="Veículo anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={onNext}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-colors cursor-pointer"
            title="Próximo veículo"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Área Inferior: Status Presentes no Veículo (Esquerda) + Gráfico de Eficiência (Direita) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
        {/* Lado Esquerdo: Apenas os status que o veículo possui (count > 0) */}
        <div className="flex flex-col gap-1.5 justify-center">
          <div className="text-[11px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-0.5">
            Status da Carga
          </div>
          {statusAtivos.length === 0 ? (
            <div className="text-xs text-zinc-400 italic p-3 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
              Nenhum status registrado
            </div>
          ) : (
            statusAtivos.map(st => (
              <div 
                key={st.key} 
                className={`flex items-center justify-between px-3 py-2 rounded-xl border ${st.border} ${st.bgLight} transition-all`}
              >
                <div className="flex items-center gap-2 min-w-0 pr-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${st.dot} shrink-0`} />
                  <span className="font-bold text-zinc-800 dark:text-zinc-200 text-xs sm:text-sm truncate" title={st.label}>
                    {st.label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`font-mono font-black text-sm sm:text-base ${st.text}`}>
                    {st.count}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    ({total > 0 ? Math.round((st.count / total) * 100) : 0}%)
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Lado Direito: Gráfico de Eficiência das Entregas */}
        <div className="bg-zinc-50 dark:bg-zinc-950/60 rounded-xl p-3 border border-zinc-200/80 dark:border-zinc-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">
            <span>Eficiência da Rota</span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
              {percentualConclusao}% OK
            </span>
          </div>

          <div className="flex items-center justify-around gap-2 my-auto py-1">
            {/* Medidor Circular Donut */}
            <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
              <svg viewBox="0 0 90 90" className="w-full h-full -rotate-90">
                {/* Trilha de fundo */}
                <circle
                  cx="45"
                  cy="45"
                  r={RAIO_EFIC}
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="7"
                  className="text-zinc-200 dark:text-zinc-800"
                />
                {/* Arco de progresso */}
                <circle
                  cx="45"
                  cy="45"
                  r={RAIO_EFIC}
                  fill="transparent"
                  stroke={corEficiencia}
                  strokeWidth="7"
                  strokeDasharray={CIRC_EFIC}
                  strokeDashoffset={strokeOffset}
                  strokeLinecap="round"
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="font-mono font-black text-lg text-zinc-900 dark:text-white leading-none">
                  {percentualConclusao}%
                </span>
                <span className="text-[9px] uppercase font-bold text-zinc-400 tracking-wider mt-0.5">
                  Conclusão
                </span>
              </div>
            </div>

            {/* Indicadores complementares */}
            <div className="space-y-1.5 flex-1 pl-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Realizadas:
                </span>
                <span className="font-mono font-black text-zinc-900 dark:text-white">
                  {entregues}/{total}
                </span>
              </div>

              {(noCliente > 0 || descarregando > 0) && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-sky-500" />
                    Em Cliente:
                  </span>
                  <span className="font-mono font-black text-sky-600 dark:text-sky-400">
                    {noCliente + descarregando}
                  </span>
                </div>
              )}

              {pendentes > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Pendentes:
                  </span>
                  <span className="font-mono font-black text-amber-600 dark:text-amber-400">
                    {pendentes}
                  </span>
                </div>
              )}

              {(devolucoes > 0 || parciais > 0 || cargaParada > 0) && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-rose-500 flex items-center gap-1.5 font-bold">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Ocorrências:
                  </span>
                  <span className="font-mono font-black text-rose-600 dark:text-rose-400">
                    {devolucoes + parciais + cargaParada}
                  </span>
                </div>
              )}

              <div className="pt-1 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[11px]">
                <span className="text-zinc-400">Taxa Sucesso:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {taxaSucesso}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Progresso de Conclusão da Rota */}
      <div className="mt-3.5 pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
        <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">
          <span>Progresso da Rota</span>
          <span className="font-mono text-zinc-800 dark:text-zinc-200">
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
