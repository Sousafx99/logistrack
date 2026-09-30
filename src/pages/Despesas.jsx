import { useState, useMemo, useRef } from 'react';
import { 
  DollarSign, Search, Check, X, Package, Calendar, Filter, 
  ArrowUpDown, Copy, CheckCircle2, Clock, ShieldAlert, 
  Sparkles, SlidersHorizontal, ChevronDown, CheckCheck, Share2,
  CreditCard, Trash2
} from 'lucide-react';
import { format, subDays, startOfMonth } from 'date-fns';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { Badge } from '../components/ui/Badge';
import { ModalCardReembolso } from '../components/ui/ModalCardReembolso';
import { playMoedasSound } from '../components/ui/NotificationToast';

const TIPOS_PADRAO = [
  'Descarga',
  'Pedágio',
  'Balsa',
  'Ajudante extra',
  'Impressão',
  'Pernoite',
  'Outro'
];

const MESES_PT = [
  { valor: '01', nome: 'Janeiro' },
  { valor: '02', nome: 'Fevereiro' },
  { valor: '03', nome: 'Março' },
  { valor: '04', nome: 'Abril' },
  { valor: '05', nome: 'Maio' },
  { valor: '06', nome: 'Junho' },
  { valor: '07', nome: 'Julho' },
  { valor: '08', nome: 'Agosto' },
  { valor: '09', nome: 'Setembro' },
  { valor: '10', nome: 'Outubro' },
  { valor: '11', nome: 'Novembro' },
  { valor: '12', nome: 'Dezembro' },
];

// Helper robusto para extrair data no formato YYYY-MM-DD em fuso horário local
const extrairDataYMD = (val) => {
  if (!val) return '';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      const [d, m, y] = trimmed.split('/');
      return `${y}-${m}-${d}`;
    }
  }
  try {
    let dateObj;
    if (typeof val === 'object' && val !== null) {
      if (typeof val.toDate === 'function') dateObj = val.toDate();
      else if (val.seconds) dateObj = new Date(val.seconds * 1000);
      else dateObj = new Date(val);
    } else {
      dateObj = new Date(val);
    }
    if (isNaN(dateObj.getTime())) return '';
    return format(dateObj, 'yyyy-MM-dd');
  } catch {
    return '';
  }
};

// Formatação brasileira de data DD/MM/YYYY
const formatarDataBR = (ymdStr) => {
  if (!ymdStr) return '';
  const parts = ymdStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return ymdStr;
};

export function Despesas() {
  const { despesas = [], atualizarStatusDespesa, removerDespesa, limparTodasDespesas, motoristas = [], entregas = [] } = useStore();

  // Estados de Filtros
  const [filtroStatus, setFiltroStatus] = useState('Todos');
  const [filtroPlaca, setFiltroPlaca] = useState('Todos');
  const [filtroTipo, setFiltroTipo] = useState('Todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState('HOJE'); // 'TODAS' | 'HOJE' | 'QUINZENA_ATUAL' | 'QUINZENA' | 'CUSTOM'
  const [dataCustomizada, setDataCustomizada] = useState('');
  
  // Estados para filtro de Quinzena
  const [mesQuinzena, setMesQuinzena] = useState(() => format(new Date(), 'yyyy-MM'));
  const [quinzenaSelecionada, setQuinzenaSelecionada] = useState(() => {
    return new Date().getDate() <= 15 ? '1' : '2';
  });

  const [busca, setBusca] = useState('');
  const [ordenacao, setOrdenacao] = useState('pendentes_primeiro'); // 'pendentes_primeiro' | 'recentes' | 'maior_valor' | 'menor_valor' | 'placa'
  const [despesaParaCard, setDespesaParaCard] = useState(null);
  
  // Referência para o input de data
  const dateInputRef = useRef(null);

  // Abertura forçada do seletor de calendário nativo
  const abrirCalendario = () => {
    try {
      if (dateInputRef.current) {
        if (typeof dateInputRef.current.showPicker === 'function') {
          dateInputRef.current.showPicker();
        } else {
          dateInputRef.current.focus();
        }
      }
    } catch (err) {
      console.warn('showPicker não suportado, focando no input:', err);
    }
  };

  // Opções de Meses/Anos para o seletor de quinzena
  const opcoesMeses = useMemo(() => {
    const anoAtual = new Date().getFullYear();
    const lista = [];
    [anoAtual, anoAtual - 1].forEach(ano => {
      MESES_PT.forEach(m => {
        lista.push({
          id: `${ano}-${m.valor}`,
          label: `${m.nome} / ${ano}`,
          ano,
          mes: m.valor
        });
      });
    });
    return lista.sort((a, b) => b.id.localeCompare(a.id));
  }, []);

  // Estado para feedback de cópia de PIX
  const [pixCopiadoId, setPixCopiadoId] = useState(null);

  // Datas de referência
  const hojeStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const mesAtualStr = useMemo(() => format(new Date(), 'yyyy-MM'), []);
  const diaHojeNum = useMemo(() => new Date().getDate(), []);
  const isPrimeiraQuinzenaHoje = diaHojeNum <= 15;

  // 1. Cross-Filtering Inteligente: Calcular contadores e opções dinâmicas
  const { opcoesPlacas, opcoesTipos, opcoesStatus } = useMemo(() => {
    const list = despesas || [];
    
    // Contagem de placas
    const placasMap = new Map();
    // Contagem de tipos
    const tiposMap = new Map();

    TIPOS_PADRAO.forEach(t => tiposMap.set(t, { total: 0, pendentes: 0, valor: 0 }));

    list.forEach(d => {
      const p = (d.motorista_placa || 'Sem Placa').toUpperCase();
      const t = d.tipo || 'Outro';
      const val = Number(d.valor) || 0;
      const isPend = d.status === 'Pendente';

      // Atualiza mapa de placas
      if (!placasMap.has(p)) {
        placasMap.set(p, { total: 0, pendentes: 0, valor: 0 });
      }
      const pData = placasMap.get(p);
      pData.total += 1;
      if (isPend) pData.pendentes += 1;
      pData.valor += val;

      // Atualiza mapa de tipos
      if (!tiposMap.has(t)) {
        tiposMap.set(t, { total: 0, pendentes: 0, valor: 0 });
      }
      const tData = tiposMap.get(t);
      tData.total += 1;
      if (isPend) tData.pendentes += 1;
      tData.valor += val;
    });

    // Ordenação inteligente de placas: quem tem pendências primeiro, depois por total
    const placasArray = Array.from(placasMap.entries()).map(([placa, info]) => ({
      placa,
      ...info
    })).sort((a, b) => {
      if (b.pendentes !== a.pendentes) return b.pendentes - a.pendentes;
      return a.placa.localeCompare(b.placa);
    });

    // Ordenação inteligente de tipos
    const tiposArray = Array.from(tiposMap.entries()).map(([tipo, info]) => ({
      tipo,
      ...info
    })).sort((a, b) => {
      if (b.pendentes !== a.pendentes) return b.pendentes - a.pendentes;
      if (b.total !== a.total) return b.total - a.total;
      return a.tipo.localeCompare(b.tipo);
    });

    // Contagem de status
    const statusCounts = {
      Pendente: list.filter(d => d.status === 'Pendente').length,
      Autorizado: list.filter(d => d.status === 'Autorizado' || d.status === 'Aprovado').length,
      Pago: list.filter(d => d.status === 'Pago').length,
      Rejeitado: list.filter(d => d.status === 'Rejeitado').length,
      Todos: list.length
    };

    return {
      opcoesPlacas: placasArray,
      opcoesTipos: tiposArray,
      opcoesStatus: statusCounts
    };
  }, [despesas]);

  // 2. Preenchimento Automático (Sugestões de Busca)
  const sugestoesBusca = useMemo(() => {
    const set = new Set();
    (despesas || []).forEach(d => {
      if (d.motorista_placa) set.add(d.motorista_placa.toUpperCase());
      if (d.nome_recebedor) set.add(d.nome_recebedor);
      if (d.tipo) set.add(d.tipo);
      if (d.chave_pix) set.add(d.chave_pix);
      if (d.status) set.add(d.status);
      (d.notas_vinculadas || []).forEach(n => set.add(String(n)));
    });
    return Array.from(set).filter(Boolean).sort();
  }, [despesas]);

  // 3. Base Filtrada (Hierarquia Superior da Pesquisa sobre Data/Placa/Tipo)
  const baseFiltrada = useMemo(() => {
    const list = despesas || [];

    // Se o usuário digitou uma busca, ela tem hierarquia superior sobre todos os filtros de data, tipo e placa
    if (busca && busca.trim() !== '') {
      const termo = busca.toLowerCase().trim();
      return list.filter(d => {
        const placaStr = (d.motorista_placa || '').toLowerCase();
        const recebedorStr = (d.nome_recebedor || '').toLowerCase();
        const tipoStr = (d.tipo || '').toLowerCase();
        const statusStr = (d.status || '').toLowerCase();
        const pixStr = (d.chave_pix || '').toLowerCase();
        const obsStr = (d.observacao || '').toLowerCase();
        const obsMonStr = (d.observacaoMonitoramento || '').toLowerCase();
        const valorStr = String(d.valor || '');
        const valorFormatado = (Number(d.valor) || 0).toFixed(2).replace('.', ',');
        const notasStr = (d.notas_vinculadas || []).join(' ').toLowerCase();
        const dataYmd = extrairDataYMD(d.data_solicitacao || d.criadoEm || d.data);
        const dataBr = formatarDataBR(dataYmd);

        return (
          placaStr.includes(termo) ||
          recebedorStr.includes(termo) ||
          tipoStr.includes(termo) ||
          statusStr.includes(termo) ||
          pixStr.includes(termo) ||
          obsStr.includes(termo) ||
          obsMonStr.includes(termo) ||
          valorStr.includes(termo) ||
          valorFormatado.includes(termo) ||
          notasStr.includes(termo) ||
          dataYmd.includes(termo) ||
          dataBr.includes(termo)
        );
      });
    }

    // Se a busca estiver vazia, aplica os filtros de data, placa e tipo
    return list.filter(d => {
      // Filtro de Placa
      if (filtroPlaca !== 'Todos' && (d.motorista_placa || '').toUpperCase() !== filtroPlaca.toUpperCase()) return false;

      // Filtro de Tipo
      if (filtroTipo !== 'Todos' && d.tipo !== filtroTipo) return false;

      // Filtro de Período
      const dataItem = extrairDataYMD(d.data_solicitacao || d.criadoEm || d.data);
      if (filtroPeriodo === 'HOJE') {
        if (dataItem !== hojeStr) return false;
      } else if (filtroPeriodo === 'QUINZENA_ATUAL') {
        if (!dataItem) return false;
        const anoMesItem = dataItem.slice(0, 7);
        if (anoMesItem !== mesAtualStr) return false;
        const dia = parseInt(dataItem.slice(8, 10), 10);
        if (isPrimeiraQuinzenaHoje) {
          if (dia < 1 || dia > 15) return false;
        } else {
          if (dia < 16) return false;
        }
      } else if (filtroPeriodo === 'QUINZENA') {
        if (!dataItem) return false;
        const anoMesItem = dataItem.slice(0, 7); // 'YYYY-MM'
        if (anoMesItem !== mesQuinzena) return false;
        const dia = parseInt(dataItem.slice(8, 10), 10);
        if (quinzenaSelecionada === '1') {
          if (dia < 1 || dia > 15) return false;
        } else if (quinzenaSelecionada === '2') {
          if (dia < 16) return false;
        }
      } else if (filtroPeriodo === 'CUSTOM' && dataCustomizada) {
        if (dataItem !== dataCustomizada) return false;
      }

      return true;
    });
  }, [
    despesas, busca, filtroPlaca, filtroTipo, filtroPeriodo,
    dataCustomizada, mesQuinzena, quinzenaSelecionada, hojeStr,
    mesAtualStr, isPrimeiraQuinzenaHoje
  ]);

  // 4. Estatísticas calculadas dinamicamente sobre a data/período filtrado
  const stats = useMemo(() => {
    const totalVal = baseFiltrada.filter(d => d.status !== 'Rejeitado').reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
    const pendentesCount = baseFiltrada.filter(d => d.status === 'Pendente').length;
    const autorizadosCount = baseFiltrada.filter(d => d.status === 'Autorizado' || d.status === 'Aprovado').length;
    const pagosCount = baseFiltrada.filter(d => d.status === 'Pago').length;
    const rejeitadosCount = baseFiltrada.filter(d => d.status === 'Rejeitado').length;
    const totalCount = baseFiltrada.length;

    return { totalVal, pendentesCount, autorizadosCount, pagosCount, rejeitadosCount, totalCount };
  }, [baseFiltrada]);

  // 5. Lista final de despesas filtradas por Status e Ordenação
  const despesasFiltradas = useMemo(() => {
    let result = baseFiltrada;

    // Se o usuário selecionou um status específico (clique nos cards)
    if (filtroStatus !== 'Todos') {
      if (filtroStatus === 'Autorizado') {
        result = result.filter(d => d.status === 'Autorizado' || d.status === 'Aprovado');
      } else {
        result = result.filter(d => d.status === filtroStatus);
      }
    }

    return [...result].sort((a, b) => {
      if (ordenacao === 'pendentes_primeiro') {
        const getWeight = (st) => {
          if (st === 'Pendente') return 4;
          if (st === 'Autorizado' || st === 'Aprovado') return 3;
          if (st === 'Pago') return 2;
          if (st === 'Rejeitado') return 1;
          return 0;
        };
        const wA = getWeight(a.status);
        const wB = getWeight(b.status);
        if (wA !== wB) return wB - wA;
        return new Date(b.data_solicitacao || b.criadoEm || 0) - new Date(a.data_solicitacao || a.criadoEm || 0);
      }
      if (ordenacao === 'recentes') {
        return new Date(b.data_solicitacao || b.criadoEm || 0) - new Date(a.data_solicitacao || a.criadoEm || 0);
      }
      if (ordenacao === 'maior_valor') {
        return (Number(b.valor) || 0) - (Number(a.valor) || 0);
      }
      if (ordenacao === 'menor_valor') {
        return (Number(a.valor) || 0) - (Number(b.valor) || 0);
      }
      if (ordenacao === 'placa') {
        return (a.motorista_placa || '').localeCompare(b.motorista_placa || '');
      }
      return 0;
    });
  }, [baseFiltrada, filtroStatus, ordenacao]);

  // Ações de Autorizar / Pagar / Rejeitar / Limpar
  const handleAutorizar = (id) => {
    if (confirm('Confirmar autorização desta despesa? O pagamento via PIX será liberado.')) {
      atualizarStatusDespesa(id, 'Autorizado');
      try {
        playMoedasSound();
      } catch (e) {}
    }
  };

  const handleMarcarComoPago = (id) => {
    if (confirm('Confirmar que o pagamento/PIX desta despesa foi realizado?')) {
      atualizarStatusDespesa(id, 'Pago');
      try {
        playMoedasSound();
      } catch (e) {}
    }
  };

  const handlePagarDireto = (id) => {
    if (confirm('Confirmar pagamento direto desta despesa? O status será alterado para Pago (PIX realizado).')) {
      atualizarStatusDespesa(id, 'Pago');
      try {
        playMoedasSound();
      } catch (e) {}
    }
  };

  const handleRejeitar = (id) => {
    const motivo = prompt('Informe a justificativa da recusa (será enviada ao motorista):');
    if (motivo !== null) {
      atualizarStatusDespesa(id, 'Rejeitado', motivo);
    }
  };

  const handleLimparHistorico = async () => {
    if (confirm('ATENÇÃO: Deseja realmente excluir todos os lançamentos de custos do sistema? Esta ação é irreversível.')) {
      const confirmacao = prompt('Para confirmar a exclusão de todas as despesas, digite LIMPAR:');
      if (confirmacao === 'LIMPAR') {
        await limparTodasDespesas();
        alert('Histórico de despesas limpo com sucesso!');
      }
    }
  };

  // Copiar chave PIX para a área de transferência
  const handleCopiarPix = (id, chave) => {
    if (!chave) return;
    navigator.clipboard.writeText(chave);
    setPixCopiadoId(id);
    setTimeout(() => {
      setPixCopiadoId(null);
    }, 2000);
  };

  // Verificação de filtros ativos
  const temFiltroAtivo = 
    filtroStatus !== 'Todos' || 
    filtroPlaca !== 'Todos' || 
    filtroTipo !== 'Todos' || 
    filtroPeriodo !== 'TODAS' || 
    busca !== '';

  const limparTodosFiltros = () => {
    setFiltroStatus('Todos');
    setFiltroPlaca('Todos');
    setFiltroTipo('Todos');
    setFiltroPeriodo('TODAS');
    setDataCustomizada('');
    setBusca('');
  };

  return (
    <div className="space-y-4 w-full pb-20">
      {/* 1. Cards de Métricas Topo (Respeitam as informações da data filtrada) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total em Custos */}
        <button
          type="button"
          onClick={() => setFiltroStatus('Todos')}
          className={cn(
            "glass-panel p-3.5 rounded-xl border-b-4 text-left transition-all duration-200 cursor-pointer group relative overflow-hidden",
            filtroStatus === 'Todos' 
              ? "border-info ring-2 ring-info shadow-md bg-info/10 scale-[1.01]" 
              : "border-info/40 hover:bg-background-secondary/80 opacity-90 hover:opacity-100"
          )}
        >
          <div className="flex justify-between items-center">
            <p className="text-[10px] uppercase font-bold text-text-tertiary">
              {temFiltroAtivo ? "Total (Filtrado)" : "Total em Custos"}
            </p>
            <DollarSign size={15} className="text-info" />
          </div>
          <p className="text-xl font-black text-text-primary mt-1">R$ {stats.totalVal.toFixed(2)}</p>
          <p className="text-[10px] text-text-muted mt-0.5 truncate">
            {filtroStatus !== 'Todos' ? despesasFiltradas.length : stats.totalCount} de {despesas.length} desp.
          </p>
        </button>

        {/* Pendentes de Aprovação */}
        <button
          type="button"
          onClick={() => setFiltroStatus('Pendente')}
          className={cn(
            "glass-panel p-3.5 rounded-xl border-b-4 text-left transition-all duration-200 cursor-pointer group relative overflow-hidden",
            filtroStatus === 'Pendente' 
              ? "border-warning ring-2 ring-warning shadow-md bg-warning/10 scale-[1.01]" 
              : "border-warning/40 hover:bg-background-secondary/80 opacity-90 hover:opacity-100"
          )}
        >
          <div className="flex justify-between items-center">
            <p className="text-[10px] uppercase font-bold text-text-tertiary">Pendentes</p>
            <Clock size={15} className={cn("text-warning", stats.pendentesCount > 0 && "animate-spin")} />
          </div>
          <p className="text-xl font-black text-warning mt-1">{stats.pendentesCount}</p>
          <p className="text-[10px] text-text-muted mt-0.5">
            {stats.pendentesCount > 0 ? "Aguardando gestão" : "Nenhum pendente"}
          </p>
        </button>

        {/* Autorizados (Aguardando PIX) */}
        <button
          type="button"
          onClick={() => setFiltroStatus('Autorizado')}
          className={cn(
            "glass-panel p-3.5 rounded-xl border-b-4 text-left transition-all duration-200 cursor-pointer group relative overflow-hidden",
            filtroStatus === 'Autorizado' 
              ? "border-emerald-500 ring-2 ring-emerald-500 shadow-md bg-emerald-500/10 scale-[1.01]" 
              : "border-emerald-500/40 hover:bg-background-secondary/80 opacity-90 hover:opacity-100"
          )}
        >
          <div className="flex justify-between items-center">
            <p className="text-[10px] uppercase font-bold text-text-tertiary">Autorizados</p>
            <CheckCircle2 size={15} className="text-emerald-500" />
          </div>
          <p className="text-xl font-black text-emerald-500 mt-1">{stats.autorizadosCount}</p>
          <p className="text-[10px] text-text-muted mt-0.5">
            {stats.autorizadosCount > 0 ? "Aguardando PIX" : "Nenhum no período"}
          </p>
        </button>

        {/* Pagos (Pagamento Realizado) */}
        <button
          type="button"
          onClick={() => setFiltroStatus('Pago')}
          className={cn(
            "glass-panel p-3.5 rounded-xl border-b-4 text-left transition-all duration-200 cursor-pointer group relative overflow-hidden",
            filtroStatus === 'Pago' 
              ? "border-teal-400 ring-2 ring-teal-400 shadow-md bg-teal-500/15 scale-[1.01]" 
              : "border-teal-500/40 hover:bg-background-secondary/80 opacity-90 hover:opacity-100"
          )}
        >
          <div className="flex justify-between items-center">
            <p className="text-[10px] uppercase font-bold text-teal-400">Pagos</p>
            <CheckCheck size={15} className="text-teal-400" />
          </div>
          <p className="text-xl font-black text-teal-400 mt-1">{stats.pagosCount}</p>
          <p className="text-[10px] text-text-muted mt-0.5">
            {stats.pagosCount > 0 ? "PIX realizado" : "Nenhum pago"}
          </p>
        </button>

        {/* Rejeitados */}
        <button
          type="button"
          onClick={() => setFiltroStatus('Rejeitado')}
          className={cn(
            "glass-panel p-3.5 rounded-xl border-b-4 text-left transition-all duration-200 cursor-pointer group relative overflow-hidden",
            filtroStatus === 'Rejeitado' 
              ? "border-danger ring-2 ring-danger shadow-md bg-danger/10 scale-[1.01]" 
              : "border-danger/40 hover:bg-background-secondary/80 opacity-90 hover:opacity-100"
          )}
        >
          <div className="flex justify-between items-center">
            <p className="text-[10px] uppercase font-bold text-text-tertiary">Rejeitados</p>
            <ShieldAlert size={15} className="text-danger" />
          </div>
          <p className="text-xl font-black text-danger mt-1">{stats.rejeitadosCount}</p>
          <p className="text-[10px] text-text-muted mt-0.5">
            {stats.rejeitadosCount > 0 ? "Recusados" : "Nenhum no período"}
          </p>
        </button>
      </div>

      {/* 2. Painel Principal de Filtros e Seletores Inteligentes */}
      <div className="glass-panel p-4 rounded-xl border border-border-secondary space-y-3 shadow-sm">
        
        {/* Linha 1: Seletor Inteligente de Período (Hoje, Quinzena, Por Período, Todas as Datas, + Outra Data) + Placa e Tipo */}
        <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
          
          {/* Botões de Data */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5 flex-wrap sm:flex-nowrap">
            {[
              { id: 'HOJE', label: 'Hoje' },
              { id: 'QUINZENA_ATUAL', label: 'Quinzena' },
              { id: 'QUINZENA', label: 'Por Período' },
              { id: 'TODAS', label: 'Todas as Datas' }
            ].map(per => (
              <button
                key={per.id}
                type="button"
                onClick={() => {
                  setFiltroPeriodo(per.id);
                  setDataCustomizada('');
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border whitespace-nowrap cursor-pointer shrink-0 shadow-2xs",
                  filtroPeriodo === per.id
                    ? "bg-info text-white border-info shadow-xs"
                    : "bg-background-secondary text-text-secondary border-border-tertiary hover:bg-background-tertiary hover:text-text-primary"
                )}
              >
                {per.label}
              </button>
            ))}

            {/* Seletor de Data Customizada / Outra Data */}
            {filtroPeriodo === 'CUSTOM' && dataCustomizada ? (
              <div className="flex items-center gap-1 bg-info text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs shrink-0">
                <button
                  type="button"
                  onClick={abrirCalendario}
                  className="flex items-center gap-1.5 hover:opacity-90 cursor-pointer"
                  title="Clique para trocar a data"
                >
                  <Calendar size={13} />
                  <span>Data: {formatarDataBR(dataCustomizada)}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDataCustomizada('');
                    setFiltroPeriodo('HOJE');
                  }}
                  className="hover:bg-white/20 p-0.5 rounded cursor-pointer ml-1"
                  title="Remover data customizada"
                >
                  <X size={13} />
                </button>
                <input
                  ref={dateInputRef}
                  type="date"
                  value={dataCustomizada}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) {
                      setDataCustomizada(val);
                      setFiltroPeriodo('CUSTOM');
                    }
                  }}
                  className="absolute top-0 right-0 h-full w-64 sm:w-72 opacity-0 pointer-events-none cursor-pointer"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={abrirCalendario}
                className="relative flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all border whitespace-nowrap cursor-pointer shrink-0 gap-1.5 shadow-2xs bg-background-secondary text-text-secondary border-border-tertiary hover:bg-background-tertiary hover:text-text-primary"
                title="Filtrar por data específica no calendário"
              >
                <Calendar size={13} className="text-info" />
                <span>+ Outra Data</span>
                <input
                  ref={dateInputRef}
                  type="date"
                  value={dataCustomizada}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) {
                      setDataCustomizada(val);
                      setFiltroPeriodo('CUSTOM');
                    }
                  }}
                  className="absolute top-0 right-0 h-full w-64 sm:w-72 opacity-0 pointer-events-none cursor-pointer"
                />
              </button>
            )}
          </div>

          {/* Filtros de Placa e Tipo na mesma linha da Data */}
          <div className="flex items-center gap-2 grow xl:grow-0 xl:max-w-md">
            {/* Seletor Inteligente de Placa com Contadores */}
            <div className="w-1/2 min-w-[140px]">
              <select
                value={filtroPlaca}
                onChange={(e) => setFiltroPlaca(e.target.value)}
                className="w-full bg-background-primary border border-border-secondary rounded-lg px-2.5 py-1.5 text-xs font-semibold text-text-primary focus:ring-2 focus:ring-info outline-none cursor-pointer shadow-2xs"
              >
                <option value="Todos">Todas as Placas ({opcoesPlacas.length})</option>
                {opcoesPlacas.map(p => (
                  <option key={p.placa} value={p.placa}>
                    {p.placa} ({p.pendentes > 0 ? `⚠️ ${p.pendentes} pend. • ` : ''}{p.total} desp.)
                  </option>
                ))}
              </select>
            </div>

            {/* Seletor Inteligente de Tipo com Contadores */}
            <div className="w-1/2 min-w-[140px]">
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="w-full bg-background-primary border border-border-secondary rounded-lg px-2.5 py-1.5 text-xs font-semibold text-text-primary focus:ring-2 focus:ring-info outline-none cursor-pointer shadow-2xs"
              >
                <option value="Todos">Todos os Tipos</option>
                {opcoesTipos.map(t => (
                  <option key={t.tipo} value={t.tipo}>
                    {t.tipo} ({t.pendentes > 0 ? `⚠️ ${t.pendentes} pend. • ` : ''}{t.total})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Sub-painel Interativo de Quinzena e Mês (quando "Por Período" selecionado) */}
        {filtroPeriodo === 'QUINZENA' && (
          <div className="p-2.5 bg-info/10 border border-info/25 rounded-xl flex flex-wrap items-center gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-text-secondary uppercase">Mês / Ano:</span>
              <select
                value={mesQuinzena}
                onChange={(e) => setMesQuinzena(e.target.value)}
                className="bg-background-primary border border-border-secondary text-text-primary rounded-lg px-2.5 py-1 text-xs font-bold outline-none focus:ring-2 focus:ring-info shadow-2xs cursor-pointer"
              >
                {opcoesMeses.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-text-secondary uppercase">Quinzena:</span>
              {[
                { id: '1', label: '1ª Quinzena (01 a 15)' },
                { id: '2', label: '2ª Quinzena (16 ao fim)' },
                { id: 'TODAS', label: 'Mês Completo' }
              ].map(q => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setQuinzenaSelecionada(q.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-bold transition-all border whitespace-nowrap cursor-pointer shadow-2xs",
                    quinzenaSelecionada === q.id
                      ? "bg-info text-white border-info shadow-xs"
                      : "bg-background-primary text-text-secondary border-border-secondary hover:text-text-primary hover:bg-background-secondary"
                  )}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Linha 2: Busca com Autocomplete e Seletor de Ordenação na mesma linha */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2.5 border-t border-border-tertiary">
          
          {/* Busca Inteligente com Hierarquia Superior e Autocomplete */}
          <div className="relative flex-1 flex items-center bg-background-primary border border-border-secondary rounded-lg px-3 py-1.5 focus-within:border-info shadow-2xs">
            <Search size={15} className="text-text-tertiary mr-2 shrink-0" />
            <input 
              type="text" 
              list="sugestoes-busca-despesas"
              placeholder="Pesquisar em tudo: placa, recebedor, PIX, tipo, status, NF, valor..." 
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full text-xs bg-transparent border-none py-1 focus:ring-0 placeholder:text-text-tertiary/70 text-text-primary outline-none"
            />
            <datalist id="sugestoes-busca-despesas">
              {sugestoesBusca.map((sug, idx) => (
                <option key={idx} value={sug} />
              ))}
            </datalist>
            {busca && (
              <button 
                type="button" 
                onClick={() => setBusca('')} 
                className="text-text-tertiary hover:text-text-primary p-1 cursor-pointer"
                title="Limpar busca"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Ordenação na mesma linha */}
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-[11px] font-bold text-text-tertiary flex items-center gap-1 uppercase whitespace-nowrap">
              <ArrowUpDown size={12} className="text-info" /> Ordenar:
            </label>
            <select
              value={ordenacao}
              onChange={(e) => setOrdenacao(e.target.value)}
              className="bg-background-primary border border-border-secondary text-text-primary rounded-lg px-2.5 py-1.5 text-xs font-bold focus:ring-2 focus:ring-info outline-none cursor-pointer shadow-2xs"
            >
              <option value="pendentes_primeiro">Pendentes no Topo</option>
              <option value="recentes">Mais Recentes</option>
              <option value="maior_valor">Maior Valor (R$)</option>
              <option value="menor_valor">Menor Valor (R$)</option>
              <option value="placa">Placa (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Linha 3: Resumo e Tags de Filtros Ativos */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border-tertiary">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold uppercase text-text-tertiary flex items-center gap-1">
              <Filter size={11} className="text-info" /> Filtros:
            </span>

            {busca ? (
              <span className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded text-[11px] font-bold">
                🔍 Busca Global: "{busca}" (todas as datas/status)
                <button onClick={() => setBusca('')} className="hover:text-danger cursor-pointer ml-0.5"><X size={11} /></button>
              </span>
            ) : (
              <>
                {filtroPeriodo !== 'TODAS' && (
                  <span className="inline-flex items-center gap-1 bg-background-secondary border border-border-secondary text-text-primary px-2 py-0.5 rounded text-[11px] font-medium">
                    Data: <strong>
                      {filtroPeriodo === 'HOJE' ? 'Hoje' :
                       filtroPeriodo === 'QUINZENA_ATUAL' ? `Quinzena Atual (${isPrimeiraQuinzenaHoje ? '1ª Quinzena' : '2ª Quinzena'})` :
                       filtroPeriodo === 'QUINZENA' ? `${opcoesMeses.find(m => m.id === mesQuinzena)?.label || mesQuinzena} (${quinzenaSelecionada === '1' ? '1ª Quinzena' : quinzenaSelecionada === '2' ? '2ª Quinzena' : 'Mês Completo'})` :
                       filtroPeriodo === 'CUSTOM' ? (formatarDataBR(dataCustomizada) || 'Data Selecionada') :
                       filtroPeriodo}
                    </strong>
                    <button onClick={() => { setFiltroPeriodo('TODAS'); setDataCustomizada(''); }} className="hover:text-danger cursor-pointer ml-0.5"><X size={11} /></button>
                  </span>
                )}

                {filtroPlaca !== 'Todos' && (
                  <span className="inline-flex items-center gap-1 bg-background-secondary border border-border-secondary text-text-primary px-2 py-0.5 rounded text-[11px] font-medium">
                    Placa: <strong>{filtroPlaca}</strong>
                    <button onClick={() => setFiltroPlaca('Todos')} className="hover:text-danger cursor-pointer ml-0.5"><X size={11} /></button>
                  </span>
                )}

                {filtroTipo !== 'Todos' && (
                  <span className="inline-flex items-center gap-1 bg-background-secondary border border-border-secondary text-text-primary px-2 py-0.5 rounded text-[11px] font-medium">
                    Tipo: <strong>{filtroTipo}</strong>
                    <button onClick={() => setFiltroTipo('Todos')} className="hover:text-danger cursor-pointer ml-0.5"><X size={11} /></button>
                  </span>
                )}
              </>
            )}

            {filtroStatus !== 'Todos' && (
              <span className="inline-flex items-center gap-1 bg-background-secondary border border-border-secondary text-text-primary px-2 py-0.5 rounded text-[11px] font-medium">
                Status: <strong>{filtroStatus}</strong>
                <button onClick={() => setFiltroStatus('Todos')} className="hover:text-danger cursor-pointer ml-0.5"><X size={11} /></button>
              </span>
            )}

            {temFiltroAtivo && (
              <button
                onClick={limparTodosFiltros}
                className="text-[10px] font-bold text-danger hover:underline cursor-pointer ml-1"
              >
                Limpar Todos
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <div className="text-[11px] font-bold text-text-tertiary">
              Exibindo <span className="text-text-primary">{despesasFiltradas.length}</span> de <span className="text-text-primary">{despesas.length}</span> solicitação(ões)
            </div>
            {despesas.length > 0 && (
              <button
                type="button"
                onClick={handleLimparHistorico}
                className="text-[10px] font-bold text-text-tertiary hover:text-danger flex items-center gap-1 transition-colors cursor-pointer px-1.5 py-0.5 rounded border border-border-secondary hover:border-danger/30 bg-background-primary hover:bg-danger/10 shadow-2xs"
                title="Excluir todas as despesas de teste do banco de dados"
              >
                <Trash2 size={11} />
                <span>Limpar Histórico</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Grade de Solicitações / Despesas */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {despesasFiltradas.length === 0 ? (
          <div className="col-span-full text-center text-text-tertiary py-14 glass-panel rounded-xl border border-border-secondary space-y-2">
            <DollarSign className="mx-auto h-12 w-12 opacity-20" />
            <p className="text-sm font-bold text-text-primary">Nenhuma solicitação encontrada.</p>
            <p className="text-xs text-text-secondary max-w-sm mx-auto">
              Nenhuma despesa corresponde aos filtros selecionados. Tente ajustar o período ou limpar os filtros.
            </p>
            {temFiltroAtivo && (
              <button
                type="button"
                onClick={limparTodosFiltros}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-info hover:bg-info/90 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer"
              >
                <X size={14} /> Limpar Filtros
              </button>
            )}
          </div>
        ) : (
          despesasFiltradas.map(despesa => {
            const isPendente = despesa.status === 'Pendente';
            const isAutorizado = despesa.status === 'Autorizado' || despesa.status === 'Aprovado';
            const isPago = despesa.status === 'Pago';
            const isRejeitado = despesa.status === 'Rejeitado';

            return (
              <div 
                key={despesa.id} 
                className={cn(
                  "glass-panel p-4 rounded-xl border flex flex-col justify-between transition-all duration-200 shadow-sm",
                  isPendente 
                    ? "border-amber-500/40 bg-background-primary/95 ring-1 ring-amber-500/20" 
                    : isPago
                      ? "border-teal-500/40 bg-background-primary/90"
                      : isAutorizado
                        ? "border-emerald-500/40 bg-background-primary/90"
                        : "border-border-secondary bg-background-primary/80"
                )}
              >
                <div className="space-y-3">
                  {/* Topo do Card: Placa, Status, Data */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-black bg-background-secondary px-2 py-1 rounded text-text-primary border border-border-tertiary font-mono tracking-wider">
                        {despesa.motorista_placa || 'SEM PLACA'}
                      </span>
                      <span className="text-xs font-bold text-info truncate">
                        {despesa.tipo}
                      </span>
                    </div>

                    <Badge status={despesa.status}>{despesa.status}</Badge>
                  </div>

                  {/* Valor e Detalhes da Solicitação */}
                  <div className={cn(
                    "p-3 rounded-xl border space-y-2",
                    isPago 
                      ? "bg-teal-950/20 border-teal-500/30" 
                      : "bg-background-secondary/60 border-border-tertiary"
                  )}>
                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] text-text-tertiary font-bold uppercase">
                        {isPago ? 'Valor Pago (PIX):' : isAutorizado ? 'Valor Autorizado:' : 'Valor Solicitado:'}
                      </span>
                      <span className={cn(
                        "text-xl font-black font-mono",
                        isPago ? "text-teal-400" : "text-success"
                      )}>
                        R$ {Number(despesa.valor || 0).toFixed(2)}
                      </span>
                    </div>

                    <div className="border-t border-border-tertiary/60 pt-1.5 space-y-1 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-text-tertiary font-medium">Recebedor:</span>
                        <span className="text-text-primary font-bold truncate max-w-[170px]" title={despesa.nome_recebedor}>
                          {despesa.nome_recebedor || 'Não informado'}
                        </span>
                      </div>

                      {/* PIX com Botão de Copiar Rápido */}
                      <div className="flex justify-between items-center">
                        <span className="text-text-tertiary font-medium">Chave PIX:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-text-primary text-[11px] truncate max-w-[140px]" title={despesa.chave_pix}>
                            {despesa.chave_pix || 'Não informada'}
                          </span>
                          {despesa.chave_pix && (
                            <button
                              type="button"
                              onClick={() => handleCopiarPix(despesa.id, despesa.chave_pix)}
                              className={cn(
                                "p-1 rounded transition-colors cursor-pointer flex items-center gap-0.5 text-[10px] font-bold",
                                pixCopiadoId === despesa.id 
                                  ? "bg-emerald-500 text-white" 
                                  : "text-text-tertiary hover:text-text-primary hover:bg-background-tertiary"
                              )}
                              title="Copiar Chave PIX"
                            >
                              {pixCopiadoId === despesa.id ? (
                                <>
                                  <CheckCheck size={11} />
                                  <span>Copiado!</span>
                                </>
                              ) : (
                                <Copy size={11} />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Observação do Motorista */}
                  {despesa.observacao && (
                    <div className="text-xs text-text-secondary bg-background-primary/60 p-2.5 rounded-lg border border-border-tertiary">
                      <span className="text-[10px] uppercase font-bold text-text-tertiary block mb-0.5">Motivo / Detalhes:</span>
                      <p className="italic line-clamp-2">"{despesa.observacao}"</p>
                    </div>
                  )}

                  {/* Parecer do Monitoramento */}
                  {despesa.observacaoMonitoramento && (
                    <div className="text-xs text-text-secondary bg-background-primary/80 p-2.5 rounded-lg border border-border-tertiary">
                      <span className="text-[10px] uppercase font-bold text-text-tertiary block mb-0.5">Parecer do Monitoramento:</span>
                      <p className="italic text-text-primary font-medium">"{despesa.observacaoMonitoramento}"</p>
                    </div>
                  )}

                  {/* Notas Fiscais Vinculadas */}
                  {despesa.notas_vinculadas && despesa.notas_vinculadas.length > 0 && (
                    <div>
                      <span className="text-[10px] text-text-tertiary font-bold uppercase block mb-1">
                        Notas Vinculadas ({despesa.notas_vinculadas.length}):
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {despesa.notas_vinculadas.map(nota => (
                          <span 
                            key={nota} 
                            className="inline-flex items-center gap-1 bg-background-secondary text-text-secondary border border-border-tertiary px-1.5 py-0.5 rounded text-[10px] font-mono font-bold"
                          >
                            <Package size={10} /> {nota}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Rodapé: Data e Botões de Ação */}
                <div className="pt-3 mt-3 border-t border-border-tertiary flex items-center justify-between gap-2">
                  <span className="text-[10px] text-text-tertiary font-medium">
                    {new Date(despesa.data_solicitacao || despesa.criadoEm).toLocaleString('pt-BR')}
                  </span>

                  {isPendente ? (
                    <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                      <button
                        type="button"
                        onClick={() => handleAutorizar(despesa.id)}
                        className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-1.5 px-2.5 rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer"
                        title="Autorizar Despesa (Aguardando PIX)"
                      >
                        <Check size={13} />
                        <span>Autorizar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePagarDireto(despesa.id)}
                        className="flex items-center gap-1 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs py-1.5 px-2.5 rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer"
                        title="Marcar como Pago imediatamente via PIX"
                      >
                        <CheckCheck size={13} />
                        <span>Pagar Direto</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejeitar(despesa.id)}
                        className="flex items-center gap-1 bg-danger/10 hover:bg-danger text-danger hover:text-white font-bold text-xs py-1.5 px-2 rounded-lg transition-all active:scale-95 cursor-pointer"
                        title="Rejeitar Solicitação"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : isAutorizado ? (
                    <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                      <button
                        type="button"
                        onClick={() => handleMarcarComoPago(despesa.id)}
                        className="flex items-center gap-1 bg-teal-600 hover:bg-teal-500 text-white font-black text-xs py-1.5 px-2.5 rounded-lg shadow-md shadow-teal-600/20 transition-all active:scale-95 cursor-pointer animate-pulse"
                        title="Confirmar que o pagamento PIX foi realizado"
                      >
                        <CheckCheck size={14} />
                        <span>Marcar como Pago</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDespesaParaCard(despesa)}
                        className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500 hover:text-white text-xs font-bold transition-all cursor-pointer shadow-xs border border-emerald-500/30"
                        title="Compartilhar Card / WhatsApp"
                      >
                        <Share2 size={12} />
                        <span>Card</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejeitar(despesa.id)}
                        className="p-1.5 rounded-lg text-text-tertiary hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                        title="Recusar / Cancelar Autorização"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : isPago ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-black text-teal-400 bg-teal-500/15 px-2 py-0.5 rounded-md border border-teal-500/30">
                        <CheckCheck size={12} /> Pago via PIX
                      </span>
                      <button
                        type="button"
                        onClick={() => setDespesaParaCard(despesa)}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-teal-500/10 text-teal-400 hover:bg-teal-500 hover:text-white text-xs font-bold transition-all cursor-pointer shadow-xs border border-teal-500/30"
                        title="Compartilhar Card de Pagamento Concluído / WhatsApp"
                      >
                        <Share2 size={12} />
                        <span>Card</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-danger">
                        ✕ Recusado
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal de Compartilhamento do Card de Reembolso Aprovado */}
      <ModalCardReembolso
        isOpen={!!despesaParaCard}
        onClose={() => setDespesaParaCard(null)}
        despesa={despesaParaCard}
        entregas={entregas}
      />
    </div>
  );
}
