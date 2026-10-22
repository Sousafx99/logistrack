import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
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
    salvarDadosCargaProgramacao,
    sincronizarDespesaProgramacao
  } = useStore();

  const printPngRef = useRef(null);
  const datePickerRef = useRef(null);
  const [exportandoPng, setExportandoPng] = useState(false);
  const [buscaTexto, setBuscaTexto] = useState('');
  const [salvandoItem, setSalvandoItem] = useState({});
  const [mensagemSucesso, setMensagemSucesso] = useState(null);

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

  const handleSelecionarData = (d) => {
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
      const novoYmd = d.toISOString().split('T')[0];
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
      if (cp.id) map.set(String(cp.id).trim(), cp);
      if (cp.carga && cp.data) map.set(`${cp.data}_${cp.carga}`, cp);
      if (cp.carga) map.set(String(cp.carga).trim(), cp);
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

  // Agrupamento consolidado das Cargas do dia selecionado
  const cargasTabela = useMemo(() => {
    const cargasMap = {};

    (entregas || []).forEach(e => {
      if (e.data !== dataAtiva) return;
      const c = String(e.carga || '').trim();
      if (!c || c === '0' || c.toLowerCase() === 'sem carga') return;

      if (!cargasMap[c]) {
        cargasMap[c] = {
          carga: c,
          data: dataAtiva,
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

      cargasMap[c].entregasCount += 1;
      cargasMap[c].pesoTotal += Number(e.peso || 0);
      cargasMap[c].valorTotal += Number(e.valor || 0);
      if (e.placa && e.placa.trim() && e.placa !== 'SEM PLACA') {
        cargasMap[c].placasSet.add(e.placa.trim().toUpperCase());
      }
      if (e.rota) {
        cargasMap[c].destinosSet.add(String(e.rota).trim().toUpperCase());
      }
      if (e.priCarregamento !== undefined && e.priCarregamento !== null) {
        cargasMap[c].priCarregamentoSet.add(Number(e.priCarregamento));
      }
      if (e.observacaoProgramacao) {
        cargasMap[c].observacoesSet.add(String(e.observacaoProgramacao).trim());
      }
      cargasMap[c].pedidos.push(e);
    });

    const lista = Object.values(cargasMap).map((c) => {
      const docId = `${dataAtiva}_${c.carga}`;
      const progSalva = progMap.get(docId) || progMap.get(c.carga) || {};

      // Placa efetiva: prioriza monitoramento
      const placasArray = Array.from(c.placasSet);
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
      const destinoFormatado = progSalva.destino || (destinosArray.length > 0 ? destinosArray.join(', ') : 'SDR-CENTRO');
      const destUpper = String(destinoFormatado || '').trim().toUpperCase();

      // Identifica se a rota é fora de Salvador (RMS, INT ou termos fora da capital)
      const isForaSdr = !destUpper.startsWith('SDR') 
        || destUpper.startsWith('RMS') 
        || destUpper.startsWith('INT') 
        || destUpper.includes('FEIRA') 
        || destUpper.includes('FSA') 
        || destUpper.includes('INTERIOR') 
        || destUpper.includes('CANDEIAS') 
        || destUpper.includes('CAMACARI') 
        || destUpper.includes('LAURO') 
        || destUpper.includes('VALENCA') 
        || destUpper.includes('ALAGOINHAS')
        || destUpper.includes('CDMIXBAHIA')
        || destUpper.includes('SMF');

      // Busca KM registrado / previsto no sistema para esta carga
      const cLimpa = String(c.carga).trim();
      const pLimpa = String(placaEfetiva || '').trim().toUpperCase();
      const kmReg = kmRegistrosMap.get(`${dataAtiva}_${cLimpa}`)
        || (pLimpa ? kmRegistrosMap.get(`${dataAtiva}_${pLimpa}_${cLimpa}`) : null)
        || (pLimpa ? kmRegistrosMap.get(`${dataAtiva}_${pLimpa.replace(/[\/\\]/g, '-')}_${cLimpa.replace(/[\/\\]/g, '-')}`) : null)
        || kmRegistrosMap.get(`carga_${cLimpa}`)
        || kmRegistrosMap.get(cLimpa)
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
        if (dData !== dataAtiva) return false;
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
        data: dataAtiva,
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

    // Ordenação ESTRITA por PRI.CARREG. (ordem de carregamento da planilha)
    return lista.sort((a, b) => {
      const priA = (a.prioridade !== null && a.prioridade !== undefined) ? Number(a.prioridade) : 9999;
      const priB = (b.prioridade !== null && b.prioridade !== undefined) ? Number(b.prioridade) : 9999;
      if (priA !== priB) return priA - priB;
      return a.carga.localeCompare(b.carga);
    });
  }, [entregas, dataAtiva, progMap, veiculosMap, configDiarias, despesas, kmRegistrosMap]);

  // Sincroniza automaticamente despesas de KM Rodado com a aba Custos caso haja KM previsto/calculado
  useEffect(() => {
    cargasTabela.forEach(c => {
      if (c.km > 0 && c.valorKm > 0) {
        const docId = `despesa_prog_${c.data}_${c.carga}_km_rodado`;
        const despesaExistente = (despesas || []).find(d => d.id === docId);
        if (!despesaExistente || Number(despesaExistente.valor) !== Number(c.valorKm)) {
          sincronizarDespesaProgramacao({
            data: c.data,
            carga: c.carga,
            placa: c.placa,
            tipoChave: 'km_rodado',
            tipoNome: 'KM Rodado (Fora SDR)',
            valor: c.valorKm,
            observacao: `Programação Carga ${c.carga} - ${c.km} km @ R$ 2,00/km`
          });
        }
      }
    });
  }, [cargasTabela, despesas, sincronizarDespesaProgramacao]);

  // Filtro de busca na tabela
  const cargasFiltradas = useMemo(() => {
    if (!buscaTexto.trim()) return cargasTabela;
    const termo = buscaTexto.trim().toUpperCase();
    return cargasTabela.filter(c => 
      c.carga.includes(termo) ||
      c.placa.includes(termo) ||
      c.destino.toUpperCase().includes(termo) ||
      c.tipo.toUpperCase().includes(termo) ||
      c.observacao.toUpperCase().includes(termo)
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
      } else if (campo === 'km') {
        const kmNum = parseFloat(valor) || 0;
        const valKm = Number((kmNum * 2).toFixed(2));
        await sincronizarDespesaProgramacao({
          data: item.data,
          carga: item.carga,
          placa: item.placa,
          tipoChave: 'km_rodado',
          tipoNome: 'KM Rodado (Fora SDR)',
          valor: valKm,
          observacao: `Programação Carga ${item.carga} - ${kmNum} km @ R$ 2,00/km`
        });
      }
    } catch (err) {
      console.error('Erro ao salvar campo:', err);
    }
  };

  // Exportar para Planilha Excel
  const handleExportarExcel = () => {
    if (cargasTabela.length === 0) {
      alert('Nenhuma carga para exportar.');
      return;
    }

    const rows = [
      ['DATA:', formatarData(dataAtiva), '', 'TOTAL ENTREGAS:', totaisGerais.totalEntregas, '', 'PESO TOTAL (KG):', totaisGerais.pesoTotal, '', 'FATURAMENTO TOTAL:', totaisGerais.faturamentoTotal, '', '% FRETE GERAL:', `${totaisGerais.percentualFreteGeral.toFixed(2)}%`],
      [],
      ['PRI.CARREG.', 'CARGA', 'ENTREGAS', 'DESTINO', 'PESO (KG)', 'TIPO', 'VEICULO', 'OBSERVAÇÃO', 'DESCARGA (R$)', 'AJUDANTE (R$)', 'PERNOITE (R$)', 'PEDÁGIO (R$)', 'DIÁRIA EXTRA', 'KM', 'CUSTO KM (R$ 2/KM)', 'TOTAL DESPESA (R$)', 'FATURAMENTO (R$)', '% CUSTO FRETE']
    ];

    cargasTabela.forEach(c => {
      rows.push([
        c.prioridade !== null && c.prioridade !== undefined ? c.prioridade : '-',
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
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Programacao_${dataAtiva}`);
    XLSX.writeFile(wb, `programacao_cargas_${dataAtiva}.xlsx`);
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
      const link = document.createElement('a');
      link.download = `programacao_cargas_${dataAtiva}.png`;
      link.href = dataUrl;
      link.click();
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
    <div className="space-y-3 pb-12 font-sans">
      {/* 1. BARRA DE FILTROS & AÇÕES DE EXPORTAÇÃO */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-background-primary p-2.5 sm:p-3 rounded-xl border border-border-secondary shadow-xs">
        {/* Seletor de Datas Aperfeiçoado */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-wrap">
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background-secondary hover:bg-background-tertiary border border-border-secondary hover:border-[#C25916] text-text-primary text-xs font-bold transition-all cursor-pointer shadow-xs"
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

          <div className="h-4 w-px bg-border-secondary mx-1 shrink-0" />

          {/* Pílulas Diretas das Datas com Carga */}
          {datasDisponiveis.map(({ data, count }) => {
            const isSelected = data === dataAtiva;
            const hojeYmd = new Date().toISOString().split('T')[0];
            const amanhaDate = new Date();
            amanhaDate.setDate(amanhaDate.getDate() + 1);
            const amanhaYmd = amanhaDate.toISOString().split('T')[0];

            let tagLabel = '';
            if (data === hojeYmd) tagLabel = 'Hoje';
            else if (data === amanhaYmd) tagLabel = 'Amanhã';

            return (
              <button
                key={data}
                onClick={() => handleSelecionarData(data)}
                className={cn(
                  "px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border whitespace-nowrap shadow-xs shrink-0 flex items-center gap-1.5 cursor-pointer",
                  isSelected
                    ? "bg-[#C25916] text-white border-[#C25916] shadow-sm shadow-[#C25916]/30 font-black"
                    : "bg-background-secondary text-text-secondary border-border-secondary hover:border-[#C25916] hover:text-text-primary"
                )}
              >
                <span>{formatarData(data)}</span>
                {tagLabel && (
                  <span className={cn(
                    "text-[9px] uppercase px-1 rounded font-black",
                    isSelected ? "bg-white/20 text-white" : "bg-[#C25916]/15 text-[#C25916]"
                  )}>
                    {tagLabel}
                  </span>
                )}
                <span className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                  isSelected ? "bg-white/20 text-white" : "bg-border-tertiary text-text-tertiary"
                )}>
                  {count} ent.
                </span>
              </button>
            );
          })}

          {/* Se a data ativa for um dia sem entregas, mostra badge com X */}
          {!datasDisponiveis.some(d => d.data === dataAtiva) && (
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

        {/* Busca e Ações de Exportar */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Busca */}
          <div className="flex items-center bg-background-secondary border border-border-secondary rounded-lg px-2.5 py-1 text-xs text-text-primary w-full sm:w-56 focus-within:border-[#C25916]">
            <Search size={13} className="text-text-tertiary mr-1.5 shrink-0" />
            <input 
              type="text" 
              placeholder="Buscar carga, placa, rota..."
              value={buscaTexto}
              onChange={(e) => setBuscaTexto(e.target.value)}
              className="w-full bg-transparent border-none p-0 focus:outline-hidden text-xs"
            />
          </div>

          {/* Botão Exportar Imagem PNG */}
          <button
            onClick={handleExportarPng}
            disabled={exportandoPng || cargasTabela.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C25916] hover:bg-[#a7460c] text-white text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
            title="Exportar imagem PNG da escala (colunas Pri até Observação)"
          >
            {exportandoPng ? (
              <RefreshCw size={13} className="animate-spin" />
            ) : (
              <ImageIcon size={13} />
            )}
            <span>Exportar Imagem</span>
          </button>

          {/* Botão Exportar Excel */}
          <button
            onClick={handleExportarExcel}
            disabled={cargasTabela.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background-secondary hover:bg-background-tertiary border border-border-secondary text-text-primary text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
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

      {/* 2. FAIXA SUPERIOR TEMÁTICA LARANJA COM TOTAIS */}
      <div className="bg-[#C25916] text-white rounded-xl px-4 py-3 shadow-md border border-[#a7460c]">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 items-center text-center sm:text-left">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-200">Data Programação</p>
            <p className="text-base sm:text-lg font-black tracking-tight">{formatarData(dataAtiva)}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-200">Cargas</p>
            <p className="text-base sm:text-lg font-black font-mono">{totaisGerais.totalCargas}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-200">Total Entregas</p>
            <p className="text-base sm:text-lg font-black font-mono">{totaisGerais.totalEntregas}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-200">Peso Total (KG)</p>
            <p className="text-base sm:text-lg font-black font-mono">{formatarPeso(totaisGerais.pesoTotal)}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-200">Faturamento Total</p>
            <p className="text-base sm:text-lg font-black font-mono">{formatarMoeda(totaisGerais.faturamentoTotal)}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-200">Despesas / Diárias</p>
            <p className="text-base sm:text-lg font-black font-mono text-amber-200">{formatarMoeda(totaisGerais.despesasTotal)}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-200">% Custo Frete</p>
            <p className="text-base sm:text-lg font-black font-mono text-emerald-300">
              {totaisGerais.percentualFreteGeral.toFixed(2)}%
            </p>
          </div>
        </div>
      </div>

      {/* 3. TABELA OFICIAL ESTILO PLANILHA */}
      <div className="bg-background-primary border border-border-secondary rounded-xl overflow-hidden shadow-xs">
        {cargasFiltradas.length === 0 ? (
          <div className="py-12 text-center text-text-tertiary">
            <AlertTriangle className="mx-auto h-8 w-8 text-amber-500 mb-2 opacity-80" />
            <p className="text-sm font-bold text-text-secondary">Nenhuma carga encontrada para esta data.</p>
            <p className="text-xs text-text-tertiary mt-0.5">Selecione outra data com entregas na barra superior.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#C25916] text-white border-b border-[#a7460c] font-black text-[11px] tracking-wide select-none">
                  <th className="py-2.5 px-2 text-center w-12 border-r border-[#d46a28]">PRI.</th>
                  <th className="py-2.5 px-2.5 text-center w-20 border-r border-[#d46a28]">CARGA</th>
                  <th className="py-2.5 px-2 text-center w-14 border-r border-[#d46a28]">ENTREGAS</th>
                  <th className="py-2.5 px-3 text-center min-w-[140px] max-w-[200px] border-r border-[#d46a28]">DESTINO</th>
                  <th className="py-2.5 px-3 text-center w-24 border-r border-[#d46a28]">PESO (KG)</th>
                  <th className="py-2.5 px-2.5 text-center w-16 border-r border-[#d46a28]">TIPO</th>
                  <th className="py-2.5 px-3 text-center w-28 border-r border-[#d46a28]">VEÍCULO</th>
                  <th className="py-2.5 px-3 text-center min-w-[280px] border-r border-[#d46a28]">OBSERVAÇÃO</th>
                  <th className="py-2.5 px-2 text-center w-20 border-r border-[#d46a28] bg-[#B04C0F]">DESCARGA</th>
                  <th className="py-2.5 px-2 text-center w-20 border-r border-[#d46a28] bg-[#B04C0F]">AJUDANTE</th>
                  <th className="py-2.5 px-2 text-center w-20 border-r border-[#d46a28] bg-[#B04C0F]">PERNOITE</th>
                  <th className="py-2.5 px-2 text-center w-20 border-r border-[#d46a28] bg-[#B04C0F]">PEDÁGIO</th>
                  <th className="py-2.5 px-2 text-center w-28 border-r border-[#d46a28] bg-[#B04C0F]">DIÁRIA EXTRA</th>
                  <th className="py-2.5 px-2 text-center w-28 border-r border-[#d46a28] bg-[#B04C0F]">KM (R$ 2/KM)</th>
                  <th className="py-2.5 px-3 text-center min-w-[110px] border-r border-[#d46a28] bg-[#993D06]">TOTAL DESPESA</th>
                  <th className="py-2.5 px-3 text-center min-w-[120px] border-r border-[#d46a28] bg-[#873403]">FATURAMENTO</th>
                  <th className="py-2.5 px-2 text-center w-20 bg-[#742b01]">% FRETE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-secondary">
                {cargasFiltradas.map((item, idx) => {
                  const salvando = salvandoItem[item.docId];
                  return (
                    <tr 
                      key={item.docId} 
                      className={cn(
                        "transition-colors text-xs",
                        idx % 2 === 0 ? "bg-background-primary" : "bg-background-secondary/30",
                        "hover:bg-[#C25916]/5 dark:hover:bg-white/5"
                      )}
                    >
                      {/* PRI.CARREG. (EDITÁVEL PELO USUÁRIO) */}
                      <td className="py-1 px-1.5 text-center border-r border-border-secondary/60">
                        <input 
                          type="number"
                          min="1"
                          max="99"
                          defaultValue={item.prioridade !== null && item.prioridade !== undefined ? item.prioridade : ''}
                          key={`pri_${item.docId}_${item.prioridade}`}
                          placeholder="—"
                          onBlur={(e) => {
                            const v = parseInt(e.target.value, 10);
                            handleSalvarCampo(item, 'prioridade', isNaN(v) ? null : v);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.target.blur();
                          }}
                          className="w-10 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 focus:bg-background-primary border border-transparent hover:border-border-secondary focus:border-[#C25916] rounded px-1 py-0.5 text-xs font-bold text-center text-text-primary focus:outline-hidden transition-all"
                          title="Clique para editar a prioridade de carregamento"
                        />
                      </td>

                      {/* CARGA */}
                      <td className="py-1.5 px-2 text-center font-mono font-bold text-text-primary whitespace-nowrap border-r border-border-secondary/60">
                        {item.carga}
                      </td>

                      {/* ENTREGAS */}
                      <td className="py-1.5 px-2 text-center font-mono font-bold text-text-primary border-r border-border-secondary/60">
                        {item.entregasCount}
                      </td>

                      {/* DESTINO */}
                      <td className="py-1.5 px-3 text-text-primary font-medium truncate max-w-[200px] border-r border-border-secondary/60" title={item.destino}>
                        {item.destino}
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
                            key={`placa_${item.carga}_${item.placa}`}
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
                DATA PROGRAMAÇÃO
              </span>
              <span style={{ fontSize: '20px', fontWeight: '900', letterSpacing: '-0.02em' }}>
                {formatarData(dataAtiva)}
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
                    key={`print_${item.carga}`} 
                    style={{ 
                      backgroundColor: isEven ? '#FFF2E8' : '#FDE7D9', 
                      color: '#1f2937',
                      borderBottom: '1px solid #e5c3b0'
                    }}
                  >
                    <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 'bold', borderRight: '1px solid #e5c3b0' }}>
                      {item.prioridade !== null && item.prioridade !== undefined ? item.prioridade : (idx + 1)}
                    </td>
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
