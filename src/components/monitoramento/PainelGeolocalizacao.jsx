import React, { useState, useMemo } from 'react';
import { 
  MapPin, Navigation, Map, Search, Plus, Trash2, CheckCircle2, 
  XCircle, Clock, AlertTriangle, ExternalLink, Compass, ShieldCheck, 
  Check, X, Edit3, User, Truck, Building2, ChevronRight, RefreshCw
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';

export function PainelGeolocalizacao() {
  const { 
    clientesGeoloc, 
    solicitacoesGeoloc, 
    entregas,
    salvarPontoCliente, 
    removerPontoCliente, 
    aprovarSolicitacaoGeoloc, 
    recusarSolicitacaoGeoloc 
  } = useStore();

  const pendentesCount = useMemo(() => {
    return (solicitacoesGeoloc || []).filter(s => s.status === 'Pendente').length;
  }, [solicitacoesGeoloc]);

  // Se houver solicitações pendentes, abre na aba de solicitações, senão abre na base de clientes
  const [subAba, setSubAba] = useState(() => pendentesCount > 0 ? 'solicitacoes' : 'clientes');
  const [filtroStatusSolic, setFiltroStatusSolic] = useState('Pendente'); // 'Pendente' | 'Aprovado' | 'Recusado' | 'Todos'
  const [buscaCliente, setBuscaCliente] = useState('');
  const [filtroGpsCliente, setFiltroGpsCliente] = useState('todos'); // 'todos' | 'com_gps' | 'sem_gps'

  // Modais
  const [modalAprovar, setModalAprovar] = useState(null);
  const [modalRecusar, setModalRecusar] = useState(null);
  const [motivoRecusa, setMotivoRecusa] = useState('');
  const [nomeLocalAprovado, setNomeLocalAprovado] = useState('');

  const [modalGerenciarCliente, setModalGerenciarCliente] = useState(null);
  const [modalNovoPonto, setModalNovoPonto] = useState(false);
  const [novoPontoForm, setNovoPontoForm] = useState({
    nomeLocal: '',
    lat: '',
    lng: '',
    endereco: '',
    padrao: false
  });

  // Lista de solicitações filtradas
  const solicitacoesFiltradas = useMemo(() => {
    let list = [...(solicitacoesGeoloc || [])].sort((a, b) => 
      String(b.criadoEm || '').localeCompare(String(a.criadoEm || ''))
    );

    if (filtroStatusSolic !== 'Todos') {
      list = list.filter(s => s.status === filtroStatusSolic);
    }

    if (buscaCliente.trim()) {
      const term = buscaCliente.toLowerCase();
      list = list.filter(s => 
        (s.clienteNome || '').toLowerCase().includes(term) ||
        String(s.codCliente || '').toLowerCase().includes(term) ||
        (s.motoristaPlaca || '').toLowerCase().includes(term) ||
        (s.motoristaNome || '').toLowerCase().includes(term) ||
        (s.municipio || s.cidade || '').toLowerCase().includes(term)
      );
    }

    return list;
  }, [solicitacoesGeoloc, filtroStatusSolic, buscaCliente]);

  // Consolidar base total de clientes (a partir de clientes_geoloc e entregas)
  const todosClientes = useMemo(() => {
    const map = new Map();

    // 1. Clientes cadastrados no Firestore (clientes_geoloc)
    (clientesGeoloc || []).forEach(c => {
      const cod = String(c.codCliente || c.id || '').trim();
      if (!cod) return;
      map.set(cod, {
        codCliente: cod,
        cliente: c.cliente || c.nome || 'Cliente ' + cod,
        municipio: c.municipio || c.cidade || '',
        bairro: c.bairro || '',
        pontos: c.pontos || [],
        atualizadoEm: c.atualizadoEm || ''
      });
    });

    // 2. Clientes encontrados nas entregas importadas (para listar mesmo os sem GPS cadastrado)
    (entregas || []).forEach(e => {
      const cod = String(e.codCliente || e.cod_cliente || '').trim();
      if (!cod) return;
      const nomeCliente = e.cliente || e.nome || 'Cliente ' + cod;
      const cidade = e.cidade || e.municipio || '';
      const bairro = e.bairro || '';

      if (!map.has(cod)) {
        map.set(cod, {
          codCliente: cod,
          cliente: nomeCliente,
          municipio: cidade,
          bairro: bairro,
          pontos: [],
          atualizadoEm: null
        });
      } else {
        const item = map.get(cod);
        if (!item.cliente || item.cliente.startsWith('Cliente ')) item.cliente = nomeCliente;
        if (!item.municipio && cidade) item.municipio = cidade;
        if (!item.bairro && bairro) item.bairro = bairro;
      }
    });

    return Array.from(map.values()).sort((a, b) => (a.cliente || '').localeCompare(b.cliente || ''));
  }, [clientesGeoloc, entregas]);

  // Filtro de Clientes na tabela
  const clientesFiltrados = useMemo(() => {
    let list = todosClientes;

    if (filtroGpsCliente === 'com_gps') {
      list = list.filter(c => c.pontos && c.pontos.length > 0);
    } else if (filtroGpsCliente === 'sem_gps') {
      list = list.filter(c => !c.pontos || c.pontos.length === 0);
    }

    if (buscaCliente.trim()) {
      const term = buscaCliente.toLowerCase();
      list = list.filter(c => 
        (c.cliente || '').toLowerCase().includes(term) ||
        String(c.codCliente || '').toLowerCase().includes(term) ||
        (c.municipio || '').toLowerCase().includes(term) ||
        (c.bairro || '').toLowerCase().includes(term)
      );
    }

    return list;
  }, [todosClientes, filtroGpsCliente, buscaCliente]);

  const totalPontosMapeados = useMemo(() => {
    return (clientesGeoloc || []).reduce((acc, curr) => acc + (curr.pontos?.length || 0), 0);
  }, [clientesGeoloc]);

  const totalComGps = useMemo(() => {
    return todosClientes.filter(c => c.pontos && c.pontos.length > 0).length;
  }, [todosClientes]);

  // Handlers de Aprovação e Recusa
  const handleAprovar = async () => {
    if (!modalAprovar) return;
    try {
      await aprovarSolicitacaoGeoloc(modalAprovar.id, {
        nomeLocal: nomeLocalAprovado.trim() || modalAprovar.nomeLocalSugerido || 'Ponto Principal',
        lat: modalAprovar.lat,
        lng: modalAprovar.lng,
        endereco: modalAprovar.endereco || ''
      });
      setModalAprovar(null);
    } catch (err) {
      console.error(err);
      alert('Erro ao aprovar solicitação.');
    }
  };

  const handleRecusar = async () => {
    if (!modalRecusar) return;
    try {
      await recusarSolicitacaoGeoloc(modalRecusar.id, motivoRecusa.trim() || 'Coordenadas não validadas');
      setModalRecusar(null);
      setMotivoRecusa('');
    } catch (err) {
      console.error(err);
      alert('Erro ao recusar solicitação.');
    }
  };

  // Handlers de Gerenciamento de Pontos do Cliente
  const handleSalvarNovoPonto = async (e) => {
    e.preventDefault();
    if (!modalGerenciarCliente) return;

    if (!novoPontoForm.lat || !novoPontoForm.lng) {
      alert('Preencha latitude e longitude válidas.');
      return;
    }

    try {
      const ponto = {
        nomeLocal: novoPontoForm.nomeLocal.trim() || 'Ponto de Entrega',
        lat: Number(novoPontoForm.lat),
        lng: Number(novoPontoForm.lng),
        endereco: novoPontoForm.endereco.trim(),
        padrao: novoPontoForm.padrao || (!modalGerenciarCliente.pontos || modalGerenciarCliente.pontos.length === 0),
        criadoPor: 'Monitoramento'
      };

      await salvarPontoCliente(modalGerenciarCliente.codCliente, ponto, {
        cliente: modalGerenciarCliente.cliente,
        municipio: modalGerenciarCliente.municipio,
        bairro: modalGerenciarCliente.bairro
      });

      // Atualiza cliente no modal local
      const atualizados = (clientesGeoloc || []).find(c => 
        String(c.codCliente).trim() === String(modalGerenciarCliente.codCliente).trim()
      );
      if (atualizados) {
        setModalGerenciarCliente(atualizados);
      } else {
        setModalGerenciarCliente(prev => ({
          ...prev,
          pontos: [...(prev.pontos || []), { ...ponto, id: `${Date.now()}` }]
        }));
      }

      setModalNovoPonto(false);
      setNovoPontoForm({ nomeLocal: '', lat: '', lng: '', endereco: '', padrao: false });
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar ponto de entrega.');
    }
  };

  const handleRemoverPonto = async (pontoId) => {
    if (!modalGerenciarCliente) return;
    if (!confirm('Deseja realmente excluir este local de entrega?')) return;

    try {
      await removerPontoCliente(modalGerenciarCliente.codCliente, pontoId);
      const atualizados = (clientesGeoloc || []).find(c => 
        String(c.codCliente).trim() === String(modalGerenciarCliente.codCliente).trim()
      );
      if (atualizados) {
        setModalGerenciarCliente(atualizados);
      } else {
        setModalGerenciarCliente(prev => ({
          ...prev,
          pontos: (prev.pontos || []).filter(p => p.id !== pontoId)
        }));
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao remover ponto.');
    }
  };

  const handleDefinirPadrao = async (ponto) => {
    if (!modalGerenciarCliente) return;
    try {
      const pontosAtualizados = (modalGerenciarCliente.pontos || []).map(p => ({
        ...p,
        padrao: p.id === ponto.id
      }));

      for (const p of pontosAtualizados) {
        await salvarPontoCliente(modalGerenciarCliente.codCliente, p, {
          cliente: modalGerenciarCliente.cliente,
          municipio: modalGerenciarCliente.municipio,
          bairro: modalGerenciarCliente.bairro
        });
      }

      const atualizados = (clientesGeoloc || []).find(c => 
        String(c.codCliente).trim() === String(modalGerenciarCliente.codCliente).trim()
      );
      if (atualizados) {
        setModalGerenciarCliente(atualizados);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Cards de Métricas / KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 bg-background-secondary border border-border-secondary rounded-xl shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-xl">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider block">Clientes c/ GPS</span>
            <span className="text-xl font-bold text-text-primary leading-tight">
              {totalComGps} <span className="text-xs text-text-tertiary font-normal">/ {todosClientes.length}</span>
            </span>
          </div>
        </div>

        <div className="p-3.5 bg-background-secondary border border-border-secondary rounded-xl shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider block">Locais Mapeados</span>
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 leading-tight">{totalPontosMapeados}</span>
          </div>
        </div>

        <div className="p-3.5 bg-background-secondary border border-border-secondary rounded-xl shadow-sm flex items-center gap-3">
          <div className={cn(
            "p-2.5 rounded-xl",
            pendentesCount > 0 ? "bg-amber-500/15 text-amber-500 animate-pulse" : "bg-slate-500/10 text-slate-400"
          )}>
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider block">Solicitações Pendentes</span>
            <span className={cn(
              "text-xl font-bold leading-tight",
              pendentesCount > 0 ? "text-amber-500" : "text-text-primary"
            )}>
              {pendentesCount}
            </span>
          </div>
        </div>

        <div className="p-3.5 bg-background-secondary border border-border-secondary rounded-xl shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-rose-500/10 text-rose-500 rounded-xl">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider block">Sem GPS Mapeado</span>
            <span className="text-xl font-bold text-rose-500 leading-tight">
              {todosClientes.length - totalComGps}
            </span>
          </div>
        </div>
      </div>

      {/* Navegação entre Sub-abas */}
      <div className="flex bg-background-secondary p-1 rounded-xl border border-border-secondary shadow-sm">
        <button
          onClick={() => setSubAba('clientes')}
          className={cn(
            "flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2",
            subAba === 'clientes'
              ? "bg-primary text-white shadow-md shadow-primary/20"
              : "text-text-secondary hover:text-text-primary hover:bg-background-tertiary"
          )}
        >
          <Building2 className="w-4 h-4" />
          <span>Base de Clientes & Locais ({todosClientes.length})</span>
        </button>

        <button
          onClick={() => setSubAba('solicitacoes')}
          className={cn(
            "flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2",
            subAba === 'solicitacoes'
              ? "bg-primary text-white shadow-md shadow-primary/20"
              : "text-text-secondary hover:text-text-primary hover:bg-background-tertiary"
          )}
        >
          <Clock className="w-4 h-4" />
          <span>Solicitações de Motoristas</span>
          {pendentesCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] bg-amber-400 text-slate-950 font-black rounded-full">
              {pendentesCount}
            </span>
          )}
        </button>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            type="text"
            placeholder="Buscar por cliente, código, motorista, placa, bairro..."
            value={buscaCliente}
            onChange={(e) => setBuscaCliente(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-background-secondary border border-border-secondary rounded-xl text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {buscaCliente && (
            <button
              onClick={() => setBuscaCliente('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {subAba === 'solicitacoes' ? (
          <div className="flex gap-1.5 overflow-x-auto">
            {['Pendente', 'Aprovado', 'Recusado', 'Todos'].map((st) => (
              <button
                key={st}
                onClick={() => setFiltroStatusSolic(st)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors",
                  filtroStatusSolic === st
                    ? "bg-primary/20 text-primary border border-primary/40"
                    : "bg-background-secondary text-text-secondary border border-border-secondary hover:bg-background-tertiary"
                )}
              >
                {st}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex gap-1.5 overflow-x-auto">
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'com_gps', label: 'Com GPS' },
              { id: 'sem_gps', label: 'Sem GPS' }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFiltroGpsCliente(f.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors",
                  filtroGpsCliente === f.id
                    ? "bg-primary/20 text-primary border border-primary/40"
                    : "bg-background-secondary text-text-secondary border border-border-secondary hover:bg-background-tertiary"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Conteúdo da Sub-Aba 1: BASE DE CLIENTES & LOCAIS */}
      {subAba === 'clientes' && (
        <div className="space-y-3">
          <div className="bg-background-secondary rounded-2xl border border-border-secondary overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-background-tertiary/60 border-b border-border-secondary text-text-tertiary font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Cód.</th>
                    <th className="py-3 px-4">Cliente / Razão</th>
                    <th className="py-3 px-4">Município / Bairro</th>
                    <th className="py-3 px-4 text-center">Locais Mapeados</th>
                    <th className="py-3 px-4 text-center">Links Rápidos</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-tertiary/40">
                  {clientesFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-text-tertiary">
                        Nenhum cliente encontrado com os filtros atuais.
                      </td>
                    </tr>
                  ) : (
                    clientesFiltrados.map((cli) => {
                      const temGps = cli.pontos && cli.pontos.length > 0;
                      const pontoPadrao = cli.pontos?.find(p => p.padrao) || cli.pontos?.[0];

                      return (
                        <tr 
                          key={cli.codCliente}
                          className="hover:bg-background-tertiary/40 transition-colors"
                        >
                          <td className="py-3 px-4 font-mono font-bold text-text-primary">
                            {cli.codCliente}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-text-primary block">{cli.cliente}</span>
                          </td>
                          <td className="py-3 px-4 text-text-secondary">
                            {cli.municipio}{cli.bairro ? ` - ${cli.bairro}` : ''}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {temGps ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold rounded-full text-[11px]">
                                <MapPin className="w-3 h-3" />
                                {cli.pontos.length} ponto{cli.pontos.length !== 1 ? 's' : ''}
                              </span>
                            ) : (
                              <span className="text-text-tertiary italic text-[11px]">
                                Sem GPS
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {temGps && pontoPadrao ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <a
                                  href={`https://www.google.com/maps/dir/?api=1&destination=${pontoPadrao.lat},${pontoPadrao.lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 bg-background-primary hover:bg-emerald-500/20 text-emerald-600 border border-border-secondary rounded-lg text-[11px] font-semibold transition-all"
                                  title="Google Maps"
                                >
                                  <Map className="w-3.5 h-3.5" />
                                </a>
                                <a
                                  href={`https://waze.com/ul?ll=${pontoPadrao.lat},${pontoPadrao.lng}&navigate=yes`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 bg-background-primary hover:bg-cyan-500/20 text-cyan-600 border border-border-secondary rounded-lg text-[11px] font-semibold transition-all"
                                  title="Waze"
                                >
                                  <Navigation className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            ) : (
                              <span className="text-text-tertiary">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => setModalGerenciarCliente(cli)}
                              className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary font-bold rounded-xl transition-all"
                            >
                              Gerenciar Locais
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo da Sub-Aba 2: SOLICITAÇÕES */}
      {subAba === 'solicitacoes' && (
        <div className="space-y-3">
          {solicitacoesFiltradas.length === 0 ? (
            <div className="text-center py-12 bg-background-secondary rounded-2xl border border-border-secondary">
              <Compass className="w-12 h-12 text-text-tertiary opacity-40 mx-auto mb-2" />
              <p className="text-sm font-semibold text-text-primary">Nenhuma solicitação encontrada</p>
              <p className="text-xs text-text-tertiary">
                Quando os motoristas enviarem coordenadas pelo celular na porta do cliente, elas aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {solicitacoesFiltradas.map((solic) => {
                const isPendente = solic.status === 'Pendente';
                const isAprovado = solic.status === 'Aprovado';
                const isRecusado = solic.status === 'Recusado';

                return (
                  <div
                    key={solic.id}
                    className={cn(
                      "p-4 rounded-2xl border transition-all space-y-3",
                      isPendente
                        ? "bg-background-secondary border-amber-500/40 shadow-sm shadow-amber-500/5"
                        : isAprovado
                          ? "bg-background-secondary/70 border-emerald-500/30 opacity-90"
                          : "bg-background-secondary/50 border-border-secondary opacity-70"
                    )}
                  >
                    {/* Header Solicitação */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-xs rounded-md">
                            Cód: {solic.codCliente}
                          </span>
                          <span className={cn(
                            "px-2 py-0.5 font-bold text-[10px] rounded-full uppercase tracking-wider",
                            isPendente
                              ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                              : isAprovado
                                ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                : "bg-rose-500/20 text-rose-600 dark:text-rose-400"
                          )}>
                            {solic.status}
                          </span>
                        </div>
                        <h4 className="font-bold text-text-primary text-sm mt-1.5">
                          {solic.clienteNome || 'Cliente não identificado'}
                        </h4>
                        <p className="text-xs text-text-secondary">
                          {solic.municipio || solic.cidade || ''}{solic.bairro ? ` - ${solic.bairro}` : ''}
                        </p>
                      </div>

                      <span className="text-[10px] text-text-tertiary whitespace-nowrap">
                        {solic.criadoEm ? new Date(solic.criadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>

                    {/* Dados do Motorista & GPS */}
                    <div className="p-2.5 bg-background-primary/60 border border-border-tertiary rounded-xl space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-text-secondary">
                        <span className="flex items-center gap-1">
                          <Truck className="w-3.5 h-3.5 text-text-tertiary" />
                          Placa: <strong className="text-text-primary">{solic.motoristaPlaca || 'S/ Placa'}</strong>
                        </span>
                        {solic.motoristaNome && (
                          <span className="text-text-tertiary truncate max-w-[150px]">
                            {solic.motoristaNome}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-text-secondary pt-1 border-t border-border-tertiary/50">
                        <span className="font-mono text-text-primary font-medium">
                          {Number(solic.lat).toFixed(6)}, {Number(solic.lng).toFixed(6)}
                        </span>
                        {solic.precisaoMetros !== undefined && (
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                            ± {solic.precisaoMetros}m
                          </span>
                        )}
                      </div>

                      {solic.nomeLocalSugerido && (
                        <div className="text-[11px] text-text-secondary">
                          <span className="text-text-tertiary">Ponto sugerido:</span> <strong className="text-text-primary">{solic.nomeLocalSugerido}</strong>
                        </div>
                      )}

                      {solic.observacao && (
                        <div className="text-[11px] text-text-secondary italic">
                          "{solic.observacao}"
                        </div>
                      )}

                      {solic.motivoRecusa && (
                        <div className="text-[11px] text-rose-500 font-medium">
                          Motivo recusa: {solic.motivoRecusa}
                        </div>
                      )}
                    </div>

                    {/* Ações de Teste de Navegação e Decisão */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${solic.lat},${solic.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all"
                          title="Abrir no Google Maps"
                        >
                          <Map className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Maps</span>
                        </a>
                        <a
                          href={`https://waze.com/ul?ll=${solic.lat},${solic.lng}&navigate=yes`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all"
                          title="Abrir no Waze"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Waze</span>
                        </a>
                      </div>

                      {isPendente && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setModalRecusar(solic);
                              setMotivoRecusa('');
                            }}
                            className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-500/10 rounded-xl transition-colors border border-rose-500/20"
                          >
                            Recusar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setModalAprovar(solic);
                              setNomeLocalAprovado(solic.nomeLocalSugerido || 'Ponto de Descarga');
                            }}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Aprovar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL DE APROVAÇÃO DE SOLICITAÇÃO */}
      {modalAprovar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                <CheckCircle2 className="w-5 h-5" />
                <span>Aprovar Ponto de Entrega</span>
              </div>
              <button
                onClick={() => setModalAprovar(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-1 text-xs">
              <div className="font-bold text-slate-900 dark:text-slate-100">
                {modalAprovar.clienteNome} (Cód: {modalAprovar.codCliente})
              </div>
              <div className="text-slate-500 font-mono">
                Lat: {modalAprovar.lat}, Lng: {modalAprovar.lng} (± {modalAprovar.precisaoMetros || 0}m)
              </div>
              <div className="text-slate-400">
                Enviado por: {modalAprovar.motoristaPlaca} - {modalAprovar.motoristaNome}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nome do Local / Ponto de Descarga
              </label>
              <input
                type="text"
                value={nomeLocalAprovado}
                onChange={(e) => setNomeLocalAprovado(e.target.value)}
                placeholder="Ex: Portão 1 - Matriz, Galpão de Descarga"
                className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalAprovar(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAprovar}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-md"
              >
                Confirmar e Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE RECUSA DE SOLICITAÇÃO */}
      {modalRecusar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-600 font-bold">
                <XCircle className="w-5 h-5" />
                <span>Recusar Solicitação de GPS</span>
              </div>
              <button
                onClick={() => setModalRecusar(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Informe o motivo da recusa para histórico da solicitação:
            </p>

            <textarea
              rows={3}
              value={motivoRecusa}
              onChange={(e) => setMotivoRecusa(e.target.value)}
              placeholder="Ex: GPS distante do endereço oficial do cliente"
              className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalRecusar(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRecusar}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl shadow-md"
              >
                Confirmar Recusa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE GERENCIAMENTO DE LOCAIS DO CLIENTE */}
      {modalGerenciarCliente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-md">
                    Cód: {modalGerenciarCliente.codCliente}
                  </span>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    {modalGerenciarCliente.cliente}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {modalGerenciarCliente.municipio}{modalGerenciarCliente.bairro ? ` - ${modalGerenciarCliente.bairro}` : ''}
                </p>
              </div>
              <button
                onClick={() => {
                  setModalGerenciarCliente(null);
                  setModalNovoPonto(false);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Locais Cadastrados ({modalGerenciarCliente.pontos?.length || 0})
                </span>
                {!modalNovoPonto && (
                  <button
                    type="button"
                    onClick={() => setModalNovoPonto(true)}
                    className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Adicionar Novo Ponto
                  </button>
                )}
              </div>

              {/* Form de Novo Ponto Manual */}
              {modalNovoPonto && (
                <form onSubmit={handleSalvarNovoPonto} className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Cadastrar Local Manualmente
                    </span>
                    <button
                      type="button"
                      onClick={() => setModalNovoPonto(false)}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Cancelar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                        Identificação do Local
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Matriz, Portão 2, Galpão B"
                        value={novoPontoForm.nomeLocal}
                        onChange={(e) => setNovoPontoForm({ ...novoPontoForm, nomeLocal: e.target.value })}
                        className="w-full text-xs px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                        Latitude
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="Ex: -12.9714"
                        value={novoPontoForm.lat}
                        onChange={(e) => setNovoPontoForm({ ...novoPontoForm, lat: e.target.value })}
                        className="w-full text-xs px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:outline-none font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                        Longitude
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="Ex: -38.5014"
                        value={novoPontoForm.lng}
                        onChange={(e) => setNovoPontoForm({ ...novoPontoForm, lng: e.target.value })}
                        className="w-full text-xs px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:outline-none font-mono"
                        required
                      />
                    </div>

                    <div className="flex items-center sm:pt-4">
                      <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={novoPontoForm.padrao}
                          onChange={(e) => setNovoPontoForm({ ...novoPontoForm, padrao: e.target.checked })}
                          className="rounded text-primary focus:ring-primary"
                        />
                        <span>Ponto Principal</span>
                      </label>
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                        Endereço / Referência (Opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Av. Principal, 1234 - Galpão dos fundos"
                        value={novoPontoForm.endereco}
                        onChange={(e) => setNovoPontoForm({ ...novoPontoForm, endereco: e.target.value })}
                        className="w-full text-xs px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-white font-semibold text-xs rounded-lg shadow-sm"
                    >
                      Salvar Local
                    </button>
                  </div>
                </form>
              )}

              {/* Lista dos Pontos do Cliente */}
              {(!modalGerenciarCliente.pontos || modalGerenciarCliente.pontos.length === 0) ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Nenhum local de entrega cadastrado para este cliente.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {modalGerenciarCliente.pontos.map((ponto, idx) => (
                    <div
                      key={ponto.id || idx}
                      className={cn(
                        "p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all",
                        ponto.padrao
                          ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50"
                          : "bg-white dark:bg-slate-950/40 border-slate-200 dark:border-slate-800"
                      )}
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <strong className="text-slate-900 dark:text-slate-100 text-xs">
                            {ponto.nomeLocal || `Ponto ${idx + 1}`}
                          </strong>
                          {ponto.padrao && (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full">
                              Principal
                            </span>
                          )}
                        </div>
                        {ponto.endereco && (
                          <p className="text-slate-500 text-[11px]">{ponto.endereco}</p>
                        )}
                        <p className="font-mono text-slate-400 text-[11px]">
                          {Number(ponto.lat).toFixed(6)}, {Number(ponto.lng).toFixed(6)}
                          {ponto.criadoPor && <span className="font-sans ml-2 text-slate-400">• {ponto.criadoPor}</span>}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${ponto.lat},${ponto.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500/20 text-emerald-600 rounded-lg"
                          title="Google Maps"
                        >
                          <Map className="w-3.5 h-3.5" />
                        </a>
                        <a
                          href={`https://waze.com/ul?ll=${ponto.lat},${ponto.lng}&navigate=yes`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-cyan-500/20 text-cyan-600 rounded-lg"
                          title="Waze"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                        </a>

                        {!ponto.padrao && (
                          <button
                            type="button"
                            onClick={() => handleDefinirPadrao(ponto)}
                            className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-blue-500/20 text-slate-700 dark:text-slate-300 hover:text-blue-500 text-[11px] font-semibold rounded-lg"
                          >
                            Definir Principal
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRemoverPonto(ponto.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg"
                          title="Excluir ponto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setModalGerenciarCliente(null);
                  setModalNovoPonto(false);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl"
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
