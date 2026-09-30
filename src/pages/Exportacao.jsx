import { useState, useMemo } from 'react';
import { 
  DownloadCloud, FileSpreadsheet, FileText, 
  Search, Filter, RotateCcw, 
  FileDown, ChevronLeft, ChevronRight,
  Code2, Copy, Check, Play, Terminal, Sparkles,
  ExternalLink, CheckCircle2, AlertCircle, Loader2,
  Cpu, ArrowRight, Zap, RefreshCw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';

// As 17 colunas oficiais do modelo 8132 + STATUS na extremidade direita
export const COLUNAS_8132_STATUS = [
  { id: 'CODCLI', label: 'CODCLI', minWidth: '100px' },
  { id: 'CLIENTE', label: 'CLIENTE', minWidth: '220px' },
  { id: 'MUNICENT', label: 'MUNICENT', minWidth: '140px' },
  { id: 'BAIRROENT', label: 'BAIRROENT', minWidth: '140px' },
  { id: 'ROTA ENTREGA', label: 'ROTA ENTREGA', minWidth: '130px' },
  { id: 'PLACA', label: 'PLACA', minWidth: '110px' },
  { id: 'CARREGAMENTO', label: 'CARREGAMENTO', minWidth: '130px' },
  { id: 'PEDIDO', label: 'PEDIDO', minWidth: '120px' },
  { id: 'RCA', label: 'RCA', minWidth: '180px' },
  { id: 'CÓD. DO PRODUTO', label: 'CÓD. DO PRODUTO', minWidth: '130px' },
  { id: 'PRODUTO', label: 'PRODUTO', minWidth: '220px' },
  { id: 'QUANTIDADE DE CAIXAS', label: 'QUANTIDADE DE CAIXAS', minWidth: '140px' },
  { id: 'PESO (KG)', label: 'PESO (KG)', minWidth: '110px' },
  { id: 'N° NOTA FISCAL', label: 'N° NOTA FISCAL', minWidth: '130px' },
  { id: 'DATA SAÍDA', label: 'DATA SAÍDA', minWidth: '120px' },
  { id: 'VALOR PRODUTO', label: 'VALOR PRODUTO', minWidth: '130px' },
  { id: 'STATUS', label: 'STATUS', minWidth: '150px', isStatus: true }
];

const formatarDataSaida = (dataIso) => {
  if (!dataIso) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dataIso)) return dataIso;
  try {
    const parts = String(dataIso).split('-');
    if (parts.length === 3) {
      return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
    }
    const d = new Date(dataIso);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    }
  } catch (e) {
    // fallback
  }
  return String(dataIso);
};

const getStatusBadge = (status) => {
  const s = String(status || '').trim().toLowerCase();
  if (s.includes('realizada') || s.includes('entrega total') || s.includes('entregue') || s.includes('sucesso')) {
    return {
      label: status || 'Realizada',
      bgClass: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
    };
  }
  if (s.includes('parcial')) {
    return {
      label: status || 'Entrega Parcial',
      bgClass: 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
    };
  }
  if (s.includes('devolu') || s.includes('recusa')) {
    return {
      label: status || 'Devolução Total',
      bgClass: 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
    };
  }
  if (s.includes('reentrega')) {
    return {
      label: status || 'Reentrega',
      bgClass: 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
    };
  }
  if (s.includes('cliente') || s.includes('descarregando') || s.includes('transito') || s.includes('trânsito')) {
    return {
      label: status || 'Em Trânsito',
      bgClass: 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
    };
  }
  return {
    label: status || 'Pendente',
    bgClass: 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
  };
};

export function Exportacao() {
  const { entregas = [] } = useStore();

  // Estados de Filtro da Tabela
  const [filtroPeriodo, setFiltroPeriodo] = useState('todas');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [filtroCarga, setFiltroCarga] = useState('todas');
  const [filtroPlaca, setFiltroPlaca] = useState('todas');
  const [filtroRota, setFiltroRota] = useState('todas');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [busca, setBusca] = useState('');

  // Paginação da Pré-visualização
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(25);

  // Estados de Download
  const [exportandoXlsx, setExportandoXlsx] = useState(false);
  const [exportandoCsv, setExportandoCsv] = useState(false);

  // Estados do Testador / Simulador de API
  const [mostrarTestadorApi, setMostrarTestadorApi] = useState(false);
  const [testandoApi, setTestandoApi] = useState(false);
  const [resultadoTesteApi, setResultadoTesteApi] = useState(null);
  const [filtroTesteData, setFiltroTesteData] = useState('');
  const [filtroTesteCarga, setFiltroTesteCarga] = useState('');
  const [filtroTestePlaca, setFiltroTestePlaca] = useState('');
  const [filtroTesteStatus, setFiltroTesteStatus] = useState('');
  const [formatoTeste, setFormatoTeste] = useState('csv'); // 'csv' ou 'json'
  const [copiouUrl, setCopiouUrl] = useState(false);
  const [copiouPrompt, setCopiouPrompt] = useState(false);

  // 1. Converte entregas em linhas no formato 8132 + STATUS
  const todasLinhas = useMemo(() => {
    const rows = [];

    (entregas || []).forEach(entrega => {
      const dataFormatada = formatarDataSaida(entrega.data);
      const statusFinal = entrega.status || 'Pendente';

      if (Array.isArray(entrega.itens) && entrega.itens.length > 0) {
        entrega.itens.forEach(item => {
          rows.push({
            'CODCLI': entrega.codCliente || entrega.codcli || '',
            'CLIENTE': entrega.cliente || '',
            'MUNICENT': entrega.cidade || entrega.municent || '',
            'BAIRROENT': entrega.bairro || entrega.bairroent || '',
            'ROTA ENTREGA': entrega.rota || '',
            'PLACA': entrega.placa || '',
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
            'STATUS': statusFinal,
            _rawDate: entrega.data || '',
            _rawCarga: String(entrega.carga || ''),
            _rawPlaca: String(entrega.placa || '').toUpperCase(),
            _rawRota: String(entrega.rota || ''),
            _rawStatus: statusFinal
          });
        });
      } else {
        rows.push({
          'CODCLI': entrega.codCliente || entrega.codcli || '',
          'CLIENTE': entrega.cliente || '',
          'MUNICENT': entrega.cidade || entrega.municent || '',
          'BAIRROENT': entrega.bairro || entrega.bairroent || '',
          'ROTA ENTREGA': entrega.rota || '',
          'PLACA': entrega.placa || '',
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
          'STATUS': statusFinal,
          _rawDate: entrega.data || '',
          _rawCarga: String(entrega.carga || ''),
          _rawPlaca: String(entrega.placa || '').toUpperCase(),
          _rawRota: String(entrega.rota || ''),
          _rawStatus: statusFinal
        });
      }
    });

    return rows;
  }, [entregas]);

  // Opções para os Selects de Filtros
  const opcoesFiltros = useMemo(() => {
    const cargas = new Set();
    const placas = new Set();
    const rotas = new Set();
    const statusSet = new Set();
    const datas = new Set();

    todasLinhas.forEach(r => {
      if (r._rawCarga) cargas.add(r._rawCarga);
      if (r._rawPlaca) placas.add(r._rawPlaca);
      if (r._rawRota) rotas.add(r._rawRota);
      if (r._rawStatus) statusSet.add(r._rawStatus);
      if (r._rawDate) datas.add(r._rawDate);
    });

    return {
      cargas: Array.from(cargas).sort(),
      placas: Array.from(placas).sort(),
      rotas: Array.from(rotas).sort(),
      statusList: Array.from(statusSet).sort(),
      datasList: Array.from(datas).sort((a, b) => b.localeCompare(a))
    };
  }, [todasLinhas]);

  // Data helpers
  const hojeIso = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const ontemIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const seteDiasAtrasIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const primeiroDiaMesIso = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  }, []);

  // 2. Aplicação de Filtros
  const linhasFiltradas = useMemo(() => {
    return todasLinhas.filter(linha => {
      if (filtroPeriodo === 'hoje') {
        if (linha._rawDate !== hojeIso) return false;
      } else if (filtroPeriodo === 'ontem') {
        if (linha._rawDate !== ontemIso) return false;
      } else if (filtroPeriodo === '7dias') {
        if (linha._rawDate < seteDiasAtrasIso) return false;
      } else if (filtroPeriodo === 'mes') {
        if (linha._rawDate < primeiroDiaMesIso) return false;
      } else if (filtroPeriodo === 'personalizado') {
        if (dataInicio && linha._rawDate < dataInicio) return false;
        if (dataFim && linha._rawDate > dataFim) return false;
      }

      if (filtroCarga !== 'todas' && linha._rawCarga !== filtroCarga) return false;
      if (filtroPlaca !== 'todas' && linha._rawPlaca !== filtroPlaca) return false;
      if (filtroRota !== 'todas' && linha._rawRota !== filtroRota) return false;
      if (filtroStatus !== 'todos' && linha._rawStatus !== filtroStatus) return false;

      if (busca.trim()) {
        const termo = busca.trim().toLowerCase();
        const textoLinha = [
          linha['CODCLI'],
          linha['CLIENTE'],
          linha['MUNICENT'],
          linha['BAIRROENT'],
          linha['ROTA ENTREGA'],
          linha['PLACA'],
          linha['CARREGAMENTO'],
          linha['PEDIDO'],
          linha['RCA'],
          linha['CÓD. DO PRODUTO'],
          linha['PRODUTO'],
          linha['N° NOTA FISCAL'],
          linha['STATUS']
        ].join(' ').toLowerCase();

        if (!textoLinha.includes(termo)) return false;
      }

      return true;
    });
  }, [
    todasLinhas, 
    filtroPeriodo, 
    dataInicio, 
    dataFim, 
    hojeIso, 
    ontemIso, 
    seteDiasAtrasIso, 
    primeiroDiaMesIso, 
    filtroCarga, 
    filtroPlaca, 
    filtroRota, 
    filtroStatus, 
    busca
  ]);

  // 3. Métricas do Conjunto Filtrado
  const metricas = useMemo(() => {
    const totalLinhas = linhasFiltradas.length;
    const nfsUnicas = new Set();
    const cargasUnicas = new Set();
    let pesoTotal = 0;
    let valorTotal = 0;
    const contagemStatus = {};

    linhasFiltradas.forEach(l => {
      if (l['N° NOTA FISCAL']) nfsUnicas.add(l['N° NOTA FISCAL']);
      if (l['CARREGAMENTO']) cargasUnicas.add(l['CARREGAMENTO']);
      pesoTotal += Number(l['PESO (KG)']) || 0;
      valorTotal += Number(l['VALOR PRODUTO']) || 0;
      
      const st = l['STATUS'] || 'Pendente';
      contagemStatus[st] = (contagemStatus[st] || 0) + 1;
    });

    return {
      totalLinhas,
      totalNfs: nfsUnicas.size,
      totalCargas: cargasUnicas.size,
      pesoTotal,
      valorTotal,
      contagemStatus
    };
  }, [linhasFiltradas]);

  // 4. Paginação dos Dados Filtrados
  const totalPaginas = Math.ceil(linhasFiltradas.length / itensPorPagina) || 1;
  const linhasPaginadas = useMemo(() => {
    const inicio = (paginaAtual - 1) * itensPorPagina;
    return linhasFiltradas.slice(inicio, inicio + itensPorPagina);
  }, [linhasFiltradas, paginaAtual, itensPorPagina]);

  const numerosPaginas = useMemo(() => {
    const max = 5;
    if (totalPaginas <= max) {
      return Array.from({ length: totalPaginas }, (_, i) => i + 1);
    }
    let inicio = Math.max(1, paginaAtual - Math.floor(max / 2));
    let fim = inicio + max - 1;
    if (fim > totalPaginas) {
      fim = totalPaginas;
      inicio = Math.max(1, fim - max + 1);
    }
    const pages = [];
    for (let p = inicio; p <= fim; p++) {
      pages.push(p);
    }
    return pages;
  }, [totalPaginas, paginaAtual]);

  const limparFiltros = () => {
    setFiltroPeriodo('todas');
    setDataInicio('');
    setDataFim('');
    setFiltroCarga('todas');
    setFiltroPlaca('todas');
    setFiltroRota('todas');
    setFiltroStatus('todos');
    setBusca('');
    setPaginaAtual(1);
  };

  // 5. Função de Exportação em EXCEL (.xlsx)
  const handleExportarXLSX = () => {
    if (linhasFiltradas.length === 0) {
      alert('Nenhum dado selecionado para exportação.');
      return;
    }

    try {
      setExportandoXlsx(true);
      const dadosExport = linhasFiltradas.map(l => {
        const rowLimpa = {};
        COLUNAS_8132_STATUS.forEach(col => {
          rowLimpa[col.id] = l[col.id] !== undefined ? l[col.id] : '';
        });
        return rowLimpa;
      });

      const headers = COLUNAS_8132_STATUS.map(c => c.id);
      const ws = XLSX.utils.json_to_sheet(dadosExport, { header: headers });

      ws['!cols'] = [
        { wch: 10 }, // CODCLI
        { wch: 32 }, // CLIENTE
        { wch: 18 }, // MUNICENT
        { wch: 18 }, // BAIRROENT
        { wch: 16 }, // ROTA ENTREGA
        { wch: 12 }, // PLACA
        { wch: 16 }, // CARREGAMENTO
        { wch: 14 }, // PEDIDO
        { wch: 26 }, // RCA
        { wch: 16 }, // CÓD. DO PRODUTO
        { wch: 34 }, // PRODUTO
        { wch: 22 }, // QUANTIDADE DE CAIXAS
        { wch: 14 }, // PESO (KG)
        { wch: 16 }, // N° NOTA FISCAL
        { wch: 14 }, // DATA SAÍDA
        { wch: 16 }, // VALOR PRODUTO
        { wch: 20 }  // STATUS (17ª coluna)
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "8132_Status");

      const dataHojeFormat = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).replace(/\//g, '-');
      const sufixo = filtroCarga !== 'todas' ? `_Carga_${filtroCarga}` : (filtroPlaca !== 'todas' ? `_Placa_${filtroPlaca}` : '');
      const nomeArquivo = `Exportacao_8132_Status_${dataHojeFormat}${sufixo}.xlsx`;

      XLSX.writeFile(wb, nomeArquivo);
    } catch (err) {
      console.error('Erro ao exportar Excel:', err);
      alert('Erro ao gerar arquivo Excel: ' + err.message);
    } finally {
      setExportandoXlsx(false);
    }
  };

  // 6. Função de Exportação em CSV (.csv)
  const handleExportarCSV = () => {
    if (linhasFiltradas.length === 0) {
      alert('Nenhum dado selecionado para exportação.');
      return;
    }

    try {
      setExportandoCsv(true);
      const headers = COLUNAS_8132_STATUS.map(c => c.id);

      const escapeCsv = (val) => {
        if (val === null || val === undefined) return '';
        let str = String(val);
        if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          str = '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      };

      const csvRows = [];
      csvRows.push(headers.join(';'));
      linhasFiltradas.forEach(l => {
        const linhaCsv = headers.map(h => escapeCsv(l[h])).join(';');
        csvRows.push(linhaCsv);
      });

      const csvContent = csvRows.join('\r\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      const dataHojeFormat = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).replace(/\//g, '-');
      const sufixo = filtroCarga !== 'todas' ? `_Carga_${filtroCarga}` : (filtroPlaca !== 'todas' ? `_Placa_${filtroPlaca}` : '');
      const nomeArquivo = `Exportacao_8132_Status_${dataHojeFormat}${sufixo}.csv`;

      link.setAttribute('href', url);
      link.setAttribute('download', nomeArquivo);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao exportar CSV:', err);
      alert('Erro ao gerar arquivo CSV: ' + err.message);
    } finally {
      setExportandoCsv(false);
    }
  };

  // 7. Lógica do Testador de API / Simulador do Base44
  const urlBaseHost = typeof window !== 'undefined' ? window.location.origin : 'https://logistrack.vercel.app';
  
  const queryParamsTeste = useMemo(() => {
    const params = new URLSearchParams();
    params.set('token', 'logistrack2026');
    if (filtroTesteData) params.set('data', filtroTesteData);
    if (filtroTesteCarga) params.set('carga', filtroTesteCarga);
    if (filtroTestePlaca) params.set('placa', filtroTestePlaca);
    if (filtroTesteStatus) params.set('status', filtroTesteStatus);
    if (formatoTeste === 'json') params.set('format', 'json');
    return params.toString();
  }, [filtroTesteData, filtroTesteCarga, filtroTestePlaca, filtroTesteStatus, formatoTeste]);

  const urlCompletaApi = `${urlBaseHost}/api/cargas-8132?${queryParamsTeste}`;

  const executarTesteApi = async () => {
    setTestandoApi(true);
    setResultadoTesteApi(null);
    const start = performance.now();

    try {
      const response = await fetch(`/api/cargas-8132?${queryParamsTeste}`);
      const durationMs = Math.round(performance.now() - start);
      const status = response.status;
      const statusText = response.statusText || 'OK';
      const contentType = response.headers.get('content-type') || '';

      let payloadTexto = '';
      let totalLinhasRecebidas = 0;
      let jsonParsed = null;

      if (formatoTeste === 'json' || contentType.includes('json')) {
        jsonParsed = await response.json();
        payloadTexto = JSON.stringify(jsonParsed, null, 2);
        totalLinhasRecebidas = jsonParsed.total || (jsonParsed.dados ? jsonParsed.dados.length : 0);
      } else {
        payloadTexto = await response.text();
        const linhasCsv = payloadTexto.trim().split(/\r?\n/).filter(Boolean);
        totalLinhasRecebidas = Math.max(0, linhasCsv.length - 1); // Desconta cabeçalho
      }

      setResultadoTesteApi({
        sucesso: response.ok,
        status,
        statusText,
        durationMs,
        bytes: payloadTexto.length,
        totalLinhas: totalLinhasRecebidas,
        payloadTexto,
        jsonParsed
      });

    } catch (err) {
      const durationMs = Math.round(performance.now() - start);
      setResultadoTesteApi({
        sucesso: false,
        status: 500,
        statusText: 'Erro de Conexão',
        durationMs,
        bytes: 0,
        totalLinhas: 0,
        erro: err.message
      });
    } finally {
      setTestandoApi(false);
    }
  };

  const copiarTexto = (texto, tipo) => {
    navigator.clipboard.writeText(texto);
    if (tipo === 'url') {
      setCopiouUrl(true);
      setTimeout(() => setCopiouUrl(false), 2000);
    } else {
      setCopiouPrompt(true);
      setTimeout(() => setCopiouPrompt(false), 2000);
    }
  };

  const promptBase44 = `Por favor, crie uma automação que faça uma requisição GET para a URL "${urlCompletaApi}" a cada 5 minutos (ou ao clicar em Sincronizar) para coletar as cargas, produtos e a coluna STATUS em CSV delimitado por ponto e vírgula (;), e atualize as tabelas de rotas e entregas do nosso sistema automaticamente.`;

  return (
    <div className="space-y-4 w-full pb-12">
      {/* Header Principal da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-background-secondary p-4 sm:p-5 rounded-2xl border border-border-secondary shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
              <DownloadCloud size={22} />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-text-primary tracking-tight">
                Exportação de Cargas com Status
              </h1>
              <p className="text-xs sm:text-sm text-text-secondary">
                Gere e baixe a planilha no formato original <strong>8132</strong> com a coluna <strong>STATUS</strong> na extremidade direita.
              </p>
            </div>
          </div>
        </div>

        {/* Botões de Ação para Download e Testador */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setMostrarTestadorApi(!mostrarTestadorApi)}
            className={cn(
              "flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm border transition-all cursor-pointer",
              mostrarTestadorApi
                ? "bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-md shadow-purple-950/20"
                : "bg-background-tertiary hover:bg-border-tertiary text-purple-400 border-purple-500/30"
            )}
          >
            <Zap size={17} className={cn("transition-transform", mostrarTestadorApi && "scale-110 text-purple-300")} />
            <span>{mostrarTestadorApi ? 'Ocultar Testador de API' : '⚡ Testador de API (Base44)'}</span>
          </button>

          <button
            onClick={handleExportarXLSX}
            disabled={exportandoXlsx || linhasFiltradas.length === 0}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-emerald-950/20 transition-all cursor-pointer"
          >
            <FileSpreadsheet size={18} />
            <span>{exportandoXlsx ? 'Gerando...' : 'Exportar Excel (.xlsx)'}</span>
          </button>

          <button
            onClick={handleExportarCSV}
            disabled={exportandoCsv || linhasFiltradas.length === 0}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-blue-950/20 transition-all cursor-pointer"
          >
            <FileText size={18} />
            <span>{exportandoCsv ? 'Gerando...' : 'Exportar CSV (.csv)'}</span>
          </button>
        </div>
      </div>

      {/* PAINEL INTERATIVO DE TESTE DA API (SIMULADOR BASE44) */}
      {mostrarTestadorApi && (
        <div className="bg-background-secondary border-2 border-purple-500/30 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xl animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-tertiary pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/40 shrink-0">
                <Cpu size={22} />
              </div>
              <div>
                <h2 className="text-base font-black text-text-primary flex items-center gap-2">
                  <span>Simulador & Testador de API REST (Base44 / ERP)</span>
                  <span className="text-[10px] bg-purple-500/20 text-purple-300 font-bold px-2 py-0.5 rounded-full border border-purple-500/40">
                    Ao Vivo
                  </span>
                </h2>
                <p className="text-xs text-text-secondary">
                  Teste a rota em tempo real, veja o tempo de resposta e o payload exato de 17 colunas que o Base44 irá receber.
                </p>
              </div>
            </div>

            <button
              onClick={executarTesteApi}
              disabled={testandoApi}
              className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs shadow-lg shadow-purple-950/30 transition-all cursor-pointer self-stretch sm:self-auto"
            >
              {testandoApi ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} className="fill-current" />}
              <span>{testandoApi ? 'Disparando Requisição...' : '⚡ Disparar Teste de API'}</span>
            </button>
          </div>

          {/* URL da API + Botão de Copiar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                <Terminal size={13} className="text-purple-400" />
                <span>Endpoint da API (GET)</span>
              </label>
              <span className="text-[10px] text-text-muted font-mono">Token: logistrack2026</span>
            </div>

            <div className="flex items-center gap-2 bg-background-primary border border-border-secondary rounded-xl p-2.5">
              <span className="text-xs font-bold text-emerald-400 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 font-mono">
                GET
              </span>
              <input 
                type="text" 
                readOnly 
                value={urlCompletaApi} 
                className="flex-1 bg-transparent text-xs text-text-primary font-mono outline-none truncate select-all"
              />
              <button
                onClick={() => copiarTexto(urlCompletaApi, 'url')}
                className="flex items-center gap-1.5 bg-background-secondary hover:bg-border-tertiary text-text-primary px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 border border-border-secondary"
              >
                {copiouUrl ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copiouUrl ? 'Copiado!' : 'Copiar URL'}</span>
              </button>
            </div>
          </div>

          {/* Parâmetros do Teste */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 bg-background-primary/40 p-3.5 rounded-xl border border-border-tertiary">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-muted uppercase">Filtrar Data</label>
              <select
                value={filtroTesteData}
                onChange={e => setFiltroTesteData(e.target.value)}
                className="w-full bg-background-primary border border-border-secondary rounded-lg px-2.5 py-1.5 text-xs font-semibold text-text-primary focus:outline-none"
              >
                <option value="">Todas as Datas</option>
                <option value="hoje">Hoje (hoje)</option>
                {opcoesFiltros.datasList.map(d => (
                  <option key={d} value={d}>{formatarDataSaida(d)}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-muted uppercase">Filtrar Carga</label>
              <select
                value={filtroTesteCarga}
                onChange={e => setFiltroTesteCarga(e.target.value)}
                className="w-full bg-background-primary border border-border-secondary rounded-lg px-2.5 py-1.5 text-xs font-semibold text-text-primary focus:outline-none"
              >
                <option value="">Todas as Cargas</option>
                {opcoesFiltros.cargas.map(c => (
                  <option key={c} value={c}>Carga {c}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-muted uppercase">Filtrar Placa</label>
              <select
                value={filtroTestePlaca}
                onChange={e => setFiltroTestePlaca(e.target.value)}
                className="w-full bg-background-primary border border-border-secondary rounded-lg px-2.5 py-1.5 text-xs font-semibold text-text-primary focus:outline-none"
              >
                <option value="">Todas as Placas</option>
                {opcoesFiltros.placas.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-muted uppercase">Filtrar Status</label>
              <select
                value={filtroTesteStatus}
                onChange={e => setFiltroTesteStatus(e.target.value)}
                className="w-full bg-background-primary border border-border-secondary rounded-lg px-2.5 py-1.5 text-xs font-semibold text-text-primary focus:outline-none"
              >
                <option value="">Todos os Status</option>
                {opcoesFiltros.statusList.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-muted uppercase">Formato de Saída</label>
              <select
                value={formatoTeste}
                onChange={e => setFormatoTeste(e.target.value)}
                className="w-full bg-background-primary border border-purple-500/40 rounded-lg px-2.5 py-1.5 text-xs font-bold text-purple-300 focus:outline-none"
              >
                <option value="csv">CSV (8132 + Status)</option>
                <option value="json">JSON Estruturado</option>
              </select>
            </div>
          </div>

          {/* Resultado do Teste ao Vivo */}
          {resultadoTesteApi && (
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-background-primary p-3.5 rounded-xl border border-border-secondary">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "px-3 py-1 rounded-lg text-xs font-black flex items-center gap-1.5",
                    resultadoTesteApi.sucesso 
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" 
                      : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                  )}>
                    {resultadoTesteApi.sucesso ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                    <span>Status HTTP: {resultadoTesteApi.status} {resultadoTesteApi.statusText}</span>
                  </div>

                  <span className="text-xs font-bold text-info bg-info/10 px-2.5 py-1 rounded-lg border border-info/20">
                    ⚡ {resultadoTesteApi.durationMs} ms
                  </span>

                  <span className="text-xs font-bold text-text-primary bg-background-secondary px-2.5 py-1 rounded-lg border border-border-secondary">
                    📦 {resultadoTesteApi.totalLinhas} linhas
                  </span>

                  <span className="text-xs text-text-muted font-mono">
                    {(resultadoTesteApi.bytes / 1024).toFixed(1)} KB
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copiarTexto(resultadoTesteApi.payloadTexto, 'payload')}
                    className="text-xs font-bold text-text-secondary hover:text-text-primary flex items-center gap-1 px-2.5 py-1 rounded hover:bg-background-secondary transition-colors cursor-pointer"
                  >
                    <Copy size={13} />
                    <span>Copiar Payload</span>
                  </button>
                </div>
              </div>

              {/* Terminal de Visualização do Payload */}
              <div className="bg-[#0f1117] border border-border-secondary rounded-xl p-4 overflow-x-auto max-h-[300px] font-mono text-[11px] leading-relaxed text-zinc-300">
                <pre>{resultadoTesteApi.payloadTexto}</pre>
              </div>
            </div>
          )}

          {/* Caixa de Prompt Pronto para o Base44 */}
          <div className="bg-purple-950/20 border border-purple-500/30 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                <Sparkles size={14} />
                <span>Prompt pronto para colar na IA do seu Base44:</span>
              </span>
              <button
                onClick={() => copiarTexto(promptBase44, 'prompt')}
                className="flex items-center gap-1 bg-purple-600 hover:bg-purple-500 text-white px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                {copiouPrompt ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiouPrompt ? 'Copiado!' : 'Copiar Prompt'}</span>
              </button>
            </div>
            <p className="text-xs text-zinc-300 bg-background-primary/60 p-2.5 rounded-lg font-mono border border-purple-500/20">
              "{promptBase44}"
            </p>
          </div>
        </div>
      )}

      {/* Cards de Métricas em Tempo Real */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-background-secondary p-4 rounded-xl border border-border-secondary shadow-xs">
          <p className="text-[11px] uppercase font-bold text-text-muted tracking-wider">Total de Linhas</p>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl sm:text-2xl font-black text-text-primary">
              {metricas.totalLinhas.toLocaleString('pt-BR')}
            </span>
            <span className="text-[11px] text-text-tertiary font-medium">itens</span>
          </div>
        </div>

        <div className="bg-background-secondary p-4 rounded-xl border border-border-secondary shadow-xs">
          <p className="text-[11px] uppercase font-bold text-text-muted tracking-wider">Notas Fiscais</p>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl sm:text-2xl font-black text-info">
              {metricas.totalNfs.toLocaleString('pt-BR')}
            </span>
            <span className="text-[11px] text-text-tertiary font-medium">únicas</span>
          </div>
        </div>

        <div className="bg-background-secondary p-4 rounded-xl border border-border-secondary shadow-xs">
          <p className="text-[11px] uppercase font-bold text-text-muted tracking-wider">Cargas</p>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl sm:text-2xl font-black text-text-primary">
              {metricas.totalCargas.toLocaleString('pt-BR')}
            </span>
            <span className="text-[11px] text-text-tertiary font-medium">cargas</span>
          </div>
        </div>

        <div className="bg-background-secondary p-4 rounded-xl border border-border-secondary shadow-xs">
          <p className="text-[11px] uppercase font-bold text-text-muted tracking-wider">Peso Total</p>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-lg sm:text-xl font-black text-text-primary">
              {metricas.pesoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-text-tertiary font-medium">kg</span>
          </div>
        </div>

        <div className="col-span-2 sm:col-span-2 md:col-span-1 bg-background-secondary p-4 rounded-xl border border-border-secondary shadow-xs">
          <p className="text-[11px] uppercase font-bold text-text-muted tracking-wider">Valor Total</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-base sm:text-lg font-black text-emerald-400">
              {metricas.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        </div>
      </div>

      {/* Painel de Filtros e Busca */}
      <div className="bg-background-secondary p-4 sm:p-5 rounded-2xl border border-border-secondary space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-tertiary pb-3">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-emerald-400" />
            <h2 className="text-sm font-bold text-text-primary">Filtros de Exportação</h2>
          </div>

          <button
            onClick={limparFiltros}
            className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary font-bold px-2.5 py-1 rounded-lg hover:bg-background-tertiary transition-colors cursor-pointer self-end sm:self-auto"
          >
            <RotateCcw size={13} />
            <span>Limpar Filtros</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* 1. Período */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
              Período de Saída
            </label>
            <select
              value={filtroPeriodo}
              onChange={(e) => {
                setFiltroPeriodo(e.target.value);
                setPaginaAtual(1);
              }}
              className="w-full bg-background-primary border border-border-secondary focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-semibold text-text-primary focus:outline-none transition-colors"
            >
              <option value="todas">Todas as Datas</option>
              <option value="hoje">Hoje</option>
              <option value="ontem">Ontem</option>
              <option value="7dias">Últimos 7 dias</option>
              <option value="mes">Mês Atual</option>
              <option value="personalizado">Personalizado (De / Até)</option>
            </select>
          </div>

          {/* 2. Carga / Carregamento */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
              Carga / Carregamento
            </label>
            <select
              value={filtroCarga}
              onChange={(e) => {
                setFiltroCarga(e.target.value);
                setPaginaAtual(1);
              }}
              className="w-full bg-background-primary border border-border-secondary focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-semibold text-text-primary focus:outline-none transition-colors"
            >
              <option value="todas">Todas as Cargas</option>
              {opcoesFiltros.cargas.map(c => (
                <option key={c} value={c}>Carga {c}</option>
              ))}
            </select>
          </div>

          {/* 3. Placa */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
              Placa do Veículo
            </label>
            <select
              value={filtroPlaca}
              onChange={(e) => {
                setFiltroPlaca(e.target.value);
                setPaginaAtual(1);
              }}
              className="w-full bg-background-primary border border-border-secondary focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-semibold text-text-primary focus:outline-none transition-colors"
            >
              <option value="todas">Todas as Placas</option>
              {opcoesFiltros.placas.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* 4. Status da Entrega */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
              Status da Entrega
            </label>
            <select
              value={filtroStatus}
              onChange={(e) => {
                setFiltroStatus(e.target.value);
                setPaginaAtual(1);
              }}
              className="w-full bg-background-primary border border-border-secondary focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-semibold text-text-primary focus:outline-none transition-colors"
            >
              <option value="todos">Todos os Status</option>
              {opcoesFiltros.statusList.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Linha Opcional para Data Personalizada */}
        {filtroPeriodo === 'personalizado' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border-tertiary">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                Data Inicial (De)
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => {
                  setDataInicio(e.target.value);
                  setPaginaAtual(1);
                }}
                className="w-full bg-background-primary border border-border-secondary focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-semibold text-text-primary focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                Data Final (Até)
              </label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => {
                  setDataFim(e.target.value);
                  setPaginaAtual(1);
                }}
                className="w-full bg-background-primary border border-border-secondary focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-semibold text-text-primary focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Campo de Busca Textual Global */}
        <div className="relative pt-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar por Nota Fiscal, Cliente, Cód. Produto, Descrição, Pedido, RCA, Cidade, Bairro..."
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPaginaAtual(1);
            }}
            className="w-full bg-background-primary border border-border-secondary focus:border-emerald-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-text-primary focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Pré-visualização da Tabela 8132 + STATUS */}
      <div className="bg-background-secondary rounded-2xl border border-border-secondary overflow-hidden shadow-xs w-full">
        <div className="p-4 sm:px-6 border-b border-border-secondary flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-background-secondary/80">
          <div>
            <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
              <FileSpreadsheet size={18} className="text-emerald-400" />
              <span>Pré-visualização da Planilha (8132 + STATUS)</span>
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Exibindo <strong>{linhasPaginadas.length}</strong> de <strong>{linhasFiltradas.length.toLocaleString('pt-BR')}</strong> linhas filtradas.
            </p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-xs text-text-secondary font-medium">Linhas por pág:</span>
            <select
              value={itensPorPagina}
              onChange={(e) => {
                setItensPorPagina(Number(e.target.value));
                setPaginaAtual(1);
              }}
              className="bg-background-primary border border-border-secondary rounded-lg px-2.5 py-1 text-xs font-bold text-text-primary focus:outline-none"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
        </div>

        {/* Tabela com Rolagem Horizontal Suave */}
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-background-tertiary sticky top-0 z-20 border-b border-border-secondary">
              <tr>
                <th className="py-2.5 px-3 font-bold text-text-secondary text-[11px] uppercase tracking-wider w-12 text-center">
                  #
                </th>
                {COLUNAS_8132_STATUS.map(col => (
                  <th 
                    key={col.id}
                    style={{ minWidth: col.minWidth }}
                    className={cn(
                      "py-2.5 px-3 font-bold text-[11px] uppercase tracking-wider whitespace-nowrap",
                      col.isStatus 
                        ? "text-emerald-400 bg-emerald-950/20 sticky right-0 border-l border-emerald-500/20 text-center" 
                        : "text-text-secondary"
                    )}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-tertiary">
              {linhasPaginadas.length === 0 ? (
                <tr>
                  <td colSpan={COLUNAS_8132_STATUS.length + 1} className="py-12 text-center text-text-tertiary">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileDown size={32} className="text-text-muted opacity-40" />
                      <p className="font-semibold text-sm">Nenhum registro encontrado com os filtros atuais.</p>
                      <button
                        onClick={limparFiltros}
                        className="text-xs text-emerald-400 font-bold hover:underline mt-1 cursor-pointer"
                      >
                        Limpar todos os filtros
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                linhasPaginadas.map((linha, idx) => {
                  const numLinha = (paginaAtual - 1) * itensPorPagina + idx + 1;
                  const stBadge = getStatusBadge(linha['STATUS']);

                  return (
                    <tr 
                      key={idx}
                      className="hover:bg-background-tertiary/60 transition-colors group"
                    >
                      <td className="py-2.5 px-3 text-center text-text-muted font-mono text-[11px]">
                        {numLinha}
                      </td>

                      {/* 1. CODCLI */}
                      <td className="py-2.5 px-3 font-mono text-text-secondary whitespace-nowrap">
                        {linha['CODCLI']}
                      </td>

                      {/* 2. CLIENTE */}
                      <td className="py-2.5 px-3 font-bold text-text-primary whitespace-nowrap">
                        {linha['CLIENTE']}
                      </td>

                      {/* 3. MUNICENT */}
                      <td className="py-2.5 px-3 text-text-secondary whitespace-nowrap">
                        {linha['MUNICENT']}
                      </td>

                      {/* 4. BAIRROENT */}
                      <td className="py-2.5 px-3 text-text-secondary whitespace-nowrap">
                        {linha['BAIRROENT']}
                      </td>

                      {/* 5. ROTA ENTREGA */}
                      <td className="py-2.5 px-3 font-semibold text-text-primary whitespace-nowrap">
                        {linha['ROTA ENTREGA']}
                      </td>

                      {/* 6. PLACA */}
                      <td className="py-2.5 px-3 font-mono font-bold text-info whitespace-nowrap">
                        {linha['PLACA']}
                      </td>

                      {/* 7. CARREGAMENTO */}
                      <td className="py-2.5 px-3 font-mono text-text-secondary whitespace-nowrap">
                        {linha['CARREGAMENTO']}
                      </td>

                      {/* 8. PEDIDO */}
                      <td className="py-2.5 px-3 font-mono text-text-secondary whitespace-nowrap">
                        {linha['PEDIDO']}
                      </td>

                      {/* 9. RCA */}
                      <td className="py-2.5 px-3 text-text-secondary whitespace-nowrap">
                        {linha['RCA']}
                      </td>

                      {/* 10. CÓD. DO PRODUTO */}
                      <td className="py-2.5 px-3 font-mono text-text-secondary whitespace-nowrap">
                        {linha['CÓD. DO PRODUTO']}
                      </td>

                      {/* 11. PRODUTO */}
                      <td className="py-2.5 px-3 text-text-primary font-medium whitespace-nowrap">
                        {linha['PRODUTO']}
                      </td>

                      {/* 12. QUANTIDADE DE CAIXAS */}
                      <td className="py-2.5 px-3 text-center font-bold text-text-primary whitespace-nowrap">
                        {linha['QUANTIDADE DE CAIXAS']}
                      </td>

                      {/* 13. PESO (KG) */}
                      <td className="py-2.5 px-3 text-right font-mono text-text-secondary whitespace-nowrap">
                        {typeof linha['PESO (KG)'] === 'number' 
                          ? linha['PESO (KG)'].toFixed(2) 
                          : linha['PESO (KG)']}
                      </td>

                      {/* 14. N° NOTA FISCAL */}
                      <td className="py-2.5 px-3 font-mono font-bold text-text-primary whitespace-nowrap">
                        {linha['N° NOTA FISCAL']}
                      </td>

                      {/* 15. DATA SAÍDA */}
                      <td className="py-2.5 px-3 text-text-secondary whitespace-nowrap font-mono text-[11px]">
                        {linha['DATA SAÍDA']}
                      </td>

                      {/* 16. VALOR PRODUTO */}
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-400 whitespace-nowrap">
                        {typeof linha['VALOR PRODUTO'] === 'number'
                          ? linha['VALOR PRODUTO'].toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : linha['VALOR PRODUTO']}
                      </td>

                      {/* 17. STATUS (EXTREMIDADE DIREITA) */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap sticky right-0 bg-background-secondary/95 group-hover:bg-background-tertiary border-l border-border-tertiary">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-[11px] font-bold inline-block leading-none",
                          stBadge.bgClass
                        )}>
                          {stBadge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé da Tabela com Paginação */}
        {linhasFiltradas.length > 0 && (
          <div className="p-4 border-t border-border-secondary flex flex-col sm:flex-row items-center justify-between gap-3 bg-background-secondary">
            <p className="text-xs text-text-secondary font-medium">
              Página <strong>{paginaAtual}</strong> de <strong>{totalPaginas}</strong> (Total de {linhasFiltradas.length.toLocaleString('pt-BR')} linhas)
            </p>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                disabled={paginaAtual === 1}
                className="p-2 rounded-lg bg-background-tertiary hover:bg-border-tertiary disabled:opacity-30 text-text-primary transition-colors cursor-pointer"
                title="Página Anterior"
              >
                <ChevronLeft size={16} />
              </button>

              {/* Botões de páginas numeradas */}
              {numerosPaginas.map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setPaginaAtual(pageNum)}
                  className={cn(
                    "min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center",
                    paginaAtual === pageNum
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-background-tertiary hover:bg-border-tertiary text-text-secondary hover:text-text-primary"
                  )}
                >
                  {pageNum}
                </button>
              ))}

              <button
                onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
                disabled={paginaAtual === totalPaginas}
                className="p-2 rounded-lg bg-background-tertiary hover:bg-border-tertiary disabled:opacity-30 text-text-primary transition-colors cursor-pointer"
                title="Próxima Página"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
