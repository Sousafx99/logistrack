import { useState, useMemo, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Download, Filter, Camera } from 'lucide-react';
import { toPng } from 'html-to-image';

export function Relatorios() {
  const { entregas, globalFilters, setGlobalFilters } = useStore();
  const reportRef = useRef(null);
  
  const placaSelecionada = globalFilters.relatorios.placa;
  const cargaSelecionada = globalFilters.relatorios.carga;
  const rcaSelecionado = globalFilters.relatorios.rca;
  const dataSelecionada = globalFilters.data;
  const statusSelecionado = globalFilters.relatorios.status;

  const setPlacaSelecionada = (val) => setGlobalFilters({ relatorios: { ...globalFilters.relatorios, placa: val } });
  const setCargaSelecionada = (val) => setGlobalFilters({ relatorios: { ...globalFilters.relatorios, carga: val } });
  const setRcaSelecionado = (val) => setGlobalFilters({ relatorios: { ...globalFilters.relatorios, rca: val } });
  const setDataSelecionada = (val) => setGlobalFilters({ data: val });
  const setStatusSelecionado = (val) => setGlobalFilters({ relatorios: { ...globalFilters.relatorios, status: val } });
  
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
      const matchPlaca = placaSelecionada ? e.placa === placaSelecionada : true;
      const matchCarga = cargaSelecionada ? e.carga === cargaSelecionada : true;
      const matchRca = rcaSelecionado ? e.rca === rcaSelecionado : true;
      const matchData = dataSelecionada ? e.data === dataSelecionada : true;
      const matchStatus = statusSelecionado ? e.status === statusSelecionado : true;
      return matchPlaca && matchCarga && matchRca && matchData && matchStatus;
    });
  }, [entregas, placaSelecionada, cargaSelecionada, rcaSelecionado, dataSelecionada, statusSelecionado]);

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
      const dataStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      let nomeBase = 'Relatorio_Entregas';
      if (placaSelecionada) nomeBase += `_Placa-${placaSelecionada}`;
      if (cargaSelecionada) nomeBase += `_Carga-${cargaSelecionada}`;
      
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
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Relatórios</h2>
          <p className="text-sm text-text-secondary mt-1">Gere imagens de acompanhamento da operação.</p>
        </div>
        
        <button 
          onClick={handleExportImage}
          disabled={isExporting || entregasFiltradas.length === 0}
          className="bg-info hover:bg-info/90 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          {isExporting ? <Camera className="w-5 h-5 animate-pulse" /> : <Download className="w-5 h-5" />}
          {isExporting ? 'Gerando...' : 'Exportar Imagem'}
        </button>
      </div>

      {/* Painel de Filtros */}
      <div className="glass-panel p-5 rounded-2xl">
        <div className="flex items-center text-xs uppercase font-bold text-text-tertiary mb-3">
          <Filter size={14} className="mr-1" /> Selecione os Filtros para o Relatório
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-bold text-text-secondary mb-1">Data</label>
            <select 
              value={dataSelecionada}
              onChange={(e) => setDataSelecionada(e.target.value)}
              className="w-full bg-background-secondary border-none rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-info"
            >
              <option value="">Todas</option>
              {opcoesFiltro.datas.map(d => {
                const parts = d.split('-');
                const display = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d;
                return <option key={d} value={d}>{display}</option>;
              })}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-text-secondary mb-1">Status</label>
            <select 
              value={statusSelecionado}
              onChange={(e) => setStatusSelecionado(e.target.value)}
              className="w-full bg-background-secondary border-none rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-info"
            >
              <option value="">Todos</option>
              {opcoesFiltro.status.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-text-secondary mb-1">Placa</label>
            <select 
              value={placaSelecionada}
              onChange={(e) => setPlacaSelecionada(e.target.value)}
              className="w-full bg-background-secondary border-none rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-info"
            >
              <option value="">Todas</option>
              {opcoesFiltro.placas.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-text-secondary mb-1">Carga</label>
            <select 
              value={cargaSelecionada}
              onChange={(e) => setCargaSelecionada(e.target.value)}
              className="w-full bg-background-secondary border-none rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-info"
            >
              <option value="">Todas</option>
              {opcoesFiltro.cargas.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-text-secondary mb-1">RCA</label>
            <select 
              value={rcaSelecionado}
              onChange={(e) => setRcaSelecionado(e.target.value)}
              className="w-full bg-background-secondary border-none rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-info"
            >
              <option value="">Todos</option>
              {opcoesFiltro.rcas.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Área de Visualização e Impressão do Relatório */}
      <div className="bg-white overflow-hidden rounded-xl shadow-sm border border-slate-200">
        <div 
          ref={reportRef} 
          className="p-6 bg-white w-full"
          style={{ minWidth: '800px' }} // Garante que não quebre em telas pequenas na hora do print
        >
          {/* Cabeçalho do Relatório */}
          <div className="border-b-2 border-slate-800 pb-4 mb-4 flex justify-between items-end">
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Status de Entregas</h1>
              <div className="text-sm text-slate-600 mt-1 font-medium flex gap-4">
                {placaSelecionada && <span>Placa: <span className="text-slate-900">{placaSelecionada}</span></span>}
                {cargaSelecionada && <span>Carga: <span className="text-slate-900">{cargaSelecionada}</span></span>}
                {rcaSelecionado && <span>RCA: <span className="text-slate-900">{rcaSelecionado}</span></span>}
                {!placaSelecionada && !cargaSelecionada && !rcaSelecionado && <span>Visão Geral</span>}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Data de Emissão</p>
              <p className="text-sm font-bold text-slate-900">{new Date().toLocaleString('pt-BR')}</p>
            </div>
          </div>

          {/* Tabela */}
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="py-2.5 px-3 font-bold border-b border-slate-200">NF</th>
                <th className="py-2.5 px-3 font-bold border-b border-slate-200">Cliente</th>
                <th className="py-2.5 px-3 font-bold border-b border-slate-200">Localidade</th>
                <th className="py-2.5 px-3 font-bold border-b border-slate-200">RCA</th>
                <th className="py-2.5 px-3 font-bold border-b border-slate-200">Placa</th>
                <th className="py-2.5 px-3 font-bold border-b border-slate-200">Status</th>
              </tr>
            </thead>
            <tbody>
              {entregasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-500 font-medium">
                    Nenhuma entrega encontrada para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                entregasFiltradas.map((e, index) => {
                  
                  // Definir cor de status simplificada para impressão
                  let statusColor = "text-slate-600 bg-slate-100";
                  if (e.status === 'Recebido') statusColor = "text-green-700 bg-green-100 font-bold";
                  if (e.status === 'Devolução total' || e.status === 'Entrega parcial') statusColor = "text-red-700 bg-red-100 font-bold";
                  if (e.status === 'Reentrega') statusColor = "text-orange-700 bg-orange-100 font-bold";
                  if (e.status === 'Em conferência') statusColor = "text-blue-700 bg-blue-100 font-bold";

                  return (
                    <tr key={e.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="py-2 px-3 border-b border-slate-100 font-semibold text-slate-900">
                        {e.nota}
                      </td>
                      <td className="py-2 px-3 border-b border-slate-100">
                        <span className="text-slate-500 text-xs mr-1">{e.codCliente}</span>
                        <span className="text-slate-800 font-medium truncate max-w-[200px] block">{e.cliente}</span>
                      </td>
                      <td className="py-2 px-3 border-b border-slate-100">
                        <span className="text-slate-800 block truncate max-w-[150px]">{e.bairro}</span>
                        {e.cidade && <span className="text-slate-500 text-xs truncate block">{e.cidade}</span>}
                      </td>
                      <td className="py-2 px-3 border-b border-slate-100 text-slate-600 truncate max-w-[120px]">
                        {e.rca}
                      </td>
                      <td className="py-2 px-3 border-b border-slate-100 text-slate-800 font-medium">
                        {e.placa}
                      </td>
                      <td className="py-2 px-3 border-b border-slate-100">
                        <span className={`px-2 py-0.5 rounded text-xs ${statusColor}`}>
                          {e.status}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
          
          <div className="mt-6 pt-4 border-t border-slate-200 flex justify-between text-xs text-slate-500 font-medium">
            <p>Total de Entregas: {entregasFiltradas.length}</p>
            <p>Gerado via LogisTrack</p>
          </div>
        </div>
      </div>
    </div>
  );
}
