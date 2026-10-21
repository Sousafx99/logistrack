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
    <div className="flex flex-col gap-2.5">
      {/* 1. OTIF (MÊS) */}
      <div 
        className="bg-white dark:bg-zinc-900 rounded-xl p-3 border border-zinc-200/80 dark:border-zinc-800 shadow-xs relative overflow-hidden transition-all hover:shadow-md cursor-help"
        title={totalEntregasComPlaca > 0 ? `OTIF calculado sobre ${totalEntregasComPlaca} entregas com veículos vinculados (${entregasOkComPlaca} entregas totais concluídas)` : 'Apenas entregas com veículos vinculados são contabilizadas no OTIF'}
      >
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
              OTIF (MÊS)
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black font-mono text-zinc-900 dark:text-white">
                {otif}%
              </span>
            </div>
            <span className="text-[9px] font-bold text-rose-500 block mt-0.5">
              Meta Mês {metaOtif}%
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <Target size={16} className="stroke-[2.5]" />
          </div>
        </div>
      </div>

      {/* 2. TOTAL DE PEDIDOS */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-3 border border-zinc-200/80 dark:border-zinc-800 shadow-xs relative overflow-hidden transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
              TOTAL DE PEDIDOS
            </span>
            <span className="text-2xl font-black font-mono text-zinc-900 dark:text-white block mt-0.5">
              {Number(totalPedidos || totalGeral || totalCargas || 0).toLocaleString('pt-BR')}
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
            <Boxes size={16} className="stroke-[2.5]" />
          </div>
        </div>
      </div>

      {/* 3. VEÍCULOS (PLACAS) */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-3 border border-zinc-200/80 dark:border-zinc-800 shadow-xs relative overflow-hidden transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
              VEÍCULOS (PLACAS)
            </span>
            <span className="text-2xl font-black font-mono text-zinc-900 dark:text-white block mt-0.5">
              {totalVeiculos}
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
            <Truck size={16} className="stroke-[2.5]" />
          </div>
        </div>
      </div>

      {/* 4. PESO TOTAL */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-3 border border-zinc-200/80 dark:border-zinc-800 shadow-xs relative overflow-hidden transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
              PESO TOTAL
            </span>
            <span className="text-base sm:text-lg font-black font-mono text-zinc-900 dark:text-white block mt-0.5 truncate" title={formatarPeso(pesoTotal)}>
              {formatarPeso(pesoTotal)}
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <Scale size={16} className="stroke-[2.5]" />
          </div>
        </div>
      </div>

      {/* 5. VALOR TOTAL */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-3 border border-zinc-200/80 dark:border-zinc-800 shadow-xs relative overflow-hidden transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
              VALOR TOTAL
            </span>
            <span className="text-base sm:text-lg font-black font-mono text-zinc-900 dark:text-white block mt-0.5 truncate" title={formatarMoeda(valorTotal)}>
              {formatarMoeda(valorTotal)}
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <DollarSign size={16} className="stroke-[2.5]" />
          </div>
        </div>
      </div>

      {/* 6. REALIZADAS (Borda lateral verde) */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-3 border-l-4 border-l-emerald-500 border border-zinc-200/80 dark:border-zinc-800 shadow-xs transition-all hover:shadow-md">
        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
          REALIZADAS
        </span>
        <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 block mt-0.5">
          {Number(realizadas).toLocaleString('pt-BR')}
        </span>
      </div>

      {/* 7. EM ANDAMENTO (Borda lateral azul) */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-3 border-l-4 border-l-blue-500 border border-zinc-200/80 dark:border-zinc-800 shadow-xs transition-all hover:shadow-md">
        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
          EM ANDAMENTO
        </span>
        <span className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400 block mt-0.5">
          {Number(emAndamento).toLocaleString('pt-BR')}
        </span>
      </div>

      {/* 8. PENDENTES (Borda lateral âmbar) */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-3 border-l-4 border-l-amber-500 border border-zinc-200/80 dark:border-zinc-800 shadow-xs transition-all hover:shadow-md">
        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
          PENDENTES
        </span>
        <span className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400 block mt-0.5">
          {Number(pendentes).toLocaleString('pt-BR')}
        </span>
      </div>

      {/* 9. RETORNOS (Borda lateral vermelha/rose: Devolução Total, Entrega Parcial, Reentrega, Carga Parada) */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-3 border-l-4 border-l-rose-500 border border-zinc-200/80 dark:border-zinc-800 shadow-xs transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
            RETORNOS
          </span>
          {retornos > 0 && (
            <span className="text-[9px] font-mono font-bold text-rose-500 bg-rose-500/10 px-1 rounded">
              Alerta
            </span>
          )}
        </div>
        <span className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400 block mt-0.5">
          {Number(retornos).toLocaleString('pt-BR')}
        </span>
        <span className="text-[9px] text-zinc-400 dark:text-zinc-500 block mt-0.5 truncate" title={`Dev. Total: ${detalheRetornos.devolucoes || 0} • Parcial: ${detalheRetornos.parciais || 0} • Reentrega: ${detalheRetornos.reentregas || 0} • Parada: ${detalheRetornos.cargaParada || 0}`}>
          Devolução, Parcial, Reentrega e Parada
        </span>
      </div>
    </div>
  );
}
