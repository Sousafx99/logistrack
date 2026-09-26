import { useState, useMemo, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { 
  Plus, RotateCcw, Search, Trash2, Edit2, Filter, Clock, User, 
  Printer, Mail, ChevronDown, ChevronUp, Hash, MapPin, 
  Calendar, Truck, AlertCircle, Check, X, Package, CheckCircle2 
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { Badge } from '../components/ui/Badge';
import { MOTIVOS_DEVOLUCAO, STATUS_DEVOLUCAO_GERAL, STATUS_DEVOLUCAO_MONITORAMENTO, TRATAMENTO_MERCADORIA } from '../data/mockData';
import { cn } from '../lib/utils';

// Componente MultiSelect Customizado para Filtros
function MultiSelectDropdown({ options, selected, onChange, placeholder, label, icon: Icon }) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) setFilterSearch('');
  }, [isOpen]);

  const displayedOptions = useMemo(() => {
    if (!filterSearch.trim()) return options;
    const term = filterSearch.toLowerCase().trim();
    return options.filter(opt => opt.toLowerCase().includes(term));
  }, [options, filterSearch]);

  const toggleOption = (opt) => {
    if (selected.includes(opt)) {
      onChange(selected.filter(i => i !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  const toggleSelectAll = () => {
    if (selected.length === options.length) {
      onChange([]);
    } else {
      onChange([...options]);
    }
  };

  const clearAll = (e) => {
    e.stopPropagation();
    onChange([]);
  };

  const isAllSelected = options.length > 0 && selected.length === options.length;
  const hasSelection = selected.length > 0;

  return (
    <div className={cn("static md:relative flex-1 min-w-0", isOpen ? "z-50" : "z-auto")} ref={containerRef}>
      {/* Visualização Desktop (com Label e Seletor Completo) */}
      <div className="hidden md:block">
        <label className="block text-xs font-bold text-text-secondary mb-1 flex items-center gap-1.5">
          {Icon && <Icon size={13} className="text-text-tertiary" />}
          {label}
        </label>
        <div 
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-full bg-background-secondary border rounded-xl px-3 py-2.5 text-sm font-medium flex justify-between items-center cursor-pointer transition-colors",
            isOpen ? "border-info ring-2 ring-info/30 bg-info/5" : hasSelection ? "border-info/60 bg-info/5" : "border-border-secondary hover:border-info/50"
          )}
        >
          <span className={!hasSelection ? "text-text-tertiary" : "text-text-primary font-bold truncate max-w-[80%]"}>
            {!hasSelection ? placeholder : (isAllSelected ? 'Todos' : `${selected.length} selecionado(s)`)}
          </span>
          <div className="flex items-center gap-1">
            {hasSelection && (
              <div onClick={clearAll} className="p-1 hover:bg-background-tertiary rounded-full text-text-tertiary hover:text-danger transition-colors">
                <X size={14} />
              </div>
            )}
            <ChevronDown size={16} className={`text-text-tertiary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </div>

      {/* Visualização Mobile (Botão Ícone Compacto em 1 Linha com Demarcador Ativo) */}
      <div className="block md:hidden">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-full h-11 rounded-xl flex items-center justify-center relative transition-all border shadow-sm",
            isOpen 
              ? "bg-info text-white border-info ring-2 ring-info/50 shadow-md scale-105 z-20" 
              : hasSelection 
                ? "bg-info/15 border-info text-info font-bold" 
                : "bg-background-secondary border-border-secondary text-text-secondary hover:border-info/50"
          )}
          title={label}
        >
          {Icon ? <Icon size={18} /> : <Filter size={18} />}
          {hasSelection && (
            <span className={cn(
              "absolute -top-1.5 -right-1.5 text-[9px] min-w-4 h-4 px-1 rounded-full flex items-center justify-center font-black shadow",
              isOpen ? "bg-white text-info" : "bg-info text-white"
            )}>
              {selected.length}
            </span>
          )}
          {isOpen && (
            <div className="md:hidden absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-background-primary border-t border-l border-border-secondary rotate-45 z-50 pointer-events-none" />
          )}
        </button>
      </div>

      {/* Menu Dropdown de Opções */}
      {isOpen && (
        <div className="absolute z-50 top-full mt-2.5 left-0 right-0 md:right-auto md:w-full min-w-[220px] w-full max-h-[480px] bg-background-primary border border-border-secondary rounded-2xl shadow-2xl p-3 animate-in fade-in slide-in-from-top-2 flex flex-col">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-border-secondary">
            <div className="flex items-center gap-2 text-xs font-bold text-text-primary">
              {Icon && <Icon size={15} className="text-info" />}
              <span>{label}</span>
              {hasSelection && (
                <span className="text-[10px] text-info bg-info/10 px-1.5 py-0.5 rounded font-bold">
                  {selected.length} selecionado(s)
                </span>
              )}
            </div>
            {hasSelection && (
              <button 
                onClick={clearAll}
                className="text-[11px] text-text-tertiary hover:text-danger font-semibold transition-colors"
              >
                Limpar Todos
              </button>
            )}
          </div>

          {options.length > 5 && (
            <div className="mb-2 relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input
                type="text"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder={`Buscar em ${label.toLowerCase()}...`}
                className="w-full bg-background-secondary border border-border-secondary rounded-lg pl-8 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-info"
              />
            </div>
          )}

          <div className="max-h-[350px] overflow-y-auto space-y-1 pr-1">
            {options.length === 0 ? (
              <div className="p-4 text-xs text-text-tertiary text-center">Nenhuma opção disponível</div>
            ) : displayedOptions.length === 0 ? (
              <div className="p-4 text-xs text-text-tertiary text-center">Nenhum resultado para a busca</div>
            ) : (
              <>
                <label className="flex items-center gap-3 p-2 hover:bg-background-secondary rounded-xl cursor-pointer transition-colors group border-b border-border-secondary mb-1 pb-2">
                  <input 
                    type="checkbox" 
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    className="hidden" 
                  />
                  <div className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0",
                    isAllSelected ? "bg-info border-info text-white" : "border-border-tertiary group-hover:border-info/50"
                  )}>
                    {isAllSelected && <Check size={12} strokeWidth={3} />}
                  </div>
                  <span className="text-xs font-bold text-text-primary">Selecionar Tudo ({options.length})</span>
                </label>
                
                {displayedOptions.map(opt => (
                  <label key={opt} className="flex items-center gap-2.5 p-2 hover:bg-background-secondary rounded-xl cursor-pointer transition-colors group">
                    <input 
                      type="checkbox" 
                      checked={selected.includes(opt)}
                      onChange={() => toggleOption(opt)}
                      className="hidden" 
                    />
                    <div className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0",
                      selected.includes(opt) ? "bg-info border-info text-white" : "border-border-tertiary group-hover:border-info/50"
                    )}>
                      {selected.includes(opt) && <Check size={12} strokeWidth={3} />}
                    </div>
                    <span className="text-xs font-medium text-text-secondary group-hover:text-text-primary truncate" title={opt}>{opt}</span>
                  </label>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function Devolucoes() {
  const { devolucoes, entregas, adicionarDevolucao, atualizarStatusDevolucao, removerDevolucao, editarDevolucao, currentUser, globalFilters, setGlobalFilters } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [editandoDevolucao, setEditandoDevolucao] = useState(null);
  
  // Novos modais
  const [alterandoStatus, setAlterandoStatus] = useState(null);
  const [verHistorico, setVerHistorico] = useState(null);
  const [novaObservacaoStatus, setNovaObservacaoStatus] = useState('');
  const [novoStatusSelecionado, setNovoStatusSelecionado] = useState('');
  const [novoTratamentoSelecionado, setNovoTratamentoSelecionado] = useState('');
  const [clientesExpandidos, setClientesExpandidos] = useState({});
  const [alterandoStatusGrupo, setAlterandoStatusGrupo] = useState(null);
  const [editandoMotivoGrupo, setEditandoMotivoGrupo] = useState(null);

  const toggleCliente = (id) => setClientesExpandidos(prev => ({...prev, [id]: !prev[id]}));

  // Extrair filtros do estado global de devoluções (compatível com arrays e dados legados)
  const devFilters = globalFilters?.devolucoes || {};
  const datasSelecionadas = Array.isArray(devFilters.datas) ? devFilters.datas : (devFilters.data ? [devFilters.data] : []);
  const notasSelecionadas = Array.isArray(devFilters.notas) ? devFilters.notas : [];
  const placasSelecionadas = Array.isArray(devFilters.placas) ? devFilters.placas : (devFilters.placa ? [devFilters.placa] : []);
  const tiposSelecionados = Array.isArray(devFilters.tipos) ? devFilters.tipos : (devFilters.tipo ? [devFilters.tipo] : []);
  const statusSelecionados = Array.isArray(devFilters.status) ? devFilters.status : (typeof devFilters.status === 'string' && devFilters.status ? [devFilters.status] : []);
  const rcasSelecionados = Array.isArray(devFilters.rcas) ? devFilters.rcas : [];
  const busca = devFilters.busca || '';

  const setDatas = (val) => setGlobalFilters({ devolucoes: { ...devFilters, datas: val } });
  const setNotas = (val) => setGlobalFilters({ devolucoes: { ...devFilters, notas: val } });
  const setPlacas = (val) => setGlobalFilters({ devolucoes: { ...devFilters, placas: val } });
  const setTipos = (val) => setGlobalFilters({ devolucoes: { ...devFilters, tipos: val } });
  const setStatus = (val) => setGlobalFilters({ devolucoes: { ...devFilters, status: val } });
  const setRcas = (val) => setGlobalFilters({ devolucoes: { ...devFilters, rcas: val } });
  const setBusca = (val) => setGlobalFilters({ devolucoes: { ...devFilters, busca: val } });

  // Form State do Modal Lançar Devolução
  const [novaDevolucao, setNovaDevolucao] = useState({
    nota: '',
    tipo: 'Total',
    quantidadeKg: '',
    status: 'Pendente de recebimento',
    tratamento: 'Aguardando definição',
    observacao: '',
    placa: ''
  });

  // Autocomplete de NF
  const [nfBusca, setNfBusca] = useState('');
  const [nfSugestoesAbertas, setNfSugestoesAbertas] = useState(false);
  const [entregaSelecionada, setEntregaSelecionada] = useState(null);
  const nfContainerRef = useRef(null);

  // Autocomplete de Produto
  const [produtoBusca, setProdutoBusca] = useState('');
  const [produtoSugestoesAbertas, setProdutoSugestoesAbertas] = useState(false);
  const [itemTemp, setItemTemp] = useState({ codigo: '', descricao: '', qtd: '1', peso: '' });
  const [itensDevolucao, setItensDevolucao] = useState([]);
  const prodContainerRef = useRef(null);

  // Fechar dropdowns de autocomplete ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (nfContainerRef.current && !nfContainerRef.current.contains(e.target)) {
        setNfSugestoesAbertas(false);
      }
      if (prodContainerRef.current && !prodContainerRef.current.contains(e.target)) {
        setProdutoSugestoesAbertas(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Enriquecer devoluções cruzando com dados da entrega
  const devolucoesEnriquecidas = useMemo(() => {
    return devolucoes.map(dev => {
      const entrega = entregas.find(e => String(e.nota) === String(dev.nota));
      const dataStr = dev.data ? (dev.data.length >= 10 ? dev.data.slice(0, 10) : dev.data) : (entrega?.data ? (entrega.data.length >= 10 ? entrega.data.slice(0, 10) : entrega.data) : '');
      const placaStr = dev.placa || entrega?.placa || 'SEM PLACA';
      const rcaStr = entrega?.rca || 'SEM RCA';
      const notaStr = String(dev.nota || '').trim();
      const tipoStr = dev.tipo || 'Total';
      const statusStr = dev.status || 'Pendente de recebimento';
      const clienteStr = entrega?.cliente || 'CLIENTE DESCONHECIDO';
      const codClienteStr = entrega?.codCliente || '';
      const bairroStr = entrega?.bairro || '';

      return {
        ...dev,
        entrega,
        dataFormatada: dataStr,
        placaCalculada: placaStr,
        rcaCalculado: rcaStr,
        notaCalculada: notaStr,
        tipoCalculado: tipoStr,
        statusCalculado: statusStr,
        clienteCalculado: clienteStr,
        codClienteCalculado: codClienteStr,
        bairroCalculado: bairroStr
      };
    });
  }, [devolucoes, entregas]);

  // Funções de correspondência individual
  const matchData = (d, sel = datasSelecionadas) => sel.length === 0 || sel.includes(d.dataFormatada);
  const matchNota = (d, sel = notasSelecionadas) => sel.length === 0 || sel.includes(d.notaCalculada);
  const matchPlaca = (d, sel = placasSelecionadas) => sel.length === 0 || sel.includes(d.placaCalculada);
  const matchTipo = (d, sel = tiposSelecionados) => sel.length === 0 || sel.includes(d.tipoCalculado);
  const matchStatus = (d, sel = statusSelecionados) => sel.length === 0 || sel.includes(d.statusCalculado);
  const matchRca = (d, sel = rcasSelecionados) => sel.length === 0 || sel.includes(d.rcaCalculado);
  const matchBusca = (d, term = busca.toLowerCase().trim()) => {
    if (!term) return true;
    return d.notaCalculada.toLowerCase().includes(term) ||
           d.placaCalculada.toLowerCase().includes(term) ||
           d.clienteCalculado.toLowerCase().includes(term) ||
           d.codClienteCalculado.toLowerCase().includes(term) ||
           d.rcaCalculado.toLowerCase().includes(term) ||
           (d.observacao && d.observacao.toLowerCase().includes(term));
  };

  // Opções dinâmicas inteligentes (Faceted Filtering)
  const opcoesFiltro = useMemo(() => {
    // 1. Datas disponíveis considerando os outros 5 filtros
    const devsDatas = devolucoesEnriquecidas.filter(d =>
      matchNota(d) && matchPlaca(d) && matchTipo(d) && matchStatus(d) && matchRca(d) && matchBusca(d)
    );
    const datasSet = new Set(devsDatas.map(d => d.dataFormatada).filter(Boolean));

    // 2. Notas disponíveis considerando os outros 5 filtros
    const devsNotas = devolucoesEnriquecidas.filter(d =>
      matchData(d) && matchPlaca(d) && matchTipo(d) && matchStatus(d) && matchRca(d) && matchBusca(d)
    );
    const notasSet = new Set(devsNotas.map(d => d.notaCalculada).filter(Boolean));

    // 3. Placas disponíveis considerando os outros 5 filtros
    const devsPlacas = devolucoesEnriquecidas.filter(d =>
      matchData(d) && matchNota(d) && matchTipo(d) && matchStatus(d) && matchRca(d) && matchBusca(d)
    );
    const placasSet = new Set(devsPlacas.map(d => d.placaCalculada).filter(Boolean));

    // 4. Tipos disponíveis considerando os outros 5 filtros
    const devsTipos = devolucoesEnriquecidas.filter(d =>
      matchData(d) && matchNota(d) && matchPlaca(d) && matchStatus(d) && matchRca(d) && matchBusca(d)
    );
    const tiposSet = new Set(devsTipos.map(d => d.tipoCalculado).filter(Boolean));

    // 5. Status disponíveis considerando os outros 5 filtros
    const devsStatus = devolucoesEnriquecidas.filter(d =>
      matchData(d) && matchNota(d) && matchPlaca(d) && matchTipo(d) && matchRca(d) && matchBusca(d)
    );
    const statusSet = new Set(devsStatus.map(d => d.statusCalculado).filter(Boolean));

    // 6. RCAs disponíveis considerando os outros 5 filtros
    const devsRcas = devolucoesEnriquecidas.filter(d =>
      matchData(d) && matchNota(d) && matchPlaca(d) && matchTipo(d) && matchStatus(d) && matchBusca(d)
    );
    const rcasSet = new Set(devsRcas.map(d => d.rcaCalculado).filter(Boolean));

    return {
      datas: Array.from(datasSet).sort().reverse(),
      notas: Array.from(notasSet).sort((a, b) => (Number(a) || 0) - (Number(b) || 0)),
      placas: Array.from(placasSet).sort(),
      tipos: Array.from(tiposSet).sort(),
      status: Array.from(statusSet).sort(),
      rcas: Array.from(rcasSet).sort()
    };
  }, [devolucoesEnriquecidas, datasSelecionadas, notasSelecionadas, placasSelecionadas, tiposSelecionados, statusSelecionados, rcasSelecionados, busca]);

  // Limpeza automática de seleções inválidas
  useEffect(() => {
    if (devolucoesEnriquecidas.length === 0) return;

    if (datasSelecionadas.length > 0) {
      const valid = datasSelecionadas.filter(d => opcoesFiltro.datas.includes(d));
      if (valid.length !== datasSelecionadas.length) setDatas(valid);
    }
    if (notasSelecionadas.length > 0) {
      const valid = notasSelecionadas.filter(n => opcoesFiltro.notas.includes(n));
      if (valid.length !== notasSelecionadas.length) setNotas(valid);
    }
    if (placasSelecionadas.length > 0) {
      const valid = placasSelecionadas.filter(p => opcoesFiltro.placas.includes(p));
      if (valid.length !== placasSelecionadas.length) setPlacas(valid);
    }
    if (tiposSelecionados.length > 0) {
      const valid = tiposSelecionados.filter(t => opcoesFiltro.tipos.includes(t));
      if (valid.length !== tiposSelecionados.length) setTipos(valid);
    }
    if (statusSelecionados.length > 0) {
      const valid = statusSelecionados.filter(s => opcoesFiltro.status.includes(s));
      if (valid.length !== statusSelecionados.length) setStatus(valid);
    }
    if (rcasSelecionados.length > 0) {
      const valid = rcasSelecionados.filter(r => opcoesFiltro.rcas.includes(r));
      if (valid.length !== rcasSelecionados.length) setRcas(valid);
    }
  }, [opcoesFiltro, devolucoesEnriquecidas.length]);

  // Lista de devoluções filtradas
  const devolucoesFiltradas = useMemo(() => {
    return devolucoesEnriquecidas.filter(d => 
      matchData(d) && matchNota(d) && matchPlaca(d) && matchTipo(d) && matchStatus(d) && matchRca(d) && matchBusca(d)
    );
  }, [devolucoesEnriquecidas, datasSelecionadas, notasSelecionadas, placasSelecionadas, tiposSelecionados, statusSelecionados, rcasSelecionados, busca]);

  // Agrupamento por cliente
  const clientesAgrupados = useMemo(() => {
    const map = new Map();
    devolucoesFiltradas.forEach(dev => {
      const cliente = dev.clienteCalculado;
      const codCliente = dev.codClienteCalculado;
      const bairro = dev.bairroCalculado;
      const placa = dev.placaCalculada;
      
      const key = `${placa}-${codCliente}-${cliente}`;
      
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          cliente,
          codCliente,
          bairro,
          placa,
          devolucoes: []
        });
      }
      map.get(key).devolucoes.push(dev);
    });

    const result = Array.from(map.values());
    
    result.forEach(grupo => {
      grupo.devolucoes.sort((a, b) => (Number(a.nota) || 0) - (Number(b.nota) || 0));
    });

    return result.sort((a, b) => {
      const minA = a.devolucoes[0] ? (Number(a.devolucoes[0].nota) || 0) : 0;
      const minB = b.devolucoes[0] ? (Number(b.devolucoes[0].nota) || 0) : 0;
      return minA - minB;
    });
  }, [devolucoesFiltradas]);

  // Sugestões dinâmicas de Notas Fiscais para Autocomplete
  const sugestoesNfs = useMemo(() => {
    if (!nfBusca || !nfBusca.trim()) return [];
    const term = nfBusca.toLowerCase().trim();
    const map = new Map();
    entregas.forEach(e => {
      if (!map.has(String(e.nota))) {
        const notaStr = String(e.nota || '').toLowerCase();
        const clienteStr = String(e.cliente || '').toLowerCase();
        const codStr = String(e.codCliente || '').toLowerCase();
        const placaStr = String(e.placa || '').toLowerCase();
        const rcaStr = String(e.rca || '').toLowerCase();
        if (notaStr.includes(term) || clienteStr.includes(term) || codStr.includes(term) || placaStr.includes(term) || rcaStr.includes(term)) {
          map.set(String(e.nota), e);
        }
      }
    });
    return Array.from(map.values()).slice(0, 8);
  }, [entregas, nfBusca]);

  // Catálogo completo de produtos conhecidos no sistema
  const catalogoProdutos = useMemo(() => {
    const map = new Map();
    // 1. Itens da entrega selecionada (se houver)
    if (entregaSelecionada?.itens && Array.isArray(entregaSelecionada.itens)) {
      entregaSelecionada.itens.forEach(it => {
        const key = `${it.codigo || ''}-${it.descricao || ''}`;
        if (key.trim()) {
          map.set(key, { ...it, daEntrega: true });
        }
      });
    }
    // 2. Itens de todas as entregas
    entregas.forEach(e => {
      if (e.itens && Array.isArray(e.itens)) {
        e.itens.forEach(it => {
          const key = `${it.codigo || ''}-${it.descricao || ''}`;
          if (key.trim() && !map.has(key)) {
            map.set(key, { ...it, daEntrega: false });
          }
        });
      }
    });
    return Array.from(map.values());
  }, [entregas, entregaSelecionada]);

  // Sugestões dinâmicas de Produtos para Autocomplete
  const sugestoesProdutos = useMemo(() => {
    if (!produtoBusca || !produtoBusca.trim()) {
      if (entregaSelecionada?.itens && entregaSelecionada.itens.length > 0) {
        return entregaSelecionada.itens.map(it => ({ ...it, daEntrega: true })).slice(0, 10);
      }
      return catalogoProdutos.slice(0, 6);
    }
    const term = produtoBusca.toLowerCase().trim();
    return catalogoProdutos.filter(p => 
      (p.codigo && String(p.codigo).toLowerCase().includes(term)) ||
      (p.descricao && p.descricao.toLowerCase().includes(term))
    ).slice(0, 8);
  }, [catalogoProdutos, produtoBusca, entregaSelecionada]);

  const handleSelecionarNf = (e) => {
    const notaStr = String(e.nota);
    setNfBusca(notaStr);
    setNovaDevolucao(prev => ({
      ...prev,
      nota: notaStr,
      placa: e.placa || prev.placa || '',
      quantidadeKg: prev.quantidadeKg || (e.peso ? String(e.peso) : '')
    }));
    setEntregaSelecionada(e);
    setNfSugestoesAbertas(false);

    // Se tipo for 'Total' e a entrega tiver itens, já carrega os itens
    if (novaDevolucao.tipo === 'Total' && e.itens && e.itens.length > 0) {
      setItensDevolucao(e.itens.map(i => ({
        codigo: i.codigo || '',
        descricao: i.descricao || '',
        qtd: i.qtd || 1,
        peso: i.peso || 0
      })));
      setNovaDevolucao(prev => ({
        ...prev,
        quantidadeKg: String(e.peso || '')
      }));
    }
  };

  const handleSelecionarProduto = (prod) => {
    setProdutoBusca(prod.descricao ? `${prod.codigo ? `[${prod.codigo}] ` : ''}${prod.descricao}` : String(prod.codigo || ''));
    setItemTemp({
      codigo: String(prod.codigo || ''),
      descricao: String(prod.descricao || ''),
      qtd: String(prod.qtd || 1),
      peso: String(prod.peso || '')
    });
    setProdutoSugestoesAbertas(false);
  };

  const handleAdicionarItemNaDevolucao = () => {
    if (!itemTemp.descricao && !itemTemp.codigo && !produtoBusca) return;
    
    const novoItem = {
      codigo: itemTemp.codigo || '',
      descricao: itemTemp.descricao || produtoBusca || 'Produto sem descrição',
      qtd: parseFloat(itemTemp.qtd) || 1,
      peso: parseFloat(itemTemp.peso) || 0
    };

    const novosItens = [...itensDevolucao, novoItem];
    setItensDevolucao(novosItens);
    
    // Recalcula peso total se houver peso nos itens
    const pesoSomado = novosItens.reduce((acc, curr) => acc + (Number(curr.peso) || 0), 0);
    if (pesoSomado > 0) {
      setNovaDevolucao(prev => ({ ...prev, quantidadeKg: pesoSomado.toFixed(3) }));
    }

    // Limpa campos temporários do produto
    setProdutoBusca('');
    setItemTemp({ codigo: '', descricao: '', qtd: '1', peso: '' });
  };

  const handleRemoverItemDaDevolucao = (idx) => {
    const novosItens = itensDevolucao.filter((_, i) => i !== idx);
    setItensDevolucao(novosItens);
    const pesoSomado = novosItens.reduce((acc, curr) => acc + (Number(curr.peso) || 0), 0);
    if (pesoSomado > 0) {
      setNovaDevolucao(prev => ({ ...prev, quantidadeKg: pesoSomado.toFixed(3) }));
    }
  };

  const handleTipoChange = (novoTipo) => {
    setNovaDevolucao(prev => ({ ...prev, tipo: novoTipo }));
    if (novoTipo === 'Total' && entregaSelecionada) {
      if (entregaSelecionada.itens && entregaSelecionada.itens.length > 0) {
        setItensDevolucao(entregaSelecionada.itens.map(i => ({
          codigo: i.codigo || '',
          descricao: i.descricao || '',
          qtd: i.qtd || 1,
          peso: i.peso || 0
        })));
      }
      if (entregaSelecionada.peso) {
        setNovaDevolucao(prev => ({ ...prev, tipo: novoTipo, quantidadeKg: String(entregaSelecionada.peso) }));
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const notaFinal = String(novaDevolucao.nota || nfBusca).trim();
    if (!notaFinal) {
      alert("Por favor, informe a Nota Fiscal.");
      return;
    }

    // Se o usuário digitou um produto nos campos mas não clicou no botão "Incluir", adiciona-o automaticamente
    let itensFinais = [...itensDevolucao];
    if (itensFinais.length === 0 && (produtoBusca.trim() || itemTemp.codigo || itemTemp.descricao)) {
      itensFinais.push({
        codigo: itemTemp.codigo || '',
        descricao: itemTemp.descricao || produtoBusca.trim(),
        qtd: parseFloat(itemTemp.qtd) || 1,
        peso: parseFloat(itemTemp.peso) || parseFloat(novaDevolucao.quantidadeKg) || 0
      });
    }

    const pesoFinal = parseFloat(novaDevolucao.quantidadeKg) || itensFinais.reduce((acc, curr) => acc + (Number(curr.peso) || 0), 0) || 0;
    const placaFinal = novaDevolucao.placa || entregaSelecionada?.placa || '';

    adicionarDevolucao({
      ...novaDevolucao,
      nota: notaFinal,
      placa: placaFinal,
      itens: itensFinais,
      quantidadeKg: pesoFinal
    });

    setShowModal(false);
    
    // Reset
    setNovaDevolucao({
      nota: '', tipo: 'Total', quantidadeKg: '', status: 'Pendente de recebimento', tratamento: 'Aguardando definição', observacao: '', placa: ''
    });
    setNfBusca('');
    setEntregaSelecionada(null);
    setProdutoBusca('');
    setItemTemp({ codigo: '', descricao: '', qtd: '1', peso: '' });
    setItensDevolucao([]);
  };

  const handleDelete = (id) => {
    if (confirm("Tem certeza que deseja remover este lançamento de devolução?")) {
      removerDevolucao(id);
    }
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    editarDevolucao(editandoDevolucao.id, {
      observacao: editandoDevolucao.observacao,
    });
    setEditandoDevolucao(null);
  };

  const handleStatusSubmit = (e) => {
    e.preventDefault();
    if (novoStatusSelecionado || novoTratamentoSelecionado) {
      atualizarStatusDevolucao(alterandoStatus.id, novoStatusSelecionado || alterandoStatus.status, novaObservacaoStatus, novoTratamentoSelecionado || alterandoStatus.tratamento);
    }
    setAlterandoStatus(null);
    setNovaObservacaoStatus('');
    setNovoStatusSelecionado('');
    setNovoTratamentoSelecionado('');
  };

  const handleEditSubmitGrupo = async (e) => {
    e.preventDefault();
    await Promise.all(editandoMotivoGrupo.devolucoes.map(dev => 
      editarDevolucao(dev.id, { observacao: editandoMotivoGrupo.observacao })
    ));
    setEditandoMotivoGrupo(null);
  };

  const handleStatusSubmitGrupo = async (e) => {
    e.preventDefault();
    if (novoStatusSelecionado || novoTratamentoSelecionado) {
      await Promise.all(alterandoStatusGrupo.devolucoes.map(dev => 
        atualizarStatusDevolucao(
          dev.id, 
          novoStatusSelecionado || dev.status, 
          novaObservacaoStatus, 
          novoTratamentoSelecionado || dev.tratamento
        )
      ));
    }
    setAlterandoStatusGrupo(null);
    setNovaObservacaoStatus('');
    setNovoStatusSelecionado('');
    setNovoTratamentoSelecionado('');
  };

  const handleSendEmail = (dev) => {
    // Tentar achar a entrega para pegar dados do cliente
    const entrega = entregas.find(e => String(e.nota) === String(dev.nota));
    const codCliente = entrega?.codCliente || 'N/A';
    const nomeCliente = entrega?.cliente || 'N/A';
    
    let statusNota = entrega?.status;
    if (!statusNota) {
      if (dev.tipo === 'Total') statusNota = 'Devolução total';
      else if (dev.tipo === 'Parcial') statusNota = 'Entrega parcial';
      else statusNota = dev.tipo;
    }

    // Saudação baseada no horário
    const hora = new Date().getHours();
    let saudacao = 'Bom dia!';
    if (hora >= 12 && hora < 18) saudacao = 'Boa tarde!';
    else if (hora >= 18) saudacao = 'Boa noite!';

    const assunto = `OCORRÊNCIA - CLIENTE ${codCliente} - NF ${dev.nota}`;
    const corpo = `${saudacao}\n\nPara ciência:\nCliente: ${nomeCliente}\nStatus: ${statusNota}\nMotivo: ${dev.observacao || 'Não informado'}`;

    const mailUrl = `https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=&su=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
    window.open(mailUrl, '_blank', 'noopener,noreferrer');
  };

  const handleSendEmailGrupo = (grupo) => {
    const notasStr = grupo.devolucoes.map(d => d.nota).join('/');
    
    const hora = new Date().getHours();
    let saudacao = 'Bom dia!';
    if (hora >= 12 && hora < 18) saudacao = 'Boa tarde!';
    else if (hora >= 18) saudacao = 'Boa noite!';

    const assunto = `OCORRência - CLIENTE ${grupo.codCliente || 'S/N'} - NF ${notasStr}`;
    
    let detalhesNfs = grupo.devolucoes.map(dev => {
      const entrega = entregas.find(e => String(e.nota) === String(dev.nota));
      let statusNota = entrega?.status;
      if (!statusNota) {
        if (dev.tipo === 'Total') statusNota = 'Devolução total';
        else if (dev.tipo === 'Parcial') statusNota = 'Entrega parcial';
        else statusNota = dev.tipo;
      }
      return `* NF ${dev.nota} - Status: ${statusNota} - Motivo: ${dev.observacao || 'Não informado'}`;
    }).join('\n');

    const corpo = `${saudacao}\n\nPara ciência:\nCliente: ${grupo.cliente}\nNotas: ${grupo.devolucoes.map(d => d.nota).join(', ')}\n\nDetalhes por NF:\n${detalhesNfs}`;

    const mailUrl = `https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=&su=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
    window.open(mailUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-4 w-full pb-20">
      {/* Painel de Filtros Avançados Inteligentes */}
      <div className="glass-panel p-2.5 sm:p-5 rounded-2xl shadow-sm border border-border-secondary relative z-40 space-y-3">
        {/* No mobile: linha única com os 6 ícones; no desktop: grid de 6 colunas */}
        <div className="flex md:grid md:grid-cols-6 gap-1.5 sm:gap-3 lg:gap-4 items-center w-full">
          <MultiSelectDropdown 
            label="Data" 
            icon={Calendar}
            placeholder="Todas as Datas" 
            options={opcoesFiltro.datas.map(d => {
              const parts = d.split('-');
              return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d;
            })}
            selected={datasSelecionadas.map(d => {
              const parts = d.split('-');
              return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d;
            })}
            onChange={(sel) => {
              const remapped = sel.map(s => {
                const parts = s.split('/');
                return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : s;
              });
              setDatas(remapped);
            }}
          />
          <MultiSelectDropdown 
            label="Nota" 
            icon={Hash}
            placeholder="Todas as Notas" 
            options={opcoesFiltro.notas} 
            selected={notasSelecionadas} 
            onChange={setNotas} 
          />
          <MultiSelectDropdown 
            label="Placa" 
            icon={Truck}
            placeholder="Todas as Placas" 
            options={opcoesFiltro.placas} 
            selected={placasSelecionadas} 
            onChange={setPlacas} 
          />
          <MultiSelectDropdown 
            label="Tipo" 
            icon={RotateCcw}
            placeholder="Todos os Tipos" 
            options={opcoesFiltro.tipos} 
            selected={tiposSelecionados} 
            onChange={setTipos} 
          />
          <MultiSelectDropdown 
            label="Status" 
            icon={AlertCircle}
            placeholder="Todos os Status" 
            options={opcoesFiltro.status} 
            selected={statusSelecionados} 
            onChange={setStatus} 
          />
          <MultiSelectDropdown 
            label="RCA" 
            icon={User}
            placeholder="Todos os RCAs" 
            options={opcoesFiltro.rcas} 
            selected={rcasSelecionados} 
            onChange={setRcas} 
          />
        </div>

        {/* Barra de Busca Complementar */}
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input 
            type="text" 
            placeholder="Buscar por NF, Placa, Cliente, RCA ou Motivo..." 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-background-primary border border-border-secondary rounded-xl pl-10 pr-4 py-2 text-sm shadow-sm focus:outline-none focus:border-info focus:ring-1 focus:ring-info"
          />
        </div>
      </div>

      {/* Botão de Ação Centralizado (Apenas para Monitoramento) */}
      {currentUser?.role === 'Monitoramento' && (
        <div className="flex justify-center items-center w-full pt-1">
          <button 
            onClick={() => setShowModal(true)}
            className="w-full sm:w-auto bg-info hover:bg-info/90 text-white px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-md text-sm cursor-pointer"
          >
            <Plus size={18} />
            <span>Adicionar Devolução</span>
          </button>
        </div>
      )}

      {/* Lista */}
      <div className="space-y-3">
        {clientesAgrupados.length === 0 ? (
          <div className="text-center text-text-tertiary py-8 glass-panel rounded-xl">
            <RotateCcw className="mx-auto h-10 w-10 mb-2 opacity-50" />
            <p>Nenhuma devolução encontrada.</p>
          </div>
        ) : (
          clientesAgrupados.map(grupo => {
            const isExpanded = !!clientesExpandidos[grupo.id];
            const pesoTotal = grupo.devolucoes.reduce((acc, curr) => acc + (Number(curr.quantidadeKg) || 0), 0);
            
            return (
              <div key={grupo.id} className="glass-panel rounded-xl transition-all overflow-hidden border border-border-secondary">
                {/* Cabeçalho do Cliente */}
                <div 
                  onClick={() => toggleCliente(grupo.id)}
                  className="bg-background-secondary/50 p-4 border-b border-border-secondary flex justify-between items-start cursor-pointer hover:bg-background-secondary/70 transition-colors"
                >
                   <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-bold bg-background-primary px-2 py-0.5 rounded text-text-secondary border border-border-tertiary shadow-sm">
                          {grupo.placa}
                        </span>
                      </div>
                      <h3 className="font-bold text-text-primary text-base leading-tight mb-1">{grupo.cliente}</h3>
                      <div className="flex flex-wrap gap-2 text-xs text-text-secondary mt-2">
                        <div className="flex items-center"><Hash size={14} className="mr-1 opacity-70 text-info" /> {grupo.codCliente || 'S/N'}</div>
                        <div className="flex items-center"><MapPin size={14} className="mr-1 opacity-70 text-warning" /> {grupo.bairro || 'S/N'}</div>
                      </div>
                   </div>
                   <div className="flex flex-col items-end gap-2 shrink-0 pl-2">
                      <div className="text-right flex flex-col items-end">
                        <span className="block font-black text-danger text-lg leading-none">{pesoTotal.toFixed(3)} <span className="text-[10px] font-bold text-text-tertiary">kg</span></span>
                        <span className="text-[10px] uppercase font-bold text-text-tertiary mt-1">{grupo.devolucoes.length} {grupo.devolucoes.length === 1 ? 'nota' : 'notas'}</span>
                      </div>
                      
                      <div className="flex items-center gap-1.5 mt-1" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => handleSendEmailGrupo(grupo)} className="bg-background-primary border border-border-secondary text-text-tertiary hover:text-info p-1.5 rounded-lg transition-colors" title="E-mail do Grupo"><Mail size={14} /></button>
                        {currentUser?.role !== 'Operacao' && (
                          <button onClick={() => setEditandoMotivoGrupo({...grupo, observacao: ''})} className="bg-background-primary border border-border-secondary text-info hover:text-info/80 p-1.5 rounded-lg transition-colors" title="Editar Motivo Geral"><Edit2 size={14} /></button>
                        )}
                        <button onClick={() => { setAlterandoStatusGrupo(grupo); setNovoStatusSelecionado(''); setNovoTratamentoSelecionado(''); }} className="bg-info/10 text-info hover:bg-info/20 border border-info/20 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors uppercase flex items-center h-[28px]" title="Mudar Status Geral">Status</button>
                        
                        <div className="bg-background-primary p-1 rounded-md border border-border-tertiary ml-1 h-[28px] w-[28px] flex items-center justify-center cursor-pointer pointer-events-none">
                          {isExpanded ? <ChevronUp size={16} className="text-text-primary" /> : <ChevronDown size={16} className="text-text-primary" />}
                        </div>
                      </div>
                   </div>
                </div>

                {/* Lista de Notas Fiscais (Devoluções) */}
                {isExpanded && (
                  <div className="p-3 space-y-3 bg-background-primary/30">
                    {grupo.devolucoes.map(dev => (
                      <div key={dev.id} className={cn("bg-background-secondary rounded-lg p-3 border", dev.tipo === 'Reentrega' ? 'border-warning/50 shadow-sm' : 'border-border-tertiary')}>
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-bold text-text-primary text-sm mb-1">NF: {dev.nota}</h4>
                            <p className="text-[10px] text-text-secondary">{new Date(dev.data).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
                          </div>
                          <div className="text-right flex flex-col items-end">
                            <div className="flex gap-3 mb-2 items-center bg-background-primary rounded-lg px-2 py-1 border border-border-secondary">
                              <button onClick={() => handleSendEmail(dev)} className="text-text-tertiary hover:text-info transition-colors" title="Enviar E-mail (Gmail)"><Mail size={14} /></button>
                              <button onClick={() => window.open(`/imprimir-guia/${dev.id}`, '_blank')} className="text-text-tertiary hover:text-text-primary transition-colors" title="Imprimir Guia"><Printer size={14} /></button>
                              {currentUser?.role !== 'Operacao' && (
                                <button onClick={() => setEditandoDevolucao(dev)} className="text-info hover:text-info/80 transition-colors" title="Editar Motivo"><Edit2 size={14} /></button>
                              )}
                              <button onClick={() => setVerHistorico(dev)} className="text-text-tertiary hover:text-text-primary transition-colors" title="Histórico"><Clock size={14} /></button>
                              <button onClick={() => handleDelete(dev.id)} className="text-danger hover:text-danger/80 transition-colors" title="Excluir"><Trash2 size={14} /></button>
                            </div>
                            <span className="block font-bold text-danger text-xs">{(dev.quantidadeKg || 0).toFixed(3)} kg</span>
                            <span className="text-[10px] text-text-tertiary font-bold uppercase mt-0.5">{dev.tipo}</span>
                          </div>
                        </div>
                        
                        {dev.itens && dev.itens.length > 0 && (
                          <div className="mt-3 bg-background-primary p-2 rounded-lg text-xs space-y-1 border border-border-secondary">
                            <span className="font-bold text-text-primary block mb-1">Itens Devolvidos:</span>
                            {dev.itens.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-text-secondary border-b border-border-tertiary last:border-0 pb-1 last:pb-0">
                                <span className="truncate pr-2">- {item.descricao} ({item.codigo})</span>
                                <span className="flex-shrink-0 font-medium">{item.qtd} cx | {item.peso.toFixed(3)}kg</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {dev.observacao && (
                          <p className="text-[11px] bg-background-primary p-2 rounded-md mt-2 text-text-secondary italic border border-border-tertiary border-l-2 border-l-warning">
                            Motivo: "{dev.observacao}"
                          </p>
                        )}

                        <div className="mt-3 pt-3 border-t border-border-secondary flex items-center justify-between">
                          <div className="flex flex-col gap-1">
                            <Badge status={dev.status === 'Pendente de recebimento' ? 'Pendente' : (dev.status === 'Recebido na operação' || dev.status === 'Devolução lançada') ? 'Entrega total' : dev.status === 'Confirmado pelo motorista' ? 'No cliente' : 'Devolução total'}>
                              Status: {dev.status}
                            </Badge>
                            {dev.tratamento && (
                              <Badge status={dev.tratamento === 'Aguardando definição' ? 'Pendente' : dev.tratamento === 'Reentrega' ? 'Reentrega' : dev.tratamento === 'Manter bloqueada (Segregada)' ? 'Devolução total' : 'Entrega total'}>
                                Tratamento: {dev.tratamento}
                              </Badge>
                            )}
                          </div>
                          
                          <button 
                            onClick={() => {
                              setAlterandoStatus(dev);
                              setNovoStatusSelecionado(dev.status);
                              setNovoTratamentoSelecionado(dev.tratamento || 'Aguardando definição');
                            }}
                            className="bg-info/10 text-info hover:bg-info/20 border border-info/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                          >
                            Mudar Status
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal Nova Devolução */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-background-primary w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border border-border-secondary my-auto flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-border-tertiary flex justify-between items-center bg-background-secondary flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-info/10 text-info">
                  <RotateCcw size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-text-primary">Lançar Devolução</h3>
                  <p className="text-[11px] text-text-tertiary">Preencha os dados ou busque a nota fiscal no sistema</p>
                </div>
              </div>
              <button 
                onClick={() => setShowModal(false)} 
                className="p-1.5 rounded-lg hover:bg-background-tertiary text-text-tertiary hover:text-text-primary transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
              {/* 1. SEÇÃO DE NOTA FISCAL (COM AUTOCOMPLETE) */}
              <div className="space-y-1.5" ref={nfContainerRef}>
                <label className="block text-xs font-bold text-text-secondary">
                  Nota Fiscal <span className="text-danger">*</span>
                </label>
                <div className="relative">
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                    <input 
                      required
                      type="text" 
                      value={nfBusca}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNfBusca(val);
                        setNovaDevolucao(prev => ({ ...prev, nota: val }));
                        setNfSugestoesAbertas(true);
                        // Se apagar ou mudar manualmente, procura se bate com alguma entrega
                        const encontrada = entregas.find(ent => String(ent.nota).trim() === val.trim());
                        setEntregaSelecionada(encontrada || null);
                      }}
                      onFocus={() => setNfSugestoesAbertas(true)}
                      placeholder="Digite o número da NF, cliente ou placa..." 
                      className="w-full bg-background-secondary border border-border-secondary rounded-xl pl-9 pr-8 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-info transition-colors font-medium" 
                    />
                    {nfBusca && (
                      <button 
                        type="button" 
                        onClick={() => {
                          setNfBusca('');
                          setNovaDevolucao(prev => ({ ...prev, nota: '' }));
                          setEntregaSelecionada(null);
                          setItensDevolucao([]);
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary p-0.5"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Dropdown de Sugestões de NF */}
                  {nfSugestoesAbertas && sugestoesNfs.length > 0 && (
                    <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-background-primary border border-border-secondary rounded-xl shadow-2xl max-h-56 overflow-y-auto divide-y divide-border-tertiary">
                      <div className="px-3 py-1.5 bg-background-secondary text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                        Notas encontradas no sistema ({sugestoesNfs.length})
                      </div>
                      {sugestoesNfs.map(e => (
                        <button
                          key={e.id || e.nota}
                          type="button"
                          onClick={() => handleSelecionarNf(e)}
                          className="w-full text-left p-2.5 hover:bg-info/5 transition-colors flex items-center justify-between group"
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-info group-hover:underline">NF {e.nota}</span>
                              {e.placa && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-background-secondary text-text-secondary font-mono border border-border-secondary">
                                  {e.placa}
                                </span>
                              )}
                              {e.peso && (
                                <span className="text-[10px] text-text-tertiary">
                                  {Number(e.peso).toFixed(3)} kg
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-text-primary font-medium truncate mt-0.5">
                              {e.cliente || 'Sem cliente'}
                            </p>
                            {e.rca && (
                              <p className="text-[10px] text-text-tertiary truncate">
                                RCA: {e.rca} {e.bairro ? `• ${e.bairro}` : ''}
                              </p>
                            )}
                          </div>
                          <span className="text-[11px] text-info font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 flex-shrink-0">
                            Selecionar <Check size={12} />
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card de Informações da Entrega Selecionada */}
                {entregaSelecionada && (
                  <div className="mt-2 p-2.5 rounded-xl bg-info/5 border border-info/20 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-info flex items-center gap-1.5">
                        <CheckCircle2 size={13} /> Dados da Entrega Localizados
                      </span>
                      {entregaSelecionada.placa && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-info/10 text-info">
                          Placa: {entregaSelecionada.placa}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-text-secondary grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-1">
                      <div><strong className="text-text-primary">Cliente:</strong> {entregaSelecionada.cliente}</div>
                      {entregaSelecionada.codCliente && <div><strong className="text-text-primary">Cód:</strong> {entregaSelecionada.codCliente}</div>}
                      {entregaSelecionada.rca && <div><strong className="text-text-primary">RCA:</strong> {entregaSelecionada.rca}</div>}
                      {entregaSelecionada.peso && <div><strong className="text-text-primary">Peso NF:</strong> {Number(entregaSelecionada.peso).toFixed(3)} kg</div>}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. TIPO E QUANTIDADE (KG) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">Tipo de Devolução</label>
                  <select 
                    value={novaDevolucao.tipo} 
                    onChange={e => handleTipoChange(e.target.value)} 
                    className="w-full bg-background-secondary border border-border-secondary rounded-xl p-2 text-sm text-text-primary focus:outline-none focus:border-info transition-colors font-medium"
                  >
                    <option value="Total">Total</option>
                    <option value="Parcial">Parcial</option>
                    <option value="Devolução de gramatura">Devolução de gramatura</option>
                    <option value="Reentrega">Reentrega</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    Peso Total Devolvido (kg) <span className="text-danger">*</span>
                  </label>
                  <input 
                    required 
                    type="number" 
                    step="0.001" 
                    value={novaDevolucao.quantidadeKg} 
                    onChange={e => setNovaDevolucao({...novaDevolucao, quantidadeKg: e.target.value})} 
                    className="w-full bg-background-secondary border border-border-secondary rounded-xl p-2 text-sm text-text-primary focus:outline-none focus:border-info transition-colors font-medium" 
                    placeholder="Ex: 18.500" 
                  />
                </div>
              </div>

              {/* 3. SEÇÃO DE PRODUTOS / ITENS (COM AUTOCOMPLETE) */}
              <div className="p-3 rounded-xl bg-background-secondary border border-border-secondary space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Package size={14} className="text-info" />
                    <span className="text-xs font-bold text-text-primary">Produtos / Itens da Devolução</span>
                  </div>
                  <span className="text-[10px] text-text-tertiary">
                    {itensDevolucao.length} {itensDevolucao.length === 1 ? 'item incluído' : 'itens incluídos'}
                  </span>
                </div>

                {/* Input de Busca de Produto com Dropdown */}
                <div className="relative" ref={prodContainerRef}>
                  <label className="block text-[11px] font-medium text-text-tertiary mb-1">
                    Buscar Produto por Código ou Descrição
                  </label>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                    <input 
                      type="text" 
                      value={produtoBusca}
                      onChange={(e) => {
                        setProdutoBusca(e.target.value);
                        setProdutoSugestoesAbertas(true);
                      }}
                      onFocus={() => setProdutoSugestoesAbertas(true)}
                      placeholder="Ex: Digite o nome do produto ou código..."
                      className="w-full bg-background-primary border border-border-secondary rounded-lg pl-8 pr-8 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-info transition-colors"
                    />
                    {produtoBusca && (
                      <button 
                        type="button" 
                        onClick={() => {
                          setProdutoBusca('');
                          setItemTemp({ codigo: '', descricao: '', qtd: '1', peso: '' });
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary p-0.5"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* Dropdown de Sugestões de Produtos */}
                  {produtoSugestoesAbertas && sugestoesProdutos.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-background-primary border border-border-secondary rounded-xl shadow-2xl max-h-48 overflow-y-auto divide-y divide-border-tertiary">
                      <div className="px-3 py-1 bg-background-secondary text-[10px] font-bold text-text-tertiary flex justify-between items-center">
                        <span>Produtos sugeridos</span>
                        {entregaSelecionada?.itens?.length > 0 && (
                          <span className="text-[9px] text-info">Itens desta NF em destaque</span>
                        )}
                      </div>
                      {sugestoesProdutos.map((prod, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelecionarProduto(prod)}
                          className="w-full text-left p-2 hover:bg-info/5 transition-colors flex items-center justify-between text-xs group"
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="flex items-center gap-1.5">
                              {prod.daEntrega && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-info/10 text-info border border-info/20">
                                  Desta NF
                                </span>
                              )}
                              {prod.codigo && (
                                <span className="font-mono text-text-secondary font-bold text-[11px]">
                                  [{prod.codigo}]
                                </span>
                              )}
                              <span className="text-text-primary font-medium truncate">
                                {prod.descricao || 'Sem descrição'}
                              </span>
                            </div>
                          </div>
                          {(prod.qtd || prod.peso) && (
                            <span className="text-[10px] text-text-tertiary flex-shrink-0 font-medium">
                              {prod.qtd ? `${prod.qtd} cx` : ''} {prod.peso ? `• ${Number(prod.peso).toFixed(3)}kg` : ''}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Linha de inputs do Item (Código, Descrição, Qtd, Peso e Botão Incluir) */}
                <div className="grid grid-cols-12 gap-2 pt-1 items-end">
                  <div className="col-span-3 sm:col-span-2">
                    <label className="block text-[10px] text-text-tertiary mb-0.5">Código</label>
                    <input 
                      type="text" 
                      value={itemTemp.codigo}
                      onChange={e => setItemTemp({...itemTemp, codigo: e.target.value})}
                      placeholder="Cód."
                      className="w-full bg-background-primary border border-border-secondary rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-info font-mono"
                    />
                  </div>
                  <div className="col-span-9 sm:col-span-5">
                    <label className="block text-[10px] text-text-tertiary mb-0.5">Descrição do Produto</label>
                    <input 
                      type="text" 
                      value={itemTemp.descricao}
                      onChange={e => setItemTemp({...itemTemp, descricao: e.target.value})}
                      placeholder="Nome do produto..."
                      className="w-full bg-background-primary border border-border-secondary rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-info"
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <label className="block text-[10px] text-text-tertiary mb-0.5">Qtd (cx)</label>
                    <input 
                      type="number" 
                      step="1"
                      min="1"
                      value={itemTemp.qtd}
                      onChange={e => setItemTemp({...itemTemp, qtd: e.target.value})}
                      placeholder="1"
                      className="w-full bg-background-primary border border-border-secondary rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-info text-center"
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <label className="block text-[10px] text-text-tertiary mb-0.5">Peso (kg)</label>
                    <input 
                      type="number" 
                      step="0.001"
                      value={itemTemp.peso}
                      onChange={e => setItemTemp({...itemTemp, peso: e.target.value})}
                      placeholder="0.00"
                      className="w-full bg-background-primary border border-border-secondary rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-info text-center"
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-1 flex items-end">
                    <button 
                      type="button" 
                      onClick={handleAdicionarItemNaDevolucao}
                      disabled={!itemTemp.descricao && !itemTemp.codigo && !produtoBusca}
                      className="w-full bg-info text-white font-bold rounded-lg py-1.5 flex items-center justify-center hover:bg-info/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      title="Adicionar Item à lista"
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </div>

                {/* Lista de Itens Adicionados */}
                {itensDevolucao.length > 0 && (
                  <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {itensDevolucao.map((it, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-background-primary border border-border-secondary text-xs">
                        <div className="min-w-0 flex-1 pr-2">
                          <span className="font-bold text-text-primary">
                            {it.codigo ? `[${it.codigo}] ` : ''}{it.descricao}
                          </span>
                          <div className="text-[10px] text-text-tertiary flex gap-2 mt-0.5">
                            <span>Qtd: <strong>{it.qtd} cx</strong></span>
                            {it.peso > 0 && <span>Peso: <strong>{Number(it.peso).toFixed(3)} kg</strong></span>}
                          </div>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => handleRemoverItemDaDevolucao(idx)} 
                          className="text-text-tertiary hover:text-danger p-1 transition-colors"
                          title="Remover item"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 4. MOTIVO E TRATAMENTO */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    Motivo da Devolução <span className="text-danger">*</span>
                  </label>
                  <select 
                    required
                    value={novaDevolucao.observacao} 
                    onChange={e => setNovaDevolucao({...novaDevolucao, observacao: e.target.value})} 
                    className="w-full bg-background-secondary border border-border-secondary rounded-xl p-2 text-sm text-text-primary focus:outline-none focus:border-info transition-colors font-medium"
                  >
                    <option value="" disabled>Selecione um motivo...</option>
                    {MOTIVOS_DEVOLUCAO.map(m => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    Tratamento da Mercadoria
                  </label>
                  <select 
                    value={novaDevolucao.tratamento} 
                    onChange={e => setNovaDevolucao({...novaDevolucao, tratamento: e.target.value})} 
                    className="w-full bg-background-secondary border border-border-secondary rounded-xl p-2 text-sm text-text-primary focus:outline-none focus:border-info transition-colors font-medium"
                  >
                    {TRATAMENTO_MERCADORIA.map(t => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Botão de Salvar */}
              <div className="pt-2">
                <button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-info to-blue-600 text-white font-bold rounded-xl py-3 shadow-lg shadow-info/20 hover:shadow-info/30 hover:opacity-95 transition-all text-sm flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={16} /> Confirmar e Lançar Devolução
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Motivo */}
      {editandoDevolucao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-background-primary w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border-tertiary flex justify-between items-center bg-background-secondary">
              <h3 className="font-semibold">Editar Motivo (NF: {editandoDevolucao.nota})</h3>
              <button onClick={() => setEditandoDevolucao(null)} className="text-text-tertiary text-xl leading-none">&times;</button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Motivo Principal</label>
                <select 
                  required
                  value={editandoDevolucao.observacao} 
                  onChange={e => setEditandoDevolucao({...editandoDevolucao, observacao: e.target.value})} 
                  className="w-full bg-background-secondary border-none rounded-lg p-2 text-sm"
                >
                  <option value="" disabled>Selecione um motivo...</option>
                  <option value="Aguardando preenchimento do Monitoramento" className="font-bold text-warning">Pendente de preenchimento</option>
                  {MOTIVOS_DEVOLUCAO.map(m => (
                    <option key={m} value={m} >
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <button type="submit" className="w-full bg-info text-white font-semibold rounded-xl py-3 mt-2 hover:bg-info/90">
                Salvar Alterações
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Motivo Grupo */}
      {editandoMotivoGrupo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-background-primary w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border-tertiary flex justify-between items-center bg-background-secondary">
              <h3 className="font-semibold">Editar Motivo Geral ({editandoMotivoGrupo.cliente})</h3>
              <button onClick={() => setEditandoMotivoGrupo(null)} className="text-text-tertiary text-xl leading-none">&times;</button>
            </div>
            
            <form onSubmit={handleEditSubmitGrupo} className="p-4 space-y-4">
              <div className="bg-info/10 text-info p-3 rounded-lg text-xs font-medium border border-info/20">
                Atenção: Esta ação mudará o motivo de todas as {editandoMotivoGrupo.devolucoes.length} NFs deste cliente.
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Motivo para todas NFs</label>
                <select 
                  required
                  value={editandoMotivoGrupo.observacao} 
                  onChange={e => setEditandoMotivoGrupo({...editandoMotivoGrupo, observacao: e.target.value})} 
                  className="w-full bg-background-secondary border-none rounded-lg p-2 text-sm"
                >
                  <option value="" disabled>Selecione um motivo...</option>
                  <option value="Aguardando preenchimento do Monitoramento" className="font-bold text-warning">Pendente de preenchimento</option>
                  {MOTIVOS_DEVOLUCAO.map(m => (
                    <option key={m} value={m} >
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <button type="submit" className="w-full bg-info text-white font-semibold rounded-xl py-3 mt-2 hover:bg-info/90">
                Salvar Motivo em Lote
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Alterar Status (Novo fluxo com Histórico) */}
      {alterandoStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-background-primary w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border-tertiary flex justify-between items-center bg-background-secondary">
              <h3 className="font-semibold">Alterar Status e Tratamento (NF: {alterandoStatus.nota})</h3>
              <button onClick={() => { setAlterandoStatus(null); setNovoStatusSelecionado(''); setNovoTratamentoSelecionado(''); setNovaObservacaoStatus(''); }} className="text-text-tertiary text-xl leading-none">&times;</button>
            </div>
            
            <form onSubmit={handleStatusSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Novo Status da Devolução</label>
                <select 
                  required
                  value={novoStatusSelecionado} 
                  onChange={e => setNovoStatusSelecionado(e.target.value)} 
                  className="w-full bg-background-secondary border-none rounded-lg p-2 text-sm font-semibold"
                >
                  <option value="" disabled>Selecione...</option>
                  {STATUS_DEVOLUCAO_GERAL.map(s => <option key={s} value={s} >{s}</option>)}
                  {currentUser?.role === 'Monitoramento' && STATUS_DEVOLUCAO_MONITORAMENTO.map(s => <option key={s} value={s} >{s}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Novo Tratamento da Mercadoria</label>
                <select 
                  required
                  value={novoTratamentoSelecionado} 
                  onChange={e => setNovoTratamentoSelecionado(e.target.value)} 
                  className="w-full bg-background-secondary border-none rounded-lg p-2 text-sm font-semibold"
                >
                  <option value="" disabled>Selecione...</option>
                  {TRATAMENTO_MERCADORIA.map(t => <option key={t} value={t} >{t}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Observação Adicional (Opcional)</label>
                <textarea 
                  value={novaObservacaoStatus}
                  onChange={e => setNovaObservacaoStatus(e.target.value)}
                  className="w-full bg-background-secondary border-none rounded-lg p-3 text-sm h-24 resize-none focus:ring-1 focus:ring-info"
                  placeholder="Justifique a mudança de status se necessário..."
                />
              </div>

              <button type="submit" className="w-full bg-info text-white font-semibold rounded-xl py-3 mt-2 hover:bg-info/90 disabled:opacity-50 transition-opacity" disabled={!novoStatusSelecionado || !novoTratamentoSelecionado}>
                Confirmar Alteração
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Alterar Status Grupo */}
      {alterandoStatusGrupo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-background-primary w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border-tertiary flex justify-between items-center bg-background-secondary">
              <h3 className="font-semibold">Alterar Status Geral ({alterandoStatusGrupo.cliente})</h3>
              <button onClick={() => { setAlterandoStatusGrupo(null); setNovoStatusSelecionado(''); setNovoTratamentoSelecionado(''); setNovaObservacaoStatus(''); }} className="text-text-tertiary text-xl leading-none">&times;</button>
            </div>
            
            <form onSubmit={handleStatusSubmitGrupo} className="p-4 space-y-4">
              <div className="bg-info/10 text-info p-3 rounded-lg text-xs font-medium border border-info/20">
                Atenção: Esta ação mudará o Status e Tratamento de todas as {alterandoStatusGrupo.devolucoes.length} NFs deste cliente. Campos vazios não serão alterados.
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Novo Status Geral</label>
                <select 
                  value={novoStatusSelecionado} 
                  onChange={e => setNovoStatusSelecionado(e.target.value)} 
                  className="w-full bg-background-secondary border-none rounded-lg p-2 text-sm font-semibold"
                >
                  <option value="" disabled>Manter os status atuais...</option>
                  {STATUS_DEVOLUCAO_GERAL.map(s => <option key={s} value={s} >{s}</option>)}
                  {currentUser?.role === 'Monitoramento' && STATUS_DEVOLUCAO_MONITORAMENTO.map(s => <option key={s} value={s} >{s}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Novo Tratamento Geral</label>
                <select 
                  value={novoTratamentoSelecionado} 
                  onChange={e => setNovoTratamentoSelecionado(e.target.value)} 
                  className="w-full bg-background-secondary border-none rounded-lg p-2 text-sm font-semibold"
                >
                  <option value="" disabled>Manter os tratamentos atuais...</option>
                  {TRATAMENTO_MERCADORIA.map(t => <option key={t} value={t} >{t}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Observação Geral (Opcional)</label>
                <textarea 
                  value={novaObservacaoStatus}
                  onChange={e => setNovaObservacaoStatus(e.target.value)}
                  className="w-full bg-background-secondary border-none rounded-lg p-3 text-sm h-24 resize-none focus:ring-1 focus:ring-info"
                  placeholder="Justifique a mudança de status se necessário..."
                />
              </div>

              <button type="submit" className="w-full bg-info text-white font-semibold rounded-xl py-3 mt-2 hover:bg-info/90 disabled:opacity-50 transition-opacity" disabled={!novoStatusSelecionado && !novoTratamentoSelecionado}>
                Confirmar Alteração em Lote
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ver Histórico */}
      {verHistorico && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-background-primary w-full max-w-md rounded-2xl shadow-xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="px-4 py-3 border-b border-border-tertiary flex justify-between items-center bg-background-secondary">
              <h3 className="font-semibold flex items-center gap-2"><Clock size={18} className="text-info" /> Histórico da Devolução</h3>
              <button onClick={() => setVerHistorico(null)} className="text-text-tertiary hover:text-text-primary text-xl leading-none">&times;</button>
            </div>
            
            <div className="p-4 overflow-y-auto space-y-4 flex-1 hide-scrollbar">
              <div className="mb-4">
                <span className="text-xs text-text-secondary uppercase font-bold block mb-1">Nota Fiscal</span>
                <span className="text-lg font-bold text-text-primary">{verHistorico.nota}</span>
              </div>

              {verHistorico.historico && verHistorico.historico.length > 0 ? (
                <div className="relative border-l-2 border-border-tertiary ml-2 pl-5 space-y-6">
                  {verHistorico.historico.map((hist, idx) => {
                    const isLast = idx === verHistorico.historico.length - 1;
                    return (
                      <div key={idx} className="relative">
                        {/* Timeline dot */}
                        <div className={cn(
                          "absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-background-primary",
                          isLast ? "bg-info" : "bg-text-tertiary"
                        )}></div>
                        
                        <div className="mb-1 flex justify-between items-start">
                          <div className="flex flex-col gap-1">
                            <Badge status={hist.status === 'Pendente de recebimento' ? 'Pendente' : (hist.status === 'Recebido na operação' || hist.status === 'Devolução lançada') ? 'Entrega total' : hist.status === 'Confirmado pelo motorista' ? 'No cliente' : 'Devolução total'}>
                              Status: {hist.status}
                            </Badge>
                            {hist.tratamento && (
                              <Badge status={hist.tratamento === 'Aguardando definição' ? 'Pendente' : hist.tratamento === 'Reentrega' ? 'Reentrega' : hist.tratamento === 'Manter bloqueada (Segregada)' ? 'Devolução total' : 'Entrega total'}>
                                Tratamento: {hist.tratamento}
                              </Badge>
                            )}
                          </div>
                          <span className="text-[10px] text-text-tertiary font-medium">
                            {new Date(hist.data).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                          </span>
                        </div>
                        
                        <div className="bg-background-secondary p-3 rounded-xl border border-border-tertiary mt-2">
                          <div className="flex items-center gap-1.5 mb-2 border-b border-border-tertiary/50 pb-2">
                            <User size={12} className="text-info" />
                            <span className="text-[10px] font-bold text-text-secondary uppercase">{hist.role || 'Desconhecido'}</span>
                          </div>
                          {hist.observacao ? (
                            <p className="text-xs text-text-primary leading-relaxed">"{hist.observacao}"</p>
                          ) : (
                            <p className="text-xs text-text-tertiary italic">Sem observações.</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10 text-text-tertiary text-sm glass-panel rounded-xl">
                  <Clock className="mx-auto mb-3 opacity-20" size={32} />
                  <p className="font-medium">Nenhum histórico registrado.</p>
                  <p className="text-xs opacity-70 mt-1">Devoluções antigas não possuem histórico.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
