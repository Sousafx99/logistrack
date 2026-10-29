import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import fs from 'node:fs';
import path from 'node:path';

export { FieldValue };

let initializedApp = null;

function loadServiceAccount() {
  const envRaw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (envRaw) {
    try {
      const trimmed = envRaw.trim();
      const jsonStr = trimmed.startsWith('{')
        ? trimmed
        : Buffer.from(trimmed, 'base64').toString('utf8');
      return JSON.parse(jsonStr);
    } catch (err) {
      console.error('[firebaseAdmin] Falha ao decodificar FIREBASE_SERVICE_ACCOUNT:', err.message);
    }
  }

  try {
    const localKeyPath = path.resolve(process.cwd(), 'firebase-admin-key.json');
    if (fs.existsSync(localKeyPath)) {
      return JSON.parse(fs.readFileSync(localKeyPath, 'utf8'));
    }
  } catch (err) {
    console.warn('[firebaseAdmin] Chave local não encontrada:', err.message);
  }

  return null;
}

export function getAdminApp() {
  if (initializedApp) return initializedApp;
  const existing = getApps();
  if (existing && existing.length > 0) {
    initializedApp = existing[0];
    return initializedApp;
  }

  const serviceAccount = loadServiceAccount();
  if (!serviceAccount) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_MISSING');
  }

  initializedApp = initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id || 'monitoramento-485e2',
    storageBucket: 'monitoramento-485e2.firebasestorage.app'
  });

  return initializedApp;
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}

export function getAdminMessaging() {
  return getMessaging(getAdminApp());
}

export async function verifyBearerToken(req) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    const err = new Error('Token de autenticação ausente.');
    err.statusCode = 401;
    throw err;
  }
  try {
    return await getAdminAuth().verifyIdToken(token);
  } catch (e) {
    const err = new Error('Sessão inválida ou expirada.');
    err.statusCode = 401;
    throw err;
  }
}

export function applyCors(req, res) {
  const origin = req.headers?.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-token');
}

export async function parseJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) req.destroy();
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}
