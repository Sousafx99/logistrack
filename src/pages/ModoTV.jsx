import React, { useEffect, useState } from 'react';
import { Lock, Tv, Loader2, Sun, Moon, Monitor } from 'lucide-react';
import { DashboardLogistico } from './DashboardLogistico';
import { useStore } from '../store/useStore';
import { Logo } from '../components/Common/Logo';
import {
  getThemePreference,
  cycleThemePreference,
  subscribeThemeChange
} from '../lib/themeManager';

export function ModoTV() {
  const currentUser = useStore(state => state.currentUser);
  const authReady = useStore(state => state.authReady);
  const loginModoTV = useStore(state => state.loginModoTV);

  const [pin, setPin] = useState('');
  const [loadingPin, setLoadingPin] = useState(false);
  const [erroPin, setErroPin] = useState('');
  const [themePref, setThemePref] = useState(getThemePreference());

  useEffect(() => {
    return subscribeThemeChange(({ preference }) => setThemePref(preference));
  }, []);

  // Verifica se já há perfil autorizado logado (Monitoramento, Operacao ou TV)
  const isAutorizado = Boolean(
    currentUser && ['Monitoramento', 'Operacao', 'TV'].includes(currentUser.role)
  );

  // 1. Manter a tela acordada usando a Screen Wake Lock API (para TVs e monitores)
  useEffect(() => {
    if (!isAutorizado) return;
    let wakeLock = null;
    let isMounted = true;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator && isMounted) {
          wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch {}
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isMounted) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) {
        wakeLock.release().catch(() => {});
      }
    };
  }, [isAutorizado]);

  // 2. Quando autorizado, no primeiro clique ou tecla OK do controle remoto, ativa tela cheia
  useEffect(() => {
    if (!isAutorizado) return;
    const handleFirstInteraction = (e) => {
      if (e.target?.closest?.('[data-no-fullscreen]')) return;
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    };

    window.addEventListener('click', handleFirstInteraction, { once: true });
    window.addEventListener('keydown', handleFirstInteraction, { once: true });

    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [isAutorizado]);

  const handleConfirmPin = async (e) => {
    e.preventDefault();
    setErroPin('');
    if (pin.replace(/\D/g, '').length !== 4) {
      setErroPin('Digite os 4 dígitos do PIN do dia.');
      return;
    }

    setLoadingPin(true);
    try {
      const ok = await loginModoTV(pin);
      if (!ok) {
        setErroPin('PIN incorreto para a data de hoje.');
      }
    } catch {
      setErroPin('Falha ao validar PIN. Verifique a conexão.');
    } finally {
      setLoadingPin(false);
    }
  };

  if (!authReady) {
    return (
      <main className="w-screen h-screen bg-background-tertiary text-text-primary flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-info" />
        <span className="text-sm font-semibold text-text-secondary">Iniciando Modo Telão...</span>
      </main>
    );
  }

  // Se não houver usuário de Gestão/Operação logado, solicita o PIN dinâmico do dia ("ddmm")
  if (!isAutorizado) {
    const themeIcon = themePref === 'dark' ? <Moon size={16} /> : themePref === 'system' ? <Monitor size={16} /> : <Sun size={16} />;
    const themeLabel = themePref === 'dark' ? 'Escuro' : themePref === 'system' ? 'Sistema' : 'Creme';

    return (
      <main className="w-screen h-screen bg-background-tertiary text-text-primary flex flex-col items-center justify-center p-6 relative">
        <div className="fixed top-4 right-4">
          <button
            type="button"
            onClick={() => cycleThemePreference()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-background-secondary border border-border-secondary text-text-primary text-xs font-bold shadow-sm hover:border-info/50 transition-all cursor-pointer"
          >
            {themeIcon}
            <span>Tema: {themeLabel}</span>
          </button>
        </div>

        <div className="w-full max-w-sm glass-panel rounded-2xl p-8 shadow-lg text-center space-y-5">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-background-primary border border-border-secondary p-2.5 flex items-center justify-center shadow-xs">
            <Logo className="w-full h-full" />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-info/10 text-info border border-info/25 text-xs font-extrabold uppercase tracking-wider mb-2">
              <Tv size={14} /> Modo Telão / TV
            </div>
            <h1 className="text-2xl font-black text-text-primary">Acesso ao Painel</h1>
            <p className="text-xs sm:text-sm text-text-secondary mt-1">
              Informe o PIN de 4 dígitos do dia corrente para liberar a exibição em tempo real.
            </p>
          </div>

          <form onSubmit={handleConfirmPin} className="space-y-4">
            <div className="relative">
              <Lock size={18} className="absolute left-4 top-3.5 text-text-muted" />
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                autoFocus
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                  setErroPin('');
                }}
                placeholder="••••"
                className="w-full text-center font-mono text-2xl font-black tracking-[0.5em] py-2.5 px-10 rounded-xl bg-background-primary border border-border-secondary text-text-primary focus:outline-hidden focus:ring-2 focus:ring-info"
              />
            </div>

            {erroPin && (
              <div className="text-xs font-bold text-danger bg-danger/10 border border-danger/25 rounded-xl p-2.5">
                {erroPin}
              </div>
            )}

            <button
              type="submit"
              disabled={loadingPin || pin.length < 4}
              className="w-full py-3 rounded-xl bg-info hover:bg-info/90 text-white font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loadingPin && <Loader2 size={18} className="animate-spin" />}
              <span>Liberar Modo TV</span>
            </button>
          </form>
        </div>
      </main>
    );
  }

  // Segue fielmente o tema padrão do sistema (Claro Creme ou Escuro), sem fundo preto fixo
  return (
    <main className="w-screen h-screen overflow-hidden bg-background-tertiary text-text-primary flex flex-col no-scrollbar transition-colors">
      <DashboardLogistico isTVMode={true} />
    </main>
  );
}

export default ModoTV;
