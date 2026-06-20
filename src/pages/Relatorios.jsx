import { useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Download, Filter, Camera, Check, ChevronDown, X, Package as PackageIcon } from 'lucide-react';
import { toPng } from 'html-to-image';
import { cn } from '../lib/utils';

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

  const clearAll = (e) => {
    e.stopPropagation();
    onChange([]);
  };

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-xs font-bold text-text-secondary mb-1">{label}</label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-background-secondary border border-border-secondary rounded-xl px-3 py-2.5 text-sm font-medium flex justify-between items-center cursor-pointer hover:border-info/50 transition-colors"
      >
        <span className={selected.length === 0 ? "text-text-tertiary" : "text-text-primary font-bold truncate max-w-[80%]"}>
          {selected.length === 0 ? placeholder : `${selected.length} selecionado(s)`}
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
            options.map(opt => (
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
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function Relatorios() {
  const { entregas, globalFilters, setGlobalFilters } = useStore();
  const reportRef = useRef(null);
  
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

  // Aplicar Filtros
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

  const handleExportImage = async () => {
    if (!reportRef.current) return;
    
    setIsExporting(true);
    try {
      // Capturar o elemento usando html-to-image
      const dataUrl = await toPng(reportRef.current, {
        pixelRatio: 2, // Maior resolução
        backgroundColor: '#ffffff'
      });
      
      // Converter para imagem e baixar
      const link = document.createElement('a');
      link.href = dataUrl;
      
      // Nome do arquivo
      const dataStr = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).replace(/\//g, '-');
      let nomeBase = 'Relatorio_Entregas';
      if (placasSelecionadas.length === 1) nomeBase += `_Placa-${placasSelecionadas[0]}`;
      if (cargasSelecionadas.length === 1) nomeBase += `_Carga-${cargasSelecionadas[0]}`;
      
      link.download = `${nomeBase}_${dataStr}.png`;
      link.click();
    } catch (error) {
      console.error("Erro ao gerar imagem:", error);
      alert("Houve um erro ao gerar a imagem. Tente novamente.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Relatórios</h2>
          <p className="text-sm text-text-secondary mt-1">Gere relatórios customizados com múltiplos filtros.</p>
        </div>
        
        <button 
          onClick={handleExportImage}
          disabled={isExporting || entregasFiltradas.length === 0}
          className="bg-info hover:bg-info/90 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors disabled:opacity-50 shadow-md"
        >
          {isExporting ? <Camera className="w-5 h-5 animate-pulse" /> : <Download className="w-5 h-5" />}
          <span className="hidden sm:inline">{isExporting ? 'Gerando...' : 'Exportar Imagem'}</span>
        </button>
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

      {/* Área de Visualização e Impressão do Relatório */}
      <div className="bg-white overflow-hidden rounded-2xl shadow-lg border border-slate-200 overflow-x-auto">
        <div 
          ref={reportRef} 
          className="p-8 bg-white w-full"
          style={{ minWidth: '1000px' }} // Garante que não quebre em telas pequenas na hora do print
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
              <p className="text-xs text-slate-500 uppercase font-bold mb-1">Gerado em</p>
              <p className="text-sm font-bold text-slate-900">{new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
            </div>
          </div>

          {/* Tabela com Zebra Mais Evidente */}
          <div className="rounded-xl overflow-hidden border border-slate-200">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="py-3 px-4 font-bold border-b border-slate-900 whitespace-nowrap w-[90px]">Data</th>
                  <th className="py-3 px-4 font-bold border-b border-slate-900 whitespace-nowrap w-[80px]">NF</th>
                  <th className="py-3 px-4 font-bold border-b border-slate-900">Cliente</th>
                  <th className="py-3 px-4 font-bold border-b border-slate-900 w-[180px]">Localidade</th>
                  <th className="py-3 px-4 font-bold border-b border-slate-900 w-[160px]">RCA / Placa</th>
                  <th className="py-3 px-4 font-bold border-b border-slate-900 w-[150px]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {entregasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-500 font-medium">
                      <div className="flex flex-col items-center justify-center opacity-50">
                        <Filter size={48} className="mb-4" />
                        <p className="text-lg">Nenhuma entrega encontrada para os filtros selecionados.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  entregasFiltradas.map((e, index) => {
                    
                    // Definir cores de status mais chamativas
                    let statusColor = "text-slate-700 bg-slate-100 border-slate-300";
                    if (e.status === 'Recebido') statusColor = "text-emerald-800 bg-emerald-100 border-emerald-300 shadow-sm";
                    if (e.status === 'Devolução total' || e.status === 'Entrega parcial') statusColor = "text-rose-800 bg-rose-100 border-rose-300 shadow-sm";
                    if (e.status === 'Reentrega') statusColor = "text-amber-800 bg-amber-100 border-amber-300 shadow-sm";
                    if (e.status === 'Em conferência') statusColor = "text-blue-800 bg-blue-100 border-blue-300 shadow-sm";
                    if (e.status === 'No cliente' || e.status === 'Descarregando') statusColor = "text-indigo-800 bg-indigo-100 border-indigo-300 shadow-sm";

                    // Zebrado da linha - Cores bem distintas
                    const rowClass = index % 2 === 0 ? 'bg-white' : 'bg-slate-100/70';

                    return (
                      <tr key={e.id} className={`${rowClass} hover:bg-slate-100 transition-colors`}>
                        <td className="py-2.5 px-4 font-medium text-slate-600">
                          {e.data ? e.data.split('-').reverse().join('/') : '-'}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-900">
                          {e.nota}
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="text-slate-500 text-xs mr-2 font-mono">{e.codCliente}</span>
                          <span className="text-slate-800 font-bold truncate block max-w-[250px]">{e.cliente}</span>
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
                  })
                )}
              </tbody>
            </table>
          </div>
          
          <div className="mt-8 pt-4 border-t-2 border-slate-100 flex justify-between text-xs text-slate-500 font-bold uppercase">
            <p className="bg-slate-100 px-3 py-1 rounded-full text-slate-700">Total de Registros: {entregasFiltradas.length}</p>
            <p className="flex items-center gap-1"><PackageIcon size={14} /> LogisTrack Intelligence</p>
          </div>
        </div>
      </div>
    </div>
  );
}
