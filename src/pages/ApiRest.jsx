import { useState, useMemo } from 'react';
import { 
  Code2, Copy, Check, Play, Terminal, Sparkles,
  CheckCircle2, AlertCircle, Loader2, Zap, RefreshCw
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';

const formatarData = (dataStr) => {
  if (!dataStr) return '--/--/----';
  try {
    const parts = String(dataStr).split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dataStr);
    return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  } catch {
    return String(dataStr);
  }
};

export function ApiRest() {
  const { entregas = [] } = useStore();

  const [testandoApi, setTestandoApi] = useState(false);
  const [resultadoTesteApi, setResultadoTesteApi] = useState(null);
  const [filtroTesteData, setFiltroTesteData] = useState('');
  const [filtroTesteCarga, setFiltroTesteCarga] = useState('');
  const [filtroTestePlaca, setFiltroTestePlaca] = useState('');
  const [filtroTesteStatus, setFiltroTesteStatus] = useState('');
  const [formatoTeste, setFormatoTeste] = useState('csv'); // 'csv' ou 'json'
  const [copiouUrl, setCopiouUrl] = useState(false);
  const [copiouPrompt, setCopiouPrompt] = useState(false);

  // Opções para os Selects
  const opcoesFiltros = useMemo(() => {
    const cargas = new Set();
    const placas = new Set();
    const statusSet = new Set();
    const datas = new Set();

    (entregas || []).forEach(e => {
      if (e.carga) cargas.add(String(e.carga));
      if (e.placaOriginal || e.placa) placas.add(String(e.placaOriginal || e.placa).toUpperCase());
      if (e.status) statusSet.add(String(e.status));
      const dtFat = e.dataFaturamento || e.data;
      if (dtFat) datas.add(String(dtFat));
    });

    return {
      cargas: Array.from(cargas).sort(),
      placas: Array.from(placas).sort(),
      statusList: Array.from(statusSet).sort(),
      datasList: Array.from(datas).sort((a, b) => b.localeCompare(a))
    };
  }, [entregas]);

  const urlBaseHost = typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost') 
    ? window.location.origin 
    : 'https://logistrack-chi.vercel.app';
  
  const queryParamsTeste = useMemo(() => {
    const params = new URLSearchParams();
    params.set('token', 'logistrack2026');
    if (filtroTesteData) params.set('data', filtroTesteData);
    if (filtroTesteCarga) params.set('carga', filtroTesteCarga);
    if (filtroTestePlaca) params.set('placa', filtroTestePlaca);
    if (filtroTesteStatus) params.set('status', filtroTesteStatus);
    if (formatoTeste === 'json') params.set('format', 'json');
    return params.toString();
  }, [filtroTesteData, filtroTesteCarga, filtroTestePlaca, filtroTesteStatus, formatoTeste]);

  const urlCompletaApi = `${urlBaseHost}/api/cargas-8132?${queryParamsTeste}`;

  const executarTesteApi = async () => {
    setTestandoApi(true);
    setResultadoTesteApi(null);
    const start = performance.now();

    try {
      const response = await fetch(urlCompletaApi);
      const durationMs = Math.round(performance.now() - start);
      const status = response.status;
      const statusText = response.statusText || 'OK';
      const contentType = response.headers.get('content-type') || '';

      let payloadTexto = '';
      let totalLinhasRecebidas = 0;
      let jsonParsed = null;

      if (formatoTeste === 'json' || contentType.includes('json')) {
        jsonParsed = await response.json();
        payloadTexto = JSON.stringify(jsonParsed, null, 2);
        totalLinhasRecebidas = jsonParsed.total || (jsonParsed.dados ? jsonParsed.dados.length : 0);
      } else {
        payloadTexto = await response.text();
        const linhasCsv = payloadTexto.trim().split(/\r?\n/).filter(Boolean);
        totalLinhasRecebidas = Math.max(0, linhasCsv.length - 1);
      }

      setResultadoTesteApi({
        sucesso: response.ok,
        status,
        statusText,
        durationMs,
        bytes: payloadTexto.length,
        totalLinhas: totalLinhasRecebidas,
        payloadTexto,
        jsonParsed
      });

    } catch (err) {
      const durationMs = Math.round(performance.now() - start);
      setResultadoTesteApi({
        sucesso: false,
        status: 500,
        statusText: 'Erro de Conexão',
        durationMs,
        bytes: 0,
        totalLinhas: 0,
        erro: err.message
      });
    } finally {
      setTestandoApi(false);
    }
  };

  const copiarTexto = (texto, tipo) => {
    navigator.clipboard.writeText(texto);
    if (tipo === 'url') {
      setCopiouUrl(true);
      setTimeout(() => setCopiouUrl(false), 2000);
    } else {
      setCopiouPrompt(true);
      setTimeout(() => setCopiouPrompt(false), 2000);
    }
  };

  const promptBase44 = formatoTeste === 'json'
    ? `Crie uma rotina que consulte a URL "${urlCompletaApi}" (método GET) a cada 5 minutos (ou ao clicar em Sincronizar) para coletar a lista de entregas e produtos com STATUS em formato JSON e atualizar o banco de dados do sistema.${filtroTesteData === 'hoje' ? ' (Dica: para sincronizar todas as cargas ativas sem restringir à data de hoje, você pode remover &data=hoje da URL).' : ''}`
    : `Crie uma rotina que consulte a URL "${urlCompletaApi}" (método GET) a cada 5 minutos (ou ao clicar em Sincronizar) para coletar os dados de rotas, produtos e STATUS em CSV (delimitador ;) e atualizar o banco de dados do sistema.${filtroTesteData === 'hoje' ? ' (Dica: para sincronizar todas as cargas ativas sem restringir à data de hoje, você pode remover &data=hoje da URL).' : ''}`;

  return (
    <div className="space-y-4 w-full pb-12">
      {/* Header Principal da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-background-secondary p-4 sm:p-5 rounded-2xl border border-border-secondary shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center border border-purple-500/30 shrink-0">
            <Code2 size={22} />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-text-primary tracking-tight">
              API Rest
            </h1>
            <p className="text-xs text-text-secondary">
              Integração automática e consulta em tempo real (Modelo 8132 + STATUS).
            </p>
          </div>
        </div>

        <button
          onClick={executarTesteApi}
          disabled={testandoApi}
          className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-purple-950/20 transition-all cursor-pointer"
        >
          {testandoApi ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} className="fill-current" />}
          <span>{testandoApi ? 'Disparando...' : '⚡ Disparar Teste de API'}</span>
        </button>
      </div>

      {/* Painel do Endpoint e Parâmetros */}
      <div className="bg-background-secondary rounded-2xl border border-border-secondary p-4 sm:p-5 space-y-4 shadow-xs">
        {/* URL da API */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
              <Terminal size={13} className="text-purple-400" />
              <span>Endpoint da API (GET)</span>
            </label>
            <span className="text-[10px] text-text-muted font-mono">Token: logistrack2026</span>
          </div>

          <div className="flex items-center gap-2 bg-background-primary border border-border-secondary rounded-xl p-2.5">
            <span className="text-xs font-bold text-emerald-400 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 font-mono">
              GET
            </span>
            <input 
              type="text" 
              readOnly 
              value={urlCompletaApi} 
              className="flex-1 bg-transparent text-xs text-text-primary font-mono outline-none truncate select-all"
            />
            <button
              onClick={() => copiarTexto(urlCompletaApi, 'url')}
              className="flex items-center gap-1.5 bg-background-secondary hover:bg-border-tertiary text-text-primary px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 border border-border-secondary"
            >
              {copiouUrl ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copiouUrl ? 'Copiado!' : 'Copiar URL'}</span>
            </button>
          </div>
        </div>

        {/* Filtros Opcionais de Parâmetros */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 bg-background-primary/40 p-3.5 rounded-xl border border-border-tertiary">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-text-muted uppercase">Filtrar Data</label>
            <select
              value={filtroTesteData}
              onChange={e => setFiltroTesteData(e.target.value)}
              className="w-full bg-background-primary border border-border-secondary rounded-lg px-2.5 py-1.5 text-xs font-semibold text-text-primary focus:outline-none"
            >
              <option value="">Todas as Datas (Recomendado)</option>
              <option value="hoje">Hoje ({new Date().toLocaleDateString('pt-BR')})</option>
              {opcoesFiltros.datasList.map(d => (
                <option key={d} value={d}>
                  {formatarData(d)} (Data da Importação)
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-text-muted uppercase">Filtrar Carga</label>
            <select
              value={filtroTesteCarga}
              onChange={e => setFiltroTesteCarga(e.target.value)}
              className="w-full bg-background-primary border border-border-secondary rounded-lg px-2.5 py-1.5 text-xs font-semibold text-text-primary focus:outline-none"
            >
              <option value="">Todas as Cargas</option>
              {opcoesFiltros.cargas.map(c => (
                <option key={c} value={c}>Carga {c}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-text-muted uppercase">Filtrar Placa</label>
            <select
              value={filtroTestePlaca}
              onChange={e => setFiltroTestePlaca(e.target.value)}
              className="w-full bg-background-primary border border-border-secondary rounded-lg px-2.5 py-1.5 text-xs font-semibold text-text-primary focus:outline-none"
            >
              <option value="">Todas as Placas</option>
              {opcoesFiltros.placas.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-text-muted uppercase">Filtrar Status</label>
            <select
              value={filtroTesteStatus}
              onChange={e => setFiltroTesteStatus(e.target.value)}
              className="w-full bg-background-primary border border-border-secondary rounded-lg px-2.5 py-1.5 text-xs font-semibold text-text-primary focus:outline-none"
            >
              <option value="">Todos os Status</option>
              {opcoesFiltros.statusList.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-text-muted uppercase">Formato</label>
            <select
              value={formatoTeste}
              onChange={e => setFormatoTeste(e.target.value)}
              className="w-full bg-background-primary border border-purple-500/40 rounded-lg px-2.5 py-1.5 text-xs font-bold text-purple-300 focus:outline-none"
            >
              <option value="csv">CSV (8132 + Status)</option>
              <option value="json">JSON</option>
            </select>
          </div>
        </div>

        {/* Resultado do Teste ao Vivo */}
        {resultadoTesteApi && (
          <div className="space-y-3 pt-2">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-background-primary p-3 rounded-xl border border-border-secondary">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "px-3 py-1 rounded-lg text-xs font-black flex items-center gap-1.5",
                  resultadoTesteApi.sucesso 
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" 
                    : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                )}>
                  {resultadoTesteApi.sucesso ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  <span>Status HTTP: {resultadoTesteApi.status} {resultadoTesteApi.statusText}</span>
                </div>

                <span className="text-xs font-bold text-info bg-info/10 px-2.5 py-1 rounded-lg border border-info/20">
                  ⚡ {resultadoTesteApi.durationMs} ms
                </span>

                <span className="text-xs font-bold text-text-primary bg-background-secondary px-2.5 py-1 rounded-lg border border-border-secondary">
                  📦 {resultadoTesteApi.totalLinhas} linhas
                </span>

                <span className="text-xs text-text-muted font-mono">
                  {(resultadoTesteApi.bytes / 1024).toFixed(1)} KB
                </span>
              </div>

              <button
                onClick={() => copiarTexto(resultadoTesteApi.payloadTexto, 'payload')}
                className="text-xs font-bold text-text-secondary hover:text-text-primary flex items-center gap-1 px-2.5 py-1 rounded hover:bg-background-secondary transition-colors cursor-pointer"
              >
                <Copy size={13} />
                <span>Copiar Resposta</span>
              </button>
            </div>

            {/* Alerta de orientacao quando nao houver registros no filtro */}
            {resultadoTesteApi.sucesso && resultadoTesteApi.totalLinhas === 0 && (
              <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 text-xs text-amber-200">
                <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-amber-300">
                    Atenção: Nenhuma entrega encontrada para o filtro selecionado (0 linhas).
                  </p>
                  <p className="text-amber-200/80 text-[11px] leading-relaxed">
                    {filtroTesteData === 'hoje' ? (
                      <>
                        Você filtrou pela data de <strong>Hoje ({new Date().toLocaleDateString('pt-BR')})</strong>. As cargas registradas atualmente no banco de dados pertencem à importação de <strong>{opcoesFiltros.datasList.map(formatarData).join(', ') || '29/09/2026'}</strong>.<br />
                        💡 <strong>Para ver os dados reais no teste:</strong> Altere o filtro <em>"Filtrar Data"</em> para <strong>"Todas as Datas"</strong> ou para <strong>"{opcoesFiltros.datasList[0] ? formatarData(opcoesFiltros.datasList[0]) : '29/09/2026'}"</strong> e clique novamente em <em>"⚡ Disparar Teste de API"</em>.
                      </>
                    ) : (
                      'Nenhuma carga corresponde aos filtros combinados acima. Selecione "Todas as Datas" ou limpe os filtros de carga/placa/status para listar todas as entregas ativas.'
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Terminal de Visualização do Payload */}
            <div className="bg-[#0f1117] border border-border-secondary rounded-xl p-4 overflow-x-auto max-h-[300px] font-mono text-[11px] leading-relaxed text-zinc-300">
              <pre>{resultadoTesteApi.payloadTexto}</pre>
            </div>
          </div>
        )}

        {/* Caixa de Prompt Pronto para o Base44 */}
        <div className="bg-purple-950/20 border border-purple-500/30 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
              <Sparkles size={14} />
              <span>Prompt para o Base44:</span>
            </span>
            <button
              onClick={() => copiarTexto(promptBase44, 'prompt')}
              className="flex items-center gap-1 bg-purple-600 hover:bg-purple-500 text-white px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              {copiouPrompt ? <Check size={12} /> : <Copy size={12} />}
              <span>{copiouPrompt ? 'Copiado!' : 'Copiar Prompt'}</span>
            </button>
          </div>
          <p className="text-xs text-zinc-300 bg-background-primary/60 p-2.5 rounded-lg font-mono border border-purple-500/20">
            "{promptBase44}"
          </p>
        </div>
      </div>
    </div>
  );
}
