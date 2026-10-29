/**
 * Utilitários para decodificação e processamento de geolocalização:
 * - Coordenadas juntas: "-12.876827158036276, -38.43759512655495"
 * - Plus Codes: "4HF6+7X Valéria, Salvador - BA" ou "59V34HF6+7X"
 * - Links do Google Maps: "https://maps.app.goo.gl/rQeD4y67joRn7YRq8" ou links completos com @lat,lng
 */

import { apiUrl } from './appConfig';

const OLC_ALPHABET = '23456789CFGHJMPQRVWX';

// Decodifica um Open Location Code completo (ex: 59V34HF6+7X)
export function decodeOLC(code) {
  if (!code) return null;
  const cleanCode = code.replace('+', '').toUpperCase();
  let lat = -90;
  let lng = -180;
  let latVal = 0;
  let lngVal = 0;

  if (cleanCode.length < 8) return null;

  latVal += OLC_ALPHABET.indexOf(cleanCode[0]) * 20;
  lngVal += OLC_ALPHABET.indexOf(cleanCode[1]) * 20;
  latVal += OLC_ALPHABET.indexOf(cleanCode[2]);
  lngVal += OLC_ALPHABET.indexOf(cleanCode[3]);
  latVal += OLC_ALPHABET.indexOf(cleanCode[4]) / 20;
  lngVal += OLC_ALPHABET.indexOf(cleanCode[5]) / 20;
  latVal += OLC_ALPHABET.indexOf(cleanCode[6]) / 400;
  lngVal += OLC_ALPHABET.indexOf(cleanCode[7]) / 400;

  if (cleanCode.length >= 10) {
    latVal += OLC_ALPHABET.indexOf(cleanCode[8]) / 8000;
    lngVal += OLC_ALPHABET.indexOf(cleanCode[9]) / 8000;
  }

  const resolution = cleanCode.length >= 10 ? 1 / 8000 : 1 / 400;
  return {
    lat: Number((lat + latVal + resolution / 2).toFixed(7)),
    lng: Number((lng + lngVal + resolution / 2).toFixed(7))
  };
}

// Reconstrói um Plus Code curto com base em coordenadas de referência regionais (Salvador/BA padrão: -12.97, -38.50)
export function recoverNearestOLC(shortCode, refLat = -12.97, refLng = -38.50) {
  if (!shortCode) return null;
  const cleanShort = shortCode.toUpperCase().trim();

  // Se já tiver 8 caracteres antes do '+' (código completo)
  const plusIdx = cleanShort.indexOf('+');
  if (plusIdx === 8) {
    return decodeOLC(cleanShort);
  }

  const refLatNorm = refLat + 90;
  const refLngNorm = refLng + 180;
  const p1Lat = Math.floor(refLatNorm / 20);
  const p1Lng = Math.floor(refLngNorm / 20);
  const p2Lat = Math.floor(refLatNorm % 20);
  const p2Lng = Math.floor(refLngNorm % 20);

  const prefix = OLC_ALPHABET[p1Lat] + OLC_ALPHABET[p1Lng] + OLC_ALPHABET[p2Lat] + OLC_ALPHABET[p2Lng];
  const fullCode = prefix + cleanShort;
  return decodeOLC(fullCode);
}

/**
 * Analisa síncronamente qualquer texto de geolocalização:
 * 1. Coordenadas: "-12.876827, -38.437595"
 * 2. Links do Google Maps completos
 * 3. Links curtos (retorna tipo 'link_para_resolver')
 * 4. Plus Code: "4HF6+7X Valéria, Salvador - BA"
 */
export function parseGeoInput(rawText, refLat = -12.97, refLng = -38.50) {
  if (!rawText || typeof rawText !== 'string') return null;
  const text = rawText.trim();
  if (!text) return null;

  // 1. Coordenadas juntas: -12.876827158036276, -38.43759512655495
  const coordsMatch = text.match(/(-?\d{1,2}(?:\.\d+)?)[,\s;]+(-?\d{1,3}(?:\.\d+)?)/);
  if (coordsMatch && !text.includes('http') && !text.includes('+')) {
    const lat = parseFloat(coordsMatch[1]);
    const lng = parseFloat(coordsMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return {
        tipo: 'coordenadas',
        lat,
        lng,
        origem: 'Coordenadas Geográficas'
      };
    }
  }

  // 2. Google Maps URLs
  if (text.includes('google.com/maps') || text.includes('maps.google') || text.includes('maps.app.goo.gl') || text.includes('goo.gl/maps')) {
    const dMatch = text.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    const atMatch = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    const qMatch = text.match(/[?&](?:q|query|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
    const placeMatch = text.match(/\/place\/([^/@?]+)/);
    const nomeLocal = placeMatch ? decodeURIComponent(placeMatch[1].replace(/\+/g, ' ')) : '';

    if (dMatch) {
      return {
        tipo: 'link_completo',
        lat: parseFloat(dMatch[1]),
        lng: parseFloat(dMatch[2]),
        nomeLocal,
        origem: 'Link Google Maps'
      };
    }
    if (atMatch) {
      return {
        tipo: 'link_completo',
        lat: parseFloat(atMatch[1]),
        lng: parseFloat(atMatch[2]),
        nomeLocal,
        origem: 'Link Google Maps'
      };
    }
    if (qMatch) {
      return {
        tipo: 'link_completo',
        lat: parseFloat(qMatch[1]),
        lng: parseFloat(qMatch[2]),
        nomeLocal,
        origem: 'Link Google Maps'
      };
    }

    // Link curto que precisa de redirecionamento (maps.app.goo.gl)
    return {
      tipo: 'link_para_resolver',
      url: text,
      origem: 'Link Curto Google Maps'
    };
  }

  // 3. Plus Code: ex: "4HF6+7X Valéria, Salvador - BA" ou "59V34HF6+7X"
  const plusCodeMatch = text.match(/([23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,4})/i);
  if (plusCodeMatch) {
    const codeOnly = plusCodeMatch[1].toUpperCase();
    const restoTexto = text.replace(plusCodeMatch[0], '').replace(/^[,\s-]+|[,\s-]+$/g, '').trim();
    const coords = recoverNearestOLC(codeOnly, refLat, refLng);
    if (coords) {
      return {
        tipo: 'plus_code',
        code: codeOnly,
        lat: coords.lat,
        lng: coords.lng,
        endereco: restoTexto || '',
        origem: `Plus Code (${codeOnly})`
      };
    }
  }

  return null;
}

/**
 * Resolve links curtos do Google Maps chamando a API do backend
 */
export async function resolveMapsShortLink(url) {
  try {
    const endpoint = apiUrl(`/api/resolver-geoloc?url=${encodeURIComponent(url)}`);
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (data.success && data.lat !== undefined && data.lng !== undefined) {
      return {
        success: true,
        lat: data.lat,
        lng: data.lng,
        nomeLocal: data.nomeLocal || '',
        redirectUrl: data.redirectUrl || url
      };
    }
    return { success: false, error: data.message || 'Não foi possível extrair coordenadas' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Copia coordenadas para a área de transferência com retorno booleano
 */
export async function copiarCoordenadas(lat, lng) {
  if (!lat || !lng) return false;
  const texto = `${lat}, ${lng}`;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
    // Fallback para document.execCommand
    const textArea = document.createElement('textarea');
    textArea.value = texto;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textArea);
    return ok;
  } catch (e) {
    console.error('Erro ao copiar coordenadas:', e);
    return false;
  }
}
