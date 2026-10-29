import {
  getAdminDb,
  FieldValue,
  verifyBearerToken,
  applyCors,
  parseJsonBody
} from './_firebaseAdmin.js';

function getDataHojeBrasilia() {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const y = parts.find(p => p.type === 'year')?.value;
  const m = parts.find(p => p.type === 'month')?.value;
  const d = parts.find(p => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}

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

    const placaToken = decoded.placa ? String(decoded.placa).toUpperCase() : null;
    const placaBody = body.placa ? String(body.placa).trim().toUpperCase() : null;
    const placa = decoded.role === 'Motorista' ? placaToken : (placaBody || placaToken);

    if (!placa) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'Placa não identificada.' }));
    }

    const dataRota = String(body.data || getDataHojeBrasilia()).trim();
    const carga = String(body.carga || '').trim();
    const motoristaNome = String(body.motoristaNome || '').trim();
    const gpsAtivo = body.gpsAtivo !== false;
    const emRota = body.emRota !== false;
    const agora = new Date().toISOString();
    const db = getAdminDb();

    // Atualização apenas de status (ex: GPS desligado ou fim de rota)
    if (body.statusOnly) {
      await db.collection('rastreamento_frota').doc(placa).set({
        placa,
        data: dataRota,
        ...(carga ? { carga } : {}),
        ...(motoristaNome ? { motoristaNome } : {}),
        gpsAtivo,
        emRota,
        atualizadoEm: agora
      }, { merge: true });

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ ok: true }));
    }

    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'Coordenadas inválidas.' }));
    }

    const speedKmh = Number.isFinite(Number(body.speedKmh)) ? Math.max(0, Math.round(Number(body.speedKmh))) : 0;
    const accuracy = Number.isFinite(Number(body.accuracy)) ? Math.round(Number(body.accuracy)) : null;

    const ponto = {
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      t: agora,
      v: speedKmh,
      ...(accuracy !== null ? { acc: accuracy } : {})
    };

    const liveRef = db.collection('rastreamento_frota').doc(placa);
    const rotaId = `${dataRota}_${placa}`;
    const rotaRef = db.collection('rotas_gps').doc(rotaId);

    const batch = db.batch();
    batch.set(liveRef, {
      placa,
      data: dataRota,
      carga,
      motoristaNome,
      lat: ponto.lat,
      lng: ponto.lng,
      speedKmh,
      accuracy,
      gpsAtivo: true,
      emRota: true,
      atualizadoEm: agora
    }, { merge: true });

    batch.set(rotaRef, {
      id: rotaId,
      data: dataRota,
      placa,
      ...(carga ? { carga } : {}),
      ...(motoristaNome ? { motoristaNome } : {}),
      gpsAtivo: true,
      ultimoPonto: ponto,
      atualizadoEm: agora,
      pontos: FieldValue.arrayUnion(ponto)
    }, { merge: true });

    await batch.commit();

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: true, ponto }));
  } catch (err) {
    console.error('[api/gps-ping] Erro:', err);
    res.statusCode = err.statusCode || 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: false, error: err.message }));
  }
}
