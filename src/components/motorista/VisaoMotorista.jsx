import { useState, useMemo, useRef } from 'react';
import { format, isBefore, parseISO, startOfDay } from 'date-fns';
import { Truck, MapPin, Package as PackageIcon, User, AlertTriangle, Calendar, Filter, ChevronDown, ChevronUp, FileText, Hash, Camera, CheckCircle } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { STATUS_OPTIONS } from '../../data/mockData';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/utils';
import { CargaSelectorModal } from '../ui/CargaSelectorModal';
import { DevolucaoModal } from '../ui/DevolucaoModal';
import { SolicitacaoDespesaModal } from './SolicitacaoDespesaModal';
import { DollarSign } from 'lucide-react';

export function VisaoMotorista() {
  const { currentUser, entregas, despesas, atualizarStatusEntrega, cargasFinalizadas, finalizarCarga, registrarDevolucao, solicitarDespesa } = useStore();
  
  const cargasDisponiveis = useMemo(() => {
    const map = new Map();
    entregas.forEach(e => {
      if (e.placa !== currentUser.placa) return;
      const key = `${e.data}|${e.carga || 'Sem Carga'}`;
      if (!map.has(key)) map.set(key, { data: e.data, carga: e.carga || 'Sem Carga' });
    });
    return Array.from(map.values()).sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
  }, [entregas, currentUser]);

  const [filtroDiaCarga, setFiltroDiaCarga] = useState(() => {
    const hoje = format(new Date(), 'yyyy-MM-dd');
    const hojeNãoFinalizadas = cargasDisponiveis.filter(c => c.data === hoje && !cargasFinalizadas.some(cf => cf.carga === c.carga && cf.data === c.data));
    if (hojeNãoFinalizadas.length > 0) return `${hojeNãoFinalizadas[0].data}|${hojeNãoFinalizadas[0].carga}`;
    if (cargasDisponiveis.length > 0) return `${cargasDisponiveis[0].data}|${cargasDisponiveis[0].carga}`;
    return '';
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filtroStatusVisao, setFiltroStatusVisao] = useState('Em Aberto');
  
  const [expandidoId, setExpandidoId] = useState(null);
  const [clientesExpandidos, setClientesExpandidos] = useState({});
  const [devolucaoEmAndamento, setDevolucaoEmAndamento] = useState(null);
  const [modalDespesaOpen, setModalDespesaOpen] = useState(false);
  const fileInputRef = useRef(null);

  const minhasDespesas = despesas.filter(d => d.motorista_placa === currentUser.placa);

  const [dataSelecionada, cargaSelecionada] = filtroDiaCarga ? filtroDiaCarga.split('|') : ['', ''];
  const isCargaFinalizada = cargasFinalizadas.some(cf => cf.carga === cargaSelecionada && cf.data === dataSelecionada);

  const entregasDaCargaAtual = useMemo(() => {
    if (!filtroDiaCarga) return [];
    return entregas.filter(e => {
      if (e.placa !== currentUser.placa) return false;
      return e.data === dataSelecionada && (e.carga || 'Sem Carga') === cargaSelecionada;
    });
  }, [entregas, filtroDiaCarga, currentUser, dataSelecionada, cargaSelecionada]);

  const todosFinalizadosNaCarga = entregasDaCargaAtual.length > 0 && entregasDaCargaAtual.every(e => 
    !['Pendente', 'No cliente', 'Descarregando'].includes(e.status)
  );

  const entregasFiltradas = useMemo(() => {
    if (!filtroDiaCarga) return [];

    return entregas.filter(e => {
      if (e.placa !== currentUser.placa) return false;
      if (e.status === 'No estoque') return false;

      const isDataCargaCorreta = e.data === dataSelecionada && (e.carga || 'Sem Carga') === cargaSelecionada;
      
      const dataIso = e.data ? parseISO(e.data) : new Date();
      const isAtrasadaPendente = e.data ? isBefore(dataIso, startOfDay(new Date())) && 
        !['Entrega total', 'Entrega parcial', 'Devolução total', 'Reentrega'].includes(e.status) : false;

      const isRotaDestaAtrasadaFinalizada = cargasFinalizadas.some(cf => cf.carga === (e.carga||'Sem Carga') && cf.data === e.data);

      if (!isDataCargaCorreta && (!isAtrasadaPendente || isRotaDestaAtrasadaFinalizada)) return false;

      const status = e.status;
      const finalizadas = ['Entrega total', 'Entrega parcial', 'Devolução total', 'Reentrega'];

      switch (filtroStatusVisao) {
        case 'Em Aberto': return !finalizadas.includes(status) || isAtrasadaPendente;
        case 'Pendente': return status === 'Pendente' || status === 'Carga parada';
        case 'No cliente': return status === 'No cliente' || status === 'Descarregando';
        case 'Entregue': return status === 'Entrega total';
        case 'Devolução': return status === 'Devolução total' || status === 'Entrega parcial';
        case 'Reentrega': return status === 'Reentrega';
        default: return true;
      }
    });
  }, [entregas, filtroDiaCarga, filtroStatusVisao, currentUser, dataSelecionada, cargaSelecionada, cargasFinalizadas]);

  const clientesAgrupados = useMemo(() => {
    const map = new Map();
    entregasFiltradas.forEach(entrega => {
      const key = `${entrega.codCliente || ''}-${entrega.cliente}`;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          codCliente: entrega.codCliente,
          cliente: entrega.cliente,
          bairro: entrega.bairro,
          entregas: []
        });
      }
      map.get(key).entregas.push(entrega);
    });
    
    const result = Array.from(map.values());
    
    result.forEach(grupo => {
      grupo.entregas.sort((a, b) => (Number(a.nota) || 0) - (Number(b.nota) || 0));
    });

    return result.sort((a, b) => {
      const minA = a.entregas[0] ? (Number(a.entregas[0].nota) || 0) : 0;
      const minB = b.entregas[0] ? (Number(b.entregas[0].nota) || 0) : 0;
      return minA - minB;
    });
  }, [entregasFiltradas]);

  const stats = useMemo(() => {
    return {
      total: entregasDaCargaAtual.length,
      'Em Aberto': entregasDaCargaAtual.filter(e => !['Entrega total', 'Entrega parcial', 'Devolução total', 'Reentrega'].includes(e.status)).length,
      'Pendente': entregasDaCargaAtual.filter(e => ['Pendente', 'Carga parada'].includes(e.status)).length,
      'No cliente': entregasDaCargaAtual.filter(e => ['No cliente', 'Descarregando'].includes(e.status)).length,
      'Entregue': entregasDaCargaAtual.filter(e => ['Entrega total'].includes(e.status)).length,
      'Devolução': entregasDaCargaAtual.filter(e => ['Devolução total', 'Entrega parcial'].includes(e.status)).length,
      'Reentrega': entregasDaCargaAtual.filter(e => ['Reentrega'].includes(e.status)).length,
    };
  }, [entregasDaCargaAtual]);

  const toggleDetalhes = (id) => setExpandidoId(expandidoId === id ? null : id);
  const toggleCliente = (id) => setClientesExpandidos(prev => ({...prev, [id]: !prev[id]}));

  const handleCaptureFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        finalizarCarga(cargaSelecionada, dataSelecionada, dataUrl);
        alert('Rota finalizada com sucesso! Canhoteira salva.');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleStatusChange = (entrega, novoStatus) => {
    if (novoStatus === 'Devolução total' || novoStatus === 'Entrega parcial') {
      const tipo = novoStatus === 'Devolução total' ? 'Total' : 'Parcial';
      setDevolucaoEmAndamento({ entrega, tipo });
    } else {
      atualizarStatusEntrega(entrega.id, novoStatus);
    }
  };

  return (
    <div className="space-y-4 pb-20">
      <CargaSelectorModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        cargasDisponiveis={cargasDisponiveis}
        onSelect={(value) => {
          setFiltroDiaCarga(value);
          setIsModalOpen(false);
        }}
      />

      <button 
        onClick={() => setIsModalOpen(true)}
        className={cn(
          "glass-panel p-3 rounded-xl flex items-center space-x-3 w-full active:scale-[0.98] transition-transform",
          isCargaFinalizada ? "border-success/50" : ""
        )}
      >
        <div className={cn(
          "p-2 rounded-lg",
          isCargaFinalizada ? "bg-success/10 text-success" : "bg-info/10 text-info"
        )}>
          {isCargaFinalizada ? <CheckCircle size={20} /> : <Calendar size={20} />}
        </div>
        <div className="flex-1 text-left">
          {filtroDiaCarga ? (
            <>
              <div className="text-sm font-bold text-text-primary">
                {format(parseISO(dataSelecionada), 'dd/MM/yyyy')}
              </div>
              <div className="text-xs text-text-secondary mt-0.5 font-medium flex justify-between pr-2">
                <span>Carga: {cargaSelecionada}</span>
                {isCargaFinalizada && <span className="text-success">Finalizada</span>}
              </div>
            </>
          ) : (
            <div className="text-sm font-bold text-text-tertiary">Nenhuma carga</div>
          )}
        </div>
        <ChevronDown size={20} className="text-text-tertiary" />
      </button>

      {/* Seção de Custos / Despesas rápidas */}
      <div className="flex gap-2">
        <button
          onClick={() => setModalDespesaOpen(true)}
          className="flex-1 glass-panel p-3 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform text-sm font-bold text-info hover:bg-info/5 border border-info/20 shadow-sm"
        >
          <DollarSign size={18} />
          Solicitar Reembolso
        </button>
      </div>

      {minhasDespesas.length > 0 && (
        <div className="glass-panel p-3 rounded-xl border border-border-secondary">
           <h4 className="text-xs font-bold text-text-tertiary uppercase mb-2">Minhas Solicitações Recentes</h4>
           <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
             {minhasDespesas.slice().reverse().slice(0, 3).map(d => (
               <div key={d.id} className="flex flex-col text-xs p-2 bg-background-secondary rounded-lg border border-border-tertiary">
                 <div className="flex justify-between items-center mb-1">
                   <div>
                     <span className="block font-bold text-text-primary">{d.tipo}</span>
                     <span className="text-[10px] text-text-tertiary font-medium">R$ {d.valor.toFixed(2)}</span>
                   </div>
                   <Badge status={d.status}>{d.status}</Badge>
                 </div>
                 {d.notas_vinculadas && d.notas_vinculadas.length > 0 && (
                   <div className="flex flex-wrap gap-1 mt-1">
                     {d.notas_vinculadas.map(nota => (
                       <span key={nota} className="inline-flex items-center text-[9px] text-text-secondary bg-background-primary px-1 rounded border border-border-tertiary font-bold">
                         NF: {nota}
                       </span>
                     ))}
                   </div>
                 )}
               </div>
             ))}
           </div>
        </div>
      )}

      <div className="flex space-x-2 overflow-x-auto hide-scrollbar pb-1">
        {['Em Aberto', 'Pendente', 'No cliente', 'Entregue', 'Devolução', 'Reentrega'].map(visao => (
          <button
            key={visao}
            onClick={() => setFiltroStatusVisao(visao)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors",
              filtroStatusVisao === visao 
                ? "bg-info text-white border-info" 
                : "bg-background-primary text-text-secondary border-border-tertiary hover:bg-background-secondary"
            )}
          >
            {visao} ({stats[visao] || 0})
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {clientesAgrupados.length === 0 ? (
          <div className="text-center text-text-tertiary py-8 glass-panel rounded-xl">
            <Filter className="mx-auto h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm">Nenhuma entrega para este filtro.</p>
          </div>
        ) : (
          clientesAgrupados.map(grupo => {
            const pesoTotal = grupo.entregas.reduce((acc, curr) => acc + (Number(curr.peso) || 0), 0);
            const isAtrasada = grupo.entregas.some(e => e.data && isBefore(parseISO(e.data), startOfDay(new Date())));
            const isClienteExpanded = clientesExpandidos[grupo.id] !== false; // Default: expanded, but let's change it to default collapsed if length > 1? Actually, if we want it collapsed to save space, let's default to false.
            const isExpanded = !!clientesExpandidos[grupo.id];

            return (
              <div key={grupo.id} className={cn(
                "glass-panel rounded-xl transition-all overflow-hidden border-2",
                isAtrasada ? 'border-danger/50 shadow-[0_0_8px_rgba(239,68,68,0.2)]' : 'border-border-secondary'
              )}>
                {/* Cabeçalho do Cliente */}
                <div 
                  onClick={() => toggleCliente(grupo.id)}
                  className="bg-background-secondary/50 p-4 border-b border-border-secondary flex justify-between items-start cursor-pointer hover:bg-background-secondary/70 transition-colors"
                >
                   <div>
                      <h3 className="font-bold text-text-primary text-base leading-tight mb-1">{grupo.cliente}</h3>
                      <div className="flex flex-wrap gap-2 text-xs text-text-secondary mt-2">
                        <div className="flex items-center"><Hash size={14} className="mr-1 opacity-70 text-info" /> {grupo.codCliente || 'S/N'}</div>
                        <div className="flex items-center"><MapPin size={14} className="mr-1 opacity-70 text-warning" /> {grupo.bairro}</div>
                      </div>
                   </div>
                   <div className="text-right pl-2 shrink-0 flex flex-col items-end">
                      <span className="block font-black text-info text-lg leading-none">{pesoTotal.toFixed(1)} <span className="text-[10px] font-bold text-text-tertiary">kg</span></span>
                      <span className="text-[10px] uppercase font-bold text-text-tertiary mt-1">{grupo.entregas.length} {grupo.entregas.length === 1 ? 'nota' : 'notas'}</span>
                      <div className="mt-2 bg-background-primary p-1 rounded-md border border-border-tertiary">
                        {isExpanded ? <ChevronUp size={16} className="text-text-primary" /> : <ChevronDown size={16} className="text-text-primary" />}
                      </div>
                   </div>
                </div>

                {/* Lista de Notas Fiscais */}
                {isExpanded && (
                  <div className="p-3 space-y-3 bg-background-primary/30">
                  {grupo.entregas.map(entrega => {
                    const isExpanded = expandidoId === entrega.id;
                    const entregaAtrasada = entrega.data ? isBefore(parseISO(entrega.data), startOfDay(new Date())) : false;

                    return (
                      <div key={entrega.id} className={cn(
                        "bg-background-secondary rounded-lg p-3 border",
                        entregaAtrasada ? 'border-danger/30 shadow-sm' : 'border-border-tertiary'
                      )}>
                         {entregaAtrasada && (
                           <div className="flex items-center text-danger text-[10px] mb-2 font-bold uppercase tracking-wider">
                             <AlertTriangle size={12} className="mr-1 flex-shrink-0" />
                             Nota Antiga ({format(parseISO(entrega.data), 'dd/MM/yyyy')})
                           </div>
                         )}

                         {/* Header da Nota */}
                         <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center space-x-2">
                               <h4 className="font-bold text-text-primary text-sm">NF: {entrega.nota}</h4>
                               <Badge status={entrega.status}>{entrega.status}</Badge>
                            </div>
                            <span className="font-bold text-text-primary text-xs">{entrega.peso.toFixed(1)} kg</span>
                         </div>
                         
                         {/* Outros dados (Pedido, RCA) */}
                         <div className="flex gap-4 text-[11px] text-text-tertiary mb-3 font-medium">
                            <div className="flex items-center"><FileText size={12} className="mr-1 opacity-70" /> Ped: {entrega.pedido || 'N/A'}</div>
                            <div className="flex items-center"><User size={12} className="mr-1 opacity-70" /> RCA: {entrega.rca || 'N/A'}</div>
                         </div>

                         {/* Toggle Detalhes Itens */}
                          <div className="mb-3">
                            <button 
                              onClick={() => toggleDetalhes(entrega.id)}
                              className="flex items-center justify-between w-full text-xs font-bold text-text-secondary bg-background-primary rounded-lg px-3 py-2 hover:bg-border-tertiary transition-colors border border-border-secondary"
                            >
                              <span className="flex items-center">
                                <PackageIcon size={14} className="mr-2 text-info" /> 
                                Ver Itens {entrega.itens?.length ? `(${entrega.itens.length})` : ''}
                              </span>
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                            
                            {isExpanded && (
                              <div className="mt-2 bg-background-primary rounded-lg p-3 space-y-2 border border-border-secondary">
                                {entrega.itens && entrega.itens.length > 0 ? (
                                  entrega.itens.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-xs border-b border-border-tertiary last:border-0 pb-2 last:pb-0">
                                      <div className="flex-1 pr-2">
                                        <span className="font-semibold block text-text-primary">{item.descricao}</span>
                                        <span className="text-text-tertiary text-[10px] font-medium">Cód: {item.codigo}</span>
                                      </div>
                                      <div className="text-right flex-shrink-0">
                                        <span className="block font-bold text-text-primary">{item.qtd} cx</span>
                                        <span className="text-text-tertiary text-[10px] font-medium">{item.peso.toFixed(3)} kg</span>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-[11px] text-text-tertiary text-center py-2 font-medium">Sem itens detalhados</div>
                                )}

                                {entrega.historico && entrega.historico.length > 0 && (
                                  <div className="mt-4 pt-3 border-t border-border-tertiary">
                                    <h5 className="text-[10px] uppercase font-bold text-text-tertiary mb-2 flex items-center gap-1">
                                      <FileText size={10} /> Histórico de Alterações
                                    </h5>
                                    <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                                      {entrega.historico.map((h, hIdx) => (
                                        <div key={hIdx} className="text-[11px] pl-2 border-l-2 border-border-tertiary">
                                          <div className="flex justify-between items-start mb-0.5">
                                            <span className="font-semibold text-text-primary">{h.status}</span>
                                            <span className="text-[9px] text-text-tertiary whitespace-nowrap ml-2">
                                              {new Date(h.data).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                          </div>
                                          <div className="text-text-secondary text-[10px] leading-tight mt-0.5">
                                            <span className="font-medium mr-1 text-text-primary">{h.role}:</span>
                                            {h.observacao}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Ações */}
                          <div className="pt-3 border-t border-border-secondary">
                            <label className="text-[10px] uppercase font-bold text-text-tertiary block mb-1.5">Status da Nota</label>
                            <select 
                              value={entrega.status}
                              onChange={(e) => handleStatusChange(entrega, e.target.value)}
                              disabled={isCargaFinalizada}
                              className="w-full bg-background-primary border border-border-secondary rounded-lg px-3 py-2.5 text-sm text-text-primary font-bold focus:ring-2 focus:ring-info disabled:opacity-50"
                            >
                              {STATUS_OPTIONS.map(opt => (
                                <option key={opt} value={opt} className="bg-slate-900 text-white">{opt}</option>
                              ))}
                            </select>
                          </div>
                      </div>
                    );
                  })}
                </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {todosFinalizadosNaCarga && !isCargaFinalizada && filtroDiaCarga && (
        <div className="fixed bottom-[80px] left-0 right-0 p-4 animate-in slide-in-from-bottom-10 flex justify-center z-40 pointer-events-none">
          <div className="bg-background-primary/90 p-1 rounded-2xl shadow-xl backdrop-blur-md pointer-events-auto border border-success/20 w-full max-w-md mx-auto">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-success hover:bg-success/90 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-lg shadow-success/20"
            >
              <Camera className="mr-3" size={24} />
              Finalizar Rota e Fotografar Canhoteira
            </button>
          </div>
        </div>
      )}

      <input 
        type="file" 
        accept="image/*" 
        capture="environment" 
        ref={fileInputRef} 
        onChange={handleCaptureFile}
        className="hidden" 
      />

      {devolucaoEmAndamento && (
        <DevolucaoModal 
          isOpen={true}
          entrega={devolucaoEmAndamento.entrega}
          tipo={devolucaoEmAndamento.tipo}
          onClose={() => setDevolucaoEmAndamento(null)}
          onConfirm={(tipo, itens, motivo) => {
            registrarDevolucao(devolucaoEmAndamento.entrega.id, tipo, itens, motivo);
            setDevolucaoEmAndamento(null);
          }}
        />
      )}

      <SolicitacaoDespesaModal 
        isOpen={modalDespesaOpen}
        entregasDisponiveis={entregasDaCargaAtual}
        onClose={() => setModalDespesaOpen(false)}
        onConfirm={(dados) => {
          solicitarDespesa(dados);
          setModalDespesaOpen(false);
          alert('Solicitação enviada com sucesso!');
        }}
      />
    </div>
  );
}
