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
          pendentes: 0,
          rotasSet: new Set()
        });
      }

      const r = map.get(key);
      r.totalNotas += 1;
      if (e.rota && String(e.rota).trim()) {
        r.rotasSet.add(String(e.rota).trim().toUpperCase());
      } else if (e.praca && String(e.praca).trim()) {
        r.rotasSet.add(String(e.praca).trim().toUpperCase());
      } else if (e.bairro && String(e.bairro).trim()) {
        r.rotasSet.add(String(e.bairro).trim().toUpperCase());
      }
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

      const rotasLista = Array.from(rota.rotasSet);

      return {
        ...rota,
        rotasCarro: rotasLista.length > 0 ? rotasLista.join(' / ') : '—',
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
        r.motoristaNome.toLowerCase().includes(term) ||
        r.rotasCarro.toLowerCase().includes(term)
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
                  placeholder="Buscar veículo, motorista, rota ou carga..."
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

      {/* Cards de Indicadores (KPIs) Compactos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Total Previsto */}
        <div className="glass-panel p-3 sm:p-3.5 rounded-xl border border-border-secondary shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-text-tertiary uppercase">KM Previsto</span>
            <Gauge size={15} className="text-info shrink-0" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-lg sm:text-xl font-black font-mono text-text-primary">
              {kpis.totalPrevisto > 0 ? kpis.totalPrevisto.toLocaleString('pt-BR') : '--'}
            </span>
            <span className="text-[10px] font-bold text-text-tertiary">km</span>
          </div>
        </div>

        {/* Total Executado */}
        <div className="glass-panel p-3 sm:p-3.5 rounded-xl border border-border-secondary shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-text-tertiary uppercase">KM Rodado</span>
            <CheckCircle2 size={15} className="text-success shrink-0" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-lg sm:text-xl font-black font-mono text-success">
              {kpis.totalExecutado > 0 ? kpis.totalExecutado.toLocaleString('pt-BR') : '--'}
            </span>
            <span className="text-[10px] font-bold text-text-tertiary">km</span>
          </div>
        </div>

        {/* Desvio / Variação */}
        <div className="glass-panel p-3 sm:p-3.5 rounded-xl border border-border-secondary shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-text-tertiary uppercase">Desvio</span>
            {kpis.diferencaGeral !== null && kpis.diferencaGeral > 0 ? (
              <TrendingUp size={15} className="text-danger shrink-0" />
            ) : (
              <TrendingDown size={15} className="text-success shrink-0" />
            )}
          </div>
          <div className="mt-1 flex items-baseline gap-1 flex-wrap">
            <span className={cn(
              "text-lg sm:text-xl font-black font-mono",
              kpis.diferencaGeral === null 
                ? "text-text-tertiary" 
                : kpis.diferencaGeral > 0 
                  ? "text-danger" 
                  : "text-success"
            )}>
              {kpis.diferencaGeral !== null ? (kpis.diferencaGeral > 0 ? `+${kpis.diferencaGeral.toLocaleString('pt-BR')}` : kpis.diferencaGeral.toLocaleString('pt-BR')) : '--'}
            </span>
            <span className="text-[10px] font-bold text-text-tertiary">km</span>
            {kpis.percGeral !== null && (
              <span className={cn(
                "text-[10px] font-bold px-1 py-0.2 rounded",
                kpis.diferencaGeral > 0 ? "bg-danger/10 text-danger" : "bg-success/10 text-success"
              )}>
                {kpis.percGeral > 0 ? `+${kpis.percGeral}%` : `${kpis.percGeral}%`}
              </span>
            )}
          </div>
        </div>

        {/* Status de Preenchimento */}
        <div className="glass-panel p-3 sm:p-3.5 rounded-xl border border-border-secondary shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-text-tertiary uppercase">Status Frota</span>
            <Truck size={15} className="text-primary shrink-0" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5 text-sm sm:text-base font-mono">
            <span className="text-success font-black" title="Finalizadas">{kpis.totalRotasFechadas}<small className="text-[9px] text-text-tertiary font-sans ml-0.5">Fim</small></span>
            <span className="text-text-tertiary">•</span>
            <span className="text-info font-black" title="Em Rota">{kpis.totalRotasEmRota}<small className="text-[9px] text-text-tertiary font-sans ml-0.5">Rota</small></span>
            <span className="text-text-tertiary">•</span>
            <span className="text-warning font-black" title="Sem KM">{kpis.totalRotasPendentes}<small className="text-[9px] text-text-tertiary font-sans ml-0.5">Pend</small></span>
          </div>
        </div>
      </div>

      {/* Planilha Unificada de Controle de KM */}
      <div className="bg-background-primary rounded-xl border border-border-secondary shadow-xs overflow-hidden">
        <div className="px-3.5 py-2.5 bg-background-secondary/60 border-b border-border-secondary flex flex-wrap justify-between items-center gap-2">
          <h3 className="text-xs sm:text-sm font-bold text-text-primary flex items-center gap-1.5">
            <Gauge size={15} className="text-info" />
            Planilha de Controle de KM ({rotas.length} rotas)
          </h3>
          <span className="text-[10px] text-text-tertiary">
            Clique no KM Previsto para editar direto na planilha
          </span>
        </div>

        {rotas.length === 0 ? (
          <div className="p-8 text-center text-text-tertiary">
            <AlertTriangle className="mx-auto h-8 w-8 mb-2 opacity-30 text-warning" />
            <p className="text-xs font-bold">Nenhuma rota encontrada para os filtros selecionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-center border-collapse text-[11px] sm:text-xs">
              <thead>
                <tr className="bg-background-secondary border-b border-border-secondary text-[10px] font-black text-text-secondary uppercase tracking-wider whitespace-nowrap select-none">
                  <th className="py-2.5 px-3 border-r border-border-secondary/60 text-center">Data</th>
                  <th className="py-2.5 px-3 border-r border-border-secondary/60 text-center">Placa</th>
                  <th className="py-2.5 px-3.5 border-r border-border-secondary/60 text-center">Motorista</th>
                  <th className="py-2.5 px-3.5 border-r border-border-secondary/60 text-center">Rotas</th>
                  <th className="py-2.5 px-3 border-r border-border-secondary/60 text-center">Carga</th>
                  <th className="py-2.5 px-2.5 border-r border-border-secondary/60 text-center">NFs</th>
                  <th className="py-2.5 px-3 border-r border-border-secondary/60 text-center">Status</th>
                  <th className="py-2.5 px-3 border-r border-border-secondary/60 text-center bg-info/5">KM Previsto</th>
                  <th className="py-2.5 px-3 border-r border-border-secondary/60 text-center">KM Inicial</th>
                  <th className="py-2.5 px-3 border-r border-border-secondary/60 text-center">KM Final</th>
                  <th className="py-2.5 px-3 border-r border-border-secondary/60 text-center">KM Rodado</th>
                  <th className="py-2.5 px-3 border-r border-border-secondary/60 text-center">Desvio</th>
                  <th className="py-2.5 px-2.5 text-center">Ajustar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-secondary">
                {rotas.map((rota, idx) => {
                  const valorInput = previstoValoresLocais[rota.id] !== undefined 
                    ? previstoValoresLocais[rota.id] 
                    : (rota.kmPrevisto !== null ? String(rota.kmPrevisto) : '');
                  const dataCurta = rota.data && rota.data.length >= 10 
                    ? `${rota.data.slice(8, 10)}/${rota.data.slice(5, 7)}` 
                    : rota.data;

                  return (
                    <tr 
                      key={rota.id} 
                      className={cn(
                        "transition-colors whitespace-nowrap",
                        idx % 2 === 0 ? "bg-background-primary" : "bg-background-secondary/25",
                        "hover:bg-info/5"
                      )}
                    >
                      {/* Data */}
                      <td className="py-2 px-3 text-center font-mono text-text-secondary border-r border-border-secondary/60">
                        {dataCurta}
                      </td>

                      {/* Placa */}
                      <td className="py-2 px-3 text-center border-r border-border-secondary/60">
                        <span className="font-mono font-black text-text-primary px-2 py-0.5 bg-background-secondary rounded border border-border-secondary text-[11px] inline-block">
                          {rota.placa}
                        </span>
                      </td>

                      {/* Motorista */}
                      <td className="py-2 px-3.5 text-center border-r border-border-secondary/60 max-w-[180px] truncate font-medium text-text-primary" title={rota.motoristaNome}>
                        {rota.motoristaNome}
                      </td>

                      {/* Rotas do Carro */}
                      <td className="py-2 px-3.5 text-center border-r border-border-secondary/60 max-w-[240px] truncate font-semibold text-text-secondary text-[11px]" title={rota.rotasCarro}>
                        {rota.rotasCarro}
                      </td>

                      {/* Carga */}
                      <td className="py-2 px-3 text-center font-mono font-bold text-info border-r border-border-secondary/60">
                        {rota.carga}
                      </td>

                      {/* NFs */}
                      <td className="py-2 px-2.5 text-center font-mono text-text-secondary border-r border-border-secondary/60">
                        {rota.entregues}/{rota.totalNotas}
                      </td>

                      {/* Status */}
                      <td className="py-2 px-3 text-center border-r border-border-secondary/60">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-black uppercase border inline-block",
                          rota.statusViagem === 'Finalizada'
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                            : rota.statusViagem === 'Em Rota'
                              ? "bg-blue-500/10 text-blue-500 border-blue-500/30"
                              : "bg-amber-500/10 text-amber-500 border-amber-500/30"
                        )}>
                          {rota.statusViagem}
                        </span>
                      </td>

                      {/* KM Previsto (Editável Inline) */}
                      <td className="py-1.5 px-3 text-center border-r border-border-secondary/60 bg-info/[0.03]">
                        <div className="inline-flex items-center justify-center gap-1">
                          <input
                            type="number"
                            inputMode="numeric"
                            step="1"
                            placeholder="—"
                            value={valorInput}
                            onChange={(e) => setPrevistoValoresLocais(prev => ({ ...prev, [rota.id]: e.target.value }))}
                            onBlur={(e) => handleSalvarPrevistoInline(rota, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') e.target.blur();
                            }}
                            className="w-20 bg-background-primary border border-border-secondary focus:border-info rounded px-1.5 py-0.5 text-center text-xs font-mono font-bold text-text-primary outline-none transition-all"
                          />
                          <span className="text-[10px] text-text-tertiary font-mono">km</span>
                        </div>
                      </td>

                      {/* KM Inicial */}
                      <td className="py-2 px-3 text-center font-mono border-r border-border-secondary/60">
                        {rota.kmInicial !== null ? (
                          <div className="inline-flex items-center justify-center gap-1">
                            <span className="font-bold text-text-primary">{rota.kmInicial.toLocaleString('pt-BR')}</span>
                            {rota.fotoKmInicial && (
                              <button
                                onClick={() => setFotoVisualizando({ titulo: `KM Inicial - ${rota.placa}`, foto: rota.fotoKmInicial })}
                                className="text-info hover:text-info/80 p-0.5 cursor-pointer"
                                title="Ver foto do painel inicial"
                              >
                                <Camera size={12} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-text-tertiary">—</span>
                        )}
                      </td>

                      {/* KM Final */}
                      <td className="py-2 px-3 text-center font-mono border-r border-border-secondary/60">
                        {rota.kmFinal !== null ? (
                          <div className="inline-flex items-center justify-center gap-1">
                            <span className="font-bold text-text-primary">{rota.kmFinal.toLocaleString('pt-BR')}</span>
                            {rota.fotoKmFinal && (
                              <button
                                onClick={() => setFotoVisualizando({ titulo: `KM Final - ${rota.placa}`, foto: rota.fotoKmFinal })}
                                className="text-info hover:text-info/80 p-0.5 cursor-pointer"
                                title="Ver foto do painel final"
                              >
                                <Camera size={12} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-text-tertiary">—</span>
                        )}
                      </td>

                      {/* KM Rodado */}
                      <td className="py-2 px-3 text-center font-mono font-black text-emerald-500 border-r border-border-secondary/60">
                        {rota.kmExecutado !== null ? `${rota.kmExecutado.toLocaleString('pt-BR')} km` : '—'}
                      </td>

                      {/* Desvio */}
                      <td className="py-2 px-3 text-center font-mono border-r border-border-secondary/60">
                        {rota.diferencaKm !== null ? (
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-black border inline-block",
                            rota.diferencaKm > 0 
                              ? "bg-rose-500/15 text-rose-500 border-rose-500/30" 
                              : "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                          )}>
                            {rota.diferencaKm > 0 ? `+${rota.diferencaKm}` : rota.diferencaKm} km
                            {rota.percentualVar !== null && ` (${rota.percentualVar > 0 ? `+${rota.percentualVar}%` : `${rota.percentualVar}%`})`}
                          </span>
                        ) : (
                          <span className="text-[10px] text-text-tertiary">—</span>
                        )}
                      </td>

                      {/* Ação Ajustar */}
                      <td className="py-1.5 px-2.5 text-center">
                        <button
                          onClick={() => setModalEdicaoKm(rota)}
                          className="p-1 bg-background-secondary hover:bg-info/15 text-text-secondary hover:text-info border border-border-secondary rounded transition-colors cursor-pointer inline-flex items-center justify-center"
                          title="Ajustar hodômetro / fotos"
                        >
                          <Edit3 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-background-secondary border-t-2 border-border-secondary font-mono text-xs font-black text-text-primary whitespace-nowrap">
                <tr>
                  <td colSpan={7} className="py-2 px-3 text-right uppercase text-[10px] text-text-secondary border-r border-border-secondary/60">
                    Totais ({rotas.length} rotas):
                  </td>
                  <td className="py-2 px-3 text-center text-info border-r border-border-secondary/60">
                    {kpis.totalPrevisto > 0 ? `${kpis.totalPrevisto.toLocaleString('pt-BR')} km` : '—'}
                  </td>
                  <td colSpan={2} className="py-2 px-3 border-r border-border-secondary/60"></td>
                  <td className="py-2 px-3 text-center text-emerald-500 border-r border-border-secondary/60">
                    {kpis.totalExecutado > 0 ? `${kpis.totalExecutado.toLocaleString('pt-BR')} km` : '—'}
                  </td>
                  <td className="py-2 px-3 text-center border-r border-border-secondary/60">
                    {kpis.diferencaGeral !== null ? (
                      <span className={kpis.diferencaGeral > 0 ? "text-rose-500" : "text-emerald-500"}>
                        {kpis.diferencaGeral > 0 ? `+${kpis.diferencaGeral}` : kpis.diferencaGeral} km
                      </span>
                    ) : '—'}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
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
