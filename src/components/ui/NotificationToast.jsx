import { useState, useEffect, useRef } from 'react';
import { Bell, X, RotateCcw, ArrowRight, Truck, CheckCircle2, ShieldAlert, AlertTriangle, FileText } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { getTipoDevolucaoBadge } from '../../data/mockData';
import { ModalAvaliarDevolucao } from '../monitoramento/ModalAvaliarDevolucao';
import { cn } from '../../lib/utils';

// Função para reproduzir som de alarme/sirene urgente (toca exatamente 2 vezes) para o MONITORAMENTO
function playMonitoramentoSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;
    
    const ciclosSirene = 2;
    const duracaoCiclo = 0.50; // 500ms por ciclo
    const intervaloEntre = 0.22; // pausa entre os toques

    for (let c = 0; c < ciclosSirene; c++) {
      const startTime = now + c * (duracaoCiclo + intervaloEntre);
      const endTime = startTime + duracaoCiclo;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(620, startTime);
      osc.frequency.exponentialRampToValueAtTime(1250, startTime + duracaoCiclo * 0.55);
      osc.frequency.exponentialRampToValueAtTime(720, endTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1900, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.28, startTime + 0.08);
      gain.gain.setValueAtTime(0.24, endTime - 0.10);
      gain.gain.exponentialRampToValueAtTime(0.001, endTime);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(endTime);
    }
  } catch (e) {
    // Silencioso se bloqueado por autoplay policy
  }
}

// Função para reproduzir som de confirmação/resposta para o MOTORISTA
function playMotoristaSound(status) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;

    const isRecusado = status === 'Recusado' || status === 'Recusada' || status === 'Rejeitado' || status === 'Rejeitada';

    if (isRecusado) {
      // Tom de aviso descendente (540Hz -> 380Hz)
      const tones = [540, 380];
      tones.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = now + idx * 0.16;
        const endTime = startTime + 0.15;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(0.24, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, endTime);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(endTime);
      });
    } else {
      // Chime harmônico ascendente de sucesso (C5 523Hz -> E5 659Hz -> G5 784Hz)
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = now + idx * 0.12;
        const endTime = startTime + 0.32;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(0.22, startTime + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, endTime);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(endTime);
      });
    }
  } catch (e) {
    // Silencioso se bloqueado por autoplay policy
  }
}

export function NotificationToastContainer() {
  const { solicitacoesDevolucao = [], currentUser } = useStore();
  const [toasts, setToasts] = useState([]); // Array de { id, solicitacao, roleTarget, progresso }
  const [modalAvaliacaoOpen, setModalAvaliacaoOpen] = useState(false);
  const [solicParaAvaliar, setSolicParaAvaliar] = useState(null);

  const seenIdsMonitoramentoRef = useRef(new Set());
  const seenMotoristaStatusRef = useRef(new Map()); // id -> statusSolicitacao
  const initialLoadRef = useRef(true);

  const isMonitoramento = currentUser?.role === 'Monitoramento' || currentUser?.role === 'Operacao';
  const isMotorista = currentUser?.role === 'Motorista';
  const userPlaca = currentUser?.placa ? String(currentUser.placa).trim().toUpperCase() : '';

  useEffect(() => {
    if (!currentUser) return;

    // --- 1. MONITORAMENTO: Detectar novas solicitações pendentes ---
    if (isMonitoramento) {
      const pendentes = solicitacoesDevolucao.filter(s => s.statusSolicitacao === 'Pendente');

      if (initialLoadRef.current) {
        pendentes.forEach(s => seenIdsMonitoramentoRef.current.add(s.id));
      } else {
        pendentes.forEach(s => {
          if (!seenIdsMonitoramentoRef.current.has(s.id)) {
            seenIdsMonitoramentoRef.current.add(s.id);
            playMonitoramentoSound();
            adicionarToast(s, 'monitoramento');
          }
        });
      }
    }

    // --- 2. MOTORISTA: Detectar respostas do Monitoramento para a sua placa ---
    if (isMotorista && userPlaca) {
      const minhasSolicitacoes = solicitacoesDevolucao.filter(s => 
        String(s.placa || '').trim().toUpperCase() === userPlaca
      );

      if (initialLoadRef.current) {
        minhasSolicitacoes.forEach(s => {
          seenMotoristaStatusRef.current.set(s.id, s.statusSolicitacao);
        });
      } else {
        minhasSolicitacoes.forEach(s => {
          const prevStatus = seenMotoristaStatusRef.current.get(s.id);
          const currentStatus = s.statusSolicitacao;

          // Se estava Pendente (ou novo) e agora foi Aprovado/Alterado/Recusado
          if (prevStatus === 'Pendente' && currentStatus && currentStatus !== 'Pendente') {
            playMotoristaSound(currentStatus);
            adicionarToast(s, 'motorista');
          }

          seenMotoristaStatusRef.current.set(s.id, currentStatus);
        });
      }
    }

    initialLoadRef.current = false;
  }, [solicitacoesDevolucao, isMonitoramento, isMotorista, userPlaca, currentUser]);

  const adicionarToast = (solic, roleTarget) => {
    const toastId = `toast_${Date.now()}_${solic.id}`;
    const novoToast = {
      id: toastId,
      solicitacao: solic,
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

  const abrirFicha = (solic) => {
    setSolicParaAvaliar(solic);
    setModalAvaliacaoOpen(true);
    if (solic?.id) {
      setToasts(prev => prev.filter(t => t.solicitacao.id !== solic.id));
    }
  };

  if (!currentUser || toasts.length === 0) {
    return (
      <>
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
      </>
    );
  }

  return (
    <>
      {/* Toast Popups Flutuantes no Canto Superior Direito */}
      <div className="fixed top-14 sm:top-16 right-3 sm:right-6 z-[120] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map(toast => {
          const solic = toast.solicitacao;
          const isToastMotorista = toast.roleTarget === 'motorista';
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
                  onClick={() => abrirFicha(solic)}
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
        })}
      </div>

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
    </>
  );
}
