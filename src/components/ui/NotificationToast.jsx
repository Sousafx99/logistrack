import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, X, RotateCcw, ArrowRight, Truck, CheckCircle2, 
  ShieldAlert, AlertTriangle, FileText, DollarSign, Wallet,
  Share2, MessageSquare
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { getTipoDevolucaoBadge } from '../../data/mockData';
import { ModalAvaliarDevolucao } from '../monitoramento/ModalAvaliarDevolucao';
import { ModalCardReembolso, formatarTextoReembolso } from './ModalCardReembolso';
import { cn } from '../../lib/utils';

// Função para reproduzir som de alarme/sirene urgente (toca exatamente 4 vezes em volume máximo e vibra) para o MONITORAMENTO
function playMonitoramentoSound() {
  // Disparar vibração no aparelho (4 pulsos sincronizados)
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([500, 180, 500, 180, 500, 180, 500]);
    } catch (e) {
      // Silencioso se bloqueado por permissão do navegador
    }
  }

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;
    
    // Compressor dinâmico para maximizar a potência sonora sem clipping
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-6, now);
    compressor.knee.setValueAtTime(10, now);
    compressor.ratio.setValueAtTime(12, now);
    compressor.attack.setValueAtTime(0.003, now);
    compressor.release.setValueAtTime(0.25, now);

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(1.0, now); // Volume máximo

    compressor.connect(masterGain);
    masterGain.connect(ctx.destination);

    const ciclosSirene = 4; // Toca 4 vezes
    const duracaoCiclo = 0.48; // ~480ms por ciclo
    const intervaloEntre = 0.18; // 180ms de intervalo

    for (let c = 0; c < ciclosSirene; c++) {
      const startTime = now + c * (duracaoCiclo + intervaloEntre);
      const endTime = startTime + duracaoCiclo;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(650, startTime);
      osc.frequency.exponentialRampToValueAtTime(1380, startTime + duracaoCiclo * 0.55);
      osc.frequency.exponentialRampToValueAtTime(720, endTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2400, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.95, startTime + 0.06);
      gain.gain.setValueAtTime(0.90, endTime - 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, endTime);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(compressor);

      osc.start(startTime);
      osc.stop(endTime);
    }
  } catch (e) {
    // Silencioso se bloqueado por autoplay policy
  }
}

// Função para reproduzir som de confirmação/resposta (toca exatamente 2 vezes em volume máximo e vibra) para o MOTORISTA
function playMotoristaSound(status) {
  // Disparar vibração no aparelho (2 pulsos)
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([400, 200, 400]);
    } catch (e) {
      // Silencioso se bloqueado por permissão do navegador
    }
  }

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;

    // Compressor dinâmico para encorpar o som e forçar volume no limite
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-6, now);
    compressor.knee.setValueAtTime(10, now);
    compressor.ratio.setValueAtTime(12, now);
    compressor.attack.setValueAtTime(0.003, now);
    compressor.release.setValueAtTime(0.25, now);

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(1.0, now); // Volume máximo

    compressor.connect(masterGain);
    masterGain.connect(ctx.destination);

    const isRecusado = status === 'Recusado' || status === 'Recusada' || status === 'Rejeitado' || status === 'Rejeitada';
    const ciclos = 2; // Toca 2 vezes para o motorista

    if (isRecusado) {
      const duracaoCiclo = 0.35;
      const intervaloCiclo = 0.20;

      for (let c = 0; c < ciclos; c++) {
        const cicloStart = now + c * (duracaoCiclo + intervaloCiclo);
        const tones = [580, 390];
        tones.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const startTime = cicloStart + idx * 0.16;
          const endTime = startTime + 0.15;

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, startTime);

          gain.gain.setValueAtTime(0.001, startTime);
          gain.gain.linearRampToValueAtTime(0.92, startTime + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, endTime);

          osc.connect(gain);
          gain.connect(compressor);

          osc.start(startTime);
          osc.stop(endTime);
        });
      }
    } else {
      // Chime harmônico de sucesso (2 ciclos)
      const duracaoCiclo = 0.45;
      const intervaloCiclo = 0.22;

      for (let c = 0; c < ciclos; c++) {
        const cicloStart = now + c * (duracaoCiclo + intervaloCiclo);
        const notes = [523.25, 659.25, 783.99, 1046.50]; // Dó, Mi, Sol, Dó agudo
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const startTime = cicloStart + idx * 0.09;
          const endTime = startTime + 0.25;

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, startTime);

          gain.gain.setValueAtTime(0.001, startTime);
          gain.gain.linearRampToValueAtTime(0.90, startTime + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, endTime);

          osc.connect(gain);
          gain.connect(compressor);

          osc.start(startTime);
          osc.stop(endTime);
        });
      }
    }
  } catch (e) {
    // Silencioso se bloqueado por autoplay policy
  }
}

export function NotificationToastContainer() {
  const { solicitacoesDevolucao = [], despesas = [], entregas = [], currentUser } = useStore();
  const navigate = useNavigate();
  const [toasts, setToasts] = useState([]); // Array de { id, item, categoria, roleTarget, progresso }
  const [modalAvaliacaoOpen, setModalAvaliacaoOpen] = useState(false);
  const [solicParaAvaliar, setSolicParaAvaliar] = useState(null);
  const [despesaParaCard, setDespesaParaCard] = useState(null);

  // Rastreamento para Devoluções
  const seenIdsMonitoramentoRef = useRef(new Set());
  const seenMotoristaStatusRef = useRef(new Map()); // id -> statusSolicitacao

  // Rastreamento para Despesas / Reembolsos
  const seenIdsDespesasMonitoramentoRef = useRef(new Set());
  const seenMotoristaDespesasStatusRef = useRef(new Map()); // id -> status

  const initialLoadRef = useRef(true);

  const isMonitoramento = currentUser?.role === 'Monitoramento' || currentUser?.role === 'Operacao';
  const isMotorista = currentUser?.role === 'Motorista';
  const userPlaca = currentUser?.placa ? String(currentUser.placa).trim().toUpperCase() : '';

  useEffect(() => {
    if (!currentUser) return;

    // --- 1. MONITORAMENTO: Detectar novas solicitações pendentes (Devoluções e Custos) ---
    if (isMonitoramento) {
      // A. Devoluções
      const pendentesDev = solicitacoesDevolucao.filter(s => s.statusSolicitacao === 'Pendente');
      if (initialLoadRef.current) {
        pendentesDev.forEach(s => seenIdsMonitoramentoRef.current.add(s.id));
      } else {
        pendentesDev.forEach(s => {
          if (!seenIdsMonitoramentoRef.current.has(s.id)) {
            seenIdsMonitoramentoRef.current.add(s.id);
            playMonitoramentoSound();
            adicionarToast(s, 'monitoramento', 'devolucao');
          }
        });
      }

      // B. Despesas / Reembolsos
      const pendentesDesp = (despesas || []).filter(d => d.status === 'Pendente');
      if (initialLoadRef.current) {
        pendentesDesp.forEach(d => seenIdsDespesasMonitoramentoRef.current.add(d.id));
      } else {
        pendentesDesp.forEach(d => {
          if (!seenIdsDespesasMonitoramentoRef.current.has(d.id)) {
            seenIdsDespesasMonitoramentoRef.current.add(d.id);
            playMonitoramentoSound();
            adicionarToast(d, 'monitoramento', 'despesa');
          }
        });
      }
    }

    // --- 2. MOTORISTA: Detectar respostas do Monitoramento para a sua placa ---
    if (isMotorista && userPlaca) {
      // A. Respostas de Devoluções
      const minhasSolicitacoesDev = solicitacoesDevolucao.filter(s => 
        String(s.placa || '').trim().toUpperCase() === userPlaca
      );

      if (initialLoadRef.current) {
        minhasSolicitacoesDev.forEach(s => {
          seenMotoristaStatusRef.current.set(s.id, s.statusSolicitacao);
        });
      } else {
        minhasSolicitacoesDev.forEach(s => {
          const prevStatus = seenMotoristaStatusRef.current.get(s.id);
          const currentStatus = s.statusSolicitacao;

          if (prevStatus === 'Pendente' && currentStatus && currentStatus !== 'Pendente') {
            playMotoristaSound(currentStatus);
            adicionarToast(s, 'motorista', 'devolucao');
          }

          seenMotoristaStatusRef.current.set(s.id, currentStatus);
        });
      }

      // B. Respostas de Despesas / Reembolsos
      const minhasDespesas = (despesas || []).filter(d => 
        String(d.motorista_placa || '').trim().toUpperCase() === userPlaca
      );

      if (initialLoadRef.current) {
        minhasDespesas.forEach(d => {
          seenMotoristaDespesasStatusRef.current.set(d.id, d.status);
        });
      } else {
        minhasDespesas.forEach(d => {
          const prevStatus = seenMotoristaDespesasStatusRef.current.get(d.id);
          const currentStatus = d.status;

          if (prevStatus === 'Pendente' && currentStatus && currentStatus !== 'Pendente') {
            playMotoristaSound(currentStatus);
            adicionarToast(d, 'motorista', 'despesa');
          }

          seenMotoristaDespesasStatusRef.current.set(d.id, currentStatus);
        });
      }
    }

    initialLoadRef.current = false;
  }, [solicitacoesDevolucao, despesas, isMonitoramento, isMotorista, userPlaca, currentUser]);

  const adicionarToast = (item, roleTarget, categoria = 'devolucao') => {
    const toastId = `toast_${categoria}_${Date.now()}_${item.id}`;
    const novoToast = {
      id: toastId,
      item,
      categoria,
      roleTarget,
      progresso: 100
    };

    setToasts(prev => [novoToast, ...prev.slice(0, 2)]); // No máximo 3 simultâneos

    // Timer de 5 segundos com barra de progresso regressiva
    const DURATION = 5000;
    const INTERVAL = 50;
    const startTime = Date.now();

    const intervalTimer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remainingPct = Math.max(0, 100 - (elapsed / DURATION) * 100);

      setToasts(prev => prev.map(t => t.id === toastId ? { ...t, progresso: remainingPct } : t));

      if (elapsed >= DURATION) {
        clearInterval(intervalTimer);
        removerToast(toastId);
      }
    }, INTERVAL);
  };

  const removerToast = (toastId) => {
    setToasts(prev => prev.filter(t => t.id !== toastId));
  };

  const abrirFichaDevolucao = (solic) => {
    setSolicParaAvaliar(solic);
    setModalAvaliacaoOpen(true);
    if (solic?.id) {
      setToasts(prev => prev.filter(t => t.item?.id !== solic.id));
    }
  };

  const abrirAbaCustos = (despesa) => {
    navigate('/custos');
    if (despesa?.id) {
      setToasts(prev => prev.filter(t => t.item?.id !== despesa.id));
    }
  };

  if (!currentUser || (toasts.length === 0 && !modalAvaliacaoOpen && !despesaParaCard)) {
    return null;
  }

  return (
    <>
      {/* Toast Popups Flutuantes no Canto Superior Direito */}
      {toasts.length > 0 && (
        <div className="fixed top-14 sm:top-16 right-3 sm:right-6 z-[120] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
          {toasts.map(toast => {
            const item = toast.item;
            const isToastMotorista = toast.roleTarget === 'motorista';
            const isDespesa = toast.categoria === 'despesa';

            // Cálculos específicos para Devoluções
            if (!isDespesa) {
              const solic = item;
              const badgeInfo = getTipoDevolucaoBadge(solic.tipo);
              const statusSolic = solic.statusSolicitacao;
              const isAprovado = statusSolic === 'Aprovado' || statusSolic === 'Aprovada';
              const isAlterado = statusSolic === 'Alterado e Aprovado' || statusSolic === 'Alterada';
              const isRecusado = statusSolic === 'Recusado' || statusSolic === 'Recusada' || statusSolic === 'Rejeitado';

              return (
                <div
                  key={toast.id}
                  className={cn(
                    "pointer-events-auto bg-background-primary/95 backdrop-blur-md rounded-2xl shadow-2xl p-4 overflow-hidden relative transition-all duration-300 animate-in slide-in-from-top-4 fade-in border",
                    isToastMotorista
                      ? isAprovado 
                        ? "border-emerald-500/50 shadow-emerald-500/10"
                        : isAlterado
                          ? "border-blue-500/50 shadow-blue-500/10"
                          : "border-rose-500/50 shadow-rose-500/10"
                      : "border-rose-500/40 shadow-rose-500/10"
                  )}
                >
                  {/* Barra de Progresso de 5 segundos */}
                  <div 
                    className={cn(
                      "absolute top-0 left-0 h-1 transition-all duration-75",
                      isToastMotorista
                        ? isAprovado
                          ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                          : isAlterado
                            ? "bg-gradient-to-r from-blue-500 to-cyan-400"
                            : "bg-gradient-to-r from-rose-500 to-amber-500"
                        : "bg-gradient-to-r from-rose-500 to-orange-500"
                    )}
                    style={{ width: `${toast.progresso}%` }}
                  />

                  {/* Cabeçalho do Toast */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0 border",
                        isToastMotorista
                          ? isAprovado
                            ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                            : isAlterado
                              ? "bg-blue-500/15 text-blue-500 border-blue-500/30"
                              : "bg-rose-500/15 text-rose-500 border-rose-500/30"
                          : "bg-rose-500/15 text-rose-500 border-rose-500/20"
                      )}>
                        {isToastMotorista ? (
                          isAprovado ? (
                            <CheckCircle2 size={18} />
                          ) : isAlterado ? (
                            <RotateCcw size={18} />
                          ) : (
                            <ShieldAlert size={18} />
                          )
                        ) : (
                          <Bell size={18} className="animate-bounce" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-background-secondary border border-border-tertiary text-text-primary font-mono">
                            {solic.placa}
                          </span>
                          <span className={cn(
                            "text-[9px] font-black uppercase px-1.5 py-0.5 rounded border",
                            isToastMotorista
                              ? isAprovado 
                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                               : isAlterado
                                  ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                                  : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                              : badgeInfo.badgeClass
                          )}>
                            {isToastMotorista 
                              ? isAprovado ? 'Aprovado' : isAlterado ? 'Ajustado' : 'Recusado'
                              : badgeInfo.label
                            }
                          </span>
                        </div>

                        <h4 className="text-xs font-black text-text-primary mt-1 truncate">
                          {isToastMotorista 
                            ? isAprovado 
                              ? `Solicitação Aprovada! (NF: ${solic.nota})`
                              : isAlterado
                                ? `Solicitação Ajustada & Aprovada! (NF: ${solic.nota})`
                                : `Solicitação Recusada! (NF: ${solic.nota})`
                            : `NF: ${solic.nota} • ${solic.cliente}`
                          }
                        </h4>
                      </div>
                    </div>

                    <button
                      onClick={() => removerToast(toast.id)}
                      className="p-1 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-background-secondary transition-colors cursor-pointer shrink-0"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Mensagem e Detalhes da Ocorrência */}
                  <div className="mt-2 text-[11px] text-text-secondary bg-background-secondary/60 p-2 rounded-lg border border-border-tertiary space-y-1">
                    <p className="font-semibold text-text-primary truncate">
                      {solic.cliente}
                    </p>
                    {isToastMotorista ? (
                      <p className="italic text-text-secondary line-clamp-2">
                        {isAprovado && `Monitoramento autorizou a ocorrência (${solic.tipoAprovado || solic.tipo}).`}
                        {isAlterado && `Monitoramento alterou para ${solic.tipoAprovado || solic.statusAprovado || solic.tipo} - ${solic.observacaoMonitoramento || 'Status ajustado'}.`}
                        {isRecusado && `Recusada pelo Monitoramento: "${solic.observacaoMonitoramento || 'Entrega mantida como pendente'}"`}
                      </p>
                    ) : (
                      solic.motivo && (
                        <p className="italic text-text-secondary truncate">
                          Motivo: "{solic.motivo}"
                        </p>
                      )
                    )}
                  </div>

                  {/* Rodapé com Ação */}
                  <div className="mt-3 pt-2 border-t border-border-secondary/60 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-text-tertiary">
                      {isToastMotorista ? 'Resposta do Monitoramento' : 'Solicitação de Ocorrência'}
                    </span>
                    <button
                      onClick={() => abrirFichaDevolucao(solic)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-white font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer active:scale-95",
                        isToastMotorista
                          ? isAprovado
                            ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500"
                            : isAlterado
                              ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500"
                              : "bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500"
                          : "bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500"
                      )}
                    >
                      <span>{isToastMotorista ? 'Ver Ficha' : 'Avaliar Agora'}</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              );
            }

            // Cálculos específicos para DESPESAS / REEMBOLSOS
            const desp = item;
            const statusDesp = desp.status;
            const isAprovado = statusDesp === 'Aprovado' || statusDesp === 'Aprovada';
            const isRecusado = statusDesp === 'Rejeitado' || statusDesp === 'Rejeitada' || statusDesp === 'Recusado' || statusDesp === 'Recusada';

            return (
              <div
                key={toast.id}
                className={cn(
                  "pointer-events-auto bg-background-primary/95 backdrop-blur-md rounded-2xl shadow-2xl p-4 overflow-hidden relative transition-all duration-300 animate-in slide-in-from-top-4 fade-in border",
                  isToastMotorista
                    ? isAprovado 
                      ? "border-emerald-500/50 shadow-emerald-500/10"
                      : "border-rose-500/50 shadow-rose-500/10"
                    : "border-amber-500/40 shadow-amber-500/10"
                )}
              >
                {/* Barra de Progresso de 5 segundos */}
                <div 
                  className={cn(
                    "absolute top-0 left-0 h-1 transition-all duration-75",
                    isToastMotorista
                      ? isAprovado
                        ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                        : "bg-gradient-to-r from-rose-500 to-amber-500"
                      : "bg-gradient-to-r from-amber-500 to-yellow-400"
                  )}
                  style={{ width: `${toast.progresso}%` }}
                />

                {/* Cabeçalho do Toast */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0 border",
                      isToastMotorista
                        ? isAprovado
                          ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                          : "bg-rose-500/15 text-rose-500 border-rose-500/30"
                        : "bg-amber-500/15 text-amber-500 border-amber-500/30"
                    )}>
                      {isToastMotorista ? (
                        isAprovado ? (
                          <CheckCircle2 size={18} />
                        ) : (
                          <ShieldAlert size={18} />
                        )
                      ) : (
                        <DollarSign size={18} className="animate-bounce" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-background-secondary border border-border-tertiary text-text-primary font-mono">
                          {desp.motorista_placa || 'S/ Placa'}
                        </span>
                        <span className={cn(
                          "text-[9px] font-black uppercase px-1.5 py-0.5 rounded border",
                          isToastMotorista
                            ? isAprovado 
                              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                              : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                            : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                        )}>
                          {isToastMotorista 
                            ? isAprovado ? 'Aprovado' : 'Recusado'
                            : desp.tipo || 'Despesa'
                          }
                        </span>
                      </div>

                      <h4 className="text-xs font-black text-text-primary mt-1 truncate">
                        {isToastMotorista 
                          ? isAprovado 
                            ? `Reembolso Aprovado! (R$ ${Number(desp.valor || 0).toFixed(2)})`
                            : `Reembolso Recusado! (R$ ${Number(desp.valor || 0).toFixed(2)})`
                          : `Solicitação de Reembolso: R$ ${Number(desp.valor || 0).toFixed(2)}`
                        }
                      </h4>
                    </div>
                  </div>

                  <button
                    onClick={() => removerToast(toast.id)}
                    className="p-1 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-background-secondary transition-colors cursor-pointer shrink-0"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Mensagem e Detalhes da Despesa */}
                <div className="mt-2 text-[11px] text-text-secondary bg-background-secondary/60 p-2 rounded-lg border border-border-tertiary space-y-1">
                  <div className="flex justify-between items-center text-text-primary font-semibold">
                    <span>{desp.tipo}</span>
                    <span className="text-info font-mono">PIX: {desp.chave_pix}</span>
                  </div>
                  {isToastMotorista ? (
                    <p className="italic text-text-secondary line-clamp-2">
                      {isAprovado && `Monitoramento autorizou o reembolso de R$ ${Number(desp.valor || 0).toFixed(2)}. Pagamento autorizado via PIX.`}
                      {isRecusado && `Recusado pelo Monitoramento: "${desp.observacaoMonitoramento || 'Reembolso não autorizado pela gestão'}"`}
                    </p>
                  ) : (
                    <div>
                      <p className="text-[10px] text-text-tertiary">
                        Recebedor: <strong className="text-text-secondary">{desp.nome_recebedor}</strong>
                      </p>
                      {desp.observacao && (
                        <p className="italic text-text-secondary truncate mt-0.5">
                          Motivo: "{desp.observacao}"
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Rodapé com Ação */}
                <div className="mt-3 pt-2 border-t border-border-secondary/60 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-text-tertiary">
                    {isToastMotorista ? 'Resposta do Monitoramento' : 'Gestão de Custos'}
                  </span>
                  {isToastMotorista ? (
                    isAprovado ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const texto = formatarTextoReembolso(desp, entregas);
                            const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
                            window.open(url, '_blank', 'noopener,noreferrer');
                          }}
                          className="p-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white transition-colors cursor-pointer border border-emerald-500/30 flex items-center justify-center"
                          title="Enviar no WhatsApp"
                        >
                          <MessageSquare size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDespesaParaCard(desp);
                            removerToast(toast.id);
                          }}
                          className="px-2.5 py-1.5 rounded-xl text-white font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500"
                          title="Abrir e Compartilhar Card de Reembolso"
                        >
                          <Share2 size={13} />
                          <span>Compartilhar Card</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => removerToast(toast.id)}
                        className="px-3 py-1.5 rounded-xl text-white font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500"
                      >
                        <span>Entendido</span>
                        <CheckCircle2 size={13} />
                      </button>
                    )
                  ) : (
                    <button
                      type="button"
                      onClick={() => abrirAbaCustos(desp)}
                      className="px-3 py-1.5 rounded-xl text-white font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500"
                    >
                      <span>Ver em Custos</span>
                      <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Avaliação / Ficha Disparado pelo Toast */}
      {modalAvaliacaoOpen && (
        <ModalAvaliarDevolucao
          isOpen={modalAvaliacaoOpen}
          onClose={() => {
            setModalAvaliacaoOpen(false);
            setSolicParaAvaliar(null);
          }}
          placa={solicParaAvaliar?.placa}
          solicitacaoId={solicParaAvaliar?.id}
        />
      )}

      {/* Modal de Compartilhamento do Card de Reembolso Aprovado */}
      {despesaParaCard && (
        <ModalCardReembolso
          isOpen={!!despesaParaCard}
          onClose={() => setDespesaParaCard(null)}
          despesa={despesaParaCard}
          entregas={entregas}
        />
      )}
    </>
  );
}
