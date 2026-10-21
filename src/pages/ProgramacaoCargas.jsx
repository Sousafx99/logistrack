import React, { useState, useMemo, useCallback } from 'react';
import { 
  FileSpreadsheet, 
  Calendar, 
  Truck, 
  Package, 
  Weight, 
  DollarSign, 
  FileText, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Plus, 
  Edit3, 
  ArrowUpDown,
  RefreshCw
} from 'lucide-react';
import * as XLSX from 'xlsx';
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

export function ProgramacaoCargas() {
  const { 
    entregas = [], 
    veiculos = [], 
    configDiarias, 
    cargasProgramacao = [],
    globalFilters,
    setGlobalFilters,
    transferirPlacaPorCarga,
    salvarDadosCargaProgramacao
  } = useStore();

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

  // Data ativa selecionada (padrão: data dos filtros globais ou primeira com carga)
  const dataAtiva = useMemo(() => {
    const dGlobal = globalFilters.visaoMonitoramento?.datas?.[0] || globalFilters.data;
    if (dGlobal && dGlobal !== 'TODAS') return dGlobal;
    if (datasDisponiveis.length > 0) return datasDisponiveis[0].data;
    return new Date().toISOString().split('T')[0];
  }, [globalFilters, datasDisponiveis]);

  const [buscaTexto, setBuscaTexto] = useState('');
  const [salvandoItem, setSalvandoItem] = useState({});
  const [mensagemSucesso, setMensagemSucesso] = useState(null);

  // Selecionar data
  const handleSelecionarData = (d) => {
    setGlobalFilters({
      data: d,
      visaoMonitoramento: {
        ...globalFilters.visaoMonitoramento,
        datas: [d]
      }
    });
  };

  // Mapa de veículos cadastrados para consulta de diária e tipo
  const veiculosMap = useMemo(() => {
    const map = new Map();
    (veiculos || []).forEach(v => {
      const p = String(v.placa || v.id || '').trim().toUpperCase();
      if (p) map.set(p, v);
    });
    return map;
  }, [veiculos]);

  // Mapa de dados extras salvos da programação (observações e despesas por docId)
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
      cargasMap[c].pedidos.push(e);
    });

    const lista = Object.values(cargasMap).map((c, idx) => {
      const docId = `${dataAtiva}_${c.carga}`;
      const progSalva = progMap.get(docId) || progMap.get(c.carga) || {};

      // Placa: prioriza a placa atual das entregas no monitoramento
      const placasArray = Array.from(c.placasSet);
      const placaEfetiva = placasArray.length > 0 ? placasArray[0] : (progSalva.placa || '');

      // Dados do veículo
      const vCadastrado = veiculosMap.get(placaEfetiva);
      const tipoVeiculo = progSalva.tipo || vCadastrado?.tipo || '3/4';
      const preset = getPresetPorTipo(tipoVeiculo, configDiarias?.tabela);
      const valorDiariaBase = vCadastrado?.valorDiaria !== undefined && vCadastrado?.valorDiaria !== '' && !isNaN(Number(vCadastrado.valorDiaria))
        ? Number(vCadastrado.valorDiaria)
        : Number(preset.valorDiaria || 0);

      // Despesas
      const descarga = Number(progSalva.descarga || 0);
      const ajudante = Number(progSalva.ajudante || 0);
      const pernoite = Number(progSalva.pernoite || 0);
      const pedagio = Number(progSalva.pedagio || 0);
      const diariaExtraTipo = progSalva.diariaExtraTipo || 'nenhuma'; // 'nenhuma' | 'meia' | 'uma'

      let diariaExtraValor = 0;
      if (diariaExtraTipo === 'meia') {
        diariaExtraValor = valorDiariaBase * 0.5;
      } else if (diariaExtraTipo === 'uma') {
        diariaExtraValor = valorDiariaBase * 1.0;
      }

      const totalDespesas = descarga + ajudante + pernoite + pedagio + diariaExtraValor;

      const destinosArray = Array.from(c.destinosSet);
      const destinoFormatado = progSalva.destino || (destinosArray.length > 0 ? destinosArray.join(', ') : 'SDR-CENTRO');

      return {
        docId,
        prioridade: progSalva.prioridade !== undefined ? progSalva.prioridade : (idx + 1),
        carga: c.carga,
        data: dataAtiva,
        entregasCount: c.entregasCount,
        destino: destinoFormatado,
        pesoTotal: c.pesoTotal,
        tipo: tipoVeiculo,
        placa: placaEfetiva,
        observacao: progSalva.observacao || '',
        descarga,
        ajudante,
        pernoite,
        pedagio,
        diariaExtraTipo,
        valorDiariaBase,
        diariaExtraValor,
        totalDespesas
      };
    });

    // Ordena por prioridade
    return lista.sort((a, b) => Number(a.prioridade || 999) - Number(b.prioridade || 999));
  }, [entregas, dataAtiva, progMap, veiculosMap, configDiarias]);

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
      setMensagemSucesso(`Placa da carga ${item.carga} atualizada para ${pUpper} no Monitoramento!`);
      setTimeout(() => setMensagemSucesso(null), 4000);
    } catch (err) {
      console.error(err);
      alert(`Erro ao atualizar placa: ${err.message}`);
    } finally {
      setSalvandoItem(prev => ({ ...prev, [item.docId]: false }));
    }
  };

  // Alterar Campo de Despesa ou Observação
  const handleSalvarCampo = async (item, campo, valor) => {
    try {
      await salvarDadosCargaProgramacao(item.docId, {
        carga: item.carga,
        data: item.data,
        placa: item.placa,
        tipo: item.tipo,
        destino: item.destino,
        prioridade: item.prioridade,
        [campo]: valor
      });
    } catch (err) {
      console.error('Erro ao salvar campo:', err);
    }
  };

  // Exportar para Planilha Excel idêntica ao modelo
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
        c.prioridade,
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

  return (
    <div className="space-y-4 pb-12">
      {/* 1. TOPO: Identificação e Ações */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-background-primary p-4 rounded-2xl border border-border-secondary shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner shrink-0">
            <FileSpreadsheet size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-text-primary tracking-tight">
                Programação de Cargas
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                Sincronizado com Monitoramento
              </span>
            </div>
            <p className="text-xs text-text-secondary">
              Escala de carregamento, alocação de veículos e custos extras da operação
            </p>
          </div>
        </div>

        {/* Botão de Exportar */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={handleExportarExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-background-secondary hover:bg-background-tertiary border border-border-secondary text-text-primary text-xs font-bold transition-all cursor-pointer shadow-xs"
            title="Baixar planilha Excel da programação"
          >
            <Download size={14} className="text-emerald-500" />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* 2. SELETOR DE DATAS COM CARGA */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-background-primary/80 p-3 rounded-xl border border-border-secondary">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-wrap">
          <span className="text-xs uppercase font-bold text-text-tertiary mr-1">Data:</span>
          {datasDisponiveis.map(({ data, count }) => {
            const isSelected = data === dataAtiva;
            return (
              <button
                key={data}
                onClick={() => handleSelecionarData(data)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border whitespace-nowrap shadow-xs shrink-0 flex items-center gap-1.5 cursor-pointer",
                  isSelected
                    ? "bg-primary text-white border-primary shadow-primary/20"
                    : "bg-background-secondary text-text-secondary border-border-secondary hover:border-primary hover:text-text-primary"
                )}
              >
                <Calendar size={13} className={isSelected ? "text-white" : "text-primary"} />
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

        {/* Busca Rápida na Tabela */}
        <div className="flex items-center bg-background-secondary border border-border-secondary rounded-xl px-3 py-1.5 text-xs text-text-primary w-full sm:w-64 focus-within:border-primary">
          <Search size={14} className="text-text-tertiary mr-2 shrink-0" />
          <input 
            type="text" 
            placeholder="Buscar carga, placa, rota..."
            value={buscaTexto}
            onChange={(e) => setBuscaTexto(e.target.value)}
            className="w-full bg-transparent border-none p-0 focus:outline-hidden text-xs"
          />
        </div>
      </div>

      {/* Toast de Confirmação */}
      {mensagemSucesso && (
        <div className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200 shadow-sm">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{mensagemSucesso}</span>
        </div>
      )}

      {/* 3. FAIXA SUPERIOR LARANJA DE TOTAIS (IDÊNTICA À PLANILHA OFICIAL) */}
      <div className="bg-gradient-to-r from-[#b45309] via-[#c25e1a] to-[#9a3412] text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-amber-600/40">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4 items-center">
          {/* Data */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-200">Data Programação</p>
            <p className="text-lg sm:text-2xl font-black tracking-tight">{formatarData(dataAtiva)}</p>
          </div>

          {/* Cargas */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-200">Total Cargas ERP</p>
            <p className="text-lg sm:text-2xl font-black tracking-tight">{totaisGerais.totalCargas}</p>
          </div>

          {/* Entregas */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-200">Total Entregas</p>
            <p className="text-lg sm:text-2xl font-black tracking-tight">{totaisGerais.totalEntregas}</p>
          </div>

          {/* Peso */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-200">Peso Total (KG)</p>
            <p className="text-lg sm:text-2xl font-black tracking-tight">{formatarPeso(totaisGerais.pesoTotal)}</p>
          </div>

          {/* Despesas Extras */}
          <div className="col-span-2 sm:col-span-4 lg:col-span-1 border-t lg:border-t-0 lg:border-l border-amber-400/30 pt-2 lg:pt-0 lg:pl-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-200">Despesas / Diárias</p>
            <p className="text-lg sm:text-2xl font-black tracking-tight text-amber-300">
              {formatarMoeda(totaisGerais.despesasTotal)}
            </p>
          </div>
        </div>
      </div>

      {/* 4. TABELA OFICIAL DE PROGRAMAÇÃO DE CARGAS */}
      <div className="bg-background-primary rounded-2xl border border-border-secondary shadow-sm overflow-hidden">
        {cargasFiltradas.length === 0 ? (
          <div className="py-16 text-center text-text-tertiary">
            <AlertTriangle className="mx-auto h-10 w-10 text-amber-400 mb-2 opacity-60" />
            <p className="text-sm font-bold text-text-secondary">Nenhuma carga encontrada para esta data.</p>
            <p className="text-xs text-text-tertiary mt-1">Importe a prévia ou selecione outro dia no topo.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-background-secondary/90 text-text-secondary border-b border-border-secondary select-none font-bold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-3 text-center w-12">Pri.</th>
                  <th className="py-3 px-3">Carga ERP</th>
                  <th className="py-3 px-3 text-center">Entregas</th>
                  <th className="py-3 px-3 min-w-[150px]">Destino / Rota</th>
                  <th className="py-3 px-3 text-right">Peso (KG)</th>
                  <th className="py-3 px-3 text-center">Tipo</th>
                  <th className="py-3 px-3 min-w-[140px] text-primary">Veículo (Placa) *</th>
                  <th className="py-3 px-3 min-w-[180px]">Observação *</th>
                  <th className="py-3 px-3 text-right">Descarga</th>
                  <th className="py-3 px-3 text-right">Ajudante</th>
                  <th className="py-3 px-3 text-right">Pernoite</th>
                  <th className="py-3 px-3 text-right">Pedágio</th>
                  <th className="py-3 px-3 text-center min-w-[130px]">Diária Extra</th>
                  <th className="py-3 px-3 text-right font-black text-amber-400">Total Despesa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-secondary/60">
                {cargasFiltradas.map((item) => {
                  const salvando = salvandoItem[item.docId];
                  return (
                    <tr 
                      key={item.docId} 
                      className="hover:bg-background-secondary/50 transition-colors"
                    >
                      {/* Prioridade */}
                      <td className="py-2.5 px-3 text-center font-bold text-text-tertiary">
                        {item.prioridade}
                      </td>

                      {/* Carga ERP */}
                      <td className="py-2.5 px-3 font-mono font-bold text-text-primary whitespace-nowrap">
                        {item.carga}
                      </td>

                      {/* Quantidade de Entregas */}
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-info/10 text-info font-bold text-[11px]">
                          {item.entregasCount}
                        </span>
                      </td>

                      {/* Destino */}
                      <td className="py-2.5 px-3 font-semibold text-text-primary whitespace-nowrap">
                        {item.destino}
                      </td>

                      {/* Peso Total */}
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-text-secondary whitespace-nowrap">
                        {formatarPeso(item.pesoTotal)}
                      </td>

                      {/* Tipo de Veículo */}
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-background-secondary border border-border-secondary text-[11px] font-bold text-text-secondary uppercase">
                          {item.tipo}
                        </span>
                      </td>

                      {/* VEÍCULO (PLACA) - EDITÁVEL EM TEMPO REAL */}
                      <td className="py-2.5 px-3">
                        <div className="relative flex items-center">
                          <input 
                            type="text"
                            defaultValue={item.placa}
                            key={item.placa}
                            placeholder="Placa..."
                            onBlur={(e) => handleAlterarPlaca(item, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.target.blur();
                              }
                            }}
                            className={cn(
                              "w-28 px-2 py-1 rounded-lg text-xs font-mono font-black uppercase tracking-wider border transition-all text-center",
                              item.placa && item.placa !== 'SEM PLACA'
                                ? "bg-amber-500/10 border-amber-500/40 text-amber-400 focus:ring-1 focus:ring-amber-500"
                                : "bg-rose-500/10 border-rose-500/40 text-rose-400 focus:ring-1 focus:ring-rose-500"
                            )}
                            title="Alterar placa atualiza automaticamente todas as entregas desta carga no Monitoramento"
                          />
                          {salvando && (
                            <RefreshCw size={12} className="animate-spin text-amber-400 ml-1.5 shrink-0" />
                          )}
                        </div>
                      </td>

                      {/* OBSERVAÇÃO - EDITÁVEL */}
                      <td className="py-2.5 px-3">
                        <input 
                          type="text"
                          defaultValue={item.observacao}
                          key={item.observacao}
                          placeholder="Adicionar observação..."
                          onBlur={(e) => handleSalvarCampo(item, 'observacao', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.target.blur();
                          }}
                          className="w-full min-w-[160px] bg-background-secondary border border-border-secondary rounded-lg px-2.5 py-1 text-xs text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-hidden"
                        />
                      </td>

                      {/* Descarga (R$) */}
                      <td className="py-2.5 px-3 text-right">
                        <input 
                          type="number"
                          step="0.01"
                          defaultValue={item.descarga > 0 ? item.descarga : ''}
                          key={`desc_${item.docId}_${item.descarga}`}
                          placeholder="0,00"
                          onBlur={(e) => handleSalvarCampo(item, 'descarga', parseFloat(e.target.value) || 0)}
                          className="w-18 bg-background-secondary border border-border-secondary rounded-lg px-2 py-1 text-xs text-right font-mono text-text-primary focus:border-primary focus:outline-hidden"
                        />
                      </td>

                      {/* Ajudante (R$) */}
                      <td className="py-2.5 px-3 text-right">
                        <input 
                          type="number"
                          step="0.01"
                          defaultValue={item.ajudante > 0 ? item.ajudante : ''}
                          key={`ajud_${item.docId}_${item.ajudante}`}
                          placeholder="0,00"
                          onBlur={(e) => handleSalvarCampo(item, 'ajudante', parseFloat(e.target.value) || 0)}
                          className="w-18 bg-background-secondary border border-border-secondary rounded-lg px-2 py-1 text-xs text-right font-mono text-text-primary focus:border-primary focus:outline-hidden"
                        />
                      </td>

                      {/* Pernoite (R$) */}
                      <td className="py-2.5 px-3 text-right">
                        <input 
                          type="number"
                          step="0.01"
                          defaultValue={item.pernoite > 0 ? item.pernoite : ''}
                          key={`pern_${item.docId}_${item.pernoite}`}
                          placeholder="0,00"
                          onBlur={(e) => handleSalvarCampo(item, 'pernoite', parseFloat(e.target.value) || 0)}
                          className="w-18 bg-background-secondary border border-border-secondary rounded-lg px-2 py-1 text-xs text-right font-mono text-text-primary focus:border-primary focus:outline-hidden"
                        />
                      </td>

                      {/* Pedágio (R$) */}
                      <td className="py-2.5 px-3 text-right">
                        <input 
                          type="number"
                          step="0.01"
                          defaultValue={item.pedagio > 0 ? item.pedagio : ''}
                          key={`ped_${item.docId}_${item.pedagio}`}
                          placeholder="0,00"
                          onBlur={(e) => handleSalvarCampo(item, 'pedagio', parseFloat(e.target.value) || 0)}
                          className="w-18 bg-background-secondary border border-border-secondary rounded-lg px-2 py-1 text-xs text-right font-mono text-text-primary focus:border-primary focus:outline-hidden"
                        />
                      </td>

                      {/* Diária Extra (Seletor) */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <select
                            value={item.diariaExtraTipo}
                            onChange={(e) => handleSalvarCampo(item, 'diariaExtraTipo', e.target.value)}
                            className="bg-background-secondary border border-border-secondary rounded-lg px-2 py-1 text-xs font-bold text-text-primary cursor-pointer focus:border-primary focus:outline-hidden"
                          >
                            <option value="nenhuma">Nenhuma</option>
                            <option value="meia">1/2 Diária (+{formatarMoeda(item.valorDiariaBase * 0.5)})</option>
                            <option value="uma">1 Diária (+{formatarMoeda(item.valorDiariaBase)})</option>
                          </select>
                        </div>
                      </td>

                      {/* Total Custo da Carga */}
                      <td className="py-2.5 px-3 text-right font-mono font-black text-amber-400 whitespace-nowrap">
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

      <div className="text-[11px] text-text-tertiary flex items-center justify-between px-2">
        <p>* As alterações de placa são sincronizadas imediatamente com a visão de entregas e o dashboard.</p>
        <p>Valores de diária base calculados conforme a tabela oficial de diárias da RJ Alimentos.</p>
      </div>
    </div>
  );
}
export default ProgramacaoCargas;
