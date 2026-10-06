import React, { useState, useMemo } from 'react';
import { 
  Users, UserCheck, Search, Plus, Edit3, Trash2, Check, X, 
  Mail, MessageSquare, Briefcase, Building2, Sparkles,
  FileSpreadsheet, Copy, Bell
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useStore } from '../../store/useStore';
import { cn, normalizarRCA } from '../../lib/utils';

// Paleta visual e setores padrão da RJ
export const SETORES_RJ = [
  { id: 'Comercial', label: 'Comercial', corBg: 'bg-blue-500/15 text-blue-500 border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-400' },
  { id: 'Logistica', label: 'Logística', corBg: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-400' },
  { id: 'Financeiro', label: 'Financeiro', corBg: 'bg-amber-500/15 text-amber-500 border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-400' },
  { id: 'Operacional', label: 'Operacional', corBg: 'bg-purple-500/15 text-purple-500 border-purple-500/30 dark:bg-purple-500/20 dark:text-purple-400' },
  { id: 'Diretoria', label: 'Diretoria / Gestão', corBg: 'bg-rose-500/15 text-rose-500 border-rose-500/30 dark:bg-rose-500/20 dark:text-rose-400' },
  { id: 'SAC', label: 'SAC / Atendimento', corBg: 'bg-cyan-500/15 text-cyan-500 border-cyan-500/30 dark:bg-cyan-500/20 dark:text-cyan-400' },
  { id: 'TI', label: 'TI / Tecnologia', corBg: 'bg-slate-500/15 text-slate-400 border-slate-500/30 dark:bg-slate-500/20 dark:text-slate-300' },
];

export function getCorSetor(setorNome) {
  if (!setorNome) return 'bg-border-secondary text-text-secondary border-border-tertiary';
  const norm = String(setorNome).trim().toLowerCase();
  const encontrado = SETORES_RJ.find(s => s.id.toLowerCase() === norm || s.label.toLowerCase() === norm);
  if (encontrado) return encontrado.corBg;
  return 'bg-primary/10 text-primary border-primary/25';
}

// Limpa e normaliza telefone para WhatsApp (DDI 55 + DDD + Número)
export function normalizarWhatsApp(num) {
  if (!num) return '';
  const digits = String(num).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function AbaFuncionarios() {
  const { 
    funcionariosRJ = [], 
    entregas = [], 
    salvarFuncionarioRJ, 
    removerFuncionarioRJ,
    importarFuncionariosRJEmLote 
  } = useStore();

  const [buscaTexto, setBuscaTexto] = useState('');
  const [filtroSetor, setFiltroSetor] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos'); // 'todos' | 'Ativo' | 'Inativo'
  const [filtroContato, setFiltroContato] = useState('todos'); // 'todos' | 'com_whats' | 'com_email' | 'incompletos'

  // Modal de Criação / Edição
  const [modalFuncionario, setModalFuncionario] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [copiadoId, setCopiadoId] = useState(null);
  const [importandoLote, setImportandoLote] = useState(false);

  // 1. Extrair RCAs das entregas (com unificação de vendedores)
  const rcasDetectados = useMemo(() => {
    const map = new Map();
    (entregas || []).forEach(e => {
      const rcaOriginal = String(e.rca || '').trim();
      const rcaNome = normalizarRCA(rcaOriginal);
      if (!rcaNome || rcaNome.toUpperCase() === 'NÃO INFORMADO' || rcaNome.toUpperCase() === 'SEM RCA') return;
      
      const rcaKey = rcaNome.toUpperCase();
      if (!map.has(rcaKey)) {
        map.set(rcaKey, {
          nomeOriginal: rcaNome,
          totalEntregas: 1,
          clientes: new Set([e.codCliente || e.cliente])
        });
      } else {
        const item = map.get(rcaKey);
        item.totalEntregas += 1;
        if (e.codCliente || e.cliente) item.clientes.add(e.codCliente || e.cliente);
      }
    });

    return Array.from(map.entries()).map(([chave, val]) => ({
      chave,
      nome: val.nomeOriginal,
      totalEntregas: val.totalEntregas,
      totalClientes: val.clientes.size
    })).sort((a, b) => b.totalEntregas - a.totalEntregas);
  }, [entregas]);

  // RCAs que ainda não constam na lista de funcionários cadastrados
  const rcasNaoCadastrados = useMemo(() => {
    const cadastradosNomes = new Set(
      (funcionariosRJ || []).map(f => normalizarRCA(String(f.nome || '').trim()).toUpperCase())
    );
    return rcasDetectados.filter(rca => !cadastradosNomes.has(normalizarRCA(rca.nome).toUpperCase()));
  }, [rcasDetectados, funcionariosRJ]);

  // 2. Consolidar Lista de Funcionários com Métricas de Entregas (caso seja RCA)
  const listaFuncionarios = useMemo(() => {
    const rcaMetricsMap = new Map(rcasDetectados.map(r => [r.chave, r]));

    return (funcionariosRJ || [])
      .filter(f => f && typeof f === 'object' && (f.nome || f.id))
      .map(f => {
        const nomeFinal = f.nome || (f.id?.startsWith('func_') ? 'Sem Nome' : String(f.id));
        const nomeKey = normalizarRCA(String(nomeFinal).trim()).toUpperCase();
        const rcaMetric = rcaMetricsMap.get(nomeKey);

        return {
          ...f,
          nome: nomeFinal,
          totalEntregasRca: rcaMetric ? rcaMetric.totalEntregas : 0,
          totalClientesRca: rcaMetric ? rcaMetric.totalClientes : 0,
          temWhatsApp: Boolean(f.whatsapp && String(f.whatsapp).trim().replace(/\D/g, '').length >= 8),
          temEmail: Boolean(f.email && String(f.email).includes('@'))
        };
      });
  }, [funcionariosRJ, rcasDetectados]);

  // 3. Filtragem da Lista
  const funcionariosFiltrados = useMemo(() => {
    const q = buscaTexto.toLowerCase().trim();

    return listaFuncionarios.filter(f => {
      // Busca texto
      if (q) {
        const matchNome = (f.nome || '').toLowerCase().includes(q);
        const matchEmail = (f.email || '').toLowerCase().includes(q);
        const matchWhats = (f.whatsapp || '').toLowerCase().includes(q);
        const matchSetor = (f.setor || '').toLowerCase().includes(q);
        const matchCargo = (f.cargo || '').toLowerCase().includes(q);
        const matchObs = (f.observacao || '').toLowerCase().includes(q);
        if (!matchNome && !matchEmail && !matchWhats && !matchSetor && !matchCargo && !matchObs) {
          return false;
        }
      }

      // Filtro Setor
      if (filtroSetor !== 'todos') {
        if ((f.setor || '').toLowerCase() !== filtroSetor.toLowerCase()) {
          return false;
        }
      }

      // Filtro Status
      if (filtroStatus !== 'todos') {
        const status = f.status || 'Ativo';
        if (status !== filtroStatus) return false;
      }

      // Filtro Contato / Automação
      if (filtroContato === 'com_whats' && !f.temWhatsApp) return false;
      if (filtroContato === 'com_email' && !f.temEmail) return false;
      if (filtroContato === 'incompletos' && (f.temWhatsApp && f.temEmail)) return false;

      return true;
    }).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [listaFuncionarios, buscaTexto, filtroSetor, filtroStatus, filtroContato]);

  // Métricas / KPIs
  const kpis = useMemo(() => {
    const total = listaFuncionarios.length;
    const comerciais = listaFuncionarios.filter(f => (f.setor || '').toLowerCase() === 'comercial').length;
    const logistica = listaFuncionarios.filter(f => (f.setor || '').toLowerCase() === 'logistica' || (f.setor || '').toLowerCase() === 'logística').length;
    const prontosParaAutomacao = listaFuncionarios.filter(f => f.temWhatsApp || f.temEmail).length;
    const ativos = listaFuncionarios.filter(f => (f.status || 'Ativo') === 'Ativo').length;

    return { total, comerciais, logistica, prontosParaAutomacao, ativos };
  }, [listaFuncionarios]);

  // Ações
  const handleCopiar = (texto, id) => {
    if (!texto) return;
    navigator.clipboard.writeText(texto);
    setCopiadoId(id);
    setTimeout(() => setCopiadoId(null), 2000);
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    if (!modalFuncionario || !modalFuncionario.nome?.trim()) {
      alert('Por favor, informe o nome do colaborador.');
      return;
    }

    try {
      setSalvando(true);
      const id = modalFuncionario.id || `func_${Date.now()}`;
      await salvarFuncionarioRJ({
        id,
        nome: modalFuncionario.nome.trim(),
        email: (modalFuncionario.email || '').trim().toLowerCase(),
        whatsapp: (modalFuncionario.whatsapp || '').trim(),
        setor: modalFuncionario.setor || 'Comercial',
        cargo: (modalFuncionario.cargo || '').trim(),
        status: modalFuncionario.status || 'Ativo',
        receberRelatorios: Boolean(modalFuncionario.receberRelatorios),
        receberOcorrencias: Boolean(modalFuncionario.receberOcorrencias),
        observacao: (modalFuncionario.observacao || '').trim(),
      });
      setModalFuncionario(null);
    } catch (err) {
      console.error('Erro ao salvar funcionário:', err);
      alert('Erro ao salvar colaborador: ' + (err.message || 'Verifique sua conexão.'));
    } finally {
      setSalvando(false);
    }
  };

  const handleRemover = async (f) => {
    if (window.confirm(`Deseja realmente remover o colaborador "${f.nome}" da equipe RJ?`)) {
      try {
        await removerFuncionarioRJ(f.id);
      } catch (err) {
        console.error('Erro ao remover funcionário:', err);
        alert('Erro ao remover colaborador: ' + err.message);
      }
    }
  };

  // Importar todos os RCAs detectados que ainda não estão cadastrados
  const handleImportarTodosRcas = async () => {
    if (rcasNaoCadastrados.length === 0) return;
    const confirm = window.confirm(
      `Deseja cadastrar automaticamente os ${rcasNaoCadastrados.length} RCAs encontrados nas entregas como colaboradores do setor Comercial?`
    );
    if (!confirm) return;

    try {
      setImportandoLote(true);
      const novos = rcasNaoCadastrados.map((rca, idx) => ({
        id: `rca_${Date.now()}_${idx}`,
        nome: rca.nome,
        email: '',
        whatsapp: '',
        setor: 'Comercial',
        cargo: 'RCA / Vendedor',
        status: 'Ativo',
        receberRelatorios: true,
        receberOcorrencias: true,
        observacao: `Importado automaticamente a partir das entregas (${rca.totalEntregas} entregas registradas).`,
        criadoEm: new Date().toISOString()
      }));

      await importarFuncionariosRJEmLote(novos);
    } catch (err) {
      console.error('Erro na importação em lote de RCAs:', err);
      alert('Erro ao importar RCAs: ' + err.message);
    } finally {
      setImportandoLote(false);
    }
  };

  // Cadastrar um RCA avulso
  const handleCadastrarRcaIndividual = (rca) => {
    setModalFuncionario({
      id: null,
      nome: rca.nome,
      email: '',
      whatsapp: '',
      setor: 'Comercial',
      cargo: 'RCA / Vendedor',
      status: 'Ativo',
      receberRelatorios: true,
      receberOcorrencias: true,
      observacao: `RCA detectado nas entregas (${rca.totalEntregas} entregas registradas).`
    });
  };

  // Exportar lista para Excel
  const exportarExcel = () => {
    const dados = funcionariosFiltrados.map(f => ({
      'Nome': f.nome,
      'Setor': f.setor || 'Comercial',
      'Cargo': f.cargo || '',
      'Status': f.status || 'Ativo',
      'WhatsApp': f.whatsapp || '',
      'E-mail': f.email || '',
      'Receber Relatórios Diários': f.receberRelatorios ? 'SIM' : 'NÃO',
      'Receber Alertas de Ocorrências': f.receberOcorrencias ? 'SIM' : 'NÃO',
      'Entregas Vinculadas (RCA)': f.totalEntregasRca || 0,
      'Observação': f.observacao || ''
    }));

    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Equipe RJ');
    XLSX.writeFile(wb, `equipe_rj_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Cabeçalho Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-background-secondary p-5 sm:p-6 rounded-2xl border border-border-secondary shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-500 dark:bg-blue-500/20 rounded-xl">
              <UserCheck size={26} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-text-primary tracking-tight flex items-center gap-2">
                Equipe & Funcionários RJ
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-500 dark:text-blue-400">
                  {listaFuncionarios.length} cadastrados
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-text-secondary">
                Cadastro central de contatos da equipe (e-mails, WhatsApps, setores) para relatórios e automações.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={exportarExcel}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl border border-border-secondary bg-background-primary text-text-secondary hover:text-text-primary hover:bg-background-tertiary transition-all cursor-pointer shadow-xs"
            title="Exportar para Excel"
          >
            <FileSpreadsheet size={16} className="text-emerald-500" />
            <span>Exportar XLSX</span>
          </button>

          <button
            onClick={() => setModalFuncionario({
              id: null,
              nome: '',
              email: '',
              whatsapp: '',
              setor: 'Comercial',
              cargo: '',
              status: 'Ativo',
              receberRelatorios: true,
              receberOcorrencias: true,
              observacao: ''
            })}
            className="flex items-center gap-2 px-4 py-2 text-xs font-black rounded-xl bg-primary text-white hover:bg-primary-hover shadow-md hover:shadow-lg transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>Novo Colaborador</span>
          </button>
        </div>
      </div>

      {/* 2. Banner de Autodetecção Inteligente de RCAs */}
      {rcasNaoCadastrados.length > 0 && (
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-transparent p-4 sm:p-5 rounded-2xl border border-blue-500/25 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-500 text-white rounded-xl shadow-xs mt-0.5 shrink-0">
              <Sparkles size={20} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-black text-text-primary flex items-center gap-2">
                <span>{rcasNaoCadastrados.length} Vendedores (RCAs) identificados nas entregas sem cadastro</span>
              </h3>
              <p className="text-xs text-text-secondary max-w-2xl leading-relaxed">
                Identificamos automaticamente vendedores com entregas ativas no sistema. Cadastre-os para poder preencher e-mail e WhatsApp e habilitar o envio automático de relatórios e alertas de ocorrências.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
            <button
              onClick={handleImportarTodosRcas}
              disabled={importandoLote}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 text-xs font-black rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {importandoLote ? (
                <span>Importando...</span>
              ) : (
                <>
                  <Plus size={15} />
                  <span>Cadastrar Todos ({rcasNaoCadastrados.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 3. Cards de KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-background-secondary p-4 rounded-xl border border-border-secondary shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
            <Users size={14} className="text-primary" />
            Total da Equipe
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-text-primary">{kpis.total}</span>
            <span className="text-xs text-emerald-500 font-bold">{kpis.ativos} ativos</span>
          </div>
        </div>

        <div className="bg-background-secondary p-4 rounded-xl border border-border-secondary shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
            <Briefcase size={14} className="text-blue-500" />
            Comercial / RCAs
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-500">{kpis.comerciais}</span>
            <span className="text-xs text-text-tertiary font-semibold">vendedores</span>
          </div>
        </div>

        <div className="bg-background-secondary p-4 rounded-xl border border-border-secondary shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
            <Building2 size={14} className="text-emerald-500" />
            Logística & Outros
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-500">{kpis.logistica}</span>
            <span className="text-xs text-text-tertiary font-semibold">operacionais</span>
          </div>
        </div>

        <div className="bg-background-secondary p-4 rounded-xl border border-border-secondary shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
            <Bell size={14} className="text-amber-500" />
            Com Contato Direto
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-500">{kpis.prontosParaAutomacao}</span>
            <span className="text-xs text-text-tertiary font-semibold">WhatsApp / E-mail</span>
          </div>
        </div>
      </div>

      {/* 4. Barra de Filtros e Busca */}
      <div className="bg-background-secondary p-4 rounded-2xl border border-border-secondary shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Campo de Busca */}
          <div className="relative flex-1 w-full">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder="Buscar colaborador por nome, e-mail, whatsapp, cargo..."
              value={buscaTexto}
              onChange={e => setBuscaTexto(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl bg-background-primary border border-border-secondary text-text-primary placeholder:text-text-tertiary focus:outline-hidden focus:border-primary transition-all"
            />
            {buscaTexto && (
              <button 
                onClick={() => setBuscaTexto('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filtros em linha */}
          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
            {/* Filtro Setor */}
            <select
              value={filtroSetor}
              onChange={e => setFiltroSetor(e.target.value)}
              className="flex-1 sm:flex-initial px-3 py-2.5 text-xs font-bold rounded-xl bg-background-primary border border-border-secondary text-text-primary focus:outline-hidden focus:border-primary cursor-pointer"
            >
              <option value="todos">Todos os Setores</option>
              {SETORES_RJ.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>

            {/* Filtro Status */}
            <select
              value={filtroStatus}
              onChange={e => setFiltroStatus(e.target.value)}
              className="flex-1 sm:flex-initial px-3 py-2.5 text-xs font-bold rounded-xl bg-background-primary border border-border-secondary text-text-primary focus:outline-hidden focus:border-primary cursor-pointer"
            >
              <option value="todos">Todos Status</option>
              <option value="Ativo">Ativos</option>
              <option value="Inativo">Inativos</option>
            </select>

            {/* Filtro Contato */}
            <select
              value={filtroContato}
              onChange={e => setFiltroContato(e.target.value)}
              className="flex-1 sm:flex-initial px-3 py-2.5 text-xs font-bold rounded-xl bg-background-primary border border-border-secondary text-text-primary focus:outline-hidden focus:border-primary cursor-pointer"
            >
              <option value="todos">Todos os Contatos</option>
              <option value="com_whats">Com WhatsApp</option>
              <option value="com_email">Com E-mail</option>
              <option value="incompletos">Cadastro Incompleto</option>
            </select>
          </div>
        </div>

        {/* Sugestões rápidas de RCAs pendentes */}
        {rcasNaoCadastrados.length > 0 && (
          <div className="pt-2 border-t border-border-tertiary/60 flex items-center gap-2 overflow-x-auto pb-1 text-xs text-text-secondary">
            <span className="font-bold shrink-0 flex items-center gap-1 text-blue-500">
              <Sparkles size={12} /> Sugestões de RCAs:
            </span>
            <div className="flex items-center gap-1.5 flex-nowrap">
              {rcasNaoCadastrados.slice(0, 5).map(rca => (
                <button
                  key={rca.chave}
                  onClick={() => handleCadastrarRcaIndividual(rca)}
                  className="px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-semibold text-[11px] flex items-center gap-1 shrink-0 border border-blue-500/20 transition-all cursor-pointer"
                  title={`Cadastrar ${rca.nome} (${rca.totalEntregas} entregas)`}
                >
                  <span>{rca.nome}</span>
                  <span className="text-[10px] opacity-70">({rca.totalEntregas})</span>
                  <Plus size={11} className="opacity-80" />
                </button>
              ))}
              {rcasNaoCadastrados.length > 5 && (
                <span className="text-[11px] text-text-tertiary font-medium">
                  +{rcasNaoCadastrados.length - 5} outros
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 5. Tabela de Funcionários (Desktop) & Cards (Mobile) */}
      <div className="bg-background-secondary rounded-2xl border border-border-secondary shadow-xs overflow-hidden">
        {funcionariosFiltrados.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-border-secondary flex items-center justify-center text-text-tertiary">
              <Users size={24} />
            </div>
            <h3 className="text-sm font-bold text-text-primary">Nenhum colaborador encontrado</h3>
            <p className="text-xs text-text-secondary max-w-sm mx-auto">
              {buscaTexto || filtroSetor !== 'todos' || filtroStatus !== 'todos' 
                ? 'Tente ajustar os filtros ou a busca textual.' 
                : 'Cadastre o primeiro colaborador ou importe os RCAs detectados automaticamente.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-background-tertiary/60 border-b border-border-secondary text-text-secondary font-black uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Colaborador</th>
                    <th className="py-3 px-4">Setor</th>
                    <th className="py-3 px-4">Cargo / Função</th>
                    <th className="py-3 px-4">WhatsApp</th>
                    <th className="py-3 px-4">E-mail</th>
                    <th className="py-3 px-4 text-center">Automações</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-tertiary/60">
                  {funcionariosFiltrados.map(f => {
                    const whatsNumeros = normalizarWhatsApp(f.whatsapp);
                    const linkWhats = whatsNumeros ? `https://wa.me/${whatsNumeros}` : null;

                    return (
                      <tr 
                        key={f.id}
                        className="hover:bg-background-primary/60 transition-colors group"
                      >
                        {/* Nome & Iniciais */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 font-black text-xs flex items-center justify-center shrink-0 border border-blue-500/20">
                              {(f.nome || 'F').slice(0, 2).toUpperCase()}
                            </div>
                            <div className="space-y-0.5 min-w-0">
                              <span className="font-bold text-text-primary text-xs sm:text-sm block truncate">
                                {f.nome}
                              </span>
                              {f.totalEntregasRca > 0 && (
                                <span className="text-[10px] text-text-tertiary font-medium">
                                  {f.totalEntregasRca} entregas vinculadas
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Setor */}
                        <td className="py-3.5 px-4">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border",
                            getCorSetor(f.setor)
                          )}>
                            {f.setor || 'Comercial'}
                          </span>
                        </td>

                        {/* Cargo */}
                        <td className="py-3.5 px-4 font-medium text-text-secondary">
                          {f.cargo || (f.setor === 'Comercial' ? 'RCA / Vendedor' : '-')}
                        </td>

                        {/* WhatsApp */}
                        <td className="py-3.5 px-4">
                          {f.whatsapp ? (
                            <div className="flex items-center gap-1.5">
                              <a
                                href={linkWhats}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
                                title="Abrir conversa no WhatsApp"
                              >
                                <MessageSquare size={13} className="shrink-0" />
                                <span>{f.whatsapp}</span>
                              </a>
                              <button
                                onClick={() => handleCopiar(f.whatsapp, `w_${f.id}`)}
                                className="p-1 text-text-tertiary hover:text-text-primary rounded-md transition-colors"
                                title="Copiar número"
                              >
                                {copiadoId === `w_${f.id}` ? (
                                  <Check size={12} className="text-emerald-500" />
                                ) : (
                                  <Copy size={12} />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-text-tertiary text-[11px] italic">Não informado</span>
                          )}
                        </td>

                        {/* E-mail */}
                        <td className="py-3.5 px-4">
                          {f.email ? (
                            <div className="flex items-center gap-1.5 max-w-[200px]">
                              <a
                                href={`mailto:${f.email}`}
                                className="inline-flex items-center gap-1 text-text-primary font-medium hover:text-primary truncate"
                                title={`Enviar e-mail para ${f.email}`}
                              >
                                <Mail size={13} className="shrink-0 text-text-tertiary" />
                                <span className="truncate">{f.email}</span>
                              </a>
                              <button
                                onClick={() => handleCopiar(f.email, `e_${f.id}`)}
                                className="p-1 text-text-tertiary hover:text-text-primary rounded-md transition-colors shrink-0"
                                title="Copiar e-mail"
                              >
                                {copiadoId === `e_${f.id}` ? (
                                  <Check size={12} className="text-emerald-500" />
                                ) : (
                                  <Copy size={12} />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-text-tertiary text-[11px] italic">Não informado</span>
                          )}
                        </td>

                        {/* Preferências de Automação */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex items-center gap-1.5 justify-center">
                            <span 
                              className={cn(
                                "px-2 py-0.5 rounded-md text-[10px] font-bold border",
                                f.receberRelatorios 
                                  ? "bg-blue-500/10 text-blue-500 border-blue-500/20" 
                                  : "bg-background-tertiary text-text-tertiary border-border-secondary opacity-50"
                              )}
                              title={f.receberRelatorios ? "Receberá relatórios diários de entregas" : "Não receberá relatórios diários"}
                            >
                              Relatórios
                            </span>
                            <span 
                              className={cn(
                                "px-2 py-0.5 rounded-md text-[10px] font-bold border",
                                f.receberOcorrencias 
                                  ? "bg-amber-500/10 text-amber-500 border-amber-500/20" 
                                  : "bg-background-tertiary text-text-tertiary border-border-secondary opacity-50"
                              )}
                              title={f.receberOcorrencias ? "Receberá alertas imediatos de devoluções e ocorrências" : "Não receberá alertas de devoluções"}
                            >
                              Alertas
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center">
                          <span className={cn(
                            "inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black border",
                            (f.status || 'Ativo') === 'Ativo'
                              ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                              : "bg-rose-500/15 text-rose-500 border-rose-500/30"
                          )}>
                            {f.status || 'Ativo'}
                          </span>
                        </td>

                        {/* Ações */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setModalFuncionario(f)}
                              className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-background-tertiary rounded-lg transition-colors cursor-pointer"
                              title="Editar colaborador"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              onClick={() => handleRemover(f)}
                              className="p-1.5 text-text-secondary hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                              title="Remover colaborador"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="block md:hidden divide-y divide-border-tertiary/60">
              {funcionariosFiltrados.map(f => {
                const whatsNumeros = normalizarWhatsApp(f.whatsapp);
                const linkWhats = whatsNumeros ? `https://wa.me/${whatsNumeros}` : null;

                return (
                  <div key={f.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 font-black text-xs flex items-center justify-center shrink-0 border border-blue-500/20">
                          {(f.nome || 'F').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-bold text-text-primary text-sm leading-tight">{f.nome}</h4>
                          <span className="text-[11px] text-text-tertiary">{f.cargo || 'Colaborador'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                          (f.status || 'Ativo') === 'Ativo'
                            ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                            : "bg-rose-500/15 text-rose-500 border-rose-500/30"
                        )}>
                          {f.status || 'Ativo'}
                        </span>
                        <button
                          onClick={() => setModalFuncionario(f)}
                          className="p-1 text-text-secondary hover:text-text-primary"
                        >
                          <Edit3 size={15} />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold border", getCorSetor(f.setor))}>
                        {f.setor || 'Comercial'}
                      </span>
                      {f.totalEntregasRca > 0 && (
                        <span className="text-[10px] text-text-tertiary">
                          {f.totalEntregasRca} entregas
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 text-xs">
                      {f.whatsapp && (
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                          <MessageSquare size={13} />
                          <a href={linkWhats} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            {f.whatsapp}
                          </a>
                        </div>
                      )}
                      {f.email && (
                        <div className="flex items-center gap-2 text-text-secondary font-medium">
                          <Mail size={13} />
                          <a href={`mailto:${f.email}`} className="truncate hover:underline">
                            {f.email}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 6. Modal de Cadastro / Edição */}
      {modalFuncionario && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-background-secondary w-full max-w-lg rounded-2xl border border-border-secondary shadow-xl overflow-hidden animate-scaleIn">
            <div className="flex items-center justify-between p-5 border-b border-border-secondary bg-background-tertiary/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
                  <UserCheck size={20} />
                </div>
                <div>
                  <h3 className="font-black text-text-primary text-base">
                    {modalFuncionario.id ? 'Editar Colaborador' : 'Novo Colaborador RJ'}
                  </h3>
                  <p className="text-xs text-text-secondary">
                    Preencha os dados e preferências de comunicação.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setModalFuncionario(null)}
                className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-background-tertiary rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSalvar} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Nome */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: João da Silva ou Nome do RCA"
                  value={modalFuncionario.nome || ''}
                  onChange={e => setModalFuncionario({ ...modalFuncionario, nome: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-background-primary border border-border-secondary text-text-primary focus:outline-hidden focus:border-primary transition-all font-medium"
                />
              </div>

              {/* Setor e Cargo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                    Setor *
                  </label>
                  <select
                    value={modalFuncionario.setor || 'Comercial'}
                    onChange={e => setModalFuncionario({ ...modalFuncionario, setor: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-background-primary border border-border-secondary text-text-primary focus:outline-hidden focus:border-primary cursor-pointer font-bold"
                  >
                    {SETORES_RJ.map(s => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                    Cargo / Função
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: RCA, Supervisor, Analista..."
                    value={modalFuncionario.cargo || ''}
                    onChange={e => setModalFuncionario({ ...modalFuncionario, cargo: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-background-primary border border-border-secondary text-text-primary focus:outline-hidden focus:border-primary transition-all font-medium"
                  />
                </div>
              </div>

              {/* WhatsApp e E-mail */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare size={13} className="text-emerald-500" />
                    WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="(71) 99999-9999"
                    value={modalFuncionario.whatsapp || ''}
                    onChange={e => setModalFuncionario({ ...modalFuncionario, whatsapp: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-background-primary border border-border-secondary text-text-primary focus:outline-hidden focus:border-primary transition-all font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                    <Mail size={13} className="text-blue-500" />
                    E-mail
                  </label>
                  <input
                    type="email"
                    placeholder="colaborador@rj.com.br"
                    value={modalFuncionario.email || ''}
                    onChange={e => setModalFuncionario({ ...modalFuncionario, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-background-primary border border-border-secondary text-text-primary focus:outline-hidden focus:border-primary transition-all font-medium"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                  Status
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-text-primary">
                    <input
                      type="radio"
                      name="status"
                      checked={(modalFuncionario.status || 'Ativo') === 'Ativo'}
                      onChange={() => setModalFuncionario({ ...modalFuncionario, status: 'Ativo' })}
                      className="text-primary focus:ring-primary"
                    />
                    <span>Ativo</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-text-primary">
                    <input
                      type="radio"
                      name="status"
                      checked={modalFuncionario.status === 'Inativo'}
                      onChange={() => setModalFuncionario({ ...modalFuncionario, status: 'Inativo' })}
                      className="text-primary focus:ring-primary"
                    />
                    <span>Inativo</span>
                  </label>
                </div>
              </div>

              {/* Automações Futuras */}
              <div className="p-3.5 rounded-xl bg-background-tertiary/50 border border-border-secondary space-y-2.5">
                <span className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
                  <Bell size={13} className="text-primary" />
                  Futuras Automações de Envio
                </span>

                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-text-secondary hover:text-text-primary transition-colors">
                  <input
                    type="checkbox"
                    checked={Boolean(modalFuncionario.receberRelatorios)}
                    onChange={e => setModalFuncionario({ ...modalFuncionario, receberRelatorios: e.target.checked })}
                    className="mt-0.5 rounded text-primary focus:ring-primary cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-text-primary block">Receber Relatório Diário de Entregas</span>
                    <span className="text-[11px] text-text-tertiary">Envia resumo das notas e faturamento das rotas.</span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-text-secondary hover:text-text-primary transition-colors">
                  <input
                    type="checkbox"
                    checked={Boolean(modalFuncionario.receberOcorrencias)}
                    onChange={e => setModalFuncionario({ ...modalFuncionario, receberOcorrencias: e.target.checked })}
                    className="mt-0.5 rounded text-primary focus:ring-primary cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-text-primary block">Receber Alertas de Devoluções / Ocorrências</span>
                    <span className="text-[11px] text-text-tertiary">Alerta em tempo real quando um cliente registrar devolução parcial/total.</span>
                  </div>
                </label>
              </div>

              {/* Observações */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                  Observações
                </label>
                <textarea
                  rows={2}
                  placeholder="Informações adicionais sobre o colaborador..."
                  value={modalFuncionario.observacao || ''}
                  onChange={e => setModalFuncionario({ ...modalFuncionario, observacao: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl bg-background-primary border border-border-secondary text-text-primary focus:outline-hidden focus:border-primary transition-all resize-none"
                />
              </div>

              {/* Botões do Rodapé */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-secondary">
                <button
                  type="button"
                  onClick={() => setModalFuncionario(null)}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-border-secondary text-text-secondary hover:text-text-primary hover:bg-background-tertiary transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-black rounded-xl bg-primary text-white hover:bg-primary-hover shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {salvando ? (
                    <span>Salvando...</span>
                  ) : (
                    <>
                      <Check size={15} />
                      <span>Salvar Colaborador</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AbaFuncionarios;
