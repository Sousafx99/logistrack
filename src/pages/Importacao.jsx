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
  X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useStore } from '../store/useStore';
import { normalizarRCA } from '../lib/utils';
import { firestoreService } from '../lib/firestoreService';

export function Importacao() {
  const navigate = useNavigate();
  const { 
    entregas = [], 
    devolucoes = [], 
    veiculos = [],
    importarEntregas, 
    importarPreviaCargas,
    removerEntregasPorData, 
    removerEntregaPorId,
    removerEntregasPorCarga,
    atribuirPlacaCarga,
    atribuirPlacaEntrega,
    limparTodasEntregas, 
    restaurarBackup 
  } = useStore();

  // Controle de Abas: 'previa' (8164 + Programação) ou 'faturamento' (8132 Oficial)
  const [abaAtiva, setAbaAtiva] = useState('previa');

  // Estado para Faturamento Oficial (Aba 8132)
  const [file8132, setFile8132] = useState(null);
  const [loading8132, setLoading8132] = useState(false);
  const [result8132, setResult8132] = useState(null);

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
  const processarArquivosPrevia = async (arq8164, arqProg) => {
    if (!arq8164 && !arqProg) return;
    setLoadingPrevia(true);
    setResultPrevia(null);

    try {
      let mapProgramacao = {};
      let listaKmPrevisto = [];
      let dataExpedicaoGlobal = new Date().toISOString().split('T')[0];

      // 1. Ler arquivo de Programação (se fornecido)
      if (arqProg) {
        const dataProg = await arqProg.arrayBuffer();
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
          const idxPriCarreg = header.findIndex(h => h.includes('pri') || h.includes('carreg') || h.includes('ordem'));
          const idxObs = header.findIndex(h => h.includes('observ') || h.includes('obs'));
          const idxDescarga = header.findIndex(h => h.includes('descarga'));

          for (let r = 1; r < rowsProg.length; r++) {
            const row = rowsProg[r];
            if (!row || row.length === 0) continue;
            const cargaVal = String(row[idxCarga !== -1 ? idxCarga : 1] || '').trim();
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

      if (arq8164) {
        const data8164 = await arq8164.arrayBuffer();
        const wb8164 = XLSX.read(data8164, { type: 'array', raw: true });
        const ws8164 = wb8164.Sheets[wb8164.SheetNames[0]];
        const rows8164 = XLSX.utils.sheet_to_json(ws8164, { header: 1, defval: '' });

        if (!rows8164 || rows8164.length < 2) {
          throw new Error("O arquivo 8164 está vazio ou não possui linhas de pedidos.");
        }

        const header8164 = rows8164[0].map(h => normalizeStr(h));
        const idxPedido = header8164.findIndex(h => h.includes('pedido'));
        const idxCarga = header8164.findIndex(h => h.includes('carregamento') || h.includes('carga'));
        const idxCodCli = header8164.findIndex(h => (h.includes('cod') || h.includes('codigo')) && h.includes('cliente'));
        const idxCliente = header8164.findIndex(h => (h.includes('nome') || h.includes('razao')) && h.includes('cliente')) !== -1
          ? header8164.findIndex(h => (h.includes('nome') || h.includes('razao')) && h.includes('cliente'))
          : header8164.findIndex(h => h.includes('cliente') && !h.includes('cod'));
        const idxValor = header8164.findIndex(h => h.includes('valor'));
        const idxPeso = header8164.findIndex(h => h.includes('peso'));
        const idxBairro = header8164.findIndex(h => h.includes('bairro entrega') || h.includes('bairro'));
        const idxCidade = header8164.findIndex(h => h.includes('municipio') || h.includes('cidade'));
        const idxRota = header8164.findIndex(h => h.includes('rota') && !h.includes('codigo'));
        const idxDataPrev = header8164.findIndex(h => h.includes('previs') || h.includes('data'));
        const idxRca = header8164.findIndex(h => (h.includes('nome') || !h.includes('cod')) && (h.includes('vendedor') || h.includes('rca')));

        for (let r = 1; r < rows8164.length; r++) {
          const row = rows8164[r];
          if (!row || row.length === 0) continue;

          const pedido = String(row[idxPedido !== -1 ? idxPedido : 0] || '').trim();
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
        for (const name of possibleNames) {
          const normName = normalizeStr(name);
          for (const [hNorm, idx] of Object.entries(headerMap)) {
            if (hNorm === normName) return idx;
          }
        }
        for (const name of possibleNames) {
          const normName = normalizeStr(name);
          for (const [hNorm, idx] of Object.entries(headerMap)) {
            if (hNorm.includes(normName) || normName.includes(hNorm)) return idx;
          }
        }
        return fallbackIdx;
      };

      const idxCodCli = findColIdx(['codcli', 'cod cliente', 'codigo cliente'], 0);
      const idxCliente = findColIdx(['cliente', 'nome cliente', 'razao social'], 1);
      const idxCidade = findColIdx(['municent', 'municipio', 'cidade'], 2);
      const idxBairro = findColIdx(['bairroent', 'bairro'], 3);
      const idxRota = findColIdx(['rota entrega', 'rota'], 4);
      const idxPlaca = findColIdx(['placa', 'veiculo'], 5);
      const idxCarga = findColIdx(['carregamento', 'carga', 'num carga'], 6);
      const idxPedido = findColIdx(['pedido', 'num pedido'], 7);
      const idxRca = findColIdx(['rca', 'vendedor'], 8);
      const idxCodProd = findColIdx(['cod do produto', 'cod produto', 'codigo produto'], 9);
      const idxProd = findColIdx(['produto', 'desc produto', 'descricao produto'], 10);
      const idxQtd = findColIdx(['quantidade de caixas', 'qtd caixas', 'qtd'], 11);
      const idxPeso = findColIdx(['peso kg', 'peso'], 12);
      const idxNota = findColIdx(['n nota fiscal', 'n nota', 'nota fiscal', 'nf'], 13);
      const idxData = findColIdx(['data saida', 'data de entrega', 'data'], 14);
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
          (e.nota && nova.nota && e.nota === nova.nota) ||
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

      setResult8132({
        total: novasEntregas.length,
        reconciliadas: reconciliadasCount,
        novas: novasCount,
        atualizadas: atualizadasCount
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
          </div>
        </div>

        {/* Chaves de Abas */}
        <div className="flex items-center gap-2 p-1 bg-background-primary rounded-xl border border-border-secondary max-w-xl">
          <button
            onClick={() => setAbaAtiva('previa')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              abaAtiva === 'previa'
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Clock size={16} />
            <span>1. Prévia de Cargas (8164 + Programação)</span>
            <span className="hidden sm:inline-block px-1.5 py-0.2 bg-white/20 rounded text-[10px] font-mono uppercase">D-1</span>
          </button>

          <button
            onClick={() => setAbaAtiva('faturamento')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              abaAtiva === 'faturamento'
                ? 'bg-info text-white shadow-md shadow-info/20'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <CheckCircle2 size={16} />
            <span>2. Faturamento Oficial (8132)</span>
            <span className="hidden sm:inline-block px-1.5 py-0.2 bg-white/20 rounded text-[10px] font-mono uppercase">Oficial</span>
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
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setFile8164(f);
                    processarArquivosPrevia(f, fileProg);
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
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setFileProg(f);
                    processarArquivosPrevia(file8164, f);
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
              <div className="w-full space-y-3">
                <div>
                  <h3 className="font-bold text-success text-lg">Faturamento 8132 Processado com Sucesso!</h3>
                  <p className="text-xs sm:text-sm text-success/80">
                    A base de dados foi atualizada com as notas fiscais oficiais sem afetar o andamento da operação.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-success/15">
                    <p className="text-xs text-success/70 font-semibold uppercase tracking-wider mb-0.5">Prévias Reconciliadas</p>
                    <p className="text-2xl font-black text-success">{result8132.reconciliadas}</p>
                    <span className="text-[10px] text-text-tertiary">Check-ins preservados</span>
                  </div>
                  <div className="bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-success/15">
                    <p className="text-xs text-success/70 font-semibold uppercase tracking-wider mb-0.5">Novas Notas Inseridas</p>
                    <p className="text-2xl font-black text-success">{result8132.novas}</p>
                    <span className="text-[10px] text-text-tertiary">Notas novas do dia</span>
                  </div>
                  <div className="bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-success/15">
                    <p className="text-xs text-success/70 font-semibold uppercase tracking-wider mb-0.5">Total de Notas</p>
                    <p className="text-2xl font-black text-success">{result8132.total}</p>
                    <span className="text-[10px] text-text-tertiary">Documentos processados</span>
                  </div>
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
