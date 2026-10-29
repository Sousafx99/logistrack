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

async function captureAndSendOnce(ctx, { force = false } = {}) {
  if (!ctx?.placa) return false;
  const now = Date.now();
  // Evita gravação duplicada se o serviço nativo gravou nos últimos 4 minutos (a menos que seja forçado no login/início)
  if (!force && now - lastSavedTimestamp < 4 * 60 * 1000) return true;

  try {
    let coords = null;
    if (Capacitor.isNativePlatform()) {
      try {
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000
        });
        coords = pos?.coords;
      } catch (errHigh) {
        // Fallback rápido sem alta precisão (funciona em ambientes internos ou sinal celular fraco)
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 60000
        });
        coords = pos?.coords;
      }
    } else if (navigator?.geolocation) {
      coords = await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (p) => resolve(p.coords),
          () => {
            // Fallback rápido via rede/Wi-Fi se alta precisão expirar
            navigator.geolocation.getCurrentPosition(
              (p2) => resolve(p2.coords),
              () => resolve(null),
              { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
            );
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
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
        accuracy: coords.accuracy,
        emRota: Boolean(ctx.emRota)
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
export async function startRouteGpsTracking({ placa, data, carga = '', motoristaNome = '', emRota = false, onGpsStatusChange }) {
  const placaNorm = String(placa || '').trim().toUpperCase();
  if (!placaNorm) return;

  const dataEfetiva = data || new Date().toISOString().slice(0, 10);
  const keyChanged =
    !activeRouteContext ||
    activeRouteContext.placa !== placaNorm ||
    activeRouteContext.data !== dataEfetiva ||
    activeRouteContext.carga !== carga ||
    activeRouteContext.emRota !== emRota;

  activeRouteContext = { placa: placaNorm, data: dataEfetiva, carga, motoristaNome, emRota };
  if (!keyChanged && trackingIntervalId) return;

  stopRouteGpsTracking({ silent: true });
  activeRouteContext = { placa: placaNorm, data: dataEfetiva, carga, motoristaNome, emRota };

  // 1. No APK Android, se em rota, inicia o Foreground Service nativo (mantém coleta de 5 em 5 min mesmo bloqueado ou no Waze)
  if (Capacitor.isNativePlatform() && emRota) {
    try {
      const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      await RotaGpsNative.startForegroundTracking({
        placa: placaNorm,
        data: dataEfetiva,
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

  // 2. Captura ponto inicial imediato (force = true)
  captureAndSendOnce(activeRouteContext, { force: true }).then((sucesso) => {
    if (sucesso && typeof onGpsStatusChange === 'function') {
      onGpsStatusChange({ active: true, checked: true, permissionGranted: true, hardwareEnabled: true });
    }
  });

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
        emRota: activeRouteContext.emRota
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
