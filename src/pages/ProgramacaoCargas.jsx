import React, { useState, useMemo, useRef, useCallback } from 'react';
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
  RefreshCw
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
    globalFilters,
    setGlobalFilters,
    transferirPlacaPorCarga,
    salvarDadosCargaProgramacao,
    sincronizarDespesaProgramacao
  } = useStore();

  const printPngRef = useRef(null);
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
    });
    return map;
  }, [cargasProgramacao]);

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
      if (e.priCarregamento) {
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

      const subtotalProg = descarga + ajudante + pernoite + pedagio + diariaExtraValor;

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

      const destinosArray = Array.from(c.destinosSet);
      const destinoFormatado = progSalva.destino || (destinosArray.length > 0 ? destinosArray.join(', ') : 'SDR-CENTRO');

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
        totalDespesas
      };
    });

    // Ordenação ESTRITA por PRI.CARREG. (ordem de carregamento da planilha)
    return lista.sort((a, b) => {
      const priA = (a.prioridade !== null && a.prioridade !== undefined) ? Number(a.prioridade) : 9999;
      const priB = (b.prioridade !== null && b.prioridade !== undefined) ? Number(b.prioridade) : 9999;
      if (priA !== priB) return priA - priB;
      return a.carga.localeCompare(b.carga);
    });
  }, [entregas, dataAtiva, progMap, veiculosMap, configDiarias, despesas]);

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

    cargasTabela.forEach(c => {
      entregasSoma += c.entregasCount;
      pesoSoma += c.pesoTotal;
      despesaSoma += c.totalDespesas;
    });

    return {
      totalCargas: cargasTabela.length,
      totalEntregas: entregasSoma,
      pesoTotal: pesoSoma,
      despesasTotal: despesaSoma
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

  // Alterar Campo de Despesa ou Observação (com sincronização direta para a aba Custos)
  const handleSalvarCampo = async (item, campo, valor) => {
    try {
      // 1. Salva na programação
      await salvarDadosCargaProgramacao(item.docId, {
        carga: item.carga,
        data: item.data,
        placa: item.placa,
        tipo: item.tipo,
        destino: item.destino,
        prioridade: item.prioridade,
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
  const handleExportarExcel = () => {
    if (cargasTabela.length === 0) {
      alert('Nenhuma carga para exportar.');
      return;
    }

    const rows = [
      ['DATA:', formatarData(dataAtiva), '', 'TOTAL ENTREGAS:', totaisGerais.totalEntregas, '', 'PESO TOTAL (KG):', totaisGerais.pesoTotal],
      [],
      ['PRI.CARREG.', 'CARGA ERP', 'ENTREGAS', 'DESTINO', 'PESO (KG)', 'TIPO', 'VEICULO', 'OBSERVAÇÃO', 'DESCARGA (R$)', 'AJUDANTE (R$)', 'PERNOITE (R$)', 'PEDÁGIO (R$)', 'DIÁRIA EXTRA', 'TOTAL CUSTO (R$)']
    ];

    cargasTabela.forEach(c => {
      rows.push([
        c.prioridade || '-',
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
        Number(c.totalDespesas.toFixed(2))
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
        {/* Seletor de Datas */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-wrap">
          <span className="text-[11px] uppercase font-black text-text-tertiary mr-1 tracking-wider">Data:</span>
          {datasDisponiveis.map(({ data, count }) => {
            const isSelected = data === dataAtiva;
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
                <Calendar size={13} className={isSelected ? "text-white" : "text-[#C25916]"} />
                <span>{formatarData(data)}</span>
                <span className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                  isSelected ? "bg-white/20 text-white" : "bg-border-tertiary text-text-tertiary"
                )}>
                  {count} ent.
                </span>
              </button>
            );
          })}
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
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-200">Data Programação</p>
            <p className="text-base sm:text-xl font-black tracking-tight">{formatarData(dataAtiva)}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-200">Cargas ERP</p>
            <p className="text-base sm:text-xl font-black font-mono">{totaisGerais.totalCargas}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-200">Total Entregas</p>
            <p className="text-base sm:text-xl font-black font-mono">{totaisGerais.totalEntregas}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-200">Peso Total (KG)</p>
            <p className="text-base sm:text-xl font-black font-mono">{formatarPeso(totaisGerais.pesoTotal)}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-200">Despesas / Diárias</p>
            <p className="text-base sm:text-xl font-black font-mono text-amber-200">{formatarMoeda(totaisGerais.despesasTotal)}</p>
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
                  <th className="py-2.5 px-2.5 text-center w-12 border-r border-[#d46a28]">PRI.</th>
                  <th className="py-2.5 px-3 border-r border-[#d46a28]">CARGA ERP</th>
                  <th className="py-2.5 px-2 text-center border-r border-[#d46a28]">ENTREGAS</th>
                  <th className="py-2.5 px-3 border-r border-[#d46a28] min-w-[170px]">DESTINO</th>
                  <th className="py-2.5 px-3 text-right border-r border-[#d46a28] min-w-[90px]">PESO (KG)</th>
                  <th className="py-2.5 px-2.5 text-center border-r border-[#d46a28]">TIPO</th>
                  <th className="py-2.5 px-3 border-r border-[#d46a28] min-w-[120px]">VEICULO</th>
                  <th className="py-2.5 px-3 border-r border-[#d46a28] min-w-[180px]">OBSERVAÇÃO</th>
                  <th className="py-2.5 px-2 text-right border-r border-[#d46a28] min-w-[75px] bg-[#B04C0F]">DESCARGA</th>
                  <th className="py-2.5 px-2 text-right border-r border-[#d46a28] min-w-[75px] bg-[#B04C0F]">AJUDANTE</th>
                  <th className="py-2.5 px-2 text-right border-r border-[#d46a28] min-w-[75px] bg-[#B04C0F]">PERNOITE</th>
                  <th className="py-2.5 px-2 text-right border-r border-[#d46a28] min-w-[75px] bg-[#B04C0F]">PEDÁGIO</th>
                  <th className="py-2.5 px-2 text-center border-r border-[#d46a28] min-w-[110px] bg-[#B04C0F]">DIÁRIA EXTRA</th>
                  <th className="py-2.5 px-3 text-right bg-[#993D06] min-w-[110px]">TOTAL DESPESA</th>
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
                      {/* PRI.CARREG. */}
                      <td className="py-1.5 px-2.5 text-center font-bold text-text-secondary border-r border-border-secondary/60">
                        {item.prioridade !== null && item.prioridade !== undefined ? item.prioridade : '-'}
                      </td>

                      {/* CARGA ERP */}
                      <td className="py-1.5 px-3 font-mono font-bold text-text-primary whitespace-nowrap border-r border-border-secondary/60">
                        {item.carga}
                      </td>

                      {/* ENTREGAS */}
                      <td className="py-1.5 px-2 text-center font-mono font-bold text-text-primary border-r border-border-secondary/60">
                        {item.entregasCount}
                      </td>

                      {/* DESTINO */}
                      <td className="py-1.5 px-3 text-text-primary font-medium truncate max-w-[220px] border-r border-border-secondary/60" title={item.destino}>
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

                      {/* VEICULO (EDITÁVEL) */}
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

                      {/* OBSERVAÇÃO (EDITÁVEL) */}
                      <td className="py-1.5 px-2 border-r border-border-secondary/60">
                        <input 
                          type="text"
                          defaultValue={item.observacao}
                          key={`obs_${item.docId}_${item.observacao}`}
                          placeholder="—"
                          onBlur={(e) => handleSalvarCampo(item, 'observacao', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.target.blur();
                          }}
                          className="w-full bg-transparent hover:bg-black/5 dark:hover:bg-white/5 focus:bg-background-primary border border-transparent hover:border-border-secondary focus:border-[#C25916] rounded px-1.5 py-0.5 text-xs text-text-primary focus:outline-hidden transition-all"
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

                      {/* TOTAL DESPESA (Diária + Custos Programação + Custos Aba Custos) */}
                      <td className="py-1.5 px-3 text-right font-mono font-black text-amber-500 dark:text-amber-400 whitespace-nowrap bg-amber-500/5">
                        {formatarMoeda(item.totalDespesas)}
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
              <tr style={{ backgroundColor: '#C25916', color: '#ffffff', fontWeight: '900', textAlign: 'left', fontSize: '11px', letterSpacing: '0.04em' }}>
                <th style={{ padding: '8px 10px', textAlign: 'center', width: '70px', borderRight: '1px solid #d46a28' }}>PRI.CARREG.</th>
                <th style={{ padding: '8px 12px', width: '100px', borderRight: '1px solid #d46a28' }}>CARGA ERP</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', width: '85px', borderRight: '1px solid #d46a28' }}>ENTREGAS</th>
                <th style={{ padding: '8px 12px', borderRight: '1px solid #d46a28' }}>DESTINO</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', width: '100px', borderRight: '1px solid #d46a28' }}>PESO (KG)</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', width: '80px', borderRight: '1px solid #d46a28' }}>TIPO</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', width: '105px', borderRight: '1px solid #d46a28' }}>VEICULO</th>
                <th style={{ padding: '8px 14px' }}>OBSERVAÇÃO</th>
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
