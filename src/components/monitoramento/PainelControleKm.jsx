import { useState, useMemo } from 'react';
import { 
  Gauge, TrendingUp, TrendingDown, CheckCircle2, Clock, AlertTriangle, 
  Search, Edit3, Camera, FileText, ArrowRight, Download, Filter, X, Check, Truck, User
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';
import { KmRegistroModal } from '../motorista/KmRegistroModal';

export function PainelControleKm({ datasEfetivas: propDatasEfetivas, mostraTodas: propMostraTodas, placasSelecionadas: propPlacas, buscaTexto: propBusca }) {
  const { entregas, motoristas, kmRegistros, globalFilters, setGlobalFilters, salvarKmPrevisto, salvarKmRegistro } = useStore();

  const isStandalone = propDatasEfetivas === undefined;
  const [dataSelecionadaLocal, setDataSelecionadaLocal] = useState(globalFilters.data);
  const [placaSelecionadaLocal, setPlacaSelecionadaLocal] = useState('');
  const [buscaTextoLocal, setBuscaTextoLocal] = useState('');
  const [mostraTodasLocal, setMostraTodasLocal] = useState(false);

  const datasEfetivas = isStandalone ? (mostraTodasLocal ? [] : [dataSelecionadaLocal]) : propDatasEfetivas;
  const mostraTodas = isStandalone ? mostraTodasLocal : propMostraTodas;
  const placasSelecionadas = isStandalone ? (placaSelecionadaLocal ? [placaSelecionadaLocal] : []) : (propPlacas || []);
  const buscaTexto = isStandalone ? buscaTextoLocal : (propBusca || '');

  const [modalEdicaoKm, setModalEdicaoKm] = useState(null); // { data, placa, carga }
  const [salvandoPrevistoId, setSalvandoPrevistoId] = useState(null);
  const [previstoValoresLocais, setPrevistoValoresLocais] = useState({});
  const [fotoVisualizando, setFotoVisualizando] = useState(null);

  // Mapeia todas as rotas (data + placa + carga) existentes com base nas entregas
  const rotas = useMemo(() => {
    let subset = mostraTodas ? entregas : entregas.filter(e => datasEfetivas.includes(e.data));
    
    if (placasSelecionadas.length > 0) {
      subset = subset.filter(e => placasSelecionadas.includes((e.placa || '').trim().toUpperCase()));
    }

    const map = new Map();
    subset.forEach(e => {
      const p = (e.placa || '').trim().toUpperCase();
      if (!p || p === 'SEM PLACA') return;
      const c = e.carga || 'Sem Carga';
      const d = e.data || 'Sem Data';
      const key = `${d}_${p.replace(/[\/\\]/g, '-')}_${c.replace(/[\/\\]/g, '-')}`;

      if (!map.has(key)) {
        map.set(key, {
          id: key,
          data: d,
          placa: p,
          carga: c,
          totalNotas: 0,
          entregues: 0,
          pendentes: 0
        });
      }

      const r = map.get(key);
      r.totalNotas += 1;
      if (['Entrega total', 'Entrega parcial', 'Devolução total', 'Reentrega', 'Carga parada'].includes(e.status)) {
        r.entregues += 1;
      } else {
        r.pendentes += 1;
      }
    });

    const list = Array.from(map.values()).map(rota => {
      const reg = (kmRegistros || []).find(k => k.id === rota.id) || {};
      const motorista = (motoristas || []).find(m => (m.placa || '').trim().toUpperCase() === rota.placa);

      const kmInicial = reg.kmInicial !== null && reg.kmInicial !== undefined ? Number(reg.kmInicial) : null;
      const kmFinal = reg.kmFinal !== null && reg.kmFinal !== undefined ? Number(reg.kmFinal) : null;
      const kmPrevisto = reg.kmPrevisto !== null && reg.kmPrevisto !== undefined ? Number(reg.kmPrevisto) : null;
      
      let kmExecutado = null;
      if (kmInicial !== null && kmFinal !== null && kmFinal >= kmInicial) {
        kmExecutado = kmFinal - kmInicial;
      }

      let diferencaKm = null;
      let percentualVar = null;
      if (kmExecutado !== null && kmPrevisto !== null && kmPrevisto > 0) {
        diferencaKm = kmExecutado - kmPrevisto;
        percentualVar = Math.round((diferencaKm / kmPrevisto) * 100);
      }

      return {
        ...rota,
        motoristaNome: motorista?.nome || reg.motoristaNome || 'Não cadastrado',
        motoristaTel: motorista?.whatsapp || '',
        kmPrevisto,
        kmInicial,
        kmFinal,
        kmExecutado,
        diferencaKm,
        percentualVar,
        fotoKmInicial: reg.fotoKmInicial || null,
        fotoKmFinal: reg.fotoKmFinal || null,
        observacao: reg.observacao || '',
        dataHoraInicio: reg.dataHoraInicio || null,
        dataHoraFim: reg.dataHoraFim || null,
        statusViagem: kmFinal !== null ? 'Finalizada' : kmInicial !== null ? 'Em Rota' : 'Pendente'
      };
    });

    if (buscaTexto && buscaTexto.trim()) {
      const term = buscaTexto.toLowerCase();
      return list.filter(r => 
        r.placa.toLowerCase().includes(term) ||
        r.carga.toLowerCase().includes(term) ||
        r.motoristaNome.toLowerCase().includes(term)
      );
    }

    return list.sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')) || a.placa.localeCompare(b.placa));
  }, [entregas, kmRegistros, motoristas, datasEfetivas, mostraTodas, placasSelecionadas, buscaTexto]);

  // Métricas consolidadas
  const kpis = useMemo(() => {
    let totalPrevisto = 0;
    let totalExecutado = 0;
    let totalRotasFinalizadasComPrevisto = 0;
    let totalRotasFechadas = 0;
    let totalRotasEmRota = 0;
    let totalRotasPendentes = 0;

    rotas.forEach(r => {
      if (r.kmPrevisto !== null && r.kmPrevisto > 0) {
        totalPrevisto += r.kmPrevisto;
      }
      if (r.kmExecutado !== null && r.kmExecutado > 0) {
        totalExecutado += r.kmExecutado;
        if (r.kmPrevisto !== null && r.kmPrevisto > 0) {
          totalRotasFinalizadasComPrevisto += 1;
        }
      }

      if (r.statusViagem === 'Finalizada') totalRotasFechadas += 1;
      else if (r.statusViagem === 'Em Rota') totalRotasEmRota += 1;
      else totalRotasPendentes += 1;
    });

    const diferencaGeral = totalExecutado > 0 && totalPrevisto > 0 ? totalExecutado - totalPrevisto : null;
    const percGeral = (diferencaGeral !== null && totalPrevisto > 0) ? Math.round((diferencaGeral / totalPrevisto) * 100) : null;

    return {
      totalRotas: rotas.length,
      totalPrevisto,
      totalExecutado,
      diferencaGeral,
      percGeral,
      totalRotasFechadas,
      totalRotasEmRota,
      totalRotasPendentes
    };
  }, [rotas]);

  const handleSalvarPrevistoInline = async (rota, valor) => {
    const num = valor !== '' ? Number(valor) : null;
    setSalvandoPrevistoId(rota.id);
    try {
      await salvarKmPrevisto(rota.data, rota.placa, rota.carga, num);
    } catch (e) {
      console.error(e);
    } finally {
      setSalvandoPrevistoId(null);
    }
  };

  return (
    <div className="space-y-4 w-full animate-in fade-in">
      
      {/* Barra de Filtros (Modo Standalone) */}
      {isStandalone && (
        <div className="glass-panel p-4 rounded-xl space-y-3 border border-border-secondary shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase text-text-tertiary">Data:</span>
              <button
                onClick={() => setMostraTodasLocal(!mostraTodasLocal)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                  mostraTodasLocal 
                    ? "bg-primary text-white border-primary shadow-sm" 
                    : "bg-background-secondary text-text-secondary border-border-tertiary"
                )}
              >
                Todas as Datas
              </button>
              {!mostraTodasLocal && (
                <input 
                  type="date"
                  value={dataSelecionadaLocal}
                  onChange={(e) => setDataSelecionadaLocal(e.target.value)}
                  className="bg-background-secondary border border-border-secondary text-text-primary rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none focus:ring-1 focus:ring-info"
                />
              )}
            </div>

            <div className="flex items-center gap-2 flex-1 max-w-xs min-w-[200px]">
              <div className="flex items-center bg-background-secondary border border-border-secondary rounded-lg px-2.5 py-1.5 w-full focus-within:ring-1 focus-within:ring-info">
                <Search size={14} className="text-text-tertiary mr-2 flex-shrink-0" />
                <input 
                  type="text"
                  placeholder="Buscar veículo, motorista ou carga..."
                  value={buscaTextoLocal}
                  onChange={(e) => setBuscaTextoLocal(e.target.value)}
                  className="bg-transparent text-xs text-text-primary w-full outline-none placeholder:text-text-tertiary"
                />
                {buscaTextoLocal && (
                  <button onClick={() => setBuscaTextoLocal('')} className="text-text-tertiary hover:text-text-primary">
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cards de Indicadores (KPIs) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        
        {/* Total Previsto */}
        <div className="glass-panel p-4 rounded-xl border border-border-secondary shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-tertiary uppercase">KM Previsto Total</span>
            <div className="p-2 bg-info/10 text-info rounded-lg">
              <Gauge size={18} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-text-primary">
              {kpis.totalPrevisto > 0 ? kpis.totalPrevisto.toLocaleString('pt-BR') : '--'}
            </span>
            <span className="text-xs font-bold text-text-tertiary">km</span>
          </div>
          <span className="text-[11px] text-text-secondary mt-1 block">Meta estipulada no dia</span>
        </div>

        {/* Total Executado */}
        <div className="glass-panel p-4 rounded-xl border border-border-secondary shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-tertiary uppercase">KM Executado Real</span>
            <div className="p-2 bg-success/10 text-success rounded-lg">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-success">
              {kpis.totalExecutado > 0 ? kpis.totalExecutado.toLocaleString('pt-BR') : '--'}
            </span>
            <span className="text-xs font-bold text-text-tertiary">km</span>
          </div>
          <span className="text-[11px] text-text-secondary mt-1 block">
            {kpis.totalRotasFechadas} de {kpis.totalRotas} rotas finalizadas
          </span>
        </div>

        {/* Desvio / Variação */}
        <div className="glass-panel p-4 rounded-xl border border-border-secondary shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-tertiary uppercase">Variação / Desvio</span>
            <div className={cn(
              "p-2 rounded-lg",
              kpis.diferencaGeral === null 
                ? "bg-background-secondary text-text-tertiary"
                : kpis.diferencaGeral > 0 
                  ? "bg-danger/10 text-danger" 
                  : "bg-success/10 text-success"
            )}>
              {kpis.diferencaGeral !== null && kpis.diferencaGeral > 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className={cn(
              "text-2xl font-black",
              kpis.diferencaGeral === null 
                ? "text-text-tertiary" 
                : kpis.diferencaGeral > 0 
                  ? "text-danger" 
                  : "text-success"
            )}>
              {kpis.diferencaGeral !== null ? (kpis.diferencaGeral > 0 ? `+${kpis.diferencaGeral.toLocaleString('pt-BR')}` : kpis.diferencaGeral.toLocaleString('pt-BR')) : '--'}
            </span>
            <span className="text-xs font-bold text-text-tertiary">km</span>
            {kpis.percGeral !== null && (
              <span className={cn(
                "text-xs font-bold px-1.5 py-0.5 rounded ml-1",
                kpis.diferencaGeral > 0 ? "bg-danger/10 text-danger" : "bg-success/10 text-success"
              )}>
                {kpis.percGeral > 0 ? `+${kpis.percGeral}%` : `${kpis.percGeral}%`}
              </span>
            )}
          </div>
          <span className="text-[11px] text-text-secondary mt-1 block">
            {kpis.diferencaGeral !== null ? (kpis.diferencaGeral > 0 ? 'Excesso sobre a previsão' : 'Economia em relação à meta') : 'Sem comparativo completo'}
          </span>
        </div>

        {/* Status de Preenchimento */}
        <div className="glass-panel p-4 rounded-xl border border-border-secondary shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-tertiary uppercase">Status Frota KM</span>
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <Truck size={18} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <div className="flex items-center gap-1 text-success font-black text-lg">
              <span>{kpis.totalRotasFechadas}</span>
              <span className="text-[10px] text-text-tertiary font-bold">Fim</span>
            </div>
            <span className="text-text-tertiary">•</span>
            <div className="flex items-center gap-1 text-info font-black text-lg">
              <span>{kpis.totalRotasEmRota}</span>
              <span className="text-[10px] text-text-tertiary font-bold">Rota</span>
            </div>
            <span className="text-text-tertiary">•</span>
            <div className="flex items-center gap-1 text-warning font-black text-lg">
              <span>{kpis.totalRotasPendentes}</span>
              <span className="text-[10px] text-text-tertiary font-bold">S/ KM</span>
            </div>
          </div>
          <span className="text-[11px] text-text-secondary mt-1 block">Acompanhamento operacional</span>
        </div>

      </div>

      {/* Tabela de Extrato de KM */}
      <div className="glass-panel rounded-xl border border-border-secondary shadow-sm overflow-hidden">
        
        <div className="p-4 border-b border-border-secondary flex flex-wrap justify-between items-center gap-2">
          <div>
            <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <Gauge size={16} className="text-info" />
              Extrato e Comparativo de KM por Rota ({rotas.length})
            </h3>
            <p className="text-xs text-text-tertiary mt-0.5">
              Digite a previsão de KM de cada veículo e acompanhe o hodômetro preenchido pelos motoristas em tempo real.
            </p>
          </div>
        </div>

        {rotas.length === 0 ? (
          <div className="p-8 text-center text-text-tertiary">
            <AlertTriangle className="mx-auto h-10 w-10 mb-2 opacity-30 text-warning" />
            <p className="text-sm font-bold">Nenhuma rota encontrada para os filtros selecionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-background-secondary/50 border-b border-border-secondary text-[11px] font-bold text-text-tertiary uppercase tracking-wider">
                  <th className="py-3 px-4">Veículo / Motorista</th>
                  <th className="py-3 px-3">Carga / Data</th>
                  <th className="py-3 px-3 text-right">KM Previsto</th>
                  <th className="py-3 px-3 text-right">KM Inicial</th>
                  <th className="py-3 px-3 text-right">KM Final</th>
                  <th className="py-3 px-3 text-right">KM Rodado</th>
                  <th className="py-3 px-3 text-center">Variação / Extrato</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-tertiary text-xs">
                {rotas.map(rota => {
                  const valorInput = previstoValoresLocais[rota.id] !== undefined 
                    ? previstoValoresLocais[rota.id] 
                    : (rota.kmPrevisto !== null ? String(rota.kmPrevisto) : '');

                  return (
                    <tr key={rota.id} className="hover:bg-background-secondary/30 transition-colors">
                      
                      {/* Veículo e Motorista */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-text-primary px-2 py-0.5 bg-background-primary rounded border border-border-secondary text-xs">
                            {rota.placa}
                          </span>
                        </div>
                        <div className="text-[11px] text-text-secondary mt-1 flex items-center gap-1 font-medium truncate max-w-[180px]">
                          <User size={12} className="text-text-tertiary flex-shrink-0" />
                          <span className="truncate">{rota.motoristaNome}</span>
                        </div>
                      </td>

                      {/* Carga e Data */}
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-text-primary">
                          Carga: <span className="text-info">{rota.carga}</span>
                        </div>
                        <div className="text-[10px] text-text-tertiary mt-0.5">
                          {new Date(rota.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })} • {rota.entregues}/{rota.totalNotas} NFs
                        </div>
                      </td>

                      {/* KM Previsto (Com Edição Rápida) */}
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="relative max-w-[110px]">
                            <input
                              type="number"
                              inputMode="numeric"
                              step="1"
                              placeholder="Previsto"
                              value={valorInput}
                              onChange={(e) => setPrevistoValoresLocais(prev => ({ ...prev, [rota.id]: e.target.value }))}
                              onBlur={(e) => handleSalvarPrevistoInline(rota, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.target.blur();
                                }
                              }}
                              className="w-full bg-background-primary border border-border-secondary focus:border-info focus:ring-1 focus:ring-info rounded-lg px-2 py-1 text-right text-xs font-bold text-text-primary outline-none transition-all"
                            />
                          </div>
                          <span className="text-[10px] text-text-tertiary font-bold">km</span>
                        </div>
                        {salvandoPrevistoId === rota.id && (
                          <span className="text-[9px] text-info block mt-0.5">Salvando...</span>
                        )}
                      </td>

                      {/* KM Inicial */}
                      <td className="py-3.5 px-3 text-right">
                        {rota.kmInicial !== null ? (
                          <div>
                            <div className="font-black text-text-primary text-xs flex items-center justify-end gap-1">
                              <span>{rota.kmInicial.toLocaleString('pt-BR')}</span>
                              <span className="text-[10px] text-text-tertiary font-bold">km</span>
                              {rota.fotoKmInicial && (
                                <button
                                  onClick={() => setFotoVisualizando({ titulo: `KM Inicial - ${rota.placa}`, foto: rota.fotoKmInicial })}
                                  className="text-info hover:text-info/80 p-0.5"
                                  title="Ver foto do painel"
                                >
                                  <Camera size={13} />
                                </button>
                              )}
                            </div>
                            {rota.dataHoraInicio && (
                              <span className="text-[9px] text-text-tertiary block">
                                {new Date(rota.dataHoraInicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-warning font-bold bg-warning/10 px-2 py-0.5 rounded border border-warning/20">
                            Pendente
                          </span>
                        )}
                      </td>

                      {/* KM Final */}
                      <td className="py-3.5 px-3 text-right">
                        {rota.kmFinal !== null ? (
                          <div>
                            <div className="font-black text-text-primary text-xs flex items-center justify-end gap-1">
                              <span>{rota.kmFinal.toLocaleString('pt-BR')}</span>
                              <span className="text-[10px] text-text-tertiary font-bold">km</span>
                              {rota.fotoKmFinal && (
                                <button
                                  onClick={() => setFotoVisualizando({ titulo: `KM Final - ${rota.placa}`, foto: rota.fotoKmFinal })}
                                  className="text-info hover:text-info/80 p-0.5"
                                  title="Ver foto do painel"
                                >
                                  <Camera size={13} />
                                </button>
                              )}
                            </div>
                            {rota.dataHoraFim && (
                              <span className="text-[9px] text-text-tertiary block">
                                {new Date(rota.dataHoraFim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        ) : rota.kmInicial !== null ? (
                          <span className="text-[11px] text-info font-bold bg-info/10 px-2 py-0.5 rounded border border-info/20">
                            Em Rota
                          </span>
                        ) : (
                          <span className="text-[11px] text-text-tertiary font-medium">--</span>
                        )}
                      </td>

                      {/* KM Rodado (Executado) */}
                      <td className="py-3.5 px-3 text-right">
                        {rota.kmExecutado !== null ? (
                          <div className="font-black text-sm text-success flex items-baseline justify-end gap-1">
                            <span>{rota.kmExecutado.toLocaleString('pt-BR')}</span>
                            <span className="text-[10px] text-text-tertiary font-bold">km</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-text-tertiary font-medium">--</span>
                        )}
                      </td>

                      {/* Variação / Extrato */}
                      <td className="py-3.5 px-3 text-center">
                        {rota.diferencaKm !== null ? (
                          <div className="inline-flex flex-col items-center">
                            <span className={cn(
                              "text-xs font-black px-2.5 py-0.5 rounded-full border flex items-center gap-1",
                              rota.diferencaKm > 0 
                                ? "bg-danger/15 text-danger border-danger/30" 
                                : "bg-success/15 text-success border-success/30"
                            )}>
                              {rota.diferencaKm > 0 ? `+${rota.diferencaKm} km` : `${rota.diferencaKm} km`}
                              {rota.percentualVar !== null && (
                                <span className="text-[10px] opacity-80">
                                  ({rota.percentualVar > 0 ? `+${rota.percentualVar}%` : `${rota.percentualVar}%`})
                                </span>
                              )}
                            </span>
                            <span className="text-[9px] text-text-tertiary mt-0.5 font-bold">
                              {rota.diferencaKm > 0 ? 'Excesso' : 'Econômico'}
                            </span>
                          </div>
                        ) : rota.kmExecutado !== null && !rota.kmPrevisto ? (
                          <span className="text-[10px] text-text-tertiary font-medium bg-background-primary px-2 py-0.5 rounded border border-border-secondary">
                            Sem meta prevista
                          </span>
                        ) : (
                          <span className="text-[10px] text-text-tertiary font-medium">
                            Aguardando conclusão
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => setModalEdicaoKm(rota)}
                          className="p-1.5 bg-background-primary hover:bg-background-secondary text-text-secondary hover:text-info border border-border-secondary rounded-lg transition-colors shadow-sm"
                          title="Ajustar / Editar KM deste veículo"
                        >
                          <Edit3 size={14} />
                        </button>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Modal de Edição Completa pelo Monitoramento */}
      {modalEdicaoKm && (
        <KmRegistroModal
          isOpen={true}
          onClose={() => setModalEdicaoKm(null)}
          data={modalEdicaoKm.data}
          placa={modalEdicaoKm.placa}
          carga={modalEdicaoKm.carga}
          modo="ajuste"
          onSuccess={() => setModalEdicaoKm(null)}
        />
      )}

      {/* Modal de Inspeção de Foto do Painel */}
      {fotoVisualizando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-5 border border-border-secondary shadow-2xl relative flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Camera size={16} className="text-info" />
                {fotoVisualizando.titulo}
              </h3>
              <button 
                onClick={() => setFotoVisualizando(null)}
                className="text-text-tertiary hover:text-text-primary p-1 rounded-full hover:bg-background-secondary"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto rounded-xl border border-border-secondary bg-black/40 flex items-center justify-center p-2">
              <img 
                src={fotoVisualizando.foto} 
                alt="Foto do Painel" 
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg" 
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
