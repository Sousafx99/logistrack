import React from 'react';
import { 
  Target, 
  Boxes, 
  Truck, 
  Scale, 
  DollarSign,
  AlertTriangle 
} from 'lucide-react';

const formatarMoeda = (val) => {
  if (val === null || val === undefined || isNaN(Number(val))) return 'R$ 0,00';
  return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatarPeso = (val) => {
  if (val === null || val === undefined || isNaN(Number(val))) return '0 kg';
  return `${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 3 })} kg`;
};

export function CardKpisDashboard({ stats }) {
  const {
    otif = 89,
    metaOtif = 90,
    totalEntregasComPlaca = 0,
    entregasOkComPlaca = 0,
    totalCargas = 0,
    totalPedidos = 0,
    totalGeral = 0,
    totalVeiculos = 0,
    pesoTotal = 0,
    valorTotal = 0,
    realizadas = 0,
    emAndamento = 0,
    pendentes = 0,
    retornos = 0,
    detalheRetornos = {}
  } = stats || {};

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-9 gap-2 sm:gap-2.5 w-full">
      {/* 1. OTIF (MÊS) */}
      <div 
        className="bg-white dark:bg-zinc-900 rounded-xl p-2.5 sm:p-3 border border-zinc-200/80 dark:border-zinc-800 shadow-xs relative overflow-hidden transition-all hover:shadow-md cursor-help flex flex-col justify-between"
        title={totalEntregasComPlaca > 0 ? `OTIF calculado sobre ${totalEntregasComPlaca} entregas com veículos vinculados (${entregasOkComPlaca} entregas concluídas)` : 'Apenas entregas com veículos vinculados são contabilizadas no OTIF'}
      >
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block truncate">
              OTIF (MÊS)
            </span>
            <span className="text-xl sm:text-2xl font-black font-mono text-zinc-900 dark:text-white block mt-0.5">
              {otif}%
            </span>
          </div>
          <div className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <Target size={14} className="stroke-[2.5]" />
          </div>
        </div>
        <span className="text-[9px] font-bold text-rose-500 block mt-1 truncate">
          Meta Mês {metaOtif}%
        </span>
      </div>

      {/* 2. TOTAL DE PEDIDOS */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-2.5 sm:p-3 border border-zinc-200/80 dark:border-zinc-800 shadow-xs relative overflow-hidden transition-all hover:shadow-md flex flex-col justify-between">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block truncate">
              TOTAL PEDIDOS
            </span>
            <span className="text-xl sm:text-2xl font-black font-mono text-zinc-900 dark:text-white block mt-0.5">
              {Number(totalPedidos || totalGeral || totalCargas || 0).toLocaleString('pt-BR')}
            </span>
          </div>
          <div className="w-7 h-7 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
            <Boxes size={14} className="stroke-[2.5]" />
          </div>
        </div>
        <span className="text-[9px] font-medium text-zinc-400 dark:text-zinc-500 block mt-1 truncate">
          {totalCargas > 0 ? `${totalCargas} ${totalCargas === 1 ? 'carga' : 'cargas'}` : 'Geral'}
        </span>
      </div>

      {/* 3. VEÍCULOS (PLACAS) */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-2.5 sm:p-3 border border-zinc-200/80 dark:border-zinc-800 shadow-xs relative overflow-hidden transition-all hover:shadow-md flex flex-col justify-between">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block truncate">
              VEÍCULOS (PLACAS)
            </span>
            <span className="text-xl sm:text-2xl font-black font-mono text-zinc-900 dark:text-white block mt-0.5">
              {totalVeiculos}
            </span>
          </div>
          <div className="w-7 h-7 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
            <Truck size={14} className="stroke-[2.5]" />
          </div>
        </div>
        <span className="text-[9px] font-medium text-zinc-400 dark:text-zinc-500 block mt-1 truncate">
          Em monitoramento
        </span>
      </div>

      {/* 4. PESO TOTAL */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-2.5 sm:p-3 border border-zinc-200/80 dark:border-zinc-800 shadow-xs relative overflow-hidden transition-all hover:shadow-md flex flex-col justify-between">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block truncate">
              PESO TOTAL
            </span>
            <span className="text-sm sm:text-base font-black font-mono text-zinc-900 dark:text-white block mt-1 truncate" title={formatarPeso(pesoTotal)}>
              {formatarPeso(pesoTotal)}
            </span>
          </div>
          <div className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <Scale size={14} className="stroke-[2.5]" />
          </div>
        </div>
        <span className="text-[9px] font-medium text-zinc-400 dark:text-zinc-500 block mt-1 truncate">
          Carga total
        </span>
      </div>

      {/* 5. VALOR TOTAL */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-2.5 sm:p-3 border border-zinc-200/80 dark:border-zinc-800 shadow-xs relative overflow-hidden transition-all hover:shadow-md flex flex-col justify-between">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block truncate">
              VALOR TOTAL
            </span>
            <span className="text-sm sm:text-base font-black font-mono text-zinc-900 dark:text-white block mt-1 truncate" title={formatarMoeda(valorTotal)}>
              {formatarMoeda(valorTotal)}
            </span>
          </div>
          <div className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <DollarSign size={14} className="stroke-[2.5]" />
          </div>
        </div>
        <span className="text-[9px] font-medium text-zinc-400 dark:text-zinc-500 block mt-1 truncate">
          Faturamento
        </span>
      </div>

      {/* 6. REALIZADAS (Borda lateral verde) */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-2.5 sm:p-3 border-l-4 border-l-emerald-500 border border-zinc-200/80 dark:border-zinc-800 shadow-xs transition-all hover:shadow-md flex flex-col justify-between">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block truncate">
            REALIZADAS
          </span>
          <span className="text-xl sm:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 block mt-0.5">
            {Number(realizadas).toLocaleString('pt-BR')}
          </span>
        </div>
        <span className="text-[9px] font-medium text-emerald-600/80 dark:text-emerald-400/80 block mt-1 truncate">
          {totalGeral > 0 ? `${Math.round((realizadas / totalGeral) * 100)}% concluído` : 'Entregue'}
        </span>
      </div>

      {/* 7. EM ANDAMENTO (Borda lateral azul) */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-2.5 sm:p-3 border-l-4 border-l-blue-500 border border-zinc-200/80 dark:border-zinc-800 shadow-xs transition-all hover:shadow-md flex flex-col justify-between">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block truncate">
            EM ANDAMENTO
          </span>
          <span className="text-xl sm:text-2xl font-black font-mono text-blue-600 dark:text-blue-400 block mt-0.5">
            {Number(emAndamento).toLocaleString('pt-BR')}
          </span>
        </div>
        <span className="text-[9px] font-medium text-blue-600/80 dark:text-blue-400/80 block mt-1 truncate">
          Cliente / Descarregando
        </span>
      </div>

      {/* 8. PENDENTES (Borda lateral âmbar) */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-2.5 sm:p-3 border-l-4 border-l-amber-500 border border-zinc-200/80 dark:border-zinc-800 shadow-xs transition-all hover:shadow-md flex flex-col justify-between">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block truncate">
            PENDENTES
          </span>
          <span className="text-xl sm:text-2xl font-black font-mono text-amber-600 dark:text-amber-400 block mt-0.5">
            {Number(pendentes).toLocaleString('pt-BR')}
          </span>
        </div>
        <span className="text-[9px] font-medium text-amber-600/80 dark:text-amber-400/80 block mt-1 truncate">
          Aguardando início
        </span>
      </div>

      {/* 9. RETORNOS (Borda lateral vermelha/rose) */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-2.5 sm:p-3 border-l-4 border-l-rose-500 border border-zinc-200/80 dark:border-zinc-800 shadow-xs transition-all hover:shadow-md flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block truncate">
            RETORNOS
          </span>
          {retornos > 0 && (
            <span className="text-[9px] font-mono font-bold text-rose-500 bg-rose-500/10 px-1 rounded shrink-0">
              Alerta
            </span>
          )}
        </div>
        <span className="text-xl sm:text-2xl font-black font-mono text-rose-600 dark:text-rose-400 block mt-0.5">
          {Number(retornos).toLocaleString('pt-BR')}
        </span>
        <span className="text-[9px] text-zinc-400 dark:text-zinc-500 block mt-1 truncate" title={`Dev. Total: ${detalheRetornos.devolucoes || 0} • Parcial: ${detalheRetornos.parciais || 0} • Reentrega: ${detalheRetornos.reentregas || 0} • Parada: ${detalheRetornos.cargaParada || 0}`}>
          Dev, Parcial, Reentr, Parada
        </span>
      </div>
    </div>
  );
}
