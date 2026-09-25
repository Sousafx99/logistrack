import React, { useState, useMemo, useRef } from 'react';
import { 
  MapPin, Navigation, Map as MapIcon, Search, Plus, Trash2, CheckCircle2, 
  XCircle, Clock, AlertTriangle, ExternalLink, Compass, ShieldCheck, 
  Check, X, Edit3, User, Truck, Building2, ChevronRight, RefreshCw,
  Filter, Globe, MapPinned, UploadCloud, DownloadCloud, FileSpreadsheet, Loader2, FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';

export function PainelGeolocalizacao() {
  const { 
    clientesGeoloc = [], 
    solicitacoesGeoloc = [], 
    entregas = [],
    salvarPontoCliente, 
    removerPontoCliente, 
    importarClientesGeolocEmLote,
    aprovarSolicitacaoGeoloc, 
    recusarSolicitacaoGeoloc 
  } = useStore();

  const pendentesCount = useMemo(() => {
    return (solicitacoesGeoloc || []).filter(s => s && s.status === 'Pendente').length;
  }, [solicitacoesGeoloc]);

  // Filtro principal: 'todos' | 'sem_gps' (Localização Pendente) | 'com_gps' (Localização Preenchida) | 'solicitacoes'
  const [filtroPrincipal, setFiltroPrincipal] = useState('todos');
  const [filtroStatusSolic, setFiltroStatusSolic] = useState('Pendente'); // 'Pendente' | 'Aprovado' | 'Recusado' | 'Todos'
  const [buscaTexto, setBuscaTexto] = useState('');

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

  // Modal de Importação de Planilha GPS
  const [modalImportar, setModalImportar] = useState(false);
  const [arquivoGps, setArquivoGps] = useState(null);
  const [importandoGps, setImportandoGps] = useState(false);
  const [resultadoGps, setResultadoGps] = useState(null);
  const [erroImportacaoGps, setErroImportacaoGps] = useState('');
  const inputGpsRef = useRef(null);

  // Consolidar base total de clientes a partir de clientes_geoloc e entregas importadas
  const todosClientes = useMemo(() => {
    const map = new globalThis.Map();

    // 1. Clientes cadastrados no Firestore (clientes_geoloc)
    (clientesGeoloc || []).forEach(c => {
      if (!c) return;
      const cod = String(c.codCliente || c.id || '').trim();
      if (!cod) return;
      map.set(cod, {
        codCliente: cod,
        cliente: String(c.cliente || c.nome || `Cliente ${cod}`),
        municipio: String(c.municipio || c.cidade || ''),
        bairro: String(c.bairro || ''),
        pontos: Array.isArray(c.pontos) ? c.pontos : [],
        atualizadoEm: c.atualizadoEm || ''
      });
    });

    // 2. Clientes encontrados nas entregas importadas (para listar mesmo os sem GPS cadastrado)
    (entregas || []).forEach(e => {
      if (!e) return;
      const cod = String(e.codCliente || e.cod_cliente || '').trim();
      if (!cod) return;
      const nomeCliente = String(e.cliente || e.nome || `Cliente ${cod}`);
      const cidade = String(e.cidade || e.municipio || '');
      const bairro = String(e.bairro || '');

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
        if (!item.cliente || (typeof item.cliente === 'string' && item.cliente.startsWith('Cliente '))) {
          item.cliente = nomeCliente;
        }
        if (!item.municipio && cidade) item.municipio = cidade;
        if (!item.bairro && bairro) item.bairro = bairro;
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      // Ordena por código numérico se possível, ou alfabético
      const numA = parseInt(a.codCliente, 10);
      const numB = parseInt(b.codCliente, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return String(a.cliente || '').localeCompare(String(b.cliente || ''));
    });
  }, [clientesGeoloc, entregas]);

  // Contagens para os cards e filtros
  const totalComGps = useMemo(() => {
    return todosClientes.filter(c => Array.isArray(c.pontos) && c.pontos.length > 0).length;
  }, [todosClientes]);

  const totalSemGps = useMemo(() => {
    return todosClientes.filter(c => !Array.isArray(c.pontos) || c.pontos.length === 0).length;
  }, [todosClientes]);

  const totalPontosMapeados = useMemo(() => {
    return (clientesGeoloc || []).reduce((acc, curr) => acc + (Array.isArray(curr?.pontos) ? curr.pontos.length : 0), 0);
  }, [clientesGeoloc]);

  // Lista de solicitações filtradas
  const solicitacoesFiltradas = useMemo(() => {
    let list = [...(solicitacoesGeoloc || [])].filter(Boolean).sort((a, b) => 
      String(b?.criadoEm || '').localeCompare(String(a?.criadoEm || ''))
    );

    if (filtroStatusSolic !== 'Todos') {
      list = list.filter(s => s?.status === filtroStatusSolic);
    }

    if (buscaTexto.trim()) {
      const term = buscaTexto.toLowerCase();
      list = list.filter(s => 
        String(s?.clienteNome || '').toLowerCase().includes(term) ||
        String(s?.codCliente || '').toLowerCase().includes(term) ||
        String(s?.motoristaPlaca || '').toLowerCase().includes(term) ||
        String(s?.motoristaNome || '').toLowerCase().includes(term) ||
        String(s?.municipio || s?.cidade || '').toLowerCase().includes(term) ||
        String(s?.bairro || '').toLowerCase().includes(term)
      );
    }

    return list;
  }, [solicitacoesGeoloc, filtroStatusSolic, buscaTexto]);

  // Lista de clientes filtrados
  const clientesFiltrados = useMemo(() => {
    let list = todosClientes;

    if (filtroPrincipal === 'com_gps') {
      list = list.filter(c => Array.isArray(c.pontos) && c.pontos.length > 0);
    } else if (filtroPrincipal === 'sem_gps') {
      list = list.filter(c => !Array.isArray(c.pontos) || c.pontos.length === 0);
    }

    if (buscaTexto.trim()) {
      const term = buscaTexto.toLowerCase();
      list = list.filter(c => 
        String(c.codCliente || '').toLowerCase().includes(term) ||
        String(c.cliente || '').toLowerCase().includes(term) ||
        String(c.municipio || '').toLowerCase().includes(term) ||
        String(c.bairro || '').toLowerCase().includes(term)
      );
    }

    return list;
  }, [todosClientes, filtroPrincipal, buscaTexto]);

  // Handlers de Aprovação e Recusa de Solicitações
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
        padrao: Boolean(novoPontoForm.padrao || (!modalGerenciarCliente.pontos || modalGerenciarCliente.pontos.length === 0)),
        criadoPor: 'Monitoramento'
      };

      await salvarPontoCliente(modalGerenciarCliente.codCliente, ponto, {
        cliente: modalGerenciarCliente.cliente,
        municipio: modalGerenciarCliente.municipio,
        bairro: modalGerenciarCliente.bairro
      });

      // Atualiza cliente no modal local
      const atualizados = (clientesGeoloc || []).find(c => 
        String(c?.codCliente || c?.id).trim() === String(modalGerenciarCliente.codCliente).trim()
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
        String(c?.codCliente || c?.id).trim() === String(modalGerenciarCliente.codCliente).trim()
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
        String(c?.codCliente || c?.id).trim() === String(modalGerenciarCliente.codCliente).trim()
      );
      if (atualizados) {
        setModalGerenciarCliente(atualizados);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBaixarModelo = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        'CODCLI': 1563,
        'CLIENTE': 'ATAKAREJO DISTRIBUIDOR DE ALIMENTOS E BEBIDAS S.A',
        'MUNICÍPIO': 'Salvador',
        'BAIRRO': 'Parque Bela Vista',
        'ENDEREÇO COMPLETO': 'Av. Santiago de Compostela, 499 - Parque Bela Vista / Brotas (Iguatemi), Salvador - BA, CEP 40279-150',
        'LATITUDE': -12.9824,
        'LONGITUDE': -38.4706,
        'LINK GOOGLE MAPS': 'https://www.google.com/maps/search/?api=1&query=Atakarejo+Iguatemi+Av+Santiago+de+Compostela+499+Salvador+BA'
      },
      {
        'CODCLI': 6031,
        'CLIENTE': 'ATAKAREJO DISTRIBUIDOR DE ALIMENTOS E BEBIDAS S.A',
        'MUNICÍPIO': 'Salvador',
        'BAIRRO': 'Piatã',
        'ENDEREÇO COMPLETO': 'Av. Octávio Mangabeira, s/n (próx. Av. Orlando Gomes) - Piatã, Salvador - BA, CEP 41650-000',
        'LATITUDE': -12.9528,
        'LONGITUDE': -38.3785,
        'LINK GOOGLE MAPS': 'https://www.google.com/maps/search/?api=1&query=Atakarejo+Piata+Av+Octavio+Mangabeira+Salvador+BA'
      }
    ], {
      header: ['CODCLI', 'CLIENTE', 'MUNICÍPIO', 'BAIRRO', 'ENDEREÇO COMPLETO', 'LATITUDE', 'LONGITUDE', 'LINK GOOGLE MAPS']
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo_GPS');
    XLSX.writeFile(wb, 'Modelo_Importacao_Geolocalizacao.xlsx');
  };

  const handleExportarExcel = () => {
    const rows = todosClientes.map(c => {
      const p = (c.pontos && c.pontos.length > 0) ? (c.pontos.find(pt => pt.padrao) || c.pontos[0]) : null;
      return {
        'CODCLI': c.codCliente,
        'CLIENTE': c.cliente,
        'MUNICÍPIO': c.municipio || '',
        'BAIRRO': c.bairro || '',
        'ENDEREÇO COMPLETO': p?.endereco || '',
        'LATITUDE': p?.lat !== undefined && p?.lat !== null ? p.lat : '',
        'LONGITUDE': p?.lng !== undefined && p?.lng !== null ? p.lng : '',
        'STATUS GPS': p?.lat ? 'PREENCHIDO' : 'PENDENTE',
        'TOTAL PONTOS': c.pontos?.length || 0,
        'LINK GOOGLE MAPS': p?.lat && p?.lng ? `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}` : ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes_GPS');
    XLSX.writeFile(wb, `Base_Clientes_Geolocalizacao_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleProcessarArquivoGps = async () => {
    if (!arquivoGps) return;
    setImportandoGps(true);
    setErroImportacaoGps('');

    try {
      const data = await arquivoGps.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

      if (!rawRows || rawRows.length === 0) {
        throw new Error('A planilha está vazia ou em formato incorreto.');
      }

      const normalizeKey = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]/g, '');

      const clientesParaSalvar = [];
      let ignorados = 0;

      for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i];
        
        let cod = '';
        let cliente = '';
        let municipio = '';
        let bairro = '';
        let endereco = '';
        let lat = null;
        let lng = null;

        for (const [key, val] of Object.entries(row)) {
          const norm = normalizeKey(key);
          if (norm.includes('cod') || norm === 'codigo' || norm === 'id') {
            cod = String(val).trim();
          } else if (norm.includes('cliente') || norm.includes('razao') || norm.includes('nome')) {
            cliente = String(val).trim();
          } else if (norm.includes('munic') || norm.includes('cidade')) {
            municipio = String(val).trim();
          } else if (norm.includes('bairro')) {
            bairro = String(val).trim();
          } else if (norm.includes('ender') || norm.includes('logradouro')) {
            endereco = String(val).trim();
          } else if (norm.startsWith('lat')) {
            const num = parseFloat(String(val).replace(',', '.'));
            if (!isNaN(num)) lat = num;
          } else if (norm.startsWith('long') || norm.startsWith('lng')) {
            const num = parseFloat(String(val).replace(',', '.'));
            if (!isNaN(num)) lng = num;
          }
        }

        if (!cod || lat === null || lng === null) {
          ignorados++;
          continue;
        }

        const ponto = {
          id: `ponto_imp_${Date.now()}_${i}`,
          nomeLocal: 'Ponto Principal',
          lat: lat,
          lng: lng,
          endereco: endereco,
          padrao: true,
          criadoPor: 'Importação Planilha',
          criadoEm: new Date().toISOString()
        };

        clientesParaSalvar.push({
          codCliente: cod,
          cliente: cliente || `Cliente ${cod}`,
          municipio: municipio,
          bairro: bairro,
          pontos: [ponto]
        });
      }

      if (clientesParaSalvar.length === 0) {
        throw new Error('Nenhum registro com Código do Cliente e Coordenadas (Latitude/Longitude) válidas foi encontrado.');
      }

      await importarClientesGeolocEmLote(clientesParaSalvar);

      setResultadoGps({
        total: rawRows.length,
        salvos: clientesParaSalvar.length,
        ignorados
      });

      setArquivoGps(null);
      if (inputGpsRef.current) inputGpsRef.current.value = '';
    } catch (err) {
      console.error(err);
      setErroImportacaoGps(err.message || 'Erro ao processar planilha.');
    } finally {
      setImportandoGps(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-background-secondary p-4 rounded-2xl border border-border-secondary shadow-xs">
        <div>
          <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Central de Geolocalização de Clientes & Redes
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Gerenciamento de coordenadas GPS, redes de supermercados, múltiplos pontos de descarga e rotas integradas (Maps / Waze).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleBaixarModelo}
            className="px-3 py-2 bg-background-primary hover:bg-background-tertiary text-text-secondary hover:text-text-primary border border-border-secondary rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
            title="Baixar modelo em Excel para preenchimento de GPS"
          >
            <FileSpreadsheet className="w-4 h-4 text-success" />
            <span>Modelo (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={handleExportarExcel}
            className="px-3 py-2 bg-background-primary hover:bg-background-tertiary text-text-secondary hover:text-text-primary border border-border-secondary rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
            title="Exportar toda a base cadastrada de clientes com GPS"
          >
            <DownloadCloud className="w-4 h-4 text-info" />
            <span>Exportar Base (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setModalImportar(true);
              setArquivoGps(null);
              setResultadoGps(null);
              setErroImportacaoGps('');
            }}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-primary/20"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Importar Planilha GPS</span>
          </button>
        </div>
      </div>

      {/* Cards de Métricas / KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div 
          onClick={() => setFiltroPrincipal('todos')}
          className={cn(
            "p-3.5 bg-background-secondary border rounded-xl shadow-sm flex items-center gap-3 cursor-pointer transition-all hover:scale-[1.01]",
            filtroPrincipal === 'todos' ? "border-primary ring-1 ring-primary" : "border-border-secondary"
          )}
        >
          <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-xl">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider block">Total Clientes</span>
            <span className="text-xl font-bold text-text-primary leading-tight">
              {todosClientes.length}
            </span>
          </div>
        </div>

        <div 
          onClick={() => setFiltroPrincipal('com_gps')}
          className={cn(
            "p-3.5 bg-background-secondary border rounded-xl shadow-sm flex items-center gap-3 cursor-pointer transition-all hover:scale-[1.01]",
            filtroPrincipal === 'com_gps' ? "border-emerald-500 ring-1 ring-emerald-500" : "border-border-secondary"
          )}
        >
          <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider block">Com GPS (Preenchido)</span>
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 leading-tight">
              {totalComGps} <span className="text-xs text-text-tertiary font-normal">({totalPontosMapeados} pontos)</span>
            </span>
          </div>
        </div>

        <div 
          onClick={() => setFiltroPrincipal('sem_gps')}
          className={cn(
            "p-3.5 bg-background-secondary border rounded-xl shadow-sm flex items-center gap-3 cursor-pointer transition-all hover:scale-[1.01]",
            filtroPrincipal === 'sem_gps' ? "border-rose-500 ring-1 ring-rose-500" : "border-border-secondary"
          )}
        >
          <div className="p-2.5 bg-rose-500/10 text-rose-500 rounded-xl">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider block">Sem GPS (Pendente)</span>
            <span className="text-xl font-bold text-rose-500 leading-tight">
              {totalSemGps}
            </span>
          </div>
        </div>

        <div 
          onClick={() => setFiltroPrincipal('solicitacoes')}
          className={cn(
            "p-3.5 bg-background-secondary border rounded-xl shadow-sm flex items-center gap-3 cursor-pointer transition-all hover:scale-[1.01]",
            filtroPrincipal === 'solicitacoes' ? "border-amber-500 ring-1 ring-amber-500" : "border-border-secondary"
          )}
        >
          <div className={cn(
            "p-2.5 rounded-xl",
            pendentesCount > 0 ? "bg-amber-500/15 text-amber-500 animate-pulse" : "bg-slate-500/10 text-slate-400"
          )}>
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider block">Solicitações Motorista</span>
            <span className={cn(
              "text-xl font-bold leading-tight",
              pendentesCount > 0 ? "text-amber-500" : "text-text-primary"
            )}>
              {pendentesCount} <span className="text-xs text-text-tertiary font-normal">pendente{pendentesCount !== 1 ? 's' : ''}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros Rápidos (Chips) */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between bg-background-secondary p-2.5 rounded-2xl border border-border-secondary shadow-sm">
        {/* Chips de Navegação / Filtro */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <button
            onClick={() => setFiltroPrincipal('todos')}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border",
              filtroPrincipal === 'todos'
                ? "bg-primary text-white border-primary shadow-sm"
                : "bg-background-primary text-text-secondary border-border-tertiary hover:bg-background-tertiary"
            )}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Todos os Clientes</span>
            <span className="px-1.5 py-0.2 bg-black/20 text-white text-[10px] rounded-full font-mono">
              {todosClientes.length}
            </span>
          </button>

          <button
            onClick={() => setFiltroPrincipal('sem_gps')}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border",
              filtroPrincipal === 'sem_gps'
                ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                : "bg-background-primary text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
            )}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Localização Pendente</span>
            <span className="px-1.5 py-0.2 bg-rose-500/20 text-rose-600 dark:text-rose-300 text-[10px] rounded-full font-mono">
              {totalSemGps}
            </span>
          </button>

          <button
            onClick={() => setFiltroPrincipal('com_gps')}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border",
              filtroPrincipal === 'com_gps'
                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                : "bg-background-primary text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
            )}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Localização Preenchida</span>
            <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 text-[10px] rounded-full font-mono">
              {totalComGps}
            </span>
          </button>

          <button
            onClick={() => setFiltroPrincipal('solicitacoes')}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border",
              filtroPrincipal === 'solicitacoes'
                ? "bg-amber-500 text-slate-950 border-amber-500 shadow-sm font-black"
                : "bg-background-primary text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
            )}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Solicitações Motorista</span>
            {pendentesCount > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-400 text-slate-950 text-[10px] rounded-full font-black animate-pulse">
                {pendentesCount}
              </span>
            )}
          </button>
        </div>

        {/* Input de Busca Rápida */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            type="text"
            placeholder="Buscar por Cód. Cliente, Nome, Cidade, Bairro..."
            value={buscaTexto}
            onChange={(e) => setBuscaTexto(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs bg-background-primary border border-border-secondary rounded-xl text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {buscaTexto && (
            <button
              onClick={() => setBuscaTexto('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Conteúdo: LISTA DE CLIENTES (Todos / Pendentes / Preenchidos) */}
      {filtroPrincipal !== 'solicitacoes' && (
        <div className="space-y-3">
          <div className="bg-background-secondary rounded-2xl border border-border-secondary overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-background-tertiary/60 border-b border-border-secondary text-text-tertiary font-bold uppercase tracking-wider">
                    <th className="py-3 px-4 w-28">Cód. Cliente</th>
                    <th className="py-3 px-4">Cliente / Razão Social</th>
                    <th className="py-3 px-4">Município / Bairro</th>
                    <th className="py-3 px-4 text-center w-36">Status GPS</th>
                    <th className="py-3 px-4 text-center w-28">Navegação</th>
                    <th className="py-3 px-4 text-right w-36">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-tertiary/40">
                  {clientesFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-text-tertiary">
                        <MapPinned className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="font-semibold text-text-secondary text-sm">Nenhum cliente encontrado</p>
                        <p className="text-xs text-text-tertiary mt-0.5">Tente ajustar a busca ou o filtro selecionado.</p>
                      </td>
                    </tr>
                  ) : (
                    clientesFiltrados.map((cli) => {
                      const temGps = Array.isArray(cli.pontos) && cli.pontos.length > 0;
                      const pontoPadrao = temGps ? (cli.pontos.find(p => p.padrao) || cli.pontos[0]) : null;

                      return (
                        <tr 
                          key={cli.codCliente}
                          className="hover:bg-background-tertiary/40 transition-colors"
                        >
                          {/* Código do Cliente */}
                          <td className="py-3.5 px-4 font-mono font-black text-text-primary">
                            <span className="px-2 py-1 bg-background-primary border border-border-tertiary rounded-lg inline-block">
                              {cli.codCliente}
                            </span>
                          </td>

                          {/* Nome do Cliente */}
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-text-primary text-sm block leading-snug">
                              {cli.cliente}
                            </span>
                            {temGps && pontoPadrao && (
                              <span className="text-[11px] text-text-tertiary flex items-center gap-1 mt-0.5">
                                <span className="font-semibold text-text-secondary">{pontoPadrao.nomeLocal || 'Principal'}:</span>
                                <span className="font-mono">{Number(pontoPadrao.lat).toFixed(5)}, {Number(pontoPadrao.lng).toFixed(5)}</span>
                              </span>
                            )}
                          </td>

                          {/* Município / Bairro */}
                          <td className="py-3.5 px-4 text-text-secondary">
                            <div className="font-medium text-text-primary">{cli.municipio || '-'}</div>
                            <div className="text-[11px] text-text-tertiary">{cli.bairro || ''}</div>
                          </td>

                          {/* Status GPS */}
                          <td className="py-3.5 px-4 text-center">
                            {temGps ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold rounded-xl text-[11px] border border-emerald-500/20">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {cli.pontos.length} ponto{cli.pontos.length !== 1 ? 's' : ''}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold rounded-xl text-[11px] border border-rose-500/20">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Pendente
                              </span>
                            )}
                          </td>

                          {/* Links Rápidos de Navegação */}
                          <td className="py-3.5 px-4 text-center">
                            {temGps && pontoPadrao && pontoPadrao.lat && pontoPadrao.lng ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <a
                                  href={`https://www.google.com/maps/dir/?api=1&destination=${pontoPadrao.lat},${pontoPadrao.lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 bg-background-primary hover:bg-emerald-500/20 text-emerald-600 border border-border-secondary rounded-lg text-[11px] font-semibold transition-all shadow-xs"
                                  title="Abrir no Google Maps"
                                >
                                  <MapIcon className="w-3.5 h-3.5" />
                                </a>
                                <a
                                  href={`https://waze.com/ul?ll=${pontoPadrao.lat},${pontoPadrao.lng}&navigate=yes`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 bg-background-primary hover:bg-cyan-500/20 text-cyan-600 border border-border-secondary rounded-lg text-[11px] font-semibold transition-all shadow-xs"
                                  title="Abrir no Waze"
                                >
                                  <Navigation className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            ) : (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${cli.cliente} ${cli.municipio || ''} ${cli.bairro || ''}`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-text-tertiary hover:text-primary transition-colors"
                                title="Pesquisar endereço no Google Maps"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Buscar</span>
                              </a>
                            )}
                          </td>

                          {/* Ações */}
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setModalGerenciarCliente(cli);
                                setModalNovoPonto(false);
                              }}
                              className={cn(
                                "px-3 py-1.5 font-bold rounded-xl text-xs transition-all shadow-xs",
                                temGps
                                  ? "bg-background-tertiary hover:bg-border-tertiary text-text-primary border border-border-secondary"
                                  : "bg-primary hover:bg-primary/90 text-white shadow-primary/20"
                              )}
                            >
                              {temGps ? 'Gerenciar Locais' : '+ Cadastrar GPS'}
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

      {/* Conteúdo: SOLICITAÇÕES ENVIADAS PELOS MOTORISTAS */}
      {filtroPrincipal === 'solicitacoes' && (
        <div className="space-y-3">
          {/* Sub-filtro de status das solicitações */}
          <div className="flex gap-1.5 overflow-x-auto bg-background-secondary p-1.5 rounded-xl border border-border-secondary">
            {['Pendente', 'Aprovado', 'Recusado', 'Todos'].map((st) => (
              <button
                key={st}
                onClick={() => setFiltroStatusSolic(st)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors",
                  filtroStatusSolic === st
                    ? "bg-primary text-white shadow-sm font-bold"
                    : "text-text-secondary hover:text-text-primary hover:bg-background-tertiary"
                )}
              >
                {st}
              </button>
            ))}
          </div>

          {solicitacoesFiltradas.length === 0 ? (
            <div className="text-center py-12 bg-background-secondary rounded-2xl border border-border-secondary">
              <Compass className="w-12 h-12 text-text-tertiary opacity-40 mx-auto mb-2" />
              <p className="text-sm font-semibold text-text-primary">Nenhuma solicitação encontrada</p>
              <p className="text-xs text-text-tertiary mt-1">
                Quando os motoristas enviarem coordenadas pelo celular na porta do cliente, elas aparecerão aqui para aprovação.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {solicitacoesFiltradas.map((solic) => {
                const isPendente = solic?.status === 'Pendente';
                const isAprovado = solic?.status === 'Aprovado';
                const isRecusado = solic?.status === 'Recusado';

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
                          <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono font-bold text-xs rounded-md">
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
                          {Number(solic.lat || 0).toFixed(6)}, {Number(solic.lng || 0).toFixed(6)}
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
                          <MapIcon className="w-3.5 h-3.5" />
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
                  <span className="text-xs font-bold px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-md font-mono">
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
                  Locais Cadastrados ({Array.isArray(modalGerenciarCliente.pontos) ? modalGerenciarCliente.pontos.length : 0})
                </span>
                {!modalNovoPonto && (
                  <button
                    type="button"
                    onClick={() => setModalNovoPonto(true)}
                    className="flex items-center gap-1 text-xs font-bold text-primary hover:underline bg-primary/10 px-3 py-1.5 rounded-lg"
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
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${modalGerenciarCliente.cliente} ${modalGerenciarCliente.municipio || ''} ${modalGerenciarCliente.bairro || ''}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Buscar no Google Maps
                    </a>
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

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setModalNovoPonto(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg"
                    >
                      Cancelar
                    </button>
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
                          {Number(ponto.lat || 0).toFixed(6)}, {Number(ponto.lng || 0).toFixed(6)}
                          {ponto.criadoPor && <span className="font-sans ml-2 text-slate-400">• {ponto.criadoPor}</span>}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {ponto.lat && ponto.lng && (
                          <>
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${ponto.lat},${ponto.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500/20 text-emerald-600 rounded-lg"
                              title="Google Maps"
                            >
                              <MapIcon className="w-3.5 h-3.5" />
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
                          </>
                        )}

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

      {/* MODAL DE IMPORTAÇÃO DE PLANILHA GPS */}
      {modalImportar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-background-secondary border border-border-secondary w-full max-w-lg rounded-3xl shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-text-primary">Importar Planilha de GPS</h3>
                  <p className="text-xs text-text-tertiary">Alimente ou atualize a base de coordenadas dos clientes em lote</p>
                </div>
              </div>
              <button
                onClick={() => setModalImportar(false)}
                className="p-1.5 text-text-tertiary hover:text-text-primary rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Upload Area */}
            {!resultadoGps && (
              <div className="space-y-4">
                <div 
                  onClick={() => inputGpsRef.current?.click()}
                  className="border-2 border-dashed border-border-secondary hover:border-primary/50 bg-background-primary/50 hover:bg-primary/5 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
                >
                  <input
                    type="file"
                    ref={inputGpsRef}
                    accept=".xlsx, .xls, .csv"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setArquivoGps(f);
                        setErroImportacaoGps('');
                      }
                    }}
                    className="hidden"
                  />
                  <div className="p-3 bg-primary/10 text-primary rounded-2xl group-hover:scale-110 transition-transform">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-text-primary">
                      {arquivoGps ? arquivoGps.name : 'Clique para selecionar a planilha (.xlsx, .xls, .csv)'}
                    </p>
                    <p className="text-[11px] text-text-tertiary mt-0.5">
                      {arquivoGps ? `${(arquivoGps.size / 1024).toFixed(1)} KB` : 'Reconhecimento inteligente de colunas: CODCLI, CLIENTE, LATITUDE, LONGITUDE'}
                    </p>
                  </div>
                </div>

                <div className="bg-background-primary/60 border border-border-tertiary rounded-xl p-3 text-xs text-text-secondary space-y-1">
                  <span className="font-bold text-text-primary block text-[11px] uppercase tracking-wider">Colunas Identificadas:</span>
                  <p className="text-[11px] text-text-tertiary leading-relaxed">
                    A planilha pode conter: <strong>CODCLI</strong> (ou Código), <strong>CLIENTE</strong>, <strong>MUNICÍPIO</strong>, <strong>BAIRRO</strong>, <strong>ENDEREÇO</strong>, <strong>LATITUDE</strong> e <strong>LONGITUDE</strong>.
                  </p>
                </div>

                {erroImportacaoGps && (
                  <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-xs text-danger font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{erroImportacaoGps}</span>
                  </div>
                )}
              </div>
            )}

            {/* Resultado Sucesso */}
            {resultadoGps && (
              <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-3 animate-fade-in">
                <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400 font-bold">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span>Importação Concluída com Sucesso!</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 bg-background-primary rounded-xl border border-emerald-500/20">
                    <span className="text-text-tertiary block text-[10px] uppercase font-bold">Clientes Cadastrados/Atualizados</span>
                    <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{resultadoGps.salvos}</span>
                  </div>
                  <div className="p-2.5 bg-background-primary rounded-xl border border-border-tertiary">
                    <span className="text-text-tertiary block text-[10px] uppercase font-bold">Linhas Ignoradas (S/ GPS)</span>
                    <span className="text-lg font-bold text-text-secondary">{resultadoGps.ignorados}</span>
                  </div>
                </div>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                  Todas as novas coordenadas já estão ativas para navegação no Google Maps e Waze!
                </p>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-tertiary">
              <button
                type="button"
                onClick={() => setModalImportar(false)}
                className="px-4 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-background-tertiary rounded-xl transition-colors"
              >
                {resultadoGps ? 'Concluir' : 'Cancelar'}
              </button>

              {!resultadoGps && (
                <button
                  type="button"
                  disabled={!arquivoGps || importandoGps}
                  onClick={handleProcessarArquivoGps}
                  className="px-5 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md shadow-primary/20 flex items-center gap-1.5 transition-all"
                >
                  {importandoGps ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                  <span>{importandoGps ? 'Importando Coordenadas...' : 'Processar e Salvar'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}