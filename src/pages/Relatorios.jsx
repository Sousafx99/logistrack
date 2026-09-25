import { useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { 
  Download, Filter, Camera, Check, ChevronDown, X, Package as PackageIcon, 
  FileText, Search, Calendar, Clock, Truck, Boxes, User, Building2 
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { cn } from '../lib/utils';

// Função para formatar as notas consolidadas (ex: 100 a 105 / 200)
function formatarNfs(notas) {
  if (!notas || notas.length === 0) return '';
  // Se for 1 única nota, retorna ela direto
  if (notas.length === 1) return notas[0];

  // Extrai apenas as notas que são puramente numéricas para tentar compactar
  const numericNotas = notas.map(n => parseInt(String(n).trim(), 10)).filter(n => !isNaN(n)).sort((a, b) => a - b);
  
  // Se não conseguir converter para números, junta com barra
  if (numericNotas.length === 0 || numericNotas.length !== notas.length) {
    return notas.join(' / ');
  }
  
  let result = [];
  let start = numericNotas[0];
  let end = numericNotas[0];

  for (let i = 1; i < numericNotas.length; i++) {
    if (numericNotas[i] === end + 1 || numericNotas[i] === end) {
      end = numericNotas[i]; // Ignora duplicadas também
    } else {
      result.push(start === end ? `${start}` : `${start} a ${end}`);
      start = numericNotas[i];
      end = numericNotas[i];
    }
  }
  result.push(start === end ? `${start}` : `${start} a ${end}`);
  
  return result.join(' / ');
}

const formatarHora = (isoStr) => {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '-';
  }
};

// Componente MultiSelect Customizado para Filtros
function MultiSelectDropdown({ options, selected, onChange, placeholder, label, icon: Icon, align = 'left' }) {
  const [isOpen, setIsOpen] = useState(false);
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
          {/* Demarcador / setinha embaixo do ícone quando aberto no mobile */}
          {isOpen && (
            <div className="md:hidden absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-background-primary border-t border-l border-border-secondary rotate-45 z-50 pointer-events-none" />
          )}
        </button>
      </div>

      {/* Menu Dropdown de Opções (Responsivo para Desktop e Mobile com Largura Total no Mobile) */}
      {isOpen && (
        <div className="absolute z-50 top-full mt-2.5 left-0 right-0 md:right-auto md:w-full w-full max-h-[480px] bg-background-primary border border-border-secondary rounded-2xl shadow-2xl p-3 animate-in fade-in slide-in-from-top-2 flex flex-col">
          {/* Header do Dropdown com Título e Botão Limpar */}
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

          {/* Lista de Opções com Altura para até 10 Linhas */}
          <div className="max-h-[350px] overflow-y-auto space-y-1 pr-1">
            {options.length === 0 ? (
              <div className="p-4 text-xs text-text-tertiary text-center">Nenhuma opção disponível</div>
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
                
                {options.map(opt => (
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

// Componente de Cada Página de Relatório com Auto-Escala Responsiva no Mobile e Full-Width no Desktop
function ReportPageItem({
  pagina,
  pageIndex,
  totalPaginas,
  datasSelecionadas = [],
  placasSelecionadas = [],
  cargasSelecionadas = [],
  rcasSelecionados = [],
  clientesSelecionados = [],
  statusSelecionados = [],
  totalEntregas,
  totalClientes,
  totalNotas,
  modoVisualizacao
}) {
  const containerRef = useRef(null);
  const wrapperRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const updateSize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!containerRef.current || !wrapperRef.current) return;
      const actualHeight = containerRef.current.offsetHeight;
      setHeight(actualHeight);

      if (mobile && modoVisualizacao === 'ajustado') {
        const containerWidth = wrapperRef.current.offsetWidth;
        const newScale = Math.min(1, Math.max(0.32, containerWidth / 880));
        setScale(newScale);
      } else {
        setScale(1);
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [pagina, modoVisualizacao]);

  const isScaled = isMobile && modoVisualizacao === 'ajustado' && scale < 1;

  return (
    <div className="space-y-1.5 w-full relative z-10">
      {/* Indicador no mobile */}
      <div className="md:hidden flex items-center justify-between text-[11px] text-text-tertiary px-1 font-medium">
        <span>Página {pageIndex + 1} de {totalPaginas}</span>
        {isScaled ? (
          <span className="text-info font-bold">✨ Ajustado na tela (sem rolagem)</span>
        ) : (
          <span>⇄ Arraste para o lado para ver o relatório</span>
        )}
      </div>

      <div 
        ref={wrapperRef}
        className={cn(
          "bg-white rounded-2xl shadow-lg border border-slate-200 w-full transition-all",
          isScaled ? "overflow-hidden flex justify-center" : "overflow-x-auto scrollbar-thin"
        )}
        style={{
          height: isScaled && height ? `${Math.ceil(height * scale) + 4}px` : 'auto'
        }}
      >
        <div 
          className={cn(
            isMobile 
              ? (isScaled ? "w-[880px] shrink-0" : "min-w-[880px] w-[880px]") 
              : "w-full"
          )}
          style={{
            transform: isScaled ? `scale(${scale})` : 'none',
            transformOrigin: 'top center'
          }}
        >
          <div ref={containerRef} className={cn("p-6 sm:p-8 bg-white report-page-container", isMobile ? "w-[880px]" : "w-full")}>
            {/* Cabeçalho do Relatório */}
            <div className="border-b-4 border-slate-800 pb-4 mb-6 flex justify-between items-end">
              <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                  Relatório de Entregas
                </h1>
                <div className="text-sm text-slate-600 mt-2 font-medium flex flex-wrap items-center gap-x-6 gap-y-1 max-w-2xl">
                  {rcasSelecionados.length > 0 && (
                    <span>RCAs: <span className="text-slate-900 font-bold">{rcasSelecionados.length <= 2 ? rcasSelecionados.join(', ') : `${rcasSelecionados.length} selecionados`}</span></span>
                  )}
                  {placasSelecionadas.length > 0 && (
                    <span>Placas: <span className="text-slate-900 font-bold">{placasSelecionadas.length <= 3 ? placasSelecionadas.join(', ') : `${placasSelecionadas.length} selecionadas`}</span></span>
                  )}
                  {cargasSelecionadas.length > 0 && (
                    <span>Cargas: <span className="text-slate-900 font-bold">{cargasSelecionadas.length <= 3 ? cargasSelecionadas.join(', ') : `${cargasSelecionadas.length} selecionadas`}</span></span>
                  )}
                  {statusSelecionados.length > 0 && (
                    <span>Status: <span className="text-slate-900 font-bold">{statusSelecionados.join(', ')}</span></span>
                  )}
                  <span>Clientes: <span className="text-slate-900 font-bold">{totalClientes}</span></span>
                  <span>Notas: <span className="text-slate-900 font-bold">{totalNotas}</span></span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-0.5">
                  Página {pageIndex + 1} de {totalPaginas}
                </p>
                <p className="text-sm font-bold text-slate-900">
                  Emissão: {new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}
                </p>
              </div>
            </div>

            {/* Tabela */}
            <div className="rounded-xl overflow-hidden border border-slate-200 w-full">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="py-4 pl-5 pr-2 font-black border-b border-slate-900 w-[12%] text-sm tracking-wide">Notas</th>
                    <th className="py-4 px-2 font-black border-b border-slate-900 w-[26%] text-sm tracking-wide">Cliente</th>
                    <th className="py-4 px-2 font-black border-b border-slate-900 w-[17%] text-sm tracking-wide">Local</th>
                    <th className="py-4 px-2 font-black border-b border-slate-900 w-[17%] text-sm tracking-wide">RCA/Veículo</th>
                    <th className="py-4 px-2 font-black border-b border-slate-900 w-[14%] text-sm tracking-wide">Período</th>
                    <th className="py-4 pl-2 pr-5 font-black border-b border-slate-900 w-[14%] text-center text-sm tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {pagina.map((e, index) => {
                    let statusColor = "text-slate-700 bg-slate-100 border-slate-300";
                    if (e.status === 'Pendente') statusColor = "text-orange-800 bg-orange-100 border-orange-300 shadow-sm";
                    if (e.status === 'Em conferência') statusColor = "text-blue-800 bg-blue-100 border-blue-300 shadow-sm";
                    if (e.status === 'No cliente') statusColor = "text-purple-800 bg-purple-100 border-purple-300 shadow-sm";
                    if (e.status === 'Descarregando') statusColor = "text-indigo-800 bg-indigo-100 border-indigo-300 shadow-sm";
                    if (e.status === 'Entrega total' || e.status === 'Entregue') statusColor = "text-emerald-800 bg-emerald-100 border-emerald-300 shadow-sm";
                    if (e.status === 'Devolução total' || e.status === 'Devolução') statusColor = "text-red-800 bg-red-100 border-red-300 shadow-sm";
                    if (e.status === 'Entrega parcial') statusColor = "text-pink-800 bg-pink-100 border-pink-300 shadow-sm";
                    if (e.status === 'Reentrega') statusColor = "text-amber-800 bg-amber-100 border-amber-300 shadow-sm";
                    if (e.status === 'Recebido') statusColor = "text-teal-800 bg-teal-100 border-teal-300 shadow-sm";

                    const rowClass = index % 2 === 0 ? 'bg-white' : 'bg-slate-100/70';

                    return (
                      <tr key={`${e.codCliente}-${e.status}-${index}`} className={`${rowClass} hover:bg-slate-100 transition-colors`}>
                        <td className="py-3.5 pl-5 pr-2">
                          <span className="block font-mono text-lg font-black text-slate-900 leading-tight tracking-tight">
                            {e.notaConsolidada}
                          </span>
                          {e.quantidadeNFs > 1 && (
                            <span className="text-[10px] text-info bg-info/10 border border-info/20 px-1.5 py-0.5 rounded font-bold inline-block mt-1">
                              {e.quantidadeNFs} NFs
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-2">
                          <span className="text-slate-900 text-lg font-black tracking-tight block leading-tight">
                            {e.codCliente || 'S/C'}
                          </span>
                          <span className="text-slate-700 font-semibold text-xs block mt-1 truncate max-w-[95%]" title={e.cliente}>
                            {e.cliente}
                          </span>
                        </td>
                        <td className="py-3.5 px-2">
                          <span className="text-slate-900 font-black text-base block leading-tight truncate">
                            {e.bairro || '-'}
                          </span>
                          {e.cidade && (
                            <span className="text-slate-500 text-xs uppercase font-bold tracking-wider block mt-1 truncate">
                              {e.cidade}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-2">
                          <span className="text-slate-800 block text-sm font-bold leading-tight truncate">
                            {e.rca || '-'}
                          </span>
                          <span className="text-info block font-mono font-black text-sm mt-1">
                            {e.placa || '-'}
                          </span>
                        </td>
                        <td className="py-3.5 px-2 text-xs font-semibold text-slate-700 whitespace-nowrap">
                          <div className="space-y-1 text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400 font-bold uppercase text-[9px] w-12 shrink-0">Chegou:</span>
                              <span className="text-slate-900 font-bold font-mono text-xs">{formatarHora(e.horaChegada)}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400 font-bold uppercase text-[9px] w-12 shrink-0">
                                {['No cliente', 'Descarregando'].includes(e.status) ? 'Saiu (est):' : 'Saiu:'}
                              </span>
                              <span className="text-slate-700 font-semibold font-mono text-xs">{formatarHora(e.horaSaida)}</span>
                            </div>
                            <div className="flex items-center gap-1.5 pt-0.5">
                              <span className="text-slate-400 font-bold uppercase text-[9px] w-12 shrink-0">Tempo:</span>
                              {e.tempoFormatado ? (
                                <span className={cn(
                                  "px-2 py-0.5 rounded text-[11px] font-black border font-mono",
                                  e.tempoMinutos <= 45 ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                                  e.tempoMinutos <= 90 ? "bg-amber-100 text-amber-800 border-amber-200" :
                                  "bg-rose-100 text-rose-800 border-rose-200"
                                )}>
                                  {e.tempoFormatado}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-normal font-mono text-xs">-</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 pl-2 pr-5 text-center">
                          <div className={`px-2 py-1 rounded-md text-[11px] font-black uppercase text-center border inline-flex items-center justify-center whitespace-nowrap shadow-sm w-full max-w-[105px] ${statusColor}`}>
                            {e.status}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <div className="mt-8 pt-4 border-t-2 border-slate-100 flex justify-between items-center text-xs text-slate-500 font-bold">
              <p className="text-slate-700 font-bold tracking-tight">
                Logistrack - Sistema de monitoramento
              </p>
              <p className="bg-slate-100 px-3 py-1 rounded-full text-slate-700 text-[11px] font-bold uppercase">
                Mostrando {pagina.length} grupos de entregas (Total: {totalEntregas})
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Relatorios() {
  const { entregas, globalFilters, setGlobalFilters } = useStore();
  const [modoVisualizacao, setModoVisualizacao] = useState('ajustado'); // 'ajustado' | 'real'
  
  // Utilizando os arrays de filtros do relatorio
  const placasSelecionadas = globalFilters.relatorios.placas || [];
  const cargasSelecionadas = globalFilters.relatorios.cargas || [];
  const rcasSelecionados = globalFilters.relatorios.rcas || [];
  const datasSelecionadas = globalFilters.relatorios.datas || [];
  const statusSelecionados = globalFilters.relatorios.status || [];
  const clientesSelecionados = globalFilters.relatorios.clientes || [];

  const setPlacas = (val) => setGlobalFilters({ relatorios: { ...globalFilters.relatorios, placas: val } });
  const setCargas = (val) => setGlobalFilters({ relatorios: { ...globalFilters.relatorios, cargas: val } });
  const setRcas = (val) => setGlobalFilters({ relatorios: { ...globalFilters.relatorios, rcas: val } });
  const setDatas = (val) => setGlobalFilters({ relatorios: { ...globalFilters.relatorios, datas: val } });
  const setStatus = (val) => setGlobalFilters({ relatorios: { ...globalFilters.relatorios, status: val } });
  const setClientes = (val) => setGlobalFilters({ relatorios: { ...globalFilters.relatorios, clientes: val } });
  
  // Setar a data de hoje por padrão ao montar a aba, se estiver vazia
  useEffect(() => {
    if (datasSelecionadas.length === 0) {
      const hoje = new Date().toISOString().split('T')[0];
      setDatas([hoje]);
    }
  }, []);
  
  const [isExporting, setIsExporting] = useState(false);

  // Funções de correspondência individual
  const matchData = (e, sel = datasSelecionadas) => sel.length === 0 || sel.includes(e.data);
  const matchStatus = (e, sel = statusSelecionados) => sel.length === 0 || sel.includes(e.status);
  const matchPlaca = (e, sel = placasSelecionadas) => sel.length === 0 || sel.includes(e.placa);
  const matchCarga = (e, sel = cargasSelecionadas) => sel.length === 0 || sel.includes(e.carga);
  const matchRca = (e, sel = rcasSelecionados) => sel.length === 0 || sel.includes(e.rca);
  const matchCliente = (e, sel = clientesSelecionados) => {
    if (sel.length === 0) return true;
    const clienteStr = `${e.codCliente || ''} - ${e.cliente || ''}`.trim();
    return sel.some(selectedItem => {
      const [cod] = selectedItem.split(' - ');
      return (e.codCliente && String(e.codCliente) === cod) ||
             (e.cliente && selectedItem.includes(e.cliente)) ||
             (clienteStr === selectedItem);
    });
  };

  // Extrair opções dinâmicas e inteligentes para cada filtro considerando os demais ativos (Faceted filtering)
  const opcoesFiltro = useMemo(() => {
    // 1. Datas disponíveis considerando os outros filtros ativos
    const entregasParaDatas = entregas.filter(e => 
      matchStatus(e) && matchPlaca(e) && matchCarga(e) && matchRca(e) && matchCliente(e)
    );
    const datasSet = new Set(entregasParaDatas.map(e => e.data).filter(Boolean));

    // 2. Status disponíveis considerando os outros filtros ativos
    const entregasParaStatus = entregas.filter(e => 
      matchData(e) && matchPlaca(e) && matchCarga(e) && matchRca(e) && matchCliente(e)
    );
    const statusSet = new Set(entregasParaStatus.map(e => e.status).filter(Boolean));

    // 3. Placas disponíveis considerando os outros filtros ativos
    const entregasParaPlacas = entregas.filter(e => 
      matchData(e) && matchStatus(e) && matchCarga(e) && matchRca(e) && matchCliente(e)
    );
    const placasSet = new Set(entregasParaPlacas.map(e => e.placa).filter(Boolean));

    // 4. Cargas disponíveis considerando os outros filtros ativos
    const entregasParaCargas = entregas.filter(e => 
      matchData(e) && matchStatus(e) && matchPlaca(e) && matchRca(e) && matchCliente(e)
    );
    const cargasSet = new Set(entregasParaCargas.map(e => e.carga).filter(Boolean));

    // 5. RCAs disponíveis considerando os outros filtros ativos
    const entregasParaRcas = entregas.filter(e => 
      matchData(e) && matchStatus(e) && matchPlaca(e) && matchCarga(e) && matchCliente(e)
    );
    const rcasSet = new Set(entregasParaRcas.map(e => e.rca).filter(Boolean));

    // 6. Clientes disponíveis considerando os outros filtros ativos
    const entregasParaClientes = entregas.filter(e => 
      matchData(e) && matchStatus(e) && matchPlaca(e) && matchCarga(e) && matchRca(e)
    );
    const clientesSet = new Set();
    entregasParaClientes.forEach(e => {
      if (e.codCliente || e.cliente) {
        const item = e.codCliente ? `${e.codCliente} - ${e.cliente}` : e.cliente;
        clientesSet.add(item);
      }
    });

    return {
      datas: Array.from(datasSet).sort().reverse(),
      status: Array.from(statusSet).sort(),
      placas: Array.from(placasSet).sort(),
      cargas: Array.from(cargasSet).sort(),
      rcas: Array.from(rcasSet).sort(),
      clientes: Array.from(clientesSet).sort((a, b) => a.localeCompare(b))
    };
  }, [entregas, datasSelecionadas, statusSelecionados, placasSelecionadas, cargasSelecionadas, rcasSelecionados, clientesSelecionados]);

  // Limpeza automática de seleções que deixaram de existir com os filtros ativos
  useEffect(() => {
    if (entregas.length === 0) return;

    if (datasSelecionadas.length > 0) {
      const validDatas = datasSelecionadas.filter(d => opcoesFiltro.datas.includes(d));
      if (validDatas.length !== datasSelecionadas.length) setDatas(validDatas);
    }
    if (statusSelecionados.length > 0) {
      const validStatus = statusSelecionados.filter(s => opcoesFiltro.status.includes(s));
      if (validStatus.length !== statusSelecionados.length) setStatus(validStatus);
    }
    if (placasSelecionadas.length > 0) {
      const validPlacas = placasSelecionadas.filter(p => opcoesFiltro.placas.includes(p));
      if (validPlacas.length !== placasSelecionadas.length) setPlacas(validPlacas);
    }
    if (cargasSelecionadas.length > 0) {
      const validCargas = cargasSelecionadas.filter(c => opcoesFiltro.cargas.includes(c));
      if (validCargas.length !== cargasSelecionadas.length) setCargas(validCargas);
    }
    if (rcasSelecionados.length > 0) {
      const validRcas = rcasSelecionados.filter(r => opcoesFiltro.rcas.includes(r));
      if (validRcas.length !== rcasSelecionados.length) setRcas(validRcas);
    }
    if (clientesSelecionados.length > 0) {
      const validClientes = clientesSelecionados.filter(c => opcoesFiltro.clientes.includes(c));
      if (validClientes.length !== clientesSelecionados.length) setClientes(validClientes);
    }
  }, [opcoesFiltro, entregas.length]);

  // Aplicar Filtros Base
  const entregasFiltradas = useMemo(() => {
    return entregas.filter(e => 
      matchPlaca(e) && matchCarga(e) && matchRca(e) && matchData(e) && matchStatus(e) && matchCliente(e)
    );
  }, [entregas, placasSelecionadas, cargasSelecionadas, rcasSelecionados, datasSelecionadas, statusSelecionados, clientesSelecionados]);

  // Consolidar Entregas
  const entregasConsolidadas = useMemo(() => {
    const map = new Map();
    entregasFiltradas.forEach(e => {
      // Agrupar por data, cliente, status e placa
      const key = `${e.data}|${e.codCliente}|${e.status}|${e.placa}`;
      if (!map.has(key)) {
        map.set(key, { 
          ...e, 
          notasList: [e.nota],
          chegadasList: e.horaChegada ? [e.horaChegada] : [],
          saidasList: e.horaSaida ? [e.horaSaida] : [],
          temposList: e.tempoMinutos !== undefined && e.tempoMinutos !== null ? [Number(e.tempoMinutos)] : []
        });
      } else {
        const existente = map.get(key);
        if (!existente.notasList.includes(e.nota)) {
          existente.notasList.push(e.nota);
        }
        if (e.horaChegada && !existente.chegadasList.includes(e.horaChegada)) {
          existente.chegadasList.push(e.horaChegada);
        }
        if (e.horaSaida && !existente.saidasList.includes(e.horaSaida)) {
          existente.saidasList.push(e.horaSaida);
        }
        if (e.tempoMinutos !== undefined && e.tempoMinutos !== null && !existente.temposList.includes(Number(e.tempoMinutos))) {
          existente.temposList.push(Number(e.tempoMinutos));
        }
      }
    });

    return Array.from(map.values()).map(g => {
      const chegadasSorted = g.chegadasList.sort();
      const saidasSorted = g.saidasList.sort();
      const horaChegada = chegadasSorted[0] || g.horaChegada || null;
      const horaSaida = saidasSorted.length > 0 ? saidasSorted[saidasSorted.length - 1] : g.horaSaida || null;
      
      let tempoMinutos = null;
      if (horaChegada && horaSaida) {
        tempoMinutos = Math.max(0, Math.round((new Date(horaSaida).getTime() - new Date(horaChegada).getTime()) / 60000));
      } else if (g.temposList.length > 0) {
        tempoMinutos = Math.max(...g.temposList);
      }

      let tempoFormatado = null;
      if (tempoMinutos !== null) {
        const h = Math.floor(tempoMinutos / 60);
        const m = tempoMinutos % 60;
        tempoFormatado = h > 0 ? `${h}h ${m}min` : `${m} min`;
      }

      return {
        ...g,
        horaChegada,
        horaSaida,
        tempoMinutos,
        tempoFormatado,
        notaConsolidada: formatarNfs(g.notasList),
        quantidadeNFs: g.notasList.length
      };
    }).sort((a, b) => {
       if(a.data !== b.data) return (b.data || '').localeCompare(a.data || '');
       if(a.placa !== b.placa) return (a.placa || '').localeCompare(b.placa || '');
       return (a.cliente || '').localeCompare(b.cliente || '');
    });
  }, [entregasFiltradas]);

  // Paginação - Separar em blocos de 15
  const ITENS_POR_PAGINA = 15;
  const paginas = useMemo(() => {
    const chunks = [];
    for (let i = 0; i < entregasConsolidadas.length; i += ITENS_POR_PAGINA) {
      chunks.push(entregasConsolidadas.slice(i, i + ITENS_POR_PAGINA));
    }
    return chunks;
  }, [entregasConsolidadas]);

  const totalClientes = useMemo(() => {
    const set = new Set(entregasFiltradas.map(e => e.codCliente || e.cliente).filter(Boolean));
    return set.size;
  }, [entregasFiltradas]);

  const totalNotas = useMemo(() => {
    const set = new Set(entregasFiltradas.map(e => e.nota).filter(Boolean));
    return set.size;
  }, [entregasFiltradas]);

  const handleExportImage = async () => {
    const pages = document.querySelectorAll('.report-page-container');
    if (pages.length === 0) return;
    
    setIsExporting(true);
    try {
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const dataUrl = await toPng(page, {
          pixelRatio: 2, // Maior resolução
          backgroundColor: '#ffffff'
        });
        
        const link = document.createElement('a');
        link.href = dataUrl;
        
        const dataStr = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).replace(/\//g, '-');
        let nomeBase = 'Relatorio_de_Entregas';
        if (placasSelecionadas.length === 1) nomeBase += `_Placa-${placasSelecionadas[0]}`;
        if (cargasSelecionadas.length === 1) nomeBase += `_Carga-${cargasSelecionadas[0]}`;
        
        const suffix = pages.length > 1 ? `_Pagina_${i + 1}_de_${pages.length}` : '';
        link.download = `${nomeBase}_${dataStr}${suffix}.png`;
        link.click();
        
        // Pausa entre os downloads para o navegador não bloquear
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    } catch (error) {
      console.error("Erro ao gerar imagem:", error);
      alert("Houve um erro ao gerar as imagens. Tente novamente.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = () => {
    if (entregasFiltradas.length === 0) return;
    
    // Preparar cabeçalho com colunas de horários
    const cabecalho = [
      'Data', 
      'NF', 
      'Cod. Cliente', 
      'Cliente', 
      'Bairro', 
      'Cidade', 
      'RCA', 
      'Placa', 
      'Hora Chegada', 
      'Hora Saida', 
      'Tempo no Cliente (min)', 
      'Tempo Formatado',
      'Status', 
      'Peso'
    ];
    
    // CSV baseado nas entregas filtradas (dados brutos completos)
    const linhas = entregasFiltradas.map(e => [
      e.data ? e.data.split('-').reverse().join('/') : '',
      e.nota || '',
      e.codCliente || '',
      `"${(e.cliente || '').replace(/"/g, '""')}"`,
      `"${(e.bairro || '').replace(/"/g, '""')}"`,
      `"${(e.cidade || '').replace(/"/g, '""')}"`,
      e.rca || '',
      e.placa || '',
      e.horaChegada ? formatarHora(e.horaChegada) : '',
      e.horaSaida ? formatarHora(e.horaSaida) : '',
      e.tempoMinutos !== undefined && e.tempoMinutos !== null ? e.tempoMinutos : '',
      e.tempoFormatado || '',
      e.status || '',
      e.peso || ''
    ]);
    
    const csvContent = [cabecalho.join(';'), ...linhas.map(l => l.join(';'))].join('\n');
    
    // Adicionar BOM para Excel reconhecer UTF-8
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    
    const dataStr = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).replace(/\//g, '-');
    link.download = `Relatorio_de_Entregas_${dataStr}.csv`;
    link.click();
    
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 sm:space-y-6 w-full pb-20">
      {/* Botões de Exportação Centralizados Lado a Lado */}
      <div className="flex items-center justify-center gap-2.5 sm:gap-4 w-full">
        <button 
          onClick={handleExportCSV}
          disabled={entregasFiltradas.length === 0}
          className="flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-700 text-white px-4 sm:px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-md text-xs sm:text-sm"
        >
          <FileText className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          <span>Baixar Planilha</span>
        </button>
        
        <button 
          onClick={handleExportImage}
          disabled={isExporting || paginas.length === 0}
          className="flex-1 sm:flex-initial bg-info hover:bg-info/90 text-white px-4 sm:px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-md text-xs sm:text-sm"
        >
          {isExporting ? <Camera className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse shrink-0" /> : <Download className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />}
          <span>
            {isExporting ? 'Gerando...' : (paginas.length > 1 ? `Exportar ${paginas.length} Imagens` : 'Exportar Imagem')}
          </span>
        </button>
      </div>

      {/* Painel de Filtros Avançados */}
      <div className="glass-panel p-2.5 sm:p-5 rounded-2xl shadow-sm border border-border-secondary relative z-40">
        <div className="hidden md:flex items-center text-xs uppercase font-bold text-text-tertiary mb-3">
          <Filter size={14} className="mr-1" /> Filtros Múltiplos
        </div>
        
        {/* No mobile: linha única com os 6 ícones; no desktop: grid de 6 colunas */}
        <div className="flex md:grid md:grid-cols-6 gap-1.5 sm:gap-3 lg:gap-4 items-center w-full">
          <MultiSelectDropdown 
            label="Datas" 
            icon={Calendar}
            align="left"
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
              // Converter de volta para YYYY-MM-DD
              const remapped = sel.map(s => {
                const parts = s.split('/');
                return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : s;
              });
              setDatas(remapped);
            }}
          />
          <MultiSelectDropdown 
            label="Status" 
            icon={Clock}
            align="left"
            placeholder="Todos os Status" 
            options={opcoesFiltro.status} 
            selected={statusSelecionados} 
            onChange={setStatus} 
          />
          <MultiSelectDropdown 
            label="Placas" 
            icon={Truck}
            align="center"
            placeholder="Todas as Placas" 
            options={opcoesFiltro.placas} 
            selected={placasSelecionadas} 
            onChange={setPlacas} 
          />
          <MultiSelectDropdown 
            label="Cargas" 
            icon={Boxes}
            align="center"
            placeholder="Todas as Cargas" 
            options={opcoesFiltro.cargas} 
            selected={cargasSelecionadas} 
            onChange={setCargas} 
          />
          <MultiSelectDropdown 
            label="RCAs" 
            icon={User}
            align="right"
            placeholder="Todos os RCAs" 
            options={opcoesFiltro.rcas} 
            selected={rcasSelecionados} 
            onChange={setRcas} 
          />
          <MultiSelectDropdown 
            label="Clientes (Cód / Nome)" 
            icon={Building2}
            align="right"
            placeholder="Todos os Clientes" 
            options={opcoesFiltro.clientes} 
            selected={clientesSelecionados} 
            onChange={setClientes} 
          />
        </div>
      </div>

      {/* Controle de Visualização do Relatório no Mobile */}
      {paginas.length > 0 && (
        <div className="md:hidden flex items-center justify-between bg-background-secondary p-1.5 rounded-xl border border-border-secondary text-xs relative z-10">
          <span className="text-text-secondary font-bold px-2">Visualização:</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setModoVisualizacao('ajustado')}
              className={cn(
                "px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all",
                modoVisualizacao === 'ajustado' 
                  ? "bg-info text-white shadow-sm" 
                  : "text-text-tertiary hover:text-text-primary"
              )}
            >
              <span>📱 Ajustar à Tela</span>
            </button>
            <button
              onClick={() => setModoVisualizacao('real')}
              className={cn(
                "px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all",
                modoVisualizacao === 'real' 
                  ? "bg-info text-white shadow-sm" 
                  : "text-text-tertiary hover:text-text-primary"
              )}
            >
              <span>🔍 100% (Rolagem)</span>
            </button>
          </div>
        </div>
      )}

      {/* Múltiplas Áreas de Visualização (Paginação) */}
      <div className="flex flex-col gap-6">
        {paginas.length === 0 ? (
          <div className="bg-white overflow-hidden rounded-2xl shadow-lg border border-slate-200 p-12 text-center text-slate-500 font-medium">
            <div className="flex flex-col items-center justify-center opacity-50">
              <Filter size={48} className="mb-4" />
              <p className="text-lg">Nenhuma entrega encontrada para os filtros selecionados.</p>
            </div>
          </div>
        ) : (
          paginas.map((pagina, pageIndex) => (
            <ReportPageItem 
              key={pageIndex}
              pagina={pagina}
              pageIndex={pageIndex}
              totalPaginas={paginas.length}
              datasSelecionadas={datasSelecionadas}
              placasSelecionadas={placasSelecionadas}
              cargasSelecionadas={cargasSelecionadas}
              rcasSelecionados={rcasSelecionados}
              clientesSelecionados={clientesSelecionados}
              statusSelecionados={statusSelecionados}
              totalEntregas={entregasConsolidadas.length}
              totalClientes={totalClientes}
              totalNotas={totalNotas}
              modoVisualizacao={modoVisualizacao}
            />
          ))
        )}
      </div>
    </div>
  );
}
