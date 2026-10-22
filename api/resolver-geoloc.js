export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  const rawUrl = req.query?.url || req.body?.url;
  if (!rawUrl) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'Parâmetro url é obrigatório' }));
  }

  let cleanUrl = String(rawUrl).trim();
  const urlMatch = cleanUrl.match(/https?:\/\/[^\s"'<>]+/);
  if (urlMatch) {
    cleanUrl = urlMatch[0];
  }

  try {
    const response = await fetch(cleanUrl, { 
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const location = response.headers.get('location') || response.url;
    
    // Parse coordinates from location
    const dMatch = location.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    const atMatch = location.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    const qMatch = location.match(/[?&](?:q|query|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
    const placeMatch = location.match(/\/place\/([^/@?]+)/);
    const nomeLocal = placeMatch ? decodeURIComponent(placeMatch[1].replace(/\+/g, ' ')) : '';

    let lat = null;
    let lng = null;

    if (dMatch) {
      lat = parseFloat(dMatch[1]);
      lng = parseFloat(dMatch[2]);
    } else if (atMatch) {
      lat = parseFloat(atMatch[1]);
      lng = parseFloat(atMatch[2]);
    } else if (qMatch) {
      lat = parseFloat(qMatch[1]);
      lng = parseFloat(qMatch[2]);
    }

    // Se a URL não tiver coordenadas diretamente, pode ser uma página com redirecionamento em html
    if (!lat || !lng) {
      const html = await response.text();
      const bodyAtMatch = html.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || html.match(/\[(-?\d+\.\d+),\s*(-?\d+\.\d+)\]/);
      if (bodyAtMatch) {
        lat = parseFloat(bodyAtMatch[1]);
        lng = parseFloat(bodyAtMatch[2]);
      }
    }

    if (lat !== null && lng !== null) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({
        success: true,
        lat,
        lng,
        nomeLocal: nomeLocal || '',
        redirectUrl: location
      }));
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({
      success: false,
      message: 'Não foi possível extrair coordenadas deste link',
      redirectUrl: location
    }));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: err.message }));
  }
}
