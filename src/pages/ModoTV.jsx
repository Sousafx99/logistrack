import React, { useEffect } from 'react';
import { DashboardLogistico } from './DashboardLogistico';

export function ModoTV() {
  // 1. Manter a tela acordada usando a Screen Wake Lock API (para TVs e monitores)
  useEffect(() => {
    let wakeLock = null;
    let isMounted = true;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator && isMounted) {
          wakeLock = await navigator.wakeLock.request('screen');
          console.log('[ModoTV] Screen Wake Lock ativado com sucesso');
        }
      } catch (err) {
        console.warn('[ModoTV] Screen Wake Lock não suportado ou negado:', err);
      }
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
  }, []);

  // 2. No primeiro clique, toque ou tecla (ex: botão OK do controle remoto da LG TV),
  // ativa tela cheia nativa se ainda não estiver ativa.
  useEffect(() => {
    const handleFirstInteraction = () => {
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
  }, []);

  // 3. Força tema escuro (dark) no documento para máximo conforto e contraste na TV
  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains('dark');
    root.classList.add('dark');

    return () => {
      if (!hadDark) {
        root.classList.remove('dark');
      }
    };
  }, []);

  return (
    <main className="w-screen h-screen overflow-hidden bg-[#09090b] text-zinc-100 flex flex-col no-scrollbar">
      <DashboardLogistico isTVMode={true} />
    </main>
  );
}

export default ModoTV;
