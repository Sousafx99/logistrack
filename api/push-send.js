import {
  getAdminDb,
  getAdminMessaging,
  verifyBearerToken,
  applyCors,
  parseJsonBody
} from './_firebaseAdmin.js';

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'Método não permitido' }));
  }

  try {
    const decoded = await verifyBearerToken(req);
    const body = await parseJsonBody(req);

    const targetType = body.targetType === 'placa' ? 'placa' : 'gestao';
    const targetPlaca = String(body.targetPlaca || '').trim().toUpperCase();
    const targetRoles = Array.isArray(body.targetRoles) && body.targetRoles.length > 0
      ? body.targetRoles
      : ['Monitoramento', 'Operacao'];

    // Motorista só pode disparar notificações para a Gestão, nunca para outras placas
    if (decoded.role === 'Motorista' && targetType !== 'gestao') {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ error: 'Permissão negada para envio direto a veículos.' }));
    }

    const title = String(body.title || 'LogisTrack').slice(0, 120);
    const messageBody = String(body.body || '').slice(0, 300);
    const url = String(body.url || '/');
    const tag = String(body.tag || `lt-${Date.now()}`);
    const soundType = String(body.soundType || 'default'); // 'alarm' | 'coin' | 'default'
    const channelId = soundType === 'coin' ? 'logistrack_financeiro_v2' : 'logistrack_urgente_v2';

    const db = getAdminDb();
    let snap;
    if (targetType === 'placa') {
      if (!targetPlaca) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'targetPlaca é obrigatório.' }));
      }
      snap = await db.collection('fcm_tokens').where('placa', '==', targetPlaca).get();
    } else {
      snap = await db.collection('fcm_tokens').where('role', 'in', targetRoles.slice(0, 10)).get();
    }

    if (snap.empty) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ ok: true, sent: 0 }));
    }

    const tokenDocs = [];
    const seenTokens = new Set();
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      if (d?.token && !seenTokens.has(d.token)) {
        // Filtra subRole de Operacao quando aplicável (ex: Financeiro só recebe despesas, Docas recebe devoluções)
        if (targetType === 'gestao' && d.role === 'Operacao' && body.operacaoSubRole) {
          if (d.subRole && d.subRole !== body.operacaoSubRole) return;
        }
        seenTokens.add(d.token);
        tokenDocs.push({ id: docSnap.id, token: d.token });
      }
    });

    if (tokenDocs.length === 0) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ ok: true, sent: 0 }));
    }

    const messaging = getAdminMessaging();
    const tokens = tokenDocs.map(t => t.token);

    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title,
        body: messageBody
      },
      data: {
        title,
        body: messageBody,
        url,
        tag,
        soundType,
        channelId,
        ...(body.extraData && typeof body.extraData === 'object'
          ? Object.fromEntries(Object.entries(body.extraData).map(([k, v]) => [k, String(v ?? '')]))
          : {})
      },
      android: {
        priority: 'high',
        ttl: 3600 * 1000,
        notification: {
          channelId,
          sound: soundType === 'coin' ? 'moeda_logistrack' : 'alerta_logistrack',
          priority: 'max',
          visibility: 'public',
          defaultVibrateTimings: false,
          vibrateTimingsMillis: [0, 450, 200, 450]
        }
      },
      webpush: {
        headers: {
          Urgency: 'high',
          TTL: '3600'
        },
        notification: {
          title,
          body: messageBody,
          icon: '/android-chrome-192x192.png',
          badge: '/favicon-32x32.png',
          tag,
          renotify: true,
          requireInteraction: true,
          vibrate: [350, 150, 350]
        },
        fcmOptions: {
          link: url
        }
      }
    });

    // Remove tokens inválidos automaticamente para manter banco enxuto
    const invalidIds = [];
    response.responses.forEach((r, idx) => {
      if (!r.success && r.error) {
        const code = r.error.code || '';
        if (
          code.includes('registration-token-not-registered') ||
          code.includes('invalid-registration-token') ||
          code.includes('invalid-argument')
        ) {
          invalidIds.push(tokenDocs[idx].id);
        }
      }
    });

    if (invalidIds.length > 0) {
      const batch = db.batch();
      invalidIds.forEach(id => batch.delete(db.collection('fcm_tokens').doc(id)));
      await batch.commit().catch(() => {});
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({
      ok: true,
      sent: response.successCount,
      failed: response.failureCount,
      cleaned: invalidIds.length
    }));
  } catch (err) {
    console.error('[api/push-send] Erro:', err);
    res.statusCode = err.statusCode || 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: false, error: err.message }));
  }
}
