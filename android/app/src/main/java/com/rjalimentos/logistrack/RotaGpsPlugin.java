package com.rjalimentos.logistrack;

import android.content.Context;
import android.content.Intent;
import android.location.LocationManager;
import android.provider.Settings;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "RotaGps")
public class RotaGpsPlugin extends Plugin {

    @PluginMethod
    public void isGpsEnabled(PluginCall call) {
        boolean enabled = false;
        try {
            LocationManager lm = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
            if (lm != null) {
                enabled = lm.isProviderEnabled(LocationManager.GPS_PROVIDER)
                    || lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
            }
        } catch (Exception ignored) {}

        JSObject ret = new JSObject();
        ret.put("enabled", enabled);
        call.resolve(ret);
    }

    @PluginMethod
    public void openLocationSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Não foi possível abrir configurações de localização", e);
        }
    }

    @PluginMethod
    public void startForegroundTracking(PluginCall call) {
        try {
            Context ctx = getContext();
            Intent serviceIntent = new Intent(ctx, RotaGpsForegroundService.class);
            serviceIntent.setAction(RotaGpsForegroundService.ACTION_START);
            serviceIntent.putExtra("placa", call.getString("placa", ""));
            serviceIntent.putExtra("data", call.getString("data", ""));
            serviceIntent.putExtra("carga", call.getString("carga", ""));
            serviceIntent.putExtra("motoristaNome", call.getString("motoristaNome", ""));
            serviceIntent.putExtra("endpoint", call.getString("endpoint", ""));
            serviceIntent.putExtra("idToken", call.getString("idToken", ""));
            Integer intervalInt = call.getInt("intervalMs", 300000);
            serviceIntent.putExtra("intervalMs", intervalInt != null ? intervalInt.longValue() : 300000L);

            ContextCompat.startForegroundService(ctx, serviceIntent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Falha ao iniciar serviço de GPS em segundo plano", e);
        }
    }

    @PluginMethod
    public void updateToken(PluginCall call) {
        try {
            Context ctx = getContext();
            Intent serviceIntent = new Intent(ctx, RotaGpsForegroundService.class);
            serviceIntent.setAction(RotaGpsForegroundService.ACTION_UPDATE_TOKEN);
            serviceIntent.putExtra("idToken", call.getString("idToken", ""));
            ctx.startService(serviceIntent);
            call.resolve();
        } catch (Exception e) {
            call.resolve();
        }
    }

    @PluginMethod
    public void stopForegroundTracking(PluginCall call) {
        try {
            Context ctx = getContext();
            Intent stopIntent = new Intent(ctx, RotaGpsForegroundService.class);
            stopIntent.setAction(RotaGpsForegroundService.ACTION_STOP);
            ctx.stopService(stopIntent);
            call.resolve();
        } catch (Exception e) {
            call.resolve();
        }
    }
}
