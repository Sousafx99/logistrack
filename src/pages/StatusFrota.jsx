import { useMemo } from 'react';
import { Truck, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';

export function StatusFrota() {
  const { entregas, devolucoes, globalFilters } = useStore();
  const dataSelecionada = globalFilters.data; // use the same global date filter

  const frotaStats = useMemo(() => {
    const entregasDoDia = entregas.filter(e => e.data === dataSelecionada && e.placa);
    
    const agrupado = {};
    const finalizadasSet = new Set(['Entrega total', 'Entrega parcial', 'Devolução total', 'Reentrega']);

    entregasDoDia.forEach(e => {
      if (!agrupado[e.placa]) {
        agrupado[e.placa] = { placa: e.placa, total: 0, finalizadas: 0, pendentes: 0 };
      }
      agrupado[e.placa].total += 1;
      if (finalizadasSet.has(e.status)) {
        agrupado[e.placa].finalizadas += 1;
      } else {
        agrupado[e.placa].pendentes += 1;
      }
    });

    const carros = Object.values(agrupado).map(c => ({
      ...c,
      percentual: Math.round((c.finalizadas / c.total) * 100) || 0,
      status: c.pendentes === 0 ? 'Retornando' : 'Em Rota'
    }));

    // Ordenar: Em rota primeiro (quem falta menos aparece em cima, pois está terminando), depois retornando
    carros.sort((a, b) => {
      if (a.status === 'Em Rota' && b.status === 'Retornando') return -1;
      if (a.status === 'Retornando' && b.status === 'Em Rota') return 1;
      if (a.status === 'Em Rota') {
        return a.pendentes - b.pendentes; 
      }
      return 0;
    });

    const totais = {
      emRota: carros.filter(c => c.status === 'Em Rota').length,
      retornando: carros.filter(c => c.status === 'Retornando').length,
      totalCarros: carros.length
    };

    return { carros, totais };
  }, [entregas, dataSelecionada]);

  const retornosDoDia = useMemo(() => {
    // Pegamos as devoluções que foram geradas no dia selecionado (d.data é string ISO)
    const doDia = devolucoes.filter(d => d.data && d.data.startsWith(dataSelecionada));
    
    const agrupado = {};
    doDia.forEach(d => {
      const p = d.placa || 'Sem Placa';
      if (!agrupado[p]) agrupado[p] = 0;
      agrupado[p] += 1;
    });

    return Object.entries(agrupado).map(([placa, qtd]) => ({ placa, qtd }));
  }, [devolucoes, dataSelecionada]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-2 mt-2">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Truck className="text-info" /> Status da Frota
        </h2>
        <span className="text-xs font-bold text-text-tertiary bg-background-secondary px-2 py-1 rounded-md">
          {new Date(dataSelecionada).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
        </span>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="glass-panel p-4 rounded-xl text-center border-b-4 border-warning">
          <Clock size={24} className="mx-auto mb-2 text-warning" />
          <p className="text-3xl font-black text-text-primary">{frotaStats.totais.emRota}</p>
          <p className="text-[10px] uppercase font-bold text-text-tertiary">Carros na Rua</p>
        </div>
        <div className="glass-panel p-4 rounded-xl text-center border-b-4 border-success">
          <CheckCircle size={24} className="mx-auto mb-2 text-success" />
          <p className="text-3xl font-black text-text-primary">{frotaStats.totais.retornando}</p>
          <p className="text-[10px] uppercase font-bold text-text-tertiary">Carros Retornando</p>
        </div>
      </div>

      {/* Placas com Retorno */}
      {retornosDoDia.length > 0 && (
        <div className="mb-4 glass-panel p-3 rounded-xl border-l-4 border-danger bg-danger/5">
          <h3 className="text-xs font-bold text-danger uppercase flex items-center gap-1.5 mb-2">
            <AlertTriangle size={14} /> Atenção: Retorno de Mercadoria
          </h3>
          <div className="flex flex-wrap gap-2">
            {retornosDoDia.map(carro => (
              <div key={`retorno-${carro.placa}`} className="bg-danger/10 border border-danger/20 px-2.5 py-1.5 rounded-lg flex items-center gap-2">
                <span className="font-bold text-danger text-xs">{carro.placa}</span>
                <span className="text-[10px] bg-danger text-white px-1.5 py-0.5 rounded-full font-bold">
                  {carro.qtd} {carro.qtd === 1 ? 'ocorrência' : 'ocorrências'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de Carros */}
      <div className="space-y-3 pb-20">
        {frotaStats.carros.length === 0 ? (
          <div className="text-center text-text-tertiary py-8 glass-panel rounded-xl">
            <Truck className="mx-auto h-10 w-10 mb-2 opacity-50" />
            <p>Nenhuma placa com entregas registradas para esta data.</p>
          </div>
        ) : (
          frotaStats.carros.map(carro => (
            <div key={carro.placa} className={cn(
              "glass-panel p-4 rounded-xl transition-all border-l-4",
              carro.status === 'Retornando' ? 'border-success' : 'border-warning'
            )}>
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black bg-background-secondary px-2.5 py-1 rounded-lg border border-border-tertiary shadow-sm">
                    {carro.placa}
                  </span>
                  <span className={cn(
                    "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                    carro.status === 'Retornando' ? "text-success bg-success/10" : "text-warning bg-warning/10"
                  )}>
                    {carro.status}
                  </span>
                </div>
                <div className="text-right">
                  <span className={cn(
                    "text-xl font-black leading-none block",
                    carro.pendentes === 0 ? "text-success" : "text-text-primary"
                  )}>
                    {carro.pendentes}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-text-tertiary leading-none">Faltam</span>
                </div>
              </div>

              {/* Barra de Progresso */}
              <div>
                <div className="flex justify-between text-[10px] font-bold text-text-secondary mb-1.5">
                  <span>{carro.finalizadas} Finalizadas</span>
                  <span>{carro.percentual}%</span>
                  <span>{carro.total} Total</span>
                </div>
                <div className="w-full bg-background-secondary rounded-full h-2.5 overflow-hidden border border-border-tertiary">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      carro.status === 'Retornando' ? "bg-success" : "bg-warning"
                    )}
                    style={{ width: `${carro.percentual}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
