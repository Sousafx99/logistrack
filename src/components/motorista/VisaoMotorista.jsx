import { useState, useMemo, useRef, useEffect } from 'react';
import { format, isBefore, parseISO, startOfDay } from 'date-fns';
import { Truck, MapPin, Package as PackageIcon, User, AlertTriangle, Calendar, Filter, ChevronDown, ChevronUp, FileText, Hash, Camera, CheckCircle, Loader2, DollarSign, Gauge, Map as MapIcon, Navigation, Compass, Clock, Timer, CheckCircle2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { STATUS_OPTIONS } from '../../data/mockData';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/utils';

const formatarHora = (isoStr) => {
  if (!isoStr) return '--:--';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
};

const formatarDataSegura = (dataStr, formato = 'dd/MM/yyyy') => {
  if (!dataStr) return '--/--/----';
  try {
    const d = typeof dataStr === 'string' ? parseISO(dataStr) : new Date(dataStr);
    if (isNaN(d.getTime())) return String(dataStr);
    return format(d, formato);
  } catch {
    return String(dataStr);
  }
};

const isDataAtrasada = (dataStr) => {
  if (!dataStr) return false;
  try {
    const d = typeof dataStr === 'string' ? parseISO(dataStr) : new Date(dataStr);
    if (isNaN(d.getTime())) return false;
    return isBefore(d, startOfDay(new Date()));
  } catch {
    return false;
  }
};
import { CargaSelectorModal } from '../ui/CargaSelectorModal';
import { DevolucaoModal } from '../ui/DevolucaoModal';
import { SolicitacaoDespesaModal } from './SolicitacaoDespesaModal';
import { PerfilMotoristaModal } from './PerfilMotoristaModal';
import { KmRegistroModal } from './KmRegistroModal';
import { SolicitarGeolocModal } from './SolicitarGeolocModal';
import { PontosEntregaSelectorModal } from '../ui/PontosEntregaSelectorModal';


export function VisaoMotorista() {
  const { 
    currentUser, 
    entregas = [], 
    despesas = [], 
    motoristas = [], 
    kmRegistros = [], 
    clientesGeoloc = [], 
    atualizarStatusEntrega, 
    cargasFinalizadas = [], 
    finalizarCarga, 
    registrarDevolucao, 
    solicitarDevolucaoMotorista, 
    solicitarDespesa, 
    salvarPerfilMotorista 
  } = useStore();
  
  const userPlaca = currentUser?.placa ? String(currentUser.placa).trim().toUpperCase() : '';

  const cargasDisponiveis = useMemo(() => {
    const map = new Map();
    (entregas || []).forEach(e => {
      const ePlaca = String(e.placa || '').trim().toUpperCase();
      if (!userPlaca || ePlaca !== userPlaca) return;
      const dataKey = e.data || '';
      const cargaKey = e.carga || 'Sem Carga';
      const key = `${dataKey}|${cargaKey}`;
      if (!map.has(key)) map.set(key, { data: dataKey, carga: cargaKey });
    });
    return Array.from(map.values()).sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
  }, [entregas, userPlaca]);

  const [filtroDiaCarga, setFiltroDiaCarga] = useState(() => {
    const hoje = format(new Date(), 'yyyy-MM-dd');
    const hojeNaoFinalizadas = cargasDisponiveis.filter(c => c.data === hoje && !(cargasFinalizadas || []).some(cf => cf.carga === c.carga && cf.data === c.data));
    if (hojeNaoFinalizadas.length > 0) return `${hojeNaoFinalizadas[0].data}|${hojeNaoFinalizadas[0].carga}`;
    if (cargasDisponiveis.length > 0) return `${cargasDisponiveis[0].data}|${cargasDisponiveis[0].carga}`;
    return '';
  });

  // Atualiza filtro de carga caso o estado inicial tenha sido vazio durante carregamento assíncrono
  useEffect(() => {
    if (!filtroDiaCarga && cargasDisponiveis.length > 0) {
      const hoje = format(new Date(), 'yyyy-MM-dd');
      const hojeNaoFinalizadas = cargasDisponiveis.filter(c => c.data === hoje && !(cargasFinalizadas || []).some(cf => cf.carga === c.carga && cf.data === c.data));
      if (hojeNaoFinalizadas.length > 0) {
        setFiltroDiaCarga(`${hojeNaoFinalizadas[0].data}|${hojeNaoFinalizadas[0].carga}`);
      } else {
        setFiltroDiaCarga(`${cargasDisponiveis[0].data}|${cargasDisponiveis[0].carga}`);
      }
    }
  }, [cargasDisponiveis, filtroDiaCarga, cargasFinalizadas]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filtroStatusVisao, setFiltroStatusVisao] = useState('Em Aberto');
  
  const [expandidoId, setExpandidoId] = useState(null);
  const [clientesExpandidos, setClientesExpandidos] = useState({});
  const [devolucaoEmAndamento, setDevolucaoEmAndamento] = useState(null);
  const [modalKmOpen, setModalKmOpen] = useState(false);
  const [modoKm, setModoKm] = useState('ajuste');
  const [hasPromptedKmInicial, setHasPromptedKmInicial] = useState(false);
  const [modalDespesaOpen, setModalDespesaOpen] = useState(false);
  const [modalPerfilOpen, setModalPerfilOpen] = useState(false);
  const [hasPromptedProfile, setHasPromptedProfile] = useState(false);
  const [clienteParaGeoloc, setClienteParaGeoloc] = useState(null);
  const [modalPontosOpen, setModalPontosOpen] = useState(false);
  const [clienteParaPontos, setClienteParaPontos] = useState(null);
  const [salvandoFoto, setSalvandoFoto] = useState(false);
  const fileInputRef = useRef(null);

  const motoristaAtual = useMemo(() => (motoristas || []).find(m => String(m.placa || '').trim().toUpperCase() === userPlaca), [motoristas, userPlaca]);
  
  useEffect(() => {
    if (userPlaca && !hasPromptedProfile) {
      if (!motoristaAtual || !motoristaAtual.nome || !motoristaAtual.whatsapp) {
        setModalPerfilOpen(true);
      }
      setHasPromptedProfile(true);
    }
  }, [userPlaca, motoristaAtual, hasPromptedProfile]);

  const minhasDespesas = (despesas || []).filter(d => userPlaca && String(d.motorista_placa || '').trim().toUpperCase() === userPlaca);

  const [dataSelecionada, cargaSelecionada] = filtroDiaCarga ? filtroDiaCarga.split('|') : ['', ''];
  const isCargaFinalizada = (cargasFinalizadas || []).some(cf => cf.carga === cargaSelecionada && cf.data === dataSelecionada);

  const docIdKm = `${dataSelecionada}_${(userPlaca || 'sem-placa').replace(/[\/\\]/g, '-')}_${(cargaSelecionada || 'sem-carga').replace(/[\/\\]/g, '-')}`;
  const kmRegistroAtual = useMemo(() => (kmRegistros || []).find(k => k.id === docIdKm), [kmRegistros, docIdKm]);

  // Prompt automático para KM Inicial ao iniciar a rota do dia se ainda não preenchido
  useEffect(() => {
    if (dataSelecionada && userPlaca && !isCargaFinalizada && !hasPromptedKmInicial) {
      if (kmRegistroAtual && (kmRegistroAtual.kmInicial === null || kmRegistroAtual.kmInicial === undefined)) {
        setModoKm('inicial');
        setModalKmOpen(true);
        setHasPromptedKmInicial(true);
      } else if (!kmRegistroAtual && filtroDiaCarga) {
        setModoKm('inicial');
        setModalKmOpen(true);
        setHasPromptedKmInicial(true);
      }
    }
  }, [dataSelecionada, userPlaca, isCargaFinalizada, kmRegistroAtual, hasPromptedKmInicial, filtroDiaCarga]);

  const entregasDaCargaAtual = useMemo(() => {
    return (entregas || [])
      .filter(e => {
        const ePlaca = String(e.placa || '').trim().toUpperCase();
        return userPlaca && ePlaca === userPlaca && e.data === dataSelecionada && (e.carga || 'Sem Carga') === cargaSelecionada;
      })
      .sort((a, b) => (Number(a.sequencia) || 0) - (Number(b.sequencia) || 0));
  }, [entregas, userPlaca, dataSelecionada, cargaSelecionada]);

  const todosFinalizadosNaCarga = entregasDaCargaAtual.length > 0 && entregasDaCargaAtual.every(e => 
    !['Pendente', 'No cliente', 'Descarregando'].includes(e.status)
  );

  const entregasFiltradas = useMemo(() => {
    if (!filtroDiaCarga) return [];

    return (entregas || []).filter(e => {
      const ePlaca = String(e.placa || '').trim().toUpperCase();
      if (!userPlaca || ePlaca !== userPlaca) return false;
      if (e.status === 'No estoque') return false;

      const isDataCargaCorreta = e.data === dataSelecionada && (e.carga || 'Sem Carga') === cargaSelecionada;
      
      const isAtrasadaPendente = isDataAtrasada(e.data) && 
        !['Entrega total', 'Entrega parcial', 'Devolução total', 'Reentrega'].includes(e.status);

      const isRotaDestaAtrasadaFinalizada = (cargasFinalizadas || []).some(cf => cf.carga === (e.carga || 'Sem Carga') && cf.data === e.data);

      if (!isDataCargaCorreta && (!isAtrasadaPendente || isRotaDestaAtrasadaFinalizada)) return false;

      const status = e.status;
      const finalizadas = ['Entrega total', 'Entrega parcial', 'Devolução total', 'Reentrega', 'Carga parada'];

      switch (filtroStatusVisao) {
        case 'Em Aberto': return !finalizadas.includes(status) || isAtrasadaPendente;
        case 'Pendente': return status === 'Pendente';
        case 'No cliente': return status === 'No cliente' || status === 'Descarregando';
        case 'Entregue': return status === 'Entrega total';
        case 'Carga parada': return status === 'Carga parada';
        case 'Devolução': return status === 'Devolução total' || status === 'Entrega parcial';
        case 'Reentrega': return status === 'Reentrega';
        default: return true;
      }
    });
  }, [entregas, filtroDiaCarga, filtroStatusVisao, userPlaca, dataSelecionada, cargaSelecionada, cargasFinalizadas]);

  const clientesAgrupados = useMemo(() => {
    const map = new Map();
    (entregasFiltradas || []).forEach(entrega => {
      const key = `${entrega.codCliente || ''}-${entrega.cliente || 'Sem Cliente'}`;
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
      'Em Aberto': entregasDaCargaAtual.filter(e => !['Entrega total', 'Entrega parcial', 'Devolução total', 'Reentrega', 'Carga parada'].includes(e.status)).length,
      'Pendente': entregasDaCargaAtual.filter(e => e.status === 'Pendente').length,
      'No cliente': entregasDaCargaAtual.filter(e => ['No cliente', 'Descarregando'].includes(e.status)).length,
      'Entregue': entregasDaCargaAtual.filter(e => e.status === 'Entrega total').length,
      'Carga parada': entregasDaCargaAtual.filter(e => e.status === 'Carga parada').length,
      'Devolução': entregasDaCargaAtual.filter(e => ['Devolução total', 'Entrega parcial'].includes(e.status)).length,
      'Reentrega': entregasDaCargaAtual.filter(e => e.status === 'Reentrega').length,
    };
  }, [entregasDaCargaAtual]);

  // Exibe apenas os botões de status que possuem contagem maior que 0
  const opcoesStatusVisiveis = useMemo(() => {
    const TODAS = ['Em Aberto', 'Pendente', 'No cliente', 'Entregue', 'Carga parada', 'Devolução', 'Reentrega'];
    return TODAS.filter(visao => (stats[visao] || 0) > 0);
  }, [stats]);

  useEffect(() => {
    if (opcoesStatusVisiveis.length > 0 && !opcoesStatusVisiveis.includes(filtroStatusVisao)) {
      setFiltroStatusVisao(opcoesStatusVisiveis.includes('Em Aberto') ? 'Em Aberto' : opcoesStatusVisiveis[0]);
    }
  }, [opcoesStatusVisiveis, filtroStatusVisao]);

  const toggleDetalhes = (id) => setExpandidoId(expandidoId === id ? null : id);
  const toggleCliente = (id) => setClientesExpandidos(prev => ({...prev, [id]: !prev[id]}));

  const handleCaptureFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSalvandoFoto(true);
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = async () => {
          try {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1200;
            const scaleSize = Math.min(1, MAX_WIDTH / img.width);
            canvas.width = img.width * scaleSize;
            canvas.height = img.height * scaleSize;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            await finalizarCarga(cargaSelecionada, dataSelecionada, dataUrl, currentUser?.placa);
            alert('Rota finalizada com sucesso! Canhoteira salva na nuvem.');
          } catch (err) {
            console.error('Erro ao processar imagem:', err);
            alert('Houve um erro ao enviar a imagem. Tente novamente.');
          } finally {
            setSalvandoFoto(false);
          }
        };
        img.onerror = () => {
          alert('Erro ao carregar o arquivo de imagem.');
          setSalvandoFoto(false);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setSalvandoFoto(false);
    }
  };


  const handleStatusChange = (entrega, novoStatus) => {
    if (novoStatus === 'Devolução total' || novoStatus === 'Entrega parcial' || novoStatus === 'Reentrega') {
      const tipo = novoStatus === 'Devolução total' ? 'Total' : novoStatus === 'Entrega parcial' ? 'Parcial' : 'Reentrega';
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

      {/* Card Unificado Compacto: Seletor de Carga e Ações Rápidas (KM, Reembolso, Perfil) */}
      <div className={cn(
        "glass-panel p-3 rounded-xl border border-border-secondary shadow-sm space-y-2.5",
        isCargaFinalizada ? "border-success/40" : ""
      )}>
        {/* Seletor de Carga / Data */}
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-between w-full text-left active:scale-[0.99] transition-transform group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={cn(
              "p-2 rounded-lg flex-shrink-0 transition-colors",
              isCargaFinalizada ? "bg-success/15 text-success" : "bg-info/15 text-info"
            )}>
              {isCargaFinalizada ? <CheckCircle size={18} /> : <Calendar size={18} />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-text-primary">
                  {filtroDiaCarga ? formatarDataSegura(dataSelecionada) : 'Selecione uma Carga'}
                </span>
                {isCargaFinalizada && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-success/20 text-success rounded">Finalizada</span>
                )}
              </div>
              <div className="text-xs text-text-secondary font-medium truncate">
                Carga: <span className="font-semibold text-text-primary">{cargaSelecionada || 'Nenhuma'}</span>
                {stats.total > 0 && <span className="ml-2 text-text-tertiary">({stats.total} notas)</span>}
              </div>
            </div>
          </div>
          <ChevronDown size={18} className="text-text-tertiary group-hover:text-text-primary transition-colors flex-shrink-0" />
        </button>

        {/* Barra de Ações Rápidas Compacta (KM, Reembolso, Perfil) */}
        {filtroDiaCarga && (
          <div className="pt-2 border-t border-border-tertiary grid grid-cols-3 gap-1.5 text-xs font-semibold">
            {/* Botão KM */}
            <button
              onClick={() => {
                setModoKm('ajuste');
                setModalKmOpen(true);
              }}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-background-secondary hover:bg-background-tertiary border border-border-tertiary text-text-primary active:scale-95 transition-all text-center"
              title="Controle de KM da Rota"
            >
              <Gauge size={14} className={kmRegistroAtual?.kmInicial ? "text-info" : "text-warning"} />
              <span className="truncate text-[11px]">
                {kmRegistroAtual?.kmExecutado != null 
                  ? `${kmRegistroAtual.kmExecutado} km` 
                  : kmRegistroAtual?.kmInicial 
                    ? `KM: ${kmRegistroAtual.kmInicial}` 
                    : 'KM'}
              </span>
            </button>

            {/* Botão Reembolso */}
            <button
              onClick={() => setModalDespesaOpen(true)}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-background-secondary hover:bg-background-tertiary border border-border-tertiary text-text-primary active:scale-95 transition-all text-center"
              title="Solicitar Reembolso / Despesa"
            >
              <DollarSign size={14} className="text-success" />
              <span className="truncate text-[11px]">Reembolso</span>
            </button>

            {/* Botão Perfil */}
            <button
              onClick={() => setModalPerfilOpen(true)}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-background-secondary hover:bg-background-tertiary border border-border-tertiary text-text-primary active:scale-95 transition-all text-center"
              title="Perfil do Motorista"
            >
              <User size={14} className={motoristaAtual?.nome ? "text-primary" : "text-warning"} />
              <span className="truncate text-[11px]">{motoristaAtual?.nome ? 'Perfil' : 'Completar'}</span>
            </button>
          </div>
        )}
      </div>

      {minhasDespesas.length > 0 && (
        <div className="glass-panel p-2.5 rounded-xl border border-border-secondary">
           <h4 className="text-[11px] font-bold text-text-tertiary uppercase mb-1.5">Minhas Solicitações Recentes</h4>
           <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
             {minhasDespesas.slice().reverse().slice(0, 2).map(d => (
               <div key={d.id} className="flex justify-between items-center text-xs p-1.5 bg-background-secondary rounded-lg border border-border-tertiary">
                 <div className="truncate pr-2">
                   <span className="font-bold text-text-primary mr-1.5">{d.tipo}</span>
                   <span className="text-[11px] text-text-tertiary font-medium">R$ {(Number(d.valor) || 0).toFixed(2)}</span>
                 </div>
                 <Badge status={d.status}>{d.status}</Badge>
               </div>
             ))}
           </div>
        </div>
      )}

      {/* Filtros de Status (Apenas exibidos quando contagem > 0) */}
      {opcoesStatusVisiveis.length > 0 && (
        <div className="flex space-x-2 overflow-x-auto hide-scrollbar pb-1">
          {opcoesStatusVisiveis.map(visao => (
            <button
              key={visao}
              onClick={() => setFiltroStatusVisao(visao)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors shadow-xs",
                filtroStatusVisao === visao 
                  ? "bg-info text-white border-info shadow-sm" 
                  : "bg-background-primary text-text-secondary border-border-tertiary hover:bg-background-secondary"
              )}
            >
              {visao} ({stats[visao] || 0})
            </button>
          ))}
        </div>
      )}

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
            const isClienteExpanded = clientesExpandidos[grupo.id] !== false;
            const isExpanded = !!clientesExpandidos[grupo.id];

            const clienteCadastrado = (clientesGeoloc || []).find(c => 
              (c.codCliente && String(c.codCliente).trim() === String(grupo.codCliente).trim()) || 
              (c.id && String(c.id).trim() === String(grupo.codCliente).trim())
            );
            const pontos = clienteCadastrado?.pontos || [];
            const pontoPadrao = pontos.find(p => p.padrao) || pontos[0];
            const temPontos = pontos.length > 0;

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
                      <span className="block font-black text-info text-lg leading-none">{(Number(pesoTotal) || 0).toFixed(1)} <span className="text-[10px] font-bold text-text-tertiary">kg</span></span>
                      <span className="text-[10px] uppercase font-bold text-text-tertiary mt-1">{grupo.entregas.length} {grupo.entregas.length === 1 ? 'nota' : 'notas'}</span>
                      <div className="mt-2 bg-background-primary p-1 rounded-md border border-border-tertiary">
                        {isExpanded ? <ChevronUp size={16} className="text-text-primary" /> : <ChevronDown size={16} className="text-text-primary" />}
                      </div>
                   </div>
                </div>

                {/* Barra de Geolocalização / GPS */}
                <div className="bg-background-primary/40 px-4 py-2 border-b border-border-secondary flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {pontos.length === 1 && pontoPadrao ? (
                      <>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${pontoPadrao.lat},${pontoPadrao.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
                        >
                          <MapIcon size={13} /> Maps
                        </a>
                        <a
                          href={`https://waze.com/ul?ll=${pontoPadrao.lat},${pontoPadrao.lng}&navigate=yes`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 px-2.5 py-1 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
                        >
                          <Navigation size={13} /> Waze
                        </a>
                      </>
                    ) : pontos.length > 1 && pontoPadrao ? (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setClienteParaPontos({
                              clienteNome: grupo.cliente,
                              codCliente: grupo.codCliente,
                              pontos
                            });
                            setModalPontosOpen(true);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 bg-blue-500/15 hover:bg-blue-500/25 text-blue-600 dark:text-blue-400 border border-blue-500/30 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
                        >
                          <MapPin size={13} /> Locais ({pontos.length})
                        </button>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${pontoPadrao.lat},${pontoPadrao.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold transition-all"
                          title={`Ir para ${pontoPadrao.nomeLocal || 'Principal'}`}
                        >
                          <MapIcon size={13} /> Maps
                        </a>
                      </>
                    ) : (
                      <span className="text-[11px] text-text-tertiary italic flex items-center gap-1">
                        <Compass size={12} className="opacity-60" /> Sem GPS cadastrado
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setClienteParaGeoloc({
                        codCliente: grupo.codCliente,
                        cliente: grupo.cliente,
                        bairro: grupo.bairro,
                        endereco: grupo.entregas[0]?.endereco || ''
                      });
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 bg-background-primary hover:bg-background-secondary text-text-secondary hover:text-text-primary border border-border-tertiary rounded-lg text-xs font-semibold transition-all active:scale-95"
                    title="Capturar coordenadas do GPS no local"
                  >
                    <MapPin size={12} className="text-emerald-500" />
                    {temPontos ? 'Ajustar GPS' : 'Marcar GPS'}
                  </button>
                </div>

                {/* Lista de Notas Fiscais */}
                {isExpanded && (
                  <div className="p-3 space-y-3 bg-background-primary/30">
                  {grupo.entregas.map(entrega => {
                    const isExpanded = expandidoId === entrega.id;
                    const entregaAtrasada = isDataAtrasada(entrega.data);

                    return (
                      <div key={entrega.id} className={cn(
                        "bg-background-secondary rounded-lg p-3 border",
                        entregaAtrasada ? 'border-danger/30 shadow-sm' : 'border-border-tertiary'
                      )}>
                         {entregaAtrasada && (
                           <div className="flex items-center text-danger text-[10px] mb-2 font-bold uppercase tracking-wider">
                             <AlertTriangle size={12} className="mr-1 flex-shrink-0" />
                             Nota Antiga ({formatarDataSegura(entrega.data)})
                           </div>
                         )}

                         {/* Header da Nota */}
                         <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center space-x-2">
                               <h4 className="font-bold text-text-primary text-sm">NF: {entrega.nota}</h4>
                               <Badge status={entrega.status}>{entrega.status}</Badge>
                            </div>
                            <span className="font-bold text-text-primary text-xs">{(Number(entrega.peso) || 0).toFixed(1)} kg</span>
                         </div>
                         
                         {/* Outros dados (Pedido, RCA) */}
                         <div className="flex gap-4 text-[11px] text-text-tertiary mb-3 font-medium">
                            <div className="flex items-center"><FileText size={12} className="mr-1 opacity-70" /> Ped: {entrega.pedido || 'N/A'}</div>
                            <div className="flex items-center"><User size={12} className="mr-1 opacity-70" /> RCA: {entrega.rca || 'N/A'}</div>
                         </div>

                         {/* Horários da Nota se preenchidos */}
                         {(entrega.horaChegada || entrega.horaSaida) && (
                           <div className="flex flex-wrap items-center gap-3 text-[11px] text-text-secondary bg-background-primary/40 px-2.5 py-1.5 rounded-lg border border-border-tertiary mb-3">
                             {entrega.horaChegada && (
                               <div className="flex items-center gap-1">
                                 <Clock size={12} className="text-info" />
                                 <span>Chegada: <strong>{formatarHora(entrega.horaChegada)}</strong></span>
                               </div>
                             )}
                             {entrega.horaSaida && (
                               <div className="flex items-center gap-1">
                                 <CheckCircle2 size={12} className="text-success" />
                                 <span>Saída: <strong>{formatarHora(entrega.horaSaida)}</strong></span>
                               </div>
                             )}
                             {entrega.tempoFormatado && (
                               <div className="flex items-center gap-1 font-bold text-text-primary ml-auto">
                                 <Timer size={12} className="text-primary" />
                                 <span>{entrega.tempoFormatado}</span>
                               </div>
                             )}
                           </div>
                         )}

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
                                        <span className="text-text-tertiary text-[10px] font-medium">{(Number(item.peso) || 0).toFixed(3)} kg</span>
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

                          {/* Alerta de Solicitação Pendente de Autorização */}
                          {entrega.solicitacaoDevolucaoPendente && (
                            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold mb-3 animate-pulse">
                              <AlertTriangle size={16} className="shrink-0" />
                              <div className="flex-1">
                                <span className="block font-black">Aguardando autorização do Monitoramento</span>
                                <span className="text-[10px] opacity-80 font-normal">
                                  Solicitação de {entrega.solicitacaoDevolucaoTipo || 'Ocorrência'} enviada. Aguarde liberação do Monitoramento.
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Ações */}
                          <div className="pt-3 border-t border-border-secondary">
                            <label className="text-[10px] uppercase font-bold text-text-tertiary block mb-1.5">
                              {entrega.solicitacaoDevolucaoPendente ? 'Status (Aguardando Aprovação)' : 'Status da Nota'}
                            </label>
                            <select 
                              value={entrega.status}
                              onChange={(e) => handleStatusChange(entrega, e.target.value)}
                              disabled={isCargaFinalizada || entrega.solicitacaoDevolucaoPendente}
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
              disabled={salvandoFoto}
              onClick={() => {
                // Se o KM final ainda não foi registrado, abre o modal de KM Final antes de acionar a câmera
                if (kmRegistroAtual && (kmRegistroAtual.kmFinal === null || kmRegistroAtual.kmFinal === undefined)) {
                  setModoKm('final');
                  setModalKmOpen(true);
                } else if (!kmRegistroAtual) {
                  setModoKm('final');
                  setModalKmOpen(true);
                } else {
                  fileInputRef.current?.click();
                }
              }}
              className="w-full bg-success hover:bg-success/90 disabled:opacity-75 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-lg shadow-success/20"
            >
              {salvandoFoto ? (
                <>
                  <Loader2 className="mr-3 animate-spin" size={24} />
                  Enviando canhoteira para a nuvem...
                </>
              ) : (
                <>
                  <Camera className="mr-3" size={24} />
                  Finalizar Rota e Fotografar Canhoteira
                </>
              )}
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

      {/* Modal de Registro e Ajuste de KM */}
      <KmRegistroModal
        isOpen={modalKmOpen}
        onClose={() => setModalKmOpen(false)}
        data={dataSelecionada}
        placa={currentUser?.placa}
        carga={cargaSelecionada}
        modo={modoKm}
        onSuccess={() => {
          if (modoKm === 'final') {
            fileInputRef.current?.click();
          }
        }}
      />

      {devolucaoEmAndamento && (
        <DevolucaoModal 
          isOpen={true}
          entrega={devolucaoEmAndamento.entrega}
          tipo={devolucaoEmAndamento.tipo}
          isSolicitacao={true}
          onClose={() => setDevolucaoEmAndamento(null)}
          onConfirm={async (tipo, itens, motivo, extraData) => {
            await solicitarDevolucaoMotorista({
              entregaId: devolucaoEmAndamento.entrega.id,
              nota: devolucaoEmAndamento.entrega.nota,
              codCliente: devolucaoEmAndamento.entrega.codCliente,
              cliente: devolucaoEmAndamento.entrega.cliente,
              bairro: devolucaoEmAndamento.entrega.bairro,
              cidade: devolucaoEmAndamento.entrega.cidade,
              placa: currentUser?.placa || devolucaoEmAndamento.entrega.placa,
              motoristaNome: currentUser?.nome || devolucaoEmAndamento.entrega.motorista || '',
              carga: devolucaoEmAndamento.entrega.carga,
              data: devolucaoEmAndamento.entrega.data,
              tipo,
              motivo,
              itensDevolvidos: itens,
              pesoTotalDevolvido: extraData?.pesoTotalDevolvido || 0,
              observacao: extraData?.observacao || ''
            });
            setDevolucaoEmAndamento(null);
            alert('Solicitação de ocorrência enviada ao Monitoramento para aprovação!');
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

      <PerfilMotoristaModal
        isOpen={modalPerfilOpen}
        dadosIniciais={motoristaAtual}
        onClose={motoristaAtual?.nome ? () => setModalPerfilOpen(false) : null}
        onSave={async (dados) => {
          await salvarPerfilMotorista(dados);
          setModalPerfilOpen(false);
        }}
      />

      {/* Modal de Solicitação/Marcação de GPS pelo Motorista */}
      <SolicitarGeolocModal
        isOpen={!!clienteParaGeoloc}
        onClose={() => setClienteParaGeoloc(null)}
        cliente={clienteParaGeoloc}
        motoristaPlaca={currentUser?.placa}
        motoristaNome={motoristaAtual?.nome || ''}
        carga={cargaSelecionada}
        data={dataSelecionada}
      />

      {/* Modal de Múltiplos Pontos de Entrega (Maps / Waze) */}
      <PontosEntregaSelectorModal
        isOpen={modalPontosOpen}
        onClose={() => {
          setModalPontosOpen(false);
          setClienteParaPontos(null);
        }}
        clienteNome={clienteParaPontos?.clienteNome}
        codCliente={clienteParaPontos?.codCliente}
        pontos={clienteParaPontos?.pontos || []}
      />
    </div>
  );
}
