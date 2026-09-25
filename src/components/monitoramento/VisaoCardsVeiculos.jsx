import { useState, useMemo, useRef } from 'react';
import { 
  Truck, 
  MapPin, 
  User, 
  Clock, 
  Timer, 
  CheckCircle2, 
  AlertTriangle, 
  Eye,
  EyeOff,
  Bell, 
  ExternalLink, 
  Flag, 
  Package as PackageIcon,
  Navigation,
  Building2,
  X
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/utils';
import { useStore } from '../../store/useStore';

const formatarHora = (isoStr) => {
  if (!isoStr) return '--:--';
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
};

const formatarDataHora = (isoStr) => {
  if (!isoStr) return '--/-- --:--';
  try {
    const d = new Date(isoStr);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    const hora = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${ano} ${hora}:${min}`;
  } catch {
    return '--/-- --:--';
  }
};

export function VisaoCardsVeiculos({
  entregasFiltradas = []
}) {
  const { motoristas = [] } = useStore();
  const [cardsExpandidos, setCardsExpandidos] = useState({});
  const [activeTooltip, setActiveTooltip] = useState(null); // { veiculoKey, parada, idx }
  const timeoutRef = useRef(null);

  const toggleExpandir = (placaCargaKey) => {
    setCardsExpandidos(prev => ({
      ...prev,
      [placaCargaKey]: !prev[placaCargaKey]
    }));
    // Se estava aberto e fecha, fecha também o tooltip ativo daquele card
    if (cardsExpandidos[placaCargaKey] && activeTooltip?.veiculoKey === placaCargaKey) {
      setActiveTooltip(null);
    }
  };

  const handleMouseEnter = (veiculoKey, parada, idx) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setActiveTooltip({ veiculoKey, parada, idx });
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setActiveTooltip(null);
    }, 200);
  };

  const handleTooltipMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const handleTooltipMouseLeave = () => {
    setActiveTooltip(null);
  };

  const toggleClickTooltip = (veiculoKey, parada, idx) => {
    if (activeTooltip?.veiculoKey === veiculoKey && activeTooltip?.idx === idx) {
      setActiveTooltip(null);
    } else {
      setActiveTooltip({ veiculoKey, parada, idx });
    }
  };

  const finalizadasSet = useMemo(() => new Set(['Entrega total', 'Entrega parcial', 'Devolução total', 'Reentrega', 'Carga parada']), []);

  // Agrupamento dos veículos a partir das entregas filtradas
  const veiculosAgrupados = useMemo(() => {
    const map = new Map();

    entregasFiltradas.forEach(e => {
      const placa = (e.placa || 'SEM PLACA').trim().toUpperCase();
      const carga = (e.carga || 'SEM CARGA').trim();
      const data = e.data || '';
      const key = `${placa}__${carga}__${data}`;

      if (!map.has(key)) {
        // Encontrar motorista cadastrado pela placa
        const motoristaInfo = motoristas.find(m => (m.placa || '').trim().toUpperCase() === placa);
        
        map.set(key, {
          key,
          placa,
          carga,
          data,
          motoristaNome: motoristaInfo?.nome || e.motorista || 'Motorista não informado',
          motoristaTelefone: motoristaInfo?.telefone || '',
          entregas: []
        });
      }

      map.get(key).entregas.push(e);
    });

    const lista = Array.from(map.values()).map(veiculo => {
      const totalNotas = veiculo.entregas.length;
      let finalizadasCount = 0;
      let emAndamentoCount = 0;
      let pendentesCount = 0;
      let devolucoesCount = 0;
      let paradasCount = 0;

      // Agrupamento por cliente (parada)
      const clientesMap = new Map();
      let ultimaAtualizacao = null;
      let ultimoClienteNome = '--';

      veiculo.entregas.forEach(ent => {
        const isFin = finalizadasSet.has(ent.status);
        if (isFin) finalizadasCount++;
        else if (['No cliente', 'Descarregando'].includes(ent.status)) emAndamentoCount++;
        else pendentesCount++;

        if (['Devolução total', 'Entrega parcial'].includes(ent.status)) {
          devolucoesCount++;
        }
        if (ent.status === 'Carga parada') {
          paradasCount++;
        }

        // Rastrear última atualização
        const horaRef = ent.horaSaida || ent.horaChegada || ent.atualizadoEm;
        if (horaRef) {
          if (!ultimaAtualizacao || new Date(horaRef) > new Date(ultimaAtualizacao)) {
            ultimaAtualizacao = horaRef;
            ultimoClienteNome = ent.cliente || ultimoClienteNome;
          }
        }

        const cliKey = `${ent.codCliente || ''}-${ent.cliente || ''}`;
        if (!clientesMap.has(cliKey)) {
          clientesMap.set(cliKey, {
            codCliente: ent.codCliente,
            cliente: ent.cliente,
            bairro: ent.bairro,
            municipio: ent.municipio,
            endereco: ent.endereco,
            notas: [],
            statusGeral: 'Pendente',
            horaChegada: ent.horaChegada || null,
            horaSaida: ent.horaSaida || null,
            tempoMinutos: ent.tempoMinutos || null,
            tempoFormatado: ent.tempoFormatado || null
          });
        }
        const cliObj = clientesMap.get(cliKey);
        cliObj.notas.push(ent);
        if (ent.horaChegada && !cliObj.horaChegada) cliObj.horaChegada = ent.horaChegada;
        if (ent.horaSaida && !cliObj.horaSaida) cliObj.horaSaida = ent.horaSaida;
        if (ent.tempoFormatado) cliObj.tempoFormatado = ent.tempoFormatado;
      });

      // Determinar status consolidado de cada parada de cliente
      const paradas = Array.from(clientesMap.values()).map((parada, idx) => {
        const statuses = parada.notas.map(n => n.status);
        let status = 'Pendente';

        if (statuses.some(s => ['No cliente', 'Descarregando'].includes(s))) {
          status = 'No cliente';
        } else if (statuses.every(s => s === 'Entrega total')) {
          status = 'Entrega total';
        } else if (statuses.some(s => s === 'Carga parada')) {
          status = 'Carga parada';
        } else if (statuses.some(s => ['Devolução total', 'Entrega parcial'].includes(s))) {
          status = 'Devolução';
        } else if (statuses.some(s => finalizadasSet.has(s))) {
          status = 'Parcial Concluído';
        }

        return {
          ...parada,
          ordem: idx + 1,
          statusCalculado: status
        };
      });

      // Se nenhum cliente foi marcado com data, pega o último da lista
      if (ultimoClienteNome === '--' && paradas.length > 0) {
        const concluidas = paradas.filter(p => p.statusCalculado === 'Entrega total' || p.statusCalculado === 'Devolução');
        if (concluidas.length > 0) {
          ultimoClienteNome = concluidas[concluidas.length - 1].cliente;
        } else {
          ultimoClienteNome = paradas[0].cliente;
        }
      }

      const progressoPorcentagem = totalNotas > 0 ? Math.round((finalizadasCount / totalNotas) * 100) : 0;

      return {
        ...veiculo,
        totalNotas,
        finalizadasCount,
        emAndamentoCount,
        pendentesCount,
        devolucoesCount,
        paradasCount,
        progressoPorcentagem,
        ultimaAtualizacao,
        ultimoClienteNome,
        paradas
      };
    });

    // Ordenar: primeiro veículos em andamento (com pendências), depois por placa
    return lista.sort((a, b) => {
      if (a.pendentesCount > 0 && b.pendentesCount === 0) return -1;
      if (a.pendentesCount === 0 && b.pendentesCount > 0) return 1;
      return a.placa.localeCompare(b.placa);
    });
  }, [entregasFiltradas, motoristas, finalizadasSet]);

  if (veiculosAgrupados.length === 0) {
    return (
      <div className="glass-panel p-12 text-center rounded-2xl border border-border-secondary">
        <Truck className="mx-auto h-16 w-16 text-text-tertiary/40 mb-4" />
        <h3 className="text-lg font-bold text-text-primary">Nenhum veículo encontrado</h3>
        <p className="text-sm text-text-tertiary mt-1">Ajuste os filtros de data, placa ou status para visualizar os cards.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full">
      {/* Grid de Cards dos Veículos */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
        {veiculosAgrupados.map((veiculo) => {
          const isExpandido = !!cardsExpandidos[veiculo.key];
          const progresso = veiculo.progressoPorcentagem;
          const temAlerta = veiculo.devolucoesCount > 0 || veiculo.paradasCount > 0;
          const isCardActive = activeTooltip?.veiculoKey === veiculo.key;

          return (
            <div
              key={veiculo.key}
              className={cn(
                "bg-background-secondary border rounded-2xl p-4 shadow-sm transition-all duration-200 flex flex-col justify-between relative",
                isExpandido 
                  ? "border-primary/60 ring-1 ring-primary/30 shadow-md" 
                  : "border-border-secondary hover:border-border-tertiary hover:shadow"
              )}
            >
              {/* Topo do Card: Placa em Destaque + Último Cliente e Data */}
              <div>
                <div className="flex items-start justify-between gap-2">
                  {/* Lado Esquerdo: Placa Gigante & Motorista */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-background-primary border border-border-secondary flex items-center justify-center text-text-primary shadow-inner flex-shrink-0">
                      <Truck size={20} className="text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-black tracking-wider text-text-primary font-mono uppercase bg-background-primary px-2 py-0.5 rounded-lg border border-border-secondary">
                          {veiculo.placa}
                        </span>
                        {veiculo.carga && veiculo.carga !== 'SEM CARGA' && (
                          <span className="text-[11px] font-bold text-text-tertiary bg-background-primary/50 px-1.5 py-0.5 rounded border border-border-secondary/60">
                            Carga: {veiculo.carga}
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-text-secondary mt-1 flex items-center gap-1 truncate max-w-[180px] sm:max-w-[220px]">
                        <User size={12} className="text-text-tertiary flex-shrink-0" />
                        <span className="truncate">{veiculo.motoristaNome}</span>
                      </div>
                    </div>
                  </div>

                  {/* Lado Direito: Último cliente & Última Atualização */}
                  <div className="text-right flex flex-col items-end max-w-[160px] sm:max-w-[200px]">
                    <div className="text-[10px] text-text-tertiary uppercase font-bold tracking-tight">
                      Último cliente:
                    </div>
                    <div 
                      className="text-xs font-bold text-text-primary truncate w-full text-right"
                      title={veiculo.ultimoClienteNome}
                    >
                      {veiculo.ultimoClienteNome}
                    </div>
                    <div className="text-[10px] text-text-tertiary font-medium mt-0.5 flex items-center justify-end gap-1">
                      <Clock size={10} />
                      <span>{veiculo.ultimaAtualizacao ? formatarDataHora(veiculo.ultimaAtualizacao) : '--/-- --:--'}</span>
                    </div>
                  </div>
                </div>

                {/* Linha Central: Progresso, Quantidade e Botão do Olho */}
                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border-secondary/60">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-bold text-text-tertiary uppercase tracking-wider">
                      Progresso
                    </span>
                    <span className={cn(
                      "text-lg font-black tracking-tight",
                      progresso === 100 
                        ? "text-success" 
                        : progresso > 0 
                          ? "text-info" 
                          : "text-text-tertiary"
                    )}>
                      {progresso}%
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-extrabold text-text-secondary font-mono bg-background-primary px-2 py-0.5 rounded-md border border-border-secondary">
                      {veiculo.finalizadasCount}/{veiculo.totalNotas}
                    </span>

                    {temAlerta && (
                      <div 
                        className="relative text-rose-500 animate-bounce"
                        title={veiculo.devolucoesCount > 0 ? `${veiculo.devolucoesCount} devolução(ões)` : 'Carga com ocorrência'}
                      >
                        <Bell size={18} className="fill-rose-500/20" />
                        <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 bg-rose-600 text-white rounded-full text-[9px] font-black flex items-center justify-center">
                          {veiculo.devolucoesCount || '!'}
                        </span>
                      </div>
                    )}

                    {/* Botão do Olho para Detalhes/Ocultar */}
                    <button
                      onClick={() => toggleExpandir(veiculo.key)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1.5 text-xs font-bold",
                        isExpandido
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-background-primary text-text-secondary border-border-secondary hover:text-text-primary hover:bg-border-tertiary"
                      )}
                      title={isExpandido ? "Ocultar rota" : "Visualizar paradas da rota"}
                    >
                      {isExpandido ? <EyeOff size={14} /> : <Eye size={14} />}
                      <span>{isExpandido ? "Ocultar" : "Detalhes"}</span>
                    </button>
                  </div>
                </div>

                {/* Barra Gráfica de Progresso com Caminhão em Trajeto */}
                <div className="mt-2.5 relative pt-2 pb-1">
                  <div className="flex items-center justify-between text-text-tertiary mb-1">
                    <div className="flex items-center gap-1 text-[10px] font-bold">
                      <Building2 size={13} className="text-text-tertiary" />
                      <span>CD</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-bold">
                      <span>FIM</span>
                      <Flag size={13} className={progresso === 100 ? 'text-success' : 'text-text-tertiary'} />
                    </div>
                  </div>

                  {/* Linha da Estrada */}
                  <div className="relative w-full h-2 bg-background-primary rounded-full overflow-visible border border-border-secondary">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500 ease-out",
                        progresso === 100 ? "bg-success" : "bg-emerald-500"
                      )}
                      style={{ width: `${progresso}%` }}
                    />

                    {/* Ícone do Caminhão se movendo sobre a linha */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-500 ease-out text-text-primary bg-background-primary border border-border-secondary rounded-full p-1 shadow-md"
                      style={{ left: `${Math.min(Math.max(progresso, 4), 96)}%` }}
                      title={`${progresso}% concluído`}
                    >
                      <Truck size={13} className={progresso === 100 ? "text-success" : "text-primary"} />
                    </div>
                  </div>
                </div>

                {/* Seção Expandida (Ao Clicar no Olho): Trajeto com Ícones e Pop-up */}
                {isExpandido && (
                  <div className="mt-3 pt-3 border-t border-border-secondary/70 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-text-secondary">
                        <Truck size={13} className="text-primary" />
                        <span className="font-mono">
                          {veiculo.carga && veiculo.carga !== 'SEM CARGA' ? veiculo.carga : 'ROTA'}
                        </span>
                        <span className="text-text-tertiary font-normal">
                          ({veiculo.paradas.length} paradas)
                        </span>
                      </div>
                      <span className="text-[10px] text-text-tertiary italic hidden sm:inline">
                        Passe o mouse nos ícones para ver os detalhes
                      </span>
                    </div>

                    {/* Linha de Ícones Interativos */}
                    <div className="bg-background-primary/90 p-2.5 rounded-xl border border-border-secondary overflow-x-auto hide-scrollbar">
                      <div className="flex items-center gap-2 min-w-max py-0.5">
                        {/* CD Início */}
                        <div 
                          className="flex flex-col items-center gap-0.5 cursor-help group"
                          onMouseEnter={() => handleMouseEnter(veiculo.key, {
                            cliente: 'Centro de Distribuição (Origem)',
                            codCliente: 'CD',
                            statusCalculado: 'Início',
                            bairro: 'Ponto de Partida',
                            notas: []
                          }, -1)}
                          onMouseLeave={handleMouseLeave}
                        >
                          <div className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm">
                            <Building2 size={14} />
                          </div>
                          <span className="text-[8px] font-bold text-text-tertiary">CD</span>
                        </div>

                        {/* Conector */}
                        <div className="w-3 h-0.5 bg-border-tertiary" />

                        {/* Paradas de Clientes */}
                        {veiculo.paradas.map((parada, idx) => {
                          const isConcluida = parada.statusCalculado === 'Entrega total';
                          const isEmAtendimento = parada.statusCalculado === 'No cliente';
                          const isDevolucao = parada.statusCalculado === 'Devolução';
                          const isParada = parada.statusCalculado === 'Carga parada';
                          const isHovered = activeTooltip?.veiculoKey === veiculo.key && activeTooltip?.idx === idx;

                          return (
                            <div key={idx} className="flex items-center gap-2">
                              <button
                                type="button"
                                onMouseEnter={() => handleMouseEnter(veiculo.key, parada, idx)}
                                onMouseLeave={handleMouseLeave}
                                onClick={() => toggleClickTooltip(veiculo.key, parada, idx)}
                                className={cn(
                                  "flex flex-col items-center gap-0.5 group transition-all duration-150 relative focus:outline-none",
                                  isHovered ? "scale-115" : "hover:scale-110"
                                )}
                                title={`#${idx + 1} - ${parada.cliente}`}
                              >
                                <div className={cn(
                                  "w-7 h-7 rounded-full flex items-center justify-center transition-all shadow-sm",
                                  isConcluida 
                                    ? "bg-emerald-500 text-white shadow-emerald-500/20" 
                                    : isEmAtendimento
                                      ? "bg-info text-white ring-4 ring-info/30 animate-pulse"
                                      : isDevolucao
                                        ? "bg-rose-500 text-white shadow-rose-500/20"
                                        : isParada
                                          ? "bg-amber-500 text-white shadow-amber-500/20"
                                          : "bg-background-secondary border border-border-tertiary text-text-tertiary group-hover:border-info group-hover:text-info",
                                  isHovered ? "ring-2 ring-primary ring-offset-1 ring-offset-background-primary" : ""
                                )}>
                                  {isConcluida ? (
                                    <CheckCircle2 size={14} />
                                  ) : isEmAtendimento ? (
                                    <User size={14} />
                                  ) : isDevolucao ? (
                                    <AlertTriangle size={14} />
                                  ) : isParada ? (
                                    <AlertTriangle size={14} />
                                  ) : (
                                    <MapPin size={13} />
                                  )}
                                </div>
                                <span className={cn(
                                  "text-[9px] font-bold tracking-tight",
                                  isHovered ? "text-primary font-black" : "text-text-tertiary group-hover:text-text-primary"
                                )}>
                                  #{idx + 1}
                                </span>
                              </button>

                              {/* Linha conectora até a próxima parada */}
                              <div className={cn(
                                "w-3 h-0.5",
                                isConcluida ? "bg-emerald-500" : "bg-border-tertiary"
                              )} />
                            </div>
                          );
                        })}

                        {/* CD Retorno / Fim */}
                        <div 
                          className="flex flex-col items-center gap-0.5 cursor-help group"
                          onMouseEnter={() => handleMouseEnter(veiculo.key, {
                            cliente: 'Retorno ao Centro de Distribuição',
                            codCliente: 'CD',
                            statusCalculado: progresso === 100 ? 'Finalizado' : 'Pendente Retorno',
                            bairro: 'Ponto Final',
                            notas: []
                          }, 999)}
                          onMouseLeave={handleMouseLeave}
                        >
                          <div className={cn(
                            "w-7 h-7 rounded-full border flex items-center justify-center transition-transform group-hover:scale-110",
                            progresso === 100 
                              ? "bg-emerald-500 text-white border-emerald-500 shadow-emerald-500/20" 
                              : "bg-background-secondary border-border-tertiary text-text-tertiary"
                          )}>
                            <Flag size={13} />
                          </div>
                          <span className="text-[8px] font-bold text-text-tertiary">Fim</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* POP-UP / TOOLTIP ELEGANTE FLUTUANTE (AO PASSAR O MOUSE / CLICAR) */}
              {isExpandido && isCardActive && activeTooltip.parada && (
                <div 
                  className="absolute left-3 right-3 bottom-3 z-30 bg-background-primary/95 backdrop-blur-md border border-primary/40 rounded-xl p-3.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
                  onMouseEnter={handleTooltipMouseEnter}
                  onMouseLeave={handleTooltipMouseLeave}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      {activeTooltip.idx >= 0 && activeTooltip.idx < 900 && (
                        <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                          {activeTooltip.idx + 1}
                        </span>
                      )}
                      <div>
                        <div className="text-xs font-black text-text-primary flex items-center gap-1.5 flex-wrap">
                          <span>
                            {activeTooltip.parada.codCliente && activeTooltip.parada.codCliente !== 'CD' ? `[${activeTooltip.parada.codCliente}] ` : ''}
                            {activeTooltip.parada.cliente}
                          </span>
                        </div>
                        {(activeTooltip.parada.bairro || activeTooltip.parada.municipio) && (
                          <div className="text-[11px] text-text-tertiary mt-0.5 flex items-center gap-1">
                            <MapPin size={11} className="text-primary flex-shrink-0" />
                            <span>
                              {activeTooltip.parada.bairro || ''}
                              {activeTooltip.parada.municipio ? ` - ${activeTooltip.parada.municipio}` : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Badge size="sm" variant={
                        activeTooltip.parada.statusCalculado === 'Entrega total' ? 'success' :
                        activeTooltip.parada.statusCalculado === 'No cliente' ? 'info' :
                        activeTooltip.parada.statusCalculado === 'Devolução' ? 'danger' :
                        activeTooltip.parada.statusCalculado === 'Carga parada' ? 'warning' : 'default'
                      }>
                        {activeTooltip.parada.statusCalculado}
                      </Badge>
                      <button 
                        onClick={() => setActiveTooltip(null)}
                        className="text-text-tertiary hover:text-text-primary p-0.5 rounded"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Tempos de Chegada, Saída e Estadia */}
                  {(activeTooltip.parada.horaChegada || activeTooltip.parada.horaSaida || activeTooltip.parada.tempoFormatado) && (
                    <div className="mt-2 pt-2 border-t border-border-secondary/70 flex flex-wrap items-center gap-2.5 text-[11px] bg-background-secondary/60 px-2 py-1 rounded-lg">
                      {activeTooltip.parada.horaChegada && (
                        <div className="flex items-center gap-1 text-text-secondary">
                          <Clock size={11} className="text-info" />
                          <span>Chegada: <strong>{formatarHora(activeTooltip.parada.horaChegada)}</strong></span>
                        </div>
                      )}
                      {activeTooltip.parada.horaSaida && (
                        <div className="flex items-center gap-1 text-text-secondary">
                          <Clock size={11} className="text-success" />
                          <span>Saída: <strong>{formatarHora(activeTooltip.parada.horaSaida)}</strong></span>
                        </div>
                      )}
                      {activeTooltip.parada.tempoFormatado && (
                        <div className="flex items-center gap-1 text-primary font-black">
                          <Timer size={12} />
                          <span>Estadia: {activeTooltip.parada.tempoFormatado}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Notas Fiscais da Parada */}
                  {activeTooltip.parada.notas && activeTooltip.parada.notas.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border-secondary/70 space-y-1">
                      <div className="text-[10px] font-bold text-text-tertiary uppercase flex items-center justify-between">
                        <span>Notas Fiscais ({activeTooltip.parada.notas.length}):</span>
                        <span className="font-semibold text-text-secondary">
                          Total: R$ {activeTooltip.parada.notas.reduce((acc, n) => acc + (Number(n.valor) || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="max-h-24 overflow-y-auto space-y-1 pr-0.5">
                        {activeTooltip.parada.notas.map(n => (
                          <div 
                            key={n.id}
                            className="flex items-center justify-between bg-background-secondary p-1 rounded-md border border-border-secondary text-[11px]"
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <PackageIcon size={11} className="text-text-tertiary flex-shrink-0" />
                              <span className="font-mono font-bold text-text-primary">NF {n.nota}</span>
                              {n.valor && (
                                <span className="text-text-tertiary text-[10px]">
                                  R$ {Number(n.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              )}
                            </div>
                            <span className={cn(
                              "text-[9px] font-bold px-1.5 py-0.2 rounded",
                              n.status === 'Entrega total' ? "bg-emerald-500/10 text-emerald-500" :
                              n.status === 'No cliente' ? "bg-info/10 text-info" :
                              ['Devolução total', 'Entrega parcial'].includes(n.status) ? "bg-rose-500/10 text-rose-500" : "bg-border-tertiary text-text-secondary"
                            )}>
                              {n.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Link direto para o Google Maps */}
                  {(activeTooltip.parada.endereco || activeTooltip.parada.cliente) && (
                    <div className="mt-2.5 pt-2 border-t border-border-secondary/60 flex items-center justify-between">
                      <span className="text-[10px] text-text-tertiary">
                        {activeTooltip.parada.endereco || 'Endereço cadastrado'}
                      </span>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${activeTooltip.parada.endereco || activeTooltip.parada.cliente}, ${activeTooltip.parada.bairro || ''} ${activeTooltip.parada.municipio || ''}`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-info hover:underline bg-info/10 px-2 py-0.5 rounded-md border border-info/20"
                      >
                        <Navigation size={11} />
                        <span>Google Maps</span>
                        <ExternalLink size={10} />
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
