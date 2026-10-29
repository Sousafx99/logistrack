import { useEffect, useRef } from 'react';
import { IS_NATIVE_APK } from '../lib/appConfig';

/**
 * Hook para detectar novas versões implantadas da aplicação Web (Vercel)
 * Desativado automaticamente nos APKs Android para nunca perder fotos da câmera ou formulários.
 */
export function useAutoVersionReload(intervalMs = 60000) {
  const currentVersionRef = useRef(null);
  const isReloadingRef = useRef(false);

  useEffect(() => {
    if (IS_NATIVE_APK) return;

    let timer = null;

    const checkVersion = async () => {
      if (isReloadingRef.current || !navigator.onLine) return;

      // Não recarrega se o usuário estiver digitando ou com modal aberto
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;

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
          currentVersionRef.current = data.version;
        } else if (data.version !== currentVersionRef.current) {
          isReloadingRef.current = true;
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        }
      } catch {
        // Silencioso em oscilação de rede
      }
    };

    checkVersion();
    timer = setInterval(checkVersion, intervalMs);

    const handleOnline = () => checkVersion();
    window.addEventListener('online', handleOnline);

    return () => {
      if (timer) clearInterval(timer);
      window.removeEventListener('online', handleOnline);
    };
  }, [intervalMs]);
}
