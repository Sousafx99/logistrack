import React from 'react';

// Ordem rigorosa dos 8 status e cores oficiais do sistema
const STATUS_CONFIG = [
  { key: 'pendente', label: 'Pendente', bg: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  { key: 'noCliente', label: 'No Cliente', bg: 'bg-sky-500', text: 'text-sky-600 dark:text-sky-400' },
  { key: 'descarregando', label: 'Descarregando', bg: 'bg-blue-600', text: 'text-blue-600 dark:text-blue-400' },
  { key: 'entregaParcial', label: 'Entrega Parcial', bg: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400' },
  { key: 'entregaTotal', label: 'Entrega Total', bg: 'bg-emerald-600', text: 'text-emerald-600 dark:text-emerald-400' },
  { key: 'devolucaoTotal', label: 'Devolução Total', bg: 'bg-rose-600', text: 'text-rose-600 dark:text-rose-400' },
  { key: 'cargaParada', label: 'Carga Parada', bg: 'bg-yellow-500', text: 'text-yellow-600 dark:text-yellow-400' },
  { key: 'reentrega', label: 'Reentrega', bg: 'bg-purple-600', text: 'text-purple-600 dark:text-purple-400' },
];

export function DistribuicaoStatusBarras({ distribuicao, totalGeral = 0 }) {
  const data = distribuicao || {};

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 sm:p-5 border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
      {/* Header com barra vermelha vertical */}
      <div className="flex items-center gap-2 mb-3.5">
        <span className="w-1.5 h-4 rounded-full bg-rose-600 shrink-0" />
        <h3 className="text-xs font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
          Distribuição por Status
        </h3>
      </div>

      {/* Lista de Barras Horizontais Responsiva em Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {STATUS_CONFIG.map(st => {
          const count = Number(data[st.key] || 0);
          const percent = totalGeral > 0 ? (count / totalGeral) * 100 : 0;
          const percentFormatado = percent > 0 ? `${Math.round(percent)}%` : '0%';

          return (
            <div key={st.key} className="flex items-center gap-2 text-xs bg-zinc-50/80 dark:bg-zinc-800/40 p-2 rounded-xl border border-zinc-100 dark:border-zinc-800/60 transition-all hover:border-zinc-300 dark:hover:border-zinc-700">
              {/* Rótulo do Status */}
              <div className="w-24 sm:w-28 shrink-0 truncate">
                <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                  {st.label}
                </span>
              </div>

              {/* Barra de Progresso Horizontal */}
              <div className="flex-1 h-3.5 bg-zinc-200/60 dark:bg-zinc-700/60 rounded-xs overflow-hidden relative flex items-center">
                {count > 0 && (
                  <div 
                    className={`h-full ${st.bg} rounded-xs transition-all duration-500 flex items-center justify-center px-1`}
                    style={{ width: `${Math.max(percent, 3)}%` }}
                  >
                    {percent > 8 && (
                      <span className="text-[9px] font-black text-white leading-none font-mono drop-shadow-xs">
                        {count}
                      </span>
                    )}
                  </div>
                )}
                {/* Se a barra for muito estreita para o texto interno, exibe o número logo ao lado */}
                {count > 0 && percent <= 8 && (
                  <span className="text-[10px] font-black font-mono ml-1 text-zinc-600 dark:text-zinc-400">
                    {count}
                  </span>
                )}
              </div>

              {/* Percentual à direita */}
              <div className="w-8 text-right shrink-0">
                <span className="text-[11px] font-mono font-bold text-zinc-400 dark:text-zinc-500">
                  {percentFormatado}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
