import React, { useState, useMemo } from 'react';
import { 
  Truck, Search, Plus, Edit3, Trash2, Check, X, 
  Gauge, User, FileSpreadsheet, AlertTriangle, CheckCircle2,
  Phone, MessageSquare, Wrench, Shield, ExternalLink, DollarSign,
  Sparkles, Layers, SlidersHorizontal, RotateCcw, Save
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';

// Presets Originais de Fábrica
export const DEFAULT_PRESETS_VEICULOS = [
  { 
    tipo: '3/4', 
    label: '3/4 (VUC)', 
    valorDiaria: 757, 
    capacidadeKg: 4500, 
    capacidadePaletes: 6,
    badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
  },
  { 
    tipo: 'Bongo', 
    label: 'Bongo / HR', 
    valorDiaria: 520, 
    capacidadeKg: 1500, 
    capacidadePaletes: 0, // Fiorino e Bongo não carregam pallet
    badgeColor: 'bg-blue-500/15 text-blue-400 border-blue-500/30' 
  },
  { 
    tipo: 'Fiorino', 
    label: 'Fiorino / Van', 
    valorDiaria: 360, 
    capacidadeKg: 700, 
    capacidadePaletes: 0, // Fiorino e Bongo não carregam pallet
    badgeColor: 'bg-purple-500/15 text-purple-400 border-purple-500/30' 
  },
  { 
    tipo: 'Toco', 
    label: 'Toco', 
    valorDiaria: 950, 
    capacidadeKg: 6000, 
    capacidadePaletes: 8,
    badgeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30' 
  },
  { 
    tipo: 'Truck', 
    label: 'Truck', 
    valorDiaria: 1200, 
    capacidadeKg: 12000, 
    capacidadePaletes: 14,
    badgeColor: 'bg-orange-500/15 text-orange-400 border-orange-500/30' 
  },
  { 
    tipo: 'Sem Custo', 
    label: 'Sem Custo (Placa Fictícia)', 
    valorDiaria: 0, 
    capacidadeKg: 0, 
    capacidadePaletes: 0,
    badgeColor: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' 
  },
  { 
    tipo: 'Outro', 
    label: 'Outro / Personalizado', 
    valorDiaria: 0, 
    capacidadeKg: 0, 
    capacidadePaletes: 0,
    badgeColor: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' 
  }
];

export const getPresetPorTipo = (tipo, tabelaCustomizada = null) => {
  const lista = (tabelaCustomizada && Array.isArray(tabelaCustomizada) && tabelaCustomizada.length > 0)
    ? tabelaCustomizada
    : DEFAULT_PRESETS_VEICULOS;

  const t = String(tipo || '').toLowerCase().trim();
  if (t.includes('3/4') || t.includes('vuc')) return lista.find(p => p.tipo === '3/4') || lista[0];
  if (t.includes('bongo') || t.includes('hr')) return lista.find(p => p.tipo === 'Bongo') || lista[1];
  if (t.includes('fiorino') || t.includes('van')) return lista.find(p => p.tipo === 'Fiorino') || lista[2];
  if (t.includes('toco')) return lista.find(p => p.tipo === 'Toco') || lista[3];
  if (t.includes('truck')) return lista.find(p => p.tipo === 'Truck') || lista[4];
  if (t.includes('sem custo') || t.includes('fictic') || t.includes('carreta')) return lista.find(p => p.tipo === 'Sem Custo') || lista[5];
  if (t.includes('outro')) return lista.find(p => p.tipo === 'Outro') || lista[6];
  return lista[0]; // Padrão 3/4
};

export const STATUS_VEICULO = [
  { id: 'Ativo', label: 'Ativo na Frota', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  { id: 'Manutencao', label: 'Em Manutenção', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  { id: 'Reserva', label: 'Reserva / Pátio', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  { id: 'Inativo', label: 'Inativo / Baixado', color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' }
];

export function AbaVeiculos() {
  const { 
    veiculos = [], 
    motoristas = [], 
    entregas = [], 
    kmRegistros = [],
    configDiarias,
    salvarConfigDiarias,
    salvarVeiculo, 
    removerVeiculo 
  } = useStore();

  const [buscaTexto, setBuscaTexto] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos'); // 'todos' | 'Ativo' | 'Manutencao' | 'Reserva' | 'Inativo'
  const [filtroTipo, setFiltroTipo] = useState('todos');
  
  // Modal de Criação / Edição de Veículo
  const [modalVeiculo, setModalVeiculo] = useState(null); 
  const [salvando, setSalvando] = useState(false);

  // Modal de Configuração da Tabela de Diárias
  const [modalConfigDiariasOpen, setModalConfigDiariasOpen] = useState(false);
  const [tabelaEdicao, setTabelaEdicao] = useState([]);
  const [salvandoConfig, setSalvandoConfig] = useState(false);

  // Tabela de presets ativa (Customizada ou Default)
  const presetsAtivos = useMemo(() => {
    if (configDiarias && Array.isArray(configDiarias.tabela) && configDiarias.tabela.length > 0) {
      return configDiarias.tabela;
    }
    return DEFAULT_PRESETS_VEICULOS;
  }, [configDiarias]);

  // 1. Consolidar Lista Completa de Veículos
  const veiculosConsolidados = useMemo(() => {
    const map = new Map();

    // Veículos já cadastrados no Firestore
    (veiculos || []).forEach(v => {
      const p = String(v.placa || v.id || '').trim().toUpperCase();
      if (!p) return;
      const tipoDefinido = v.tipo || '3/4';
      const preset = getPresetPorTipo(tipoDefinido, presetsAtivos);

      map.set(p, {
        placa: p,
        modelo: v.modelo || '',
        tipo: tipoDefinido,
        valorDiaria: v.valorDiaria !== undefined && v.valorDiaria !== '' && v.valorDiaria !== null 
          ? Number(v.valorDiaria) 
          : preset.valorDiaria,
        capacidadeKg: v.capacidadeKg !== undefined && v.capacidadeKg !== '' 
          ? Number(v.capacidadeKg) 
          : preset.capacidadeKg,
        capacidadePaletes: v.capacidadePaletes !== undefined && v.capacidadePaletes !== '' 
          ? Number(v.capacidadePaletes) 
          : preset.capacidadePaletes,
        motoristaPadrao: v.motoristaPadrao || '',
        status: v.status || 'Ativo',
        kmAtual: v.kmAtual || '',
        observacao: v.observacao || '',
        isCadastrado: true,
        totalEntregas: 0
      });
    });

    // Detectar placas presentes nas entregas
    (entregas || []).forEach(e => {
      const p = String(e.placa || '').trim().toUpperCase();
      if (!p || p === 'SEM PLACA' || p === 'NULL') return;
      if (!map.has(p)) {
        const preset = presetsAtivos[0] || DEFAULT_PRESETS_VEICULOS[0]; // 3/4 padrão
        map.set(p, {
          placa: p,
          modelo: '',
          tipo: '3/4',
          valorDiaria: preset.valorDiaria,
          capacidadeKg: preset.capacidadeKg,
          capacidadePaletes: preset.capacidadePaletes,
          motoristaPadrao: '',
          status: 'Ativo',
          kmAtual: '',
          observacao: '',
          isCadastrado: false,
          totalEntregas: 1
        });
      } else {
        const v = map.get(p);
        v.totalEntregas += 1;
      }
    });

    // Mesclar motorista padrão a partir do cadastro de motoristas, se não definido
    (motoristas || []).forEach(m => {
      const p = String(m.placa || m.id || '').trim().toUpperCase();
      if (p && map.has(p)) {
        const v = map.get(p);
        if (!v.motoristaPadrao && m.nome) {
          v.motoristaPadrao = m.nome;
        }
      }
    });

    // Mesclar último KM registrado
    (kmRegistros || []).forEach(k => {
      const p = String(k.placa || '').trim().toUpperCase();
      if (p && map.has(p)) {
        const v = map.get(p);
        const kmVal = k.kmFinal || k.kmInicial;
        if (kmVal && (!v.kmAtual || Number(kmVal) > Number(v.kmAtual))) {
          v.kmAtual = Number(kmVal);
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.placa.localeCompare(b.placa));
  }, [veiculos, entregas, motoristas, kmRegistros, presetsAtivos]);

  // Filtragem
  const veiculosFiltrados = useMemo(() => {
    return veiculosConsolidados.filter(v => {
      if (filtroStatus !== 'todos' && v.status !== filtroStatus) return false;
      if (filtroTipo !== 'todos' && v.tipo !== filtroTipo) return false;

      if (buscaTexto.trim()) {
        const t = buscaTexto.toLowerCase().trim();
        const match = 
          v.placa.toLowerCase().includes(t) ||
          (v.modelo || '').toLowerCase().includes(t) ||
          (v.tipo || '').toLowerCase().includes(t) ||
          (v.motoristaPadrao || '').toLowerCase().includes(t) ||
          (v.observacao || '').toLowerCase().includes(t);
        if (!match) return false;
      }

      return true;
    });
  }, [veiculosConsolidados, filtroStatus, filtroTipo, buscaTexto]);

  // KPIs da Frota
  const kpis = useMemo(() => {
    const total = veiculosConsolidados.length;
    const ativos = veiculosConsolidados.filter(v => v.status === 'Ativo');
    const manutencao = veiculosConsolidados.filter(v => v.status === 'Manutencao').length;
    const reserva = veiculosConsolidados.filter(v => v.status === 'Reserva').length;
    
    // Custo Diário da Frota Ativa (Soma das diárias dos veículos ativos)
    const custoDiarioFrotaAtiva = ativos.reduce((acc, v) => acc + (Number(v.valorDiaria) || 0), 0);

    return { 
      total, 
      ativos: ativos.length, 
      manutencao, 
      reserva,
      custoDiarioFrotaAtiva
    };
  }, [veiculosConsolidados]);

  // Ações de Cadastro / Edição
  const handleAbrirNovoVeiculo = () => {
    const preset = presetsAtivos[0] || DEFAULT_PRESETS_VEICULOS[0]; // 3/4 padrão
    setModalVeiculo({
      placa: '',
      modelo: '',
      tipo: preset.tipo,
      valorDiaria: preset.valorDiaria,
      capacidadeKg: preset.capacidadeKg,
      capacidadePaletes: preset.capacidadePaletes,
      motoristaPadrao: '',
      status: 'Ativo',
      kmAtual: '',
      observacao: ''
    });
  };

  const handleAbrirEditarVeiculo = (v) => {
    const preset = getPresetPorTipo(v.tipo, presetsAtivos);
    setModalVeiculo({
      placa: v.placa,
      modelo: v.modelo || '',
      tipo: v.tipo || preset.tipo,
      valorDiaria: v.valorDiaria !== undefined && v.valorDiaria !== '' ? v.valorDiaria : preset.valorDiaria,
      capacidadeKg: v.capacidadeKg !== undefined && v.capacidadeKg !== '' ? v.capacidadeKg : preset.capacidadeKg,
      capacidadePaletes: v.capacidadePaletes !== undefined && v.capacidadePaletes !== '' ? v.capacidadePaletes : preset.capacidadePaletes,
      motoristaPadrao: v.motoristaPadrao || '',
      status: v.status || 'Ativo',
      kmAtual: v.kmAtual || '',
      observacao: v.observacao || ''
    });
  };

  // Ao selecionar um preset rápido no modal de veículo
  const handleAplicarPreset = (preset) => {
    if (!modalVeiculo) return;
    setModalVeiculo(prev => ({
      ...prev,
      tipo: preset.tipo,
      valorDiaria: preset.valorDiaria,
      capacidadeKg: preset.capacidadeKg,
      capacidadePaletes: preset.capacidadePaletes
    }));
  };

  const handleSalvar = async (e) => {
    e?.preventDefault();
    if (!modalVeiculo || !modalVeiculo.placa.trim()) return;

    setSalvando(true);
    try {
      await salvarVeiculo({
        ...modalVeiculo,
        valorDiaria: Number(modalVeiculo.valorDiaria) || 0,
        capacidadeKg: Number(modalVeiculo.capacidadeKg) || 0,
        capacidadePaletes: Number(modalVeiculo.capacidadePaletes) || 0
      });
      setModalVeiculo(null);
    } catch (err) {
      console.error("Erro ao salvar veículo:", err);
      alert("Erro ao salvar veículo na base.");
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (placa) => {
    if (window.confirm(`Tem certeza que deseja remover o veículo ${placa} do cadastro?`)) {
      try {
        await removerVeiculo(placa);
      } catch (err) {
        console.error("Erro ao remover veículo:", err);
        alert("Erro ao excluir veículo.");
      }
    }
  };

  // Ações de Ajuste da Tabela de Diárias
  const handleAbrirConfigDiarias = () => {
    setTabelaEdicao(JSON.parse(JSON.stringify(presetsAtivos)));
    setModalConfigDiariasOpen(true);
  };

  const handleSalvarConfigDiarias = async (e) => {
    e?.preventDefault();
    setSalvandoConfig(true);
    try {
      await salvarConfigDiarias(tabelaEdicao);
      setModalConfigDiariasOpen(false);
    } catch (err) {
      console.error("Erro ao salvar tabela de diárias:", err);
      alert("Erro ao salvar configuração.");
    } finally {
      setSalvandoConfig(false);
    }
  };

  const handleRestaurarPadraoFabrica = () => {
    if (window.confirm("Deseja restaurar a tabela de diárias para os padrões originais de fábrica (3/4 R$757, Bongo R$520, Fiorino R$360)?")) {
      setTabelaEdicao(JSON.parse(JSON.stringify(DEFAULT_PRESETS_VEICULOS)));
    }
  };

  const handleExportarXLSX = () => {
    if (veiculosFiltrados.length === 0) return;

    const dataRows = veiculosFiltrados.map(v => ({
      'Placa': v.placa,
      'Tipo de Veículo': v.tipo || '3/4',
      'Valor Diária (R$)': Number(v.valorDiaria || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      'Modelo / Marca': v.modelo || '-',
      'Capacidade (Kg)': v.capacidadeKg ? `${Number(v.capacidadeKg).toLocaleString('pt-BR')} kg` : '-',
      'Capacidade (Paletes)': v.capacidadePaletes ? `${v.capacidadePaletes} paletes` : 'Sem paletes',
      'Motorista Padrão': v.motoristaPadrao || '-',
      'KM Atual': v.kmAtual ? `${Number(v.kmAtual).toLocaleString('pt-BR')} km` : '-',
      'Status': v.status || 'Ativo',
      'Observações': v.observacao || '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Veiculos");
    XLSX.writeFile(workbook, `Cadastro_Veiculos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-4">
      {/* Cards de Métricas da Frota */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Total Frota */}
        <div className="bg-background-primary p-3.5 sm:p-4 rounded-2xl border border-border-secondary shadow-xs">
          <div className="flex items-center justify-between text-text-secondary mb-1">
            <span className="text-xs font-bold">Total Frota</span>
            <Truck size={16} className="text-info" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-text-primary font-mono">
            {kpis.total}
          </div>
          <p className="text-[11px] text-text-tertiary mt-0.5">Veículos cadastrados</p>
        </div>

        {/* Ativos */}
        <div className="bg-background-primary p-3.5 sm:p-4 rounded-2xl border border-border-secondary shadow-xs">
          <div className="flex items-center justify-between text-emerald-400 mb-1">
            <span className="text-xs font-bold text-text-secondary">Ativos</span>
            <CheckCircle2 size={16} />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
            {kpis.ativos}
          </div>
          <p className="text-[11px] text-text-tertiary mt-0.5">Em operação regular</p>
        </div>

        {/* Custo Diário da Frota Ativa */}
        <div className="bg-background-primary p-3.5 sm:p-4 rounded-2xl border border-border-secondary shadow-xs">
          <div className="flex items-center justify-between text-emerald-400 mb-1">
            <span className="text-xs font-bold text-text-secondary">Custo Diário Frota</span>
            <DollarSign size={16} />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
            {Number(kpis.custoDiarioFrotaAtiva).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          <p className="text-[11px] text-text-tertiary mt-0.5">Soma diárias ativas / dia</p>
        </div>

        {/* Manutenção / Reserva */}
        <div className="bg-background-primary p-3.5 sm:p-4 rounded-2xl border border-border-secondary shadow-xs">
          <div className="flex items-center justify-between text-amber-400 mb-1">
            <span className="text-xs font-bold text-text-secondary">Oficina / Pátio</span>
            <Wrench size={16} />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono">
            {kpis.manutencao + kpis.reserva}
          </div>
          <p className="text-[11px] text-text-tertiary mt-0.5">
            {kpis.manutencao} em reparo • {kpis.reserva} pátio
          </p>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-background-primary p-3 sm:p-4 rounded-2xl border border-border-secondary shadow-xs">
        <div className="flex flex-1 flex-col sm:flex-row items-center gap-2.5 w-full">
          {/* Busca por Placa / Modelo / Motorista */}
          <div className="relative flex-1 w-full">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              value={buscaTexto}
              onChange={(e) => setBuscaTexto(e.target.value)}
              placeholder="Buscar por placa, modelo, tipo, motorista ou observações..."
              className="w-full bg-background-secondary border border-border-secondary rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-info transition-colors shadow-xs"
            />
            {buscaTexto && (
              <button
                type="button"
                onClick={() => setBuscaTexto('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary p-1"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filtro por Tipo de Veículo */}
          <div className="w-full sm:w-44 shrink-0">
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="w-full bg-background-secondary border border-border-secondary rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-text-primary focus:outline-none focus:border-info transition-colors shadow-xs cursor-pointer"
            >
              <option value="todos">Todos os Tipos</option>
              {presetsAtivos.map(pr => (
                <option key={pr.tipo} value={pr.tipo}>{pr.label}</option>
              ))}
            </select>
          </div>

          {/* Filtro de Status */}
          <div className="w-full sm:w-44 shrink-0">
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="w-full bg-background-secondary border border-border-secondary rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-text-primary focus:outline-none focus:border-info transition-colors shadow-xs cursor-pointer"
            >
              <option value="todos">Todos os Status</option>
              {STATUS_VEICULO.map(st => (
                <option key={st.id} value={st.id}>{st.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          {/* Botão de Ajustar Tabela de Diárias */}
          <button
            type="button"
            onClick={handleAbrirConfigDiarias}
            className="px-3 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            title="Ajustar Valores Padrão da Tabela de Frete / Diárias"
          >
            <SlidersHorizontal size={14} className="text-amber-400" />
            <span>Tabela de Diárias</span>
          </button>

          <button
            type="button"
            onClick={handleExportarXLSX}
            className="px-3 py-2 rounded-xl border border-border-secondary hover:bg-background-secondary text-text-primary text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Exportar Planilha de Veículos"
          >
            <FileSpreadsheet size={15} className="text-emerald-500" />
            <span className="hidden sm:inline">Exportar Excel</span>
          </button>

          <button
            type="button"
            onClick={handleAbrirNovoVeiculo}
            className="px-4 py-2 rounded-xl bg-info hover:bg-info/90 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer shrink-0"
          >
            <Plus size={16} />
            <span>Novo Veículo</span>
          </button>
        </div>
      </div>

      {/* Tabela de Veículos (Desktop) */}
      <div className="hidden md:block bg-background-primary rounded-2xl border border-border-secondary shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-background-secondary/70 border-b border-border-secondary text-text-secondary">
                <th className="py-3.5 px-4 font-bold w-[16%]">Placa & Modelo</th>
                <th className="py-3.5 px-4 font-bold w-[14%]">Tipo de Veículo</th>
                <th className="py-3.5 px-4 font-bold w-[14%] text-emerald-400">Valor da Diária</th>
                <th className="py-3.5 px-4 font-bold w-[16%]">Capacidade</th>
                <th className="py-3.5 px-4 font-bold w-[16%]">Motorista Padrão</th>
                <th className="py-3.5 px-4 font-bold w-[10%]">KM Atual</th>
                <th className="py-3.5 px-4 font-bold w-[8%] text-center">Status</th>
                <th className="py-3.5 px-4 font-bold w-[6%] text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-secondary/60">
              {veiculosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-text-tertiary">
                    Nenhum veículo encontrado para os filtros selecionados
                  </td>
                </tr>
              ) : (
                veiculosFiltrados.map((v) => {
                  const statusObj = STATUS_VEICULO.find(s => s.id === v.status) || STATUS_VEICULO[0];
                  const preset = getPresetPorTipo(v.tipo, presetsAtivos);
                  const isSemCusto = v.tipo === 'Sem Custo' || Number(v.valorDiaria) === 0;

                  return (
                    <tr key={v.placa} className="hover:bg-background-secondary/40 transition-colors">
                      {/* 1. Placa & Modelo */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-black text-sm text-info block tracking-tight">
                          {v.placa}
                        </span>
                        <span className="text-[11px] text-text-secondary truncate block mt-0.5">
                          {v.modelo || 'Modelo não especificado'}
                        </span>
                      </td>

                      {/* 2. Tipo de Veículo */}
                      <td className="py-3.5 px-4">
                        <span className={cn(
                          "px-2.5 py-1 rounded-md text-[11px] font-bold border inline-flex items-center gap-1.5 whitespace-nowrap",
                          preset.badgeColor
                        )}>
                          <Truck size={12} />
                          <span>{preset.label || v.tipo}</span>
                        </span>
                      </td>

                      {/* 3. Valor da Diária */}
                      <td className="py-3.5 px-4">
                        {isSemCusto ? (
                          <span className="text-[11px] font-bold text-text-tertiary block">
                            Sem Custo (R$ 0)
                          </span>
                        ) : (
                          <>
                            <span className="font-mono font-black text-sm text-emerald-400 block">
                              {Number(v.valorDiaria || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                            <span className="text-[10px] text-text-tertiary">
                              por dia trabalhado
                            </span>
                          </>
                        )}
                      </td>

                      {/* 4. Capacidade (Kg e Paletes) */}
                      <td className="py-3.5 px-4 text-text-secondary">
                        <span className="block font-bold text-text-primary text-xs">
                          {v.capacidadeKg && Number(v.capacidadeKg) > 0 ? `${Number(v.capacidadeKg).toLocaleString('pt-BR')} kg` : '-'}
                        </span>
                        <span className="text-[11px] text-text-tertiary">
                          {v.capacidadePaletes && Number(v.capacidadePaletes) > 0 ? `${v.capacidadePaletes} paletes` : 'Sem paletes'}
                        </span>
                      </td>

                      {/* 5. Motorista Padrão */}
                      <td className="py-3.5 px-4">
                        {v.motoristaPadrao ? (
                          <div className="flex items-center gap-1.5">
                            <User size={13} className="text-text-tertiary shrink-0" />
                            <span className="font-semibold text-text-primary truncate">
                              {v.motoristaPadrao}
                            </span>
                          </div>
                        ) : (
                          <span className="text-text-tertiary italic text-[11px]">Nenhum vinculado</span>
                        )}
                      </td>

                      {/* 6. KM Atual */}
                      <td className="py-3.5 px-4 font-mono font-bold text-text-primary">
                        {v.kmAtual ? (
                          <div className="flex items-center gap-1">
                            <Gauge size={13} className="text-text-tertiary" />
                            <span>{Number(v.kmAtual).toLocaleString('pt-BR')} km</span>
                          </div>
                        ) : (
                          <span className="text-text-tertiary font-normal">-</span>
                        )}
                      </td>

                      {/* 7. Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={cn(
                          "px-2.5 py-1 rounded-md text-[10px] font-bold border inline-flex items-center justify-center gap-1 whitespace-nowrap",
                          statusObj.color
                        )}>
                          {statusObj.label}
                        </span>
                      </td>

                      {/* 8. Ações */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleAbrirEditarVeiculo(v)}
                            className="p-1.5 text-text-tertiary hover:text-info hover:bg-background-secondary rounded-lg transition-colors cursor-pointer"
                            title="Editar Veículo"
                          >
                            <Edit3 size={15} />
                          </button>
                          {v.isCadastrado && (
                            <button
                              type="button"
                              onClick={() => handleExcluir(v.placa)}
                              className="p-1.5 text-text-tertiary hover:text-danger hover:bg-danger/10 rounded-lg transition-colors cursor-pointer"
                              title="Remover do Cadastro"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {veiculosFiltrados.length > 0 && (
          <div className="p-3 bg-background-secondary/30 border-t border-border-secondary flex justify-between items-center text-xs text-text-tertiary">
            <span>Mostrando {veiculosFiltrados.length} veículo(s)</span>
            <span>Total na frota: {veiculosConsolidados.length}</span>
          </div>
        )}
      </div>

      {/* Cards de Veículos (Mobile) */}
      <div className="block md:hidden space-y-3">
        {veiculosFiltrados.length === 0 ? (
          <div className="bg-background-primary p-8 text-center rounded-2xl border border-border-secondary text-text-tertiary text-xs">
            Nenhum veículo encontrado
          </div>
        ) : (
          veiculosFiltrados.map(v => {
            const statusObj = STATUS_VEICULO.find(s => s.id === v.status) || STATUS_VEICULO[0];
            const preset = getPresetPorTipo(v.tipo, presetsAtivos);
            const isSemCusto = v.tipo === 'Sem Custo' || Number(v.valorDiaria) === 0;

            return (
              <div 
                key={v.placa}
                className="bg-background-primary p-4 rounded-2xl border border-border-secondary shadow-xs space-y-3"
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-base text-info">
                        {v.placa}
                      </span>
                      <span className={cn(
                        "px-2 py-0.5 rounded-md text-[10px] font-bold border",
                        preset.badgeColor
                      )}>
                        {preset.label}
                      </span>
                    </div>
                    <h4 className="text-xs font-semibold text-text-primary mt-1">
                      {v.modelo || 'Modelo não especificado'}
                    </h4>
                  </div>

                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                    statusObj.color
                  )}>
                    {statusObj.label}
                  </span>
                </div>

                {/* Métricas: Diária, Carga e Paletes */}
                <div className="grid grid-cols-2 gap-2 p-2.5 bg-background-secondary/60 rounded-xl border border-border-secondary/60 text-xs">
                  <div>
                    <span className="text-[10px] text-text-tertiary block">Valor da Diária</span>
                    {isSemCusto ? (
                      <span className="font-bold text-text-tertiary text-xs">Sem Custo</span>
                    ) : (
                      <span className="font-mono font-black text-emerald-400 text-sm">
                        {Number(v.valorDiaria || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-text-tertiary block">Capacidade</span>
                    <span className="font-bold text-text-primary">
                      {v.capacidadeKg && Number(v.capacidadeKg) > 0 ? `${Number(v.capacidadeKg).toLocaleString('pt-BR')} kg` : '-'}
                      {v.capacidadePaletes && Number(v.capacidadePaletes) > 0 ? ` (${v.capacidadePaletes} pal)` : ' (sem pal)'}
                    </span>
                  </div>
                </div>

                {/* Motorista e KM */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-border-secondary/60">
                  <div className="flex items-center gap-1.5 truncate max-w-[65%]">
                    <User size={13} className="text-text-tertiary shrink-0" />
                    <span className="text-text-primary font-medium truncate">
                      {v.motoristaPadrao || 'Sem motorista vinculado'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 font-mono font-bold text-text-primary shrink-0">
                    <Gauge size={13} className="text-text-tertiary" />
                    <span>{v.kmAtual ? `${Number(v.kmAtual).toLocaleString('pt-BR')} km` : '-'}</span>
                  </div>
                </div>

                {/* Botões Mobile */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleAbrirEditarVeiculo(v)}
                    className="px-3 py-1.5 rounded-xl bg-background-secondary hover:bg-info hover:text-white text-text-primary border border-border-secondary text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 size={13} />
                    <span>Editar</span>
                  </button>

                  {v.isCadastrado && (
                    <button
                      type="button"
                      onClick={() => handleExcluir(v.placa)}
                      className="px-3 py-1.5 rounded-xl bg-danger/10 hover:bg-danger hover:text-white text-danger border border-danger/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 size={13} />
                      <span>Excluir</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL 1: CADASTRO / EDIÇÃO DE VEÍCULO */}
      {modalVeiculo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-background-primary border border-border-secondary rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-border-secondary flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-info/15 text-info flex items-center justify-center font-bold">
                  <Truck size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-text-primary">
                    {modalVeiculo.placa ? `Veículo ${modalVeiculo.placa}` : 'Novo Veículo na Frota'}
                  </h3>
                  <p className="text-xs text-text-tertiary">
                    Informe os dados operacionais, diária e capacidades do veículo
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalVeiculo(null)}
                className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-background-secondary rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSalvar} className="p-4 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
              {/* Linha 1: Placa, Tipo e Modelo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    Placa do Veículo *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={8}
                    value={modalVeiculo.placa}
                    onChange={(e) => setModalVeiculo({ ...modalVeiculo, placa: e.target.value.toUpperCase() })}
                    placeholder="Ex: ABC1D23"
                    className="w-full bg-background-secondary border border-border-secondary rounded-xl px-3 py-2 text-xs font-mono font-bold text-text-primary focus:outline-none focus:border-info uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    Tipo de Veículo *
                  </label>
                  <select
                    value={modalVeiculo.tipo}
                    onChange={(e) => {
                      const novoTipo = e.target.value;
                      const preset = getPresetPorTipo(novoTipo, presetsAtivos);
                      setModalVeiculo({
                        ...modalVeiculo,
                        tipo: novoTipo,
                        valorDiaria: preset.valorDiaria,
                        capacidadeKg: preset.capacidadeKg,
                        capacidadePaletes: preset.capacidadePaletes
                      });
                    }}
                    className="w-full bg-background-secondary border border-border-secondary rounded-xl px-3 py-2 text-xs font-medium text-text-primary focus:outline-none focus:border-info cursor-pointer"
                  >
                    {presetsAtivos.map(p => (
                      <option key={p.tipo} value={p.tipo}>{p.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    Modelo / Marca (Opcional)
                  </label>
                  <input
                    type="text"
                    value={modalVeiculo.modelo}
                    onChange={(e) => setModalVeiculo({ ...modalVeiculo, modelo: e.target.value })}
                    placeholder="Ex: MB Accelo 815, Kia Bongo"
                    className="w-full bg-background-secondary border border-border-secondary rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-info"
                  />
                </div>
              </div>

              {/* Linha 2: Valor da Diária, Capacidade Kg, Capacidade Paletes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-emerald-400 mb-1 flex items-center gap-1">
                    <DollarSign size={13} />
                    <span>Valor da Diária (R$) *</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={modalVeiculo.valorDiaria}
                    onChange={(e) => setModalVeiculo({ ...modalVeiculo, valorDiaria: e.target.value })}
                    placeholder="Ex: 757.00"
                    className="w-full bg-background-secondary border border-emerald-500/40 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    Capacidade de Peso (Kg)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={modalVeiculo.capacidadeKg}
                    onChange={(e) => setModalVeiculo({ ...modalVeiculo, capacidadeKg: e.target.value })}
                    placeholder="Ex: 4500"
                    className="w-full bg-background-secondary border border-border-secondary rounded-xl px-3 py-2 text-xs font-mono text-text-primary focus:outline-none focus:border-info"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    Capacidade (Paletes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={modalVeiculo.capacidadePaletes}
                    onChange={(e) => setModalVeiculo({ ...modalVeiculo, capacidadePaletes: e.target.value })}
                    placeholder="0"
                    className="w-full bg-background-secondary border border-border-secondary rounded-xl px-3 py-2 text-xs font-mono text-text-primary focus:outline-none focus:border-info"
                  />
                </div>
              </div>

              {/* Linha 3: Motorista Padrão, Status, KM Atual */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    Motorista Padrão
                  </label>
                  <select
                    value={modalVeiculo.motoristaPadrao}
                    onChange={(e) => setModalVeiculo({ ...modalVeiculo, motoristaPadrao: e.target.value })}
                    className="w-full bg-background-secondary border border-border-secondary rounded-xl px-3 py-2 text-xs font-medium text-text-primary focus:outline-none focus:border-info cursor-pointer"
                  >
                    <option value="">Nenhum vinculado</option>
                    {motoristas.map(m => (
                      <option key={m.id || m.placa} value={m.nome}>
                        {m.nome} {m.placa ? `(${m.placa})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    Status Operacional
                  </label>
                  <select
                    value={modalVeiculo.status}
                    onChange={(e) => setModalVeiculo({ ...modalVeiculo, status: e.target.value })}
                    className="w-full bg-background-secondary border border-border-secondary rounded-xl px-3 py-2 text-xs font-medium text-text-primary focus:outline-none focus:border-info cursor-pointer"
                  >
                    {STATUS_VEICULO.map(st => (
                      <option key={st.id} value={st.id}>{st.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    KM Atual
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={modalVeiculo.kmAtual}
                    onChange={(e) => setModalVeiculo({ ...modalVeiculo, kmAtual: e.target.value })}
                    placeholder="Ex: 85200"
                    className="w-full bg-background-secondary border border-border-secondary rounded-xl px-3 py-2 text-xs font-mono text-text-primary focus:outline-none focus:border-info"
                  />
                </div>
              </div>

              {/* CARD DE PREDEFINIÇÕES RÁPIDAS (Posicionado abaixo de Motorista/Status/KM) */}
              <div className="p-3 bg-background-secondary/60 border border-border-secondary rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-text-primary">
                    <Sparkles size={14} className="text-amber-400" />
                    <span>Predefinições Rápidas (Tipo, Diária e Capacidade):</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setModalVeiculo(null);
                      handleAbrirConfigDiarias();
                    }}
                    className="text-[11px] text-info hover:text-info/80 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <SlidersHorizontal size={11} />
                    <span>Ajustar Tabela Padrão</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {presetsAtivos.filter(p => p.tipo !== 'Outro').map(preset => {
                    const isSelected = modalVeiculo.tipo === preset.tipo;
                    const isSemCusto = preset.tipo === 'Sem Custo' || Number(preset.valorDiaria) === 0;

                    return (
                      <button
                        key={preset.tipo}
                        type="button"
                        onClick={() => handleAplicarPreset(preset)}
                        className={cn(
                          "p-2 rounded-lg border text-left transition-all cursor-pointer select-none",
                          isSelected 
                            ? "bg-info/15 border-info text-text-primary ring-1 ring-info" 
                            : "bg-background-primary hover:bg-background-secondary/80 border-border-secondary text-text-secondary"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-text-primary">{preset.label}</span>
                          <span className={cn("text-[10px] font-mono font-bold", isSemCusto ? "text-text-tertiary" : "text-emerald-400")}>
                            {isSemCusto ? 'R$ 0' : `R$ ${preset.valorDiaria}`}
                          </span>
                        </div>
                        <span className="text-[10px] text-text-tertiary block mt-0.5">
                          {preset.capacidadeKg > 0 ? `${Number(preset.capacidadeKg).toLocaleString('pt-BR')} kg` : 'Sem carga'}
                          {preset.capacidadePaletes > 0 ? ` • ${preset.capacidadePaletes} pal` : ' • 0 pal'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">
                  Observações / Histórico (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={modalVeiculo.observacao}
                  onChange={(e) => setModalVeiculo({ ...modalVeiculo, observacao: e.target.value })}
                  placeholder="Ex: Veículo refrigerado / baú 12 pallets / revisão agendada para sexta-feira"
                  className="w-full bg-background-secondary border border-border-secondary rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-info resize-none"
                />
              </div>

              {/* Rodapé */}
              <div className="pt-3 border-t border-border-secondary flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalVeiculo(null)}
                  className="px-4 py-2 rounded-xl border border-border-secondary text-text-secondary hover:text-text-primary hover:bg-background-secondary text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-5 py-2 rounded-xl bg-info hover:bg-info/90 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {salvando ? 'Salvando...' : 'Salvar Veículo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIGURAR TABELA DE PREDEFINIÇÕES DE FRETE / DIÁRIAS */}
      {modalConfigDiariasOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-background-primary border border-border-secondary rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-border-secondary flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold">
                  <SlidersHorizontal size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-text-primary">
                    Tabela de Predefinições de Frete & Diárias
                  </h3>
                  <p className="text-xs text-text-tertiary">
                    Ajuste os valores padrão de diária, peso e paletes para cada categoria de veículo
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalConfigDiariasOpen(false)}
                className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-background-secondary rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSalvarConfigDiarias} className="p-4 space-y-3 flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-3 bg-info/10 border border-info/20 rounded-xl text-xs text-info flex items-center gap-2">
                <Sparkles size={16} className="shrink-0 text-info" />
                <span>
                  Estes valores serão sugeridos automaticamente ao cadastrar novos veículos ou ao clicar nos botões de predefinição rápida.
                </span>
              </div>

              {/* Lista Editável de Categorias */}
              <div className="space-y-2.5">
                {tabelaEdicao.map((item, index) => {
                  return (
                    <div 
                      key={item.tipo}
                      className="p-3 rounded-xl bg-background-secondary/70 border border-border-secondary space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-text-primary flex items-center gap-2">
                          <span className={cn("px-2 py-0.5 rounded text-[10.5px] font-bold border", item.badgeColor)}>
                            {item.label}
                          </span>
                        </span>
                        <span className="text-[11px] font-mono text-text-tertiary">
                          Código: {item.tipo}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2.5 pt-1">
                        <div>
                          <label className="block text-[11px] font-bold text-emerald-400 mb-1">
                            Diária Padrão (R$)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.valorDiaria}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTabelaEdicao(prev => prev.map((it, idx) => idx === index ? { ...it, valorDiaria: val === '' ? '' : Number(val) } : it));
                            }}
                            className="w-full bg-background-primary border border-emerald-500/40 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-400"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-text-secondary mb-1">
                            Capacidade (Kg)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={item.capacidadeKg}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTabelaEdicao(prev => prev.map((it, idx) => idx === index ? { ...it, capacidadeKg: val === '' ? '' : Number(val) } : it));
                            }}
                            className="w-full bg-background-primary border border-border-secondary rounded-lg px-2.5 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-info"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-text-secondary mb-1">
                            Paletes
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={item.capacidadePaletes}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTabelaEdicao(prev => prev.map((it, idx) => idx === index ? { ...it, capacidadePaletes: val === '' ? '' : Number(val) } : it));
                            }}
                            className="w-full bg-background-primary border border-border-secondary rounded-lg px-2.5 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-info"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Botões do Rodapé */}
              <div className="pt-3 border-t border-border-secondary flex items-center justify-between gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleRestaurarPadraoFabrica}
                  className="px-3 py-2 rounded-xl border border-border-secondary hover:bg-background-secondary text-text-tertiary hover:text-text-primary text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  title="Restaurar valores de fábrica"
                >
                  <RotateCcw size={13} />
                  <span>Restaurar Padrões</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalConfigDiariasOpen(false)}
                    className="px-4 py-2 rounded-xl border border-border-secondary text-text-secondary hover:text-text-primary hover:bg-background-secondary text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={salvandoConfig}
                    className="px-5 py-2 rounded-xl bg-info hover:bg-info/90 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Save size={14} />
                    <span>{salvandoConfig ? 'Salvando...' : 'Salvar Tabela'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AbaVeiculos;
