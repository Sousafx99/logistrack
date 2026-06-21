import { useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Download, Filter, Camera, Check, ChevronDown, X, Package as PackageIcon, FileText } from 'lucide-react';
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

// Componente MultiSelect Customizado para Filtros
function MultiSelectDropdown({ options, selected, onChange, placeholder, label }) {
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

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-xs font-bold text-text-secondary mb-1">{label}</label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-background-secondary border border-border-secondary rounded-xl px-3 py-2.5 text-sm font-medium flex justify-between items-center cursor-pointer hover:border-info/50 transition-colors"
      >
        <span className={selected.length === 0 ? "text-text-tertiary" : "text-text-primary font-bold truncate max-w-[80%]"}>
          {selected.length === 0 ? placeholder : (isAllSelected ? 'Todos' : `${selected.length} selecionado(s)`)}
        </span>
        <div className="flex items-center gap-1">
          {selected.length > 0 && (
            <div onClick={clearAll} className="p-1 hover:bg-background-tertiary rounded-full text-text-tertiary hover:text-danger transition-colors">
              <X size={14} />
            </div>
          )}
          <ChevronDown size={16} className={`text-text-tertiary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 top-full left-0 mt-2 w-full max-h-60 overflow-y-auto bg-background-primary border border-border-secondary rounded-xl shadow-2xl p-2 animate-in fade-in slide-in-from-top-2">
          {options.length === 0 ? (
            <div className="p-2 text-xs text-text-tertiary text-center">Nenhuma opção</div>
          ) : (
            <>
              <label className="flex items-center gap-3 p-2 hover:bg-background-secondary rounded-lg cursor-pointer transition-colors group border-b border-border-secondary mb-1 pb-3">
                <input 
                  type="checkbox" 
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                  className="hidden" 
                />
                <div className={cn(
                  "w-5 h-5 rounded border flex items-center justify-center transition-colors flex-shrink-0",
                  isAllSelected ? "bg-info border-info text-white" : "border-border-tertiary group-hover:border-info/50"
                )}>
                  {isAllSelected && <Check size={14} strokeWidth={3} />}
                </div>
                <span className="text-sm font-bold text-text-primary">Selecionar Tudo</span>
              </label>
              
              {options.map(opt => (
                <label key={opt} className="flex items-center gap-3 p-2 hover:bg-background-secondary rounded-lg cursor-pointer transition-colors group">
                  <input 
                    type="checkbox" 
                    checked={selected.includes(opt)}
                    onChange={() => toggleOption(opt)}
                    className="hidden" 
                  />
                  <div className={cn(
                    "w-5 h-5 rounded border flex items-center justify-center transition-colors flex-shrink-0",
                    selected.includes(opt) ? "bg-info border-info text-white" : "border-border-tertiary group-hover:border-info/50"
                  )}>
                    {selected.includes(opt) && <Check size={14} strokeWidth={3} />}
                  </div>
                  <span className="text-sm font-medium text-text-secondary group-hover:text-text-primary truncate">{opt}</span>
                </label>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function Relatorios() {
  const { entregas, globalFilters, setGlobalFilters } = useStore();
  
  // Utilizando os arrays de filtros do relatorio
  const placasSelecionadas = globalFilters.relatorios.placas || [];
  const cargasSelecionadas = globalFilters.relatorios.cargas || [];
  const rcasSelecionados = globalFilters.relatorios.rcas || [];
  const datasSelecionadas = globalFilters.relatorios.datas || [];
  const statusSelecionados = globalFilters.relatorios.status || [];

  const setPlacas = (val) => setGlobalFilters({ relatorios: { ...globalFilters.relatorios, placas: val } });
  const setCargas = (val) => setGlobalFilters({ relatorios: { ...globalFilters.relatorios, cargas: val } });
  const setRcas = (val) => setGlobalFilters({ relatorios: { ...globalFilters.relatorios, rcas: val } });
  const setDatas = (val) => setGlobalFilters({ relatorios: { ...globalFilters.relatorios, datas: val } });
  const setStatus = (val) => setGlobalFilters({ relatorios: { ...globalFilters.relatorios, status: val } });
  
  // Setar a data de hoje por padrão ao montar a aba, se estiver vazia
  useEffect(() => {
    if (datasSelecionadas.length === 0) {
      const hoje = new Date().toISOString().split('T')[0];
      setDatas([hoje]);
    }
  }, []);
  
  const [isExporting, setIsExporting] = useState(false);

  // Extrair opções únicas para os filtros baseados nos dados
  const opcoesFiltro = useMemo(() => {
    const placas = new Set();
    const cargas = new Set();
    const rcas = new Set();
    const datas = new Set();
    const statusSet = new Set();
    
    entregas.forEach(e => {
      if (e.placa) placas.add(e.placa);
      if (e.carga) cargas.add(e.carga);
      if (e.rca) rcas.add(e.rca);
      if (e.data) datas.add(e.data);
      if (e.status) statusSet.add(e.status);
    });
    
    return {
      placas: Array.from(placas).sort(),
      cargas: Array.from(cargas).sort(),
      rcas: Array.from(rcas).sort(),
      datas: Array.from(datas).sort().reverse(),
      status: Array.from(statusSet).sort()
    };
  }, [entregas]);

  // Aplicar Filtros Base
  const entregasFiltradas = useMemo(() => {
    return entregas.filter(e => {
      const matchPlaca = placasSelecionadas.length === 0 || placasSelecionadas.includes(e.placa);
      const matchCarga = cargasSelecionadas.length === 0 || cargasSelecionadas.includes(e.carga);
      const matchRca = rcasSelecionados.length === 0 || rcasSelecionados.includes(e.rca);
      const matchData = datasSelecionadas.length === 0 || datasSelecionadas.includes(e.data);
      const matchStatus = statusSelecionados.length === 0 || statusSelecionados.includes(e.status);
      return matchPlaca && matchCarga && matchRca && matchData && matchStatus;
    });
  }, [entregas, placasSelecionadas, cargasSelecionadas, rcasSelecionados, datasSelecionadas, statusSelecionados]);

  // Consolidar Entregas
  const entregasConsolidadas = useMemo(() => {
    const map = new Map();
    entregasFiltradas.forEach(e => {
      // Agrupar por data, cliente, status e placa
      const key = `${e.data}|${e.codCliente}|${e.status}|${e.placa}`;
      if (!map.has(key)) {
        map.set(key, { ...e, notasList: [e.nota] });
      } else {
        const existente = map.get(key);
        // Evita duplicar a nota caso o sistema já tenha enviado duas vezes (defensivo)
        if (!existente.notasList.includes(e.nota)) {
          existente.notasList.push(e.nota);
        }
      }
    });

    return Array.from(map.values()).map(g => ({
      ...g,
      notaConsolidada: formatarNfs(g.notasList),
      quantidadeNFs: g.notasList.length
    })).sort((a, b) => {
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
        let nomeBase = 'Relatorio';
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
    
    // Preparar cabeçalho
    const cabecalho = ['Data', 'NF', 'Cod. Cliente', 'Cliente', 'Bairro', 'Cidade', 'RCA', 'Placa', 'Status', 'Peso'];
    
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
    link.download = `Relatorio_Planilha_${dataStr}.csv`;
    link.click();
    
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Relatórios</h2>
          <p className="text-sm text-text-secondary mt-1">Gere relatórios customizados com NFs consolidadas e múltiplas páginas.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExportCSV}
            disabled={entregasFiltradas.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors disabled:opacity-50 shadow-md"
          >
            <FileText className="w-5 h-5" />
            <span className="hidden sm:inline">Baixar Planilha</span>
          </button>
          
          <button 
            onClick={handleExportImage}
            disabled={isExporting || paginas.length === 0}
            className="bg-info hover:bg-info/90 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors disabled:opacity-50 shadow-md"
          >
            {isExporting ? <Camera className="w-5 h-5 animate-pulse" /> : <Download className="w-5 h-5" />}
            <span className="hidden sm:inline">
              {isExporting ? 'Gerando...' : (paginas.length > 1 ? `Exportar ${paginas.length} Imagens` : 'Exportar Imagem')}
            </span>
          </button>
        </div>
      </div>

      {/* Painel de Filtros Avançados */}
      <div className="glass-panel p-5 rounded-2xl shadow-sm border border-border-secondary">
        <div className="flex items-center text-xs uppercase font-bold text-text-tertiary mb-4">
          <Filter size={14} className="mr-1" /> Filtros Múltiplos
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <MultiSelectDropdown 
            label="Datas" 
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
            placeholder="Todos os Status" 
            options={opcoesFiltro.status} 
            selected={statusSelecionados} 
            onChange={setStatus} 
          />
          <MultiSelectDropdown 
            label="Placas" 
            placeholder="Todas as Placas" 
            options={opcoesFiltro.placas} 
            selected={placasSelecionadas} 
            onChange={setPlacas} 
          />
          <MultiSelectDropdown 
            label="Cargas" 
            placeholder="Todas as Cargas" 
            options={opcoesFiltro.cargas} 
            selected={cargasSelecionadas} 
            onChange={setCargas} 
          />
          <MultiSelectDropdown 
            label="RCAs" 
            placeholder="Todos os RCAs" 
            options={opcoesFiltro.rcas} 
            selected={rcasSelecionados} 
            onChange={setRcas} 
          />
        </div>
      </div>

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
            <div key={pageIndex} className="bg-white overflow-hidden rounded-2xl shadow-lg border border-slate-200 overflow-x-auto">
              <div 
                className="p-8 bg-white w-full report-page-container"
                style={{ minWidth: '1000px' }}
              >
                {/* Cabeçalho do Relatório */}
                <div className="border-b-4 border-slate-800 pb-4 mb-6 flex justify-between items-end">
                  <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                      <img src="/logo.png" alt="Logo" className="w-8 h-8 rounded" /> 
                      Relatório Operacional LogisTrack
                    </h1>
                    <div className="text-sm text-slate-600 mt-2 font-medium flex flex-wrap gap-x-6 gap-y-1 max-w-2xl">
                      {placasSelecionadas.length > 0 && <span>Placas: <span className="text-slate-900">{placasSelecionadas.join(', ')}</span></span>}
                      {cargasSelecionadas.length > 0 && <span>Cargas: <span className="text-slate-900">{cargasSelecionadas.join(', ')}</span></span>}
                      {rcasSelecionados.length > 0 && <span>RCAs: <span className="text-slate-900">{rcasSelecionados.join(', ')}</span></span>}
                      {placasSelecionadas.length === 0 && cargasSelecionadas.length === 0 && rcasSelecionados.length === 0 && <span>Visão Geral Completa</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">
                      {paginas.length > 1 ? `Página ${pageIndex + 1} de ${paginas.length}` : 'Relatório'}
                    </p>
                    <p className="text-sm font-bold text-slate-900">{new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
                  </div>
                </div>

                {/* Tabela */}
                <div className="rounded-xl overflow-hidden border border-slate-200">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-800 text-white">
                        <th className="py-3 px-4 font-bold border-b border-slate-900 whitespace-nowrap w-[90px]">Data</th>
                        <th className="py-3 px-4 font-bold border-b border-slate-900 w-[140px] max-w-[140px]">NF(s) Consolidadas</th>
                        <th className="py-3 px-4 font-bold border-b border-slate-900 w-[220px]">Cliente</th>
                        <th className="py-3 px-4 font-bold border-b border-slate-900 w-[160px]">Localidade</th>
                        <th className="py-3 px-4 font-bold border-b border-slate-900 w-[180px]">RCA / Placa</th>
                        <th className="py-3 px-4 font-bold border-b border-slate-900 w-[150px]">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {pagina.map((e, index) => {
                        // Cores exclusivas para cada status
                        let statusColor = "text-slate-700 bg-slate-100 border-slate-300"; // Em Aberto
                        
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
                            <td className="py-2.5 px-4 font-medium text-slate-600">
                              {e.data ? e.data.split('-').reverse().join('/') : '-'}
                            </td>
                            <td className="py-2.5 px-4 font-bold text-slate-900">
                              <span className="break-words block">{e.notaConsolidada}</span>
                              {e.quantidadeNFs > 1 && (
                                <span className="text-[10px] text-info bg-info/10 px-1.5 py-0.5 rounded ml-1 font-bold">
                                  {e.quantidadeNFs} NFs
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-4">
                              <span className="text-slate-900 text-sm font-black tracking-wide block leading-tight">{e.codCliente || 'S/C'}</span>
                              <span className="text-slate-500 font-medium text-xs truncate block max-w-[200px] mt-0.5">{e.cliente}</span>
                            </td>
                            <td className="py-2.5 px-4">
                              <span className="text-slate-800 font-medium block truncate max-w-[150px]">{e.bairro}</span>
                              {e.cidade && <span className="text-slate-500 text-[10px] uppercase font-bold truncate block">{e.cidade}</span>}
                            </td>
                            <td className="py-2.5 px-4">
                              <span className="text-slate-600 block text-xs font-bold">{e.rca || '-'}</span>
                              <span className="text-info block font-bold text-xs">{e.placa}</span>
                            </td>
                            <td className="py-2.5 px-4">
                              <div className={`px-2.5 py-1 rounded-md text-xs font-black uppercase text-center border ${statusColor}`}>
                                {e.status}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                
                <div className="mt-8 pt-4 border-t-2 border-slate-100 flex justify-between text-xs text-slate-500 font-bold uppercase">
                  <p className="bg-slate-100 px-3 py-1 rounded-full text-slate-700">
                    Mostrando {pagina.length} grupos de entregas (Total: {entregasConsolidadas.length})
                  </p>
                  <p className="flex items-center gap-1"><PackageIcon size={14} /> LogisTrack Intelligence</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
