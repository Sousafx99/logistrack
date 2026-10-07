// Vercel Serverless Function: Exportação de Cargas no modelo 8132 + STATUS
// Formato padrão: CSV (delimitado por ';') com codificação UTF-8 BOM

const PROJECT_ID = "monitoramento-485e2";
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Helper para decodificar valores do Firestore REST API
function decodeFirestoreValue(val) {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('nullValue' in val) return null;
  if ('timestampValue' in val) return val.timestampValue;
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(decodeFirestoreValue);
  }
  if ('mapValue' in val) {
    const res = {};
    const fields = val.mapValue.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      res[k] = decodeFirestoreValue(v);
    }
    return res;
  }
  return null;
}

const formatarDataSaida = (dataIso) => {
  if (!dataIso) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dataIso)) return dataIso;
  try {
    const parts = String(dataIso).split("-");
    if (parts.length === 3) {
      return `${parts[2].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[0]}`;
    }
    const d = new Date(dataIso);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
    }
  } catch (e) {}
  return String(dataIso);
};

const escapeCsv = (val) => {
  if (val === null || val === undefined) return "";
  let str = String(val);
  if (str.includes(";") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    str = '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
};

// Cache em memória na Serverless Function para evitar bater no Firestore a cada requisição repetida
import backupDocs from './backup_entregas.json' with { type: 'json' };

let memoryCacheDocs = backupDocs || null;
let memoryCacheTimestamp = 0;
const CACHE_TTL_MS = 60000; // 60 segundos de cache

export default async function handler(req, res) {
  // Configuração de CORS para permitir requisições de qualquer origem (Base44, ERP, Webhooks)
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-api-key, token'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { query } = req;
    
    // Autenticação opcional por token: se fornecido token no sistema, valida
    const tokenEsperado = process.env.API_SECRET_TOKEN || "logistrack2026";
    let bodyToken = null;
    try {
      if (req.body && typeof req.body === 'object') {
        bodyToken = req.body.token || req.body.apiKey || req.body.secret;
      } else if (typeof req.body === 'string' && req.body.startsWith('{')) {
        const parsed = JSON.parse(req.body);
        bodyToken = parsed.token || parsed.apiKey || parsed.secret;
      }
    } catch (e) {}

    const tokenRecebido = query.token || 
      query.apiKey || 
      req.headers['x-api-key'] || 
      req.headers['x-token'] || 
      bodyToken ||
      (req.headers.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, '').trim() : null);

    // Se houver token passado mas estiver incorreto
    if (tokenRecebido && tokenRecebido !== tokenEsperado && tokenEsperado !== "") {
      res.status(401).json({ 
        error: "Token de autenticação inválido.",
        message: "Envie ?token=logistrack2026 ou o header 'Authorization: Bearer logistrack2026'" 
      });
      return;
    }

    // Busca documentos do Firestore com reaproveitamento de cache
    let allDocs = [];
    const agora = Date.now();
    const cacheValido = memoryCacheDocs && memoryCacheDocs.length > 0 && (agora - memoryCacheTimestamp < CACHE_TTL_MS);

    if (cacheValido) {
      allDocs = memoryCacheDocs;
    } else {
      let pageToken = null;
      const collectionUrl = `${FIRESTORE_BASE_URL}/entregas?pageSize=300`;

      try {
        let docsConsultados = [];
        do {
          const url = pageToken ? `${collectionUrl}&pageToken=${pageToken}` : collectionUrl;
          const response = await fetch(url);
          if (!response.ok) {
            // Se der erro 429 ou qualquer falha do Firestore, use o backup em cache!
            console.warn("Firestore retornou status não-ok:", response.status, "usando snapshot de dados.");
            break;
          }
          const data = await response.json();
          if (data.documents) {
            const decoded = data.documents.map(d => {
              const obj = { id: d.name.split("/").pop() };
              for (const [k, v] of Object.entries(d.fields || {})) {
                obj[k] = decodeFirestoreValue(v);
              }
              return obj;
            });
            docsConsultados = docsConsultados.concat(decoded);
          }
          pageToken = data.nextPageToken || null;
        } while (pageToken);

        if (docsConsultados.length > 0) {
          memoryCacheDocs = docsConsultados;
          memoryCacheTimestamp = agora;
          allDocs = docsConsultados;
        } else {
          allDocs = memoryCacheDocs || backupDocs || [];
        }
      } catch (fetchErr) {
        console.warn("Erro ao consultar Firestore, usando dados locais/cache:", fetchErr.message);
        allDocs = memoryCacheDocs || backupDocs || [];
      }
    }

    // Data de hoje em formato YYYY-MM-DD (fuso horário de Brasília)
    const hojeBrasilia = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());
    const anoHoje = hojeBrasilia.find(p => p.type === 'year').value;
    const mesHoje = hojeBrasilia.find(p => p.type === 'month').value;
    const diaHoje = hojeBrasilia.find(p => p.type === 'day').value;
    const dataHojeIso = `${anoHoje}-${mesHoje}-${diaHoje}`;

    // Filtros opcionais via Query Parameters
    const filtroData = query.data === 'hoje' ? dataHojeIso : query.data;
    const filtroDataOperacional = query.dataOperacional || query.dataEntrega || null;
    const filtroCarga = query.carga ? String(query.carga).trim() : null;
    const filtroPlaca = query.placa ? String(query.placa).trim().toUpperCase() : null;
    const filtroStatus = query.status ? String(query.status).trim().toLowerCase() : null;

    let entregasFiltradas = allDocs;

    if (filtroData) {
      // Aceita tanto pela data operacional (monitoramento) quanto pela data de faturamento (ERP)
      entregasFiltradas = entregasFiltradas.filter(e => 
        e.data === filtroData || 
        e.dataFaturamento === filtroData
      );
    }
    if (filtroDataOperacional) {
      entregasFiltradas = entregasFiltradas.filter(e => (e.data || e.dataFaturamento) === filtroDataOperacional);
    }
    if (filtroCarga) {
      entregasFiltradas = entregasFiltradas.filter(e => String(e.carga || '').trim() === filtroCarga);
    }
    if (filtroPlaca) {
      entregasFiltradas = entregasFiltradas.filter(e => 
        String(e.placaOriginal || e.placa || '').trim().toUpperCase() === filtroPlaca ||
        String(e.placa || '').trim().toUpperCase() === filtroPlaca
      );
    }
    if (filtroStatus) {
      entregasFiltradas = entregasFiltradas.filter(e => String(e.status || '').toLowerCase().includes(filtroStatus));
    }

    // Estrutura das 17 colunas oficiais
    const headers = [
      'CODCLI',
      'CLIENTE',
      'MUNICENT',
      'BAIRROENT',
      'ROTA ENTREGA',
      'PLACA',
      'CARREGAMENTO',
      'PEDIDO',
      'RCA',
      'CÓD. DO PRODUTO',
      'PRODUTO',
      'QUANTIDADE DE CAIXAS',
      'PESO (KG)',
      'N° NOTA FISCAL',
      'DATA SAÍDA',
      'VALOR PRODUTO',
      'STATUS'
    ];

    const rows = [];

    entregasFiltradas.forEach(entrega => {
      const dataFaturamento = entrega.dataFaturamento || entrega.data;
      const dataFormatada = formatarDataSaida(dataFaturamento);
      const placaOriginal = entrega.placaOriginal || entrega.placa || '';
      const statusFinal = entrega.status || 'Pendente';

      if (Array.isArray(entrega.itens) && entrega.itens.length > 0) {
        entrega.itens.forEach(item => {
          rows.push({
            'CODCLI': entrega.codCliente || entrega.codcli || '',
            'CLIENTE': entrega.cliente || '',
            'MUNICENT': entrega.cidade || entrega.municent || '',
            'BAIRROENT': entrega.bairro || entrega.bairroent || '',
            'ROTA ENTREGA': entrega.rota || '',
            'PLACA': placaOriginal,
            'CARREGAMENTO': entrega.carga || '',
            'PEDIDO': entrega.pedido || '',
            'RCA': entrega.rca || '',
            'CÓD. DO PRODUTO': item.codigo || item.codProduto || '',
            'PRODUTO': item.descricao || item.produto || '',
            'QUANTIDADE DE CAIXAS': item.qtd !== undefined ? item.qtd : (entrega.volumes || 1),
            'PESO (KG)': item.peso !== undefined && item.peso !== null ? Number(item.peso) : (entrega.peso ? Number((entrega.peso / entrega.itens.length).toFixed(2)) : 0),
            'N° NOTA FISCAL': entrega.nota || '',
            'DATA SAÍDA': dataFormatada,
            'VALOR PRODUTO': item.valor !== undefined && item.valor !== null ? Number(item.valor) : (entrega.valor ? Number((entrega.valor / entrega.itens.length).toFixed(2)) : 0),
            'STATUS': statusFinal
          });
        });
      } else {
        rows.push({
          'CODCLI': entrega.codCliente || entrega.codcli || '',
          'CLIENTE': entrega.cliente || '',
          'MUNICENT': entrega.cidade || entrega.municent || '',
          'BAIRROENT': entrega.bairro || entrega.bairroent || '',
          'ROTA ENTREGA': entrega.rota || '',
          'PLACA': placaOriginal,
          'CARREGAMENTO': entrega.carga || '',
          'PEDIDO': entrega.pedido || '',
          'RCA': entrega.rca || '',
          'CÓD. DO PRODUTO': '',
          'PRODUTO': '',
          'QUANTIDADE DE CAIXAS': entrega.volumes || 1,
          'PESO (KG)': entrega.peso || 0,
          'N° NOTA FISCAL': entrega.nota || '',
          'DATA SAÍDA': dataFormatada,
          'VALOR PRODUTO': entrega.valor || 0,
          'STATUS': statusFinal
        });
      }
    });

    // Se o cliente pedir formato JSON (por query format/formato ou pelo header Accept)
    const acceptHeader = req.headers['accept'] || '';
    const querJson = (query.format && String(query.format).toLowerCase() === 'json') ||
                     (query.formato && String(query.formato).toLowerCase() === 'json') ||
                     (acceptHeader.includes('application/json') && !acceptHeader.includes('text/csv') && !acceptHeader.includes('*/*'));

    if (querJson) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
      res.status(200).json({
        sucesso: true,
        total: rows.length,
        timestamp: new Date().toISOString(),
        dados: rows
      });
      return;
    }

    // Formato padrão: CSV (com delimitador ';' e UTF-8 BOM)
    const csvRows = [];
    csvRows.push(headers.join(';'));
    rows.forEach(r => {
      const linha = headers.map(h => escapeCsv(r[h])).join(';');
      csvRows.push(linha);
    });

    const csvContent = '\uFEFF' + csvRows.join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="8132_Status.csv"');
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
    res.status(200).send(csvContent);

  } catch (error) {
    console.error("Erro na API de exportação:", error);
    res.status(500).json({
      error: "Erro interno ao gerar exportação de cargas",
      detalhes: error.message
    });
  }
}
