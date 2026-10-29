import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { exportWorkbookMobileOrWeb, exportImageDataUrlMobileOrWeb } from '../lib/mobileBridge';
import { 
  FileSpreadsheet, 
  Calendar, 
  Truck, 
  Package, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Image as ImageIcon,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toPng } from 'html-to-image';
import { useStore } from '../store/useStore';
import { getPresetPorTipo } from '../components/cadastros/AbaVeiculos';
import { cn } from '../lib/utils';

const formatarMoeda = (val) => {
  if (val === null || val === undefined || isNaN(Number(val))) return 'R$ 0,00';
  return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatarPeso = (peso) => {
  if (peso === null || peso === undefined || isNaN(Number(peso))) return '0,00 kg';
  return Number(peso).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kg';
};

const formatarData = (dataStr) => {
  if (!dataStr) return '--/--/----';
  try {
    const parts = String(dataStr).split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  } catch {}
  return String(dataStr);
};

const extrairDataYMD = (val) => {
  if (!val) return '';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      const [d, m, y] = trimmed.split('/');
      return `${y}-${m}-${d}`;
    }
    if (trimmed.includes('T')) {
      return trimmed.split('T')[0];
    }
  }
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch {}
  return '';
};

const TIPOS_DESPESA_MAP = {
  descarga: 'Descarga',
  ajudante: 'Ajudante extra',
  pernoite: 'Pernoite',
  pedagio: 'Pedágio'
};

// Célula Interativa para Edição Direta da Prioridade / Ordem de Carregamento
function PrioridadeCell({ item, onSalvar }) {
  const [val, setVal] = useState(item.prioridade !== null && item.prioridade !== undefined ? String(item.prioridade) : '');
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    setVal(item.prioridade !== null && item.prioridade !== undefined ? String(item.prioridade) : '');
  }, [item.prioridade]);

  const salvar = () => {
    setEditando(false);
    const trimmed = String(val || '').trim();
    if (!trimmed) {
      if (item.prioridade !== null && item.prioridade !== undefined) {
        onSalvar(item, 'prioridade', null);
      }
      return;
    }
    const num = parseInt(trimmed, 10);
    if (!isNaN(num) && num !== item.prioridade) {
      onSalvar(item, 'prioridade', num);
    }
  };

  return (
    <div className="flex items-center justify-center">
      <input 
        type="number"
        min="1"
        max="99"
        value={val}
        onFocus={() => setEditando(true)}
        onChange={(e) => setVal(e.target.value)}
        onBlur={salvar}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          }
        }}
        placeholder="—"
        className={cn(
          "w-11 text-center font-mono font-bold text-xs py-1 px-1 rounded-lg border transition-all cursor-text",
          editando 
            ? "bg-background-primary border-info ring-2 ring-info/30 text-text-primary" 
            : val 
              ? "bg-amber-500/10 border-amber-500/30 text-amber-500 font-black hover:border-amber-500/60" 
              : "bg-background-secondary border-border-secondary/60 text-text-tertiary hover:border-border-secondary hover:text-text-primary"
        )}
        title="Clique para alterar a ordem / prioridade de carregamento deste veículo"
      />
    </div>
  );
}

export function ProgramacaoCargas() {
  const { 
    entregas = [], 
    veiculos = [], 
    despesas = [],
    configDiarias, 
    cargasProgramacao = [],
    kmRegistros = [],
    globalFilters,
    setGlobalFilters,
    transferirPlacaPorCarga,
    transferirCargaCompleta,
    salvarDadosCargaProgramacao,
    sincronizarDespesaProgramacao
  } = useStore();

  const printPngRef = useRef(null);
  const datePickerRef = useRef(null);
  const [exportandoPng, setExportandoPng] = useState(false);
  const [buscaTexto, setBuscaTexto] = useState('');
  const [salvandoItem, setSalvandoItem] = useState({});
  const [mensagemSucesso, setMensagemSucesso] = useState(null);
  const [quinzenaAtiva, setQuinzenaAtiva] = useState(null); // null | '1Q' | '2Q'

  // Datas disponíveis no banco de dados com contagem de entregas
  const datasDisponiveis = useMemo(() => {
    const map = {};
    (entregas || []).forEach(e => {
      if (e.data) {
        map[e.data] = (map[e.data] || 0) + 1;
      }
    });
    return Object.entries(map)
      .map(([data, count]) => ({ data, count }))
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [entregas]);

  // Data ativa selecionada
  const dataAtiva = useMemo(() => {
    const dGlobal = globalFilters.visaoMonitoramento?.datas?.[0] || globalFilters.data;
    if (dGlobal && dGlobal !== 'TODAS') return dGlobal;
    if (datasDisponiveis.length > 0) return datasDisponiveis[0].data;
    return new Date().toISOString().split('T')[0];
  }, [globalFilters, datasDisponiveis]);

  // Informações do período ativo (Dia único ou 1ª / 2ª Quinzena do mês da dataAtiva)
  const infoQuinzena = useMemo(() => {
    const parts = String(dataAtiva || '').split('-');
    const ano = Number(parts[0]) || new Date().getFullYear();
    const mesNum = Number(parts[1]) || (new Date().getMonth() + 1);
    const mesStr = String(mesNum).padStart(2, '0');
    const ultimoDia = new Date(ano, mesNum, 0).getDate();
    const ultimoDiaStr = String(ultimoDia).padStart(2, '0');

    if (quinzenaAtiva === '1Q') {
      return {
        ativa: true,
        codigo: '1Q',
        ano,
        mesStr,
        ultimoDiaStr,
        dataInicio: `${ano}-${mesStr}-01`,
        dataFim: `${ano}-${mesStr}-15`,
        labelCurto: `01 a 15/${mesStr}/${ano}`,
        arquivoSufixo: `${ano}-${mesStr}_1Q`
      };
    }
    if (quinzenaAtiva === '2Q') {
      return {
        ativa: true,
        codigo: '2Q',
        ano,
        mesStr,
        ultimoDiaStr,
        dataInicio: `${ano}-${mesStr}-16`,
        dataFim: `${ano}-${mesStr}-${ultimoDiaStr}`,
        labelCurto: `16 a ${ultimoDiaStr}/${mesStr}/${ano}`,
        arquivoSufixo: `${ano}-${mesStr}_2Q`
      };
    }
    return {
      ativa: false,
      codigo: null,
      ano,
      mesStr,
      ultimoDiaStr,
      dataInicio: dataAtiva,
      dataFim: dataAtiva,
      labelCurto: formatarData(dataAtiva),
      arquivoSufixo: dataAtiva
    };
  }, [dataAtiva, quinzenaAtiva]);

  const handleSelecionarData = (d) => {
    setQuinzenaAtiva(null);
    setGlobalFilters({
      data: d,
      visaoMonitoramento: {
        ...globalFilters.visaoMonitoramento,
        datas: [d]
      }
    });
  };

  const handleNavegarDia = (delta) => {
    try {
      const parts = dataAtiva.split('-');
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      d.setDate(d.getDate() + delta);
      const novoYmd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      handleSelecionarData(novoYmd);
    } catch {}
  };

  const handleAbrirCalendario = () => {
    try {
      if (datePickerRef.current) {
        if (typeof datePickerRef.current.showPicker === 'function') {
          datePickerRef.current.showPicker();
        } else {
          datePickerRef.current.focus();
        }
      }
    } catch {}
  };

  // Mapa de veículos
  const veiculosMap = useMemo(() => {
    const map = new Map();
    (veiculos || []).forEach(v => {
      const p = String(v.placa || v.id || '').trim().toUpperCase();
      if (p) map.set(p, v);
    });
    return map;
  }, [veiculos]);

  // Mapa de dados extras salvos da programação
  const progMap = useMemo(() => {
    const map = new Map();
    (cargasProgramacao || []).forEach(cp => {
      const idStr = String(cp.id || '').trim();
      const d = String(cp.data || '').trim();
      const c = String(cp.carga || '').trim();
      const p = String(cp.placa || '').trim().toUpperCase();

      if (idStr) map.set(idStr, cp);
      if (d && c) {
        map.set(`${d}_${c}`, cp);
        map.set(`${d}_${c.replace(/\s+/g, '_')}`, cp);
      }
      if (d && c && p) {
        map.set(`${d}_${c}_${p}`, cp);
        map.set(`${d}_${c.replace(/\s+/g, '_')}_${p}`, cp);
      }
      if (d && p) {
        map.set(`${d}_${p}`, cp);
      }
      if (c) {
        map.set(c, cp);
        map.set(c.replace(/\s+/g, '_'), cp);
      }
    });
    return map;
  }, [cargasProgramacao]);

  // Mapa de registros de KM (previsto, executado) por data/carga/placa
  const kmRegistrosMap = useMemo(() => {
    const map = new Map();
    (kmRegistros || []).forEach(k => {
      const d = String(k.data || '').trim();
      const c = String(k.carga || '').trim();
      const p = String(k.placa || '').trim().toUpperCase();
      const docId = String(k.id || '').trim();

      if (docId) map.set(docId, k);
      if (d && c) map.set(`${d}_${c}`, k);
      if (d && p && c) map.set(`${d}_${p}_${c}`, k);
      if (d && p && c) map.set(`${d}_${p.replace(/[\/\\]/g, '-')}_${c.replace(/[\/\\]/g, '-')}`, k);
      if (c) {
        // Fallback apenas pela carga se tiver kmPrevisto
        const chaveCarga = `carga_${c}`;
        if (!map.has(chaveCarga) || (!map.get(chaveCarga)?.kmPrevisto && k.kmPrevisto)) {
          map.set(chaveCarga, k);
        }
        if (!map.has(c)) {
          map.set(c, k);
        }
      }
    });
    return map;
  }, [kmRegistros]);

  // Agrupamento consolidado das Cargas do dia selecionado ou da quinzena selecionada
  const cargasTabela = useMemo(() => {
    const cargasMap = {};
    const { dataInicio, dataFim } = infoQuinzena;

    (entregas || []).forEach(e => {
      if (!e.data || e.data < dataInicio || e.data > dataFim) return;
      const c = String(e.carga || '').trim();
      if (!c || c === '0' || c.toLowerCase() === 'sem carga') return;

      const isCargaParada = c.toUpperCase().includes('PARADA') || c.toUpperCase().includes('REENTREGA');
      const chave = isCargaParada 
        ? `${c}_${(e.placa || 'SEM_PLACA').trim().toUpperCase()}`
        : c;
      const chaveMapa = `${e.data}__${chave}`;

      if (!cargasMap[chaveMapa]) {
        cargasMap[chaveMapa] = {
          carga: c,
          chave,
          data: e.data,
          entregasCount: 0,
          pesoTotal: 0,
          valorTotal: 0,
          placasSet: new Set(),
          destinosSet: new Set(),
          priCarregamentoSet: new Set(),
          observacoesSet: new Set(),
          pedidos: []
        };
      }

      cargasMap[chaveMapa].entregasCount += 1;
      cargasMap[chaveMapa].pesoTotal += Number(e.peso || 0);
      cargasMap[chaveMapa].valorTotal += e.isReentrega ? 0 : Number(e.valor || 0);
      if (e.placa && e.placa.trim() && e.placa !== 'SEM PLACA') {
        cargasMap[chaveMapa].placasSet.add(e.placa.trim().toUpperCase());
      }
      if (e.rota) {
        cargasMap[chaveMapa].destinosSet.add(String(e.rota).trim().toUpperCase());
      }
      if (e.priCarregamento !== undefined && e.priCarregamento !== null) {
        cargasMap[chaveMapa].priCarregamentoSet.add(Number(e.priCarregamento));
      }
      if (e.observacaoProgramacao) {
        cargasMap[chaveMapa].observacoesSet.add(String(e.observacaoProgramacao).trim());
      }
      cargasMap[chaveMapa].pedidos.push(e);
    });

    // Inclui também cargas salvas na programação para o período ativo que ainda não tenham entregas vinculadas
    (cargasProgramacao || []).forEach(cp => {
      if (!cp.data || cp.data < dataInicio || cp.data > dataFim) return;
      const c = String(cp.carga || '').trim();
      if (!c) return;
      const p = String(cp.placa || '').trim().toUpperCase();
      const isCargaParada = c.toUpperCase().includes('PARADA') || c.toUpperCase().includes('REENTREGA');
      const chave = isCargaParada ? `${c}_${p || 'SEM_PLACA'}` : c;
      const chaveMapa = `${cp.data}__${chave}`;

      if (!cargasMap[chaveMapa]) {
        cargasMap[chaveMapa] = {
          carga: c,
          chave,
          data: cp.data,
          entregasCount: 0,
          pesoTotal: 0,
          valorTotal: 0,
          placasSet: p ? new Set([p]) : new Set(),
          destinosSet: cp.rota ? new Set([String(cp.rota).trim().toUpperCase()]) : new Set(),
          priCarregamentoSet: cp.prioridade ? new Set([Number(cp.prioridade)]) : new Set(),
          observacoesSet: cp.observacao ? new Set([String(cp.observacao).trim()]) : new Set(),
          pedidos: []
        };
      }
    });

    const lista = Object.values(cargasMap)
      .filter(c => {
        const isCargaParada = c.carga.toUpperCase().includes('PARADA') || c.carga.toUpperCase().includes('REENTREGA');
        if (isCargaParada && c.entregasCount === 0) {
          const placa = Array.from(c.placasSet)[0] || '';
          if (!placa || placa === 'SEM PLACA' || placa === 'SEM_PLACA') {
            return false;
          }
        }
        return true;
      })
      .map((c) => {
      const dataCarga = c.data;
      const isCargaParada = c.carga.toUpperCase().includes('PARADA') || c.carga.toUpperCase().includes('REENTREGA');
      const placasArray = Array.from(c.placasSet);
      const placaEfetivaInicial = placasArray.length > 0 ? placasArray[0] : '';
      const chaveNorm = String(c.chave || c.carga);
      const docId = `${dataCarga}_${chaveNorm}`;
      const progSalva = progMap.get(docId) 
        || progMap.get(`${dataCarga}_${chaveNorm.replace(/\s+/g, '_')}`)
        || progMap.get(`${dataCarga}_${c.carga}_${placaEfetivaInicial}`)
        || progMap.get(`${dataCarga}_${c.carga.replace(/\s+/g, '_')}_${placaEfetivaInicial}`)
        || (isCargaParada && placaEfetivaInicial ? progMap.get(`${dataCarga}_CARGA_PARADA_${placaEfetivaInicial}`) : null)
        || (isCargaParada && placaEfetivaInicial ? progMap.get(`${dataCarga}_CARGA PARADA_${placaEfetivaInicial}`) : null)
        || (placaEfetivaInicial ? progMap.get(`${dataCarga}_${placaEfetivaInicial}`) : null)
        || (!isCargaParada ? progMap.get(`${dataCarga}_${c.carga}`) : null)
        || (!isCargaParada ? progMap.get(`${dataCarga}_${c.carga.replace(/\s+/g, '_')}`) : null)
        || (!isCargaParada ? progMap.get(c.carga) : null)
        || {};

      // Placa efetiva: prioriza monitoramento
      const placaEfetiva = placasArray.length > 0 ? placasArray[0] : (progSalva.placa || '');

      // Prioridade: respeita coluna PRI.CARREG.
      let priEfetiva = null;
      if (progSalva.prioridade !== undefined && progSalva.prioridade !== null && !isNaN(Number(progSalva.prioridade))) {
        priEfetiva = Number(progSalva.prioridade);
      } else if (c.priCarregamentoSet.size > 0) {
        priEfetiva = Array.from(c.priCarregamentoSet)[0];
      }

      // Observações
      const obsArray = Array.from(c.observacoesSet);
      const obsEfetiva = progSalva.observacao !== undefined 
        ? progSalva.observacao 
        : (obsArray.length > 0 ? obsArray.join('; ') : '');

      // Dados do veículo e diária base
      const vCadastrado = veiculosMap.get(placaEfetiva);
      const tipoVeiculo = progSalva.tipoVeiculo || progSalva.tipo || vCadastrado?.tipo || '3/4';
      const preset = getPresetPorTipo(tipoVeiculo, configDiarias?.tabela);
      const valorDiariaBase = vCadastrado?.valorDiaria !== undefined && vCadastrado?.valorDiaria !== '' && !isNaN(Number(vCadastrado.valorDiaria))
        ? Number(vCadastrado.valorDiaria)
        : Number(preset?.valorDiaria || 0);

      // Despesas da Programação
      const descarga = Number(progSalva.descarga || 0);
      const ajudante = Number(progSalva.ajudante || 0);
      const pernoite = Number(progSalva.pernoite || 0);
      const pedagio = Number(progSalva.pedagio || 0);
      const diariaExtraTipo = progSalva.diariaExtraTipo || 'nenhuma';

      let diariaExtraValor = 0;
      if (diariaExtraTipo === 'meia') {
        diariaExtraValor = valorDiariaBase * 0.5;
      } else if (diariaExtraTipo === 'uma') {
        diariaExtraValor = valorDiariaBase * 1.0;
      }

      const destinosArray = Array.from(c.destinosSet);
      const destinoFormatado = progSalva.destino || progSalva.rota || (destinosArray.length > 0 ? destinosArray.join(', ') : 'SDR-CENTRO');
      const destUpper = String(destinoFormatado || '').trim().toUpperCase();
      const tipoRotaUpper = String(progSalva.tipoRota || '').trim().toUpperCase();

      // Identifica se a rota é fora de Salvador (RMS, INT ou termos fora da capital)
      const isForaSdr = tipoRotaUpper.includes('RMS')
        || tipoRotaUpper.includes('INTERIOR')
        || tipoRotaUpper.includes('INT')
        || destUpper.startsWith('RMS') 
        || destUpper.startsWith('INT') 
        || destUpper.includes('FEIRA') 
        || destUpper.includes('FSA') 
        || destUpper.includes('INTERIOR') 
        || destUpper.includes('CANDEIAS') 
        || destUpper.includes('CAND') 
        || destUpper.includes('SSP') 
        || destUpper.includes('REGIAO')
        || destUpper.includes('LINHA VERDE')
        || destUpper.includes('CAMACARI') 
        || destUpper.includes('LAURO') 
        || destUpper.includes('VALENCA') 
        || destUpper.includes('ALAGOINHAS')
        || destUpper.includes('CDMIXBAHIA')
        || destUpper.includes('SMF')
        || (!destUpper.startsWith('SDR') && !destUpper.startsWith('SALVADOR'));

      // Busca KM registrado / previsto no sistema para esta carga
      const cLimpa = String(c.carga).trim();
      const pLimpa = String(placaEfetiva || '').trim().toUpperCase();
      const kmReg = kmRegistrosMap.get(`${dataCarga}_${cLimpa}`)
        || (pLimpa ? kmRegistrosMap.get(`${dataCarga}_${pLimpa}_${cLimpa}`) : null)
        || (pLimpa ? kmRegistrosMap.get(`${dataCarga}_${pLimpa.replace(/[\/\\]/g, '-')}_${cLimpa.replace(/[\/\\]/g, '-')}`) : null)
        || (!isCargaParada ? kmRegistrosMap.get(`carga_${cLimpa}`) : null)
        || (!isCargaParada ? kmRegistrosMap.get(cLimpa) : null)
        || {};

      // KM percorrido (para carros fora de Salvador: RMS / INT -> R$ 2,00 por KM)
      let kmRodado = 0;
      if (progSalva.km !== undefined && progSalva.km !== null && progSalva.km !== '' && !isNaN(Number(progSalva.km)) && Number(progSalva.km) > 0) {
        kmRodado = Number(progSalva.km);
      } else if (isForaSdr) {
        if (kmReg.kmPrevisto !== undefined && kmReg.kmPrevisto !== null && !isNaN(Number(kmReg.kmPrevisto)) && Number(kmReg.kmPrevisto) > 0) {
          kmRodado = Number(kmReg.kmPrevisto);
        } else if (kmReg.kmExecutado !== undefined && kmReg.kmExecutado !== null && !isNaN(Number(kmReg.kmExecutado)) && Number(kmReg.kmExecutado) > 0) {
          kmRodado = Number(kmReg.kmExecutado);
        } else if (progSalva.kmEstimado !== undefined && progSalva.kmEstimado !== null && !isNaN(Number(progSalva.kmEstimado)) && Number(progSalva.kmEstimado) > 0) {
          kmRodado = Number(progSalva.kmEstimado);
        }
      }

      const isForaSdrEfetivo = isForaSdr || kmRodado > 0;
      const valorKm = Number((kmRodado * 2).toFixed(2));

      const subtotalProg = descarga + ajudante + pernoite + pedagio + diariaExtraValor + valorKm;

      // Despesas já lançadas na aba Custos para esta placa nesta data (sem duplicar as da programação)
      const despesasAbaCustos = (despesas || []).filter(d => {
        if (d.origem === 'programacao' || d.id?.startsWith('despesa_prog_')) return false;
        const dData = extrairDataYMD(d.data_solicitacao || d.criadoEm || d.data);
        if (dData !== dataCarga) return false;
        const p = String(d.motorista_placa || '').trim().toUpperCase();
        return p && p === placaEfetiva;
      }).reduce((acc, d) => acc + (Number(d.valor) || 0), 0);

      // Total de Despesa da Carga = Diária da Placa + Custos da Programação + Custos da Aba Custos
      const totalDespesas = valorDiariaBase + subtotalProg + despesasAbaCustos;

      // Faturamento Previsto / Real (8132)
      const faturamentoEfetivo = c.valorTotal > 0 ? c.valorTotal : Number(progSalva.valorPrevisto || 0);
      const isFaturadaReal = c.pedidos.length > 0 && c.pedidos.some(e => e.isPrevia === false || e.statusFaturamento === 'Faturado');

      // % Custo Frete: (Total Despesa / Faturamento) * 100
      const percentualFrete = faturamentoEfetivo > 0 
        ? (totalDespesas / faturamentoEfetivo) * 100 
        : 0;

      return {
        docId,
        prioridade: priEfetiva,
        carga: c.carga,
        data: dataCarga,
        entregasCount: c.entregasCount,
        destino: destinoFormatado,
        pesoTotal: c.pesoTotal,
        tipo: tipoVeiculo,
        placa: placaEfetiva,
        observacao: obsEfetiva,
        descarga,
        ajudante,
        pernoite,
        pedagio,
        diariaExtraTipo,
        valorDiariaBase,
        diariaExtraValor,
        subtotalProg,
        despesasAbaCustos,
        totalDespesas,
        km: kmRodado,
        valorKm,
        isForaSdr: isForaSdrEfetivo,
        faturamento: faturamentoEfetivo,
        isFaturadaReal,
        percentualFrete
      };
    });

    // Ordenação por Data (quando quinzena ativa) e ESTRITA por PRI.CARREG. dentro de cada dia
    return lista.sort((a, b) => {
      if (a.data !== b.data) return a.data.localeCompare(b.data);
      const priA = (a.prioridade !== null && a.prioridade !== undefined) ? Number(a.prioridade) : 9999;
      const priB = (b.prioridade !== null && b.prioridade !== undefined) ? Number(b.prioridade) : 9999;
      if (priA !== priB) return priA - priB;
      return a.carga.localeCompare(b.carga);
    });
  }, [entregas, cargasProgramacao, infoQuinzena, progMap, veiculosMap, configDiarias, despesas, kmRegistrosMap]);

  // Filtro de busca na tabela
  const cargasFiltradas = useMemo(() => {
    if (!buscaTexto.trim()) return cargasTabela;
    const termo = buscaTexto.trim().toUpperCase();
    return cargasTabela.filter(c => 
      c.carga.toUpperCase().includes(termo) ||
      c.placa.toUpperCase().includes(termo) ||
      c.destino.toUpperCase().includes(termo) ||
      c.tipo.toUpperCase().includes(termo) ||
      c.observacao.toUpperCase().includes(termo) ||
      formatarData(c.data).includes(termo)
    );
  }, [cargasTabela, buscaTexto]);

  // Totais consolidados da Faixa Laranja Oficial
  const totaisGerais = useMemo(() => {
    let entregasSoma = 0;
    let pesoSoma = 0;
    let despesaSoma = 0;
    let faturamentoSoma = 0;

    cargasTabela.forEach(c => {
      entregasSoma += c.entregasCount;
      pesoSoma += c.pesoTotal;
      despesaSoma += c.totalDespesas;
      faturamentoSoma += (c.faturamento || 0);
    });

    const percentualFreteGeral = faturamentoSoma > 0 
      ? (despesaSoma / faturamentoSoma) * 100 
      : 0;

    return {
      totalCargas: cargasTabela.length,
      totalEntregas: entregasSoma,
      pesoTotal: pesoSoma,
      despesasTotal: despesaSoma,
      faturamentoTotal: faturamentoSoma,
      percentualFreteGeral
    };
  }, [cargasTabela]);

  // Alterar Placa de uma Carga (Muda a placa no monitoramento de todas as entregas)
  const handleAlterarPlaca = async (item, novaPlaca) => {
    const pUpper = String(novaPlaca).trim().toUpperCase();
    if (!pUpper || pUpper === item.placa) return;

    setSalvandoItem(prev => ({ ...prev, [item.docId]: true }));
    try {
      await transferirPlacaPorCarga(item.carga, item.data, pUpper);

      // Atualiza placas de eventuais despesas vinculadas a esta carga
      const tiposCustos = ['descarga', 'ajudante', 'pernoite', 'pedagio'];
      for (const t of tiposCustos) {
        if (item[t] > 0) {
          await sincronizarDespesaProgramacao({
            data: item.data,
            carga: item.carga,
            placa: pUpper,
            tipoChave: t,
            tipoNome: TIPOS_DESPESA_MAP[t],
            valor: item[t]
          });
        }
      }
      if (item.diariaExtraTipo && item.diariaExtraTipo !== 'nenhuma') {
        const valExtra = item.diariaExtraTipo === 'meia' ? item.valorDiariaBase * 0.5 : item.valorDiariaBase;
        await sincronizarDespesaProgramacao({
          data: item.data,
          carga: item.carga,
          placa: pUpper,
          tipoChave: 'diaria_extra',
          tipoNome: 'Diária Extra',
          valor: valExtra
        });
      }

      setMensagemSucesso(`Placa da carga ${item.carga} atualizada para ${pUpper} no Monitoramento e Custos!`);
      setTimeout(() => setMensagemSucesso(null), 4000);
    } catch (err) {
      console.error(err);
      alert(`Erro ao atualizar placa: ${err.message}`);
    } finally {
      setSalvandoItem(prev => ({ ...prev, [item.docId]: false }));
    }
  };

  const handleAlterarDataExpedicao = async (item, novaData) => {
    if (!novaData || novaData === item.data) return;
    const ok = window.confirm(`Deseja alterar a Data de Expedição da Carga ${item.carga} de ${formatarData(item.data)} para ${formatarData(novaData)}?\n\nAs entregas desta carga serão exibidas na data ${formatarData(novaData)} para o motorista, preservando a data de faturamento original (${formatarData(item.data)}).`);
    if (!ok) return;

    setSalvandoItem(prev => ({ ...prev, [item.docId]: true }));
    try {
      if (typeof transferirCargaCompleta === 'function') {
        await transferirCargaCompleta({
          carga: item.carga,
          dataOrigem: item.data,
          novaData: novaData,
          novaPlaca: item.placa
        });
      }
      setMensagemSucesso(`Data de expedição da Carga ${item.carga} alterada para ${formatarData(novaData)}!`);
      setTimeout(() => setMensagemSucesso(null), 4000);
    } catch (e) {
      console.error(e);
      alert('Erro ao alterar data de expedição.');
    } finally {
      setSalvandoItem(prev => ({ ...prev, [item.docId]: false }));
    }
  };

  // Alterar Campo de Despesa, Prioridade ou Observação (com sincronização direta para a aba Custos)
  const handleSalvarCampo = async (item, campo, valor) => {
    try {
      // 1. Salva na programação
      await salvarDadosCargaProgramacao(item.docId, {
        carga: item.carga,
        data: item.data,
        placa: item.placa,
        tipo: item.tipo,
        destino: item.destino,
        prioridade: campo === 'prioridade' ? valor : item.prioridade,
        [campo]: valor
      });

      // 2. Sincroniza com a coleção de despesas (Aba Custos)
      if (['descarga', 'ajudante', 'pernoite', 'pedagio'].includes(campo)) {
        await sincronizarDespesaProgramacao({
          data: item.data,
          carga: item.carga,
          placa: item.placa,
          tipoChave: campo,
          tipoNome: TIPOS_DESPESA_MAP[campo],
          valor: Number(valor) || 0,
          observacao: `Programação Carga ${item.carga} (${TIPOS_DESPESA_MAP[campo]})`
        });
      } else if (campo === 'diariaExtraTipo') {
        let valExtra = 0;
        if (valor === 'meia') valExtra = item.valorDiariaBase * 0.5;
        if (valor === 'uma') valExtra = item.valorDiariaBase * 1.0;
        await sincronizarDespesaProgramacao({
          data: item.data,
          carga: item.carga,
          placa: item.placa,
          tipoChave: 'diaria_extra',
          tipoNome: 'Diária Extra',
          valor: valExtra,
          observacao: `Programação Carga ${item.carga} - Diária Extra (${valor === 'meia' ? '1/2 Diária' : '1 Diária'})`
        });
      }
    } catch (err) {
      console.error('Erro ao salvar campo:', err);
    }
  };

  // Exportar para Planilha Excel
  const handleExportarExcel = async () => {
    if (cargasTabela.length === 0) {
      alert('Nenhuma carga para exportar.');
      return;
    }

    const cabecalhoColunas = infoQuinzena.ativa
      ? ['PRI.CARREG.', 'DATA', 'CARGA', 'ENTREGAS', 'DESTINO', 'PESO (KG)', 'TIPO', 'VEICULO', 'OBSERVAÇÃO', 'DESCARGA (R$)', 'AJUDANTE (R$)', 'PERNOITE (R$)', 'PEDÁGIO (R$)', 'DIÁRIA EXTRA', 'KM', 'CUSTO KM (R$ 2/KM)', 'TOTAL DESPESA (R$)', 'FATURAMENTO (R$)', '% CUSTO FRETE']
      : ['PRI.CARREG.', 'CARGA', 'ENTREGAS', 'DESTINO', 'PESO (KG)', 'TIPO', 'VEICULO', 'OBSERVAÇÃO', 'DESCARGA (R$)', 'AJUDANTE (R$)', 'PERNOITE (R$)', 'PEDÁGIO (R$)', 'DIÁRIA EXTRA', 'KM', 'CUSTO KM (R$ 2/KM)', 'TOTAL DESPESA (R$)', 'FATURAMENTO (R$)', '% CUSTO FRETE'];

    const rows = [
      [infoQuinzena.ativa ? 'PERÍODO:' : 'DATA:', infoQuinzena.labelCurto, '', 'TOTAL CARGAS:', totaisGerais.totalCargas, '', 'TOTAL ENTREGAS:', totaisGerais.totalEntregas, '', 'PESO TOTAL (KG):', totaisGerais.pesoTotal, '', 'FATURAMENTO TOTAL:', totaisGerais.faturamentoTotal, '', '% FRETE GERAL:', `${totaisGerais.percentualFreteGeral.toFixed(2)}%`],
      [],
      cabecalhoColunas
    ];

    cargasTabela.forEach(c => {
      const linhaBase = [
        c.prioridade !== null && c.prioridade !== undefined ? c.prioridade : '-',
        ...(infoQuinzena.ativa ? [formatarData(c.data)] : []),
        c.carga,
        c.entregasCount,
        c.destino,
        Number(c.pesoTotal.toFixed(2)),
        c.tipo,
        c.placa,
        c.observacao || '-',
        c.descarga,
        c.ajudante,
        c.pernoite,
        c.pedagio,
        c.diariaExtraTipo === 'meia' ? '1/2 Diária' : (c.diariaExtraTipo === 'uma' ? '1 Diária' : 'Nenhuma'),
        c.km || 0,
        Number((c.valorKm || 0).toFixed(2)),
        Number(c.totalDespesas.toFixed(2)),
        Number((c.faturamento || 0).toFixed(2)),
        `${(c.percentualFrete || 0).toFixed(2)}%`
      ];
      rows.push(linhaBase);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Prog_${infoQuinzena.arquivoSufixo}`.slice(0, 31));
    await exportWorkbookMobileOrWeb(wb, `programacao_cargas_${infoQuinzena.arquivoSufixo}.xlsx`);
  };

  // Exportar Imagem PNG (Colunas PRI até OBSERVAÇÃO, idêntico à imagem enviada)
  const handleExportarPng = async () => {
    if (!printPngRef.current) return;
    setExportandoPng(true);
    try {
      const dataUrl = await toPng(printPngRef.current, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: '#ffffff'
      });
      await exportImageDataUrlMobileOrWeb(dataUrl, `programacao_cargas_${infoQuinzena.arquivoSufixo}.png`);
      setMensagemSucesso('Imagem PNG exportada com sucesso!');
      setTimeout(() => setMensagemSucesso(null), 3000);
    } catch (err) {
      console.error('Erro ao gerar PNG:', err);
      alert('Erro ao gerar imagem PNG: ' + (err.message || 'Falha no processador de imagem.'));
    } finally {
      setExportandoPng(false);
    }
  };

  return (
    <div className="space-y-2.5 sm:space-y-3 pb-16 font-sans w-full max-w-full overflow-x-hidden">
      {/* 1. BARRA DE FILTROS & AÇÕES DE EXPORTAÇÃO */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2 sm:gap-3 bg-background-primary p-2.5 sm:p-3 rounded-xl border border-border-secondary shadow-xs">
        {/* Seletor de Datas em Linha Única com Rolagem Horizontal no Mobile */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-nowrap pb-0.5">
          {/* Navegação Dia Anterior */}
          <button
            onClick={() => handleNavegarDia(-1)}
            className="p-1.5 rounded-lg bg-background-secondary border border-border-secondary hover:border-[#C25916] text-text-secondary hover:text-text-primary transition-all cursor-pointer shrink-0"
            title="Dia Anterior"
          >
            <ChevronLeft size={14} />
          </button>

          {/* Botão Seletor com Calendário Nativo Pop-up */}
          <div className="relative shrink-0">
            <button
              onClick={handleAbrirCalendario}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-background-secondary hover:bg-background-tertiary border border-border-secondary hover:border-[#C25916] text-text-primary text-xs font-bold transition-all cursor-pointer shadow-xs"
              title="Abrir calendário para escolher qualquer data"
            >
              <Calendar size={13} className="text-[#C25916]" />
              <span>{formatarData(dataAtiva)}</span>
              <ChevronDown size={12} className="text-text-tertiary" />
            </button>
            <input 
              type="date"
              ref={datePickerRef}
              value={dataAtiva}
              onChange={(e) => {
                if (e.target.value) handleSelecionarData(e.target.value);
              }}
              className="absolute opacity-0 pointer-events-none w-0 h-0 bottom-0 left-0"
            />
          </div>

          {/* Navegação Próximo Dia */}
          <button
            onClick={() => handleNavegarDia(1)}
            className="p-1.5 rounded-lg bg-background-secondary border border-border-secondary hover:border-[#C25916] text-text-secondary hover:text-text-primary transition-all cursor-pointer shrink-0"
            title="Próximo Dia"
          >
            <ChevronRight size={14} />
          </button>

          {/* Divisor e Seletores de Quinzena do Mês Ativo */}
          <div className="h-5 w-px bg-border-secondary mx-0.5 shrink-0" />

          <button
            type="button"
            onClick={() => setQuinzenaAtiva(prev => prev === '1Q' ? null : '1Q')}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer shrink-0 shadow-xs",
              quinzenaAtiva === '1Q'
                ? "bg-[#C25916] border-[#C25916] text-white"
                : "bg-background-secondary hover:bg-background-tertiary border-border-secondary hover:border-[#C25916] text-text-secondary hover:text-text-primary"
            )}
            title={`Consolidar 1ª Quinzena (01/${infoQuinzena.mesStr}/${infoQuinzena.ano} a 15/${infoQuinzena.mesStr}/${infoQuinzena.ano}). Clique novamente para voltar ao dia único.`}
          >
            <span>1ª Quinzena</span>
            <span className={cn(
              "text-[10px] font-mono",
              quinzenaAtiva === '1Q' ? "text-amber-200" : "text-text-tertiary"
            )}>
              01–15/{infoQuinzena.mesStr}
            </span>
            {quinzenaAtiva === '1Q' && <X size={11} className="ml-0.5 text-amber-200 hover:text-white" />}
          </button>

          <button
            type="button"
            onClick={() => setQuinzenaAtiva(prev => prev === '2Q' ? null : '2Q')}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer shrink-0 shadow-xs",
              quinzenaAtiva === '2Q'
                ? "bg-[#C25916] border-[#C25916] text-white"
                : "bg-background-secondary hover:bg-background-tertiary border-border-secondary hover:border-[#C25916] text-text-secondary hover:text-text-primary"
            )}
            title={`Consolidar 2ª Quinzena (16/${infoQuinzena.mesStr}/${infoQuinzena.ano} a ${infoQuinzena.ultimoDiaStr}/${infoQuinzena.mesStr}/${infoQuinzena.ano}). Clique novamente para voltar ao dia único.`}
          >
            <span>2ª Quinzena</span>
            <span className={cn(
              "text-[10px] font-mono",
              quinzenaAtiva === '2Q' ? "text-amber-200" : "text-text-tertiary"
            )}>
              16–{infoQuinzena.ultimoDiaStr}/{infoQuinzena.mesStr}
            </span>
            {quinzenaAtiva === '2Q' && <X size={11} className="ml-0.5 text-amber-200 hover:text-white" />}
          </button>

          {/* Se a data ativa for um dia sem entregas (apenas no modo dia único), mostra badge com X */}
          {!infoQuinzena.ativa && !datasDisponiveis.some(d => d.data === dataAtiva) && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-500 text-xs font-bold shadow-xs shrink-0">
              <span>{formatarData(dataAtiva)} (0 ent.)</span>
              <button 
                onClick={() => {
                  if (datasDisponiveis.length > 0) handleSelecionarData(datasDisponiveis[0].data);
                }}
                className="hover:text-amber-300 ml-1 cursor-pointer"
                title="Voltar para data com entregas"
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Busca e Ações de Exportar em Linha Compacta */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap">
          {/* Busca */}
          <div className="flex-1 flex items-center bg-background-secondary border border-border-secondary rounded-lg px-2.5 py-1.5 text-xs text-text-primary sm:w-56 focus-within:border-[#C25916] min-w-0">
            <Search size={13} className="text-text-tertiary mr-1.5 shrink-0" />
            <input 
              type="text" 
              placeholder="Buscar carga, placa, rota..."
              value={buscaTexto}
              onChange={(e) => setBuscaTexto(e.target.value)}
              className="w-full bg-transparent border-none p-0 focus:outline-hidden text-xs min-w-0"
            />
          </div>

          {/* Botão Exportar Imagem PNG */}
          <button
            onClick={handleExportarPng}
            disabled={exportandoPng || cargasTabela.length === 0}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#C25916] hover:bg-[#a7460c] text-white text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
            title="Exportar imagem PNG da escala (colunas Pri até Observação)"
          >
            {exportandoPng ? (
              <RefreshCw size={13} className="animate-spin" />
            ) : (
              <ImageIcon size={13} />
            )}
            <span className="hidden xs:inline sm:inline">Imagem</span>
          </button>

          {/* Botão Exportar Excel */}
          <button
            onClick={handleExportarExcel}
            disabled={cargasTabela.length === 0}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-background-secondary hover:bg-background-tertiary border border-border-secondary text-text-primary text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
            title="Baixar planilha Excel com custos"
          >
            <Download size={13} className="text-emerald-500" />
            <span>Excel</span>
          </button>
        </div>
      </div>

      {/* Toast de Sucesso */}
      {mensagemSucesso && (
        <div className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
          <span>{mensagemSucesso}</span>
        </div>
      )}

      {/* 2. FAIXA SUPERIOR TEMÁTICA LARANJA COM TOTAIS (Compacta em 2 linhas no mobile e 1 linha no desktop) */}
      <div className="bg-[#C25916] text-white rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 shadow-md border border-[#a7460c]">
        <div className="grid grid-cols-12 lg:grid-cols-7 gap-y-2 gap-x-1.5 sm:gap-3 items-center text-center lg:text-left">
          <div className="col-span-4 lg:col-span-1">
            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-amber-200 truncate">
              {infoQuinzena.ativa ? (infoQuinzena.codigo === '1Q' ? '1ª Quinzena' : '2ª Quinzena') : 'Data Prog.'}
            </p>
            <p className={cn(
              "font-black tracking-tight truncate",
              infoQuinzena.ativa ? "text-[11px] sm:text-sm lg:text-base" : "text-xs sm:text-base lg:text-lg"
            )} title={infoQuinzena.labelCurto}>
              {infoQuinzena.labelCurto}
            </p>
          </div>
          <div className="col-span-2 lg:col-span-1">
            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-amber-200 truncate">Cargas</p>
            <p className="text-xs sm:text-base lg:text-lg font-black font-mono">{totaisGerais.totalCargas}</p>
          </div>
          <div className="col-span-3 lg:col-span-1">
            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-amber-200 truncate">Entregas</p>
            <p className="text-xs sm:text-base lg:text-lg font-black font-mono">{totaisGerais.totalEntregas}</p>
          </div>
          <div className="col-span-3 lg:col-span-1 lg:order-last">
            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-amber-200 truncate">% Frete</p>
            <p className="text-xs sm:text-base lg:text-lg font-black font-mono text-emerald-300">
              {totaisGerais.percentualFreteGeral.toFixed(2)}%
            </p>
          </div>
          <div className="col-span-4 lg:col-span-1 pt-1.5 lg:pt-0 border-t border-white/15 lg:border-0">
            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-amber-200 truncate">Peso Total</p>
            <p className="text-xs sm:text-base lg:text-lg font-black font-mono truncate">{formatarPeso(totaisGerais.pesoTotal)}</p>
          </div>
          <div className="col-span-4 lg:col-span-1 pt-1.5 lg:pt-0 border-t border-white/15 lg:border-0">
            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-amber-200 truncate">Faturamento</p>
            <p className="text-xs sm:text-base lg:text-lg font-black font-mono truncate">{formatarMoeda(totaisGerais.faturamentoTotal)}</p>
          </div>
          <div className="col-span-4 lg:col-span-1 pt-1.5 lg:pt-0 border-t border-white/15 lg:border-0">
            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-amber-200 truncate">Despesas</p>
            <p className="text-xs sm:text-base lg:text-lg font-black font-mono text-amber-200 truncate">{formatarMoeda(totaisGerais.despesasTotal)}</p>
          </div>
        </div>
      </div>

      {/* 3. TABELA OFICIAL ESTILO PLANILHA */}
      <div className="bg-background-primary border border-border-secondary rounded-xl overflow-hidden shadow-xs">
        {cargasFiltradas.length === 0 ? (
          <div className="py-12 text-center text-text-tertiary">
            <AlertTriangle className="mx-auto h-8 w-8 text-amber-500 mb-2 opacity-80" />
            <p className="text-sm font-bold text-text-secondary">
              {infoQuinzena.ativa ? `Nenhuma carga encontrada para esta quinzena (${infoQuinzena.labelCurto}).` : 'Nenhuma carga encontrada para esta data.'}
            </p>
            <p className="text-xs text-text-tertiary mt-0.5">Selecione outra data ou quinzena na barra superior.</p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse text-[11px] sm:text-xs">
              <thead>
                <tr className="bg-[#C25916] text-white border-b border-[#a7460c] font-black text-[10px] sm:text-[11px] tracking-wide select-none whitespace-nowrap">
                  <th className="py-2.5 px-2 text-center w-12 border-r border-[#d46a28]">PRI.</th>
                  <th className="py-2.5 px-2.5 text-center w-24 border-r border-[#d46a28]">CARGA</th>
                  <th className="py-2.5 px-2 text-center w-14 border-r border-[#d46a28]">ENT.</th>
                  <th className="py-2.5 px-3 text-center min-w-[130px] max-w-[180px] border-r border-[#d46a28]">DESTINO</th>
                  <th className="py-2.5 px-3 text-center w-24 border-r border-[#d46a28]">PESO (KG)</th>
                  <th className="py-2.5 px-2.5 text-center w-16 border-r border-[#d46a28]">TIPO</th>
                  <th className="py-2.5 px-3 text-center w-28 border-r border-[#d46a28]">VEÍCULO</th>
                  <th className="py-2.5 px-3 text-center min-w-[240px] border-r border-[#d46a28]">OBSERVAÇÃO</th>
                  <th className="py-2.5 px-2 text-center w-20 border-r border-[#d46a28] bg-[#B04C0F]">DESCARGA</th>
                  <th className="py-2.5 px-2 text-center w-20 border-r border-[#d46a28] bg-[#B04C0F]">AJUDANTE</th>
                  <th className="py-2.5 px-2 text-center w-20 border-r border-[#d46a28] bg-[#B04C0F]">PERNOITE</th>
                  <th className="py-2.5 px-2 text-center w-20 border-r border-[#d46a28] bg-[#B04C0F]">PEDÁGIO</th>
                  <th className="py-2.5 px-2 text-center w-28 border-r border-[#d46a28] bg-[#B04C0F]">DIÁRIA EXTRA</th>
                  <th className="py-2.5 px-2 text-center w-28 border-r border-[#d46a28] bg-[#B04C0F]">KM (R$ 2/KM)</th>
                  <th className="py-2.5 px-3 text-center min-w-[110px] border-r border-[#d46a28] bg-[#993D06]">TOTAL DESP.</th>
                  <th className="py-2.5 px-3 text-center min-w-[120px] border-r border-[#d46a28] bg-[#873403]">FATURAMENTO</th>
                  <th className="py-2.5 px-2 text-center w-20 bg-[#742b01]">% FRETE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-secondary">
                {cargasFiltradas.map((item, idx) => {
                  const salvando = salvandoItem[item.docId];
                  const mostrarSeparadorDia = infoQuinzena.ativa && (idx === 0 || cargasFiltradas[idx - 1].data !== item.data);
                  const cargasDoDia = mostrarSeparadorDia ? cargasFiltradas.filter(x => x.data === item.data) : null;
                  const entDia = cargasDoDia ? cargasDoDia.reduce((s, x) => s + x.entregasCount, 0) : 0;
                  const fatDia = cargasDoDia ? cargasDoDia.reduce((s, x) => s + (x.faturamento || 0), 0) : 0;
                  const despDia = cargasDoDia ? cargasDoDia.reduce((s, x) => s + x.totalDespesas, 0) : 0;
                  const pctDia = fatDia > 0 ? (despDia / fatDia) * 100 : 0;

                  return (
                    <React.Fragment key={item.docId}>
                      {mostrarSeparadorDia && (
                        <tr className="bg-[#C25916]/12 dark:bg-[#C25916]/20 border-y border-[#C25916]/30">
                          <td colSpan={17} className="py-1.5 px-3">
                            <div className="flex flex-wrap items-center gap-3 text-[11px] font-black text-text-primary">
                              <span className="inline-flex items-center gap-1.5 text-[#C25916] dark:text-amber-400">
                                <Calendar size={12} />
                                {formatarData(item.data)}
                              </span>
                              <span className="text-text-tertiary">•</span>
                              <span className="font-mono">{cargasDoDia.length} carga{cargasDoDia.length !== 1 ? 's' : ''}</span>
                              <span className="text-text-tertiary">•</span>
                              <span className="font-mono">{entDia} ent.</span>
                              <span className="text-text-tertiary">•</span>
                              <span className="font-mono text-emerald-600 dark:text-emerald-400">Fat: {formatarMoeda(fatDia)}</span>
                              <span className="text-text-tertiary">•</span>
                              <span className="font-mono text-amber-600 dark:text-amber-400">Desp: {formatarMoeda(despDia)}</span>
                              {fatDia > 0 && (
                                <>
                                  <span className="text-text-tertiary">•</span>
                                  <span className="font-mono">Frete: {pctDia.toFixed(2)}%</span>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                      <tr 
                        className={cn(
                          "transition-colors text-xs",
                          idx % 2 === 0 ? "bg-background-primary" : "bg-background-secondary/30",
                          "hover:bg-[#C25916]/5 dark:hover:bg-white/5"
                        )}
                      >
                        {/* PRI.CARREG. (EDITÁVEL PELO USUÁRIO) */}
                        <td className="py-1 px-1.5 text-center border-r border-border-secondary/60">
                          <PrioridadeCell 
                            item={item} 
                            onSalvar={handleSalvarCampo} 
                          />
                        </td>

                        {/* CARGA & DATA EXPEDIÇÃO */}
                        <td className="py-1.5 px-2 text-center font-mono border-r border-border-secondary/60 whitespace-nowrap">
                          <div className="font-bold text-text-primary text-xs">{item.carga}</div>
                          <div className="flex items-center justify-center gap-1 mt-0.5">
                            <label 
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold cursor-pointer transition-colors"
                              title={`Data de Expedição: ${formatarData(item.data)}. Clique para alterar a data sem perder faturamento.`}
                            >
                              <Calendar size={10} className="shrink-0" />
                              <span>{formatarData(item.data).slice(0, 5)}</span>
                              <input 
                                type="date"
                                defaultValue={item.data}
                                key={`dt_${item.docId}_${item.data}`}
                                onChange={(e) => handleAlterarDataExpedicao(item, e.target.value)}
                                className="sr-only"
                                onClick={(e) => {
                                  if ('showPicker' in HTMLInputElement.prototype) {
                                    try { e.target.showPicker(); } catch {}
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </td>

                        {/* ENTREGAS */}
                        <td className="py-1.5 px-2 text-center font-mono font-bold text-text-primary border-r border-border-secondary/60">
                          {item.entregasCount}
                        </td>

                        {/* DESTINO */}
                        <td className="py-1.5 px-3 text-text-primary font-medium truncate max-w-[200px] border-r border-border-secondary/60" title={item.destino}>
                          <div className="flex items-center gap-1.5">
                            {item.isForaSdr ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0">
                                RMS
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shrink-0">
                                SDR
                              </span>
                            )}
                            <span className="truncate">{item.destino}</span>
                          </div>
                        </td>

                        {/* PESO (KG) */}
                        <td className="py-1.5 px-3 text-right font-mono font-medium text-text-secondary whitespace-nowrap border-r border-border-secondary/60">
                          {Number(item.pesoTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        {/* TIPO */}
                        <td className="py-1.5 px-2.5 text-center font-bold text-text-secondary uppercase border-r border-border-secondary/60">
                          {item.tipo}
                        </td>

                        {/* VEÍCULO (EDITÁVEL) */}
                        <td className="py-1.5 px-2 border-r border-border-secondary/60">
                          <div className="relative flex items-center">
                            <input 
                              type="text"
                              defaultValue={item.placa}
                              key={`placa_${item.docId}_${item.placa}`}
                              placeholder="Placa..."
                              onBlur={(e) => handleAlterarPlaca(item, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') e.target.blur();
                              }}
                              className={cn(
                                "w-full px-2 py-0.5 rounded text-xs font-mono font-black uppercase tracking-wider border transition-all text-center",
                                item.placa && item.placa !== 'SEM PLACA'
                                  ? "bg-amber-500/10 border-amber-500/30 text-amber-500 dark:text-amber-400"
                                  : "bg-rose-500/10 border-rose-500/30 text-rose-500 dark:text-rose-400"
                              )}
                              title="Alterar placa atualiza automaticamente todas as entregas no Monitoramento e na aba Custos"
                            />
                            {salvando && (
                              <RefreshCw size={11} className="animate-spin text-amber-500 ml-1 shrink-0" />
                            )}
                          </div>
                        </td>

                        {/* OBSERVAÇÃO (EDITÁVEL COM MAIS ESPAÇO) */}
                        <td className="py-1.5 px-3 border-r border-border-secondary/60 min-w-[280px]">
                          <input 
                            type="text"
                            defaultValue={item.observacao}
                            key={`obs_${item.docId}_${item.observacao}`}
                            placeholder="Adicionar observações..."
                            onBlur={(e) => handleSalvarCampo(item, 'observacao', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') e.target.blur();
                            }}
                            className="w-full bg-transparent hover:bg-black/5 dark:hover:bg-white/5 focus:bg-background-primary border border-transparent hover:border-border-secondary focus:border-[#C25916] rounded px-2 py-0.5 text-xs text-text-primary focus:outline-hidden transition-all"
                          />
                        </td>

                        {/* DESCARGA */}
                        <td className="py-1.5 px-1.5 text-right border-r border-border-secondary/60">
                          <input 
                            type="number"
                            step="0.01"
                            defaultValue={item.descarga > 0 ? item.descarga : ''}
                            key={`desc_${item.docId}_${item.descarga}`}
                            placeholder="0,00"
                            onBlur={(e) => handleSalvarCampo(item, 'descarga', parseFloat(e.target.value) || 0)}
                            className="w-full bg-transparent hover:bg-black/5 dark:hover:bg-white/5 focus:bg-background-primary border border-transparent hover:border-border-secondary focus:border-[#C25916] rounded px-1 py-0.5 text-xs text-right font-mono text-text-primary focus:outline-hidden transition-all"
                          />
                        </td>

                        {/* AJUDANTE */}
                        <td className="py-1.5 px-1.5 text-right border-r border-border-secondary/60">
                          <input 
                            type="number"
                            step="0.01"
                            defaultValue={item.ajudante > 0 ? item.ajudante : ''}
                            key={`ajud_${item.docId}_${item.ajudante}`}
                            placeholder="0,00"
                            onBlur={(e) => handleSalvarCampo(item, 'ajudante', parseFloat(e.target.value) || 0)}
                            className="w-full bg-transparent hover:bg-black/5 dark:hover:bg-white/5 focus:bg-background-primary border border-transparent hover:border-border-secondary focus:border-[#C25916] rounded px-1 py-0.5 text-xs text-right font-mono text-text-primary focus:outline-hidden transition-all"
                          />
                        </td>

                        {/* PERNOITE */}
                        <td className="py-1.5 px-1.5 text-right border-r border-border-secondary/60">
                          <input 
                            type="number"
                            step="0.01"
                            defaultValue={item.pernoite > 0 ? item.pernoite : ''}
                            key={`pern_${item.docId}_${item.pernoite}`}
                            placeholder="0,00"
                            onBlur={(e) => handleSalvarCampo(item, 'pernoite', parseFloat(e.target.value) || 0)}
                            className="w-full bg-transparent hover:bg-black/5 dark:hover:bg-white/5 focus:bg-background-primary border border-transparent hover:border-border-secondary focus:border-[#C25916] rounded px-1 py-0.5 text-xs text-right font-mono text-text-primary focus:outline-hidden transition-all"
                          />
                        </td>

                        {/* PEDÁGIO */}
                        <td className="py-1.5 px-1.5 text-right border-r border-border-secondary/60">
                          <input 
                            type="number"
                            step="0.01"
                            defaultValue={item.pedagio > 0 ? item.pedagio : ''}
                            key={`ped_${item.docId}_${item.pedagio}`}
                            placeholder="0,00"
                            onBlur={(e) => handleSalvarCampo(item, 'pedagio', parseFloat(e.target.value) || 0)}
                            className="w-full bg-transparent hover:bg-black/5 dark:hover:bg-white/5 focus:bg-background-primary border border-transparent hover:border-border-secondary focus:border-[#C25916] rounded px-1 py-0.5 text-xs text-right font-mono text-text-primary focus:outline-hidden transition-all"
                          />
                        </td>

                        {/* DIÁRIA EXTRA */}
                        <td className="py-1.5 px-1 text-center border-r border-border-secondary/60">
                          <select
                            value={item.diariaExtraTipo}
                            onChange={(e) => handleSalvarCampo(item, 'diariaExtraTipo', e.target.value)}
                            className="w-full bg-transparent hover:bg-black/5 dark:hover:bg-white/5 border border-transparent hover:border-border-secondary focus:border-[#C25916] rounded px-1 py-0.5 text-[11px] font-bold text-text-secondary cursor-pointer focus:outline-hidden transition-all"
                          >
                            <option value="nenhuma">Nenhuma</option>
                            <option value="meia">1/2 Diária (+{formatarMoeda(item.valorDiariaBase * 0.5)})</option>
                            <option value="uma">1 Diária (+{formatarMoeda(item.valorDiariaBase)})</option>
                          </select>
                        </td>

                        {/* KM RODADO (R$ 2/KM PARA DESTINOS FORA DE SDR) */}
                        <td className="py-1.5 px-2 text-center border-r border-border-secondary/60">
                          <div className="flex flex-col items-center">
                            <div className="flex items-center justify-center gap-1">
                              <input 
                                type="number"
                                min="0"
                                step="any"
                                defaultValue={item.km > 0 ? item.km : ''}
                                key={`km_${item.docId}_${item.km}`}
                                placeholder={item.isForaSdr ? "Km..." : "0"}
                                onBlur={(e) => handleSalvarCampo(item, 'km', parseFloat(e.target.value) || 0)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') e.target.blur();
                                }}
                                className="w-16 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 focus:bg-background-primary border border-transparent hover:border-border-secondary focus:border-[#C25916] rounded px-1 py-0.5 text-xs text-center font-mono font-bold text-text-primary focus:outline-hidden transition-all"
                                title={item.isForaSdr ? `Destino fora de Salvador: R$ 2,00 por KM (${item.km} km)` : "Destino Salvador (SDR)"}
                              />
                              <span className="text-[10px] text-text-tertiary font-bold">km</span>
                            </div>
                            {item.valorKm > 0 && (
                              <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                +{formatarMoeda(item.valorKm)}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* TOTAL DESPESA (Diária + Custos Programação + Custos Aba Custos) */}
                        <td className="py-1.5 px-3 text-right font-mono font-black text-amber-500 dark:text-amber-400 whitespace-nowrap bg-amber-500/5 border-r border-border-secondary/60">
                          {formatarMoeda(item.totalDespesas)}
                        </td>

                        {/* FATURAMENTO (PREVISTO / 8132 REAL) */}
                        <td className="py-1.5 px-3 text-right font-mono font-bold text-text-primary whitespace-nowrap border-r border-border-secondary/60">
                          <div className="flex flex-col items-end">
                            <span>{formatarMoeda(item.faturamento)}</span>
                            <span className={cn(
                              "text-[9px] font-black uppercase px-1 rounded",
                              item.isFaturadaReal 
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" 
                                : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                            )}>
                              {item.isFaturadaReal ? '8132 Oficial' : 'Previsto'}
                            </span>
                          </div>
                        </td>

                        {/* % CUSTO FRETE (Custo / Faturamento * 100) */}
                        <td className="py-1.5 px-2 text-center font-mono whitespace-nowrap">
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[11px] font-black",
                            item.percentualFrete > 12 
                              ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                              : item.percentualFrete > 6
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          )}>
                            {item.faturamento > 0 ? `${item.percentualFrete.toFixed(2)}%` : '—'}
                          </span>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. CONTAINER DEDICADO PARA EXPORTAÇÃO DE IMAGEM PNG (Colunas PRI até OBSERVAÇÃO) */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        <div 
          ref={printPngRef} 
          style={{ 
            width: '1150px', 
            backgroundColor: '#ffffff', 
            padding: '20px', 
            fontFamily: 'system-ui, -apple-system, sans-serif' 
          }}
        >
          {/* Cabeçalho da Imagem Laranja RJ Alimentos */}
          <div style={{ 
            backgroundColor: '#C25916', 
            color: '#ffffff', 
            padding: '14px 20px', 
            borderRadius: '6px', 
            marginBottom: '14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fed7aa', display: 'block' }}>
                {infoQuinzena.ativa ? (infoQuinzena.codigo === '1Q' ? 'PROGRAMAÇÃO — 1ª QUINZENA' : 'PROGRAMAÇÃO — 2ª QUINZENA') : 'DATA PROGRAMAÇÃO'}
              </span>
              <span style={{ fontSize: '20px', fontWeight: '900', letterSpacing: '-0.02em' }}>
                {infoQuinzena.labelCurto}
              </span>
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fed7aa', display: 'block' }}>
                TOTAL ENTREGAS
              </span>
              <span style={{ fontSize: '20px', fontWeight: '900', fontFamily: 'monospace' }}>
                {totaisGerais.totalEntregas}
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fed7aa', display: 'block' }}>
                PESO TOTAL (KG)
              </span>
              <span style={{ fontSize: '20px', fontWeight: '900', fontFamily: 'monospace' }}>
                {Number(totaisGerais.pesoTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Tabela Oficial Idêntica da Imagem (Colunas PRI até OBSERVAÇÃO) */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid #c25916' }}>
            <thead>
              <tr style={{ backgroundColor: '#C25916', color: '#ffffff', fontWeight: '900', textAlign: 'center', fontSize: '11px', letterSpacing: '0.04em' }}>
                <th style={{ padding: '8px 10px', textAlign: 'center', width: '70px', borderRight: '1px solid #d46a28' }}>PRI.CARREG.</th>
                {infoQuinzena.ativa && (
                  <th style={{ padding: '8px 10px', textAlign: 'center', width: '85px', borderRight: '1px solid #d46a28' }}>DATA</th>
                )}
                <th style={{ padding: '8px 12px', textAlign: 'center', width: '90px', borderRight: '1px solid #d46a28' }}>CARGA</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', width: '85px', borderRight: '1px solid #d46a28' }}>ENTREGAS</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', width: '170px', borderRight: '1px solid #d46a28' }}>DESTINO</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', width: '100px', borderRight: '1px solid #d46a28' }}>PESO (KG)</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', width: '80px', borderRight: '1px solid #d46a28' }}>TIPO</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', width: '105px', borderRight: '1px solid #d46a28' }}>VEÍCULO</th>
                <th style={{ padding: '8px 14px', textAlign: 'center' }}>OBSERVAÇÃO</th>
              </tr>
            </thead>
            <tbody>
              {cargasTabela.map((item, idx) => {
                const isEven = idx % 2 === 0;
                return (
                  <tr 
                    key={`print_${item.docId}`} 
                    style={{ 
                      backgroundColor: isEven ? '#FFF2E8' : '#FDE7D9', 
                      color: '#1f2937',
                      borderBottom: '1px solid #e5c3b0'
                    }}
                  >
                    <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 'bold', borderRight: '1px solid #e5c3b0' }}>
                      {item.prioridade !== null && item.prioridade !== undefined ? item.prioridade : (idx + 1)}
                    </td>
                    {infoQuinzena.ativa && (
                      <td style={{ padding: '7px 10px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 'bold', borderRight: '1px solid #e5c3b0' }}>
                        {formatarData(item.data).slice(0, 5)}
                      </td>
                    )}
                    <td style={{ padding: '7px 12px', fontFamily: 'monospace', fontWeight: 'bold', borderRight: '1px solid #e5c3b0' }}>
                      {item.carga}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 'bold', fontFamily: 'monospace', borderRight: '1px solid #e5c3b0' }}>
                      {item.entregasCount}
                    </td>
                    <td style={{ padding: '7px 12px', fontWeight: '600', borderRight: '1px solid #e5c3b0' }}>
                      {item.destino}
                    </td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'monospace', borderRight: '1px solid #e5c3b0' }}>
                      {Number(item.pesoTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase', borderRight: '1px solid #e5c3b0' }}>
                      {item.tipo}
                    </td>
                    <td style={{ padding: '7px 12px', textAlign: 'center', fontFamily: 'monospace', fontWeight: '900', borderRight: '1px solid #e5c3b0' }}>
                      {item.placa || '-'}
                    </td>
                    <td style={{ padding: '7px 14px', fontSize: '11px', fontWeight: '500' }}>
                      {item.observacao || '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ProgramacaoCargas;
