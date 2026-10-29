package com.rjalimentos.logistrack;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ContentResolver;
import android.content.Context;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RotaGpsPlugin.class);
        super.onCreate(savedInstanceState);
        ensureHighPriorityNotificationChannels();
    }

    private void ensureHighPriorityNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        String pkg = getPackageName();
        AudioAttributes audioAttrs = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();

        // Canal 1: Alertas Operacionais Urgentes (som alerta_logistrack mesmo com tela bloqueada + vibração forte)
        NotificationChannel chUrgente = new NotificationChannel(
            "logistrack_urgente_v2",
            "Alertas Operacionais Urgentes",
            NotificationManager.IMPORTANCE_HIGH
        );
        chUrgente.setDescription("Devoluções, ocorrências em rota e solicitações urgentes");
        chUrgente.enableVibration(true);
        chUrgente.setVibrationPattern(new long[]{0, 350, 150, 450});
        chUrgente.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        chUrgente.setSound(
            Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + pkg + "/" + R.raw.alerta_logistrack),
            audioAttrs
        );
        nm.createNotificationChannel(chUrgente);

        // Canal 2: Reembolsos & PIX (som moeda_logistrack mesmo com tela bloqueada + vibração)
        NotificationChannel chFinanceiro = new NotificationChannel(
            "logistrack_financeiro_v2",
            "Reembolsos e Pagamentos PIX",
            NotificationManager.IMPORTANCE_HIGH
        );
        chFinanceiro.setDescription("Solicitações, autorizações e comprovantes de pagamento PIX");
        chFinanceiro.enableVibration(true);
        chFinanceiro.setVibrationPattern(new long[]{0, 250, 120, 250});
        chFinanceiro.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        chFinanceiro.setSound(
            Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + pkg + "/" + R.raw.moeda_logistrack),
            audioAttrs
        );
        nm.createNotificationChannel(chFinanceiro);
    }
}
