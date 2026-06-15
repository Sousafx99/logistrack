import { useState, useMemo } from 'react';
import { Search, Filter, CheckSquare, Square, Check, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Toggle } from '../components/ui/Toggle';
import { cn } from '../lib/utils';

export function Canhotos() {
  const { entregas, toggleCanhoto, toggleCanhotoEmMassa, globalFilters, setGlobalFilters } = useStore();
  
  // Filters
  const dataSelecionada = globalFilters.data;
  const placaSelecionada = globalFilters.canhotos.placa;
  const cargaSelecionada = globalFilters.canhotos.carga;
  const busca = globalFilters.canhotos.busca;

  const setDataSelecionada = (val) => setGlobalFilters({ data: val });
  const setPlacaSelecionada = (val) => setGlobalFilters({ canhotos: { ...globalFilters.canhotos, placa: val }});
  const setCargaSelecionada = (val) => setGlobalFilters({ canhotos: { ...globalFilters.canhotos, carga: val }});
  const setBusca = (val) => setGlobalFilters({ canhotos: { ...globalFilters.canhotos, busca: val }});

  // Bulk Selection State
  const [selecionados, setSelecionados] = useState([]);

  // Extract unique options
  const opcoesFiltro = useMemo(() => {
    const placas = new Set();
    const cargas = new Set();
    
    entregas.forEach(e => {
      if (e.data === dataSelecionada) {
        if (e.placa) placas.add(e.placa);
        if (e.carga) cargas.add(e.carga);
      }
    });
    
    return {
      placas: Array.from(placas).sort(),
      cargas: Array.from(cargas).sort(),
    };
  }, [entregas, dataSelecionada]);

  const entregasFiltradas = useMemo(() => {
    return entregas.filter(e => {
      const matchData = e.data === dataSelecionada;
      const matchPlaca = placaSelecionada ? e.placa === placaSelecionada : true;
      const matchCarga = cargaSelecionada ? e.carga === cargaSelecionada : true;
      
      const term = busca.toLowerCase();
      const matchBusca = term ? (
        e.nota.includes(term) || 
        e.cliente.toLowerCase().includes(term) || 
        (e.placa && e.placa.toLowerCase().includes(term))
      ) : true;
      
      return matchData && matchPlaca && matchCarga && matchBusca;
    });
  }, [entregas, dataSelecionada, placaSelecionada, cargaSelecionada, busca]);

  // Metrics (only for filtered)
  const recebidos = entregasFiltradas.filter(e => e.canhoto).length;
  const pendentes = entregasFiltradas.length - recebidos;

  // Bulk Toggle functions
  const handleToggleSelectAll = () => {
    if (selecionados.length === entregasFiltradas.length) {
      setSelecionados([]); // Desmarcar todos
    } else {
      setSelecionados(entregasFiltradas.map(e => e.id)); // Marcar todos
    }
  };

  const handleToggleRow = (id) => {
    setSelecionados(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleMassaRecebidos = () => {
    toggleCanhotoEmMassa(selecionados, true);
    setSelecionados([]);
  };

  const handleMassaPendentes = () => {
    toggleCanhotoEmMassa(selecionados, false);
    setSelecionados([]);
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Header & Metrics */}
      <div className="flex justify-between items-end mb-2">
        <h2 className="text-xl font-bold">Controle Físico</h2>
        <div className="flex gap-3 text-sm">
          <div className="text-right">
            <span className="block text-[10px] text-text-secondary uppercase">Recebidos</span>
            <span className="font-bold text-success">{recebidos}</span>
          </div>
          <div className="text-right">
            <span className="block text-[10px] text-text-secondary uppercase">Faltam</span>
            <span className="font-bold text-warning">{pendentes}</span>
          </div>
        </div>
      </div>

      {/* Painel de Filtros */}
      <div className="glass-panel p-4 rounded-xl space-y-3">
        <div className="flex items-center text-xs uppercase font-bold text-text-tertiary mb-2">
          <Filter size={14} className="mr-1" /> Filtros
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-text-tertiary mb-1">Data</label>
            <input 
              type="date" 
              value={dataSelecionada}
              onChange={(e) => setDataSelecionada(e.target.value)}
              className="w-full bg-background-primary border border-border-secondary rounded-lg px-3 py-2 text-sm focus:ring-info font-bold"
            />
          </div>
          
          <div>
            <label className="block text-[10px] font-bold text-text-tertiary mb-1">Placa</label>
            <select 
              value={placaSelecionada}
              onChange={(e) => setPlacaSelecionada(e.target.value)}
              className="w-full bg-background-primary border border-border-secondary rounded-lg px-3 py-2 text-sm focus:ring-info font-bold"
            >
              <option value="">Todas as Placas</option>
              {opcoesFiltro.placas.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          
          <div>
            <label className="block text-[10px] font-bold text-text-tertiary mb-1">Carga</label>
            <select 
              value={cargaSelecionada}
              onChange={(e) => setCargaSelecionada(e.target.value)}
              className="w-full bg-background-primary border border-border-secondary rounded-lg px-3 py-2 text-sm focus:ring-info font-bold"
            >
              <option value="">Todas as Cargas</option>
              {opcoesFiltro.cargas.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="relative mt-2">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input 
            type="text" 
            placeholder="Buscar NF, Cliente ou Placa..." 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-background-primary border border-border-secondary rounded-xl pl-10 pr-4 py-2 text-sm shadow-sm focus:ring-info"
          />
        </div>
      </div>

      {/* Opções de Seleção */}
      {entregasFiltradas.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <button 
            onClick={handleToggleSelectAll}
            className="flex items-center gap-2 text-sm font-bold text-info hover:text-info/80 transition-colors"
          >
            {selecionados.length === entregasFiltradas.length ? (
              <CheckSquare size={18} className="text-info" />
            ) : (
              <Square size={18} className="text-text-tertiary" />
            )}
            Selecionar Tudo
          </button>
          
          <span className="text-xs font-bold text-text-tertiary">
            {entregasFiltradas.length} resultados
          </span>
        </div>
      )}

      {/* Lista */}
      <div className="space-y-2">
        {entregasFiltradas.map(entrega => {
          const isSelected = selecionados.includes(entrega.id);
          return (
            <div 
              key={entrega.id} 
              className={cn(
                "glass-panel p-3 rounded-xl flex items-center justify-between transition-all border",
                isSelected ? "border-info bg-info/5" : "border-transparent"
              )}
            >
              <div 
                className="flex items-center gap-3 flex-1 min-w-0 pr-4 cursor-pointer"
                onClick={() => handleToggleRow(entrega.id)}
              >
                <div className="text-info/80">
                  {isSelected ? <CheckSquare size={20} /> : <Square size={20} className="text-text-tertiary" />}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-sm">NF {entrega.nota}</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-background-secondary rounded text-text-secondary">
                      {entrega.placa}
                    </span>
                    {entrega.carga && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-background-secondary rounded text-text-secondary">
                        C: {entrega.carga}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary truncate">{entrega.cliente}</p>
                </div>
              </div>
              
              <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <Toggle 
                  checked={entrega.canhoto} 
                  onChange={() => toggleCanhoto(entrega.id)} 
                />
              </div>
            </div>
          );
        })}
        
        {entregasFiltradas.length === 0 && (
          <div className="text-center py-10 text-text-tertiary">
            <p className="text-sm">Nenhum canhoto encontrado com estes filtros.</p>
          </div>
        )}
      </div>

      {/* Floating Action Bar */}
      {selecionados.length > 0 && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-slate-900 shadow-2xl rounded-2xl p-3 flex items-center justify-between z-50 animate-fade-in border border-slate-700">
          <span className="text-white font-bold text-sm ml-2">
            {selecionados.length} selecionado{selecionados.length > 1 ? 's' : ''}
          </span>
          <div className="flex gap-2">
            <button 
              onClick={handleMassaRecebidos}
              className="bg-success text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shadow-lg shadow-success/20 hover:bg-success/90 transition-colors"
            >
              <Check size={14} /> Recebidos
            </button>
            <button 
              onClick={handleMassaPendentes}
              className="bg-slate-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-slate-600 transition-colors"
            >
              <X size={14} /> Pendentes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
