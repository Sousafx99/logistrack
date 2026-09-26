import { useState, useEffect, useRef } from 'react';
import { Bell, X, RotateCcw, ArrowRight, Truck, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { getTipoDevolucaoBadge } from '../../data/mockData';
import { ModalAvaliarDevolucao } from '../monitoramento/ModalAvaliarDevolucao';
import { cn } from '../../lib/utils';

// Função para reproduzir som sutil de notificação via Web Audio API
function playNotificationSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    // Tocar dois tons harmônicos agradáveis (bell chime)
    const now = ctx.currentTime;
    
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.6);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.1); // A5
    gain2.gain.setValueAtTime(0.18, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.8);
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
