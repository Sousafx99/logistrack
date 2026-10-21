import React, { useState, useEffect, useMemo } from 'react';
import { Search, Play, Pause, BarChart3, PieChart } from 'lucide-react';

// Cores oficiais do sistema na ordem solicitada
const STATUS_CORES = {
  pendente: { bg: 'bg-amber-500', label: 'Pendente', hex: '#f59e0b' },
  noCliente: { bg: 'bg-sky-500', label: 'No Cliente', hex: '#0ea5e9' },
  descarregando: { bg: 'bg-blue-600', label: 'Descarregando', hex: '#2563eb' },
  parciais: { bg: 'bg-orange-500', label: 'Entrega Parcial', hex: '#f97316' },
  entregues: { bg: 'bg-emerald-600', label: 'Entrega Total', hex: '#059669' },
  devolucoes: { bg: 'bg-rose-600', label: 'Devolução Total', hex: '#e11d48' },
  cargaParada: { bg: 'bg-yellow-500', label: 'Carga Parada', hex: '#eab308' },
  reentregas: { bg: 'bg-purple-600', label: 'Reentrega', hex: '#9333ea' },
};

export function GraficoStatusPorVeiculo({ 
  veiculos = [], 
  veiculoSelecionado, 
  onSelectVeiculo,
  distribuicaoGlobal = {},
  totalGeralEntregas = 0
}) {
  const [buscaPlaca, setBuscaPlaca] = useState('');
  const [tooltip, setTooltip] = useState(null); // { x, y, veiculo }
  const [statusHover, setStatusHover] = useState(null); // Fatia de status em destaque na rosquinha
  
  // Controle de alternância: 'barras' ou 'rosquinha'
  const [tipoGrafico, setTipoGrafico] = useState('barras');
  const [autoAlternar, setAutoAlternar] = useState(true);

  // Efeito de alternância automática a cada 30 segundos (sem exibir o timer na tela)
  useEffect(() => {
    if (!autoAlternar) return;

    const interval = setInterval(() => {
      setTipoGrafico(current => current === 'barras' ? 'rosquinha' : 'barras');
    }, 30000); // 30 segundos

    return () => clearInterval(interval);
  }, [autoAlternar]);

  // Filtra por placa se digitado
  const veiculosFiltrados = useMemo(() => {
    let lista = [...veiculos];
    if (buscaPlaca.trim()) {
      const q = buscaPlaca.trim().toUpperCase();
      lista = lista.filter(v => v.placa.includes(q) || (v.motoristaNome && v.motoristaNome.toUpperCase().includes(q)));
    }
    return lista;
  }, [veiculos, buscaPlaca]);

  // Maior total de entregas entre os veículos para cálculo de escala proporcional
  const maxTotal = useMemo(() => {
    if (veiculos.length === 0) return 1;
    return Math.max(...veiculos.map(v => v.total || 0), 1);
  }, [veiculos]);

  // Preparação de fatias para o Gráfico de Rosquinha
  const fatiasRosquinha = useMemo(() => {
    const ordem = [
      { key: 'pendente', label: 'Pendente', cor: '#f59e0b', bgClass: 'bg-amber-500' },
      { key: 'noCliente', label: 'No Cliente', cor: '#0ea5e9', bgClass: 'bg-sky-500' },
      { key: 'descarregando', label: 'Descarregando', cor: '#2563eb', bgClass: 'bg-blue-600' },
      { key: 'entregaParcial', label: 'Entrega Parcial', cor: '#f97316', bgClass: 'bg-orange-500' },
      { key: 'entregaTotal', label: 'Entrega Total', cor: '#059669', bgClass: 'bg-emerald-600' },
      { key: 'devolucaoTotal', label: 'Devolução Total', cor: '#e11d48', bgClass: 'bg-rose-600' },
      { key: 'cargaParada', label: 'Carga Parada', cor: '#eab308', bgClass: 'bg-yellow-500' },
      { key: 'reentrega', label: 'Reentrega', cor: '#9333ea', bgClass: 'bg-purple-600' },
    ];

    const total = totalGeralEntregas > 0 ? totalGeralEntregas : 1;
    let acumuladoPercent = 0;

    return ordem.map(item => {
      const count = Number(distribuicaoGlobal[item.key] || 0);
      const percent = (count / total) * 100;
      const startPercent = acumuladoPercent;
      acumuladoPercent += percent;

      return {
        ...item,
        count,
        percent,
        startPercent
      };
    });
  }, [distribuicaoGlobal, totalGeralEntregas]);

  // Cálculos SVG para a Rosquinha (Raio = 72, Circunferência = 2 * PI * 72 ≈ 452.39)
  const RAIO = 72;
  const CIRCUNFERENCIA = 2 * Math.PI * RAIO;

  // Ajuste dinâmico de altura e densidade para exibir todos os veículos sem usar barra de navegação/rolagem
  const totalVeiculosVisiveis = veiculosFiltrados.length;
  const configDensidade = useMemo(() => {
    if (totalVeiculosVisiveis > 18) {
      return {
        espaco: 'space-y-0.5',
        paddingItem: 'py-0.5 px-1',
        alturaBarra: 'h-2.5',
        tamFonte: 'text-[10px]',
        tamTotal: 'text-[9px]'
      };
    }
    if (totalVeiculosVisiveis > 11) {
      return {
        espaco: 'space-y-1',
        paddingItem: 'py-0.5 px-1.5',
        alturaBarra: 'h-3',
        tamFonte: 'text-[10.5px]',
        tamTotal: 'text-[10px]'
      };
    }
    return {
      espaco: 'space-y-1.5',
      paddingItem: 'p-1',
      alturaBarra: 'h-3.5',
      tamFonte: 'text-[11px]',
      tamTotal: 'text-[10px]'
    };
  }, [totalVeiculosVisiveis]);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 sm:p-5 border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex flex-col h-auto min-h-[480px]">
      {/* Header com Abas de Visualização (Barras vs Rosquinha) + Botão de pausa/play sem timer visível */}
      <div className="flex items-center justify-between gap-2 mb-3.5 shrink-0 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-4 rounded-full bg-amber-500 shrink-0" />
          {/* Seletor de visualização */}
          <div className="flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60">
            <button
              onClick={() => setTipoGrafico('barras')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                tipoGrafico === 'barras'
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <BarChart3 size={13} />
              <span>Status por Veículo</span>
            </button>
            <button
              onClick={() => setTipoGrafico('rosquinha')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                tipoGrafico === 'rosquinha'
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <PieChart size={13} />
              <span>Rosquinha</span>
            </button>
          </div>
        </div>

        {/* Botão de Alternância Automática (sem exibir timer) + Busca rápida */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoAlternar(!autoAlternar)}
            className={`p-1.5 rounded-lg transition-colors ${
              autoAlternar 
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' 
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-600'
            }`}
            title={autoAlternar ? 'Alternância a cada 30s ativa (clique para pausar)' : 'Alternância pausada (clique para ativar 30s)'}
          >
            {autoAlternar ? <Pause size={13} /> : <Play size={13} />}
          </button>

          {/* Filtro de placa (apenas no modo barras) */}
          {tipoGrafico === 'barras' && (
            <div className="relative w-24 sm:w-28">
              <input
                type="text"
                placeholder="Placa..."
                value={buscaPlaca}
                onChange={(e) => setBuscaPlaca(e.target.value.toUpperCase())}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-0.5 text-[11px] font-mono font-bold focus:ring-1 focus:ring-amber-500 uppercase text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 placeholder:normal-case"
              />
              {buscaPlaca && (
                <button
                  onClick={() => setBuscaPlaca('')}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 hover:text-zinc-600"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CONTEÚDO 1: BARRAS EMPILHADAS POR VEÍCULO */}
      {tipoGrafico === 'barras' && (
        <div 
          className={`flex-1 pr-0.5 ${configDensidade.espaco}`}
          onMouseLeave={() => setTooltip(null)}
        >
          {veiculosFiltrados.length === 0 ? (
            <div className="text-center py-12 text-zinc-400 text-xs font-medium">
              Nenhum veículo encontrado com os filtros ativos.
            </div>
          ) : (
            veiculosFiltrados.map((v) => {
              const isSelected = veiculoSelecionado?.placa === v.placa;
              const barWidthPercent = (v.total / maxTotal) * 100;

              // Segmentos na ordem padrão do sistema
              const segPendente = v.total > 0 ? (v.pendentes / v.total) * 100 : 0;
              const segNoCliente = v.total > 0 ? (v.noCliente / v.total) * 100 : 0;
              const segDescarregando = v.total > 0 ? (v.descarregando / v.total) * 100 : 0;
              const segParcial = v.total > 0 ? (v.parciais / v.total) * 100 : 0;
              const segTotal = v.total > 0 ? (v.entregues / v.total) * 100 : 0;
              const segDevolucao = v.total > 0 ? (v.devolucoes / v.total) * 100 : 0;
              const segCargaParada = v.total > 0 ? (v.cargaParada / v.total) * 100 : 0;
              const segReentrega = v.total > 0 ? (v.reentregas / v.total) * 100 : 0;

              return (
                <div
                  key={v.placa}
                  onClick={() => onSelectVeiculo && onSelectVeiculo(v)}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltip({
                      x: rect.left + rect.width / 2,
                      y: rect.top - 8,
                      veiculo: v
                    });
                  }}
                  className={`flex items-center gap-2 ${configDensidade.paddingItem} rounded-lg cursor-pointer transition-all ${
                    isSelected 
                      ? 'bg-amber-500/10 border border-amber-500/30 shadow-xs' 
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  {/* Rótulo da Placa */}
                  <div className="w-16 sm:w-20 shrink-0 text-right">
                    <span className={`font-mono ${configDensidade.tamFonte} font-bold block truncate ${
                      isSelected ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-700 dark:text-zinc-300'
                    }`}>
                      {v.placa}
                    </span>
                  </div>

                  {/* Barra Empilhada Proporcional */}
                  <div className={`flex-1 ${configDensidade.alturaBarra} bg-zinc-100 dark:bg-zinc-800/60 rounded-xs overflow-hidden flex`}>
                    <div 
                      className="h-full flex overflow-hidden rounded-xs transition-all duration-300"
                      style={{ width: `${Math.max(barWidthPercent, 2)}%` }}
                    >
                      {/* 1. Pendente */}
                      {v.pendentes > 0 && (
                        <div className="h-full bg-amber-500" style={{ width: `${segPendente}%` }} />
                      )}
                      {/* 2. No Cliente */}
                      {v.noCliente > 0 && (
                        <div className="h-full bg-sky-500" style={{ width: `${segNoCliente}%` }} />
                      )}
                      {/* 3. Descarregando */}
                      {v.descarregando > 0 && (
                        <div className="h-full bg-blue-600" style={{ width: `${segDescarregando}%` }} />
                      )}
                      {/* 4. Entrega Parcial */}
                      {v.parciais > 0 && (
                        <div className="h-full bg-orange-500" style={{ width: `${segParcial}%` }} />
                      )}
                      {/* 5. Entrega Total */}
                      {v.entregues > 0 && (
                        <div className="h-full bg-emerald-600" style={{ width: `${segTotal}%` }} />
                      )}
                      {/* 6. Devolução Total */}
                      {v.devolucoes > 0 && (
                        <div className="h-full bg-rose-600" style={{ width: `${segDevolucao}%` }} />
                      )}
                      {/* 7. Carga Parada */}
                      {v.cargaParada > 0 && (
                        <div className="h-full bg-yellow-500" style={{ width: `${segCargaParada}%` }} />
                      )}
                      {/* 8. Reentrega */}
                      {v.reentregas > 0 && (
                        <div className="h-full bg-purple-600" style={{ width: `${segReentrega}%` }} />
                      )}
                    </div>
                  </div>

                  {/* Total de notas à direita */}
                  <div className="w-8 text-right shrink-0">
                    <span className={`font-mono ${configDensidade.tamTotal} text-zinc-400 dark:text-zinc-500 font-bold`}>
                      {v.total}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* CONTEÚDO 2: VISUALIZAÇÃO EM ROSQUINHA (DONUT CHART) */}
      {tipoGrafico === 'rosquinha' && (
        <div className="flex-1 flex flex-col items-center justify-center p-2">
          {/* Gráfico SVG Centralizado */}
          <div className="relative w-60 h-60 sm:w-64 sm:h-64 my-auto flex items-center justify-center">
            <svg viewBox="0 0 200 200" className="w-full h-full">
              {/* Grupo Rotacionado para as Fatias (início no topo a 12h) */}
              <g transform="rotate(-90 100 100)">
                {/* Círculo de fundo cinza */}
                <circle
                  cx="100"
                  cy="100"
                  r={RAIO}
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="26"
                  className="text-zinc-100 dark:text-zinc-800"
                />

                {/* Fatias da Rosquinha */}
                {totalGeralEntregas > 0 && fatiasRosquinha.map((fatia) => {
                  if (fatia.count <= 0) return null;
                  const dashLength = (fatia.percent / 100) * CIRCUNFERENCIA;
                  const offset = (fatia.startPercent / 100) * CIRCUNFERENCIA;
                  const isHovered = statusHover?.key === fatia.key;

                  return (
                    <circle
                      key={fatia.key}
                      cx="100"
                      cy="100"
                      r={RAIO}
                      fill="transparent"
                      stroke={fatia.cor}
                      strokeWidth={isHovered ? 30 : 26}
                      strokeDasharray={`${dashLength} ${CIRCUNFERENCIA - dashLength}`}
                      strokeDashoffset={-offset}
                      className="transition-all duration-300 hover:opacity-90 cursor-pointer"
                      onMouseEnter={() => setStatusHover(fatia)}
                      onMouseLeave={() => setStatusHover(null)}
                    />
                  );
                })}
              </g>

              {/* Rótulos com Números de Entregas diretamente na Rosquinha (orientação normal legível) */}
              {totalGeralEntregas > 0 && fatiasRosquinha.map((fatia) => {
                if (fatia.count <= 0) return null;
                // Posição angular central da fatia (0% = 12h = -90deg)
                const midPercent = fatia.startPercent + fatia.percent / 2;
                const angleDeg = (midPercent / 100) * 360 - 90;
                const angleRad = (angleDeg * Math.PI) / 180;

                // Fatias grandes o suficiente (>= 4%): número dentro do anel
                if (fatia.percent >= 4) {
                  const x = 100 + RAIO * Math.cos(angleRad);
                  const y = 100 + RAIO * Math.sin(angleRad);
                  const isDarkText = ['#eab308', '#facc15', '#fbbf24'].includes(fatia.cor);

                  return (
                    <text
                      key={`num-${fatia.key}`}
                      x={x}
                      y={y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={fatia.percent > 15 ? "11" : "9.5"}
                      fontWeight="900"
                      fontFamily="monospace"
                      fill={isDarkText ? '#18181b' : '#ffffff'}
                      className="pointer-events-none select-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]"
                    >
                      {fatia.count}
                    </text>
                  );
                }

                // Fatias menores (< 4%): pequeno badge logo fora do anel
                const xOuter = 100 + (RAIO + 17) * Math.cos(angleRad);
                const yOuter = 100 + (RAIO + 17) * Math.sin(angleRad);

                return (
                  <g key={`num-outer-${fatia.key}`} className="pointer-events-none select-none">
                    <circle
                      cx={xOuter}
                      cy={yOuter}
                      r="7.5"
                      fill={fatia.cor}
                      className="drop-shadow-xs"
                    />
                    <text
                      x={xOuter}
                      y={yOuter}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="8"
                      fontWeight="900"
                      fontFamily="monospace"
                      fill="#ffffff"
                    >
                      {fatia.count}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Centro da Rosquinha com Totalizador Dinâmico */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-3">
              {statusHover ? (
                <>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 truncate max-w-[130px]">
                    {statusHover.label}
                  </span>
                  <span className="text-2xl sm:text-3xl font-black font-mono text-zinc-900 dark:text-white leading-tight">
                    {statusHover.count}
                  </span>
                  <span className="text-[11px] font-bold" style={{ color: statusHover.cor }}>
                    {Math.round(statusHover.percent)}% das NFs
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Total de NFs
                  </span>
                  <span className="text-2xl sm:text-3xl font-black font-mono text-zinc-900 dark:text-white leading-tight">
                    {Number(totalGeralEntregas).toLocaleString('pt-BR')}
                  </span>
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    {totalGeralEntregas > 0 ? Math.round(((distribuicaoGlobal.entregaTotal || 0) / totalGeralEntregas) * 100) : 0}% Realizadas
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Mini Tabela Resumo abaixo da Rosquinha com Destaque de Contagem */}
          <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-xs">
            {fatiasRosquinha.map(f => (
              <div 
                key={f.key} 
                onMouseEnter={() => setStatusHover(f)}
                onMouseLeave={() => setStatusHover(null)}
                className={`flex items-center justify-between p-1.5 rounded-lg transition-all cursor-pointer ${
                  statusHover?.key === f.key 
                    ? 'bg-amber-500/10 border border-amber-500/40 shadow-xs' 
                    : 'bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0 pr-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${f.bgClass} shrink-0`} />
                  <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300 truncate" title={f.label}>
                    {f.label}
                  </span>
                </div>
                <div className="text-right shrink-0 flex items-baseline gap-1">
                  <span className="text-[11px] font-mono font-black text-zinc-900 dark:text-white">
                    {f.count}
                  </span>
                  <span className="text-[9px] font-mono font-semibold text-zinc-400">
                    ({Math.round(f.percent)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floating Tooltip no modo Barras */}
      {tooltip && tooltip.veiculo && tipoGrafico === 'barras' && (
        <div 
          className="fixed z-50 pointer-events-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 shadow-xl text-[11px] transform -translate-x-1/2 -translate-y-full mb-2 animate-in fade-in duration-100"
          style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
        >
          <div className="font-mono font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-1 mb-1.5 flex items-center justify-between gap-3">
            <span>Veículo: {tooltip.veiculo.placa}</span>
            <span className="text-zinc-500 font-normal">Total: {tooltip.veiculo.total}</span>
          </div>
          <div className="space-y-0.5 text-[10px]">
            {tooltip.veiculo.pendentes > 0 && (
              <div className="flex items-center justify-between gap-3 text-amber-600 dark:text-amber-400">
                <span>Pendente:</span>
                <span className="font-mono font-bold">{tooltip.veiculo.pendentes}</span>
              </div>
            )}
            {tooltip.veiculo.noCliente > 0 && (
              <div className="flex items-center justify-between gap-3 text-sky-600 dark:text-sky-400">
                <span>No Cliente:</span>
                <span className="font-mono font-bold">{tooltip.veiculo.noCliente}</span>
              </div>
            )}
            {tooltip.veiculo.descarregando > 0 && (
              <div className="flex items-center justify-between gap-3 text-blue-600 dark:text-blue-400">
                <span>Descarregando:</span>
                <span className="font-mono font-bold">{tooltip.veiculo.descarregando}</span>
              </div>
            )}
            {tooltip.veiculo.parciais > 0 && (
              <div className="flex items-center justify-between gap-3 text-orange-600 dark:text-orange-400">
                <span>Entrega parcial:</span>
                <span className="font-mono font-bold">{tooltip.veiculo.parciais}</span>
              </div>
            )}
            {tooltip.veiculo.entregues > 0 && (
              <div className="flex items-center justify-between gap-3 text-emerald-600 dark:text-emerald-400">
                <span>Entrega total:</span>
                <span className="font-mono font-bold">{tooltip.veiculo.entregues}</span>
              </div>
            )}
            {tooltip.veiculo.devolucoes > 0 && (
              <div className="flex items-center justify-between gap-3 text-rose-600 dark:text-rose-400">
                <span>Devolução total:</span>
                <span className="font-mono font-bold">{tooltip.veiculo.devolucoes}</span>
              </div>
            )}
            {tooltip.veiculo.cargaParada > 0 && (
              <div className="flex items-center justify-between gap-3 text-yellow-600 dark:text-yellow-400">
                <span>Carga parada:</span>
                <span className="font-mono font-bold">{tooltip.veiculo.cargaParada}</span>
              </div>
            )}
            {tooltip.veiculo.reentregas > 0 && (
              <div className="flex items-center justify-between gap-3 text-purple-600 dark:text-purple-400">
                <span>Reentrega:</span>
                <span className="font-mono font-bold">{tooltip.veiculo.reentregas}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
