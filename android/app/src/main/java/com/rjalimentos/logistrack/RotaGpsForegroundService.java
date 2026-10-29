package com.rjalimentos.logistrack;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class RotaGpsForegroundService extends Service {
    public static final String ACTION_START = "com.rjalimentos.logistrack.ROTA_GPS_START";
    public static final String ACTION_UPDATE_TOKEN = "com.rjalimentos.logistrack.ROTA_GPS_TOKEN";
    public static final String ACTION_STOP = "com.rjalimentos.logistrack.ROTA_GPS_STOP";

    private static final String CHANNEL_ID = "logistrack_gps_rota";
    private static final int NOTIFICATION_ID = 4810;

    private String placa = "";
    private String dataRota = "";
    private String carga = "";
    private String motoristaNome = "";
    private String endpoint = "";
    private volatile String idToken = "";
    private long intervalMs = 5L * 60L * 1000L;

    private Handler mainHandler;
    private ExecutorService networkExecutor;
    private PowerManager.WakeLock wakeLock;
    private LocationManager locationManager;
    private boolean isTracking = false;

    private final Runnable periodicPingRunnable = new Runnable() {
        @Override
        public void run() {
            if (!isTracking) return;
            requestSingleLocationAndSend();
            mainHandler.postDelayed(this, intervalMs);
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        mainHandler = new Handler(Looper.getMainLooper());
        networkExecutor = Executors.newSingleThreadExecutor();
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        createServiceChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String action = intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopTrackingAndSelf();
            return START_NOT_STICKY;
        }

        if (ACTION_UPDATE_TOKEN.equals(action)) {
            String newToken = intent.getStringExtra("idToken");
            if (newToken != null && !newToken.isEmpty()) {
                idToken = newToken;
            }
            return START_STICKY;
        }

        placa = safeStr(intent.getStringExtra("placa"));
        dataRota = safeStr(intent.getStringExtra("data"));
        carga = safeStr(intent.getStringExtra("carga"));
        motoristaNome = safeStr(intent.getStringExtra("motoristaNome"));
        endpoint = safeStr(intent.getStringExtra("endpoint"));
        idToken = safeStr(intent.getStringExtra("idToken"));
        long reqInterval = intent.getLongExtra("intervalMs", 5L * 60L * 1000L);
        if (reqInterval >= 60000L) {
            intervalMs = reqInterval;
        }

        Notification notification = buildForegroundNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        acquireSafeWakeLock();
        isTracking = true;
        mainHandler.removeCallbacks(periodicPingRunnable);
        // Primeiro envio em segundo plano após o intervalo inicial (o JS já envia o ponto 0 imediato)
        mainHandler.postDelayed(periodicPingRunnable, intervalMs);

        return START_STICKY;
    }

    private void requestSingleLocationAndSend() {
        if (locationManager == null) return;

        boolean hasFine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean hasCoarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        if (!hasFine && !hasCoarse) {
            sendPingToCloud(null, false);
            return;
        }

        boolean gpsOn = false;
        boolean netOn = false;
        try {
            gpsOn = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER);
            netOn = locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
        } catch (Exception ignored) {}

        if (!gpsOn && !netOn) {
            sendPingToCloud(null, false);
            return;
        }

        String provider = (hasFine && gpsOn) ? LocationManager.GPS_PROVIDER : LocationManager.NETWORK_PROVIDER;
        try {
            final boolean[] delivered = { false };
            final LocationListener singleListener = new LocationListener() {
                @Override
                public void onLocationChanged(@NonNull Location location) {
                    if (delivered[0]) return;
                    delivered[0] = true;
                    try {
                        locationManager.removeUpdates(this);
                    } catch (Exception ignored) {}
                    sendPingToCloud(location, true);
                }

                @Override
                public void onStatusChanged(String p, int status, Bundle extras) {}

                @Override
                public void onProviderEnabled(@NonNull String p) {}

                @Override
                public void onProviderDisabled(@NonNull String p) {}
            };

            locationManager.requestLocationUpdates(provider, 0L, 0f, singleListener, Looper.getMainLooper());

            // Fallback após 18s caso o satélite esteja em túnel/galpão fechado: usa última posição conhecida recente
            mainHandler.postDelayed(() -> {
                if (!delivered[0]) {
                    delivered[0] = true;
                    try {
                        locationManager.removeUpdates(singleListener);
                        Location lastGps = hasFine ? locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER) : null;
                        Location lastNet = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
                        Location best = lastGps != null ? lastGps : lastNet;
                        if (best != null) {
                            sendPingToCloud(best, true);
                        }
                    } catch (SecurityException ignored) {}
                }
            }, 18000L);
        } catch (Exception e) {
            // Ignora falha pontual
        }
    }

    private void sendPingToCloud(@Nullable Location loc, boolean gpsEnabled) {
        if (endpoint == null || endpoint.isEmpty() || idToken == null || idToken.isEmpty() || placa.isEmpty()) {
            return;
        }

        networkExecutor.execute(() -> {
            HttpURLConnection conn = null;
            try {
                JSONObject payload = new JSONObject();
                payload.put("placa", placa);
                payload.put("data", dataRota);
                payload.put("carga", carga);
                payload.put("motoristaNome", motoristaNome);
                payload.put("gpsAtivo", gpsEnabled);
                payload.put("emRota", true);

                if (loc == null || !gpsEnabled) {
                    payload.put("statusOnly", true);
                } else {
                    payload.put("lat", loc.getLatitude());
                    payload.put("lng", loc.getLongitude());
                    int speedKmh = loc.hasSpeed() ? Math.max(0, Math.round(loc.getSpeed() * 3.6f)) : 0;
                    payload.put("speedKmh", speedKmh);
                    if (loc.hasAccuracy()) {
                        payload.put("accuracy", Math.round(loc.getAccuracy()));
                    }
                }

                byte[] bodyBytes = payload.toString().getBytes(StandardCharsets.UTF_8);
                URL url = new URL(endpoint);
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(15000);
                conn.setDoOutput(true);
                conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
                conn.setRequestProperty("Authorization", "Bearer " + idToken);

                try (OutputStream os = conn.getOutputStream()) {
                    os.write(bodyBytes);
                    os.flush();
                }
                conn.getResponseCode();
            } catch (Exception ignored) {
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
            }
        });
    }

    private Notification buildForegroundNotification() {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            piFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, openIntent, piFlags);

        String titulo = "Rota em Andamento • " + (placa.isEmpty() ? "LogisTrack" : placa);
        String texto = "Mantenha o GPS ligado • Registro automático a cada 5 min";

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(titulo)
            .setContentText(texto)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build();
    }

    private void createServiceChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID,
                    "Acompanhamento de Rota GPS",
                    NotificationManager.IMPORTANCE_LOW
                );
                ch.setDescription("Mantém o acompanhamento da rota ativo enquanto a entrega está em andamento.");
                ch.setShowBadge(false);
                nm.createNotificationChannel(ch);
            }
        }
    }

    private void acquireSafeWakeLock() {
        try {
            if (wakeLock == null) {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "LogisTrack::RotaGpsLock");
                    wakeLock.setReferenceCounted(false);
                }
            }
            if (wakeLock != null && !wakeLock.isHeld()) {
                // Timeout máximo de segurança de 14 horas por turno
                wakeLock.acquire(14L * 60L * 60L * 1000L);
            }
        } catch (Exception ignored) {}
    }

    private void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        } catch (Exception ignored) {}
    }

    private void stopTrackingAndSelf() {
        isTracking = false;
        if (mainHandler != null) {
            mainHandler.removeCallbacksAndMessages(null);
        }
        releaseWakeLock();
        stopForeground(true);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        isTracking = false;
        if (mainHandler != null) {
            mainHandler.removeCallbacksAndMessages(null);
        }
        releaseWakeLock();
        if (networkExecutor != null) {
            networkExecutor.shutdownNow();
        }
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private static String safeStr(String s) {
        return s == null ? "" : s.trim();
    }
}
