import { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { 
  Package, RotateCcw, FileText, LogOut, UploadCloud, 
  Truck, DollarSign, Gauge, Users, Layers, SlidersHorizontal, 
  MapPin, FileBarChart, Settings, X, ChevronRight, Bell, Clock,
  CheckCircle2, AlertTriangle, ArrowRight
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';
import { NotificationToastContainer } from '../ui/NotificationToast';
import { ModalAvaliarDevolucao } from '../monitoramento/ModalAvaliarDevolucao';

const VINTE_E_QUATRO_HORAS_MS = 24 * 60 * 60 * 1000;

const formatarTempoRestante = (dataAtendimentoIso) => {
  if (!dataAtendimentoIso) return '';
  try {
    const dataAtend = new Date(dataAtendimentoIso).getTime();
    const agora = Date.now();
    const restanteMs = (dataAtend + VINTE_E_QUATRO_HORAS_MS) - agora;
    if (restanteMs <= 0) return 'Expirado';
    const horas = Math.floor(restanteMs / (1000 * 60 * 60));
    const minutos = Math.floor((restanteMs % (1000 * 60 * 60)) / (1000 * 60));
    if (horas > 0) return `Expira em ${horas}h ${minutos}m`;
    return `Expira em ${minutos}m`;
  } catch {
    return '';
  }
};

const formatarDataHoraNotif = (isoStr) => {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return `${hora} (${data})`;
  } catch {
    return '';
  }
};

const getStatusNotifBadge = (statusSolicitacao) => {
  switch (statusSolicitacao) {
    case 'Pendente':
      return {
        label: 'Pendente',
        badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30 animate-pulse',
        dot: 'bg-amber-400'
      };
    case 'Aprovado':
    case 'Aprovada':
      return {
        label: 'Aprovada',
        badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        dot: 'bg-emerald-400'
      };
    case 'Alterado e Aprovado':
    case 'Alterada':
      return {
        label: 'Alterada',
        badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
        dot: 'bg-blue-400'
      };
    case 'Recusado':
    case 'Recusada':
    case 'Rejeitado':
    case 'Rejeitada':
      return {
        label: 'Recusada',
        badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
        dot: 'bg-rose-400'
      };
    default:
      return {
        label: statusSolicitacao || 'Info',
        badgeClass: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
        dot: 'bg-zinc-400'
      };
  }
};

const getTipoOcorrenciaBadge = (tipo) => {
  const t = String(tipo || 'Total').trim().toLowerCase();
  if (t.includes('parcial')) {
    return {
      label: 'Entrega Parcial',
      badgeClass: 'bg-orange-500/15 text-orange-400 border-orange-500/30'
    };
  }
  if (t.includes('reentrega')) {
    return {
      label: 'Reentrega',
      badgeClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30'
    };
  }
  return {
    label: 'Devolução Total',
    badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30'
  };
};

export function Layout({ children }) {
  const { currentUser, logout, solicitacoesGeoloc, solicitacoesDevolucao = [] } = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuConfigAberto, setMenuConfigAberto] = useState(false);
  const [menuNotificacoesAberto, setMenuNotificacoesAberto] = useState(false);
  const [modalDevolucaoPlaca, setModalDevolucaoPlaca] = useState(null);
  const [modalDevolucaoSolicitacaoId, setModalDevolucaoSolicitacaoId] = useState(null);
  const [modalDevolucaoGlobalOpen, setModalDevolucaoGlobalOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!currentUser) return <Navigate to="/login" />;

  const isMotorista = currentUser?.role === 'Motorista';
  const userPlaca = currentUser?.placa ? String(currentUser.placa).trim().toUpperCase() : '';
  const pendenciasGeoloc = (solicitacoesGeoloc || []).filter(s => s.status === 'pendente').length;
  
  // Pendências de devolução (Para monitoramento: todas; Para motorista: da sua placa)
  const pendenciasDevolucao = (solicitacoesDevolucao || []).filter(s => {
    const isPendente = s.statusSolicitacao === 'Pendente';
    if (!isMotorista) return isPendente;
    return isPendente && String(s.placa || '').trim().toUpperCase() === userPlaca;
  });

  const listaNotificacoes = useMemo(() => {
    const agora = Date.now();

    return [...(solicitacoesDevolucao || [])]
      .filter((s) => {
        // Se for motorista, exibe apenas solicitações da sua placa
        if (isMotorista) {
          const sPlaca = String(s.placa || '').trim().toUpperCase();
          if (userPlaca && sPlaca !== userPlaca) return false;
        }

        // Solicitações pendentes ficam disponíveis indefinidamente até serem atendidas
        if (s.statusSolicitacao === 'Pendente') return true;

        // Solicitações tratadas/atendidas ficam disponíveis por até 24h a contar do atendimento
        const dataAtendimento = s.respondidoEm || s.atualizadoEm || s.criadoEm || s.data;
        if (!dataAtendimento) return true;
        const diffMs = agora - new Date(dataAtendimento).getTime();
        return diffMs <= VINTE_E_QUATRO_HORAS_MS;
      })
      .sort((a, b) => {
        const timeA = new Date(a.respondidoEm || a.criadoEm || a.data || 0).getTime();
        const timeB = new Date(b.respondidoEm || b.criadoEm || b.data || 0).getTime();
        return timeB - timeA;
      });
  }, [solicitacoesDevolucao, isMotorista, userPlaca]);

  // Definição dos 3 Módulos Principais
  const modules = [
    {
      id: 'monitoramento',
      label: 'Monitoramento',
      icon: Layers,
      defaultPath: currentUser.role === 'Operacao' ? '/devolucoes' : '/',
      paths: ['/', '/relatorios', '/devolucoes', '/frota'],
      roles: ['Monitoramento', 'Operacao'],
      subItems: [
        { path: '/', label: 'Entregas', icon: Package, roles: ['Monitoramento'] },
        { path: '/relatorios', label: 'Relatórios', icon: FileBarChart, roles: ['Monitoramento'] },
        { path: '/devolucoes', label: 'Devoluções', icon: RotateCcw, roles: ['Monitoramento', 'Operacao'], badge: pendenciasDevolucao.length },
        { path: '/frota', label: 'Frota', icon: Truck, roles: ['Monitoramento', 'Operacao'] },
      ].filter(sub => sub.roles.includes(currentUser.role))
    },
    {
      id: 'controles',
      label: 'Controles',
      icon: SlidersHorizontal,
      defaultPath: '/custos',
      paths: ['/custos', '/km', '/canhotos'],
      roles: ['Monitoramento'],
      subItems: [
        { path: '/custos', label: 'Custos', icon: DollarSign, roles: ['Monitoramento'] },
        { path: '/km', label: 'KM', icon: Gauge, roles: ['Monitoramento'] },
        { path: '/canhotos', label: 'Canhotos', icon: FileText, roles: ['Monitoramento'] },
      ].filter(sub => sub.roles.includes(currentUser.role))
    },
    {
      id: 'clientes',
      label: 'Clientes',
      icon: Users,
      defaultPath: '/clientes',
      paths: ['/clientes'],
      roles: ['Monitoramento'],
      badge: pendenciasGeoloc,
      subItems: [
        { path: '/clientes', label: 'Base de Clientes & GPS', icon: MapPin, roles: ['Monitoramento'] },
      ].filter(sub => sub.roles.includes(currentUser.role))
    }
  ].filter(m => m.roles.includes(currentUser.role));

  // Identifica o módulo ativo atual
  const activeModule = modules.find(m => m.paths.includes(location.pathname)) || (location.pathname === '/importacao' ? {
    id: 'importacao',
    label: 'Importação',
    subItems: [{ path: '/importacao', label: 'Importação de Cargas', icon: UploadCloud }]
  } : (modules[0] || { id: 'default', label: '', subItems: [] }));

  return (
    <div className="flex flex-col min-h-screen bg-background-tertiary">
      {/* Topbar Principal com z-50 para sobrepor todo o conteúdo */}
      <header className="sticky top-0 z-50 bg-background-primary/95 backdrop-blur-md border-b border-border-secondary shadow-xs">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-2.5 relative z-20 flex items-center justify-between">
          
          {/* 1. LADO ESQUERDO: Nome e Logo sempre à esquerda */}
          <div className="flex items-center gap-3 shrink-0">
            <img 
              src="/logo.png" 
              alt="LogisTrack Logo" 
              className="w-8 h-8 sm:w-9 sm:h-9 object-contain rounded-full bg-white p-0.5 shadow-xs border border-border-secondary shrink-0" 
            />
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base sm:text-lg font-bold text-text-primary tracking-tight leading-none">
                  LogisTrack
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-info/10 text-info border border-info/20 leading-none">
                  {currentUser.role}
                </span>
              </div>
              {currentUser.placa && (
                <p className="text-[11px] text-text-secondary font-mono font-medium leading-none mt-1">
                  {currentUser.placa}
                </p>
              )}
            </div>
          </div>

          {/* 2. CENTRO: Seletores de modo SEMPRE centralizados (Desktop / Tablet) */}
          {!isMotorista && modules.length > 0 && (
            <div className="hidden md:flex items-center absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2">
              <nav className="flex items-center gap-1 bg-background-secondary/90 p-1 rounded-xl border border-border-secondary shadow-xs">
                {modules.map((mod) => {
                  const isModActive = activeModule?.id === mod.id;
                  const Icon = mod.icon;
                  
                  return (
                    <button
                      key={mod.id}
                      onClick={() => {
                        if (!mod.paths.includes(location.pathname)) {
                          navigate(mod.defaultPath);
                        }
                      }}
                      className={cn(
                        "relative flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer select-none",
                        isModActive 
                          ? "bg-info text-white shadow-xs" 
                          : "text-text-secondary hover:text-text-primary hover:bg-background-tertiary"
                      )}
                    >
                      <Icon size={15} className={cn(isModActive ? "stroke-[2.5px]" : "stroke-2")} />
                      <span>{mod.label}</span>
                      {mod.badge > 0 && (
                        <span className={cn(
                          "ml-0.5 px-1.5 py-0.2 text-[10px] font-bold rounded-full",
                          isModActive ? "bg-white text-info" : "bg-danger text-white animate-pulse"
                        )}>
                          {mod.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          )}

          {/* 3. LADO DIREITO: Notificações Popover + Configurações Popover + Sair */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Popover de Notificações / Histórico de Ocorrências (Disponível para Monitoramento e Motorista) */}
            <div className="relative">
              <button
                onClick={() => {
                  setMenuNotificacoesAberto(!menuNotificacoesAberto);
                  setMenuConfigAberto(false);
                }}
                title={
                  isMotorista 
                    ? (pendenciasDevolucao.length > 0 ? `${pendenciasDevolucao.length} solicitação(ões) em análise` : "Minhas Notificações")
                    : (pendenciasDevolucao.length > 0 ? `${pendenciasDevolucao.length} ocorrência(s) pendente(s) - Clique para ver` : "Notificações e Histórico")
                }
                className={cn(
                  "p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-background-secondary border border-border-secondary/60 transition-all cursor-pointer flex items-center gap-1.5 relative",
                  menuNotificacoesAberto && "bg-background-secondary text-text-primary border-border-secondary",
                  pendenciasDevolucao.length > 0 && "text-rose-500 bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/20"
                )}
              >
                <Bell size={18} className={pendenciasDevolucao.length > 0 ? "animate-bounce fill-rose-500/20" : ""} />
                {pendenciasDevolucao.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-rose-600 text-white rounded-full text-[9px] font-black flex items-center justify-center shadow-xs">
                    {pendenciasDevolucao.length}
                  </span>
                )}
              </button>

              {/* Dropdown Popover de Notificações & Histórico */}
              {menuNotificacoesAberto && (
                <>
                  <div 
                    className="fixed inset-0 z-[90]" 
                    onClick={() => setMenuNotificacoesAberto(false)} 
                  />
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 max-h-[85vh] flex flex-col z-[100] bg-background-primary border border-border-secondary rounded-2xl shadow-2xl p-3 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
                    {/* Header do Popover */}
                    <div className="px-2 py-1.5 border-b border-border-tertiary flex justify-between items-center mb-2 shrink-0">
                      <div>
                        <p className="text-xs font-bold text-text-primary">Notificações</p>
                      </div>
                      {pendenciasDevolucao.length > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 animate-pulse">
                          {pendenciasDevolucao.length} Pendente(s)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-background-secondary text-text-tertiary border border-border-tertiary">
                          {listaNotificacoes.length} no total
                        </span>
                      )}
                    </div>

                    {/* Lista de Notificações */}
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar max-h-[60vh]">
                      {listaNotificacoes.length === 0 ? (
                        <div className="text-center py-8 text-text-tertiary">
                          <Bell className="mx-auto h-8 w-8 mb-2 opacity-30" />
                          <p className="text-xs font-semibold">Nenhuma notificação registrada</p>
                        </div>
                      ) : (
                        listaNotificacoes.map((notif) => {
                          const statusBadge = getStatusNotifBadge(notif.statusSolicitacao);
                          const tipoBadge = getTipoOcorrenciaBadge(notif.tipo);
                          const isPendente = notif.statusSolicitacao === 'Pendente';

                          return (
                            <div 
                              key={notif.id}
                              className={cn(
                                "p-2.5 rounded-xl border text-xs transition-all space-y-1.5",
                                isPendente 
                                  ? "bg-background-secondary border-amber-500/40 shadow-xs ring-1 ring-amber-500/20" 
                                  : "bg-background-secondary/60 border-border-tertiary opacity-90 hover:opacity-100"
                              )}
                            >
                              {/* Topo do Card da Notificação */}
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-[11px] text-text-primary bg-background-primary px-1.5 py-0.5 rounded border border-border-secondary uppercase">
                                    {notif.placa || 'S/ Placa'}
                                  </span>
                                  <span className="text-[11px] font-bold text-info font-mono">
                                    NF: {notif.nota}
                                  </span>
                                </div>
                                <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1", statusBadge.badgeClass)}>
                                  <span className={cn("w-1.5 h-1.5 rounded-full", statusBadge.dot)} />
                                  {statusBadge.label}
                                </span>
                              </div>

                              {/* Dados da Ocorrência */}
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={cn("px-1.5 py-0.2 rounded text-[9px] font-bold border", tipoBadge.badgeClass)}>
                                    {tipoBadge.label}
                                  </span>
                                  <span className="text-[11px] font-bold text-text-primary truncate max-w-[200px]" title={notif.cliente}>
                                    {notif.cliente}
                                  </span>
                                </div>
                                <p className="text-[10px] text-text-secondary italic mt-1 line-clamp-2">
                                  "{notif.motivo || 'Motivo não detalhado'}"
                                </p>
                                {notif.observacaoMonitoramento && (
                                  <p className="text-[10px] text-text-tertiary mt-0.5">
                                    <strong>Obs Monitoramento:</strong> {notif.observacaoMonitoramento}
                                  </p>
                                )}
                              </div>

                              {/* Rodapé com Horário e Ação */}
                              <div className="flex justify-between items-center pt-1 border-t border-border-tertiary/60 text-[10px]">
                                <div className="flex items-center gap-1 text-text-tertiary">
                                  <Clock size={11} className="shrink-0 text-text-tertiary/70" />
                                  <span title={isPendente ? `Solicitado em ${formatarDataHoraNotif(notif.criadoEm || notif.data)}` : `Atendido em ${formatarDataHoraNotif(notif.respondidoEm || notif.atualizadoEm || notif.criadoEm)}`}>
                                    {isPendente 
                                      ? formatarDataHoraNotif(notif.criadoEm || notif.data)
                                      : (formatarTempoRestante(notif.respondidoEm || notif.atualizadoEm || notif.criadoEm || notif.data) || formatarDataHoraNotif(notif.respondidoEm || notif.criadoEm))
                                    }
                                  </span>
                                </div>
                                {isPendente && !isMotorista ? (
                                  <button
                                    onClick={() => {
                                      setModalDevolucaoSolicitacaoId(notif.id);
                                      setModalDevolucaoPlaca(notif.placa);
                                      setMenuNotificacoesAberto(false);
                                    }}
                                    className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-[10px] transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-1"
                                  >
                                    Avaliar Agora
                                    <ArrowRight size={11} />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setModalDevolucaoSolicitacaoId(notif.id);
                                      setModalDevolucaoPlaca(notif.placa);
                                      setMenuNotificacoesAberto(false);
                                    }}
                                    className="px-2 py-0.5 bg-background-primary hover:bg-background-tertiary border border-border-tertiary text-text-secondary rounded-lg font-medium text-[10px] transition-colors cursor-pointer"
                                  >
                                    Ver Ficha
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Dropdown Menu de Ferramentas / Configurações (Engrenagem - apenas para gestão) */}
            {!isMotorista && (
              <div className="relative">
                <button
                  onClick={() => {
                    setMenuConfigAberto(!menuConfigAberto);
                    setMenuNotificacoesAberto(false);
                  }}
                  title="Configurações e Ferramentas"
                  className={cn(
                    "p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-background-secondary border border-border-secondary/60 transition-colors cursor-pointer flex items-center gap-1.5",
                    menuConfigAberto && "bg-background-secondary text-text-primary border-border-secondary"
                  )}
                >
                  <Settings size={18} className={cn(menuConfigAberto ? "rotate-45 transition-transform duration-200" : "")} />
                </button>

                {/* Dropdown Popup do Menu de Ferramentas com z-[100] */}
                {menuConfigAberto && (
                  <>
                    <div 
                      className="fixed inset-0 z-[90]" 
                      onClick={() => setMenuConfigAberto(false)} 
                    />
                    <div className="absolute right-0 mt-2 w-64 z-[100] bg-background-primary border border-border-secondary rounded-xl shadow-2xl p-2.5 animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-2.5 py-2 border-b border-border-tertiary mb-1">
                        <p className="text-xs font-bold text-text-primary">Ferramentas & Ações</p>
                        <p className="text-[11px] text-text-secondary">Acesso rápido administrativo</p>
                      </div>

                      <div className="space-y-1">
                        <button
                          onClick={() => {
                            navigate('/importacao');
                            setMenuConfigAberto(false);
                          }}
                          className={cn(
                            "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer",
                            location.pathname === '/importacao' 
                              ? "bg-info/15 text-info font-semibold" 
                              : "text-text-primary hover:bg-background-secondary"
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            <UploadCloud size={16} className="text-info" />
                            <span>Importação de Cargas</span>
                          </div>
                          <ChevronRight size={14} className="text-text-muted" />
                        </button>
                      </div>

                      <div className="border-t border-border-tertiary my-1.5" />

                      <button
                        onClick={() => {
                          setMenuConfigAberto(false);
                          handleLogout();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-danger hover:bg-danger/10 transition-colors text-left cursor-pointer"
                      >
                        <LogOut size={16} />
                        <span>Sair do Sistema</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Botão de Logout Rápido apenas para Motorista (não tem menu de engrenagem) */}
            {isMotorista && (
              <button 
                onClick={handleLogout}
                title="Sair do sistema"
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-text-secondary hover:text-danger hover:bg-danger/10 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">Sair</span>
              </button>
            )}
          </div>
        </div>

        {/* 4. SUB-NAVBAR: Todas as 4 abas em uma única linha com z-10 */}
        {!isMotorista && activeModule && activeModule.subItems && activeModule.subItems.length > 0 && (
          <div className="bg-background-secondary/40 border-t border-border-secondary pt-2 px-1 sm:px-6 lg:px-8 relative z-10">
            <div className="w-full flex justify-center items-end">
              <div className="flex items-end gap-1 sm:gap-2 w-full sm:w-auto justify-center max-w-full">
                {activeModule.subItems.map((sub) => {
                  const isSubActive = location.pathname === sub.path;
                  const SubIcon = sub.icon;

                  return (
                    <button
                      key={sub.path}
                      onClick={() => navigate(sub.path)}
                      className={cn(
                        "relative flex-1 sm:flex-initial flex items-center justify-center gap-1 sm:gap-2 px-1.5 sm:px-6 py-2 sm:py-2.5 text-[11px] sm:text-sm rounded-t-xl transition-all cursor-pointer select-none min-w-0",
                        // Estética de aba de pasta com destaque claro para a ativa:
                        isSubActive 
                          ? "bg-background-tertiary text-info font-black border-t-2 border-x border-t-info border-x-border-secondary border-b-transparent shadow-xs -mb-[1px] z-10" 
                          : "bg-background-primary/30 hover:bg-background-secondary/70 text-text-tertiary opacity-65 hover:opacity-100 hover:text-text-primary font-medium border-t border-x border-transparent hover:border-border-secondary/40"
                      )}
                    >
                      <SubIcon 
                        size={14} 
                        className={cn(
                          "shrink-0",
                          isSubActive ? "text-info stroke-[2.5px]" : "text-text-tertiary stroke-2"
                        )} 
                      />
                      <span className="truncate">{sub.label}</span>
                      {sub.badge > 0 && (
                        <span className="ml-1 px-1.5 py-0.2 text-[9px] font-black rounded-full bg-rose-600 text-white animate-pulse">
                          {sub.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className={cn(
        "flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6",
        !isMotorista && "pb-24 md:pb-8"
      )}>
        <div className="w-full">
          {children}
        </div>
      </main>

      {/* Bottom Navigation Mobile (Para Monitoramento e Operação) */}
      {!isMotorista && (
        <nav className="md:hidden fixed bottom-0 w-full bg-background-primary/95 backdrop-blur-md border-t border-border-secondary pb-safe z-30 shadow-lg">
          <div className="flex justify-around items-center px-1 py-1.5">
            {modules.map((mod) => {
              const isModActive = activeModule?.id === mod.id;
              const Icon = mod.icon;
              
              return (
                <button
                  key={mod.id}
                  onClick={() => navigate(mod.defaultPath)}
                  className={cn(
                    "relative flex flex-col items-center p-1.5 rounded-lg min-w-[56px] transition-colors cursor-pointer",
                    isModActive ? "text-info font-semibold" : "text-text-secondary hover:text-text-primary"
                  )}
                >
                  <div className="relative">
                    <Icon size={20} className={cn("mb-0.5", isModActive ? "stroke-[2.5px]" : "stroke-2")} />
                    {mod.badge > 0 && (
                      <span className="absolute -top-1 -right-2 w-4 h-4 bg-danger text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                        {mod.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] tracking-tight">{mod.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* Toasts de Notificação Globais (5 segundos com áudio) */}
      <NotificationToastContainer />

      {/* Modal Global de Avaliação de Devoluções */}
      {(modalDevolucaoPlaca || modalDevolucaoSolicitacaoId || modalDevolucaoGlobalOpen) && (
        <ModalAvaliarDevolucao
          isOpen={!!modalDevolucaoPlaca || !!modalDevolucaoSolicitacaoId || modalDevolucaoGlobalOpen}
          placa={modalDevolucaoPlaca || undefined}
          solicitacaoId={modalDevolucaoSolicitacaoId || undefined}
          onClose={() => {
            setModalDevolucaoPlaca(null);
            setModalDevolucaoSolicitacaoId(null);
            setModalDevolucaoGlobalOpen(false);
          }}
        />
      )}
    </div>
  );
}


