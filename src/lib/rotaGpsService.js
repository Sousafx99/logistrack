import { Capacitor, registerPlugin } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { auth } from './firebase';
import { firestoreService } from './firestoreService';
import { apiUrl } from './appConfig';

// Plugin nativo Android embutido no APK Motorista (Foreground Service para coleta com tela bloqueada/Waze)
const RotaGpsNative = registerPlugin('RotaGps');

const INTERVALO_COLETA_MS = 5 * 60 * 1000; // 5 em 5 minutos conforme definido
const INTERVALO_CHECAGEM_STATUS_MS = 25 * 1000;

let trackingIntervalId = null;
let statusCheckIntervalId = null;
let lastSavedTimestamp = 0;
let lastKnownGpsEnabled = null;
let activeRouteContext = null;

/**
 * Verifica se o GPS do aparelho está ligado e com permissão concedida
 */
export async function checkDriverGpsActive() {
  if (Capacitor.isNativePlatform()) {
    try {
      const perm = await Geolocation.checkPermissions();
      const hasPerm = perm.location === 'granted' || perm.coarseLocation === 'granted';

      let hardwareEnabled = true;
      try {
        const res = await RotaGpsNative.isGpsEnabled();
        if (res && typeof res.enabled === 'boolean') {
          hardwareEnabled = res.enabled;
        }
      } catch {
        // Caso o método nativo não esteja disponível, testa leitura rápida
      }

      return {
        active: Boolean(hasPerm && hardwareEnabled),
        permissionGranted: hasPerm,
        hardwareEnabled
      };
    } catch {
      return { active: false, permissionGranted: false, hardwareEnabled: false };
    }
  }

  // Fallback Navegador Mobile / Desktop
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return { active: false, permissionGranted: false, hardwareEnabled: false };
  }

  try {
    if (navigator.permissions?.query) {
      const p = await navigator.permissions.query({ name: 'geolocation' });
      if (p.state === 'denied') {
        return { active: false, permissionGranted: false, hardwareEnabled: true };
      }
    }
    return { active: true, permissionGranted: true, hardwareEnabled: true };
  } catch {
    return { active: true, permissionGranted: true, hardwareEnabled: true };
  }
}

/**
 * Solicita permissão de GPS e, se o GPS estiver desligado no Android, abre a tela de Localização do sistema
 */
export async function promptEnableDriverGps() {
  if (Capacitor.isNativePlatform()) {
    try {
      const perm = await Geolocation.requestPermissions({ permissions: ['location'] });
      const status = await checkDriverGpsActive();
      if (!status.hardwareEnabled) {
        await RotaGpsNative.openLocationSettings().catch(() => {});
      }
      return await checkDriverGpsActive();
    } catch {
      return { active: false, permissionGranted: false, hardwareEnabled: false };
    }
  }

  return new Promise((resolve) => {
    if (!navigator?.geolocation) {
      resolve({ active: false, permissionGranted: false, hardwareEnabled: false });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => resolve({ active: true, permissionGranted: true, hardwareEnabled: true }),
      () => resolve({ active: false, permissionGranted: false, hardwareEnabled: false }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

async function captureAndSendOnce(ctx) {
  if (!ctx?.placa) return false;
  const now = Date.now();
  // Evita gravação duplicada se o serviço nativo acabou de gravar nos últimos 4 minutos
  if (now - lastSavedTimestamp < 4 * 60 * 1000) return true;

  try {
    let coords = null;
    if (Capacitor.isNativePlatform()) {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000
      });
      coords = pos?.coords;
    } else if (navigator?.geolocation) {
      coords = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (p) => resolve(p.coords),
          (e) => reject(e),
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
        );
      });
    }

    if (coords && Number.isFinite(coords.latitude) && Number.isFinite(coords.longitude)) {
      const speedKmh = Number.isFinite(coords.speed) && coords.speed > 0
        ? Math.round(coords.speed * 3.6)
        : 0;
      await firestoreService.registrarPontoGpsRota({
        placa: ctx.placa,
        data: ctx.data,
        carga: ctx.carga,
        motoristaNome: ctx.motoristaNome,
        lat: coords.latitude,
        lng: coords.longitude,
        speedKmh,
        accuracy: coords.accuracy
      });
      lastSavedTimestamp = Date.now();
      return true;
    }
  } catch (err) {
    console.warn('[RotaGPS] Falha na captura periódica:', err?.message || err);
  }
  return false;
}

/**
 * Inicia a coleta de coordenadas a cada 5 minutos do início da rota (KM Inicial) até finalizar
 */
export async function startRouteGpsTracking({ placa, data, carga = '', motoristaNome = '', onGpsStatusChange }) {
  const placaNorm = String(placa || '').trim().toUpperCase();
  if (!placaNorm) return;

  const keyChanged =
    !activeRouteContext ||
    activeRouteContext.placa !== placaNorm ||
    activeRouteContext.data !== data ||
    activeRouteContext.carga !== carga;

  activeRouteContext = { placa: placaNorm, data, carga, motoristaNome };
  if (!keyChanged && trackingIntervalId) return;

  stopRouteGpsTracking({ silent: true });
  activeRouteContext = { placa: placaNorm, data, carga, motoristaNome };

  // 1. No APK Android, inicia o Foreground Service nativo (mantém coleta de 5 em 5 min mesmo bloqueado ou no Waze)
  if (Capacitor.isNativePlatform()) {
    try {
      const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      await RotaGpsNative.startForegroundTracking({
        placa: placaNorm,
        data: data || '',
        carga: carga || '',
        motoristaNome: motoristaNome || '',
        endpoint: apiUrl('/api/gps-ping'),
        idToken,
        intervalMs: INTERVALO_COLETA_MS
      });
    } catch (err) {
      console.warn('[RotaGPS] Foreground Service fallback para timer JS:', err?.message);
    }
  }

  // 2. Captura ponto inicial imediato na partida da rota
  captureAndSendOnce(activeRouteContext);

  // 3. Coleta periódica a cada 5 minutos
  trackingIntervalId = setInterval(async () => {
    if (!activeRouteContext) return;
    // Atualiza o token no serviço nativo caso tenha renovado (tokens Firebase duram 1h)
    if (Capacitor.isNativePlatform() && auth.currentUser) {
      try {
        const freshToken = await auth.currentUser.getIdToken();
        await RotaGpsNative.updateToken({ idToken: freshToken });
      } catch {}
    }
    await captureAndSendOnce(activeRouteContext);
  }, INTERVALO_COLETA_MS);

  // 4. Monitora se o motorista desligou o GPS durante a rota (só grava no banco se o status mudar!)
  statusCheckIntervalId = setInterval(async () => {
    const st = await checkDriverGpsActive();
    if (typeof onGpsStatusChange === 'function') {
      onGpsStatusChange(st);
    }
    if (lastKnownGpsEnabled !== st.active && activeRouteContext) {
      lastKnownGpsEnabled = st.active;
      firestoreService.atualizarStatusGpsVeiculo({
        placa: activeRouteContext.placa,
        data: activeRouteContext.data,
        carga: activeRouteContext.carga,
        motoristaNome: activeRouteContext.motoristaNome,
        gpsAtivo: st.active,
        emRota: true
      }).catch(() => {});
    }
  }, INTERVALO_CHECAGEM_STATUS_MS);
}

/**
 * Encerra imediatamente o rastreamento quando o motorista finaliza a rota ou desloga
 */
export async function stopRouteGpsTracking({ finalizeInCloud = false, silent = false } = {}) {
  const prevCtx = activeRouteContext;
  activeRouteContext = null;
  lastKnownGpsEnabled = null;

  if (trackingIntervalId) {
    clearInterval(trackingIntervalId);
    trackingIntervalId = null;
  }
  if (statusCheckIntervalId) {
    clearInterval(statusCheckIntervalId);
    statusCheckIntervalId = null;
  }

  if (Capacitor.isNativePlatform()) {
    try {
      await RotaGpsNative.stopForegroundTracking();
    } catch {}
  }

  if (finalizeInCloud && prevCtx?.placa && !silent) {
    lastSavedTimestamp = 0;
    await captureAndSendOnce(prevCtx).catch(() => {});
    await firestoreService.atualizarStatusGpsVeiculo({
      placa: prevCtx.placa,
      data: prevCtx.data,
      carga: prevCtx.carga,
      motoristaNome: prevCtx.motoristaNome,
      emRota: false
    }).catch(() => {});
  }
}
