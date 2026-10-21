import { useEffect, useRef } from 'react';

/**
 * Hook para detectar novas versões implantadas da aplicação (Vercel/Deploy)
 * e recarregar automaticamente telas de monitoramento e telões sem intervenção manual.
 */
export function useAutoVersionReload(intervalMs = 60000) {
  const currentVersionRef = useRef(null);
  const isReloadingRef = useRef(false);

  useEffect(() => {
    let timer = null;
    let isMounted = true;

    const checkVersion = async () => {
      if (isReloadingRef.current || !navigator.onLine) return;

      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });

        if (!res.ok) return;

        const data = await res.json();
        if (!data || !data.version) return;

        if (!currentVersionRef.current) {
          // Primeira carga: registra a versão atual em execução
          currentVersionRef.current = data.version;
          console.log(`[AutoVersion] Versão inicial ativa: ${data.version} (${data.buildTime || 'local'})`);
        } else if (data.version !== currentVersionRef.current) {
          // Nova versão detectada na Vercel / Servidor
          console.log(`[AutoVersion] Nova versão detectada: ${data.version}. Versão anterior: ${currentVersionRef.current}. Recarregando aplicação...`);
          isReloadingRef.current = true;
          // Pequeno timeout para garantir logs e recarregar
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        }
      } catch (err) {
        // Silencioso se for erro temporário de rede
      }
    };

    // Checagem imediata inicial
    checkVersion();

    // Checagem periódica a cada intervalMs (padrão: 60s)
    timer = setInterval(checkVersion, intervalMs);

    // Checagem ao acordar tela ou focar na aba
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };
    const handleFocus = () => checkVersion();
    const handleOnline = () => checkVersion();

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);

    return () => {
      isMounted = false;
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, [intervalMs]);
}
