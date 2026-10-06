import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, X, RotateCcw, ArrowRight, Truck, CheckCircle2, 
  ShieldAlert, AlertTriangle, FileText, DollarSign, Wallet,
  Share2, MessageSquare, MapPin, Compass, Navigation
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

// Função para reproduzir som de radar / sonar / GPS por satélite para o MONITORAMENTO
export function playGpsSound() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([150, 80, 250, 80, 350]);
    } catch (e) {}
  }

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-6, now);
    compressor.knee.setValueAtTime(10, now);
    compressor.ratio.setValueAtTime(12, now);
    compressor.attack.setValueAtTime(0.003, now);
    compressor.release.setValueAtTime(0.25, now);

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(1.0, now);

    compressor.connect(masterGain);
    masterGain.connect(ctx.destination);

    // 3 pulsos estilo Sonar/GPS Satélite de alta fidelidade
    const pings = [
      { delay: 0.00, freqStart: 1760, freqEnd: 880, dur: 0.35, vol: 0.85 },
      { delay: 0.22, freqStart: 2093, freqEnd: 1046, dur: 0.45, vol: 0.95 },
      { delay: 0.45, freqStart: 2637, freqEnd: 1318, dur: 0.60, vol: 1.00 }
    ];

    pings.forEach(p => {
      const t = now + p.delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(p.freqStart, t);
      osc.frequency.exponentialRampToValueAtTime(p.freqEnd, t + p.dur);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(p.freqStart, t);
      filter.Q.setValueAtTime(3.0, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(p.vol, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + p.dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(compressor);

      osc.start(t);
      osc.stop(t + p.dur);
    });
  } catch (e) {}
}

// Função para reproduzir som realista e marcante de moedas / tilintar de dinheiro (Web Audio API)
export function playMoedasSound() {
  // Vibração alegre no aparelho (pulsos curtos ritmados simulando moedas)
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([70, 35, 70, 35, 120]);
    } catch (e) {}
  }

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-6, now);
    compressor.knee.setValueAtTime(10, now);
    compressor.ratio.setValueAtTime(12, now);
    compressor.attack.setValueAtTime(0.002, now);
    compressor.release.setValueAtTime(0.20, now);

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(1.0, now);

    compressor.connect(masterGain);
    masterGain.connect(ctx.destination);

    // Efeito cascata de tilintar de moedas de ouro (4 moedas tilintando em sequência rápida)
    const moedas = [
      { delay: 0.00, freqBase: 1568, harm: 3136, dur: 0.18, vol: 0.70 }, // G6
      { delay: 0.08, freqBase: 2093, harm: 4186, dur: 0.20, vol: 0.85 }, // C7
      { delay: 0.16, freqBase: 1864, harm: 3729, dur: 0.22, vol: 0.80 }, // A#6
      { delay: 0.24, freqBase: 2793, harm: 5587, dur: 0.45, vol: 0.95 }, // F7 (brilho longo final)
    ];

    moedas.forEach(m => {
      const t = now + m.delay;

      // Onda senoidal fundamental
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(m.freqBase, t);
      osc.frequency.exponentialRampToValueAtTime(m.freqBase * 1.05, t + 0.025);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(m.vol, t + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, t + m.dur);

      osc.connect(gain);
      gain.connect(compressor);

      osc.start(t);
      osc.stop(t + m.dur);

      // Harmônico de impacto metálico
      const oscHarm = ctx.createOscillator();
      const gainHarm = ctx.createGain();
      oscHarm.type = 'triangle';
      oscHarm.frequency.setValueAtTime(m.harm, t);

      gainHarm.gain.setValueAtTime(0.001, t);
      gainHarm.gain.linearRampToValueAtTime(m.vol * 0.45, t + 0.004);
      gainHarm.gain.exponentialRampToValueAtTime(0.001, t + m.dur * 0.5);

      oscHarm.connect(gainHarm);
      gainHarm.connect(compressor);

      oscHarm.start(t);
      oscHarm.stop(t + m.dur * 0.5);
    });
  } catch (e) {
    // Silencioso se bloqueado por autoplay
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
  const { solicitacoesDevolucao = [], despesas = [], solicitacoesGeoloc = [], entregas = [], currentUser } = useStore();
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

  // Rastreamento para Geolocalização / GPS
  const seenIdsGeolocMonitoramentoRef = useRef(new Set());
  const seenMotoristaGeolocStatusRef = useRef(new Map()); // id -> status

  const initialLoadRef = useRef(true);

  const isOperacao = currentUser?.role === 'Operacao';
  const isOperacaoDocas = isOperacao && (currentUser?.subRole === 'Docas' || !currentUser?.subRole);
  const isOperacaoFin = isOperacao && currentUser?.subRole === 'Financeiro';
  const isMonitoramentoAdmin = currentUser?.role === 'Monitoramento';
  const isMotorista = currentUser?.role === 'Motorista';
  const userPlaca = currentUser?.placa ? String(currentUser.placa).trim().toUpperCase() : '';

  useEffect(() => {
    if (!currentUser) return;

    // --- 1. MONITORAMENTO / OPERAÇÃO: Detectar novas solicitações pendentes ---
    // A. Devoluções (Para Monitoramento Admin e Operação Docas)
    if (isMonitoramentoAdmin || isOperacaoDocas) {
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
    }

    // B. Despesas / Reembolsos (Para Monitoramento Admin e Operação Financeira)
    if (isMonitoramentoAdmin || isOperacaoFin) {
      const pendentesDesp = (despesas || []).filter(d => d.status === 'Pendente');
      if (initialLoadRef.current) {
        pendentesDesp.forEach(d => seenIdsDespesasMonitoramentoRef.current.add(d.id));
      } else {
        pendentesDesp.forEach(d => {
          if (!seenIdsDespesasMonitoramentoRef.current.has(d.id)) {
            seenIdsDespesasMonitoramentoRef.current.add(d.id);
            playMoedasSound();
            adicionarToast(d, 'monitoramento', 'despesa');
          }
        });
      }
    }

    // C. Geolocalização / Solicitações de GPS dos Motoristas (Para Monitoramento Admin)
    if (isMonitoramentoAdmin) {
      const pendentesGeoloc = (solicitacoesGeoloc || []).filter(g => (g?.status || '').toLowerCase() === 'pendente');
      if (initialLoadRef.current) {
        pendentesGeoloc.forEach(g => seenIdsGeolocMonitoramentoRef.current.add(g.id));
      } else {
        pendentesGeoloc.forEach(g => {
          if (!seenIdsGeolocMonitoramentoRef.current.has(g.id)) {
            seenIdsGeolocMonitoramentoRef.current.add(g.id);
            playGpsSound();
            adicionarToast(g, 'monitoramento', 'geoloc');
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

          if (prevStatus && prevStatus !== currentStatus && currentStatus !== 'Pendente') {
            if (currentStatus === 'Autorizado' || currentStatus === 'Aprovado' || currentStatus === 'Aprovada' || currentStatus === 'Pago') {
              playMoedasSound();
            } else {
              playMotoristaSound(currentStatus);
            }
            adicionarToast(d, 'motorista', 'despesa');
          }

          seenMotoristaDespesasStatusRef.current.set(d.id, currentStatus);
        });
      }

      // C. Respostas de Solicitações de GPS
      const minhasSolicitacoesGeoloc = (solicitacoesGeoloc || []).filter(g => 
        String(g.motoristaPlaca || '').trim().toUpperCase() === userPlaca
      );

      if (initialLoadRef.current) {
        minhasSolicitacoesGeoloc.forEach(g => {
          seenMotoristaGeolocStatusRef.current.set(g.id, g.status);
        });
      } else {
        minhasSolicitacoesGeoloc.forEach(g => {
          const prevStatus = seenMotoristaGeolocStatusRef.current.get(g.id);
          const currentStatus = g.status;

          if (prevStatus && (prevStatus.toLowerCase() === 'pendente') && currentStatus && currentStatus.toLowerCase() !== 'pendente') {
            playMotoristaSound(currentStatus);
            adicionarToast(g, 'motorista', 'geoloc');
          }

          seenMotoristaGeolocStatusRef.current.set(g.id, currentStatus);
        });
      }
    }

    initialLoadRef.current = false;
  }, [solicitacoesDevolucao, despesas, solicitacoesGeoloc, isMonitoramentoAdmin, isOperacaoDocas, isOperacaoFin, isMotorista, userPlaca, currentUser]);

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

  const abrirAbaClientesGps = (solicGeoloc) => {
    navigate(`/cadastros?aba=geolocalizacao&filtro=solicitacoes&solicId=${solicGeoloc?.id || ''}`);
    if (solicGeoloc?.id) {
      setToasts(prev => prev.filter(t => t.item?.id !== solicGeoloc.id));
    }
  };

  if (!currentUser || (toasts.length === 0 && !modalAvaliacaoOpen && !despesaParaCard)) {
    return null;
  }

  return (
    <>
      {/* Toast Popups Flutuantes Ocupando a Largura da Tela Centralizado com Padding */}
      {toasts.length > 0 && (
        <div className="fixed top-4 sm:top-6 inset-x-0 mx-auto w-full max-w-xl px-3.5 sm:px-4 z-[130] flex flex-col gap-2.5 pointer-events-none items-center">
          {toasts.map(toast => {
            const item = toast.item;
            const isToastMotorista = toast.roleTarget === 'motorista';
            const isDespesa = toast.categoria === 'despesa';
            const isGeoloc = toast.categoria === 'geoloc';

            // 1. Cálculos específicos para GEOLOCALIZAÇÃO / GPS
            if (isGeoloc) {
              const solic = item;
              const statusSolic = solic.status || 'Pendente';
              const isAprovado = statusSolic === 'Aprovado' || statusSolic === 'Aprovada';
              const isRecusado = statusSolic === 'Recusado' || statusSolic === 'Recusada' || statusSolic === 'Rejeitado';

              return (
                <div
                  key={toast.id}
                  className={cn(
                    "pointer-events-auto bg-background-primary/95 backdrop-blur-md rounded-2xl shadow-2xl p-3.5 sm:p-4 overflow-hidden relative transition-all duration-300 animate-in slide-in-from-top-4 fade-in border w-full box-border",
                    isToastMotorista
                      ? isAprovado
                        ? "border-emerald-500/60 shadow-emerald-500/20"
                        : "border-rose-500/60 shadow-rose-500/20"
                      : "border-cyan-500/50 shadow-cyan-500/20 ring-1 ring-cyan-500/30"
                  )}
                >
                  {/* Barra de Progresso de 5 segundos */}
                  <div 
                    className={cn(
                      "absolute top-0 left-0 h-1.5 transition-all duration-75",
                      isToastMotorista
                        ? isAprovado
                          ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                          : "bg-gradient-to-r from-rose-500 to-amber-500"
                        : "bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500"
                    )}
                    style={{ width: `${toast.progresso}%` }}
                  />

                  {/* Cabeçalho do Toast */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 border",
                        isToastMotorista
                          ? isAprovado
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                            : "bg-rose-500/20 text-rose-400 border-rose-500/40"
                          : "bg-cyan-500/20 text-cyan-400 border-cyan-500/40 animate-pulse"
                      )}>
                        {isToastMotorista ? (
                          isAprovado ? <CheckCircle2 size={20} /> : <ShieldAlert size={20} />
                        ) : (
                          <Compass size={20} className="text-cyan-400 animate-spin-slow" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-background-secondary border border-border-tertiary text-text-primary font-mono">
                            {solic.motoristaPlaca || 'S/ Placa'}
                          </span>
                          <span className={cn(
                            "text-[9px] font-black uppercase px-1.5 py-0.5 rounded border",
                            isToastMotorista
                              ? isAprovado
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-bold"
                                : "bg-rose-500/20 text-rose-400 border-rose-500/40 font-bold"
                              : "bg-cyan-500/20 text-cyan-400 border-cyan-500/40 font-bold"
                          )}>
                            {isToastMotorista
                              ? isAprovado ? '✓ GPS Aprovado' : '✗ GPS Recusado'
                              : '📍 Solicitação de GPS'
                            }
                          </span>
                          {solic.motoristaNome && (
                            <span className="text-[10px] text-text-secondary truncate max-w-[140px]">
                              • {solic.motoristaNome}
                            </span>
                          )}
                        </div>

                        <h4 className="text-xs sm:text-[13px] font-black text-text-primary mt-1 truncate">
                          {isToastMotorista
                            ? isAprovado
                              ? `Localização Aprovada! (${solic.clienteNome || `Cliente ${solic.codCliente}`})`
                              : `Localização Recusada (${solic.clienteNome || `Cliente ${solic.codCliente}`})`
                            : `Cód: ${solic.codCliente} • ${solic.clienteNome || 'Cliente sem nome'}`
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

                  {/* Mensagem e Detalhes da Geolocalização */}
                  <div className="mt-2.5 text-[11px] text-text-secondary bg-background-secondary/70 p-2.5 rounded-xl border border-border-tertiary space-y-1">
                    <div className="flex items-center justify-between gap-1 flex-wrap font-medium">
                      <span className="text-text-primary font-bold truncate">
                        {solic.municipio ? `${solic.municipio}${solic.bairro ? ` - ${solic.bairro}` : ''}` : (solic.endereco || 'Endereço não informado')}
                      </span>
                      {solic.lat && solic.lng && (
                        <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20 shrink-0">
                          {Number(solic.lat).toFixed(5)}, {Number(solic.lng).toFixed(5)} {solic.precisaoMetros ? `(±${solic.precisaoMetros}m)` : ''}
                        </span>
                      )}
                    </div>

                    {isToastMotorista ? (
                      <p className="italic text-text-secondary line-clamp-2">
                        {isAprovado && `Monitoramento validou e integrou o ponto de GPS (${solic.nomeLocalSugerido || 'Ponto de Descarga'}) à base.`}
                        {isRecusado && `Recusado pelo Monitoramento: "${solic.motivoRecusa || 'Não foi possível validar as coordenadas informadas.'}"`}
                      </p>
                    ) : (
                      <div className="space-y-0.5">
                        {solic.nomeLocalSugerido && (
                          <p className="text-[11px] text-text-primary">
                            Local sugerido: <strong className="text-cyan-400">{solic.nomeLocalSugerido}</strong>
                          </p>
                        )}
                        {solic.observacao && (
                          <p className="italic text-text-secondary truncate">
                            Obs: "{solic.observacao}"
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Rodapé com Ação */}
                  <div className="mt-2.5 pt-2 border-t border-border-secondary/60 flex items-center justify-between gap-1.5">
                    <span className="text-[10px] font-bold text-text-tertiary shrink-0">
                      {isToastMotorista ? 'Central de Geolocalização' : 'Novo Ponto GPS Coletado'}
                    </span>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isToastMotorista && (
                        <button
                          onClick={() => abrirAbaClientesGps(solic)}
                          className="px-3 py-1.5 rounded-xl text-white font-bold text-xs bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                        >
                          <span>Avaliar GPS</span>
                          <ArrowRight size={13} />
                        </button>
                      )}
                      {isToastMotorista && (
                        <button
                          onClick={() => removerToast(toast.id)}
                          className="px-3 py-1 rounded-lg bg-background-secondary hover:bg-background-tertiary text-text-primary border border-border-secondary text-xs font-semibold cursor-pointer"
                        >
                          OK, Entendido
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            // 2. Cálculos específicos para Devoluções
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
                    "pointer-events-auto bg-background-primary/95 backdrop-blur-md rounded-2xl shadow-2xl p-3.5 sm:p-4 overflow-hidden relative transition-all duration-300 animate-in slide-in-from-top-4 fade-in border w-full box-border",
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
                  <div className="flex items-start justify-between gap-2">
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
                                ? `Solicitação Ajustada! (NF: ${solic.nota})`
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
                  <div className="mt-2.5 pt-2 border-t border-border-secondary/60 flex items-center justify-between gap-1.5">
                    <span className="text-[10px] font-bold text-text-tertiary shrink-0">
                      {isToastMotorista ? 'Monitoramento' : 'Ocorrência'}
                    </span>
                    <button
                      onClick={() => abrirFichaDevolucao(solic)}
                      className={cn(
                        "px-2.5 py-1.5 rounded-xl text-white font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center gap-1 cursor-pointer active:scale-95 shrink-0",
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

            // Cálculos específicos para DESPESAS / REEMBOLSOS (Verde vibrante para Motorista e Monitoramento)
            const desp = item;
            const statusDesp = desp.status;
            const isPago = statusDesp === 'Pago';
            const isAutorizado = statusDesp === 'Autorizado' || statusDesp === 'Aprovado' || statusDesp === 'Aprovada';
            const isRecusado = statusDesp === 'Rejeitado' || statusDesp === 'Rejeitada' || statusDesp === 'Recusado' || statusDesp === 'Recusada';

            return (
              <div
                key={toast.id}
                className={cn(
                  "pointer-events-auto rounded-2xl shadow-2xl p-3.5 sm:p-4 overflow-hidden relative transition-all duration-300 animate-in slide-in-from-top-4 fade-in border w-full box-border",
                  isRecusado 
                    ? "bg-gradient-to-br from-rose-950 via-slate-900 to-slate-950 border-2 border-rose-500/60 shadow-rose-500/20 text-white"
                    : isPago
                      ? "bg-gradient-to-br from-teal-950 via-emerald-900 to-slate-900 border-2 border-teal-400 shadow-2xl shadow-teal-500/30 ring-1 ring-teal-400/30 text-white"
                      : "bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-900 border-2 border-emerald-400 shadow-2xl shadow-emerald-500/30 ring-1 ring-emerald-400/30 text-white"
                )}
              >
                {/* Barra de Progresso de 5 segundos */}
                <div 
                  className={cn(
                    "absolute top-0 left-0 h-1.5 transition-all duration-75",
                    isRecusado
                      ? "bg-gradient-to-r from-rose-500 to-amber-500"
                      : isPago
                        ? "bg-gradient-to-r from-teal-400 via-emerald-300 to-teal-200"
                        : "bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-200"
                  )}
                  style={{ width: `${toast.progresso}%` }}
                />

                {/* Cabeçalho do Toast */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 border",
                      isRecusado
                        ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                        : isPago
                          ? "bg-teal-400 text-slate-950 border-teal-300 shadow-md shadow-teal-500/40 animate-pulse"
                          : "bg-emerald-400 text-slate-950 border-emerald-300 shadow-md shadow-emerald-500/40 animate-pulse"
                    )}>
                      {isRecusado ? (
                        <ShieldAlert size={18} />
                      ) : (
                        <DollarSign size={22} className="stroke-[2.5]" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn(
                          "text-[10px] font-black uppercase px-2 py-0.5 rounded border font-mono",
                          isRecusado 
                            ? "bg-rose-900/60 border-rose-500/40 text-rose-200" 
                            : isPago
                              ? "bg-teal-900/90 border-teal-500/60 text-teal-200"
                              : "bg-emerald-900/90 border-emerald-500/60 text-emerald-200"
                        )}>
                          {desp.motorista_placa || 'S/ Placa'}
                        </span>
                        <span className={cn(
                          "text-[9px] font-black uppercase px-1.5 py-0.5 rounded border",
                          isRecusado
                            ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                            : isPago
                              ? "bg-teal-400 text-slate-950 border-teal-300 font-black"
                              : "bg-emerald-400 text-slate-950 border-emerald-300 font-black"
                        )}>
                          {isToastMotorista 
                            ? isPago ? '✅ Pago via PIX' : isAutorizado ? '✓ Autorizado' : isRecusado ? 'Recusado' : 'Pendente'
                            : desp.tipo || 'Despesa'
                          }
                        </span>
                      </div>

                      <h4 className="text-xs sm:text-[13px] font-black text-white mt-1 truncate">
                        {isToastMotorista 
                          ? isPago
                            ? `💸 Pagamento Realizado! R$ ${Number(desp.valor || 0).toFixed(2)}`
                            : isAutorizado 
                              ? `💰 Reembolso Autorizado! R$ ${Number(desp.valor || 0).toFixed(2)}`
                              : `Reembolso Recusado! (R$ ${Number(desp.valor || 0).toFixed(2)})`
                          : `💰 Solicitação de Reembolso: R$ ${Number(desp.valor || 0).toFixed(2)}`
                        }
                      </h4>
                    </div>
                  </div>

                  <button
                    onClick={() => removerToast(toast.id)}
                    className={cn(
                      "p-1 rounded-lg transition-colors cursor-pointer shrink-0",
                      isRecusado 
                        ? "text-rose-300 hover:text-white hover:bg-rose-800/60" 
                        : "text-emerald-300 hover:text-white hover:bg-emerald-800/60"
                    )}
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Mensagem e Detalhes da Despesa */}
                <div className={cn(
                  "mt-2.5 text-[11px] p-2.5 rounded-xl border space-y-1",
                  isRecusado 
                    ? "bg-rose-950/40 border-rose-500/30 text-rose-100" 
                    : isPago
                      ? "bg-teal-950/70 border-teal-500/40 text-teal-100"
                      : "bg-emerald-950/70 border-emerald-500/40 text-emerald-100"
                )}>
                  <div className="flex justify-between items-center font-bold">
                    <span className={isRecusado ? "text-rose-200" : isPago ? "text-teal-200" : "text-emerald-200"}>{desp.tipo}</span>
                    <span className={isRecusado ? "text-rose-300 font-mono" : isPago ? "text-teal-300 font-mono" : "text-emerald-300 font-mono"}>PIX: {desp.chave_pix || 'Não informado'}</span>
                  </div>
                  {isToastMotorista ? (
                    <p className={cn("italic line-clamp-2", isRecusado ? "text-rose-200" : isPago ? "text-teal-200" : "text-emerald-200")}>
                      {isPago && `Gestão confirmou a transferência via PIX no valor de R$ ${Number(desp.valor || 0).toFixed(2)}.`}
                      {isAutorizado && !isPago && `Monitoramento autorizou o reembolso de R$ ${Number(desp.valor || 0).toFixed(2)}. Pagamento via PIX em processamento.`}
                      {isRecusado && `Recusado: "${desp.observacaoMonitoramento || 'Reembolso não autorizado pela gestão'}"`}
                    </p>
                  ) : (
                    <div>
                      <p className={cn("text-[10px]", isPago ? "text-teal-300" : "text-emerald-300")}>
                        Recebedor: <strong className="text-white font-bold">{desp.nome_recebedor || 'Não informado'}</strong>
                      </p>
                      {desp.observacao && (
                        <p className={cn("italic truncate mt-0.5", isPago ? "text-teal-200" : "text-emerald-200")}>
                          Motivo: "{desp.observacao}"
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Rodapé com Ações de Compartilhamento & Acesso */}
                <div className="mt-2.5 pt-2 border-t border-emerald-500/40 flex items-center justify-between gap-1.5 flex-wrap sm:flex-nowrap">
                  <span className="text-[10px] font-bold text-emerald-300/80 shrink-0">
                    {isToastMotorista ? 'Resposta do Monitoramento' : 'Gestão de Custos'}
                  </span>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Botão de Compartilhar Card com WhatsApp */}
                    <button
                      type="button"
                      onClick={() => {
                        setDespesaParaCard(desp);
                        removerToast(toast.id);
                      }}
                      className="px-3 py-1.5 rounded-xl text-slate-950 font-black text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 bg-emerald-400 hover:bg-emerald-300 border border-emerald-300"
                      title="Abrir Card e Compartilhar no WhatsApp"
                    >
                      <Share2 size={13} />
                      <span>Compartilhar Card</span>
                    </button>

                    {/* Botão para Monitoramento ir para custos */}
                    {!isToastMotorista && (
                      <button
                        type="button"
                        onClick={() => abrirAbaCustos(desp)}
                        className="px-2.5 py-1.5 rounded-lg text-white font-bold text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                        title="Ver na aba Custos"
                      >
                        <span>Custos</span>
                        <ArrowRight size={12} />
                      </button>
                    )}
                  </div>
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
