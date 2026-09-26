import { useState, useEffect, useRef } from 'react';
import { Bell, X, RotateCcw, ArrowRight, Truck, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { getTipoDevolucaoBadge } from '../../data/mockData';
import { ModalAvaliarDevolucao } from '../monitoramento/ModalAvaliarDevolucao';
import { cn } from '../../lib/utils';

// Função para reproduzir som de alarme/sirene urgente operacional via Web Audio API
function playNotificationSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;
    
    // Alarme/Sirene operacional urgente com 3 pulsos sweep
    const pulseCount = 3;
    const pulseDuration = 0.22;
    const gap = 0.08;

    for (let i = 0; i < pulseCount; i++) {
      const startTime = now + i * (pulseDuration + gap);
      const endTime = startTime + pulseDuration;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      // Som encorpado com filtro passa-baixa
      osc.type = 'sawtooth';
      
      // Pitch sweep de sirene de alerta operacional (680Hz -> 1150Hz -> 800Hz)
      osc.frequency.setValueAtTime(680, startTime);
      osc.frequency.linearRampToValueAtTime(1150, startTime + pulseDuration * 0.6);
      osc.frequency.linearRampToValueAtTime(800, endTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1800, startTime);

      // Volume punchy com envelope rápido
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.25, startTime + 0.03);
      gain.gain.setValueAtTime(0.22, endTime - 0.05);
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

export function NotificationToastContainer() {
  const { solicitacoesDevolucao = [], currentUser } = useStore();
  const [toasts, setToasts] = useState([]); // Array de { id, solicitacao, timer, createdAt }
  const [modalAvaliacaoOpen, setModalAvaliacaoOpen] = useState(false);
  const [solicParaAvaliar, setSolicParaAvaliar] = useState(null);

  const seenIdsRef = useRef(new Set());
  const initialLoadRef = useRef(true);

  const isMonitoramento = currentUser?.role === 'Monitoramento' || currentUser?.role === 'Operacao';

  useEffect(() => {
    if (!isMonitoramento) return;

    const pendentes = solicitacoesDevolucao.filter(s => s.statusSolicitacao === 'Pendente');

    // No primeiro carregamento, marca todos existentes como já vistos para não disparar toasts antigos
    if (initialLoadRef.current) {
      pendentes.forEach(s => seenIdsRef.current.add(s.id));
      initialLoadRef.current = false;
      return;
    }

    // Detectar novas solicitações que ainda não foram vistas
    pendentes.forEach(s => {
      if (!seenIdsRef.current.has(s.id)) {
        seenIdsRef.current.add(s.id);
        playNotificationSound();
        adicionarToast(s);
      }
    });
  }, [solicitacoesDevolucao, isMonitoramento]);

  const adicionarToast = (solic) => {
    const toastId = `toast_${Date.now()}_${solic.id}`;
    const novoToast = {
      id: toastId,
      solicitacao: solic,
      progresso: 100
    };

    setToasts(prev => [novoToast, ...prev.slice(0, 2)]); // No máximo 3 simultâneos

    // Iniciar timer de 5 segundos com progresso
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

  const abrirAvaliacao = (solic) => {
    setSolicParaAvaliar(solic);
    setModalAvaliacaoOpen(true);
    if (solic?.id) {
      setToasts(prev => prev.filter(t => t.solicitacao.id !== solic.id));
    }
  };

  if (!isMonitoramento) return null;

  return (
    <>
      {/* Toast Popups Flutuantes no Canto Superior Direito */}
      <div className="fixed top-16 sm:top-20 right-3 sm:right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map(toast => {
          const solic = toast.solicitacao;
          const badgeInfo = getTipoDevolucaoBadge(solic.tipo);

          return (
            <div
              key={toast.id}
              className="pointer-events-auto bg-background-primary/95 backdrop-blur-md border border-rose-500/40 rounded-2xl shadow-2xl p-4 overflow-hidden relative transition-all duration-300 animate-in slide-in-from-top-4 fade-in"
            >
              {/* Barra de Progresso de 5 segundos */}
              <div 
                className="absolute top-0 left-0 h-1 bg-gradient-to-r from-rose-500 to-orange-500 transition-all duration-75"
                style={{ width: `${toast.progresso}%` }}
              />

              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-500 flex items-center justify-center font-bold shrink-0 border border-rose-500/20">
                    <Bell size={16} className="animate-bounce" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-background-secondary border border-border-tertiary text-text-primary font-mono">
                        {solic.placa}
                      </span>
                      <span className={cn("text-[9px] font-black uppercase px-1.5 py-0.5 rounded", badgeInfo.badgeClass)}>
                        {badgeInfo.label}
                      </span>
                    </div>
                    <p className="text-xs font-black text-text-primary mt-1 truncate">
                      NF: {solic.nota} • {solic.cliente}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => removerToast(toast.id)}
                  className="p-1 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-background-secondary transition-colors cursor-pointer shrink-0"
                >
                  <X size={16} />
                </button>
              </div>

              {solic.motivo && (
                <p className="text-[11px] text-text-secondary mt-2 italic bg-background-secondary/60 p-1.5 rounded-lg border border-border-tertiary truncate">
                  Motivo: "{solic.motivo}"
                </p>
              )}

              <div className="mt-3 pt-2 border-t border-border-secondary/60 flex items-center justify-between">
                <span className="text-[10px] font-bold text-text-tertiary">
                  Solicitação de Ocorrência
                </span>
                <button
                  onClick={() => abrirAvaliacao(solic)}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <span>Avaliar Agora</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Avaliação Disparado pelo Toast ou Sino */}
      {modalAvaliacaoOpen && (
        <ModalAvaliarDevolucao
          isOpen={modalAvaliacaoOpen}
          onClose={() => {
            setModalAvaliacaoOpen(false);
            setSolicParaAvaliar(null);
          }}
          placa={solicParaAvaliar?.placa}
          solicitacaoInicialId={solicParaAvaliar?.id}
        />
      )}
    </>
  );
}
