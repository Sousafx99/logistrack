import { getAdminAuth, applyCors, parseJsonBody } from './_firebaseAdmin.js';

function getPinHojeBrasilia() {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).formatToParts(new Date());
  const dia = parts.find(p => p.type === 'day')?.value || '01';
  const mes = parts.find(p => p.type === 'month')?.value || '01';
  const ano = parts.find(p => p.type === 'year')?.value || '2026';
  return {
    pin: `${dia}${mes}`,
    dataIso: `${ano}-${mes}-${dia}`
  };
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
    const body = await parseJsonBody(req);
    const pinDigitado = String(body.pin || '').trim().replace(/\D/g, '');
    const { pin: pinCorreto, dataIso } = getPinHojeBrasilia();

    if (!pinDigitado || pinDigitado !== pinCorreto) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ ok: false, error: 'PIN inválido para a data de hoje.' }));
    }

    const adminAuth = getAdminAuth();
    const customToken = await adminAuth.createCustomToken('painel_modo_tv', {
      role: 'TV',
      dataLiberada: dataIso
    });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({
      ok: true,
      customToken,
      dataLiberada: dataIso
    }));
  } catch (err) {
    console.error('[api/tv-auth] Erro:', err);
    res.statusCode = err.message === 'FIREBASE_SERVICE_ACCOUNT_MISSING' ? 503 : 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({
      ok: false,
      code: err.message,
      error: 'Falha ao autenticar Modo TV.'
    }));
  }
}
