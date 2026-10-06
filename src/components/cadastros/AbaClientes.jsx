import React, { useState, useMemo } from 'react';
import { 
  Building2, Search, Plus, Edit3, Trash2, Check, X, 
  Layers, Tags, Tag, Users, CheckSquare, Square, Palette, PlusCircle, Sparkles, FolderPlus,
  ChevronRight, MapPin, CheckCircle2, FileSpreadsheet, DownloadCloud, AlertCircle, AlertTriangle,
  TrendingUp, Compass, Filter
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';
import { GRUPO_CORES } from '../monitoramento/PainelGeolocalizacao';

export function AbaClientes() {
  const { 
    clientesGeoloc = [], 
    gruposClientes = [],
    entregas = [],
    devolucoes = [],
    solicitacoesDevolucao = [],
    salvarGrupoCliente,
    removerGrupoCliente,
    atribuirClientesAoGrupo,
    removerClienteDoGrupo
  } = useStore();

  const [filtroSubAba, setFiltroSubAba] = useState('clientes'); // 'clientes' | 'grupos'
  const [filtroGrupoAtivo, setFiltroGrupoAtivo] = useState('todos'); // 'todos' | grupo.id
  const [filtroOcorrencia, setFiltroOcorrencia] = useState('todos'); // 'todos' | 'com_ocorrencias' | 'sem_ocorrencias' | 'sem_rede' | 'com_gps' | 'sem_gps'
  const [buscaTexto, setBuscaTexto] = useState('');

  // Modais
  const [modalGrupo, setModalGrupo] = useState(null); // null | { id, nome, cor, descricao, codClientes: [] }
  const [grupoBuscaCliente, setGrupoBuscaCliente] = useState('');
  const [salvandoGrupo, setSalvandoGrupo] = useState(false);

  const [modalCliente, setModalCliente] = useState(null); // null | { codCliente, cliente, municipio, bairro, grupos: [] }

  // 1. Consolidar Base Completa de Clientes com Contagem de Expedições e Ocorrências
  const clientesConsolidados = useMemo(() => {
    const map = new Map();

    // 1. Extrair e consolidar a partir das entregas
    (entregas || []).forEach(e => {
      const cod = String(e.codCliente || '').trim();
      if (!cod) return;

      // Chave única da expedição (visita / parada na loja):
      const expedicaoKey = `${e.data || ''}__${e.carga || e.placa || '1'}`;
      const notaKey = String(e.nota || e.id || '').trim();

      // Checar se a nota/entrega teve status de devolução, entrega parcial ou reentrega
      const statusStr = String(e.status || '').toLowerCase();
      const tipoStr = String(e.tipo || '').toLowerCase();
      const isOcorrencia = 
        statusStr.includes('devol') || 
        statusStr.includes('parcial') || 
        statusStr.includes('reentrega') ||
        tipoStr.includes('devol') || 
        tipoStr.includes('parcial') || 
        tipoStr.includes('reentrega');

      if (!map.has(cod)) {
        const expedicoesSet = new Set();
        if (e.data || e.carga || e.placa) expedicoesSet.add(expedicaoKey);

        const notasSet = new Set();
        if (notaKey) notasSet.add(notaKey);

        const ocorrenciasSet = new Set();
        if (isOcorrencia) {
          ocorrenciasSet.add(`${e.data || ''}__${notaKey}__${e.tipo || e.status}`);
        }

        map.set(cod, {
          codCliente: cod,
          cliente: e.cliente || `Cliente ${cod}`,
          municipio: e.cidade || '',
          bairro: e.bairro || '',
          expedicoesSet,
          notasSet,
          ocorrenciasSet,
          ultimasEntregas: [e.data].filter(Boolean),
          temGps: false,
          pontos: []
        });
      } else {
        const item = map.get(cod);
        if (e.data || e.carga || e.placa) item.expedicoesSet.add(expedicaoKey);
        if (notaKey) item.notasSet.add(notaKey);
        if (isOcorrencia) {
          item.ocorrenciasSet.add(`${e.data || ''}__${notaKey}__${e.tipo || e.status}`);
        }
        if (e.data && !item.ultimasEntregas.includes(e.data)) {
          item.ultimasEntregas.push(e.data);
        }
        if (!item.municipio && e.cidade) item.municipio = e.cidade;
        if (!item.bairro && e.bairro) item.bairro = e.bairro;
      }
    });

    // 2. Mesclar ocorrências do histórico de devoluções
    (devolucoes || []).forEach(d => {
      const cod = String(d.codCliente || '').trim();
      let item = cod ? map.get(cod) : null;
      if (!item && d.cliente) {
        for (const val of map.values()) {
          if (val.cliente && val.cliente.trim().toLowerCase() === String(d.cliente).trim().toLowerCase()) {
            item = val;
            break;
          }
        }
      }
      if (item) {
        const ocKey = `dev__${d.data || ''}__${d.nota || d.id || ''}__${d.tipo || 'Devolucao'}`;
        item.ocorrenciasSet.add(ocKey);
      }
    });

    // 3. Mesclar ocorrências das solicitações de devolução
    (solicitacoesDevolucao || []).forEach(s => {
      const cod = String(s.codCliente || '').trim();
      let item = cod ? map.get(cod) : null;
      if (!item && s.cliente) {
        for (const val of map.values()) {
          if (val.cliente && val.cliente.trim().toLowerCase() === String(s.cliente).trim().toLowerCase()) {
            item = val;
            break;
          }
        }
      }
      if (item) {
        const ocKey = `solic__${s.data || ''}__${s.nota || s.id || ''}__${s.tipo || 'Ocorrencia'}`;
        item.ocorrenciasSet.add(ocKey);
      }
    });

    // 4. Mesclar com base de geolocalização
    (clientesGeoloc || []).forEach(cg => {
      const cod = String(cg.codCliente || cg.id || '').trim();
      if (!cod) return;
      const pontosValidos = Array.isArray(cg.pontos) ? cg.pontos : [];
      const temPontos = pontosValidos.length > 0;

      if (!map.has(cod)) {
        map.set(cod, {
          codCliente: cod,
          cliente: cg.cliente || `Cliente ${cod}`,
          municipio: cg.municipio || '',
          bairro: cg.bairro || '',
          expedicoesSet: new Set(),
          notasSet: new Set(),
          ocorrenciasSet: new Set(),
          ultimasEntregas: [],
          temGps: temPontos,
          pontos: pontosValidos
        });
      } else {
        const item = map.get(cod);
        item.temGps = temPontos;
        item.pontos = pontosValidos;
        if (cg.cliente && (!item.cliente || item.cliente.startsWith('Cliente '))) item.cliente = cg.cliente;
        if (cg.municipio && !item.municipio) item.municipio = cg.municipio;
        if (cg.bairro && !item.bairro) item.bairro = cg.bairro;
      }
    });

    // 5. Finalizar contagens calculadas
    return Array.from(map.values()).map(c => ({
      ...c,
      totalExpedicoes: c.expedicoesSet ? c.expedicoesSet.size : 0,
      totalNotas: c.notasSet ? c.notasSet.size : 0,
      totalOcorrencias: c.ocorrenciasSet ? c.ocorrenciasSet.size : 0
    })).sort((a, b) => (a.cliente || '').localeCompare(b.cliente || ''));
  }, [entregas, devolucoes, solicitacoesDevolucao, clientesGeoloc]);

  // Mapa rápido de grupos por cliente
  const gruposPorCliente = useMemo(() => {
    const map = new Map();
    (gruposClientes || []).forEach(g => {
      (g.codClientes || []).forEach(cod => {
        const c = String(cod).trim();
        if (!map.has(c)) map.set(c, []);
        map.get(c).push(g);
      });
    });
    return map;
  }, [gruposClientes]);

  // Filtragem de Clientes
  const clientesFiltrados = useMemo(() => {
    return clientesConsolidados.filter(c => {
      // Filtro por grupo/rede
      if (filtroGrupoAtivo !== 'todos') {
        const gruposDoCli = gruposPorCliente.get(c.codCliente) || [];
        const matchG = gruposDoCli.some(g => g.id === filtroGrupoAtivo || g.nome === filtroGrupoAtivo);
        if (!matchG) return false;
      }

      // Filtro rápido de ocorrências e status
      if (filtroOcorrencia === 'com_ocorrencias' && c.totalOcorrencias === 0) return false;
      if (filtroOcorrencia === 'sem_ocorrencias' && c.totalOcorrencias > 0) return false;
      if (filtroOcorrencia === 'com_gps' && !c.temGps) return false;
      if (filtroOcorrencia === 'sem_gps' && c.temGps) return false;
      if (filtroOcorrencia === 'sem_rede') {
        const gruposDoCli = gruposPorCliente.get(c.codCliente) || [];
        if (gruposDoCli.length > 0) return false;
      }

      // Filtro por texto
      if (buscaTexto.trim()) {
        const t = buscaTexto.toLowerCase().trim();
        const gruposDoCli = gruposPorCliente.get(c.codCliente) || [];
        const matchGrupoNome = gruposDoCli.some(g => (g.nome || '').toLowerCase().includes(t));
        const match = 
          c.codCliente.toLowerCase().includes(t) ||
          (c.cliente || '').toLowerCase().includes(t) ||
          (c.municipio || '').toLowerCase().includes(t) ||
          (c.bairro || '').toLowerCase().includes(t) ||
          matchGrupoNome;
        if (!match) return false;
      }

      return true;
    });
  }, [clientesConsolidados, filtroGrupoAtivo, filtroOcorrencia, buscaTexto, gruposPorCliente]);

  // KPIs Resumo do Módulo de Clientes
  const kpis = useMemo(() => {
    const totalClientes = clientesConsolidados.length;
    const totalExpedicoes = clientesConsolidados.reduce((acc, c) => acc + (c.totalExpedicoes || 0), 0);
    const totalNotas = clientesConsolidados.reduce((acc, c) => acc + (c.totalNotas || 0), 0);
    const totalOcorrencias = clientesConsolidados.reduce((acc, c) => acc + (c.totalOcorrencias || 0), 0);
    const clientesComOcorrencias = clientesConsolidados.filter(c => c.totalOcorrencias > 0).length;
    const clientesComGps = clientesConsolidados.filter(c => c.temGps).length;
    const taxaSucesso = totalExpedicoes > 0 
      ? (((totalExpedicoes - totalOcorrencias) / totalExpedicoes) * 100).toFixed(1)
      : '100.0';

    return {
      totalClientes,
      totalExpedicoes,
      totalNotas,
      totalOcorrencias,
      clientesComOcorrencias,
      clientesComGps,
      taxaSucesso
    };
  }, [clientesConsolidados]);

  // Clientes filtrados para o modal de grupo
  const modalClientesDisponiveis = useMemo(() => {
    if (!modalGrupo) return [];
    let list = clientesConsolidados;
    if (grupoBuscaCliente.trim()) {
      const t = grupoBuscaCliente.toLowerCase().trim();
      list = list.filter(c => 
        c.codCliente.toLowerCase().includes(t) ||
        (c.cliente || '').toLowerCase().includes(t) ||
        (c.municipio || '').toLowerCase().includes(t) ||
        (c.bairro || '').toLowerCase().includes(t)
      );
    }
    return list;
  }, [clientesConsolidados, modalGrupo, grupoBuscaCliente]);

  // Ações de Grupos
  const handleAbrirCriarGrupo = () => {
    setModalGrupo({
      id: '',
      nome: '',
      cor: 'emerald',
      descricao: '',
      codClientes: []
    });
    setGrupoBuscaCliente('');
  };

  const handleAbrirEditarGrupo = (g) => {
    setModalGrupo({
      id: g.id,
      nome: g.nome || '',
      cor: g.cor || 'emerald',
      descricao: g.descricao || '',
      codClientes: Array.isArray(g.codClientes) ? [...g.codClientes] : []
    });
    setGrupoBuscaCliente('');
  };

  const handleToggleClienteNoGrupo = (codCliente) => {
    if (!modalGrupo) return;
    const cod = String(codCliente).trim();
    const jaTem = modalGrupo.codClientes.includes(cod);
    setModalGrupo(prev => ({
      ...prev,
      codClientes: jaTem 
        ? prev.codClientes.filter(c => c !== cod)
        : [...prev.codClientes, cod]
    }));
  };

  const handleSelecionarTodosVisiveis = () => {
    if (!modalGrupo) return;
    const codsVisiveis = modalClientesDisponiveis.map(c => c.codCliente);
    const todosJaSelecionados = codsVisiveis.every(cod => modalGrupo.codClientes.includes(cod));

    if (todosJaSelecionados) {
      const codsSet = new Set(codsVisiveis);
      setModalGrupo(prev => ({
        ...prev,
        codClientes: prev.codClientes.filter(c => !codsSet.has(c))
      }));
    } else {
      const combined = Array.from(new Set([...modalGrupo.codClientes, ...codsVisiveis]));
      setModalGrupo(prev => ({
        ...prev,
        codClientes: combined
      }));
    }
  };

  const handleSalvarGrupo = async (e) => {
    e?.preventDefault();
    if (!modalGrupo || !modalGrupo.nome.trim()) return;

    setSalvandoGrupo(true);
    try {
      await salvarGrupoCliente(modalGrupo);
      setModalGrupo(null);
    } catch (err) {
      console.error("Erro ao salvar grupo:", err);
      alert("Erro ao salvar grupo de clientes.");
    } finally {
      setSalvandoGrupo(false);
    }
  };

  const handleExcluirGrupo = async (grupoId, nome) => {
    if (window.confirm(`Tem certeza que deseja remover a rede/grupo "${nome}"? As lojas não serão excluídas, apenas desvinculadas.`)) {
      try {
        await removerGrupoCliente(grupoId);
        if (filtroGrupoAtivo === grupoId) setFiltroGrupoAtivo('todos');
      } catch (err) {
        console.error("Erro ao remover grupo:", err);
        alert("Erro ao excluir grupo.");
      }
    }
  };

  const handleExportarXLSX = () => {
    if (clientesFiltrados.length === 0) return;

    const dataRows = clientesFiltrados.map(c => {
      const gList = gruposPorCliente.get(c.codCliente) || [];
      return {
        'Código Cliente': c.codCliente,
        'Razão Social / Loja': c.cliente,
        'Cidade / Município': c.municipio || '-',
        'Bairro': c.bairro || '-',
        'Rede / Grupo': gList.map(g => g.nome).join(', ') || 'Nenhum',
        'Expedições (Entregas Únicas)': c.totalExpedicoes || 0,
        'Total de Notas Faturadas': c.totalNotas || 0,
        'Ocorrências (Devoluções/Parciais)': c.totalOcorrencias || 0,
        'Status GPS': c.temGps ? 'Mapeado' : 'Sem GPS'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Clientes");
    XLSX.writeFile(workbook, `Cadastro_Clientes_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-4">
      {/* Cards de Métricas da Base de Clientes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Total de Lojas */}
        <div className="bg-background-primary p-3.5 sm:p-4 rounded-2xl border border-border-secondary shadow-xs">
          <div className="flex items-center justify-between text-text-secondary mb-1">
            <span className="text-xs font-bold">Total de Lojas</span>
            <Building2 size={16} className="text-info" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-text-primary font-mono">
            {kpis.totalClientes}
          </div>
          <p className="text-[11px] text-text-tertiary mt-0.5">
            {gruposClientes.length} rede(s) cadastrada(s)
          </p>
        </div>

        {/* Total de Expedições */}
        <div className="bg-background-primary p-3.5 sm:p-4 rounded-2xl border border-border-secondary shadow-xs">
          <div className="flex items-center justify-between text-info mb-1">
            <span className="text-xs font-bold text-text-secondary">Expedições</span>
            <CheckCircle2 size={16} />
          </div>
          <div className="text-xl sm:text-2xl font-black text-info font-mono">
            {kpis.totalExpedicoes}
          </div>
          <p className="text-[11px] text-text-tertiary mt-0.5">
            {kpis.totalNotas} notas faturadas
          </p>
        </div>

        {/* Total de Ocorrências */}
        <div className="bg-background-primary p-3.5 sm:p-4 rounded-2xl border border-border-secondary shadow-xs">
          <div className="flex items-center justify-between text-rose-400 mb-1">
            <span className="text-xs font-bold text-text-secondary">Ocorrências</span>
            <AlertCircle size={16} />
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-400 font-mono">
            {kpis.totalOcorrencias}
          </div>
          <p className="text-[11px] text-text-tertiary mt-0.5">
            {kpis.clientesComOcorrencias} loja(s) com ocorrência
          </p>
        </div>

        {/* Taxa de Eficiência / Sucesso */}
        <div className="bg-background-primary p-3.5 sm:p-4 rounded-2xl border border-border-secondary shadow-xs">
          <div className="flex items-center justify-between text-emerald-400 mb-1">
            <span className="text-xs font-bold text-text-secondary">Taxa de Sucesso</span>
            <TrendingUp size={16} />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
            {kpis.taxaSucesso}%
          </div>
          <p className="text-[11px] text-text-tertiary mt-0.5">
            {kpis.clientesComGps} loja(s) com GPS
          </p>
        </div>
      </div>

      {/* Sub-Navegação e Ações Rápidas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-background-primary p-3 sm:p-4 rounded-2xl border border-border-secondary shadow-xs">
        {/* Chips de Sub-Abas (Lojas vs Redes) */}
        <div className="flex items-center gap-1.5 p-1 bg-background-secondary rounded-xl border border-border-secondary">
          <button
            type="button"
            onClick={() => setFiltroSubAba('clientes')}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
              filtroSubAba === 'clientes'
                ? "bg-info text-white shadow-xs"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            <Building2 size={14} />
            <span>Lojas & Clientes ({clientesConsolidados.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setFiltroSubAba('grupos')}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
              filtroSubAba === 'grupos'
                ? "bg-info text-white shadow-xs"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            <Layers size={14} />
            <span>Redes & Grupos ({gruposClientes.length})</span>
          </button>
        </div>

        {/* Ações da Direita */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportarXLSX}
            className="px-3 py-1.5 rounded-xl border border-border-secondary hover:bg-background-secondary text-text-primary text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Exportar Planilha de Clientes"
          >
            <FileSpreadsheet size={14} className="text-emerald-500" />
            <span className="hidden sm:inline">Exportar Excel</span>
          </button>

          <button
            type="button"
            onClick={handleAbrirCriarGrupo}
            className="px-3.5 py-1.5 rounded-xl bg-info hover:bg-info/90 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
          >
            <Plus size={15} />
            <span>Novo Grupo / Rede</span>
          </button>
        </div>
      </div>

      {/* Visão de Redes & Grupos */}
      {filtroSubAba === 'grupos' ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm sm:text-base font-black text-text-primary">
                Redes & Grupos Comerciais
              </h3>
              <p className="text-xs text-text-tertiary">
                Agrupamento estratégico de clientes (ex.: Atakarejo, Rede Mix, Hiperideal, Mercantil)
              </p>
            </div>
          </div>

          {gruposClientes.length === 0 ? (
            <div className="bg-background-primary p-12 text-center rounded-2xl border border-border-secondary text-text-tertiary">
              <Layers size={40} className="mx-auto mb-3 opacity-30 text-info" />
              <p className="text-sm font-bold text-text-primary">Nenhum grupo cadastrado ainda</p>
              <p className="text-xs text-text-tertiary mt-1 mb-4">Crie grupos para agrupar lojas e redes comerciais.</p>
              <button
                type="button"
                onClick={handleAbrirCriarGrupo}
                className="px-4 py-2 bg-info text-white rounded-xl text-xs font-bold hover:bg-info/90 shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={15} />
                <span>Criar Primeiro Grupo</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {gruposClientes.map(g => {
                const corObj = GRUPO_CORES[g.cor] || GRUPO_CORES.emerald;
                const totalLojas = (g.codClientes || []).length;
                const lojasDoGrupo = clientesConsolidados.filter(c => (g.codClientes || []).includes(c.codCliente));
                const totalExpedicoesGrupo = lojasDoGrupo.reduce((acc, c) => acc + (c.totalExpedicoes || 0), 0);
                const totalOcorrenciasGrupo = lojasDoGrupo.reduce((acc, c) => acc + (c.totalOcorrencias || 0), 0);
                const lojasAmostra = lojasDoGrupo.slice(0, 4);

                return (
                  <div 
                    key={g.id} 
                    className="bg-background-primary rounded-2xl border border-border-secondary p-4 shadow-xs hover:border-info/40 transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Topo do Card de Grupo */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className={cn("w-3.5 h-3.5 rounded-full ring-2 shadow-xs", corObj.badge, corObj.ring)} />
                          <h4 className="text-sm font-black text-text-primary tracking-tight">
                            {g.nome}
                          </h4>
                        </div>
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", corObj.bg, corObj.text, corObj.border)}>
                          {totalLojas} {totalLojas === 1 ? 'loja' : 'lojas'}
                        </span>
                      </div>

                      {g.descricao && (
                        <p className="text-xs text-text-tertiary mb-2 line-clamp-2">
                          {g.descricao}
                        </p>
                      )}

                      {/* Métricas Consolidadas da Rede */}
                      <div className="grid grid-cols-2 gap-2 my-2.5 p-2 bg-background-secondary/60 rounded-xl border border-border-secondary/60">
                        <div>
                          <span className="text-[10px] text-text-tertiary block">Expedições</span>
                          <span className="text-xs font-mono font-bold text-text-primary">
                            {totalExpedicoesGrupo}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-text-tertiary block">Ocorrências</span>
                          <span className={cn(
                            "text-xs font-mono font-bold",
                            totalOcorrenciasGrupo > 0 ? "text-rose-400" : "text-emerald-400"
                          )}>
                            {totalOcorrenciasGrupo}
                          </span>
                        </div>
                      </div>

                      {/* Amostra de Lojas */}
                      <div className="mt-2 pt-2 border-t border-border-secondary/60 space-y-1">
                        <p className="text-[10px] uppercase font-bold text-text-tertiary tracking-wider mb-1">
                          Lojas Vinculadas:
                        </p>
                        {totalLojas === 0 ? (
                          <p className="text-xs text-text-tertiary italic">Nenhuma loja vinculada a esta rede</p>
                        ) : (
                          <div className="space-y-1">
                            {lojasAmostra.map(l => (
                              <div key={l.codCliente} className="flex items-center justify-between text-xs py-0.5">
                                <span className="text-text-secondary truncate max-w-[70%]" title={l.cliente}>
                                  <strong className="font-mono text-text-primary font-bold">#{l.codCliente}</strong> - {l.cliente}
                                </span>
                                <span className="text-[10px] text-text-tertiary truncate">{l.municipio || ''}</span>
                              </div>
                            ))}
                            {totalLojas > 4 && (
                              <p className="text-[10px] text-info font-bold pt-1">
                                + {totalLojas - 4} outras lojas nesta rede
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Ações do Card */}
                    <div className="mt-4 pt-3 border-t border-border-secondary flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setFiltroGrupoAtivo(g.id);
                          setFiltroSubAba('clientes');
                        }}
                        className="text-xs text-info hover:text-info/80 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <span>Ver Lojas</span>
                        <ChevronRight size={14} />
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleAbrirEditarGrupo(g)}
                          className="p-1.5 text-text-tertiary hover:text-info hover:bg-background-secondary rounded-lg transition-colors cursor-pointer"
                          title="Editar Rede / Grupo"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExcluirGrupo(g.id, g.nome)}
                          className="p-1.5 text-text-tertiary hover:text-danger hover:bg-danger/10 rounded-lg transition-colors cursor-pointer"
                          title="Excluir Rede"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Visão Principal de Clientes */
        <div className="space-y-4">
          {/* Barra de Filtros e Busca */}
          <div className="flex flex-col md:flex-row md:items-center gap-3 bg-background-primary p-3 sm:p-4 rounded-2xl border border-border-secondary shadow-xs">
            {/* Campo de Busca Geral */}
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input
                type="text"
                value={buscaTexto}
                onChange={(e) => setBuscaTexto(e.target.value)}
                placeholder="Buscar por código, loja, rede, cidade ou bairro..."
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

            {/* Seletor de Rede Ativa */}
            <div className="w-full md:w-56 shrink-0">
              <select
                value={filtroGrupoAtivo}
                onChange={(e) => setFiltroGrupoAtivo(e.target.value)}
                className="w-full bg-background-secondary border border-border-secondary rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-text-primary focus:outline-none focus:border-info transition-colors shadow-xs cursor-pointer"
              >
                <option value="todos">Todas as Redes</option>
                {gruposClientes.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.nome} ({(g.codClientes || []).length} lojas)
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro Rápido de Status / Ocorrências */}
            <div className="w-full md:w-52 shrink-0">
              <select
                value={filtroOcorrencia}
                onChange={(e) => setFiltroOcorrencia(e.target.value)}
                className="w-full bg-background-secondary border border-border-secondary rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-text-primary focus:outline-none focus:border-info transition-colors shadow-xs cursor-pointer"
              >
                <option value="todos">Todos os Clientes</option>
                <option value="com_ocorrencias">Com Ocorrências</option>
                <option value="sem_ocorrencias">Sem Ocorrências</option>
                <option value="sem_rede">Sem Rede Vinculada</option>
                <option value="com_gps">Com Ponto GPS</option>
                <option value="sem_gps">Sem Ponto GPS</option>
              </select>
            </div>
          </div>

          {/* Feedback de Filtro de Grupo Ativo */}
          {filtroGrupoAtivo !== 'todos' && (
            <div className="flex items-center gap-2 p-2 px-3 bg-info/10 border border-info/20 rounded-xl text-xs text-info font-medium">
              <span>Filtrando por rede:</span>
              <strong className="font-bold">
                {gruposClientes.find(g => g.id === filtroGrupoAtivo)?.nome || filtroGrupoAtivo}
              </strong>
              <button
                type="button"
                onClick={() => setFiltroGrupoAtivo('todos')}
                className="ml-auto p-0.5 hover:bg-info/20 rounded text-info transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Tabela Desktop */}
          <div className="hidden md:block bg-background-primary rounded-2xl border border-border-secondary shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-background-secondary/70 border-b border-border-secondary text-text-secondary">
                    {/* Coluna Unificada: Cliente / Cód. */}
                    <th className="py-3.5 px-4 font-bold w-[34%]">Cliente / Cód.</th>
                    <th className="py-3.5 px-4 font-bold w-[20%]">Redes / Grupos</th>
                    <th className="py-3.5 px-4 font-bold w-[14%] text-center">Expedições</th>
                    <th className="py-3.5 px-4 font-bold w-[14%] text-center">Ocorrências</th>
                    <th className="py-3.5 px-4 font-bold w-[10%] text-center">GPS</th>
                    <th className="py-3.5 px-4 font-bold w-[8%] text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-secondary/60">
                  {clientesFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-text-tertiary">
                        Nenhum cliente encontrado para os filtros selecionados
                      </td>
                    </tr>
                  ) : (
                    clientesFiltrados.map((c) => {
                      const gruposDoCli = gruposPorCliente.get(c.codCliente) || [];

                      return (
                        <tr key={c.codCliente} className="hover:bg-background-secondary/40 transition-colors">
                          {/* 1. Cliente e Código em uma única coluna */}
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-text-primary block text-sm leading-tight">
                              {c.cliente}
                            </span>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className="font-mono font-bold text-[11px] text-info bg-info/10 px-1.5 py-0.2 rounded border border-info/20">
                                #{c.codCliente}
                              </span>
                              <span className="text-[11px] text-text-tertiary truncate">
                                {c.municipio || '-'}{c.bairro ? ` • ${c.bairro}` : ''}
                              </span>
                            </div>
                          </td>

                          {/* 2. Redes / Grupos */}
                          <td className="py-3.5 px-4">
                            {gruposDoCli.length === 0 ? (
                              <span className="text-[11px] text-text-tertiary italic">Sem rede vinculada</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {gruposDoCli.map(g => {
                                  const corObj = GRUPO_CORES[g.cor] || GRUPO_CORES.emerald;
                                  return (
                                    <span 
                                      key={g.id}
                                      className={cn(
                                        "px-2 py-0.5 rounded-md text-[10.5px] font-bold border flex items-center gap-1",
                                        corObj.bg, corObj.text, corObj.border
                                      )}
                                    >
                                      <span className={cn("w-1.5 h-1.5 rounded-full", corObj.badge)} />
                                      {g.nome}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </td>

                          {/* 3. Contagem de Expedições (Entregas únicas) */}
                          <td className="py-3.5 px-4 text-center">
                            <span className="font-mono font-black text-sm text-text-primary block">
                              {c.totalExpedicoes}
                            </span>
                            <span className="text-[10px] text-text-tertiary block mt-0.5">
                              {c.totalNotas} {c.totalNotas === 1 ? 'nota' : 'notas'}
                            </span>
                          </td>

                          {/* 4. Contagem de Ocorrências (Devoluções, Parciais, Reentregas) */}
                          <td className="py-3.5 px-4 text-center">
                            {c.totalOcorrencias === 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-background-secondary text-text-tertiary border border-border-tertiary inline-flex items-center gap-1">
                                0
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-black bg-rose-500/15 text-rose-400 border border-rose-500/30 inline-flex items-center gap-1 animate-pulse">
                                <AlertCircle size={12} />
                                <span>{c.totalOcorrencias}</span>
                              </span>
                            )}
                          </td>

                          {/* 5. Status GPS */}
                          <td className="py-3.5 px-4 text-center">
                            {c.temGps ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 inline-flex items-center gap-1">
                                <MapPin size={10} />
                                <span>GPS</span>
                              </span>
                            ) : (
                              <span className="text-[10.5px] text-text-tertiary">
                                -
                              </span>
                            )}
                          </td>

                          {/* 6. Ações */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => setModalCliente(c)}
                              className="px-2.5 py-1 rounded-lg bg-background-secondary hover:bg-info hover:text-white text-text-secondary border border-border-secondary hover:border-info text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                              title="Vincular a uma Rede"
                            >
                              <Edit3 size={13} />
                              <span className="hidden lg:inline">Rede</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {clientesFiltrados.length > 0 && (
              <div className="p-3 bg-background-secondary/30 border-t border-border-secondary flex justify-between items-center text-xs text-text-tertiary">
                <span>Mostrando {clientesFiltrados.length} cliente(s)</span>
                <span>Total cadastrado: {clientesConsolidados.length}</span>
              </div>
            )}
          </div>

          {/* Cards Mobile */}
          <div className="block md:hidden space-y-2.5">
            {clientesFiltrados.length === 0 ? (
              <div className="bg-background-primary p-8 text-center rounded-2xl border border-border-secondary text-text-tertiary text-xs">
                Nenhum cliente encontrado
              </div>
            ) : (
              clientesFiltrados.map((c) => {
                const gruposDoCli = gruposPorCliente.get(c.codCliente) || [];

                return (
                  <div 
                    key={c.codCliente}
                    className="bg-background-primary p-3.5 rounded-2xl border border-border-secondary shadow-xs space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-text-primary block text-sm">
                          {c.cliente}
                        </span>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="font-mono font-bold text-[10.5px] text-info bg-info/10 px-1.5 py-0.2 rounded border border-info/20">
                            #{c.codCliente}
                          </span>
                          <span className="text-[11px] text-text-tertiary">
                            {c.municipio || '-'}{c.bairro ? ` • ${c.bairro}` : ''}
                          </span>
                        </div>
                      </div>

                      {c.temGps && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shrink-0 flex items-center gap-0.5">
                          <MapPin size={10} />
                          GPS
                        </span>
                      )}
                    </div>

                    {/* Métricas: Expedições & Ocorrências */}
                    <div className="grid grid-cols-2 gap-2 p-2 bg-background-secondary/60 rounded-xl border border-border-secondary/60 text-xs">
                      <div>
                        <span className="text-[10px] text-text-tertiary block">Expedições</span>
                        <span className="font-mono font-bold text-text-primary">
                          {c.totalExpedicoes} <span className="text-[10px] text-text-tertiary font-normal">({c.totalNotas} nfs)</span>
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-text-tertiary block">Ocorrências</span>
                        <span className={cn(
                          "font-mono font-bold",
                          c.totalOcorrencias > 0 ? "text-rose-400" : "text-emerald-400"
                        )}>
                          {c.totalOcorrencias}
                        </span>
                      </div>
                    </div>

                    {/* Redes e Botão de Vínculo */}
                    <div className="flex items-center justify-between pt-1 border-t border-border-secondary/60 gap-2">
                      <div className="flex flex-wrap gap-1 max-w-[70%]">
                        {gruposDoCli.length === 0 ? (
                          <span className="text-[10.5px] text-text-tertiary italic">Sem rede</span>
                        ) : (
                          gruposDoCli.map(g => {
                            const corObj = GRUPO_CORES[g.cor] || GRUPO_CORES.emerald;
                            return (
                              <span 
                                key={g.id}
                                className={cn(
                                  "px-1.5 py-0.2 rounded text-[10px] font-bold border",
                                  corObj.bg, corObj.text, corObj.border
                                )}
                              >
                                {g.nome}
                              </span>
                            );
                          })
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setModalCliente(c)}
                        className="px-2.5 py-1 rounded-lg bg-background-secondary hover:bg-info hover:text-white text-text-secondary border border-border-secondary text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                      >
                        <Edit3 size={12} />
                        <span>Vincular</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: Criação / Edição de Rede / Grupo */}
      {modalGrupo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-background-primary border border-border-secondary rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-border-secondary flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-info/15 text-info flex items-center justify-center font-bold">
                  <Layers size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-text-primary">
                    {modalGrupo.id ? 'Editar Rede / Grupo' : 'Novo Grupo / Rede de Clientes'}
                  </h3>
                  <p className="text-xs text-text-tertiary">
                    Defina o nome da rede, cor e associe as lojas pertencentes
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalGrupo(null)}
                className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-background-secondary rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSalvarGrupo} className="p-4 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Nome do Grupo */}
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    Nome da Rede / Grupo *
                  </label>
                  <input
                    type="text"
                    required
                    value={modalGrupo.nome}
                    onChange={(e) => setModalGrupo({ ...modalGrupo, nome: e.target.value })}
                    placeholder="Ex: Atakarejo, Rede Mix, Hiperideal, Mercantil..."
                    className="w-full bg-background-secondary border border-border-secondary rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-info"
                  />
                </div>

                {/* Paleta de Cores */}
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    Cor de Identificação
                  </label>
                  <div className="flex items-center gap-2 flex-wrap pt-0.5">
                    {Object.entries(GRUPO_CORES).map(([corKey, corVal]) => {
                      const isSelected = modalGrupo.cor === corKey;
                      return (
                        <button
                          key={corKey}
                          type="button"
                          onClick={() => setModalGrupo({ ...modalGrupo, cor: corKey })}
                          className={cn(
                            "w-6 h-6 rounded-full transition-transform cursor-pointer flex items-center justify-center shadow-xs",
                            corVal.badge,
                            isSelected ? "ring-2 ring-white scale-110" : "opacity-80 hover:opacity-100"
                          )}
                          title={corVal.label}
                        >
                          {isSelected && <Check size={12} className="text-white" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Descrição Opcional */}
              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">
                  Descrição / Observações (Opcional)
                </label>
                <input
                  type="text"
                  value={modalGrupo.descricao}
                  onChange={(e) => setModalGrupo({ ...modalGrupo, descricao: e.target.value })}
                  placeholder="Ex: Rede de atacarejo com entregas semanais em Salvador e RMS"
                  className="w-full bg-background-secondary border border-border-secondary rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-info"
                />
              </div>

              {/* Seleção de Lojas para o Grupo */}
              <div className="pt-2 border-t border-border-secondary space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-text-primary block">
                      Lojas Associadas a esta Rede ({modalGrupo.codClientes.length} selecionadas)
                    </label>
                    <span className="text-[11px] text-text-tertiary">
                      Marque as lojas que fazem parte deste grupo
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleSelecionarTodosVisiveis}
                    className="text-xs text-info hover:text-info/80 font-bold cursor-pointer"
                  >
                    Selecionar / Desmarcar Visíveis
                  </button>
                </div>

                {/* Busca rápida dentro do modal */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                  <input
                    type="text"
                    value={grupoBuscaCliente}
                    onChange={(e) => setGrupoBuscaCliente(e.target.value)}
                    placeholder="Filtrar lojas para adicionar/remover..."
                    className="w-full bg-background-secondary border border-border-secondary rounded-xl pl-8 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-info"
                  />
                </div>

                {/* Lista de Checkboxes de Clientes */}
                <div className="max-h-56 overflow-y-auto border border-border-secondary rounded-xl p-2 space-y-1 bg-background-secondary/30 custom-scrollbar">
                  {modalClientesDisponiveis.length === 0 ? (
                    <p className="text-center py-4 text-xs text-text-tertiary">
                      Nenhuma loja encontrada
                    </p>
                  ) : (
                    modalClientesDisponiveis.map(c => {
                      const isSelected = modalGrupo.codClientes.includes(c.codCliente);

                      return (
                        <div
                          key={c.codCliente}
                          onClick={() => handleToggleClienteNoGrupo(c.codCliente)}
                          className={cn(
                            "flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors select-none",
                            isSelected 
                              ? "bg-info/15 text-text-primary border border-info/30" 
                              : "hover:bg-background-secondary text-text-secondary"
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // tratado no onClick pai
                              className="rounded border-border-secondary text-info focus:ring-0 cursor-pointer"
                            />
                            <div className="truncate">
                              <span className="font-bold text-text-primary mr-1.5">
                                #{c.codCliente}
                              </span>
                              <span className="truncate">{c.cliente}</span>
                            </div>
                          </div>

                          <div className="text-[11px] text-text-tertiary shrink-0">
                            {c.totalExpedicoes} exp. {c.municipio ? `• ${c.municipio}` : ''}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Botões do Rodapé */}
              <div className="pt-3 border-t border-border-secondary flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalGrupo(null)}
                  className="px-4 py-2 rounded-xl border border-border-secondary text-text-secondary hover:text-text-primary hover:bg-background-secondary text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoGrupo}
                  className="px-5 py-2 rounded-xl bg-info hover:bg-info/90 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {salvandoGrupo ? 'Salvando...' : 'Salvar Grupo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Vincular Rede Diretamente ao Cliente */}
      {modalCliente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-background-primary border border-border-secondary rounded-2xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-border-secondary flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-text-primary">
                  Vincular Rede à Loja
                </h3>
                <p className="text-xs text-text-tertiary mt-0.5">
                  <strong className="text-text-primary font-mono font-bold">#{modalCliente.codCliente}</strong> - {modalCliente.cliente}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalCliente(null)}
                className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-background-secondary rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
              <p className="text-xs text-text-secondary font-medium">
                Selecione as redes às quais esta loja pertence:
              </p>

              {gruposClientes.length === 0 ? (
                <div className="p-4 bg-background-secondary/60 rounded-xl text-center text-xs text-text-tertiary space-y-2">
                  <p>Nenhuma rede cadastrada.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setModalCliente(null);
                      handleAbrirCriarGrupo();
                    }}
                    className="px-3 py-1.5 bg-info text-white rounded-lg text-xs font-bold"
                  >
                    Criar Nova Rede
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                  {gruposClientes.map(g => {
                    const corObj = GRUPO_CORES[g.cor] || GRUPO_CORES.emerald;
                    const pertence = (g.codClientes || []).includes(modalCliente.codCliente);

                    return (
                      <div
                        key={g.id}
                        onClick={async () => {
                          if (pertence) {
                            await removerClienteDoGrupo(g.id, modalCliente.codCliente);
                          } else {
                            await atribuirClientesAoGrupo(g.id, [modalCliente.codCliente]);
                          }
                        }}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition-all select-none",
                          pertence 
                            ? "bg-info/10 border-info/40 text-text-primary shadow-xs" 
                            : "bg-background-secondary/60 border-border-secondary text-text-secondary hover:bg-background-secondary"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={cn("w-3 h-3 rounded-full ring-1", corObj.badge, corObj.ring)} />
                          <div>
                            <span className="font-bold text-text-primary block">{g.nome}</span>
                            {g.descricao && (
                              <span className="text-[10.5px] text-text-tertiary line-clamp-1">{g.descricao}</span>
                            )}
                          </div>
                        </div>

                        <div className={cn(
                          "w-5 h-5 rounded-md flex items-center justify-center border transition-colors",
                          pertence 
                            ? "bg-info border-info text-white" 
                            : "border-border-secondary bg-background-primary"
                        )}>
                          {pertence && <Check size={13} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-3 border-t border-border-secondary flex justify-end">
                <button
                  type="button"
                  onClick={() => setModalCliente(null)}
                  className="px-4 py-2 rounded-xl bg-info text-white text-xs font-bold hover:bg-info/90 shadow-xs cursor-pointer"
                >
                  Concluído
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AbaClientes;
