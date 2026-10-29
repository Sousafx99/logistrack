import {
  getAdminAuth,
  getAdminDb,
  verifyBearerToken,
  applyCors,
  parseJsonBody
} from './_firebaseAdmin.js';

export function placaToAuthEmail(placa) {
  const clean = String(placa || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${clean}@frota.logistrack.app`;
}

export function gerarSenhaPadraoPlaca(placa, digitosCustom) {
  const clean = String(placa || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const d = digitosCustom && /^\d{2}$/.test(String(digitosCustom))
    ? String(digitosCustom)
    : String(Math.floor(10 + Math.random() * 90));
  return `rj${clean}${d}`;
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
    if (decoded.role !== 'Monitoramento') {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ error: 'Apenas o perfil Monitoramento pode gerenciar credenciais.' }));
    }

    const body = await parseJsonBody(req);
    const { action } = body;
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    if (action === 'upsertDriverPassword') {
      const placa = String(body.placa || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!placa || placa.length < 5) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'Placa inválida.' }));
      }

      // Placas virtuais/administrativas não recebem login ativo por padrão
      const isVirtual = /^(SAB|RES)\d+/i.test(placa);
      let senha = body.senha
        ? String(body.senha).trim().toLowerCase()
        : gerarSenhaPadraoPlaca(placa);

      if (senha.length < 6) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'A senha deve ter no mínimo 6 caracteres (ex: rj + placa + 2 dígitos).' }));
      }

      const ativo = body.ativo !== undefined ? Boolean(body.ativo) : !isVirtual;
      const email = placaToAuthEmail(placa);
      let userRecord;

      try {
        userRecord = await adminAuth.getUserByEmail(email);
        await adminAuth.updateUser(userRecord.uid, {
          password: senha,
          displayName: `Motorista ${placa}`,
          disabled: !ativo
        });
      } catch (err) {
        if (err.code === 'auth/user-not-found') {
          userRecord = await adminAuth.createUser({
            email,
            password: senha,
            displayName: `Motorista ${placa}`,
            disabled: !ativo
          });
        } else {
          throw err;
        }
      }

      await adminAuth.setCustomUserClaims(userRecord.uid, {
        role: 'Motorista',
        placa
      });

      const agora = new Date().toISOString();
      await adminDb.collection('credenciais_frota').doc(placa).set({
        placa,
        senha,
        emailInterno: email,
        uid: userRecord.uid,
        ativo,
        atualizadoEm: agora,
        atualizadoPor: decoded.email || decoded.uid || 'Monitoramento'
      }, { merge: true });

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ ok: true, placa, senha, ativo }));
    }

    if (action === 'deleteDriverAuth') {
      const placa = String(body.placa || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      const email = placaToAuthEmail(placa);
      try {
        const u = await adminAuth.getUserByEmail(email);
        await adminAuth.deleteUser(u.uid);
      } catch (_) {}
      await adminDb.collection('credenciais_frota').doc(placa).delete().catch(() => {});

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ ok: true }));
    }

    if (action === 'syncManagementUser') {
      const email = String(body.email || '').trim().toLowerCase();
      const nome = String(body.nome || '').trim();
      const role = body.role === 'Operacao' ? 'Operacao' : 'Monitoramento';
      const subRole = body.subRole || null;
      const senhaInicial = String(body.senhaInicial || '@rj2026');

      if (!email || !email.includes('@')) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'E-mail inválido.' }));
      }

      let userRecord;
      let created = false;
      try {
        userRecord = await adminAuth.getUserByEmail(email);
        await adminAuth.updateUser(userRecord.uid, {
          displayName: nome || userRecord.displayName || email,
          disabled: body.ativo === false
        });
      } catch (err) {
        if (err.code === 'auth/user-not-found') {
          userRecord = await adminAuth.createUser({
            email,
            password: senhaInicial,
            displayName: nome || email,
            emailVerified: true
          });
          created = true;
        } else {
          throw err;
        }
      }

      await adminAuth.setCustomUserClaims(userRecord.uid, {
        role,
        ...(subRole ? { subRole } : {}),
        nome: nome || email
      });

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ ok: true, uid: userRecord.uid, email, created }));
    }

    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'Ação desconhecida.' }));
  } catch (err) {
    console.error('[api/admin-auth] Erro:', err);
    res.statusCode = err.statusCode || (err.message === 'FIREBASE_SERVICE_ACCOUNT_MISSING' ? 503 : 500);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({
      error: err.message === 'FIREBASE_SERVICE_ACCOUNT_MISSING'
        ? 'Configure FIREBASE_SERVICE_ACCOUNT nas variáveis de ambiente da Vercel para editar senhas em produção.'
        : (err.message || 'Erro interno ao gerenciar autenticação.')
    }));
  }
}
