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
  
  // Modos de visualização: 'barras' (Status por Veículo) ou 'rosquinha' (Gráfico de Status)
  const [tipoGrafico, setTipoGrafico] = useState(() => {
    try {
      const saved = localStorage.getItem('logistrack_tipo_grafico_dashboard');
      if (saved && ['barras', 'rosquinha'].includes(saved)) {
        return saved;
      }
    } catch (e) {
      // Ignora erro de storage
    }
    return 'barras';
  });

  const [autoAlternar, setAutoAlternar] = useState(true);

  // Função para mudar tipo e persistir escolha do usuário
  const handleMudarTipo = (novoTipo) => {
    setTipoGrafico(novoTipo);
    try {
      localStorage.setItem('logistrack_tipo_grafico_dashboard', novoTipo);
    } catch (e) {
      // Ignora erro de storage
    }
  };

  // Efeito de alternância automática a cada 20 segundos (ativo por padrão)
  useEffect(() => {
    if (!autoAlternar) return;

    const interval = setInterval(() => {
      setTipoGrafico(curr => curr === 'barras' ? 'rosquinha' : 'barras');
    }, 20000); // 20 segundos

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

  // Cálculo inteligente de posicionamento dos rótulos e resolução de sobreposição
  const rotulosRosquinha = useMemo(() => {
    if (totalGeralEntregas <= 0) return [];

    const fatiasAtivas = fatiasRosquinha.filter(f => f.count > 0);
    const bigSlices = [];
    const smallSlices = [];

    fatiasAtivas.forEach(f => {
      const midPercent = f.startPercent + f.percent / 2;
      let angleDeg = (midPercent / 100) * 360 - 90;
      while (angleDeg > 180) angleDeg -= 360;
      while (angleDeg <= -180) angleDeg += 360;

      const sliceInfo = {
        ...f,
        origAngle: angleDeg,
        origRad: (angleDeg * Math.PI) / 180
      };

      // Fatias com >= 5% de proporção têm espaço interno no anel
      if (f.percent >= 5) {
        bigSlices.push({
          ...sliceInfo,
          isInside: true,
          x: 100 + RAIO * Math.cos(sliceInfo.origRad),
          y: 100 + RAIO * Math.sin(sliceInfo.origRad)
        });
      } else {
        smallSlices.push({
          ...sliceInfo,
          isInside: false
        });
      }
    });

    if (smallSlices.length > 0) {
      // Ordena por ângulo normalizado [-180, 180]
      smallSlices.sort((a, b) => a.origAngle - b.origAngle);

      const n = smallSlices.length;
      const minAngularGap = 16; // Garante separação mínima de ~25px entre centros de badges

      if (n > 1) {
        const angles = smallSlices.map(s => s.origAngle);
        for (let iter = 0; iter < 40; iter++) {
          for (let i = 0; i < n - 1; i++) {
            const diff = angles[i + 1] - angles[i];
            if (diff < minAngularGap) {
              const push = (minAngularGap - diff) / 2;
              angles[i] -= push;
              angles[i + 1] += push;
            }
          }
          const wrapDiff = (angles[0] + 360) - angles[n - 1];
          if (wrapDiff < minAngularGap) {
            const push = (minAngularGap - wrapDiff) / 2;
            angles[n - 1] -= push;
            angles[0] += push;
          }
        }

        smallSlices.forEach((s, i) => {
          s.badgeAngle = angles[i];
        });
      } else {
        smallSlices[0].badgeAngle = smallSlices[0].origAngle;
      }

      const SLICE_EDGE_RADIUS = RAIO + 13; // 85px (borda do anel)

      smallSlices.forEach((s, i) => {
        // Escalonamento radial alternado para fatias adjacentes (garante separação 2D perfeita)
        const isOdd = i % 2 === 1;
        const radius = isOdd ? RAIO + 22 : RAIO + 16; // 94px vs 88px
        const badgeRad = (s.badgeAngle * Math.PI) / 180;

        s.x = 100 + radius * Math.cos(badgeRad);
        s.y = 100 + radius * Math.sin(badgeRad);
        s.xStem = 100 + SLICE_EDGE_RADIUS * Math.cos(s.origRad);
        s.yStem = 100 + SLICE_EDGE_RADIUS * Math.sin(s.origRad);
      });
    }

    return [...bigSlices, ...smallSlices];
  }, [fatiasRosquinha, totalGeralEntregas, RAIO]);

  // Ajuste dinâmico de altura e densidade para exibir todos os veículos sem rolagem desnecessária
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
        tamFonte: 'text-[11px]',
        tamTotal: 'text-[10.5px]'
      };
    }
    return {
      espaco: 'space-y-1.5',
      paddingItem: 'p-1',
      alturaBarra: 'h-3.5',
      tamFonte: 'text-xs',
      tamTotal: 'text-xs'
    };
  }, [totalVeiculosVisiveis]);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 sm:p-5 border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex flex-col h-auto min-h-[480px]">
      {/* Header com Abas de Visualização: Status por Veículo vs Gráfico de Status */}
      <div className="flex items-center justify-between gap-2 mb-3.5 shrink-0 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="w-2 h-5 rounded-full bg-amber-500 shrink-0" />
          
          {/* Seletor de visualização (apenas Status por Veículo e Gráfico de Status) */}
          <div className="flex items-center p-0.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/80">
            <button
              onClick={() => handleMudarTipo('barras')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                tipoGrafico === 'barras'
                  ? 'bg-white dark:bg-zinc-700 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
              title="Exibir lista de veículos e suas entregas"
            >
              <BarChart3 size={14} />
              <span>Status por Veículo</span>
            </button>

            <button
              onClick={() => handleMudarTipo('rosquinha')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                tipoGrafico === 'rosquinha'
                  ? 'bg-white dark:bg-zinc-700 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
              title="Exibir gráfico geral de status das entregas"
            >
              <PieChart size={14} />
              <span>Gráfico de Status</span>
            </button>
          </div>
        </div>

        {/* Busca rápida de Placas (ativo no modo Status por Veículo) */}
        <div className="flex items-center gap-2">
          {tipoGrafico === 'barras' && (
            <div className="relative">
              <input
                type="text"
                value={buscaPlaca}
                onChange={(e) => setBuscaPlaca(e.target.value)}
                placeholder="Buscar placa..."
                className="w-28 sm:w-36 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs font-bold rounded-lg pl-7 pr-2 py-1.5 border border-zinc-200 dark:border-zinc-700 focus:outline-hidden focus:border-amber-500"
              />
              <Search size={12} className="absolute left-2.5 top-2.5 text-zinc-400" />
            </div>
          )}
        </div>
      </div>

      {/* CONTEÚDO 1: STATUS POR VEÍCULO (BARRAS EMPILHADAS) */}
      {tipoGrafico === 'barras' && (
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-2.5 pb-1.5 border-b border-zinc-100 dark:border-zinc-800 text-xs">
            <span className="font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <BarChart3 size={13} className="text-amber-500" />
              <span>Veículos em Rota</span>
            </span>
            <span className="text-zinc-400 font-semibold text-[11px]">
              Clique na placa para focar no Veículo em Destaque
            </span>
          </div>

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
                    className={`flex items-center gap-3 sm:gap-4 ${configDensidade.paddingItem} rounded-lg cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-amber-500/15 border border-amber-500/40 shadow-xs' 
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    {/* Rótulo da Placa com fonte duplicada */}
                    <div className="w-24 sm:w-28 shrink-0 text-right">
                      <span className={`font-mono text-sm sm:text-base xl:text-lg font-black block truncate ${
                        isSelected ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-800 dark:text-zinc-200'
                      }`}>
                        {v.placa}
                      </span>
                    </div>

                    {/* Barra Empilhada - Ajusta e ocupa o espaço vazio */}
                    <div className="flex-1 h-3.5 sm:h-4 bg-zinc-100 dark:bg-zinc-800/60 rounded-xs overflow-hidden flex">
                      <div 
                        className="h-full flex overflow-hidden rounded-xs transition-all duration-300"
                        style={{ width: `${Math.max(barWidthPercent, 3)}%` }}
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

                    {/* Total de notas à direita com fonte duplicada */}
                    <div className="w-12 sm:w-16 text-right shrink-0">
                      <span className="font-mono text-sm sm:text-base xl:text-lg text-zinc-900 dark:text-white font-black">
                        {v.total}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* CONTEÚDO 2: GRÁFICO DE STATUS (DONUT CHART) */}
      {tipoGrafico === 'rosquinha' && (
        <div className="flex-1 flex flex-col items-center justify-center p-2 w-full">
          <div className="w-full flex items-center justify-between mb-2.5 pb-1.5 border-b border-zinc-100 dark:border-zinc-800 text-xs">
            <span className="font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <PieChart size={13} className="text-amber-500" />
              <span>Distribuição Global das Notas</span>
            </span>
            <span className="text-zinc-400 font-mono font-bold">
              Total: {totalGeralEntregas} notas
            </span>
          </div>

          {/* Gráfico SVG Centralizado (aumentado em 50%) */}
          <div className="relative w-[360px] h-[360px] sm:w-[420px] sm:h-[420px] md:w-[450px] md:h-[450px] my-auto flex items-center justify-center">
            <svg viewBox="-12 -12 224 224" className="w-full h-full overflow-visible">
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

              {/* Rótulos com Números de Entregas (com resolução inteligente de sobreposição e hastes indicadoras) */}
              {totalGeralEntregas > 0 && rotulosRosquinha.map((rotulo) => {
                // Fatias com espaço interno (>= 5%): número diretamente dentro do anel
                if (rotulo.isInside) {
                  const isDarkText = ['#eab308', '#facc15', '#fbbf24'].includes(rotulo.cor);

                  return (
                    <text
                      key={`num-${rotulo.key}`}
                      x={rotulo.x}
                      y={rotulo.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={rotulo.percent > 15 ? "13" : "11"}
                      fontWeight="900"
                      fontFamily="monospace"
                      fill={isDarkText ? '#18181b' : '#ffffff'}
                      className="pointer-events-none select-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                    >
                      {rotulo.count}
                    </text>
                  );
                }

                // Fatias com fatias menores (< 5%): badges com hastes e espaçamento anti-colisão
                return (
                  <g 
                    key={`badge-${rotulo.key}`}
                    className="cursor-pointer transition-transform duration-200 hover:scale-110"
                    onMouseEnter={() => setStatusHover(rotulo)}
                    onMouseLeave={() => setStatusHover(null)}
                  >
                    {/* Linha guia (haste) da fatia ao badge */}
                    <line
                      x1={rotulo.xStem}
                      y1={rotulo.yStem}
                      x2={rotulo.x}
                      y2={rotulo.y}
                      stroke={rotulo.cor}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      opacity="0.85"
                    />
                    {/* Círculo do Badge com contorno de alto contraste */}
                    <circle
                      cx={rotulo.x}
                      cy={rotulo.y}
                      r="8.5"
                      fill={rotulo.cor}
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="text-white dark:text-zinc-900 drop-shadow-sm"
                    />
                    {/* Número da fatia */}
                    <text
                      x={rotulo.x}
                      y={rotulo.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="9.5"
                      fontWeight="900"
                      fontFamily="monospace"
                      fill="#ffffff"
                      className="pointer-events-none select-none"
                    >
                      {rotulo.count}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Centro da Rosquinha com Totalizador Dinâmico (proporcionalmente ampliado) */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
              {statusHover ? (
                <>
                  <span className="text-sm sm:text-base font-bold uppercase tracking-wider text-zinc-400 truncate max-w-[180px]">
                    {statusHover.label}
                  </span>
                  <span className="text-5xl sm:text-6xl font-black font-mono text-zinc-900 dark:text-white leading-tight my-0.5">
                    {statusHover.count}
                  </span>
                  <span className="text-sm sm:text-base font-bold" style={{ color: statusHover.cor }}>
                    {Math.round(statusHover.percent)}% das NFs
                  </span>
                </>
              ) : (
                <>
                  <span className="text-sm sm:text-base font-bold uppercase tracking-wider text-zinc-400">
                    Total de NFs
                  </span>
                  <span className="text-5xl sm:text-6xl font-black font-mono text-zinc-900 dark:text-white leading-tight my-0.5">
                    {Number(totalGeralEntregas).toLocaleString('pt-BR')}
                  </span>
                  <span className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400">
                    {totalGeralEntregas > 0 ? Math.round(((distribuicaoGlobal.entregaTotal || 0) / totalGeralEntregas) * 100) : 0}% Realizadas
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Mini Tabela Resumo abaixo da Rosquinha */}
          <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3.5 pt-3.5 border-t border-zinc-100 dark:border-zinc-800 text-xs">
            {fatiasRosquinha.map(f => (
              <div 
                key={f.key} 
                onMouseEnter={() => setStatusHover(f)}
                onMouseLeave={() => setStatusHover(null)}
                className={`flex items-center justify-between p-2 sm:p-2.5 rounded-xl transition-all cursor-pointer ${
                  statusHover?.key === f.key 
                    ? 'bg-amber-500/10 border border-amber-500/40 shadow-xs' 
                    : 'bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-100 dark:border-zinc-800/60'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 pr-1">
                  <span className={`w-3 h-3 rounded-full ${f.bgClass} shrink-0`} />
                  <span className="text-xs sm:text-[13px] font-bold text-zinc-800 dark:text-zinc-200 truncate" title={f.label}>
                    {f.label}
                  </span>
                </div>
                <div className="text-right shrink-0 flex items-baseline gap-1.5">
                  <span className="text-sm sm:text-base font-mono font-black text-zinc-900 dark:text-white">
                    {f.count}
                  </span>
                  <span className="text-[11px] sm:text-xs font-mono font-semibold text-zinc-400">
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
