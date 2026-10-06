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
  Check,
  RotateCcw,
  ArrowRightLeft,
  Calendar
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { cn, normalizarRCA } from '../../lib/utils';
import { useStore } from '../../store/useStore';
import { STATUS_OPTIONS } from '../../data/mockData';
import { ModalAvaliarDevolucao } from './ModalAvaliarDevolucao';

const formatarData = (dataStr) => {
  if (!dataStr) return '--/--';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dataStr)) return dataStr;
  try {
    const parts = String(dataStr).split('-');
    if (parts.length === 3) {
      return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
    }
  } catch (e) {}
  return String(dataStr);
};

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

// Helper para extrair lista unificada de itens das notas de uma parada
const extrairItensDaParada = (parada) => {
  if (!parada || !parada.notas) return [];
  const lista = [];
  parada.notas.forEach(n => {
    const numNota = n.nota || 'S/ NF';
    if (Array.isArray(n.itens) && n.itens.length > 0) {
      n.itens.forEach(it => {
        lista.push({
          nota: numNota,
          codigo: it.codigo || it.cod || it.codProduto || it.codigoProduto || '--',
          descricao: it.descricao || it.nome || it.produto || it.descProduto || 'Item sem descrição',
          qtd: Number(it.qtd ?? it.quantidade ?? it.volumes ?? it.caixas ?? 1),
          peso: Number(it.peso ?? it.pesoKg ?? 0),
          valor: Number(it.valor ?? it.vlrTotal ?? it.valorProduto ?? 0)
        });
      });
    } else {
      lista.push({
        nota: numNota,
        codigo: 'RESUMO',
        descricao: `Resumo da NF ${numNota} (${n.cliente || parada.cliente || 'Cliente'})`,
        qtd: Number(n.volumes || n.quantidade || 1),
        peso: Number(n.peso || 0),
        valor: Number(n.valor || 0),
        isResumo: true
      });
    }
  });
  return lista;
};

// Helper para determinar a cor do sino de alerta de acordo com o status solicitado
const getCorSolicitacaoPendente = (solicitacoes = []) => {
  if (!solicitacoes || solicitacoes.length === 0) {
    return {
      textColor: 'text-amber-500',
      bgColor: 'bg-amber-500',
      fillClass: 'fill-amber-500/20'
    };
  }

  // Regras de cores dos status:
  // - Devolução total: Vermelho (rose)
  // - Entrega parcial: Abóbora (orange)
  // - Reentrega: Roxo (purple)
  if (solicitacoes.some(s => s.tipo === 'Total' || s.tipo === 'Devolução total' || s.tipo === 'Devolução')) {
    return {
      textColor: 'text-rose-500',
      bgColor: 'bg-rose-600',
      fillClass: 'fill-rose-500/20'
    };
  }
  if (solicitacoes.some(s => s.tipo === 'Parcial' || s.tipo === 'Entrega parcial')) {
    return {
      textColor: 'text-orange-500',
      bgColor: 'bg-orange-500',
      fillClass: 'fill-orange-500/20'
    };
  }
  if (solicitacoes.some(s => s.tipo === 'Reentrega')) {
    return {
      textColor: 'text-purple-500',
      bgColor: 'bg-purple-600',
      fillClass: 'fill-purple-500/20'
    };
  }

  return {
    textColor: 'text-amber-500',
    bgColor: 'bg-amber-500',
    fillClass: 'fill-amber-500/20'
  };
};

export function VisaoCardsVeiculos({
  entregasFiltradas = [],
  todasEntregas = [],
  onStatusChange,
  onAbrirDevolucao
}) {
  const { 
    motoristas = [], 
    solicitacoesDevolucao = [], 
    atualizarStatusEntrega, 
    atualizarStatusEntregaEmMassa,
    transferirPlaca,
    transferirPlacaEmMassa,
    alterarDataEntrega,
    alterarDataEntregaEmMassa
  } = useStore();
  const [cardsExpandidos, setCardsExpandidos] = useState({});
  const [modalAvaliarPlaca, setModalAvaliarPlaca] = useState(null);
  const [modalMudarPlaca, setModalMudarPlaca] = useState(false);
  const [novaPlacaModal, setNovaPlacaModal] = useState('');
  const [modalMudarData, setModalMudarData] = useState(false);
  const [novaDataModal, setNovaDataModal] = useState('');
  const [dropdownPlacasAberto, setDropdownPlacasAberto] = useState(false);
  const [hoveredParada, setHoveredParada] = useState(null); // { veiculoKey, parada, idx }
  const [selectedParada, setSelectedParada] = useState(null); // { veiculoKey, parada, idx }
  const [mostrarItens, setMostrarItens] = useState(false);
  const timeoutHoverRef = useRef(null);

  const todasPlacasSistema = useMemo(() => {
    const set = new Set();
    (todasEntregas || []).forEach(e => {
      const p = (e.placa || '').trim().toUpperCase();
      if (p && p !== 'SEM PLACA' && p !== 'NULL' && p !== 'UNDEFINED') set.add(p);
    });
    (motoristas || []).forEach(m => {
      const p = (m.placa || '').trim().toUpperCase();
      if (p && p !== 'SEM PLACA' && p !== 'NULL' && p !== 'UNDEFINED') set.add(p);
    });
    return Array.from(set).sort();
  }, [todasEntregas, motoristas]);

  const handleTransferirPlacaParada = async (novaPlaca) => {
    if (!selectedParada?.parada || !novaPlaca.trim()) return;
    const notas = selectedParada.parada.notas || [];
    if (notas.length === 0) return;
    
    const placaFormatada = novaPlaca.trim().toUpperCase();
    if (transferirPlacaEmMassa && notas.length > 1) {
      await transferirPlacaEmMassa(notas.map(n => n.id), placaFormatada);
    } else if (transferirPlaca) {
      for (const n of notas) {
        await transferirPlaca(n.id, placaFormatada);
      }
    }
    setModalMudarPlaca(false);
    setNovaPlacaModal('');
    setDropdownPlacasAberto(false);
    setSelectedParada(null);
  };

  const handleAlterarDataParada = async (novaData) => {
    if (!selectedParada?.parada || !novaData.trim()) return;
    const notas = selectedParada.parada.notas || [];
    if (notas.length === 0) return;

    if (alterarDataEntregaEmMassa && notas.length > 1) {
      await alterarDataEntregaEmMassa(notas.map(n => n.id), novaData);
    } else if (alterarDataEntrega) {
      for (const n of notas) {
        await alterarDataEntrega(n.id, novaData);
      }
    }
    setModalMudarData(false);
    setNovaDataModal('');
    setSelectedParada(null);
  };

  const toggleExpandir = (placaCargaKey) => {
    setCardsExpandidos(prev => ({
      ...prev,
      [placaCargaKey]: !prev[placaCargaKey]
    }));
    if (cardsExpandidos[placaCargaKey] && selectedParada?.veiculoKey === placaCargaKey) {
      setSelectedParada(null);
      setMostrarItens(false);
    }
  };

  const handleParadaMouseEnter = (veiculoKey, parada, idx) => {
    if (timeoutHoverRef.current) clearTimeout(timeoutHoverRef.current);
    setHoveredParada({ veiculoKey, parada, idx });
  };

  const handleParadaMouseLeave = () => {
    timeoutHoverRef.current = setTimeout(() => {
      setHoveredParada(null);
    }, 150);
  };

  const toggleSelectParada = (veiculoKey, parada, idx) => {
    if (selectedParada?.veiculoKey === veiculoKey && selectedParada?.idx === idx) {
      setSelectedParada(null);
      setMostrarItens(false);
    } else {
      setSelectedParada({ veiculoKey, parada, idx });
      setMostrarItens(false);
    }
  };

  const handleAlterarStatusParada = async (novoStatus) => {
    if (!selectedParada?.parada || selectedParada.parada.isCd || selectedParada.parada.isFim) return;
    const notas = selectedParada.parada.notas || [];
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

    // Atualizar o estado visual local da parada selecionada
    setSelectedParada(prev => prev ? {
      ...prev,
      parada: {
        ...prev.parada,
        statusCalculado: novoStatus,
        notas: (prev.parada.notas || []).map(n => ({ ...n, status: novoStatus }))
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
      let entreguesCount = 0;
      let parciaisCount = 0;
      let noClienteCount = 0;
      let descarregandoCount = 0;
      let devolucoesCount = 0;
      let reentregasCount = 0;
      let paradasCount = 0;
      let apenasPendentesCount = 0;
      let finalizadasCount = 0;
      let emAndamentoCount = 0;
      let pendentesCount = 0;

      const clientesMap = new Map();
      let ultimaAtualizacao = null;
      let ultimoClienteNome = '--';

      veiculo.entregas.forEach(ent => {
        const isFin = finalizadasSet.has(ent.status);
        if (isFin) finalizadasCount++;
        else if (['No cliente', 'Descarregando'].includes(ent.status)) emAndamentoCount++;
        else pendentesCount++;

        if (ent.status === 'Entrega total') {
          entreguesCount++;
        } else if (ent.status === 'Entrega parcial') {
          parciaisCount++;
        } else if (ent.status === 'No cliente') {
          noClienteCount++;
        } else if (ent.status === 'Descarregando') {
          descarregandoCount++;
        } else if (ent.status === 'Devolução total') {
          devolucoesCount++;
        } else if (ent.status === 'Reentrega') {
          reentregasCount++;
        } else if (ent.status === 'Carga parada') {
          paradasCount++;
        } else {
          apenasPendentesCount++;
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
            rca: normalizarRCA(ent.rca) || '--',
            praca: ent.praca || ent.bairro || '--',
            rota: ent.rota || (veiculo.carga && veiculo.carga !== 'SEM CARGA' ? `ROTA ${veiculo.carga}` : '--'),
            sequenciaPrevista: ent.seq || ent.sequencia || null,
            data: ent.data,
            dataFaturamento: ent.dataFaturamento || ent.data,
            placa: ent.placa,
            placaOriginal: ent.placaOriginal || ent.placa,
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
        if (ent.rca && cliObj.rca === '--') cliObj.rca = normalizarRCA(ent.rca);
        if (ent.praca && cliObj.praca === '--') cliObj.praca = ent.praca;
      });

      const paradas = Array.from(clientesMap.values()).map((parada, idx) => {
        const statuses = parada.notas.map(n => n.status);
        let status = 'Pendente';

        if (statuses.some(s => s === 'Descarregando')) {
          status = 'Descarregando';
        } else if (statuses.some(s => s === 'No cliente')) {
          status = 'No cliente';
        } else if (statuses.every(s => s === 'Entrega total')) {
          status = 'Entrega total';
        } else if (statuses.some(s => s === 'Entrega parcial')) {
          status = 'Entrega parcial';
        } else if (statuses.some(s => s === 'Devolução total')) {
          status = 'Devolução total';
        } else if (statuses.some(s => s === 'Reentrega')) {
          status = 'Reentrega';
        } else if (statuses.some(s => s === 'Carga parada')) {
          status = 'Carga parada';
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
          data: parada.notas[0]?.data || parada.data || veiculo.data,
          dataFaturamento: parada.notas[0]?.dataFaturamento || parada.dataFaturamento || parada.notas[0]?.data || veiculo.data,
          placaOriginal: parada.notas[0]?.placaOriginal || parada.placaOriginal || veiculo.placa,
          sequenciaPrevista: parada.sequenciaPrevista || (idx + 1)
        };
      });

      if (ultimoClienteNome === '--' && paradas.length > 0) {
        const concluidas = paradas.filter(p => p.statusCalculado === 'Entrega total' || p.statusCalculado === 'Devolução total' || p.statusCalculado === 'Entrega parcial');
        if (concluidas.length > 0) {
          ultimoClienteNome = concluidas[concluidas.length - 1].cliente;
        } else {
          ultimoClienteNome = paradas[0].cliente;
        }
      }

      const solicitacoesPendentes = (solicitacoesDevolucao || []).filter(s => 
        s.statusSolicitacao === 'Pendente' && 
        (s.placa || '').toUpperCase() === veiculo.placa.toUpperCase() &&
        (!veiculo.data || s.data === veiculo.data)
      );
      const solicitacoesCount = solicitacoesPendentes.length;

      const pctEntregues = totalNotas > 0 ? (entreguesCount / totalNotas) * 100 : 0;
      const pctParciais = totalNotas > 0 ? (parciaisCount / totalNotas) * 100 : 0;
      const pctNoCliente = totalNotas > 0 ? (noClienteCount / totalNotas) * 100 : 0;
      const pctDescarregando = totalNotas > 0 ? (descarregandoCount / totalNotas) * 100 : 0;
      const pctDevolucoes = totalNotas > 0 ? (devolucoesCount / totalNotas) * 100 : 0;
      const pctReentregas = totalNotas > 0 ? (reentregasCount / totalNotas) * 100 : 0;
      const pctCargaParada = totalNotas > 0 ? (paradasCount / totalNotas) * 100 : 0;
      const progressoPorcentagem = totalNotas > 0 ? Math.round((finalizadasCount / totalNotas) * 100) : 0;

      return {
        ...veiculo,
        totalNotas,
        entreguesCount,
        parciaisCount,
        noClienteCount,
        descarregandoCount,
        devolucoesCount,
        reentregasCount,
        paradasCount,
        apenasPendentesCount,
        finalizadasCount,
        emAndamentoCount,
        pendentesCount,
        solicitacoesPendentes,
        solicitacoesCount,
        pctEntregues,
        pctParciais,
        pctNoCliente,
        pctDescarregando,
        pctDevolucoes,
        pctReentregas,
        pctCargaParada,
        progressoPorcentagem,
        ultimaAtualizacao,
        ultimoClienteNome,
        paradas
      };
    });

    return lista.sort((a, b) => {
      // Prioridade 1: Veículos com solicitações de devolução pendentes de autorização
      if (a.solicitacoesCount > 0 && b.solicitacoesCount === 0) return -1;
      if (a.solicitacoesCount === 0 && b.solicitacoesCount > 0) return 1;
      // Prioridade 2: Veículos com entregas pendentes
      if (a.pendentesCount > 0 && b.pendentesCount === 0) return -1;
      if (a.pendentesCount === 0 && b.pendentesCount > 0) return 1;
      return a.placa.localeCompare(b.placa);
    });
  }, [entregasFiltradas, motoristas, solicitacoesDevolucao, finalizadasSet]);

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
          const temAlerta = veiculo.solicitacoesCount > 0 || veiculo.devolucoesCount > 0 || veiculo.reentregasCount > 0 || veiculo.paradasCount > 0;
          const isCardActive = selectedParada?.veiculoKey === veiculo.key;

          return (
            <div
              key={veiculo.key}
              className={cn(
                "bg-background-primary dark:bg-background-secondary border rounded-2xl p-4 shadow-sm transition-all duration-200 flex flex-col justify-between relative",
                isExpandido 
                  ? "border-primary/60 ring-1 ring-primary/30 shadow-md" 
                  : "border-border-secondary hover:border-border-tertiary hover:shadow-md"
              )}
            >
              {/* Topo do Card: Placa em Destaque + Último Cliente e Data */}
              <div>
                <div className="flex items-start justify-between gap-2 sm:gap-3 w-full">
                  {/* Lado Esquerdo: Placa & Motorista */}
                  <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1 max-w-[55%]">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-background-secondary dark:bg-background-primary border border-border-secondary flex items-center justify-center text-text-primary shadow-inner flex-shrink-0">
                      <Truck size={18} className="text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm sm:text-base font-black tracking-wider text-text-primary font-mono uppercase bg-background-secondary dark:bg-background-primary px-2 py-0.5 rounded-lg border border-border-secondary shadow-xs shrink-0">
                          {veiculo.placa}
                        </span>
                        {veiculo.carga && veiculo.carga !== 'SEM CARGA' && (
                          <span className="text-[10px] sm:text-[11px] font-bold text-text-secondary dark:text-text-tertiary bg-background-secondary dark:bg-background-primary/50 px-1.5 py-0.5 rounded border border-border-secondary truncate max-w-[90px] sm:max-w-[120px]">
                            Carga: {veiculo.carga}
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-bold text-text-secondary mt-0.5 sm:mt-1 flex items-center gap-1 truncate max-w-full">
                        <User size={12} className="text-text-tertiary flex-shrink-0" />
                        <span className="truncate">{veiculo.motoristaNome}</span>
                      </div>
                    </div>
                  </div>

                  {/* Lado Direito: Último cliente & Horário */}
                  <div className="flex flex-col items-end justify-start gap-0.5 text-right min-w-0 flex-1 max-w-[45%] shrink-0">
                    <div className="flex flex-col items-end min-w-0 w-full">
                      <span className="text-[10px] text-text-secondary dark:text-text-tertiary uppercase font-extrabold tracking-tight shrink-0 leading-none">
                        ÚLTIMO:
                      </span>
                      <span 
                        className="text-xs font-bold text-text-primary truncate block w-full text-right mt-0.5"
                        title={veiculo.ultimoClienteNome}
                      >
                        {veiculo.ultimoClienteNome}
                      </span>
                    </div>
                    <div className="text-[10px] text-text-secondary dark:text-text-tertiary font-semibold flex items-center gap-1 shrink-0 mt-0.5">
                      <Clock size={10} />
                      <span className="tabular-nums">{veiculo.ultimaAtualizacao ? formatarDataHora(veiculo.ultimaAtualizacao) : '--/-- --:--'}</span>
                    </div>
                  </div>
                </div>

                {/* Linha Central: Progresso, Quantidade e Botão do Olho */}
                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border-secondary">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-bold text-text-secondary dark:text-text-tertiary uppercase tracking-wider">
                      Progresso
                    </span>
                    <span className={cn(
                      "text-lg font-black tracking-tight",
                      progresso === 100 
                        ? "text-success" 
                        : progresso > 0 
                          ? "text-info" 
                          : "text-text-secondary dark:text-text-tertiary"
                    )}>
                      {progresso}%
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-text-secondary font-mono bg-background-primary px-2 py-0.5 rounded-md border border-border-secondary">
                      {veiculo.finalizadasCount}/{veiculo.totalNotas}
                    </span>

                    {/* Sino de Alerta de Solicitação Pendente de Autorização */}
                    {veiculo.solicitacoesCount > 0 && (() => {
                      const cor = getCorSolicitacaoPendente(veiculo.solicitacoesPendentes);
                      return (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setModalAvaliarPlaca(veiculo.placa);
                          }}
                          className={cn(
                            "relative p-1 rounded-lg transition-transform active:scale-95 cursor-pointer animate-bounce",
                            cor.textColor
                          )}
                          title={`${veiculo.solicitacoesCount} solicitação(ões) de ocorrência aguardando sua autorização - Clique para avaliar`}
                        >
                          <Bell size={18} className={cn("fill-current/20", cor.textColor)} />
                          <span className={cn(
                            "absolute -top-1 -right-1.5 min-w-3.5 h-3.5 px-1 rounded-full text-[9px] font-black flex items-center justify-center text-white shadow-xs",
                            cor.bgColor
                          )}>
                            {veiculo.solicitacoesCount}
                          </span>
                        </button>
                      );
                    })()}

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

                {/* Barra Gráfica de Progresso com Esquema de Cores Multi-Segmentado e Caminhão */}
                <div className="mt-2.5 relative pt-2 pb-1">
                  <div className="flex items-center justify-between text-text-secondary dark:text-text-tertiary mb-1">
                    <div className="flex items-center gap-1 text-[10px] font-bold">
                      <Building2 size={13} className="text-text-secondary dark:text-text-tertiary" />
                      <span>CD</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-bold">
                      <span>FIM</span>
                      <Flag size={13} className={progresso === 100 ? 'text-success' : 'text-text-secondary dark:text-text-tertiary'} />
                    </div>
                  </div>

                  {/* Linha da Estrada com Segmentos de Cores dos Status */}
                  <div className="relative w-full h-2.5 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-visible border border-slate-300 dark:border-zinc-700">
                    <div className="w-full h-full rounded-full overflow-hidden flex">
                      {veiculo.pctEntregues > 0 && (
                        <div
                          className="bg-emerald-600 dark:bg-emerald-500 h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                          style={{ width: `${veiculo.pctEntregues}%` }}
                          title={`Entrega total: ${veiculo.entreguesCount}`}
                        />
                      )}
                      {veiculo.pctParciais > 0 && (
                        <div
                          className="bg-orange-500 h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                          style={{ width: `${veiculo.pctParciais}%` }}
                          title={`Entrega parcial: ${veiculo.parciaisCount}`}
                        />
                      )}
                      {veiculo.pctNoCliente > 0 && (
                        <div
                          className="bg-sky-500 h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                          style={{ width: `${veiculo.pctNoCliente}%` }}
                          title={`No cliente: ${veiculo.noClienteCount}`}
                        />
                      )}
                      {veiculo.pctDescarregando > 0 && (
                        <div
                          className="bg-blue-600 h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                          style={{ width: `${veiculo.pctDescarregando}%` }}
                          title={`Descarregando: ${veiculo.descarregandoCount}`}
                        />
                      )}
                      {veiculo.pctDevolucoes > 0 && (
                        <div
                          className="bg-rose-600 dark:bg-rose-500 h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                          style={{ width: `${veiculo.pctDevolucoes}%` }}
                          title={`Devolução total: ${veiculo.devolucoesCount}`}
                        />
                      )}
                      {veiculo.pctReentregas > 0 && (
                        <div
                          className="bg-purple-600 dark:bg-purple-500 h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                          style={{ width: `${veiculo.pctReentregas}%` }}
                          title={`Reentrega: ${veiculo.reentregasCount}`}
                        />
                      )}
                      {veiculo.pctCargaParada > 0 && (
                        <div
                          className="bg-yellow-500 h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                          style={{ width: `${veiculo.pctCargaParada}%` }}
                          title={`Carga parada: ${veiculo.paradasCount}`}
                        />
                      )}
                    </div>

                    {/* Ícone do Caminhão se movendo sobre a linha */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-500 ease-out text-text-primary bg-background-primary border border-border-secondary rounded-full p-1 shadow-md z-10"
                      style={{ left: `${Math.min(Math.max(progresso, 4), 96)}%` }}
                      title={`${progresso}% concluído`}
                    >
                      <Truck size={13} className={progresso === 100 ? "text-success" : "text-primary"} />
                    </div>
                  </div>

                  {/* Badges de Resumo Rápido da Barra */}
                  <div className="flex flex-wrap items-center gap-1 mt-2 text-[9px] font-bold">
                    {veiculo.entreguesCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                        {veiculo.entreguesCount} ok
                      </span>
                    )}
                    {veiculo.parciaisCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/30">
                        {veiculo.parciaisCount} parcial
                      </span>
                    )}
                    {veiculo.noClienteCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                        {veiculo.noClienteCount} cliente
                      </span>
                    )}
                    {veiculo.descarregandoCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-600/20 text-blue-700 dark:text-blue-300 font-bold border border-blue-600/30">
                        {veiculo.descarregandoCount} descarreg
                      </span>
                    )}
                    {veiculo.devolucoesCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-300 font-extrabold border border-rose-500/30">
                        {veiculo.devolucoesCount} dev
                      </span>
                    )}
                    {veiculo.reentregasCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                        {veiculo.reentregasCount} reent
                      </span>
                    )}
                    {veiculo.paradasCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-yellow-500/15 text-amber-900 dark:text-yellow-300 font-bold border border-yellow-500/30">
                        {veiculo.paradasCount} parada
                      </span>
                    )}
                    {veiculo.apenasPendentesCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-background-secondary text-text-secondary border border-border-secondary font-bold">
                        {veiculo.apenasPendentesCount} pend
                      </span>
                    )}
                  </div>
                </div>

                {/* Seção Expandida (Ao Clicar no Olho): Trajeto com Ícones e Pop-up */}
                {isExpandido && (
                  <div className="mt-3 pt-3 border-t border-border-secondary/70 animate-in fade-in slide-in-from-top-2 duration-150">
                    {/* Cabeçalho da Rota com Resumo Dinâmico do Hover (Sem corte e sem redundância) */}
                    <div className="flex items-center justify-between gap-2 mb-2 min-h-[22px]">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-text-secondary shrink-0">
                        <Truck size={13} className="text-primary shrink-0" />
                        <span className="font-mono">
                          {veiculo.carga && veiculo.carga !== 'SEM CARGA' ? veiculo.carga : 'ROTA'}
                        </span>
                        <span className="text-text-tertiary font-normal">
                          ({veiculo.paradas.length} paradas)
                        </span>
                      </div>

                      {/* Resumo dinâmico no Hover ou instrução quando inativo */}
                      <div className="text-right min-w-0 flex-1 flex justify-end items-center">
                        {hoveredParada?.veiculoKey === veiculo.key && hoveredParada?.parada ? (
                          <div className="inline-flex items-center gap-1.5 bg-zinc-900/90 text-zinc-100 px-2.5 py-0.5 rounded-md border border-zinc-700/80 text-[10px] font-medium shadow-xs animate-in fade-in duration-100 max-w-full truncate">
                            {hoveredParada.parada.isCd ? (
                              <span className="text-emerald-400 font-bold flex items-center gap-1">
                                <Building2 size={11} /> CD (Origem da Rota)
                              </span>
                            ) : hoveredParada.parada.isFim ? (
                              <span className="text-info font-bold flex items-center gap-1">
                                <Flag size={11} /> Fim de Rota (Retorno ao CD)
                              </span>
                            ) : (
                              <>
                                <span className="font-mono font-black text-amber-400 shrink-0">
                                  NF {hoveredParada.parada.notasFormatadas || 'S/ NF'}
                                </span>
                                <span className="text-zinc-600 shrink-0">•</span>
                                <span className="font-bold text-zinc-100 truncate">
                                  {hoveredParada.parada.codCliente ? `${hoveredParada.parada.codCliente} ` : ''}{hoveredParada.parada.cliente}
                                </span>
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-text-tertiary italic hidden sm:inline truncate">
                            Passe o mouse ou clique nas paradas
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Linha de Ícones Interativos */}
                    <div className="bg-background-primary/90 p-2.5 rounded-xl border border-border-secondary overflow-x-auto hide-scrollbar">
                      <div className="flex items-center gap-2 min-w-max py-0.5">
                        {/* CD Início */}
                        {(() => {
                          const cdParadaObj = {
                            isCd: true,
                            cliente: 'CENTRO DE DISTRIBUIÇÃO (ORIGEM)',
                            codCliente: 'CD',
                            statusCalculado: 'Início da Rota',
                            bairro: 'Base Operacional',
                            municipio: 'Salvador',
                            estado: 'BA',
                            notas: []
                          };
                          const isCdSelected = selectedParada?.veiculoKey === veiculo.key && selectedParada?.idx === -1;

                          return (
                            <button 
                              type="button"
                              className="flex flex-col items-center gap-0.5 group focus:outline-none cursor-pointer"
                              onMouseEnter={() => handleParadaMouseEnter(veiculo.key, cdParadaObj, -1)}
                              onMouseLeave={handleParadaMouseLeave}
                              onClick={() => toggleSelectParada(veiculo.key, cdParadaObj, -1)}
                            >
                              <div className={cn(
                                "w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm",
                                isCdSelected ? "ring-2 ring-primary ring-offset-1 ring-offset-background-primary scale-110" : ""
                              )}>
                                <Building2 size={14} />
                              </div>
                              <span className="text-[8px] font-bold text-text-tertiary">CD</span>
                            </button>
                          );
                        })()}

                        {/* Conector */}
                        <div className="w-3 h-0.5 bg-border-tertiary" />

                        {/* Paradas de Clientes */}
                        {veiculo.paradas.map((parada, idx) => {
                          const isEntregaTotal = parada.statusCalculado === 'Entrega total';
                          const isEntregaParcial = parada.statusCalculado === 'Entrega parcial';
                          const isNoCliente = parada.statusCalculado === 'No cliente';
                          const isDescarregando = parada.statusCalculado === 'Descarregando';
                          const isDevolucaoTotal = ['Devolução total', 'Devolução'].includes(parada.statusCalculado);
                          const isReentrega = parada.statusCalculado === 'Reentrega';
                          const isCargaParada = parada.statusCalculado === 'Carga parada';
                          const isSelected = selectedParada?.veiculoKey === veiculo.key && selectedParada?.idx === idx;

                          return (
                            <div key={idx} className="flex items-center gap-2">
                              <button
                                type="button"
                                onMouseEnter={() => handleParadaMouseEnter(veiculo.key, parada, idx)}
                                onMouseLeave={handleParadaMouseLeave}
                                onClick={() => toggleSelectParada(veiculo.key, parada, idx)}
                                className={cn(
                                  "flex flex-col items-center gap-0.5 group transition-all duration-150 relative focus:outline-none cursor-pointer",
                                  isSelected ? "scale-115" : "hover:scale-110"
                                )}
                              >
                                <div className={cn(
                                  "w-7 h-7 rounded-full flex items-center justify-center transition-all shadow-sm",
                                  isEntregaTotal
                                    ? "bg-success text-white shadow-success/20"
                                    : isEntregaParcial
                                      ? "bg-orange-500 text-white shadow-orange-500/20"
                                      : isNoCliente
                                        ? "bg-sky-400 text-white shadow-sky-400/20"
                                        : isDescarregando
                                          ? "bg-blue-600 text-white ring-4 ring-blue-500/40 animate-pulse"
                                          : isDevolucaoTotal
                                            ? "bg-danger text-white shadow-danger/20"
                                            : isReentrega
                                              ? "bg-purple-500 text-white shadow-purple-500/20"
                                              : isCargaParada
                                                ? "bg-yellow-400 text-yellow-950 font-black shadow-yellow-400/20"
                                                : "bg-background-secondary border border-border-tertiary text-text-tertiary group-hover:border-info group-hover:text-info",
                                  isSelected ? "ring-2 ring-primary ring-offset-1 ring-offset-background-primary" : ""
                                )}>
                                  {isEntregaTotal ? (
                                    <CheckCircle2 size={14} />
                                  ) : isEntregaParcial ? (
                                    <Check size={14} />
                                  ) : isNoCliente ? (
                                    <User size={14} />
                                  ) : isDescarregando ? (
                                    <PackageIcon size={14} />
                                  ) : isDevolucaoTotal ? (
                                    <AlertTriangle size={14} />
                                  ) : isReentrega ? (
                                    <RotateCcw size={13} />
                                  ) : isCargaParada ? (
                                    <Clock size={13} />
                                  ) : (
                                    <MapPin size={13} />
                                  )}
                                </div>
                                <span className={cn(
                                  "text-[9px] font-bold tracking-tight",
                                  isSelected ? "text-primary font-black" : "text-text-tertiary group-hover:text-text-primary"
                                )}>
                                  #{idx + 1}
                                </span>
                              </button>

                              {/* Linha conectora até a próxima parada */}
                              <div className={cn(
                                "w-3 h-0.5",
                                isEntregaTotal ? "bg-success" :
                                isEntregaParcial ? "bg-orange-500" :
                                isNoCliente ? "bg-sky-400" :
                                isDescarregando ? "bg-blue-600" :
                                isDevolucaoTotal ? "bg-danger" :
                                isReentrega ? "bg-purple-500" :
                                isCargaParada ? "bg-yellow-400" :
                                "bg-border-tertiary"
                              )} />
                            </div>
                          );
                        })}

                        {/* CD Retorno / Fim */}
                        {(() => {
                          const fimParadaObj = {
                            isFim: true,
                            cliente: 'RETORNO AO CD (FIM DE ROTA)',
                            codCliente: 'CD',
                            statusCalculado: progresso === 100 ? 'Finalizado' : 'Pendente Retorno',
                            bairro: 'Base Operacional',
                            municipio: 'Salvador',
                            estado: 'BA',
                            notas: []
                          };
                          const isFimSelected = selectedParada?.veiculoKey === veiculo.key && selectedParada?.idx === 999;

                          return (
                            <button 
                              type="button"
                              className="flex flex-col items-center gap-0.5 group focus:outline-none cursor-pointer"
                              onMouseEnter={() => handleParadaMouseEnter(veiculo.key, fimParadaObj, 999)}
                              onMouseLeave={handleParadaMouseLeave}
                              onClick={() => toggleSelectParada(veiculo.key, fimParadaObj, 999)}
                            >
                              <div className={cn(
                                "w-7 h-7 rounded-full border flex items-center justify-center transition-transform group-hover:scale-110",
                                progresso === 100 
                                  ? "bg-emerald-500 text-white border-emerald-500 shadow-emerald-500/20" 
                                  : "bg-background-secondary border-border-tertiary text-text-tertiary",
                                isFimSelected ? "ring-2 ring-primary ring-offset-1 ring-offset-background-primary scale-110" : ""
                              )}>
                                <Flag size={13} />
                              </div>
                              <span className="text-[8px] font-bold text-text-tertiary">Fim</span>
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* CARD DETALHADO COMPLETO AO CLICAR NA PARADA (DESKTOP E MOBILE) */}
              {isExpandido && isCardActive && selectedParada?.parada && (() => {
                const itensLista = extrairItensDaParada(selectedParada.parada);
                const totalQtdItens = itensLista.reduce((acc, it) => acc + (it.qtd || 0), 0);
                const totalPesoItens = itensLista.reduce((acc, it) => acc + (it.peso || 0), 0);
                const totalValorItens = itensLista.reduce((acc, it) => acc + (it.valor || 0), 0);

                return (
                  <>
                    {/* Backdrop escuro no mobile para foco e toque fora para fechar */}
                    <div 
                      className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 sm:hidden animate-in fade-in duration-150"
                      onClick={() => {
                        setSelectedParada(null);
                        setMostrarItens(false);
                      }}
                    />

                    <div 
                      className="fixed sm:absolute inset-x-0 sm:inset-0 bottom-0 sm:bottom-0 z-50 bg-[#121417] text-zinc-100 backdrop-blur-xl border-t sm:border border-zinc-700/80 rounded-t-3xl sm:rounded-2xl p-4 shadow-2xl animate-in slide-in-from-bottom-4 sm:fade-in duration-150 text-[11px] leading-relaxed max-w-full max-h-[85vh] sm:max-h-full sm:h-full overflow-y-auto pointer-events-auto flex flex-col justify-between pb-6 sm:pb-4"
                    >
                      {/* Barra de puxador no mobile */}
                      <div className="w-12 h-1.5 bg-zinc-700 rounded-full mx-auto mb-3 sm:hidden" />

                      {/* Cabeçalho do Card com Seletor Interativo de Status e Badges de Raiz */}
                      <div className="flex items-center justify-between border-b border-zinc-700/70 pb-2.5 mb-2.5 gap-2 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          <span className="font-bold text-zinc-400 uppercase text-[10px] tracking-wider shrink-0">
                            Entrega(s) / NF:
                          </span>
                          <span className="font-black text-white font-mono text-xs bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700 truncate">
                            {selectedParada.parada.notasFormatadas || selectedParada.parada.codCliente || 'CD'}
                          </span>

                          {selectedParada.parada.dataFaturamento && selectedParada.parada.data && selectedParada.parada.dataFaturamento !== selectedParada.parada.data && (
                            <span 
                              className="text-[9px] font-bold text-purple-300 bg-purple-500/15 border border-purple-500/30 px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-xs"
                              title={`Data de faturamento original da importação: ${formatarData(selectedParada.parada.dataFaturamento)}`}
                            >
                              <Calendar size={10} />
                              <span>Fat: {formatarData(selectedParada.parada.dataFaturamento)}</span>
                            </span>
                          )}

                          {selectedParada.parada.placaOriginal && selectedParada.parada.placa && selectedParada.parada.placaOriginal !== selectedParada.parada.placa && (
                            <span 
                              className="text-[9px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-xs"
                              title={`Placa original da importação: ${selectedParada.parada.placaOriginal}`}
                            >
                              <Truck size={10} />
                              <span>Orig: {selectedParada.parada.placaOriginal}</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Seletor Dinâmico de Status da Entrega */}
                          {!selectedParada.parada.isCd && !selectedParada.parada.isFim ? (
                            <div className="relative flex items-center" title="Clique para alterar o status da entrega">
                              <select
                                value={selectedParada.parada.statusCalculado || 'Pendente'}
                                onChange={(e) => handleAlterarStatusParada(e.target.value)}
                                className={cn(
                                  "text-xs sm:text-[11px] font-bold px-3 py-1.5 sm:px-2.5 sm:py-1 rounded-lg border outline-none cursor-pointer transition-all appearance-none pr-6 shadow-sm",
                                  selectedParada.parada.statusCalculado === 'Entrega total' ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 hover:bg-emerald-500/30" :
                                  selectedParada.parada.statusCalculado === 'Entrega parcial' ? "bg-orange-500/20 text-orange-300 border-orange-500/50 hover:bg-orange-500/30" :
                                  selectedParada.parada.statusCalculado === 'No cliente' ? "bg-sky-500/20 text-sky-300 border-sky-500/50 hover:bg-sky-500/30" :
                                  selectedParada.parada.statusCalculado === 'Descarregando' ? "bg-blue-600/25 text-blue-300 border-blue-500/60 hover:bg-blue-600/35" :
                                  ['Devolução total', 'Devolução'].includes(selectedParada.parada.statusCalculado) ? "bg-rose-500/20 text-rose-300 border-rose-500/50 hover:bg-rose-500/30" :
                                  selectedParada.parada.statusCalculado === 'Carga parada' ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/50 hover:bg-yellow-500/30" :
                                  selectedParada.parada.statusCalculado === 'Reentrega' ? "bg-purple-500/20 text-purple-300 border-purple-500/50 hover:bg-purple-500/30" :
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
                              {selectedParada.parada.statusCalculado}
                            </Badge>
                          )}

                          <button 
                            onClick={() => {
                              setSelectedParada(null);
                              setMostrarItens(false);
                            }}
                            className="text-zinc-400 hover:text-white p-1 sm:p-0.5 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                            title="Fechar detalhes"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Informações do Cliente, RCA e Localização (Largura Total) */}
                      <div className="space-y-1">
                        <div className="flex items-start gap-1">
                          <span className="font-extrabold text-zinc-400 uppercase text-[10px] min-w-[55px] flex-shrink-0">
                            CLIENTE:
                          </span>
                          <span className="font-black text-white leading-tight break-words text-xs sm:text-[11px]">
                            {selectedParada.parada.codCliente && selectedParada.parada.codCliente !== 'CD' ? `${selectedParada.parada.codCliente} ` : ''}
                            {selectedParada.parada.cliente}
                          </span>
                        </div>

                        {selectedParada.parada.rca && selectedParada.parada.rca !== '--' && (
                          <div className="flex items-center gap-1 text-[10px]">
                            <span className="font-bold text-zinc-400 uppercase min-w-[55px]">RCA:</span>
                            <span className="text-zinc-200 font-semibold">{normalizarRCA(selectedParada.parada.rca)}</span>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] pt-0.5">
                          <div>
                            <span className="font-bold text-zinc-400 uppercase">BAIRRO: </span>
                            <span className="text-zinc-200 font-semibold">{selectedParada.parada.bairro || '--'}</span>
                          </div>
                          <div>
                            <span className="font-bold text-zinc-400 uppercase">MUNICÍPIO: </span>
                            <span className="text-zinc-200 font-semibold">{selectedParada.parada.municipio || '--'}</span>
                          </div>
                          <div>
                            <span className="font-bold text-zinc-400 uppercase">ESTADO: </span>
                            <span className="text-zinc-200 font-semibold">{selectedParada.parada.estado || 'BA'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Dados Operacionais e Horários em 3 Colunas */}
                      <div className="mt-2.5 pt-2 border-t border-zinc-800 grid grid-cols-1 sm:grid-cols-3 gap-x-3 gap-y-1.5 text-[10px]">
                        {/* Coluna 1: Seq. Prevista, Carregamento, Valor */}
                        <div className="space-y-1">
                          <div>
                            <span className="text-zinc-400 font-medium">Seq. Prevista: </span>
                            <strong className="text-zinc-200">{selectedParada.parada.sequenciaPrevista || (selectedParada.idx >= 0 ? selectedParada.idx + 1 : '--')}</strong>
                          </div>
                          <div>
                            <span className="text-zinc-400 font-medium">Carregamento: </span>
                            <strong className="text-zinc-200">{veiculo.carga && veiculo.carga !== 'SEM CARGA' ? veiculo.carga : '--'}</strong>
                          </div>
                          {selectedParada.parada.valorTotal !== undefined && selectedParada.parada.valorTotal > 0 && (
                            <div>
                              <span className="text-zinc-400 font-medium">Valor: </span>
                              <strong className="text-emerald-400 font-bold">
                                R$ {Number(selectedParada.parada.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </strong>
                            </div>
                          )}
                        </div>

                        {/* Coluna 2: Seq. Realizada, Rota / Praça, Peso */}
                        <div className="space-y-1">
                          <div>
                            <span className="text-zinc-400 font-medium">Seq. Realizada: </span>
                            <strong className="text-zinc-200">{selectedParada.idx >= 0 && selectedParada.idx < 900 ? selectedParada.idx + 1 : '--'}</strong>
                          </div>
                          <div>
                            <span className="text-zinc-400 font-medium">Rota / Praça: </span>
                            <strong className="text-zinc-200">{selectedParada.parada.praca || selectedParada.parada.rota || '--'}</strong>
                          </div>
                          {selectedParada.parada.pesoTotal !== undefined && selectedParada.parada.pesoTotal > 0 && (
                            <div>
                              <span className="text-zinc-400 font-medium">Peso: </span>
                              <strong className="text-zinc-200">{Number(selectedParada.parada.pesoTotal).toFixed(2)} Kg</strong>
                            </div>
                          )}
                        </div>

                        {/* Coluna 3: Check-in, Check-out, Permanência */}
                        <div className="space-y-1">
                          <div>
                            <span className="text-zinc-400 font-medium">Check-in: </span>
                            <strong className="text-info font-mono font-bold">
                              {selectedParada.parada.horaChegada ? formatarDataHora(selectedParada.parada.horaChegada) : '--/-- --:--'}
                            </strong>
                          </div>
                          <div>
                            <span className="text-zinc-400 font-medium">Check-out: </span>
                            <strong className="text-emerald-400 font-mono font-bold">
                              {selectedParada.parada.horaSaida ? formatarDataHora(selectedParada.parada.horaSaida) : '--/-- --:--'}
                            </strong>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-zinc-400 font-medium">Permanência: </span>
                            <strong className="text-primary font-mono font-bold">
                              {selectedParada.parada.tempoFormatado || (selectedParada.parada.horaChegada && selectedParada.parada.horaSaida ? `${Math.round((new Date(selectedParada.parada.horaSaida) - new Date(selectedParada.parada.horaChegada)) / 60000)} min` : '--')}
                            </strong>
                          </div>
                        </div>
                      </div>

                      {/* Linha de Ações: Ver Itens, Mudar Placa, Mudar Data e Maps */}
                      {!selectedParada.parada.isCd && !selectedParada.parada.isFim && (
                        <div className="mt-2.5 pt-2 border-t border-zinc-800 flex flex-wrap items-center gap-2">
                          {/* Botão Ver Itens */}
                          <button
                            type="button"
                            onClick={() => setMostrarItens(prev => !prev)}
                            className={cn(
                              "inline-flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] font-bold px-2.5 sm:px-3 py-1.5 rounded-lg border transition-all shadow-sm active:scale-95 cursor-pointer",
                              mostrarItens 
                                ? "bg-primary text-white border-primary shadow-primary/20" 
                                : "bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 hover:text-white border-zinc-700"
                            )}
                            title={mostrarItens ? "Ocultar itens detalhados da nota" : "Visualizar itens da nota fiscal"}
                          >
                            <PackageIcon size={12} className={mostrarItens ? "text-white" : "text-primary"} />
                            <span>{mostrarItens ? "Ocultar Itens" : "Ver Itens"}</span>
                            {itensLista.length > 0 && (
                              <span className={cn(
                                "ml-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-black",
                                mostrarItens ? "bg-white/20 text-white" : "bg-primary/20 text-primary border border-primary/30"
                              )}>
                                {itensLista.length}
                              </span>
                            )}
                          </button>

                          {/* Botão Mudar Placa */}
                          <button
                            type="button"
                            onClick={() => {
                              setNovaPlacaModal('');
                              setDropdownPlacasAberto(false);
                              setModalMudarPlaca(true);
                            }}
                            className="inline-flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] font-bold px-2.5 sm:px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 hover:text-white transition-all shadow-sm active:scale-95 cursor-pointer"
                            title="Transferir esta entrega para outra placa"
                          >
                            <ArrowRightLeft size={12} className="text-amber-400" />
                            <span>Mudar Placa</span>
                          </button>

                          {/* Botão Mudar Data */}
                          <button
                            type="button"
                            onClick={() => {
                              setNovaDataModal(selectedParada.parada.data || veiculo.data || '');
                              setModalMudarData(true);
                            }}
                            className="inline-flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] font-bold px-2.5 sm:px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 hover:text-white transition-all shadow-sm active:scale-95 cursor-pointer"
                            title="Alterar a data operacional de entrega"
                          >
                            <Calendar size={12} className="text-purple-400" />
                            <span>Mudar Data</span>
                          </button>

                          {/* Botão Maps */}
                          {(selectedParada.parada.endereco || selectedParada.parada.cliente) && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedParada.parada.endereco || selectedParada.parada.cliente}, ${selectedParada.parada.bairro || ''} ${selectedParada.parada.municipio || ''}`)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] font-bold text-info hover:text-white bg-info/10 hover:bg-info/30 px-2.5 sm:px-3 py-1.5 rounded-lg border border-info/30 transition-colors shadow-sm ml-auto"
                              title="Abrir rota no Google Maps"
                            >
                              <Navigation size={12} />
                              <span>Maps</span>
                              <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      )}

                      {/* SEÇÃO DE ITENS DA NF COM TABELA DETALHADA E TOTAIS (EXPANDE NO RODAPÉ APENAS QUANDO ATIVADO) */}
                      {!selectedParada.parada.isCd && !selectedParada.parada.isFim && mostrarItens && (
                        <div className="mt-2.5 pt-2 border-t border-zinc-800">
                          <div className="bg-zinc-950/90 rounded-xl border border-zinc-800 p-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
                            <div className="max-h-52 overflow-y-auto pr-1">
                              <table className="w-full text-[10px] border-collapse">
                                <thead>
                                  <tr className="border-b border-zinc-800 text-zinc-400 font-extrabold uppercase tracking-wider text-left">
                                    <th className="py-1 px-1.5">Cód</th>
                                    <th className="py-1 px-1.5">Produto / Descrição</th>
                                    <th className="py-1 px-1.5 text-right">Cx</th>
                                    <th className="py-1 px-1.5 text-right">Peso (kg)</th>
                                    <th className="py-1 px-1.5 text-right">Valor (R$)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800/60">
                                  {itensLista.map((it, itIdx) => (
                                    <tr key={itIdx} className="hover:bg-zinc-800/40 transition-colors">
                                      <td className="py-1 px-1.5 font-mono text-zinc-400 whitespace-nowrap">
                                        {it.codigo}
                                      </td>
                                      <td className="py-1 px-1.5 text-zinc-100 font-medium break-words">
                                        {it.descricao}
                                        {selectedParada.parada.notas?.length > 1 && (
                                          <span className="ml-1.5 text-[9px] font-mono text-amber-400 bg-amber-400/10 px-1 rounded">
                                            NF {it.nota}
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-1 px-1.5 text-right font-bold text-zinc-200 whitespace-nowrap">
                                        {it.qtd}
                                      </td>
                                      <td className="py-1 px-1.5 text-right font-mono text-zinc-300 whitespace-nowrap">
                                        {it.peso.toFixed(2)}
                                      </td>
                                      <td className="py-1 px-1.5 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                                        R$ {it.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="border-t-2 border-zinc-700 text-zinc-200 font-black bg-zinc-900/70">
                                    <td colSpan={2} className="py-1.5 px-1.5 uppercase text-zinc-400 text-[9px]">
                                      Totais ({itensLista.length} {itensLista.length === 1 ? 'item' : 'itens'})
                                    </td>
                                    <td className="py-1.5 px-1.5 text-right text-white font-bold whitespace-nowrap">
                                      {totalQtdItens}
                                    </td>
                                    <td className="py-1.5 px-1.5 text-right text-zinc-100 font-mono whitespace-nowrap">
                                      {totalPesoItens.toFixed(2)} kg
                                    </td>
                                    <td className="py-1.5 px-1.5 text-right text-emerald-400 font-mono whitespace-nowrap">
                                      R$ {totalValorItens.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          );
        })}
      </div>
      
      {/* Modal de Avaliação de Devolução disparado pelo Sino do Card */}
      {modalAvaliarPlaca && (
        <ModalAvaliarDevolucao
          isOpen={!!modalAvaliarPlaca}
          placa={modalAvaliarPlaca}
          onClose={() => setModalAvaliarPlaca(null)}
        />
      )}

      {/* Modal de Mudança de Placa da Parada Selecionada */}
      {modalMudarPlaca && selectedParada?.parada && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-background-primary dark:bg-zinc-900 border border-border-secondary rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border-secondary/60">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-info/10 text-info">
                  <ArrowRightLeft size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-text-primary">Mudar Placa da Entrega</h3>
                  <p className="text-[11px] text-text-tertiary">
                    {selectedParada.parada.notas?.length > 1 
                      ? `Transferir ${selectedParada.parada.notas.length} notas fiscais da parada`
                      : `NF: ${selectedParada.parada.notas?.[0]?.nota || selectedParada.parada.nota || '--'}`}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => { setModalMudarPlaca(false); setNovaPlacaModal(''); setDropdownPlacasAberto(false); }}
                className="text-text-tertiary hover:text-text-primary p-1.5 rounded-lg hover:bg-background-secondary transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-background-secondary/60 p-3 rounded-xl border border-border-secondary/60 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-text-tertiary font-medium">Cliente:</span>
                  <span className="text-text-primary font-bold">{selectedParada.parada.cliente}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-tertiary font-medium">Placa Atual:</span>
                  <span className="text-amber-500 font-mono font-black">{selectedParada.veiculoKey?.split('_')?.[0] || '--'}</span>
                </div>
              </div>

              <label className="block text-xs font-bold text-text-secondary">
                Selecione ou digite a nova placa:
              </label>

              {/* Seletor com Autocomplete de Largura Total */}
              <div className="relative w-full">
                <input
                  type="text"
                  placeholder="Ex: ABC1D23 ou selecione..."
                  value={novaPlacaModal}
                  onChange={(e) => {
                    setNovaPlacaModal(e.target.value.toUpperCase());
                    if (!dropdownPlacasAberto) setDropdownPlacasAberto(true);
                  }}
                  onFocus={() => setDropdownPlacasAberto(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && novaPlacaModal.trim()) {
                      e.preventDefault();
                      handleTransferirPlacaParada(novaPlacaModal);
                    }
                  }}
                  className="w-full bg-background-secondary border border-border-tertiary focus:border-info rounded-xl py-2.5 pl-3.5 pr-9 text-xs font-bold text-text-primary focus:ring-2 focus:ring-info uppercase outline-none font-mono tracking-wider transition-all placeholder:text-text-tertiary"
                  autoFocus
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setDropdownPlacasAberto(prev => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
                >
                  <ChevronDown size={16} className={cn("transition-transform duration-150", dropdownPlacasAberto && "rotate-180 text-info")} />
                </button>

                {/* Dropdown com a Largura Exata da Barra (w-full) */}
                {dropdownPlacasAberto && (() => {
                  const busca = (novaPlacaModal || '').trim().toUpperCase();
                  const placasFiltradas = todasPlacasSistema.filter(p => p.includes(busca));

                  return (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setDropdownPlacasAberto(false)} 
                      />

                      <div className="absolute top-full left-0 right-0 w-full mt-1 z-50 bg-background-primary dark:bg-zinc-900 border border-border-secondary rounded-xl shadow-2xl max-h-48 overflow-y-auto custom-scrollbar p-1 divide-y divide-border-secondary/30 animate-in fade-in zoom-in-95 duration-100">
                        {placasFiltradas.length > 0 ? (
                          placasFiltradas.map(p => {
                            const isSelected = busca === p;
                            return (
                              <button
                                key={p}
                                type="button"
                                onClick={() => {
                                  setNovaPlacaModal(p);
                                  setDropdownPlacasAberto(false);
                                }}
                                className={cn(
                                  "w-full text-left px-3 py-2 rounded-lg text-xs font-mono font-bold transition-colors flex items-center justify-between cursor-pointer",
                                  isSelected
                                    ? "bg-info text-white font-black"
                                    : "text-text-primary hover:bg-background-secondary hover:text-info"
                                )}
                              >
                                <span>{p}</span>
                                {isSelected && <CheckCircle2 size={13} className="text-white" />}
                              </button>
                            );
                          })
                        ) : (
                          <div className="px-3 py-2 text-center text-xs text-text-tertiary font-medium">
                            {busca ? (
                              <span>Placa não cadastrada. Clique em <strong>Confirmar</strong> para usar <strong>{busca}</strong></span>
                            ) : (
                              <span>Nenhuma placa cadastrada</span>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5 pt-3 border-t border-border-secondary/60">
              <button 
                onClick={() => { setModalMudarPlaca(false); setNovaPlacaModal(''); setDropdownPlacasAberto(false); }} 
                className="px-3.5 py-2 text-xs font-bold text-text-secondary hover:bg-border-tertiary rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                disabled={!novaPlacaModal.trim()}
                onClick={() => handleTransferirPlacaParada(novaPlacaModal)}
                className="bg-info text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Mudança de Data da Parada Selecionada */}
      {modalMudarData && selectedParada?.parada && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-background-primary dark:bg-zinc-900 border border-border-secondary rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border-secondary/60">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                  <Calendar size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-text-primary">Mudar Data da Entrega</h3>
                  <p className="text-[11px] text-text-tertiary">
                    {selectedParada.parada.notas?.length > 1 
                      ? `Reagendar ${selectedParada.parada.notas.length} notas fiscais da parada`
                      : `NF: ${selectedParada.parada.notas?.[0]?.nota || selectedParada.parada.nota || '--'}`}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => { setModalMudarData(false); setNovaDataModal(''); }}
                className="text-text-tertiary hover:text-text-primary p-1.5 rounded-lg hover:bg-background-secondary transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-background-secondary/60 p-3 rounded-xl border border-border-secondary/60 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-text-tertiary font-medium">Cliente:</span>
                  <span className="text-text-primary font-bold">{selectedParada.parada.cliente}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-tertiary font-medium">Data de Faturamento (Raiz):</span>
                  <span className="text-zinc-300 font-mono font-bold">
                    {formatarData(selectedParada.parada.dataFaturamento || selectedParada.parada.data)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-tertiary font-medium">Data Operacional Atual:</span>
                  <span className="text-purple-400 font-mono font-bold">
                    {formatarData(selectedParada.parada.data)}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-text-secondary">
                  Nova Data de Entrega (Operacional):
                </label>
                <input
                  type="date"
                  value={novaDataModal}
                  onChange={(e) => setNovaDataModal(e.target.value)}
                  className="w-full bg-background-secondary border border-border-tertiary focus:border-purple-500 rounded-xl py-2.5 px-3.5 text-xs font-bold text-text-primary focus:ring-2 focus:ring-purple-500 outline-none transition-all cursor-pointer"
                  autoFocus
                />
              </div>

              {/* Botões rápidos de data */}
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const hoje = new Date().toISOString().split('T')[0];
                    setNovaDataModal(hoje);
                  }}
                  className="flex-1 py-1.5 px-2 bg-background-secondary hover:bg-border-tertiary text-[11px] font-bold text-text-primary rounded-lg border border-border-tertiary transition-colors cursor-pointer text-center"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const am = new Date();
                    am.setDate(am.getDate() + 1);
                    setNovaDataModal(am.toISOString().split('T')[0]);
                  }}
                  className="flex-1 py-1.5 px-2 bg-background-secondary hover:bg-border-tertiary text-[11px] font-bold text-text-primary rounded-lg border border-border-tertiary transition-colors cursor-pointer text-center"
                >
                  Amanhã
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5 pt-3 border-t border-border-secondary/60">
              <button 
                onClick={() => { setModalMudarData(false); setNovaDataModal(''); }} 
                className="px-3.5 py-2 text-xs font-bold text-text-secondary hover:bg-border-tertiary rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                disabled={!novaDataModal}
                onClick={() => handleAlterarDataParada(novaDataModal)}
                className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
