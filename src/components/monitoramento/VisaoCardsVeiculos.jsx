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
  X,
  ChevronDown,
  Check
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/utils';
import { useStore } from '../../store/useStore';
import { STATUS_OPTIONS } from '../../data/mockData';

const formatarHora = (isoStr) => {
  if (!isoStr) return '--:--';
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
  entregasFiltradas = [],
  onStatusChange,
  onAbrirDevolucao
}) {
  const { motoristas = [], atualizarStatusEntrega, atualizarStatusEntregaEmMassa } = useStore();
  const [cardsExpandidos, setCardsExpandidos] = useState({});
  const [activeTooltip, setActiveTooltip] = useState(null); // { veiculoKey, parada, idx }
  const timeoutRef = useRef(null);

  const toggleExpandir = (placaCargaKey) => {
    setCardsExpandidos(prev => ({
      ...prev,
      [placaCargaKey]: !prev[placaCargaKey]
    }));
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
    }, 250);
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

  const handleAlterarStatusParada = async (novoStatus) => {
    if (!activeTooltip?.parada || activeTooltip.parada.isCd || activeTooltip.parada.isFim) return;
    const notas = activeTooltip.parada.notas || [];
    if (notas.length === 0) return;

    if (novoStatus === 'Devolução total' || novoStatus === 'Entrega parcial') {
      const tipo = novoStatus === 'Devolução total' ? 'Total' : 'Parcial';
      if (onAbrirDevolucao) {
        onAbrirDevolucao(notas[0], tipo);
      } else if (onStatusChange) {
        onStatusChange(notas[0], novoStatus);
      }
    } else {
      if (atualizarStatusEntregaEmMassa && notas.length > 1) {
        await atualizarStatusEntregaEmMassa(notas.map(n => n.id), novoStatus);
      } else if (onStatusChange) {
        for (const n of notas) {
          onStatusChange(n, novoStatus);
        }
      } else if (atualizarStatusEntrega) {
        for (const n of notas) {
          atualizarStatusEntrega(n.id, novoStatus);
        }
      }
    }

    // Atualizar o estado visual local do tooltip ativo
    setActiveTooltip(prev => prev ? {
      ...prev,
      parada: {
        ...prev.parada,
        statusCalculado: novoStatus,
        notas: prev.parada.notas.map(n => ({ ...n, status: novoStatus }))
      }
    } : null);
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
            estado: ent.uf || ent.estado || 'BA',
            endereco: ent.endereco,
            rca: ent.rca || '--',
            praca: ent.praca || ent.bairro || '--',
            rota: ent.rota || (veiculo.carga && veiculo.carga !== 'SEM CARGA' ? `ROTA ${veiculo.carga}` : '--'),
            sequenciaPrevista: ent.seq || ent.sequencia || null,
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
        if (ent.rca && cliObj.rca === '--') cliObj.rca = ent.rca;
        if (ent.praca && cliObj.praca === '--') cliObj.praca = ent.praca;
      });

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

        const valorTotal = parada.notas.reduce((acc, n) => acc + (Number(n.valor) || 0), 0);
        const pesoTotal = parada.notas.reduce((acc, n) => acc + (Number(n.peso) || 0), 0);
        const volumesTotal = parada.notas.reduce((acc, n) => acc + (Number(n.volumes) || Number(n.quantidade) || 0), 0);
        const notasFormatadas = parada.notas.map(n => n.nota).filter(Boolean).join(', ');

        return {
          ...parada,
          ordem: idx + 1,
          statusCalculado: status,
          valorTotal,
          pesoTotal,
          volumesTotal,
          notasFormatadas,
          sequenciaPrevista: parada.sequenciaPrevista || (idx + 1)
        };
      });

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
                      title={isExpandido ? "Ocultar rota" : "Visualizar rota e paradas"}
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
                        Passe o mouse nos ícones para detalhes e alteração de status
                      </span>
                    </div>

                    {/* Linha de Ícones Interativos */}
                    <div className="bg-background-primary/90 p-2.5 rounded-xl border border-border-secondary overflow-x-auto hide-scrollbar">
                      <div className="flex items-center gap-2 min-w-max py-0.5">
                        {/* CD Início */}
                        <div 
                          className="flex flex-col items-center gap-0.5 cursor-help group"
                          onMouseEnter={() => handleMouseEnter(veiculo.key, {
                            isCd: true,
                            cliente: 'CENTRO DE DISTRIBUIÇÃO (ORIGEM)',
                            codCliente: 'CD',
                            statusCalculado: 'Início da Rota',
                            bairro: 'Base Operacional',
                            municipio: 'Salvador',
                            estado: 'BA',
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
                          const isEmAtendimento = ['No cliente', 'Descarregando'].includes(parada.statusCalculado);
                          const isDevolucao = ['Devolução total', 'Entrega parcial', 'Devolução'].includes(parada.statusCalculado);
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
                                title={`#${idx + 1} - ${parada.cliente} (Clique para ver/alterar)`}
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
                            isFim: true,
                            cliente: 'RETORNO AO CD (FIM DE ROTA)',
                            codCliente: 'CD',
                            statusCalculado: progresso === 100 ? 'Finalizado' : 'Pendente Retorno',
                            bairro: 'Base Operacional',
                            municipio: 'Salvador',
                            estado: 'BA',
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

              {/* POP-UP FLUTUANTE ESTILO IMAGEM DE REFERÊNCIA COM SELETOR DE STATUS ATIVO */}
              {isExpandido && isCardActive && activeTooltip.parada && (
                <div 
                  className="absolute left-2 right-2 bottom-3 z-50 bg-[#121417]/95 text-zinc-100 backdrop-blur-xl border border-zinc-700/80 rounded-2xl p-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-[11px] leading-relaxed max-w-full pointer-events-auto"
                  onMouseEnter={handleTooltipMouseEnter}
                  onMouseLeave={handleTooltipMouseLeave}
                >
                  {/* Cabeçalho do Pop-up com Seletor Interativo de Status */}
                  <div className="flex items-center justify-between border-b border-zinc-700/70 pb-2 mb-2.5 gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-400 uppercase text-[10px] tracking-wider">
                        Entrega(s) / NF:
                      </span>
                      <span className="font-black text-white font-mono text-xs bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                        {activeTooltip.parada.notasFormatadas || activeTooltip.parada.codCliente || 'CD'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Seletor Dinâmico de Status da Entrega */}
                      {!activeTooltip.parada.isCd && !activeTooltip.parada.isFim ? (
                        <div className="relative flex items-center" title="Clique para alterar o status da entrega">
                          <select
                            value={activeTooltip.parada.statusCalculado || 'Pendente'}
                            onChange={(e) => handleAlterarStatusParada(e.target.value)}
                            className={cn(
                              "text-[11px] font-bold px-2.5 py-1 rounded-lg border outline-none cursor-pointer transition-all appearance-none pr-6 shadow-sm",
                              activeTooltip.parada.statusCalculado === 'Entrega total' ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 hover:bg-emerald-500/30" :
                              ['No cliente', 'Descarregando'].includes(activeTooltip.parada.statusCalculado) ? "bg-sky-500/20 text-sky-300 border-sky-500/50 hover:bg-sky-500/30" :
                              ['Devolução total', 'Entrega parcial', 'Devolução'].includes(activeTooltip.parada.statusCalculado) ? "bg-rose-500/20 text-rose-300 border-rose-500/50 hover:bg-rose-500/30" :
                              activeTooltip.parada.statusCalculado === 'Carga parada' ? "bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30" :
                              activeTooltip.parada.statusCalculado === 'Reentrega' ? "bg-purple-500/20 text-purple-300 border-purple-500/50 hover:bg-purple-500/30" :
                              "bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700"
                            )}
                          >
                            {STATUS_OPTIONS.map(opt => (
                              <option key={opt} value={opt} className="bg-zinc-900 text-white py-1 font-semibold">
                                {opt}
                              </option>
                            ))}
                          </select>
                          <ChevronDown size={12} className="absolute right-1.5 text-zinc-400 pointer-events-none" />
                        </div>
                      ) : (
                        <Badge size="sm" variant="default">
                          {activeTooltip.parada.statusCalculado}
                        </Badge>
                      )}

                      <button 
                        onClick={() => setActiveTooltip(null)}
                        className="text-zinc-400 hover:text-white p-0.5 rounded hover:bg-zinc-800 transition-colors"
                        title="Fechar pop-up"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Informações do Cliente, Botão do Maps e Localização */}
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-1 flex-1 min-w-0">
                        <span className="font-extrabold text-zinc-400 uppercase text-[10px] min-w-[55px] flex-shrink-0">
                          CLIENTE:
                        </span>
                        <span className="font-black text-white leading-tight break-words">
                          {activeTooltip.parada.codCliente && activeTooltip.parada.codCliente !== 'CD' ? `${activeTooltip.parada.codCliente} - ` : ''}
                          {activeTooltip.parada.cliente}
                        </span>
                      </div>

                      {/* Botão do Maps ao lado direito do nome do cliente */}
                      {(activeTooltip.parada.endereco || activeTooltip.parada.cliente) && !activeTooltip.parada.isCd && !activeTooltip.parada.isFim && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${activeTooltip.parada.endereco || activeTooltip.parada.cliente}, ${activeTooltip.parada.bairro || ''} ${activeTooltip.parada.municipio || ''}`)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-info hover:text-white bg-info/10 hover:bg-info/30 px-2 py-0.5 rounded-md border border-info/30 transition-colors flex-shrink-0 whitespace-nowrap shadow-sm"
                          title="Abrir rota no Google Maps"
                        >
                          <Navigation size={11} />
                          <span>Maps</span>
                          <ExternalLink size={9} />
                        </a>
                      )}
                    </div>

                    {activeTooltip.parada.rca && activeTooltip.parada.rca !== '--' && (
                      <div className="flex items-center gap-1 text-[10px]">
                        <span className="font-bold text-zinc-400 uppercase min-w-[55px]">RCA:</span>
                        <span className="text-zinc-200 font-semibold">{activeTooltip.parada.rca}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-[10px] pt-0.5">
                      <div>
                        <span className="font-bold text-zinc-400 uppercase">BAIRRO: </span>
                        <span className="text-zinc-200 font-semibold">{activeTooltip.parada.bairro || '--'}</span>
                      </div>
                      <div>
                        <span className="font-bold text-zinc-400 uppercase">MUNICÍPIO: </span>
                        <span className="text-zinc-200 font-semibold">{activeTooltip.parada.municipio || '--'}</span>
                      </div>
                      <div>
                        <span className="font-bold text-zinc-400 uppercase">ESTADO: </span>
                        <span className="text-zinc-200 font-semibold">{activeTooltip.parada.estado || 'BA'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Dados Operacionais e de Carga */}
                  <div className="mt-2.5 pt-2 border-t border-zinc-800 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                    <div>
                      <span className="text-zinc-400 font-medium">Sequência Prevista: </span>
                      <strong className="text-zinc-200">{activeTooltip.parada.sequenciaPrevista || (activeTooltip.idx >= 0 ? activeTooltip.idx + 1 : '--')}</strong>
                    </div>
                    <div>
                      <span className="text-zinc-400 font-medium">Sequência Realizada: </span>
                      <strong className="text-zinc-200">{activeTooltip.idx >= 0 && activeTooltip.idx < 900 ? activeTooltip.idx + 1 : '--'}</strong>
                    </div>

                    <div>
                      <span className="text-zinc-400 font-medium">Carregamento: </span>
                      <strong className="text-zinc-200">{veiculo.carga && veiculo.carga !== 'SEM CARGA' ? veiculo.carga : '--'}</strong>
                    </div>
                    <div>
                      <span className="text-zinc-400 font-medium">Rota / Praça: </span>
                      <strong className="text-zinc-200">{activeTooltip.parada.praca || activeTooltip.parada.rota || '--'}</strong>
                    </div>

                    {activeTooltip.parada.valorTotal !== undefined && activeTooltip.parada.valorTotal > 0 && (
                      <div>
                        <span className="text-zinc-400 font-medium">Valor: </span>
                        <strong className="text-emerald-400 font-bold">
                          R$ {Number(activeTooltip.parada.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </strong>
                      </div>
                    )}
                    {activeTooltip.parada.pesoTotal !== undefined && activeTooltip.parada.pesoTotal > 0 && (
                      <div>
                        <span className="text-zinc-400 font-medium">Peso: </span>
                        <strong className="text-zinc-200">{Number(activeTooltip.parada.pesoTotal).toFixed(2)} Kg</strong>
                      </div>
                    )}
                  </div>

                  {/* Horários de Check-in, Check-out e Permanência na Mesma Linha */}
                  <div className="mt-2.5 pt-2 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                    <div>
                      <span className="text-zinc-400 font-medium">Check-in: </span>
                      <strong className="text-info font-mono font-bold">
                        {activeTooltip.parada.horaChegada ? formatarDataHora(activeTooltip.parada.horaChegada) : '--/-- --:--'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-zinc-400 font-medium">Check-out: </span>
                      <strong className="text-emerald-400 font-mono font-bold">
                        {activeTooltip.parada.horaSaida ? formatarDataHora(activeTooltip.parada.horaSaida) : '--/-- --:--'}
                      </strong>
                    </div>
                    <div className="flex items-center gap-1 bg-zinc-900/90 px-2 py-0.5 rounded border border-zinc-800">
                      <Timer size={11} className="text-primary" />
                      <span className="text-zinc-400 font-medium">Permanência: </span>
                      <strong className="text-primary font-mono font-bold">
                        {activeTooltip.parada.tempoFormatado || (activeTooltip.parada.horaChegada && activeTooltip.parada.horaSaida ? `${Math.round((new Date(activeTooltip.parada.horaSaida) - new Date(activeTooltip.parada.horaChegada)) / 60000)} min` : '--')}
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
