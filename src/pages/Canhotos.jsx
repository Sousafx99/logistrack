import { useState, useMemo } from 'react';
import { Search, Filter, CheckSquare, Square, Check, X, Camera, Eye, Image as ImageIcon } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Toggle } from '../components/ui/Toggle';
import { cn } from '../lib/utils';

export function Canhotos() {
  const { entregas, toggleCanhoto, toggleCanhotoEmMassa, globalFilters, setGlobalFilters, cargasFinalizadas } = useStore();
  const [canhoteiraVisualizando, setCanhoteiraVisualizando] = useState(null);

  
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

  const canhoteirasDoDia = useMemo(() => {
    return (cargasFinalizadas || []).filter(cf => {
      const matchData = cf.data === dataSelecionada;
      const matchPlaca = placaSelecionada ? cf.placa === placaSelecionada : true;
      const matchCarga = cargaSelecionada ? cf.carga === cargaSelecionada : true;
      return matchData && matchPlaca && matchCarga;
    });
  }, [cargasFinalizadas, dataSelecionada, placaSelecionada, cargaSelecionada]);

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

      {/* Canhoteiras Físicas Enviadas pelos Motoristas */}
      {canhoteirasDoDia.length > 0 && (
        <div className="glass-panel p-4 rounded-xl space-y-2 border border-success/30 bg-success/5 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-success flex items-center gap-1.5 uppercase">
              <Camera size={16} /> Canhoteiras Físicas Finalizadas ({canhoteirasDoDia.length})
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
            {canhoteirasDoDia.map((cf, idx) => (
              <div 
                key={cf.id || idx}
                onClick={() => setCanhoteiraVisualizando(cf)}
                className="bg-background-primary p-2.5 rounded-lg border border-border-secondary flex items-center justify-between hover:border-success/50 cursor-pointer transition-all shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-background-secondary flex items-center justify-center overflow-hidden flex-shrink-0 border border-border-secondary">
                    {cf.fotoUrl || cf.fotoBase64 ? (
                      <img src={cf.fotoUrl || cf.fotoBase64} alt="Canhoteira" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={18} className="text-text-tertiary" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-text-primary">
                      Placa: {cf.placa || 'N/A'} {cf.carga ? `• Carga ${cf.carga}` : ''}
                    </div>
                    <div className="text-[10px] text-text-secondary">
                      {cf.finalizadoEm ? new Date(cf.finalizadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Finalizada'}
                    </div>
                  </div>
                </div>
                <button className="text-xs font-bold text-info hover:text-info/80 flex items-center gap-1 px-2.5 py-1.5 bg-info/10 rounded-lg transition-colors">
                  <Eye size={14} /> Ver Foto
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* Modal de Visualização da Canhoteira */}
      {canhoteiraVisualizando && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-background-primary rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-border-secondary">
            <div className="p-4 border-b border-border-secondary flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-text-primary">Canhoteira Física da Rota</h3>
                <p className="text-xs text-text-secondary">
                  Placa: <strong className="text-text-primary">{canhoteiraVisualizando.placa || 'N/A'}</strong> | Carga: <strong className="text-text-primary">{canhoteiraVisualizando.carga || 'Sem Carga'}</strong> | Data: <strong className="text-text-primary">{canhoteiraVisualizando.data}</strong>
                </p>
              </div>
              <button 
                onClick={() => setCanhoteiraVisualizando(null)}
                className="p-1.5 rounded-lg hover:bg-background-secondary text-text-tertiary hover:text-text-primary transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/30">
              <img 
                src={canhoteiraVisualizando.fotoUrl || canhoteiraVisualizando.fotoBase64} 
                alt="Foto da Canhoteira" 
                className="max-w-full max-h-[65vh] rounded-lg shadow-lg object-contain"
              />
            </div>
            <div className="p-3 border-t border-border-secondary flex items-center justify-between bg-background-secondary/30">
              <span className="text-xs text-text-secondary">
                {canhoteiraVisualizando.finalizadoEm ? `Enviado em: ${new Date(canhoteiraVisualizando.finalizadoEm).toLocaleString('pt-BR')}` : ''}
              </span>
              <button
                onClick={() => setCanhoteiraVisualizando(null)}
                className="px-4 py-2 bg-info text-white rounded-xl text-xs font-bold hover:bg-info/90 transition-colors shadow-sm"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

