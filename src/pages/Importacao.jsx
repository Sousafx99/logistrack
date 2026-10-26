import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  UploadCloud, 
  FileType, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Trash2, 
  DownloadCloud, 
  Database, 
  Upload,
  Calendar,
  Clock,
  Truck,
  Gauge,
  FileSpreadsheet,
  Check,
  RefreshCw,
  Boxes,
  MapPin,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X,
  ArrowRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useStore } from '../store/useStore';
import { normalizarRCA } from '../lib/utils';
import { firestoreService } from '../lib/firestoreService';
import { Badge } from '../components/ui/Badge';
import { STATUS_OPTIONS } from '../data/mockData';

export function Importacao() {
  const navigate = useNavigate();
  const { 
    entregas = [], 
    devolucoes = [], 
    veiculos = [],
    importarEntregas, 
    importarPreviaCargas,
    atualizarEntregasPorPlanilha,
    removerEntregasPorData, 
    removerEntregaPorId,
    removerEntregasPorCarga,
    atribuirPlacaCarga,
    atribuirPlacaEntrega,
    limparTodasEntregas, 
    restaurarBackup,
    globalFilters,
    setGlobalFilters
  } = useStore();

  // Controle de Abas: 'previa' (8164 + Programação), 'faturamento' (8132 Oficial) ou 'atualizacao' (Rotas & Cargas em Lote)
  const [abaAtiva, setAbaAtiva] = useState('previa');

  // Estado para Faturamento Oficial (Aba 8132)
  const [file8132, setFile8132] = useState(null);
  const [loading8132, setLoading8132] = useState(false);
  const [result8132, setResult8132] = useState(null);

  // Estado para Atualização em Lote de Status / Cargas (Aba 3)
  const [fileAtualizacao, setFileAtualizacao] = useState(null);
  const [loadingAtualizacao, setLoadingAtualizacao] = useState(false);
  const [dadosAtualizacaoCalculados, setDadosAtualizacaoCalculados] = useState(null);
  const [resultAtualizacao, setResultAtualizacao] = useState(null);
  const [opcoesAtualizacao, setOpcoesAtualizacao] = useState({
    cadastrarNovas: true,
    atualizarPlaca: true,
    atualizarPesosValores: true
  });
  const [filtroTabelaAtualizacao, setFiltroTabelaAtualizacao] = useState('todos');
  const [termoBuscaAtualizacao, setTermoBuscaAtualizacao] = useState('');

  // Estado para Prévia de Cargas (Aba 8164 + Programação)
  const [file8164, setFile8164] = useState(null);
  const [fileProg, setFileProg] = useState(null);
  const [loadingPrevia, setLoadingPrevia] = useState(false);
  const [dadosPreviaCalculados, setDadosPreviaCalculados] = useState(null);
  const [resultPrevia, setResultPrevia] = useState(null);

  // Estados para Atribuição de Placa e Gestão de Cargas Sem Placa
  const [placasPrevia, setPlacasPrevia] = useState({});
  const [cargasExpandidasPrevia, setCargasExpandidasPrevia] = useState({});
  const [placasAtivas, setPlacasAtivas] = useState({});
  const [cargasExpandidasAtivas, setCargasExpandidasAtivas] = useState({});

  // Estados de Exclusão e Limpeza
  const [dataParaExcluir, setDataParaExcluir] = useState(null);
  const [senhaExclusao, setSenhaExclusao] = useState('');
  const [erroSenha, setErroSenha] = useState('');

  const [modalLimpezaGeral, setModalLimpezaGeral] = useState(false);
  const [senhaLimpezaGeral, setSenhaLimpezaGeral] = useState('');
  const [erroSenhaGeral, setErroSenhaGeral] = useState('');
  const [limpandoGeral, setLimpandoGeral] = useState(false);

  // Backup
  const backupInputRef = useRef(null);
  const [restaurando, setRestaurando] = useState(false);

  // Helpers de parsing de dados
  const parseNum = (val) => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    const str = String(val).trim().replace(/[^\d.,-]/g, '');
    if (str.includes(',') && str.includes('.')) {
      return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
    }
    if (str.includes(',')) {
      return parseFloat(str.replace(',', '.')) || 0;
    }
    return parseFloat(str) || 0;
  };

  const parseDataExcel = (val) => {
    if (!val) return new Date().toISOString().split('T')[0];
    if (typeof val === 'number') {
      try {
        const d = XLSX.SSF.parse_date_code(val);
        if (d && d.y) {
          return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
        }
      } catch {}
      const utc_days = Math.floor(val - 25569);
      const date = new Date(utc_days * 864e5);
      return date.toISOString().split('T')[0];
    }
    if (val instanceof Date && !isNaN(val)) {
      return val.toISOString().split('T')[0];
    }
    if (typeof val === 'string') {
      const cleaned = val.trim();
      if (cleaned.includes('/')) {
        const parts = cleaned.split('/');
        if (parts.length === 3) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          let year = parts[2].split(' ')[0];
          if (year.length === 2) year = `20${year}`;
          return `${year}-${month}-${day}`;
        }
      }
      if (cleaned.includes('-')) return cleaned.split(' ')[0];
    }
    return new Date().toISOString().split('T')[0];
  };

  const normalizeStr = (s) => {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // -------------------------------------------------------------
  // 1. FLUXO DE PRÉVIA: PARSER DO 8164 E DA PROGRAMAÇÃO
  // -------------------------------------------------------------
  // Função inteligente para inspecionar o conteúdo das planilhas e identificar automaticamente o tipo
  const inspecionarTipoArquivo = async (file) => {
    if (!file) return null;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (!rows || rows.length === 0) return null;
      const h = rows[0].map(col => normalizeStr(col));
      const is8164 = h.some(c => c.includes('numero pedido') || c.includes('carregamento') || c.includes('nome cliente') || c.includes('codigo cliente') || c.includes('bairro entrega') || c.includes('status posicao pedido'));
      const isProg = h.some(c => c.includes('carga erp') || c.includes('pri.carreg') || c.includes('cross') || c.includes('tipo rota') || (c.includes('veiculo') && c.includes('expedicao')));
      if (is8164 && !isProg) return '8164';
      if (isProg && !is8164) return 'prog';
      return null;
    } catch {
      return null;
    }
  };

  const processarArquivosPrevia = async (arq8164, arqProg) => {
    if (!arq8164 && !arqProg) return;
    setLoadingPrevia(true);
    setResultPrevia(null);

    try {
      let file8164Efetivo = arq8164;
      let fileProgEfetivo = arqProg;

      // Auto-detecção inteligente de inversão de arquivos:
      const tipo1 = await inspecionarTipoArquivo(arq8164);
      const tipo2 = await inspecionarTipoArquivo(arqProg);

      if (tipo1 === 'prog' || tipo2 === '8164') {
        if (tipo1 === 'prog' && tipo2 === '8164') {
          file8164Efetivo = arqProg;
          fileProgEfetivo = arq8164;
        } else if (tipo1 === 'prog' && !arqProg) {
          fileProgEfetivo = arq8164;
          file8164Efetivo = null;
        } else if (tipo2 === '8164' && !arq8164) {
          file8164Efetivo = arqProg;
          fileProgEfetivo = null;
        }
        setFile8164(file8164Efetivo);
        setFileProg(fileProgEfetivo);
      }

      let mapProgramacao = {};
      let listaKmPrevisto = [];
      let dataExpedicaoGlobal = new Date().toISOString().split('T')[0];

      // 1. Ler arquivo de Programação (se fornecido)
      if (fileProgEfetivo) {
        const dataProg = await fileProgEfetivo.arrayBuffer();
        const wbProg = XLSX.read(dataProg, { type: 'array' });
        const wsProg = wbProg.Sheets[wbProg.SheetNames[0]];
        const rowsProg = XLSX.utils.sheet_to_json(wsProg, { header: 1, defval: '' });

        if (rowsProg && rowsProg.length > 1) {
          const header = rowsProg[0].map(h => normalizeStr(h));
          const idxCarga = header.findIndex(h => h.includes('carga') || h.includes('carregamento'));
          const idxVeiculo = header.findIndex(h => h.includes('veiculo') || h.includes('placa'));
          const idxKm = header.findIndex(h => h.includes('km') || h.includes('distancia'));
          const idxTipo = header.findIndex(h => h.includes('tipo') && !h.includes('rota'));
          const idxDestino = header.findIndex(h => h.includes('destino') || h.includes('rota'));
          const idxData = header.findIndex(h => h.includes('data') || h.includes('expedicao'));
          const idxTransportadora = header.findIndex(h => h.includes('transportadora'));
          const idxValorPrev = header.findIndex(h => h.includes('previsao') || h.includes('faturamento') || h.includes('valor'));
          const idxPriCarreg = header.findIndex((h, idx) => {
            if (idx === idxCarga) return false;
            if (h === 'pri carreg' || h.startsWith('pri ') || h === 'pri' || h === 'pri carregamento') return true;
            if (h.includes('pri') && !h.includes('previsao') && !h.includes('preco')) return true;
            if (h.includes('ordem') || h.includes('sequencia') || h.includes('posicao')) return true;
            return false;
          });
          const idxObs = header.findIndex(h => h.includes('observ') || h.includes('obs'));
          const idxDescarga = header.findIndex(h => h.includes('descarga'));

          if (idxCarga === -1) {
            throw new Error("Arquivo de Programação inválido: coluna de Carga/Carregamento não encontrada.");
          }

          for (let r = 1; r < rowsProg.length; r++) {
            const row = rowsProg[r];
            if (!row || row.length === 0) continue;
            const cargaVal = String(row[idxCarga] || '').trim();
            if (!cargaVal || cargaVal === '0') continue;

            const placaVal = String(row[idxVeiculo !== -1 ? idxVeiculo : 6] || '').trim().toUpperCase();
            const kmVal = parseNum(row[idxKm !== -1 ? idxKm : 15]);
            const tipoVal = String(row[idxTipo !== -1 ? idxTipo : 11] || '').trim();
            const destinoVal = String(row[idxDestino !== -1 ? idxDestino : 5] || '').trim();
            const dataVal = parseDataExcel(row[idxData !== -1 ? idxData : 0]);
            const transportadoraVal = String(row[idxTransportadora !== -1 ? idxTransportadora : 12] || '').trim();
            const valorPrevVal = parseNum(row[idxValorPrev !== -1 ? idxValorPrev : 13]);
            const priVal = parseInt(row[idxPriCarreg !== -1 ? idxPriCarreg : 10], 10) || null;
            const obsRaw = String(row[idxObs !== -1 ? idxObs : 7] || '').trim();
            const obsVal = obsRaw === '-' ? '' : obsRaw;
            const descargaVal = parseNum(row[idxDescarga !== -1 ? idxDescarga : 8]);

            if (dataVal) dataExpedicaoGlobal = dataVal;

            mapProgramacao[cargaVal] = {
              carga: cargaVal,
              placa: placaVal,
              kmEstimado: kmVal,
              tipoVeiculo: tipoVal,
              destino: destinoVal,
              dataExpedicao: dataVal,
              transportadora: transportadoraVal,
              valorPrevisto: valorPrevVal,
              prioridade: priVal,
              observacao: obsVal,
              descarga: descargaVal
            };

            if (placaVal && kmVal > 0) {
              listaKmPrevisto.push({
                data: dataVal,
                placa: placaVal,
                carga: cargaVal,
                kmPrevisto: kmVal
              });
            }
          }
        }
      }

      // 2. Ler arquivo 8164 (se fornecido)
      let entregasPrevia = [];
      let cargasAgrupadas = {};

      if (file8164Efetivo) {
        const data8164 = await file8164Efetivo.arrayBuffer();
        const wb8164 = XLSX.read(data8164, { type: 'array', raw: true });
        const ws8164 = wb8164.Sheets[wb8164.SheetNames[0]];
        const rows8164 = XLSX.utils.sheet_to_json(ws8164, { header: 1, defval: '' });

        if (!rows8164 || rows8164.length < 2) {
          throw new Error("O arquivo 8164 está vazio ou não possui linhas de pedidos.");
        }

        const header8164 = rows8164[0].map(h => normalizeStr(h));
        const idxPedido = header8164.findIndex(h => h === 'numero pedido' || h.includes('pedido'));
        const idxCarga = header8164.findIndex(h => h === 'numero carregamento' || h.includes('carregamento') || h.includes('carga'));
        const idxCodCli = header8164.findIndex(h => (h.includes('cod') || h.includes('codigo')) && h.includes('cliente'));
        const idxCliente = header8164.findIndex(h => (h.includes('nome') || h.includes('razao')) && h.includes('cliente')) !== -1
          ? header8164.findIndex(h => (h.includes('nome') || h.includes('razao')) && h.includes('cliente'))
          : header8164.findIndex(h => h.includes('cliente') && !h.includes('cod'));
        const idxValor = header8164.findIndex(h => h === 'valor do pedido' || (h.includes('valor') && !h.includes('previsto')));
        const idxPeso = header8164.findIndex(h => h === 'peso' || h.includes('peso'));
        
        let idxBairro = header8164.findIndex(h => h === 'bairro entrega' || h.includes('bairro entrega'));
        if (idxBairro === -1) idxBairro = header8164.findIndex(h => h === 'bairro comercial' || h.includes('bairro comercial'));
        if (idxBairro === -1) idxBairro = header8164.findIndex(h => h.includes('bairro') && !h.includes('cobranca'));

        const idxCidade = header8164.findIndex(h => h.includes('municipio') || h.includes('cidade'));
        const idxRota = header8164.findIndex(h => h === 'rota' || (h.includes('rota') && !h.includes('codigo')));
        const idxDataPrev = header8164.findIndex(h => h.includes('previs') || h.includes('data'));
        const idxRca = header8164.findIndex(h => (h.includes('nome') || !h.includes('cod')) && (h.includes('vendedor') || h.includes('rca')));

        if (idxPedido === -1) {
          throw new Error("Arquivo de Pedidos 8164 inválido: coluna de Número de Pedido não encontrada.");
        }

        for (let r = 1; r < rows8164.length; r++) {
          const row = rows8164[r];
          if (!row || row.length === 0) continue;

          const pedido = String(row[idxPedido] || '').trim();
          if (!pedido) continue;

          const carga = String(row[idxCarga !== -1 ? idxCarga : 4] || '').trim();
          const prog = mapProgramacao[carga] || {};
          const placa = prog.placa || 'SEM PLACA';
          const dataEntrega = prog.dataExpedicao || parseDataExcel(row[idxDataPrev !== -1 ? idxDataPrev : 2]) || dataExpedicaoGlobal;
          const valor = parseNum(row[idxValor !== -1 ? idxValor : 7]);
          const peso = parseNum(row[idxPeso !== -1 ? idxPeso : 8]);
          const rota = String(row[idxRota !== -1 ? idxRota : 19] || prog.destino || '').trim();

          const entregaObj = {
            id: `PREV-${pedido}-${Date.now()}`,
            nota: `PED: ${pedido}`,
            pedido: pedido,
            codCliente: String(row[idxCodCli !== -1 ? idxCodCli : 5] || '').trim(),
            cliente: String(row[idxCliente !== -1 ? idxCliente : 6] || 'CLIENTE NÃO IDENTIFICADO').trim(),
            cidade: String(row[idxCidade !== -1 ? idxCidade : 14] || '').trim(),
            municipio: String(row[idxCidade !== -1 ? idxCidade : 14] || '').trim(),
            bairro: String(row[idxBairro !== -1 ? idxBairro : 13] || '').trim(),
            rota: rota,
            placa: placa,
            placaOriginal: placa,
            carga: carga || 'Sem Carga',
            data: dataEntrega,
            dataFaturamento: dataEntrega,
            rca: normalizarRCA(String(row[idxRca !== -1 ? idxRca : 10] || '').trim()),
            peso: Number(peso.toFixed(2)),
            valor: Number(valor.toFixed(2)),
            priCarregamento: prog.prioridade || null,
            observacaoProgramacao: prog.observacao || '',
            isPrevia: true,
            statusFaturamento: 'Previa',
            notaProvisoria: true,
            status: 'Pendente',
            canhoto: false,
            itens: []
          };

          entregasPrevia.push(entregaObj);

          if (!cargasAgrupadas[carga]) {
            cargasAgrupadas[carga] = {
              carga: carga,
              data: dataEntrega,
              placa: placa,
              tipoVeiculo: prog.tipoVeiculo || 'N/D',
              kmEstimado: prog.kmEstimado || 0,
              prioridade: prog.prioridade || null,
              observacao: prog.observacao || '',
              descarga: prog.descarga || 0,
              pedidosCount: 0,
              pesoTotal: 0,
              valorTotal: 0,
              rota: rota,
              temProg: !!prog.placa
            };
          }
          cargasAgrupadas[carga].pedidosCount += 1;
          cargasAgrupadas[carga].pesoTotal += peso;
          cargasAgrupadas[carga].valorTotal += valor;
        }
      }

            const listaCargasProg = Object.values(cargasAgrupadas).map(c => ({
        id: `${c.data || dataExpedicaoGlobal}_${c.carga}`,
        data: c.data || dataExpedicaoGlobal,
        carga: c.carga,
        placa: c.placa,
        prioridade: c.prioridade,
        tipoVeiculo: c.tipoVeiculo,
        observacao: c.observacao,
        descarga: c.descarga,
        rota: c.rota,
        kmEstimado: c.kmEstimado
      }));

      setDadosPreviaCalculados({
        entregasPrevia,
        cargasAgrupadas: Object.values(cargasAgrupadas),
        cargasProgramacaoLista: listaCargasProg,
        listaKmPrevisto,
        totalCargas: Object.keys(cargasAgrupadas).length,
        totalPedidos: entregasPrevia.length,
        totalKmEstimado: listaKmPrevisto.reduce((acc, k) => acc + (Number(k.kmPrevisto) || 0), 0)
      });

    } catch (err) {
      console.error(err);
      alert(err.message || "Erro ao processar os arquivos de prévia. Verifique os formatos.");
    } finally {
      setLoadingPrevia(false);
    }
  };

  // Confirmar e Gravar Prévia no Sistema
  const handleConfirmarPrevia = async () => {
    if (!dadosPreviaCalculados || dadosPreviaCalculados.entregasPrevia.length === 0) {
      alert("Nenhum pedido válido encontrado para prévia.");
      return;
    }

    setLoadingPrevia(true);
    try {
      await importarPreviaCargas(
        dadosPreviaCalculados.entregasPrevia, 
        dadosPreviaCalculados.listaKmPrevisto
      );

      if (dadosPreviaCalculados.cargasProgramacaoLista && dadosPreviaCalculados.cargasProgramacaoLista.length > 0) {
        try {
          await firestoreService.salvarCargasProgramacaoEmLote(dadosPreviaCalculados.cargasProgramacaoLista);
        } catch (errProg) {
          console.warn("Aviso ao salvar lote de cargasProgramacao:", errProg);
        }
      }

      setResultPrevia({
        cargas: dadosPreviaCalculados.totalCargas,
        pedidos: dadosPreviaCalculados.totalPedidos,
        kmTotal: dadosPreviaCalculados.totalKmEstimado
      });

      setFile8164(null);
      setFileProg(null);
      setDadosPreviaCalculados(null);

    } catch (err) {
      console.error(err);
      alert("Erro ao salvar prévia: " + (err.message || 'Falha na conexão.'));
    } finally {
      setLoadingPrevia(false);
    }
  };

  // Funções de Gerenciamento da Prévia (Atribuição de Placas e Exclusões)
  const toggleExpandirCargaPrevia = (carga) => {
    setCargasExpandidasPrevia(prev => ({ ...prev, [carga]: !prev[carga] }));
  };

  const toggleExpandirCargaAtiva = (carga) => {
    setCargasExpandidasAtivas(prev => ({ ...prev, [carga]: !prev[carga] }));
  };

  const recalcularPrevia = (novasEntregas, listaKm = dadosPreviaCalculados?.listaKmPrevisto || []) => {
    const cargasMap = {};
    novasEntregas.forEach(e => {
      const carga = e.carga || 'Sem Carga';
      const temPlacaValida = Boolean(e.placa && e.placa !== 'SEM PLACA' && e.placa !== 'Sem Placa');
      if (!cargasMap[carga]) {
        cargasMap[carga] = {
          carga: carga,
          placa: e.placa || 'SEM PLACA',
          tipoVeiculo: e.tipoVeiculo || 'N/D',
          kmEstimado: e.kmEstimado || 0,
          pedidosCount: 0,
          pesoTotal: 0,
          valorTotal: 0,
          rota: e.rota || '',
          temProg: temPlacaValida
        };
      }
      cargasMap[carga].pedidosCount += 1;
      cargasMap[carga].pesoTotal += (e.peso || 0);
      cargasMap[carga].valorTotal += (e.valor || 0);
      if (temPlacaValida) {
        cargasMap[carga].placa = e.placa;
        cargasMap[carga].temProg = true;
      }
    });

    setDadosPreviaCalculados({
      entregasPrevia: novasEntregas,
      cargasAgrupadas: Object.values(cargasMap),
      listaKmPrevisto: listaKm,
      totalCargas: Object.keys(cargasMap).length,
      totalPedidos: novasEntregas.length,
      totalKmEstimado: listaKm.reduce((acc, k) => acc + (Number(k.kmPrevisto) || 0), 0)
    });
  };

  const handleAtribuirPlacaCargaPrevia = (cargaNome, novaPlaca) => {
    if (!novaPlaca || !novaPlaca.trim()) {
      alert("Por favor, digite ou selecione a placa do veículo.");
      return;
    }
    const pUpper = novaPlaca.trim().toUpperCase();
    const novasEntregas = (dadosPreviaCalculados?.entregasPrevia || []).map(e => {
      if (String(e.carga).trim() === String(cargaNome).trim()) {
        return {
          ...e,
          placa: pUpper,
          placaOriginal: pUpper
        };
      }
      return e;
    });
    recalcularPrevia(novasEntregas, dadosPreviaCalculados?.listaKmPrevisto);
    setPlacasPrevia(prev => ({ ...prev, [cargaNome]: '' }));
  };

  const handleAtribuirPlacaPedidoPrevia = (pedidoId, novaPlaca) => {
    if (!novaPlaca || !novaPlaca.trim()) {
      alert("Por favor, digite ou selecione a placa do veículo.");
      return;
    }
    const pUpper = novaPlaca.trim().toUpperCase();
    const novasEntregas = (dadosPreviaCalculados?.entregasPrevia || []).map(e => {
      if (e.id === pedidoId) {
        return {
          ...e,
          placa: pUpper,
          placaOriginal: pUpper
        };
      }
      return e;
    });
    recalcularPrevia(novasEntregas, dadosPreviaCalculados?.listaKmPrevisto);
  };

  const handleExcluirCargaPrevia = (cargaNome) => {
    if (!window.confirm(`Deseja realmente excluir a carga ${cargaNome} e todos os seus pedidos da prévia?`)) {
      return;
    }
    const novasEntregas = (dadosPreviaCalculados?.entregasPrevia || []).filter(e => 
      String(e.carga).trim() !== String(cargaNome).trim()
    );
    recalcularPrevia(novasEntregas, dadosPreviaCalculados?.listaKmPrevisto);
  };

  const handleExcluirPedidoPrevia = (pedidoId) => {
    const novasEntregas = (dadosPreviaCalculados?.entregasPrevia || []).filter(e => e.id !== pedidoId);
    recalcularPrevia(novasEntregas, dadosPreviaCalculados?.listaKmPrevisto);
  };

  // Separação de Cargas com e sem placa na prévia
  const cargasSemPlacaPrevia = useMemo(() => {
    if (!dadosPreviaCalculados) return [];
    return (dadosPreviaCalculados.cargasAgrupadas || []).filter(c => !c.placa || c.placa === 'SEM PLACA' || !c.temProg);
  }, [dadosPreviaCalculados]);

  const cargasComPlacaPrevia = useMemo(() => {
    if (!dadosPreviaCalculados) return [];
    return (dadosPreviaCalculados.cargasAgrupadas || []).filter(c => c.placa && c.placa !== 'SEM PLACA' && c.temProg);
  }, [dadosPreviaCalculados]);

  // Gestão de Entregas Sem Placa na Base Ativa (Entregas já salvas no Firestore)
  const entregasSemPlacaAtivas = useMemo(() => {
    return (entregas || []).filter(e => !e.placa || e.placa === 'SEM PLACA' || e.placa === 'Sem Placa');
  }, [entregas]);

  const cargasSemPlacaAtivas = useMemo(() => {
    const map = {};
    entregasSemPlacaAtivas.forEach(e => {
      const carga = e.carga || 'Sem Carga';
      if (!map[carga]) {
        map[carga] = {
          carga,
          data: e.data,
          pedidosCount: 0,
          pesoTotal: 0,
          valorTotal: 0,
          rota: e.rota || '',
          entregas: []
        };
      }
      map[carga].pedidosCount++;
      map[carga].pesoTotal += (e.peso || 0);
      map[carga].valorTotal += (e.valor || 0);
      map[carga].entregas.push(e);
    });
    return Object.values(map);
  }, [entregasSemPlacaAtivas]);

  const handleAtribuirPlacaCargaAtiva = async (cargaNome, novaPlaca, dataStr) => {
    if (!novaPlaca || !novaPlaca.trim()) {
      alert("Por favor, digite ou selecione a placa do veículo.");
      return;
    }
    const pUpper = novaPlaca.trim().toUpperCase();
    try {
      await atribuirPlacaCarga(cargaNome, pUpper, dataStr);
      setPlacasAtivas(prev => ({ ...prev, [cargaNome]: '' }));
    } catch (err) {
      alert("Erro ao atribuir placa: " + err.message);
    }
  };

  const handleAtribuirPlacaPedidoAtivo = async (entregaId, novaPlaca) => {
    if (!novaPlaca || !novaPlaca.trim()) {
      alert("Por favor, digite ou selecione a placa do veículo.");
      return;
    }
    const pUpper = novaPlaca.trim().toUpperCase();
    try {
      await atribuirPlacaEntrega(entregaId, pUpper);
    } catch (err) {
      alert("Erro ao atribuir placa ao pedido: " + err.message);
    }
  };

  const handleExcluirCargaAtiva = async (cargaNome, dataStr) => {
    if (!window.confirm(`Deseja realmente excluir a carga ${cargaNome} e todos os seus pedidos do sistema?`)) {
      return;
    }
    try {
      await removerEntregasPorCarga(cargaNome, dataStr);
    } catch (err) {
      alert("Erro ao excluir carga: " + err.message);
    }
  };

  const handleExcluirPedidoAtivo = async (entregaId) => {
    if (!window.confirm("Deseja realmente excluir este pedido do sistema?")) {
      return;
    }
    try {
      await removerEntregaPorId(entregaId);
    } catch (err) {
      alert("Erro ao excluir pedido: " + err.message);
    }
  };

  // -------------------------------------------------------------
  // 2. FLUXO DE FATURAMENTO OFICIAL (8132)
  // -------------------------------------------------------------
  const processarArquivo8132 = async () => {
    if (!file8132) return;
    setLoading8132(true);
    setResult8132(null);

    try {
      const data = await file8132.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array', cellDates: true, raw: true });
      
      let worksheet;
      const aba8132 = workbook.SheetNames.find(name => name.includes('8132'));
      if (aba8132) {
        worksheet = workbook.Sheets[aba8132];
      } else {
        let bestSheet = workbook.Sheets[workbook.SheetNames[0]];
        let maxLen = 0;
        for (const sheetName of workbook.SheetNames) {
          const ws = workbook.Sheets[sheetName];
          const rowsTemp = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
          if (rowsTemp.length > maxLen) {
            maxLen = rowsTemp.length;
            bestSheet = ws;
          }
        }
        worksheet = bestSheet;
      }
      
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: true });
      if (!rawRows || rawRows.length < 2) {
        throw new Error("A planilha 8132 está vazia ou não possui linhas de dados.");
      }

      const headerRow = rawRows[0] || [];
      const headerMap = {};
      headerRow.forEach((h, idx) => {
        const normH = normalizeStr(h);
        if (normH) headerMap[normH] = idx;
      });

      const findColIdx = (possibleNames, fallbackIdx) => {
        // 1. Match exato normalizado
        for (const name of possibleNames) {
          const normName = normalizeStr(name);
          for (const [hNorm, idx] of Object.entries(headerMap)) {
            if (hNorm === normName) return idx;
          }
        }
        // 2. Match onde o cabeçalho contém o termo buscado (evita falsos positivos invertidos)
        for (const name of possibleNames) {
          const normName = normalizeStr(name);
          if (normName.length < 3) continue;
          for (const [hNorm, idx] of Object.entries(headerMap)) {
            if (hNorm.includes(normName)) return idx;
          }
        }
        return fallbackIdx;
      };

      const idxCodCli = findColIdx(['codcli', 'cod cliente', 'codigo cliente', 'cod client'], 0);
      const idxCliente = findColIdx(['cliente', 'nome cliente', 'razao social'], 1);
      const idxCidade = findColIdx(['municent', 'municipio', 'cidade'], 2);
      const idxBairro = findColIdx(['bairroent', 'bairro'], 3);
      const idxRota = findColIdx(['rota entrega', 'rota'], 4);
      const idxPlaca = findColIdx(['placa', 'veiculo'], 5);
      const idxCarga = findColIdx(['carregamento', 'carga', 'num carga'], 6);
      const idxPedido = findColIdx(['pedido', 'num pedido'], 7);
      const idxRca = findColIdx(['rca', 'vendedor'], 8);
      const idxCodProd = findColIdx(['cod do produto', 'cod produto', 'codigo do produto', 'codigo produto', 'cod prod', 'codigo prod', 'cod item', 'codigo item'], 9);
      const idxProd = findColIdx(['produto', 'desc produto', 'descricao produto', 'descricao do produto', 'desc prod', 'item'], 10);
      const idxQtd = findColIdx(['quantidade de caixas', 'qtd caixas', 'qtd'], 11);
      const idxPeso = findColIdx(['peso kg', 'peso'], 12);
      const idxNota = findColIdx(['n nota fiscal', 'num nota fiscal', 'numero nota fiscal', 'n nota', 'nota fiscal', 'nf'], 13);
      const idxData = findColIdx(['data saida', 'data de saida', 'data de entrega', 'data entrega', 'data'], 14);
      const idxValor = findColIdx(['valor produto', 'valor', 'vlr total'], 15);

      const cleanVal = (val) => {
        if (val === undefined || val === null) return '';
        return String(val).trim();
      };

      const groupedData = {};

      for (let r = 1; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!row || row.length === 0) continue;

        const rawNota = row[idxNota];
        let strNota = cleanVal(rawNota);
        if (!strNota || strNota === '0' || strNota.toLowerCase().startsWith('col_')) continue;

        if (!groupedData[strNota]) {
          const strData = parseDataExcel(row[idxData]);

          groupedData[strNota] = {
            nota: strNota,
            pedido: cleanVal(row[idxPedido]),
            codCliente: cleanVal(row[idxCodCli]),
            cliente: cleanVal(row[idxCliente]) || 'CLIENTE NÃO IDENTIFICADO',
            cidade: cleanVal(row[idxCidade]),
            municipio: cleanVal(row[idxCidade]),
            bairro: cleanVal(row[idxBairro]),
            rota: cleanVal(row[idxRota]),
            placa: cleanVal(row[idxPlaca]).toUpperCase(),
            placaOriginal: cleanVal(row[idxPlaca]).toUpperCase(),
            carga: cleanVal(row[idxCarga]),
            data: strData,
            dataFaturamento: strData,
            rca: normalizarRCA(cleanVal(row[idxRca])),
            peso: 0,
            valor: 0,
            itens: []
          };
        }

        const codigoItem = cleanVal(row[idxCodProd]);
        const descItem = cleanVal(row[idxProd]);
        const qtdItem = parseNum(row[idxQtd]) || 1;
        const pesoItem = parseNum(row[idxPeso]);
        const valorItem = parseNum(row[idxValor]);

        if (descItem && descItem !== '') {
          groupedData[strNota].itens.push({
            codigo: codigoItem,
            descricao: descItem,
            qtd: qtdItem,
            peso: pesoItem,
            valor: valorItem
          });
          groupedData[strNota].peso = Number((groupedData[strNota].peso + pesoItem).toFixed(2));
          groupedData[strNota].valor = Number((groupedData[strNota].valor + valorItem).toFixed(2));
        }
      }

      const novasEntregas = Object.values(groupedData);
      if (novasEntregas.length === 0) {
        throw new Error("Nenhuma nota fiscal válida encontrada no arquivo 8132.");
      }

      // Estatísticas de conciliação
      let reconciliadasCount = 0;
      let novasCount = 0;
      let atualizadasCount = 0;

      novasEntregas.forEach(nova => {
        const match = entregas.find(e => 
          (e.nota && nova.nota && String(e.nota).trim() === String(nova.nota).trim()) ||
          (e.pedido && nova.pedido && String(e.pedido).trim() === String(nova.pedido).trim())
        );

        if (match) {
          if (match.isPrevia) {
            reconciliadasCount++;
          } else {
            atualizadasCount++;
          }
        } else {
          novasCount++;
        }
      });

      await importarEntregas(novasEntregas);

      const totalLinhasArquivo = rawRows.length - 1;
      const totalCargasDistintas = new Set(novasEntregas.map(e => e.carga).filter(Boolean)).size;
      const dataFaturamento = novasEntregas[0]?.data || null;

      // Sincroniza automaticamente a data do monitoramento para que as notas fiquem imediatamente visíveis
      if (dataFaturamento && setGlobalFilters) {
        setGlobalFilters({
          data: dataFaturamento,
          visaoMonitoramento: {
            ...globalFilters?.visaoMonitoramento,
            datas: [dataFaturamento],
            placas: []
          }
        });
      }

      setResult8132({
        total: novasEntregas.length,
        totalLinhas: totalLinhasArquivo,
        totalCargas: totalCargasDistintas,
        reconciliadas: reconciliadasCount,
        novas: novasCount,
        atualizadas: atualizadasCount,
        data: dataFaturamento
      });
      setFile8132(null);

    } catch (err) {
      console.error(err);
      alert(err.message || "Erro ao processar o arquivo 8132.");
    } finally {
      setLoading8132(false);
    }
  };

  // -------------------------------------------------------------
  // 3. FLUXO DE ATUALIZAÇÃO EM LOTE DE STATUS / CARGAS (PLANILHA)
  // -------------------------------------------------------------
  const normalizarStatusPlanilha = (statusRaw) => {
    if (!statusRaw) return 'Pendente';
    const s = String(statusRaw).trim().toLowerCase();
    
    if (s.includes('entrega total') || s === 'entregue' || s === 'total') return 'Entrega total';
    if (s.includes('entrega parcial') || s === 'parcial') return 'Entrega parcial';
    if (s.includes('no cliente') || s === 'cliente') return 'No cliente';
    if (s.includes('descarregando') || s === 'descarga') return 'Descarregando';
    if (s.includes('carga parada') || s === 'parado' || s === 'parada') return 'Carga parada';
    if (s.includes('reentrega') || s.includes('re-entrega')) return 'Reentrega';
    if (s.includes('devolucao total') || s.includes('devolução total') || s === 'devolvido') return 'Devolução total';
    if (s.includes('pendente')) return 'Pendente';

    // Se bater com alguma das STATUS_OPTIONS
    const found = STATUS_OPTIONS.find(opt => opt.toLowerCase() === s);
    if (found) return found;

    return 'Pendente';
  };

  const processarArquivoAtualizacao = async (file) => {
    if (!file) return;
    setLoadingAtualizacao(true);
    setResultAtualizacao(null);
    setDadosAtualizacaoCalculados(null);

    try {
      const data = await file.arrayBuffer();
      // Usar raw: true para que números com vírgula (ex: "19,36") venham como string e não virem 1936
      const wb = XLSX.read(data, { type: 'array', raw: true });
      const firstSheetName = wb.SheetNames[0];
      const ws = wb.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });

      if (!rawRows || rawRows.length < 2) {
        throw new Error("Arquivo vazio ou sem linhas de dados para processar.");
      }

      const headers = rawRows[0] || [];
      const headerMap = {};
      headers.forEach((h, idx) => {
        if (h !== undefined && h !== null) {
          headerMap[normalizeStr(h)] = idx;
        }
      });

      const findColIdx = (possibleNames, fallbackIdx) => {
        for (const name of possibleNames) {
          const normName = normalizeStr(name);
          for (const [hNorm, idx] of Object.entries(headerMap)) {
            if (hNorm === normName) return idx;
          }
        }
        for (const name of possibleNames) {
          const normName = normalizeStr(name);
          if (normName.length < 3) continue;
          for (const [hNorm, idx] of Object.entries(headerMap)) {
            if (hNorm.includes(normName)) return idx;
          }
        }
        return fallbackIdx;
      };

      const idxNota = findColIdx(['n nota fiscal', 'num nota fiscal', 'numero nota fiscal', 'n nota', 'nota fiscal', 'n nf', 'nf'], 0);
      const idxData = findColIdx(['data saida', 'data de saida', 'data entrega', 'data'], 1);
      const idxCodCli = findColIdx(['codcli', 'cod cliente', 'codigo cliente', 'cod client'], 2);
      const idxCliente = findColIdx(['cliente', 'nome cliente', 'razao social'], 3);
      const idxCidade = findColIdx(['municipio', 'municent', 'cidade'], 4);
      const idxBairro = findColIdx(['bairro', 'bairroent'], 5);
      const idxPlaca = findColIdx(['placa', 'veiculo'], 6);
      const idxPeso = findColIdx(['peso kg', 'peso'], 7);
      const idxValor = findColIdx(['valor r', 'valor produto', 'valor', 'vlr total'], 8);
      const idxStatus = findColIdx(['status', 'situacao', 'estado'], 9);

      const cleanVal = (val) => {
        if (val === undefined || val === null) return '';
        return String(val).trim();
      };

      const linhasProcessadas = [];
      const statsStatus = {};
      let totalExistentes = 0;
      let totalNovas = 0;

      for (let r = 1; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!row || row.length === 0) continue;

        let strNota = cleanVal(row[idxNota]);
        if (!strNota || strNota === '0' || strNota.toLowerCase().startsWith('col_')) continue;

        const rawStatus = cleanVal(row[idxStatus]);
        const statusNormalizado = normalizarStatusPlanilha(rawStatus);

        const strData = parseDataExcel(row[idxData]);
        const strPlaca = cleanVal(row[idxPlaca]).toUpperCase();
        const numPeso = parseNum(row[idxPeso]);
        const numValor = parseNum(row[idxValor]);
        const codCli = cleanVal(row[idxCodCli]);
        const nomeCliente = cleanVal(row[idxCliente]);
        const cidade = cleanVal(row[idxCidade]);
        const bairro = cleanVal(row[idxBairro]);

        const existente = entregas.find(e => String(e.nota || '').trim() === strNota);
        if (existente) {
          totalExistentes++;
        } else {
          totalNovas++;
        }

        statsStatus[statusNormalizado] = (statsStatus[statusNormalizado] || 0) + 1;

        linhasProcessadas.push({
          nota: strNota,
          data: strData,
          codCliente: codCli,
          cliente: nomeCliente || 'CLIENTE NÃO IDENTIFICADO',
          municipio: cidade,
          cidade: cidade,
          bairro: bairro,
          placa: strPlaca,
          peso: numPeso,
          valor: numValor,
          status: statusNormalizado,
          statusOriginal: rawStatus,
          existeNoSistema: !!existente,
          statusAtualSistema: existente ? existente.status : null,
          placaAtualSistema: existente ? existente.placa : null
        });
      }

      if (linhasProcessadas.length === 0) {
        throw new Error("Nenhuma linha com Nota Fiscal válida encontrada no arquivo.");
      }

      setDadosAtualizacaoCalculados({
        totalLinhas: linhasProcessadas.length,
        totalExistentes,
        totalNovas,
        statsStatus,
        linhas: linhasProcessadas
      });
    } catch (err) {
      console.error("Erro ao analisar arquivo de atualização:", err);
      alert("Erro ao ler o arquivo: " + (err.message || err));
    } finally {
      setLoadingAtualizacao(false);
    }
  };

  const aplicarAtualizacaoPlanilha = async () => {
    if (!dadosAtualizacaoCalculados || !dadosAtualizacaoCalculados.linhas.length) return;
    setLoadingAtualizacao(true);

    try {
      await atualizarEntregasPorPlanilha(
        dadosAtualizacaoCalculados.linhas,
        opcoesAtualizacao
      );

      // Sincroniza a data global caso haja entregas
      const dataArquivo = dadosAtualizacaoCalculados.linhas[0]?.data;
      if (dataArquivo && setGlobalFilters) {
        setGlobalFilters({
          data: dataArquivo,
          visaoMonitoramento: {
            ...globalFilters?.visaoMonitoramento,
            datas: [dataArquivo],
            placas: []
          }
        });
      }

      setResultAtualizacao({
        sucesso: true,
        total: dadosAtualizacaoCalculados.totalLinhas,
        atualizadas: dadosAtualizacaoCalculados.totalExistentes,
        novas: opcoesAtualizacao.cadastrarNovas ? dadosAtualizacaoCalculados.totalNovas : 0,
        statsStatus: dadosAtualizacaoCalculados.statsStatus,
        data: dataArquivo
      });
      setFileAtualizacao(null);
      setDadosAtualizacaoCalculados(null);
    } catch (err) {
      console.error("Erro ao aplicar atualização:", err);
      alert("Falha ao salvar atualizações: " + (err.message || err));
    } finally {
      setLoadingAtualizacao(false);
    }
  };

  const handleBaixarModeloAtualizacao = () => {
    const wsData = [
      ["N° NF", "Data Saída", "CODCLI", "Cliente", "Município", "Bairro", "Placa", "Peso (kg)", "Valor (R$)", "Status"],
      ["600005", "25/10/2026", "125", "M DIAS BRANCO S A", "Salvador", "Sao Tome de Paripe", "OUN2490", 500.0, 7845.0, "entrega total"],
      ["600006", "25/10/2026", "10113", "COSTA WENSE ALIMENTOS", "Salvador", "Periperi", "OUN2490", 99.936, 528.66, "entrega total"],
      ["600007", "25/10/2026", "10578", "ATAKAREJO DISTRIBUIDOR", "Salvador", "Periperi", "OUN2490", 516.011, 11748.0, "no cliente"],
      ["600011", "25/10/2026", "8664", "CANELA & CIA RESTAURANTE", "Salvador", "Canela", "PJG9J02", 80.0, 1431.2, "pendente"],
      ["600021", "25/10/2026", "14347", "ATAKAREJO DISTRIBUIDOR", "FEIRA DE SANTANA", "MANGABEIRA", "TMW6G80", 423.245, 20148.53, "reentrega"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rotas_e_Cargas");
    XLSX.writeFile(wb, "modelo_atualizacao_rotas_e_cargas.xlsx");
  };

  // -------------------------------------------------------------
  // Downloads de Modelos
  // -------------------------------------------------------------
  const handleBaixarModelo8132 = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        'CODCLI': 14329,
        'CLIENTE': 'BAR DO NEI LTDA.',
        'MUNICENT': 'SALVADOR',
        'BAIRROENT': 'PITUBA',
        'ROTA ENTREGA': 'ROTA 10',
        'PLACA': 'OKT9410',
        'CARREGAMENTO': 5005413,
        'PEDIDO': 6049008707,
        'RCA': 'RAQUEL GOMES DOS SANTOS',
        'CÓD. DO PRODUTO': 4105,
        'PRODUTO': 'CUPIM GRILL CONG PLENA',
        'QUANTIDADE DE CAIXAS': 1,
        'PESO (KG)': 26.67,
        'N° NOTA FISCAL': 90374,
        'DATA SAÍDA': new Date().toLocaleDateString('pt-BR'),
        'VALOR PRODUTO': 1586.60
      }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "8132");
    XLSX.writeFile(wb, "Modelo_Importacao_8132.xlsx");
  };

  const handleBaixarModeloProgramacao = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        'DATA EXPEDIÇÃO': new Date().toLocaleDateString('pt-BR'),
        'CARGA ERP': 5006082,
        'ENTREGAS': 9,
        'PEDIDOS': 9,
        'PESO (KG)': 1495.81,
        'DESTINO': 'SDR-CABULA/REGIAO',
        'VEICULO': 'OZG5083',
        'TIPO': 'BONGO',
        'TRANSPORTADORA': 'PM TRANSPORTES',
        'PREVISÃO FATURAMENTO': 19810.60,
        'KM ESTIMADO': 33.36
      }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Programacao");
    XLSX.writeFile(wb, "Modelo_Programacao_Veiculos.xlsx");
  };

  // Histórico de Datas
  const datasImportadas = useMemo(() => {
    const stats = {};
    entregas.forEach(e => {
      if (e.data) {
        if (!stats[e.data]) stats[e.data] = { total: 0, previa: 0, faturado: 0 };
        stats[e.data].total++;
        if (e.isPrevia) stats[e.data].previa++;
        else stats[e.data].faturado++;
      }
    });
    return Object.keys(stats).sort((a,b) => b.localeCompare(a)).map(data => ({
      data,
      ...stats[data]
    }));
  }, [entregas]);

  const handleExcluirData = () => {
    if (senhaExclusao === '@rj2026') {
      removerEntregasPorData(dataParaExcluir);
      setDataParaExcluir(null);
      setSenhaExclusao('');
      setErroSenha('');
    } else {
      setErroSenha('Senha incorreta.');
    }
  };

  const handleLimparTodas = async () => {
    if (senhaLimpezaGeral === '@rj2026') {
      try {
        setLimpandoGeral(true);
        await limparTodasEntregas();
        setModalLimpezaGeral(false);
        setSenhaLimpezaGeral('');
        setErroSenhaGeral('');
        alert('Todas as entregas foram limpas com sucesso! Os cadastros de geolocalização dos clientes foram preservados.');
      } catch (err) {
        console.error(err);
        setErroSenhaGeral('Erro ao limpar dados no servidor.');
      } finally {
        setLimpandoGeral(false);
      }
    } else {
      setErroSenhaGeral('Senha incorreta.');
    }
  };

  const handleExportarBackup = () => {
    const backupData = {
      timestamp: new Date().toISOString(),
      entregas,
      devolucoes
    };
    const blob = new Blob([JSON.stringify(backupData)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LogisTrack_Backup_${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).replace(/\//g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportarBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setRestaurando(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backupData = JSON.parse(event.target.result);
        if (!backupData.entregas && !backupData.devolucoes) {
          throw new Error('Arquivo de backup inválido.');
        }
        await restaurarBackup(backupData);
        alert('Backup restaurado com sucesso! Os dados foram mesclados na nuvem.');
      } catch (err) {
        console.error(err);
        alert('Erro ao restaurar backup: ' + err.message);
      } finally {
        setRestaurando(false);
        if (backupInputRef.current) backupInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 w-full pb-20">
      {/* 1. Header Principal com Seletor de Abas */}
      <div className="bg-background-secondary p-5 sm:p-6 rounded-2xl border border-border-secondary shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-info/15 text-info flex items-center justify-center border border-info/30 shrink-0">
              <UploadCloud size={24} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-text-primary tracking-tight">
                Central de Importação
              </h1>
              <p className="text-xs sm:text-sm text-text-secondary">
                Gerencie o ciclo completo: carregue a <strong>Prévia de Cargas</strong> na véspera e o <strong>Faturamento Oficial</strong> pela manhã.
              </p>
            </div>
          </div>

          {/* Modelos de Download */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleBaixarModeloProgramacao}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-background-primary hover:bg-background-tertiary text-text-secondary hover:text-text-primary border border-border-secondary transition-all cursor-pointer"
              title="Baixar modelo da Planilha de Programação de Veículos"
            >
              <DownloadCloud size={14} className="text-amber-500" />
              <span>Modelo Programação (.xlsx)</span>
            </button>
            <button
              onClick={handleBaixarModelo8132}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-background-primary hover:bg-background-tertiary text-text-secondary hover:text-text-primary border border-border-secondary transition-all cursor-pointer"
              title="Baixar modelo do Arquivo 8132 Faturado"
            >
              <DownloadCloud size={14} className="text-info" />
              <span>Modelo 8132 (.xlsx)</span>
            </button>
            <button
              onClick={handleBaixarModeloAtualizacao}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-background-primary hover:bg-background-tertiary text-text-secondary hover:text-text-primary border border-border-secondary transition-all cursor-pointer"
              title="Baixar modelo de Atualização de Rotas & Cargas"
            >
              <DownloadCloud size={14} className="text-emerald-500" />
              <span>Modelo Rotas & Cargas (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Chaves de Abas */}
        <div className="flex flex-wrap items-center gap-2 p-1 bg-background-primary rounded-xl border border-border-secondary max-w-3xl">
          <button
            onClick={() => setAbaAtiva('previa')}
            className={`flex-1 min-w-[160px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              abaAtiva === 'previa'
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Clock size={16} />
            <span>1. Prévia de Cargas (8164)</span>
            <span className="hidden sm:inline-block px-1.5 py-0.2 bg-white/20 rounded text-[10px] font-mono uppercase">D-1</span>
          </button>

          <button
            onClick={() => setAbaAtiva('faturamento')}
            className={`flex-1 min-w-[160px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              abaAtiva === 'faturamento'
                ? 'bg-info text-white shadow-md shadow-info/20'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <CheckCircle2 size={16} />
            <span>2. Faturamento (8132)</span>
            <span className="hidden sm:inline-block px-1.5 py-0.2 bg-white/20 rounded text-[10px] font-mono uppercase">Oficial</span>
          </button>

          <button
            onClick={() => setAbaAtiva('atualizacao')}
            className={`flex-1 min-w-[160px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              abaAtiva === 'atualizacao'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <RefreshCw size={16} />
            <span>3. Atualização de Cargas & Status</span>
            <span className="hidden sm:inline-block px-1.5 py-0.2 bg-white/20 rounded text-[10px] font-mono uppercase">Lote</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* ABA 1: PRÉVIA DE CARGAS (8164 + PROGRAMAÇÃO) */}
      {/* ------------------------------------------------------------- */}
      {abaAtiva === 'previa' && (
        <div className="space-y-6 animate-fade-in">
          {/* Card explicativo */}
          <div className="bg-amber-500/10 border border-amber-500/25 p-4 rounded-2xl flex items-start gap-3.5">
            <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm text-text-secondary leading-relaxed">
              <span className="font-bold text-amber-600 dark:text-amber-400 block mb-0.5">
                Liberação Antecipada para Motoristas e Ajudantes
              </span>
              Suba o relatório <strong>8164 (pedidos roteirizados)</strong> e a <strong>Programação (placas e KM previsto)</strong>. 
              O sistema cruza o número da carga, vincula os pedidos aos caminhões e alimenta o KM Estimado. 
              Os motoristas poderão visualizar a rota e os clientes no app logo cedo, garantindo que façam o check-in normalmente.
            </div>
          </div>

          {/* Áreas de Upload Duplo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bloco 1: Arquivo 8164 */}
            <div className={`p-6 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center relative group ${
              file8164 ? 'border-amber-500 bg-amber-500/5' : 'border-border-secondary hover:border-amber-500 bg-background-secondary'
            }`}>
              <input
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    const tipo = await inspecionarTipoArquivo(f);
                    if (tipo === 'prog') {
                      setFileProg(f);
                      processarArquivosPrevia(file8164, f);
                    } else {
                      setFile8164(f);
                      processarArquivosPrevia(f, fileProg);
                    }
                  }
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center mb-3">
                <FileSpreadsheet size={24} />
              </div>
              <h4 className="text-sm font-bold text-text-primary">
                1. Arquivo 8164 (Pedidos Roteirizados)
              </h4>
              <p className="text-xs text-text-secondary mt-1 max-w-xs">
                Arraste ou clique para selecionar o arquivo <code>8164.csv</code> ou <code>.xlsx</code> gerado no ERP.
              </p>
              {file8164 && (
                <div className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background-primary border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-mono font-bold">
                  <Check size={14} />
                  <span className="truncate max-w-[200px]">{file8164.name}</span>
                  <span className="text-[10px] text-text-tertiary">({(file8164.size / 1024).toFixed(1)} KB)</span>
                </div>
              )}
            </div>

            {/* Bloco 2: Planilha de Programação */}
            <div className={`p-6 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center relative group ${
              fileProg ? 'border-amber-500 bg-amber-500/5' : 'border-border-secondary hover:border-amber-500 bg-background-secondary'
            }`}>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    const tipo = await inspecionarTipoArquivo(f);
                    if (tipo === '8164') {
                      setFile8164(f);
                      processarArquivosPrevia(f, fileProg);
                    } else {
                      setFileProg(f);
                      processarArquivosPrevia(file8164, f);
                    }
                  }
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center mb-3">
                <Truck size={24} />
              </div>
              <h4 className="text-sm font-bold text-text-primary">
                2. Planilha de Programação (Placas & KM)
              </h4>
              <p className="text-xs text-text-secondary mt-1 max-w-xs">
                Arraste ou clique para selecionar <code>programacao.xlsx</code> com a escala de veículos e KM estimado.
              </p>
              {fileProg && (
                <div className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background-primary border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-mono font-bold">
                  <Check size={14} />
                  <span className="truncate max-w-[200px]">{fileProg.name}</span>
                  <span className="text-[10px] text-text-tertiary">({(fileProg.size / 1024).toFixed(1)} KB)</span>
                </div>
              )}
            </div>
          </div>

          {/* Painel de Validação e Cruzamento */}
          {loadingPrevia && (
            <div className="p-8 text-center flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              <p className="text-sm font-bold text-text-primary">Cruzando dados do 8164 com a Programação...</p>
            </div>
          )}

          {dadosPreviaCalculados && !loadingPrevia && (
            <div className="space-y-4 bg-background-secondary p-5 sm:p-6 rounded-2xl border border-border-secondary shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-text-primary flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-amber-500" />
                    Resumo da Prévia Calculada
                  </h3>
                  <p className="text-xs text-text-secondary">
                    Revise os números antes de liberar os dados no aplicativo dos motoristas.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setFile8164(null);
                      setFileProg(null);
                      setDadosPreviaCalculados(null);
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-text-secondary hover:text-text-primary bg-background-primary border border-border-secondary transition-all cursor-pointer"
                  >
                    Limpar
                  </button>
                  <button
                    onClick={handleConfirmarPrevia}
                    disabled={loadingPrevia || dadosPreviaCalculados.totalPedidos === 0}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/25 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Check size={16} />
                    <span>Confirmar e Liberar Prévia</span>
                  </button>
                </div>
              </div>

              {/* Indicadores do Cruzamento */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-background-primary p-3.5 rounded-xl border border-border-secondary">
                  <span className="text-[10px] font-bold text-text-tertiary uppercase block">Total Cargas</span>
                  <span className="text-xl font-black font-mono text-text-primary block mt-0.5">
                    {dadosPreviaCalculados.totalCargas}
                  </span>
                </div>
                <div className="bg-background-primary p-3.5 rounded-xl border border-border-secondary">
                  <span className="text-[10px] font-bold text-text-tertiary uppercase block">Com Veículo</span>
                  <span className="text-xl font-black font-mono text-success block mt-0.5">
                    {cargasComPlacaPrevia.length} / {dadosPreviaCalculados.totalCargas}
                  </span>
                </div>
                <div className={`p-3.5 rounded-xl border transition-colors ${
                  cargasSemPlacaPrevia.length > 0 
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400' 
                    : 'bg-background-primary border-border-secondary text-text-secondary'
                }`}>
                  <span className="text-[10px] font-bold uppercase block">Sem Placa</span>
                  <span className="text-xl font-black font-mono block mt-0.5">
                    {cargasSemPlacaPrevia.length}
                  </span>
                </div>
                <div className="bg-background-primary p-3.5 rounded-xl border border-border-secondary">
                  <span className="text-[10px] font-bold text-text-tertiary uppercase block">Total Pedidos</span>
                  <span className="text-xl font-black font-mono text-text-primary block mt-0.5">
                    {dadosPreviaCalculados.totalPedidos}
                  </span>
                </div>
                <div className="bg-background-primary p-3.5 rounded-xl border border-border-secondary col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold text-text-tertiary uppercase block">KM Estimado</span>
                  <span className="text-xl font-black font-mono text-info block mt-0.5">
                    {dadosPreviaCalculados.totalKmEstimado.toFixed(1)} km
                  </span>
                </div>
              </div>

              {/* SEÇÃO 1: CARGAS E PEDIDOS SEM PLACA NA PRÉVIA */}
              {cargasSemPlacaPrevia.length > 0 && (
                <div className="bg-amber-500/10 border-2 border-amber-500/35 rounded-2xl p-4 sm:p-5 space-y-4 animate-fade-in shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/30">
                        <AlertTriangle size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm sm:text-base font-black text-amber-600 dark:text-amber-400 flex items-center gap-2">
                          <span>Cargas e Pedidos Sem Placa ({cargasSemPlacaPrevia.length} cargas, {cargasSemPlacaPrevia.reduce((acc, c) => acc + c.pedidosCount, 0)} pedidos)</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-mono uppercase tracking-wide">Ação Necessária</span>
                        </h4>
                        <p className="text-xs text-text-secondary mt-0.5">
                          Estas cargas ou pedidos não possuem veículo na programação. Atribua uma placa para liberá-los ou exclua os pedidos que não serão expedidos.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {cargasSemPlacaPrevia.map(c => {
                      const isExp = !!cargasExpandidasPrevia[c.carga];
                      const pedidosDaCarga = (dadosPreviaCalculados.entregasPrevia || [])
                        .filter(e => String(e.carga).trim() === String(c.carga).trim())
                        .sort((a, b) => (Number(String(a.pedido || a.nota || '').replace(/\D+/g, '')) || 0) - (Number(String(b.pedido || b.nota || '').replace(/\D+/g, '')) || 0));
                      const isCargaAvulsa = c.carga === '0' || c.carga === 'Sem Carga';

                      return (
                        <div key={c.carga} className="bg-background-primary border border-amber-500/30 rounded-xl p-3.5 sm:p-4 space-y-3 shadow-xs">
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                            <div className="flex items-start sm:items-center gap-3">
                              <span className="px-2 py-1 rounded-lg text-xs font-mono font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0">
                                {isCargaAvulsa ? 'CARGA 0 (PEDIDOS AVULSOS)' : `CARGA ${c.carga}`}
                              </span>
                              <div>
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  <span className="font-bold text-text-primary">{c.pedidosCount} pedidos</span>
                                  <span className="text-text-tertiary">•</span>
                                  <span className="font-mono text-text-secondary">{c.pesoTotal.toFixed(1)} kg</span>
                                  <span className="text-text-tertiary">•</span>
                                  <span className="font-mono font-bold text-success">
                                    {c.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                  </span>
                                  {c.rota && (
                                    <>
                                      <span className="text-text-tertiary">•</span>
                                      <span className="text-text-secondary truncate max-w-[200px]" title={c.rota}>Rota: {c.rota}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Controles de Placa e Exclusão */}
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="flex items-center gap-1.5 bg-background-secondary p-1 rounded-xl border border-border-secondary">
                                <input
                                  type="text"
                                  list="lista-placas"
                                  placeholder="Digitar Placa..."
                                  value={placasPrevia[c.carga] || ''}
                                  onChange={(e) => setPlacasPrevia(prev => ({ ...prev, [c.carga]: e.target.value.toUpperCase() }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAtribuirPlacaCargaPrevia(c.carga, placasPrevia[c.carga]);
                                  }}
                                  className="bg-background-primary border border-border-tertiary rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold uppercase w-32 sm:w-36 text-text-primary focus:outline-none focus:border-amber-500"
                                />
                                <button
                                  onClick={() => handleAtribuirPlacaCargaPrevia(c.carga, placasPrevia[c.carga])}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white transition-all cursor-pointer shadow-xs whitespace-nowrap"
                                  title="Atribuir esta placa a todos os pedidos desta carga"
                                >
                                  <Truck size={13} />
                                  <span>Atribuir Placa</span>
                                </button>
                              </div>

                              <button
                                onClick={() => toggleExpandirCargaPrevia(c.carga)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-text-secondary hover:text-text-primary bg-background-secondary hover:bg-background-tertiary border border-border-secondary transition-all cursor-pointer whitespace-nowrap"
                                title="Ver pedidos individuais"
                              >
                                <span>{isExp ? 'Ocultar' : 'Ver Pedidos'} ({c.pedidosCount})</span>
                                {isExp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>

                              <button
                                onClick={() => handleExcluirCargaPrevia(c.carga)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-danger hover:bg-danger/10 border border-danger/30 transition-all cursor-pointer whitespace-nowrap"
                                title="Excluir carga inteira da prévia"
                              >
                                <Trash2 size={14} />
                                <span>Excluir Carga</span>
                              </button>
                            </div>
                          </div>

                          {/* Lista detalhada de pedidos da carga */}
                          {isExp && (
                            <div className="pt-2 border-t border-border-tertiary animate-fade-in space-y-2">
                              <div className="overflow-x-auto rounded-lg border border-border-secondary max-h-[280px] overflow-y-auto">
                                <table className="w-full text-xs text-left">
                                  <thead className="bg-background-tertiary text-text-secondary uppercase font-mono text-[10px] sticky top-0 z-10">
                                    <tr>
                                      <th className="py-2 px-3">Pedido</th>
                                      <th className="py-2 px-3">Cliente</th>
                                      <th className="py-2 px-3">Bairro / Cidade</th>
                                      <th className="py-2 px-3 text-right">Peso</th>
                                      <th className="py-2 px-3 text-right">Valor</th>
                                      <th className="py-2 px-3 text-center">Atribuir Placa Individual</th>
                                      <th className="py-2 px-3 text-center">Ação</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border-tertiary bg-background-primary">
                                    {pedidosDaCarga.map(p => (
                                      <tr key={p.id} className="hover:bg-background-secondary/50 transition-colors">
                                        <td className="py-2 px-3 font-mono font-bold text-text-primary">{p.pedido}</td>
                                        <td className="py-2 px-3 text-text-primary font-medium truncate max-w-[180px]" title={p.cliente}>{p.cliente}</td>
                                        <td className="py-2 px-3 text-text-secondary truncate max-w-[150px]">{p.bairro} - {p.cidade}</td>
                                        <td className="py-2 px-3 text-right font-mono text-text-secondary">{p.peso.toFixed(1)} kg</td>
                                        <td className="py-2 px-3 text-right font-mono font-bold text-success">
                                          {p.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className="py-2 px-3 text-center">
                                          <div className="flex items-center justify-center gap-1">
                                            <input
                                              type="text"
                                              list="lista-placas"
                                              placeholder="Placa..."
                                              defaultValue={p.placa !== 'SEM PLACA' ? p.placa : ''}
                                              id={`input-prev-p-${p.id}`}
                                              className="bg-background-secondary border border-border-tertiary rounded px-2 py-0.5 text-xs font-mono font-bold uppercase w-24 text-text-primary focus:outline-none focus:border-amber-500"
                                            />
                                            <button
                                              onClick={() => {
                                                const el = document.getElementById(`input-prev-p-${p.id}`);
                                                if (el && el.value) handleAtribuirPlacaPedidoPrevia(p.id, el.value);
                                              }}
                                              className="p-1 rounded bg-amber-500/20 text-amber-600 hover:bg-amber-500 hover:text-white transition-colors cursor-pointer"
                                              title="Salvar placa para este pedido"
                                            >
                                              <Check size={12} />
                                            </button>
                                          </div>
                                        </td>
                                        <td className="py-2 px-3 text-center">
                                          <button
                                            onClick={() => handleExcluirPedidoPrevia(p.id)}
                                            className="p-1.5 rounded-lg text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                                            title="Excluir este pedido da prévia"
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SEÇÃO 2: CARGAS PRONTAS COM VEÍCULO */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-bold text-text-secondary uppercase tracking-wider flex items-center gap-2">
                    <Truck size={15} className="text-success" />
                    <span>Cargas com Veículo / Prontas para Liberação ({cargasComPlacaPrevia.length})</span>
                  </h4>
                  {cargasComPlacaPrevia.length > 0 && (
                    <span className="text-[11px] text-text-tertiary">
                      {cargasComPlacaPrevia.reduce((acc, c) => acc + c.pedidosCount, 0)} pedidos vinculados
                    </span>
                  )}
                </div>

                <div className="overflow-x-auto rounded-xl border border-border-secondary max-h-[360px] overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-background-tertiary text-text-secondary uppercase font-mono text-[10px] sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3">Carga ERP</th>
                        <th className="py-2.5 px-3">Veículo / Placa</th>
                        <th className="py-2.5 px-3">Tipo</th>
                        <th className="py-2.5 px-3 text-right">KM Estimado</th>
                        <th className="py-2.5 px-3 text-right">Pedidos</th>
                        <th className="py-2.5 px-3 text-right">Peso Total</th>
                        <th className="py-2.5 px-3">Destino / Rota</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-tertiary bg-background-primary">
                      {cargasComPlacaPrevia.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-6 text-center text-text-tertiary font-medium">
                            Nenhuma carga com veículo vinculado no momento. Atribua placas às cargas acima.
                          </td>
                        </tr>
                      ) : (
                        cargasComPlacaPrevia.map(c => (
                          <tr key={c.carga} className="hover:bg-background-secondary/60 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-bold text-text-primary">{c.carga}</td>
                            <td className="py-2.5 px-3 font-mono font-black text-amber-500">{c.placa}</td>
                            <td className="py-2.5 px-3 text-text-secondary">{c.tipoVeiculo}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-text-primary">
                              {c.kmEstimado > 0 ? `${c.kmEstimado.toFixed(1)} km` : '--'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-text-primary">{c.pedidosCount}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-text-secondary">{c.pesoTotal.toFixed(1)} kg</td>
                            <td className="py-2.5 px-3 text-text-secondary truncate max-w-[180px]" title={c.rota}>{c.rota || '--'}</td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-success/15 text-success">
                                Pronto
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                onClick={() => handleExcluirCargaPrevia(c.carga)}
                                className="p-1 rounded text-text-tertiary hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                                title="Remover esta carga da prévia"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Feedback de Sucesso da Prévia */}
          {resultPrevia && (
            <div className="bg-amber-500/10 border border-amber-500/30 p-5 rounded-2xl flex items-start gap-3.5 animate-fade-in">
              <CheckCircle2 className="text-amber-500 w-7 h-7 shrink-0 mt-0.5" />
              <div className="space-y-2 flex-1">
                <div>
                  <h4 className="text-base font-bold text-amber-600 dark:text-amber-400">
                    Prévia de Cargas Liberada com Sucesso!
                  </h4>
                  <p className="text-xs text-text-secondary leading-relaxed mt-1">
                    Foram disponibilizadas <strong>{resultPrevia.cargas} cargas</strong> e <strong>{resultPrevia.pedidos} pedidos</strong> com identificador provisório no aplicativo dos motoristas, além de <strong>{resultPrevia.kmTotal.toFixed(1)} km previstos</strong> registrados.
                  </p>
                  <p className="text-[11px] text-text-tertiary font-medium mt-1">
                    Quando o faturamento oficial for concluído pela manhã, basta subir o arquivo 8132 na aba ao lado para reconciliar as notas fiscais oficiais mantendo os check-ins que já tiverem sido feitos.
                  </p>
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => navigate('/programacao')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-all cursor-pointer"
                  >
                    <FileSpreadsheet size={15} />
                    <span>Ver Programação de Cargas</span>
                  </button>
                  <button
                    onClick={() => navigate('/')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-background-primary hover:bg-background-tertiary text-text-primary border border-border-secondary transition-all cursor-pointer"
                  >
                    <span>Ir para Entregas</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* ABA 2: FATURAMENTO OFICIAL (8132) */}
      {/* ------------------------------------------------------------- */}
      {abaAtiva === 'faturamento' && (
        <div className="space-y-6 animate-fade-in">
          {/* Card explicativo */}
          <div className="bg-info/10 border border-info/25 p-4 rounded-2xl flex items-start gap-3.5">
            <CheckCircle2 className="w-5 h-5 text-info shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm text-text-secondary leading-relaxed">
              <span className="font-bold text-info block mb-0.5">
                Reconciliação e Confirmação de Notas Fiscais Oficiais
              </span>
              Suba a planilha oficial do <strong>8132</strong>. O sistema atualizará as notas provisórias da prévia para os números de NF definitivos, associando os itens fiscais e caixas, <strong>sem reiniciar nenhum check-in ou status</strong> que os motoristas já tiverem registrado na rota.
            </div>
          </div>

          {/* Área de Dropzone 8132 */}
          <div className="glass-panel p-8 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-border-secondary text-center hover:border-info transition-colors relative overflow-hidden group">
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setFile8132(f);
                  setResult8132(null);
                }
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            
            <div className="bg-background-secondary p-4 rounded-full mb-3 group-hover:bg-info/10 transition-colors">
              <UploadCloud className="text-info w-8 h-8" />
            </div>
            
            <h3 className="text-lg font-bold text-text-primary mb-1">Arraste a planilha 8132 para cá</h3>
            <p className="text-sm text-text-secondary max-w-sm mb-4">
              Suporta arquivos .xlsx, .xls e .csv (relatório de rotas 8132 faturadas).
            </p>

            {file8132 ? (
              <div className="flex items-center gap-3 bg-background-primary px-4 py-2.5 rounded-xl border border-border-secondary shadow-sm relative z-20">
                <FileType className="text-success w-5 h-5" />
                <div className="text-left">
                  <p className="text-sm font-bold text-text-primary truncate max-w-[220px]">{file8132.name}</p>
                  <p className="text-xs text-text-tertiary">{(file8132.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
            ) : (
              <button className="bg-background-primary border border-border-secondary px-6 py-2 rounded-xl text-sm font-semibold text-text-primary shadow-sm pointer-events-none group-hover:border-info group-hover:text-info transition-colors">
                Selecionar Arquivo 8132
              </button>
            )}
          </div>

          {file8132 && (
            <div className="flex justify-end">
              <button 
                onClick={processarArquivo8132}
                disabled={loading8132}
                className="bg-info hover:bg-info/90 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-md shadow-info/20"
              >
                {loading8132 ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Processando e Reconciliando...</>
                ) : (
                  <><CheckCircle2 className="w-5 h-5" /> Importar Faturamento 8132</>
                )}
              </button>
            </div>
          )}

          {/* Resumo da Importação 8132 */}
          {result8132 && (
            <div className="bg-success/10 border border-success/20 p-6 rounded-2xl flex items-start gap-4 animate-fade-in">
              <CheckCircle2 className="text-success w-8 h-8 flex-shrink-0" />
              <div className="w-full space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-success text-lg">Faturamento 8132 Processado com Sucesso!</h3>
                    <p className="text-xs sm:text-sm text-success/80">
                      A base de dados foi atualizada com as notas fiscais oficiais e os produtos correspondentes.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/')}
                    className="self-start sm:self-auto px-4 py-2 bg-success hover:bg-success/90 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <span>Ver no Monitoramento</span>
                    <ArrowRight size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  <div className="bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-success/15">
                    <p className="text-[11px] text-success/70 font-semibold uppercase tracking-wider mb-0.5">Linhas / Itens</p>
                    <p className="text-2xl font-black text-success">{result8132.totalLinhas || result8132.total}</p>
                    <span className="text-[10px] text-text-tertiary">Produtos no arquivo</span>
                  </div>
                  <div className="bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-success/15">
                    <p className="text-[11px] text-success/70 font-semibold uppercase tracking-wider mb-0.5">Notas Únicas</p>
                    <p className="text-2xl font-black text-success">{result8132.total}</p>
                    <span className="text-[10px] text-text-tertiary">Agrupadas por NF</span>
                  </div>
                  <div className="bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-success/15">
                    <p className="text-[11px] text-success/70 font-semibold uppercase tracking-wider mb-0.5">Cargas / Rotas</p>
                    <p className="text-2xl font-black text-success">{result8132.totalCargas || '-'}</p>
                    <span className="text-[10px] text-text-tertiary">Carregamentos</span>
                  </div>
                  <div className="bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-success/15">
                    <p className="text-[11px] text-success/70 font-semibold uppercase tracking-wider mb-0.5">Prévias Reconciliadas</p>
                    <p className="text-2xl font-black text-success">{result8132.reconciliadas}</p>
                    <span className="text-[10px] text-text-tertiary">Check-ins mantidos</span>
                  </div>
                  <div className="bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-success/15">
                    <p className="text-[11px] text-success/70 font-semibold uppercase tracking-wider mb-0.5">Novas Inseridas</p>
                    <p className="text-2xl font-black text-success">{result8132.novas}</p>
                    <span className="text-[10px] text-text-tertiary">Notas novas do dia</span>
                  </div>
                </div>

                <div className="bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-800 dark:text-emerald-300">
                  <p className="font-semibold flex items-center gap-1.5">
                    <span>💡 Como funciona o agrupamento de itens no LogisTrack:</span>
                  </p>
                  <p className="mt-1 leading-relaxed opacity-90">
                    O relatório 8132 exporta uma linha para cada produto faturado. O sistema agrupou com sucesso todas as <strong>{result8132.totalLinhas} linhas de produtos</strong> nas <strong>{result8132.total} Notas Fiscais</strong> correspondentes. Cada nota mantém internamente o detalhamento completo dos seus itens, quantidades, peso e valor.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2.5 CARGAS E PEDIDOS SEM PLACA NA BASE ATIVA (SE HOUVER) */}
      {cargasSemPlacaAtivas.length > 0 && (
        <div className="border border-amber-500/40 bg-amber-500/5 rounded-2xl overflow-hidden p-5 sm:p-6 space-y-4 animate-fade-in shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/30">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-amber-600 dark:text-amber-400 flex items-center gap-2">
                  <span>Cargas e Pedidos Sem Placa no Sistema Ativo ({cargasSemPlacaAtivas.length} cargas, {entregasSemPlacaAtivas.length} pedidos)</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-mono uppercase">Atenção</span>
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Estes pedidos já estão gravados no banco de dados, mas estão sem veículo atribuído. Atribua uma placa para que os motoristas possam visualizá-los ou exclua do sistema.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {cargasSemPlacaAtivas.map(c => {
              const isExp = !!cargasExpandidasAtivas[c.carga];
              const isCargaAvulsa = c.carga === '0' || c.carga === 'Sem Carga';

              return (
                <div key={`${c.data}_${c.carga}`} className="bg-background-primary border border-border-secondary rounded-xl p-3.5 sm:p-4 space-y-3 shadow-xs">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-3">
                      <span className="px-2 py-1 rounded-lg text-xs font-mono font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0">
                        {isCargaAvulsa ? 'CARGA 0 (PEDIDOS AVULSOS)' : `CARGA ${c.carga}`}
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-bold text-text-primary">{c.pedidosCount} pedidos</span>
                          <span className="text-text-tertiary">•</span>
                          <span className="font-mono text-text-secondary">{c.pesoTotal.toFixed(1)} kg</span>
                          <span className="text-text-tertiary">•</span>
                          <span className="font-mono font-bold text-success">
                            {c.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                          <span className="text-text-tertiary">•</span>
                          <span className="text-text-secondary">Data: {new Date(c.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
                          {c.rota && (
                            <>
                              <span className="text-text-tertiary">•</span>
                              <span className="text-text-secondary truncate max-w-[200px]" title={c.rota}>Rota: {c.rota}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Controles de Placa e Exclusão na Base Ativa */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5 bg-background-secondary p-1 rounded-xl border border-border-secondary">
                        <input
                          type="text"
                          list="lista-placas"
                          placeholder="Digitar Placa..."
                          value={placasAtivas[c.carga] || ''}
                          onChange={(e) => setPlacasAtivas(prev => ({ ...prev, [c.carga]: e.target.value.toUpperCase() }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAtribuirPlacaCargaAtiva(c.carga, placasAtivas[c.carga], c.data);
                          }}
                          className="bg-background-primary border border-border-tertiary rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold uppercase w-32 sm:w-36 text-text-primary focus:outline-none focus:border-amber-500"
                        />
                        <button
                          onClick={() => handleAtribuirPlacaCargaAtiva(c.carga, placasAtivas[c.carga], c.data)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white transition-all cursor-pointer shadow-xs whitespace-nowrap"
                          title="Atribuir esta placa a todos os pedidos desta carga na base"
                        >
                          <Truck size={13} />
                          <span>Atribuir Placa</span>
                        </button>
                      </div>

                      <button
                        onClick={() => toggleExpandirCargaAtiva(c.carga)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-text-secondary hover:text-text-primary bg-background-secondary hover:bg-background-tertiary border border-border-secondary transition-all cursor-pointer whitespace-nowrap"
                        title="Ver pedidos individuais"
                      >
                        <span>{isExp ? 'Ocultar' : 'Ver Pedidos'} ({c.pedidosCount})</span>
                        {isExp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>

                      <button
                        onClick={() => handleExcluirCargaAtiva(c.carga, c.data)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-danger hover:bg-danger/10 border border-danger/30 transition-all cursor-pointer whitespace-nowrap"
                        title="Excluir carga inteira do sistema"
                      >
                        <Trash2 size={14} />
                        <span>Excluir Carga</span>
                      </button>
                    </div>
                  </div>

                  {/* Listagem expandida de pedidos ativos */}
                  {isExp && (
                    <div className="pt-2 border-t border-border-tertiary animate-fade-in space-y-2">
                      <div className="overflow-x-auto rounded-lg border border-border-secondary max-h-[280px] overflow-y-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-background-tertiary text-text-secondary uppercase font-mono text-[10px] sticky top-0 z-10">
                            <tr>
                              <th className="py-2 px-3">Pedido / Nota</th>
                              <th className="py-2 px-3">Cliente</th>
                              <th className="py-2 px-3">Bairro / Cidade</th>
                              <th className="py-2 px-3 text-right">Peso</th>
                              <th className="py-2 px-3 text-right">Valor</th>
                              <th className="py-2 px-3 text-center">Atribuir Placa Individual</th>
                              <th className="py-2 px-3 text-center">Ação</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-tertiary bg-background-primary">
                            {[...c.entregas].sort((a, b) => (Number(String(a.nota || a.pedido || '').replace(/\D+/g, '')) || 0) - (Number(String(b.nota || b.pedido || '').replace(/\D+/g, '')) || 0)).map(p => (
                              <tr key={p.id} className="hover:bg-background-secondary/50 transition-colors">
                                <td className="py-2 px-3 font-mono font-bold text-text-primary">
                                  {p.pedido ? `PED: ${p.pedido}` : (p.nota || '--')}
                                </td>
                                <td className="py-2 px-3 text-text-primary font-medium truncate max-w-[180px]" title={p.cliente}>{p.cliente}</td>
                                <td className="py-2 px-3 text-text-secondary truncate max-w-[150px]">{p.bairro} - {p.cidade}</td>
                                <td className="py-2 px-3 text-right font-mono text-text-secondary">{(p.peso || 0).toFixed(1)} kg</td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-success">
                                  {(p.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <input
                                      type="text"
                                      list="lista-placas"
                                      placeholder="Placa..."
                                      defaultValue={p.placa !== 'SEM PLACA' ? p.placa : ''}
                                      id={`input-ativo-p-${p.id}`}
                                      className="bg-background-secondary border border-border-tertiary rounded px-2 py-0.5 text-xs font-mono font-bold uppercase w-24 text-text-primary focus:outline-none focus:border-amber-500"
                                    />
                                    <button
                                      onClick={() => {
                                        const el = document.getElementById(`input-ativo-p-${p.id}`);
                                        if (el && el.value) handleAtribuirPlacaPedidoAtivo(p.id, el.value);
                                      }}
                                      className="p-1 rounded bg-amber-500/20 text-amber-600 hover:bg-amber-500 hover:text-white transition-colors cursor-pointer"
                                      title="Salvar placa para este pedido"
                                    >
                                      <Check size={12} />
                                    </button>
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <button
                                    onClick={() => handleExcluirPedidoAtivo(p.id)}
                                    className="p-1.5 rounded-lg text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                                    title="Excluir este pedido do sistema"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* ABA 3: ATUALIZAÇÃO DE STATUS E CARGAS EM LOTE (PLANILHA) */}
      {/* ------------------------------------------------------------- */}
      {abaAtiva === 'atualizacao' && (
        <div className="space-y-6 animate-fade-in">
          {/* Card explicativo */}
          <div className="bg-emerald-500/10 border border-emerald-500/25 p-4 rounded-2xl flex items-start gap-3.5">
            <RefreshCw className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm text-text-secondary leading-relaxed">
              <span className="font-bold text-emerald-600 dark:text-emerald-400 block mb-0.5">
                Atualização em Lote de Status, Placas e Dados de Cargas
              </span>
              Suba a sua planilha consolidada de rotas e cargas (em formato <strong>.CSV</strong> com separador ponto e vírgula ou <strong>.XLSX</strong>). O sistema fará a correspondência pelo <strong>N° NF</strong> e atualizará o status em tempo real (ex: <em>Entrega total, No cliente, Descarregando, Reentrega, Carga parada, Pendente</em>), associará as placas aos veículos e atualizará os pesos e valores.
            </div>
          </div>

          {/* Resultado de Sucesso pós-aplicação */}
          {resultAtualizacao && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 p-6 rounded-2xl space-y-4 animate-scale-in">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
                  <CheckCircle2 size={28} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    Atualização em Lote Concluída com Sucesso!
                  </h3>
                  <p className="text-xs sm:text-sm text-text-secondary">
                    Todas as alterações foram sincronizadas na base local e no Firestore.
                  </p>
                </div>
              </div>

              {/* Cards de Métricas pós-atualização */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="bg-background-primary p-3 rounded-xl border border-border-secondary">
                  <div className="text-[11px] font-medium text-text-tertiary">Total Processado</div>
                  <div className="text-lg font-black text-text-primary">{resultAtualizacao.total} notas</div>
                </div>
                <div className="bg-background-primary p-3 rounded-xl border border-border-secondary">
                  <div className="text-[11px] font-medium text-text-tertiary">Notas Atualizadas</div>
                  <div className="text-lg font-black text-info">{resultAtualizacao.atualizadas} notas</div>
                </div>
                <div className="bg-background-primary p-3 rounded-xl border border-border-secondary">
                  <div className="text-[11px] font-medium text-text-tertiary">Novas Cadastradas</div>
                  <div className="text-lg font-black text-emerald-500">{resultAtualizacao.novas} notas</div>
                </div>
                <div className="bg-background-primary p-3 rounded-xl border border-border-secondary">
                  <div className="text-[11px] font-medium text-text-tertiary">Data de Referência</div>
                  <div className="text-lg font-black text-amber-500">
                    {resultAtualizacao.data ? new Date(resultAtualizacao.data + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'}
                  </div>
                </div>
              </div>

              {/* Status breakdown */}
              {resultAtualizacao.statsStatus && (
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-text-secondary">Status Aplicados:</span>
                  {Object.entries(resultAtualizacao.statsStatus).map(([st, qtd]) => (
                    <Badge key={st} status={st}>
                      {st}: {qtd}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Ações pós-atualização */}
              <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border-secondary">
                <button
                  onClick={() => navigate('/monitoramento')}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-info hover:bg-info/90 text-white font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-md shadow-info/20"
                >
                  <MapPin size={16} />
                  <span>Ir para o Monitoramento</span>
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-background-primary hover:bg-background-tertiary border border-border-secondary text-text-primary font-bold text-xs sm:text-sm transition-all cursor-pointer"
                >
                  <Gauge size={16} />
                  <span>Ver Dashboard Geral</span>
                </button>
                <button
                  onClick={() => {
                    setResultAtualizacao(null);
                    setDadosAtualizacaoCalculados(null);
                    setFileAtualizacao(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 font-bold text-xs sm:text-sm transition-all cursor-pointer ml-auto"
                >
                  <RefreshCw size={14} />
                  <span>Atualizar Outro Arquivo</span>
                </button>
              </div>
            </div>
          )}

          {/* Área de Seleção de Arquivo */}
          {!resultAtualizacao && (
            <div className="glass-panel p-6 sm:p-8 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-border-secondary text-center hover:border-emerald-500 transition-colors relative overflow-hidden group">
              <input
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={(e) => {
                  const f = e.target.files[0];
                  if (f) {
                    setFileAtualizacao(f);
                    processarArquivoAtualizacao(f);
                  }
                }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
              />
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-4 group-hover:scale-110 transition-transform">
                <FileSpreadsheet size={32} />
              </div>
              <h3 className="font-bold text-base sm:text-lg text-text-primary mb-1">
                {fileAtualizacao ? fileAtualizacao.name : "Arraste ou Selecione a Planilha de Rotas e Cargas"}
              </h3>
              <p className="text-xs sm:text-sm text-text-secondary max-w-md mb-3">
                Suporta arquivos <strong>.CSV</strong> (separador ponto e vírgula <code>;</code> ou vírgula <code>,</code>) e planilhas <strong>.XLSX / .XLS</strong> com as colunas <code>N° NF</code>, <code>Status</code>, <code>Placa</code>, <code>Peso</code>, etc.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-text-tertiary">
                <span className="px-2 py-0.5 rounded bg-background-secondary border border-border-tertiary font-mono">N° NF</span>
                <span className="px-2 py-0.5 rounded bg-background-secondary border border-border-tertiary font-mono">Status</span>
                <span className="px-2 py-0.5 rounded bg-background-secondary border border-border-tertiary font-mono">Placa</span>
                <span className="px-2 py-0.5 rounded bg-background-secondary border border-border-tertiary font-mono">Data Saída</span>
                <span className="px-2 py-0.5 rounded bg-background-secondary border border-border-tertiary font-mono">CODCLI</span>
                <span className="px-2 py-0.5 rounded bg-background-secondary border border-border-tertiary font-mono">Cliente</span>
                <span className="px-2 py-0.5 rounded bg-background-secondary border border-border-tertiary font-mono">Peso (kg)</span>
                <span className="px-2 py-0.5 rounded bg-background-secondary border border-border-tertiary font-mono">Valor (R$)</span>
              </div>
            </div>
          )}

          {/* Painel de Pré-visualização & Opções */}
          {!resultAtualizacao && dadosAtualizacaoCalculados && (
            <div className="space-y-5 animate-fade-in">
              {/* Cards de Métricas Pré-Confirmação */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="glass-panel p-4 rounded-xl border border-border-secondary">
                  <div className="text-xs text-text-tertiary font-medium">Registros no Arquivo</div>
                  <div className="text-xl sm:text-2xl font-black text-text-primary mt-1">
                    {dadosAtualizacaoCalculados.totalLinhas}
                  </div>
                  <div className="text-[11px] text-text-tertiary mt-0.5">notas fiscais lidas</div>
                </div>

                <div className="glass-panel p-4 rounded-xl border border-border-secondary">
                  <div className="text-xs text-info font-medium">Já no Sistema</div>
                  <div className="text-xl sm:text-2xl font-black text-info mt-1">
                    {dadosAtualizacaoCalculados.totalExistentes}
                  </div>
                  <div className="text-[11px] text-text-tertiary mt-0.5">serão atualizadas</div>
                </div>

                <div className="glass-panel p-4 rounded-xl border border-border-secondary">
                  <div className="text-xs text-emerald-500 font-medium">Novas no Sistema</div>
                  <div className="text-xl sm:text-2xl font-black text-emerald-500 mt-1">
                    {dadosAtualizacaoCalculados.totalNovas}
                  </div>
                  <div className="text-[11px] text-text-tertiary mt-0.5">
                    {opcoesAtualizacao.cadastrarNovas ? 'serão cadastradas' : 'serão ignoradas'}
                  </div>
                </div>

                <div className="glass-panel p-4 rounded-xl border border-border-secondary">
                  <div className="text-xs text-amber-500 font-medium">Data de Referência</div>
                  <div className="text-xl sm:text-2xl font-black text-amber-500 mt-1">
                    {dadosAtualizacaoCalculados.linhas[0]?.data ? new Date(dadosAtualizacaoCalculados.linhas[0].data + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Hoje'}
                  </div>
                  <div className="text-[11px] text-text-tertiary mt-0.5">data de saída</div>
                </div>
              </div>

              {/* Status identificados */}
              <div className="bg-background-secondary p-4 rounded-xl border border-border-secondary flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-text-primary mr-1">Status Encontrados no Arquivo:</span>
                {Object.entries(dadosAtualizacaoCalculados.statsStatus).map(([st, qtd]) => (
                  <Badge key={st} status={st}>
                    {st}: {qtd}
                  </Badge>
                ))}
              </div>

              {/* Opções de Configuração */}
              <div className="bg-background-primary p-4 rounded-xl border border-border-secondary space-y-2">
                <div className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
                  Opções de Atualização
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="flex items-center gap-2.5 text-xs text-text-primary cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={opcoesAtualizacao.cadastrarNovas}
                      onChange={(e) => setOpcoesAtualizacao(prev => ({ ...prev, cadastrarNovas: e.target.checked }))}
                      className="rounded border-border-secondary text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                    />
                    <span>Cadastrar notas não encontradas</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-text-primary cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={opcoesAtualizacao.atualizarPlaca}
                      onChange={(e) => setOpcoesAtualizacao(prev => ({ ...prev, atualizarPlaca: e.target.checked }))}
                      className="rounded border-border-secondary text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                    />
                    <span>Atualizar Placa do veículo</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-text-primary cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={opcoesAtualizacao.atualizarPesosValores}
                      onChange={(e) => setOpcoesAtualizacao(prev => ({ ...prev, atualizarPesosValores: e.target.checked }))}
                      className="rounded border-border-secondary text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                    />
                    <span>Atualizar Pesos e Valores</span>
                  </label>
                </div>
              </div>

              {/* Barra de Filtro e Busca da Tabela Prévia */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-1.5 p-1 bg-background-primary rounded-xl border border-border-secondary text-xs">
                  <button
                    onClick={() => setFiltroTabelaAtualizacao('todos')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      filtroTabelaAtualizacao === 'todos' ? 'bg-emerald-600 text-white' : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    Todos ({dadosAtualizacaoCalculados.totalLinhas})
                  </button>
                  <button
                    onClick={() => setFiltroTabelaAtualizacao('existentes')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      filtroTabelaAtualizacao === 'existentes' ? 'bg-info text-white' : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    Já no Sistema ({dadosAtualizacaoCalculados.totalExistentes})
                  </button>
                  <button
                    onClick={() => setFiltroTabelaAtualizacao('novas')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      filtroTabelaAtualizacao === 'novas' ? 'bg-emerald-500 text-white' : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    Novas ({dadosAtualizacaoCalculados.totalNovas})
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Buscar NF, Cliente ou Placa..."
                    value={termoBuscaAtualizacao}
                    onChange={(e) => setTermoBuscaAtualizacao(e.target.value)}
                    className="bg-background-primary border border-border-secondary rounded-xl px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-emerald-500 w-full sm:w-60"
                  />
                </div>
              </div>

              {/* Tabela de Pré-visualização */}
              <div className="border border-border-secondary rounded-2xl overflow-hidden glass-panel">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-background-secondary text-text-secondary sticky top-0 z-10 border-b border-border-secondary font-mono">
                      <tr>
                        <th className="py-2.5 px-3">NF</th>
                        <th className="py-2.5 px-3">Cliente</th>
                        <th className="py-2.5 px-3">Cidade / Bairro</th>
                        <th className="py-2.5 px-3">Placa</th>
                        <th className="py-2.5 px-3 text-right">Peso</th>
                        <th className="py-2.5 px-3 text-right">Valor</th>
                        <th className="py-2.5 px-3 text-center">Status no Arquivo</th>
                        <th className="py-2.5 px-3 text-center">Status Atual</th>
                        <th className="py-2.5 px-3 text-center">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-secondary">
                      {dadosAtualizacaoCalculados.linhas
                        .filter(l => {
                          if (filtroTabelaAtualizacao === 'existentes' && !l.existeNoSistema) return false;
                          if (filtroTabelaAtualizacao === 'novas' && l.existeNoSistema) return false;
                          if (termoBuscaAtualizacao) {
                            const term = termoBuscaAtualizacao.toLowerCase();
                            const matchNota = String(l.nota || '').toLowerCase().includes(term);
                            const matchCli = String(l.cliente || '').toLowerCase().includes(term);
                            const matchPlaca = String(l.placa || '').toLowerCase().includes(term);
                            return matchNota || matchCli || matchPlaca;
                          }
                          return true;
                        })
                        .map((l, idx) => (
                          <tr key={`${l.nota}_${idx}`} className="hover:bg-background-secondary/50 transition-colors">
                            <td className="py-2 px-3 font-mono font-bold text-text-primary">{l.nota}</td>
                            <td className="py-2 px-3 truncate max-w-[200px]" title={l.cliente}>
                              <span className="font-medium text-text-primary">{l.cliente}</span>
                              {l.codCliente && <span className="text-[10px] text-text-tertiary ml-1 font-mono">({l.codCliente})</span>}
                            </td>
                            <td className="py-2 px-3 text-text-secondary truncate max-w-[160px]">
                              {l.municipio || '—'} {l.bairro ? `• ${l.bairro}` : ''}
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-text-primary">{l.placa || '—'}</td>
                            <td className="py-2 px-3 text-right font-mono text-text-secondary">
                              {l.peso ? `${l.peso.toFixed(1)} kg` : '—'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-success">
                              {l.valor ? l.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <Badge status={l.status}>{l.status}</Badge>
                            </td>
                            <td className="py-2 px-3 text-center">
                              {l.existeNoSistema ? (
                                <Badge status={l.statusAtualSistema || 'Pendente'}>
                                  {l.statusAtualSistema || 'Pendente'}
                                </Badge>
                              ) : (
                                <span className="text-[11px] text-text-tertiary italic">Não cadastrada</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {l.existeNoSistema ? (
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-info/10 text-info border border-info/30">
                                  Atualizar
                                </span>
                              ) : (
                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                  opcoesAtualizacao.cadastrarNovas
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                    : 'bg-background-secondary text-text-tertiary border border-border-secondary'
                                }`}>
                                  {opcoesAtualizacao.cadastrarNovas ? 'Novo Cadastro' : 'Ignorar'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Botões de Ação Final */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3">
                <button
                  onClick={() => {
                    setDadosAtualizacaoCalculados(null);
                    setFileAtualizacao(null);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-border-secondary hover:bg-background-secondary text-xs sm:text-sm font-bold text-text-secondary transition-all cursor-pointer"
                >
                  Cancelar / Trocar Arquivo
                </button>

                <button
                  onClick={aplicarAtualizacaoPlanilha}
                  disabled={loadingAtualizacao}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
                >
                  {loadingAtualizacao ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Atualizando Entregas...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw size={16} />
                      <span>Confirmar e Aplicar Atualização de {dadosAtualizacaoCalculados.totalLinhas} Entregas</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. HISTÓRICO DE IMPORTAÇÕES & LIMPEZA (DANGER ZONE) */}
      {/* ------------------------------------------------------------- */}
      <div className="border border-border-secondary rounded-2xl overflow-hidden glass-panel">
        <div className="bg-background-secondary p-5 border-b border-border-secondary flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-danger flex items-center gap-2">
              <Trash2 size={20} /> Histórico de Importações & Limpeza
            </h3>
            <p className="text-xs sm:text-sm text-text-secondary mt-1">
              Abaixo estão listadas as datas com entregas na base. Você pode excluir um dia específico ou limpar todas as entregas.
            </p>
          </div>
          <button 
            onClick={() => { setModalLimpezaGeral(true); setSenhaLimpezaGeral(''); setErroSenhaGeral(''); }}
            className="bg-danger/10 hover:bg-danger text-danger hover:text-white border border-danger/30 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all shrink-0 shadow-xs cursor-pointer"
          >
            <Trash2 size={16} /> Limpar Todas as Entregas
          </button>
        </div>
        
        <div className="divide-y divide-border-tertiary">
          {datasImportadas.length === 0 ? (
            <div className="p-6 text-center text-text-tertiary text-sm font-medium">Nenhum dado importado no sistema.</div>
          ) : (
            datasImportadas.map(({ data, total, previa, faturado }) => (
              <div key={data} className="p-4 sm:px-6 hover:bg-background-secondary/50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-bold text-text-primary text-base">
                      {new Date(data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-text-secondary font-medium mt-0.5">
                      <span>{total} entregas registradas</span>
                      {previa > 0 && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/15 text-amber-500">
                          {previa} prévia
                        </span>
                      )}
                      {faturado > 0 && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-success/15 text-success">
                          {faturado} faturadas
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {dataParaExcluir === data ? (
                    <div className="flex flex-col items-end gap-2 bg-danger/5 p-3 rounded-xl border border-danger/20 w-full sm:w-auto animate-fade-in">
                      <div className="flex gap-2 w-full">
                        <input 
                          type="password"
                          placeholder="Senha Monitoramento"
                          value={senhaExclusao}
                          onChange={e => { setSenhaExclusao(e.target.value); setErroSenha(''); }}
                          className="bg-background-primary border border-danger/30 rounded-lg px-3 py-1.5 text-sm w-full sm:w-48 focus:ring-1 focus:ring-danger"
                          autoFocus
                        />
                        <button 
                          onClick={handleExcluirData}
                          className="bg-danger text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-danger/90 whitespace-nowrap cursor-pointer"
                        >
                          Confirmar
                        </button>
                      </div>
                      {erroSenha && <span className="text-xs text-danger font-bold">{erroSenha}</span>}
                      <button 
                        onClick={() => { setDataParaExcluir(null); setSenhaExclusao(''); setErroSenha(''); }}
                        className="text-xs text-text-secondary hover:text-text-primary font-bold cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => { setDataParaExcluir(data); setSenhaExclusao(''); setErroSenha(''); }}
                      className="text-danger hover:bg-danger/10 border border-danger/20 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Excluir Arquivo
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 4. BACKUP DO SISTEMA */}
      <div className="border border-border-secondary rounded-2xl overflow-hidden glass-panel">
        <div className="bg-background-secondary p-5 border-b border-border-secondary">
          <h3 className="font-bold text-text-primary flex items-center gap-2">
            <Database size={20} className="text-info" /> Backup do Sistema
          </h3>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            Faça uma cópia de segurança local de todo o banco de dados atual ou restaure um backup antigo.
          </p>
        </div>
        <div className="p-5 flex flex-col sm:flex-row gap-4 items-center">
          <button 
            onClick={handleExportarBackup}
            className="w-full sm:w-auto bg-background-secondary hover:bg-border-tertiary text-text-primary border border-border-secondary px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <DownloadCloud size={16} /> Baixar Backup (.json)
          </button>
          
          <div className="w-full sm:w-auto relative group">
            <input 
              type="file" 
              accept=".json"
              ref={backupInputRef}
              onChange={handleImportarBackup}
              disabled={restaurando}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            <button 
              disabled={restaurando}
              className="w-full bg-info hover:bg-info/90 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              {restaurando ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {restaurando ? 'Restaurando...' : 'Restaurar Backup'}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Limpeza Geral */}
      {modalLimpezaGeral && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-background-secondary border border-danger/30 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-danger/10 text-danger flex items-center justify-center shrink-0 border border-danger/20">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-text-primary">Limpar Todas as Entregas</h3>
                <p className="text-xs text-danger font-semibold uppercase tracking-wider">Ação Irreversível</p>
              </div>
            </div>

            <div className="bg-danger/5 border border-danger/20 rounded-2xl p-4 text-xs text-text-secondary space-y-2">
              <p className="font-semibold text-danger">Atenção para o que será apagado:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Todas as <strong>entregas</strong> e <strong>pedidos</strong> (incluindo prévias).</li>
                <li>Todas as <strong>devoluções</strong> registradas.</li>
                <li>Histórico de <strong>cargas finalizadas</strong> e <strong>registros de KM</strong>.</li>
              </ul>
              <div className="pt-2 border-t border-danger/10 text-success font-medium flex items-center gap-1.5">
                <CheckCircle2 size={14} className="shrink-0" />
                <span><strong>Clientes com Geolocalização cadastrada</strong> e <strong>perfis de motoristas</strong> serão <strong>100% PRESERVADOS</strong>.</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                Digite a senha do Monitoramento para confirmar:
              </label>
              <input 
                type="password"
                placeholder="Senha Monitoramento"
                value={senhaLimpezaGeral}
                onChange={e => { setSenhaLimpezaGeral(e.target.value); setErroSenhaGeral(''); }}
                onKeyDown={e => { if (e.key === 'Enter') handleLimparTodas(); }}
                className="w-full bg-background-primary border border-border-secondary focus:border-danger rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-danger transition-all"
                autoFocus
              />
              {erroSenhaGeral && <p className="text-xs font-bold text-danger animate-shake">{erroSenhaGeral}</p>}
            </div>

            <div className="flex gap-3">
              <button 
                type="button"
                onClick={() => { setModalLimpezaGeral(false); setSenhaLimpezaGeral(''); setErroSenhaGeral(''); }}
                disabled={limpandoGeral}
                className="flex-1 bg-background-tertiary hover:bg-border-tertiary text-text-secondary font-bold py-3 rounded-xl text-sm transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleLimparTodas}
                disabled={limpandoGeral}
                className="flex-1 bg-danger hover:bg-danger/90 disabled:opacity-50 text-white font-black py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-danger/20 cursor-pointer"
              >
                {limpandoGeral ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                {limpandoGeral ? 'Limpando...' : 'Confirmar Limpeza'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Datalist global para sugestão de veículos cadastrados */}
      <datalist id="lista-placas">
        {veiculos.map(v => (
          <option key={v.placa || v.id} value={v.placa || v.id}>
            {v.placa || v.id} {v.modelo ? `- ${v.modelo}` : ''} {v.motoristaPadrao ? `(${v.motoristaPadrao})` : ''}
          </option>
        ))}
      </datalist>
    </div>
  );
}
