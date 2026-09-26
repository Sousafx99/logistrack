import { useState, useMemo } from 'react';
import { Truck, CheckCircle, Clock, AlertTriangle, User, Phone, Edit2, RotateCcw, Calendar } from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { PerfilMotoristaModal } from '../components/motorista/PerfilMotoristaModal';

export function StatusFrota() {
  const { entregas, devolucoes, motoristas, globalFilters, setGlobalFilters, atualizarMotoristaAdmin } = useStore();
  const dataSelecionada = globalFilters.data; // use the same global date filter
  
  const [motoristaEditando, setMotoristaEditando] = useState(null);

  const frotaStats = useMemo(() => {
    const entregasDoDia = (entregas || []).filter(e => {
      const p = (e.placa || '').trim().toUpperCase();
      return e.data === dataSelecionada && p && p !== 'SEM PLACA' && p !== 'NULL';
    });
    
    // Devoluções registradas para a data selecionada
    const devDoDia = (devolucoes || []).filter(d => {
      const dataDev = d.data ? (d.data.length >= 10 ? d.data.slice(0, 10) : d.data) : '';
      return dataDev === dataSelecionada;
    });

    const agrupado = {};
    const finalizadasSet = new Set(['Entrega total', 'Entrega parcial', 'Devolução total', 'Reentrega', 'Carga parada']);

    entregasDoDia.forEach(e => {
      const p = (e.placa || '').trim().toUpperCase();
      if (!agrupado[p]) {
        agrupado[p] = { 
          placa: p, 
          total: 0, 
          finalizadas: 0, 
          pendentes: 0,
          entregues: 0,
          devolucoes: 0,
          reentregas: 0,
          parciais: 0,
          cargaParada: 0,
          notas: []
        };
      }
      agrupado[p].total += 1;
      agrupado[p].notas.push(e);

      if (e.status === 'Entrega total') {
        agrupado[p].entregues += 1;
      } else if (e.status === 'Devolução total') {
        agrupado[p].devolucoes += 1;
      } else if (e.status === 'Reentrega') {
        agrupado[p].reentregas += 1;
      } else if (e.status === 'Entrega parcial') {
        agrupado[p].parciais += 1;
      } else if (e.status === 'Carga parada') {
        agrupado[p].cargaParada += 1;
      }

      if (finalizadasSet.has(e.status)) {
        agrupado[p].finalizadas += 1;
      } else {
        agrupado[p].pendentes += 1;
      }
    });

    const carros = Object.values(agrupado).map(c => {
      // Cruzar com o módulo de devoluções para identificar registros extras de devolução/reentrega
      const devsDoCarro = devDoDia.filter(d => {
        if (d.placa && d.placa.trim().toUpperCase() === c.placa) return true;
        const ent = c.notas.find(e => String(e.nota) === String(d.nota));
        return !!ent;
      });

      const totalDevolucaoRegistrada = Math.max(
        c.devolucoes,
        devsDoCarro.filter(d => d.tipo !== 'Reentrega' && d.tratamento !== 'Reentrega').length
      );

      const totalReentregaRegistrada = Math.max(
        c.reentregas,
        devsDoCarro.filter(d => d.tipo === 'Reentrega' || d.tratamento === 'Reentrega').length
      );

      const temDevolucao = totalDevolucaoRegistrada > 0 || c.devolucoes > 0 || c.parciais > 0;
      const temReentrega = totalReentregaRegistrada > 0 || c.reentregas > 0;

      const pctEntregues = c.total > 0 ? ((c.entregues) / c.total) * 100 : 0;
      const pctParciais = c.total > 0 ? ((c.parciais) / c.total) * 100 : 0;
      const pctDevolucoes = c.total > 0 ? (totalDevolucaoRegistrada / c.total) * 100 : 0;
      const pctReentregas = c.total > 0 ? (totalReentregaRegistrada / c.total) * 100 : 0;
      const percentual = Math.round((c.finalizadas / c.total) * 100) || 0;

      return {
        ...c,
        devolucoes: totalDevolucaoRegistrada,
        reentregas: totalReentregaRegistrada,
        temDevolucao,
        temReentrega,
        percentual,
        pctEntregues,
        pctParciais,
        pctDevolucoes,
        pctReentregas,
        status: c.pendentes === 0 ? 'Retornando' : 'Em Rota'
      };
    });

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
      comDevolucao: carros.filter(c => c.temDevolucao || c.devolucoes > 0).length,
      totalCarros: carros.length
    };

    return { carros, totais };
  }, [entregas, devolucoes, dataSelecionada]);

  const retornosDoDia = useMemo(() => {
    // Pegamos as devoluções que foram geradas no dia selecionado (d.data é string ISO ou YYYY-MM-DD)
    const doDia = (devolucoes || []).filter(d => {
      const dataDev = d.data ? (d.data.length >= 10 ? d.data.slice(0, 10) : d.data) : '';
      return dataDev === dataSelecionada;
    });
    
    const agrupado = {};
    doDia.forEach(d => {
      const p = (d.placa || '').trim().toUpperCase() || 'SEM PLACA';
      if (!agrupado[p]) agrupado[p] = 0;
      agrupado[p] += 1;
    });

    return Object.entries(agrupado).map(([placa, qtd]) => ({ placa, qtd }));
  }, [devolucoes, dataSelecionada]);

  return (
    <div className="space-y-3 w-full pb-20">
      {/* Header com Seletor de Data (Rótulo Status da Frota removido) */}
      <div className="flex justify-between items-center mb-1">
        {/* Legenda de Cores da Barra */}
        <div className="flex items-center gap-2.5 text-[10px] text-text-tertiary flex-wrap">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success"></span> Entregue</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-danger"></span> Devolução</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500"></span> Reentrega</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-background-tertiary border border-border-secondary"></span> Pendente</span>
        </div>

        <div className="flex items-center gap-2 bg-background-secondary border border-border-secondary px-2.5 py-1.5 rounded-xl shadow-sm ml-auto">
          <Calendar size={13} className="text-info" />
          <input 
            type="date"
            value={dataSelecionada}
            onChange={(e) => {
              if(e.target.value) setGlobalFilters({ data: e.target.value });
            }}
            className="text-xs font-bold text-text-primary bg-transparent border-none p-0 focus:outline-none cursor-pointer"
          />
        </div>
      </div>

      {/* Resumo / Contadores do Topo (3 cards incluindo Carros com Devolução) */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
        <div className="glass-panel p-3 sm:p-4 rounded-xl text-center border-b-4 border-warning shadow-sm">
          <Clock size={18} className="mx-auto mb-1 text-warning" />
          <p className="text-2xl sm:text-3xl font-black text-text-primary">{frotaStats.totais.emRota}</p>
          <p className="text-[9px] sm:text-[10px] uppercase font-bold text-text-tertiary">Carros na Rua</p>
        </div>
        <div className="glass-panel p-3 sm:p-4 rounded-xl text-center border-b-4 border-success shadow-sm">
          <CheckCircle size={18} className="mx-auto mb-1 text-success" />
          <p className="text-2xl sm:text-3xl font-black text-text-primary">{frotaStats.totais.retornando}</p>
          <p className="text-[9px] sm:text-[10px] uppercase font-bold text-text-tertiary">Carros Retornando</p>
        </div>
        <div className="glass-panel p-3 sm:p-4 rounded-xl text-center border-b-4 border-danger shadow-sm">
          <RotateCcw size={18} className="mx-auto mb-1 text-danger" />
          <p className="text-2xl sm:text-3xl font-black text-danger">{frotaStats.totais.comDevolucao}</p>
          <p className="text-[9px] sm:text-[10px] uppercase font-bold text-text-tertiary">Com Devolução</p>
        </div>
      </div>

      {/* Alerta de Placas com Retorno */}
      {retornosDoDia.length > 0 && (
        <div className="mb-3 glass-panel p-2.5 sm:p-3 rounded-xl border-l-4 border-danger bg-danger/5">
          <h3 className="text-xs font-bold text-danger uppercase flex items-center gap-1.5 mb-1.5">
            <AlertTriangle size={14} /> Atenção: Retorno de Mercadoria
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {retornosDoDia.map(carro => (
              <div key={`retorno-${carro.placa}`} className="bg-danger/10 border border-danger/20 px-2 py-1 rounded-lg flex items-center gap-1.5">
                <span className="font-bold text-danger text-xs">{carro.placa}</span>
                <span className="text-[10px] bg-danger text-white px-1.5 py-0.2 rounded-full font-bold">
                  {carro.qtd} {carro.qtd === 1 ? 'ocorrência' : 'ocorrências'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid de Carros (2 colunas no Mobile) */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3.5 pb-20">
        {frotaStats.carros.length === 0 ? (
          <div className="col-span-full text-center text-text-tertiary py-8 glass-panel rounded-xl">
            <Truck className="mx-auto h-10 w-10 mb-2 opacity-50" />
            <p className="text-xs">Nenhuma placa com entregas registradas para esta data.</p>
          </div>
        ) : (
          frotaStats.carros.map(carro => {
            const motInfo = (motoristas || []).find(m => m.placa === carro.placa);
            return (
              <div 
                key={carro.placa} 
                className={cn(
                  "glass-panel p-2.5 sm:p-3.5 rounded-xl transition-all border-l-4 flex flex-col justify-between shadow-sm",
                  carro.status === 'Retornando' ? 'border-success' : 'border-warning',
                  carro.temDevolucao && 'ring-1 ring-danger/20'
                )}
              >
                <div>
                  {/* Topo do Card: Placa e Status */}
                  <div className="flex justify-between items-start gap-1 mb-2">
                    <div>
                      <span className="text-xs sm:text-sm font-black bg-background-secondary px-2 py-0.5 rounded-md border border-border-tertiary shadow-sm tracking-wide block">
                        {carro.placa}
                      </span>
                      <span className={cn(
                        "text-[9px] font-bold uppercase px-1.5 py-0.2 rounded-full mt-1 inline-block",
                        carro.status === 'Retornando' ? "text-success bg-success/10" : "text-warning bg-warning/10"
                      )}>
                        {carro.status}
                      </span>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className={cn(
                        "text-lg sm:text-xl font-black leading-none block",
                        carro.pendentes === 0 ? "text-success" : "text-text-primary"
                      )}>
                        {carro.pendentes}
                      </span>
                      <span className="text-[9px] uppercase font-bold text-text-tertiary leading-none">
                        {carro.pendentes === 0 ? 'Concluído' : 'Faltam'}
                      </span>
                    </div>
                  </div>

                  {/* Motorista */}
                  <div className="flex items-center justify-between my-2 p-1.5 bg-background-primary rounded-lg border border-border-tertiary text-[11px] gap-1">
                    <div className="flex items-center min-w-0 flex-1">
                      <User size={12} className="text-info flex-shrink-0 mr-1" />
                      <span className="font-medium text-text-secondary truncate text-[10px] sm:text-xs" title={motInfo?.nome || 'Motorista não cadastrado'}>
                        {motInfo?.nome ? motInfo.nome.split(' ')[0] : 'Sem cadastro'}
                      </span>
                      {motInfo?.whatsapp && (
                        <a 
                          href={`https://wa.me/55${motInfo.whatsapp.replace(/\D/g, '')}`} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-success hover:text-success/80 ml-1 p-0.5"
                          title="WhatsApp"
                        >
                          <Phone size={11} />
                        </a>
                      )}
                    </div>
                    <button 
                      onClick={() => setMotoristaEditando({ placa: carro.placa, ...motInfo })} 
                      className="p-0.5 text-text-tertiary hover:text-info bg-background-secondary rounded flex-shrink-0"
                      title="Editar motorista"
                    >
                      <Edit2 size={11} />
                    </button>
                  </div>
                </div>

                {/* Seção da Barra de Progresso Segmentada */}
                <div className="mt-2 pt-1 border-t border-border-secondary/50">
                  <div className="flex justify-between text-[10px] font-bold text-text-secondary mb-1">
                    <span>{carro.finalizadas}/{carro.total}</span>
                    <span className="text-text-primary">{carro.percentual}%</span>
                  </div>

                  {/* Barra Segmentada Multi-cor */}
                  <div className="w-full bg-background-secondary rounded-full h-2 sm:h-2.5 overflow-hidden border border-border-tertiary flex">
                    {carro.pctEntregues > 0 && (
                      <div 
                        className="bg-success h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                        style={{ width: `${carro.pctEntregues}%` }}
                        title={`Entregas concluídas: ${carro.entregues}`}
                      />
                    )}
                    {carro.pctParciais > 0 && (
                      <div 
                        className="bg-info h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                        style={{ width: `${carro.pctParciais}%` }}
                        title={`Entregas parciais: ${carro.parciais}`}
                      />
                    )}
                    {carro.pctDevolucoes > 0 && (
                      <div 
                        className="bg-danger h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                        style={{ width: `${carro.pctDevolucoes}%` }}
                        title={`Devoluções: ${carro.devolucoes}`}
                      />
                    )}
                    {carro.pctReentregas > 0 && (
                      <div 
                        className="bg-purple-500 h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                        style={{ width: `${carro.pctReentregas}%` }}
                        title={`Reentregas: ${carro.reentregas}`}
                      />
                    )}
                  </div>

                  {/* Badges de Resumo Rápido da Barra */}
                  <div className="flex flex-wrap gap-1 mt-1.5 text-[9px] font-semibold">
                    <span className="px-1 py-0.2 rounded bg-success/10 text-success">
                      {carro.entregues} ok
                    </span>
                    {carro.devolucoes > 0 && (
                      <span className="px-1 py-0.2 rounded bg-danger/10 text-danger font-bold">
                        {carro.devolucoes} dev
                      </span>
                    )}
                    {carro.reentregas > 0 && (
                      <span className="px-1 py-0.2 rounded bg-purple-500/10 text-purple-400 font-bold">
                        {carro.reentregas} reent
                      </span>
                    )}
                    {carro.parciais > 0 && (
                      <span className="px-1 py-0.2 rounded bg-info/10 text-info">
                        {carro.parciais} parc
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <PerfilMotoristaModal
        isOpen={!!motoristaEditando}
        dadosIniciais={motoristaEditando}
        onClose={() => setMotoristaEditando(null)}
        onSave={async (dados) => {
          if (motoristaEditando?.placa) {
            await atualizarMotoristaAdmin(motoristaEditando.placa, dados);
          }
          setMotoristaEditando(null);
        }}
      />
    </div>
  );
}
