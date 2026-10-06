import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  MapPin, Navigation, Map as MapIcon, Search, Plus, Trash2, CheckCircle2, 
  XCircle, Clock, AlertTriangle, ExternalLink, Compass, ShieldCheck, 
  Check, X, Edit3, User, Truck, Building2, ChevronRight, RefreshCw,
  Filter, Globe, MapPinned, UploadCloud, DownloadCloud, FileSpreadsheet, Loader2, FileText,
  Boxes, Layers, Tags, Tag, Users, CheckSquare, Square, Palette, PlusCircle, Sparkles, FolderPlus
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';

export const GRUPO_CORES = {
  emerald: {
    name: 'Esmeralda',
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-500/30',
    badge: 'bg-emerald-600 text-white',
    hex: '#10B981',
    ring: 'ring-emerald-500'
  },
  blue: {
    name: 'Azul',
    bg: 'bg-blue-500/10 dark:bg-blue-500/20',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-500/30',
    badge: 'bg-blue-600 text-white',
    hex: '#3B82F6',
    ring: 'ring-blue-500'
  },
  purple: {
    name: 'Roxo',
    bg: 'bg-purple-500/10 dark:bg-purple-500/20',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-500/30',
    badge: 'bg-purple-600 text-white',
    hex: '#8B5CF6',
    ring: 'ring-purple-500'
  },
  amber: {
    name: 'Âmbar',
    bg: 'bg-amber-500/10 dark:bg-amber-500/20',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-500/30',
    badge: 'bg-amber-500 text-slate-950',
    hex: '#F59E0B',
    ring: 'ring-amber-500'
  },
  rose: {
    name: 'Rosa',
    bg: 'bg-rose-500/10 dark:bg-rose-500/20',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-500/30',
    badge: 'bg-rose-600 text-white',
    hex: '#F43F5E',
    ring: 'ring-rose-500'
  },
  cyan: {
    name: 'Ciano',
    bg: 'bg-cyan-500/10 dark:bg-cyan-500/20',
    text: 'text-cyan-700 dark:text-cyan-300',
    border: 'border-cyan-500/30',
    badge: 'bg-cyan-600 text-white',
    hex: '#06B6D4',
    ring: 'ring-cyan-500'
  },
  orange: {
    name: 'Laranja',
    bg: 'bg-orange-500/10 dark:bg-orange-500/20',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-500/30',
    badge: 'bg-orange-600 text-white',
    hex: '#F97316',
    ring: 'ring-orange-500'
  },
  indigo: {
    name: 'Índigo',
    bg: 'bg-indigo-500/10 dark:bg-indigo-500/20',
    text: 'text-indigo-700 dark:text-indigo-300',
    border: 'border-indigo-500/30',
    badge: 'bg-indigo-600 text-white',
    hex: '#6366F1',
    ring: 'ring-indigo-500'
  }
};

export function PainelGeolocalizacao() {
  const [searchParams] = useSearchParams();
  const { 
    clientesGeoloc = [], 
    solicitacoesGeoloc = [], 
    gruposClientes = [],
    entregas = [],
    salvarPontoCliente, 
    removerPontoCliente, 
    importarClientesGeolocEmLote,
    aprovarSolicitacaoGeoloc, 
    recusarSolicitacaoGeoloc,
    salvarGrupoCliente,
    removerGrupoCliente,
    atribuirClientesAoGrupo,
    removerClienteDoGrupo
  } = useStore();

  const pendentesCount = useMemo(() => {
    return (solicitacoesGeoloc || []).filter(s => s && s.status === 'Pendente').length;
  }, [solicitacoesGeoloc]);

  // Filtro principal: 'todos' | 'grupos' | 'sem_gps' | 'com_gps' | 'solicitacoes'
  const [filtroPrincipal, setFiltroPrincipal] = useState('todos');
  const [filtroGrupo, setFiltroGrupo] = useState('todos'); // 'todos' | grupo.id
  const [filtroStatusSolic, setFiltroStatusSolic] = useState('Pendente'); // 'Pendente' | 'Aprovado' | 'Recusado' | 'Todos'
  const [buscaTexto, setBuscaTexto] = useState('');

  // Modais de Grupos
  const [modalGrupo, setModalGrupo] = useState(null); // null | { id, nome, cor, descricao, codClientes: [] }
  const [grupoBuscaCliente, setGrupoBuscaCliente] = useState('');
  const [salvandoGrupo, setSalvandoGrupo] = useState(false);

  // Sincronizar com parâmetros de rota/URL ao abrir via notificação
  useEffect(() => {
    const aba = searchParams.get('aba') || searchParams.get('filtro');
    if (aba === 'solicitacoes' || aba === 'solicitacao' || aba === 'gps') {
      setFiltroPrincipal('solicitacoes');
    } else if (aba === 'grupos' || aba === 'redes') {
      setFiltroPrincipal('grupos');
    }
    const solicId = searchParams.get('solicId') || searchParams.get('id');
    if (solicId && (solicitacoesGeoloc || []).length > 0) {
      const encontrada = (solicitacoesGeoloc || []).find(s => String(s?.id) === String(solicId));
      if (encontrada) {
        setFiltroPrincipal('solicitacoes');
        if ((encontrada.status || '').toLowerCase() === 'pendente') {
          setModalAprovar(encontrada);
          setNomeLocalAprovado(encontrada.nomeLocalSugerido || 'Ponto de Descarga');
        }
      }
    }
  }, [searchParams, solicitacoesGeoloc]);

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

  // Mapeamento de Códigos de Cliente para seus respectivos Grupos/Redes
  const codClienteToGrupos = useMemo(() => {
    const map = new globalThis.Map();
    (gruposClientes || []).forEach(g => {
      if (!g || !Array.isArray(g.codClientes)) return;
      g.codClientes.forEach(cod => {
        const codStr = String(cod).trim();
        if (!codStr) return;
        if (!map.has(codStr)) {
          map.set(codStr, []);
        }
        map.get(codStr).push(g);
      });
    });
    return map;
  }, [gruposClientes]);

  // Lista de clientes filtrados para a listagem
  const clientesFiltrados = useMemo(() => {
    let list = todosClientes;

    if (filtroPrincipal === 'com_gps') {
      list = list.filter(c => Array.isArray(c.pontos) && c.pontos.length > 0);
    } else if (filtroPrincipal === 'sem_gps') {
      list = list.filter(c => !Array.isArray(c.pontos) || c.pontos.length === 0);
    }

    if (filtroGrupo !== 'todos') {
      const grupoAtivo = (gruposClientes || []).find(g => g.id === filtroGrupo);
      if (grupoAtivo && Array.isArray(grupoAtivo.codClientes)) {
        const setCod = new Set(grupoAtivo.codClientes.map(String));
        list = list.filter(c => setCod.has(String(c.codCliente)));
      }
    }

    if (buscaTexto.trim()) {
      const term = buscaTexto.toLowerCase();
      list = list.filter(c => {
        const gruposDoCliente = codClienteToGrupos.get(String(c.codCliente).trim()) || [];
        const matchGrupoNome = gruposDoCliente.some(g => String(g.nome || '').toLowerCase().includes(term));
        return (
          String(c.codCliente || '').toLowerCase().includes(term) ||
          String(c.cliente || '').toLowerCase().includes(term) ||
          String(c.municipio || '').toLowerCase().includes(term) ||
          String(c.bairro || '').toLowerCase().includes(term) ||
          matchGrupoNome
        );
      });
    }

    return list;
  }, [todosClientes, filtroPrincipal, filtroGrupo, buscaTexto, gruposClientes, codClienteToGrupos]);

  // Lista de clientes filtrados na busca do modal de grupo
  const clientesFiltradosGrupoModal = useMemo(() => {
    if (!grupoBuscaCliente.trim()) return todosClientes;
    const term = grupoBuscaCliente.toLowerCase();
    return todosClientes.filter(c => 
      String(c.codCliente || '').toLowerCase().includes(term) ||
      String(c.cliente || '').toLowerCase().includes(term) ||
      String(c.municipio || '').toLowerCase().includes(term) ||
      String(c.bairro || '').toLowerCase().includes(term)
    );
  }, [todosClientes, grupoBuscaCliente]);

  // Handlers de Grupos
  const handleAbrirCriarGrupo = () => {
    setModalGrupo({
      id: '',
      nome: '',
      cor: 'emerald',
      descricao: '',
      codClientes: []
    });
    setGrupoBuscaCliente('');
  };

  const handleAbrirEditarGrupo = (grupo) => {
    setModalGrupo({
      id: grupo.id,
      nome: grupo.nome || '',
      cor: grupo.cor || 'emerald',
      descricao: grupo.descricao || '',
      codClientes: Array.isArray(grupo.codClientes) ? [...grupo.codClientes] : []
    });
    setGrupoBuscaCliente('');
  };

  const handleSalvarGrupo = async (e) => {
    if (e) e.preventDefault();
    if (!modalGrupo || !modalGrupo.nome.trim()) {
      alert('Por favor, informe o nome do grupo / rede (ex: Atakarejo).');
      return;
    }

    setSalvandoGrupo(true);
    try {
      await salvarGrupoCliente({
        ...modalGrupo,
        nome: modalGrupo.nome.trim(),
        descricao: (modalGrupo.descricao || '').trim(),
        cor: modalGrupo.cor || 'emerald',
        codClientes: modalGrupo.codClientes || []
      });
      setModalGrupo(null);
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar grupo.');
    } finally {
      setSalvandoGrupo(false);
    }
  };

  const handleExcluirGrupo = async (grupo) => {
    if (!grupo) return;
    if (!confirm(`Deseja realmente excluir o grupo "${grupo.nome}"? Os clientes não serão apagados, apenas desvinculados.`)) return;
    try {
      await removerGrupoCliente(grupo.id);
      if (filtroGrupo === grupo.id) {
        setFiltroGrupo('todos');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir grupo.');
    }
  };

  const handleToggleClienteNoGrupoModal = (codCliente) => {
    if (!modalGrupo) return;
    const codStr = String(codCliente).trim();
    const current = new Set(modalGrupo.codClientes || []);
    if (current.has(codStr)) {
      current.delete(codStr);
    } else {
      current.add(codStr);
    }
    setModalGrupo({
      ...modalGrupo,
      codClientes: Array.from(current)
    });
  };

  const handleSelecionarTodosBuscaGrupo = (clientesParaAdicionar) => {
    if (!modalGrupo) return;
    const current = new Set(modalGrupo.codClientes || []);
    clientesParaAdicionar.forEach(c => {
      if (c && c.codCliente) current.add(String(c.codCliente).trim());
    });
    setModalGrupo({
      ...modalGrupo,
      codClientes: Array.from(current)
    });
  };

  const handleDesmarcarTodosBuscaGrupo = (clientesParaRemover) => {
    if (!modalGrupo) return;
    const current = new Set(modalGrupo.codClientes || []);
    clientesParaRemover.forEach(c => {
      if (c && c.codCliente) current.delete(String(c.codCliente).trim());
    });
    setModalGrupo({
      ...modalGrupo,
      codClientes: Array.from(current)
    });
  };

  const handleToggleGrupoParaCliente = async (grupoId, codCliente) => {
    const codStr = String(codCliente).trim();
    const grupo = (gruposClientes || []).find(g => g.id === grupoId);
    if (!grupo) return;
    const jaPertence = Array.isArray(grupo.codClientes) && grupo.codClientes.includes(codStr);

    try {
      if (jaPertence) {
        await removerClienteDoGrupo(grupoId, codStr);
      } else {
        await atribuirClientesAoGrupo(grupoId, [codStr]);
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar grupo do cliente.');
    }
  };

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
    <div className="space-y-4 w-full">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-background-secondary p-4 rounded-2xl border border-border-secondary shadow-xs">
        <div>
          <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Central de Clientes, Redes & Geolocalização
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Gerenciamento de grupos de clientes (ex: Atakarejo, Rede Mix), coordenadas GPS e múltiplos pontos de descarga.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleAbrirCriarGrupo}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
            title="Cadastrar um novo grupo ou rede de clientes (ex: Atakarejo, Rede Mix, Hiperideal)"
          >
            <Boxes className="w-4 h-4" />
            <span>+ Novo Grupo / Rede</span>
          </button>

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
            <span>Importar GPS</span>
          </button>
        </div>
      </div>

      {/* Cards de Métricas / KPI (5 colunas) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div 
          onClick={() => { setFiltroPrincipal('todos'); setFiltroGrupo('todos'); }}
          className={cn(
            "p-3.5 bg-background-secondary border rounded-xl shadow-sm flex items-center gap-3 cursor-pointer transition-all hover:scale-[1.01]",
            filtroPrincipal === 'todos' && filtroGrupo === 'todos' ? "border-primary ring-1 ring-primary" : "border-border-secondary"
          )}
        >
          <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-xl shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider block truncate">Total Clientes</span>
            <span className="text-xl font-bold text-text-primary leading-tight">
              {todosClientes.length}
            </span>
          </div>
        </div>

        <div 
          onClick={() => setFiltroPrincipal('grupos')}
          className={cn(
            "p-3.5 bg-background-secondary border rounded-xl shadow-sm flex items-center gap-3 cursor-pointer transition-all hover:scale-[1.01]",
            filtroPrincipal === 'grupos' ? "border-emerald-500 ring-1 ring-emerald-500" : "border-border-secondary"
          )}
        >
          <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl shrink-0">
            <Boxes className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider block truncate">Grupos & Redes</span>
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 leading-tight">
              {gruposClientes.length} <span className="text-xs text-text-tertiary font-normal">redes</span>
            </span>
          </div>
        </div>

        <div 
          onClick={() => { setFiltroPrincipal('com_gps'); setFiltroGrupo('todos'); }}
          className={cn(
            "p-3.5 bg-background-secondary border rounded-xl shadow-sm flex items-center gap-3 cursor-pointer transition-all hover:scale-[1.01]",
            filtroPrincipal === 'com_gps' ? "border-emerald-500 ring-1 ring-emerald-500" : "border-border-secondary"
          )}
        >
          <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider block truncate">Com GPS</span>
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 leading-tight">
              {totalComGps} <span className="text-xs text-text-tertiary font-normal">({totalPontosMapeados} pts)</span>
            </span>
          </div>
        </div>

        <div 
          onClick={() => { setFiltroPrincipal('sem_gps'); setFiltroGrupo('todos'); }}
          className={cn(
            "p-3.5 bg-background-secondary border rounded-xl shadow-sm flex items-center gap-3 cursor-pointer transition-all hover:scale-[1.01]",
            filtroPrincipal === 'sem_gps' ? "border-rose-500 ring-1 ring-rose-500" : "border-border-secondary"
          )}
        >
          <div className="p-2.5 bg-rose-500/10 text-rose-500 rounded-xl shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider block truncate">Sem GPS</span>
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
            "p-2.5 rounded-xl shrink-0",
            pendentesCount > 0 ? "bg-amber-500/15 text-amber-500 animate-pulse" : "bg-slate-500/10 text-slate-400"
          )}>
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider block truncate">Solicitações</span>
            <span className={cn(
              "text-xl font-bold leading-tight",
              pendentesCount > 0 ? "text-amber-500" : "text-text-primary"
            )}>
              {pendentesCount} <span className="text-xs text-text-tertiary font-normal">pend.</span>
            </span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros Rápidos (Chips & Seletor de Grupo) */}
      <div className="flex flex-col lg:flex-row gap-2.5 items-stretch lg:items-center justify-between bg-background-secondary p-2.5 rounded-2xl border border-border-secondary shadow-sm">
        {/* Chips de Navegação / Filtro */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 lg:pb-0 flex-wrap">
          <button
            onClick={() => { setFiltroPrincipal('todos'); }}
            className={cn(
              "px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 border shrink-0 whitespace-nowrap cursor-pointer",
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
            onClick={() => setFiltroPrincipal('grupos')}
            className={cn(
              "px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 border shrink-0 whitespace-nowrap cursor-pointer",
              filtroPrincipal === 'grupos'
                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                : "bg-background-primary text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
            )}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>Grupos & Redes</span>
            <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] rounded-full font-mono">
              {gruposClientes.length}
            </span>
          </button>

          <button
            onClick={() => setFiltroPrincipal('sem_gps')}
            className={cn(
              "px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 border shrink-0 whitespace-nowrap cursor-pointer",
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
              "px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 border shrink-0 whitespace-nowrap cursor-pointer",
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
              "px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 border shrink-0 whitespace-nowrap cursor-pointer",
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

        {/* Direita: Filtro por Grupo Dropdown + Input de Busca Rápida */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {filtroPrincipal !== 'solicitacoes' && filtroPrincipal !== 'grupos' && gruposClientes.length > 0 && (
            <div className="relative min-w-[170px]">
              <select
                value={filtroGrupo}
                onChange={(e) => setFiltroGrupo(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-background-primary border border-border-secondary rounded-xl text-text-primary font-bold focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer appearance-none pr-7"
              >
                <option value="todos">Todas as Redes</option>
                {gruposClientes.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.nome} ({Array.isArray(g.codClientes) ? g.codClientes.length : 0})
                  </option>
                ))}
              </select>
              <Boxes className="w-3.5 h-3.5 text-text-tertiary absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              type="text"
              placeholder={filtroPrincipal === 'grupos' ? "Buscar grupos ou redes..." : "Buscar por Cód., Nome, Rede, Cidade..."}
              value={buscaTexto}
              onChange={(e) => setBuscaTexto(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs bg-background-primary border border-border-secondary rounded-xl text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {buscaTexto && (
              <button
                onClick={() => setBuscaTexto('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Conteúdo: GESTÃO DE GRUPOS & REDES */}
      {filtroPrincipal === 'grupos' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-background-secondary p-4 rounded-2xl border border-border-secondary">
            <div>
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Boxes className="w-4 h-4 text-emerald-500" />
                Grupos e Redes de Clientes
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                Agrupe clientes de uma mesma rede (ex: Atakarejo, Rede Mix, Hiperideal, Mercantil) para filtros rápidos e relatórios consolidados.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAbrirCriarGrupo}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/20 cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Grupo / Rede</span>
            </button>
          </div>

          {gruposClientes.length === 0 ? (
            <div className="py-14 text-center text-text-tertiary bg-background-secondary rounded-2xl border border-border-secondary p-6">
              <Boxes className="w-12 h-12 mx-auto mb-3 opacity-30 text-emerald-500" />
              <h4 className="font-bold text-text-primary text-base">Nenhum grupo cadastrado ainda</h4>
              <p className="text-xs text-text-tertiary mt-1 max-w-md mx-auto">
                Crie grupos para reunir lojas de grandes redes como Atakarejo, Rede Mix, Assaí e Hiperideal. Isso vai permitir filtrar todas as lojas de uma vez na aba Relatórios e Monitoramento.
              </p>
              <button
                type="button"
                onClick={handleAbrirCriarGrupo}
                className="mt-4 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-all shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Criar Primeiro Grupo</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {gruposClientes
                .filter(g => {
                  if (!buscaTexto.trim()) return true;
                  const term = buscaTexto.toLowerCase();
                  return (
                    g.nome?.toLowerCase().includes(term) ||
                    g.descricao?.toLowerCase().includes(term)
                  );
                })
                .map((grupo) => {
                  const corInfo = GRUPO_CORES[grupo.cor] || GRUPO_CORES.emerald;
                  const codigos = Array.isArray(grupo.codClientes) ? grupo.codClientes : [];
                  const clientesDoGrupo = todosClientes.filter(c => codigos.includes(String(c.codCliente).trim()));

                  return (
                    <div
                      key={grupo.id}
                      className="bg-background-secondary border border-border-secondary hover:border-border-tertiary rounded-2xl p-4 shadow-sm flex flex-col justify-between space-y-4 transition-all"
                    >
                      <div>
                        {/* Header do Card de Grupo */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className={cn("p-2.5 rounded-xl", corInfo.bg, corInfo.text)}>
                              <Boxes className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="font-bold text-text-primary text-sm leading-tight">
                                {grupo.nome}
                              </h4>
                              <span className="text-[11px] text-text-tertiary font-medium block mt-0.5">
                                {clientesDoGrupo.length} loja{clientesDoGrupo.length !== 1 ? 's' : ''} cadastrada{clientesDoGrupo.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>

                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10.5px] font-bold border",
                            corInfo.bg, corInfo.text, corInfo.border
                          )}>
                            {corInfo.name}
                          </span>
                        </div>

                        {grupo.descricao && (
                          <p className="text-xs text-text-secondary mt-2.5 line-clamp-2">
                            {grupo.descricao}
                          </p>
                        )}

                        {/* Amostra das lojas vinculadas */}
                        <div className="mt-3.5 pt-3 border-t border-border-tertiary/60 space-y-1.5">
                          <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-tertiary block">
                            Lojas Vinculadas:
                          </span>
                          {clientesDoGrupo.length === 0 ? (
                            <p className="text-xs text-text-tertiary italic">Nenhum cliente vinculado ainda.</p>
                          ) : (
                            <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                              {clientesDoGrupo.slice(0, 5).map(c => (
                                <div key={c.codCliente} className="flex items-center justify-between text-[11px] text-text-secondary bg-background-primary/60 px-2 py-1 rounded-lg">
                                  <span className="truncate max-w-[180px] font-medium">{c.cliente}</span>
                                  <span className="font-mono text-text-tertiary text-[10px] ml-1 shrink-0">Cód: {c.codCliente}</span>
                                </div>
                              ))}
                              {clientesDoGrupo.length > 5 && (
                                <div className="text-[10px] text-center text-text-tertiary pt-0.5 font-semibold">
                                  + {clientesDoGrupo.length - 5} outra{clientesDoGrupo.length - 5 !== 1 ? 's' : ''} loja{clientesDoGrupo.length - 5 !== 1 ? 's' : ''}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Ações do Card de Grupo */}
                      <div className="flex items-center justify-between gap-2 pt-3 border-t border-border-tertiary/60">
                        <button
                          type="button"
                          onClick={() => {
                            setFiltroGrupo(grupo.id);
                            setFiltroPrincipal('todos');
                          }}
                          className="px-3 py-1.5 bg-background-primary hover:bg-background-tertiary text-text-primary border border-border-secondary rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <Filter className="w-3.5 h-3.5 text-primary" />
                          <span>Filtrar Lojas</span>
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleAbrirEditarGrupo(grupo)}
                            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-background-tertiary rounded-xl transition-colors cursor-pointer"
                            title="Editar Grupo"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExcluirGrupo(grupo)}
                            className="p-1.5 text-text-tertiary hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
                            title="Excluir Grupo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* Conteúdo: LISTA DE CLIENTES (Todos / Pendentes / Preenchidos) */}
      {filtroPrincipal !== 'solicitacoes' && filtroPrincipal !== 'grupos' && (
        <div className="space-y-3">
          {/* Indicador de Filtro de Grupo Ativo */}
          {filtroGrupo !== 'todos' && (
            <div className="flex items-center justify-between p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs">
              <div className="flex items-center gap-2">
                <Boxes className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-text-secondary">
                  Filtrando por Rede: <strong className="text-text-primary">{gruposClientes.find(g => g.id === filtroGrupo)?.nome}</strong> ({clientesFiltrados.length} clientes encontrados)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setFiltroGrupo('todos')}
                className="text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:underline cursor-pointer"
              >
                Limpar Filtro de Rede
              </button>
            </div>
          )}

          {/* 1. VISÃO EM CARDS PARA DISPOSITIVOS MÓVEIS (md:hidden) */}
          <div className="md:hidden space-y-2.5">
            {clientesFiltrados.length === 0 ? (
              <div className="py-10 text-center text-text-tertiary bg-background-secondary rounded-2xl border border-border-secondary p-4">
                <MapPinned className="w-10 h-10 mx-auto mb-2 opacity-30 text-primary" />
                <p className="font-semibold text-text-secondary text-sm">Nenhum cliente encontrado</p>
                <p className="text-xs text-text-tertiary mt-0.5">Tente ajustar a busca ou o filtro selecionado.</p>
              </div>
            ) : (
              clientesFiltrados.map((cli) => {
                const temGps = Array.isArray(cli.pontos) && cli.pontos.length > 0;
                const pontoPadrao = temGps ? (cli.pontos.find(p => p.padrao) || cli.pontos[0]) : null;
                const gruposDoCliente = codClienteToGrupos.get(String(cli.codCliente).trim()) || [];

                return (
                  <div 
                    key={cli.codCliente}
                    className="bg-background-secondary border border-border-secondary rounded-2xl p-3.5 shadow-sm space-y-3"
                  >
                    {/* Topo do Card: Cód. Cliente + Status GPS */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 bg-background-primary border border-border-tertiary rounded-lg font-mono font-black text-xs text-text-primary shadow-xs">
                        Cód: {cli.codCliente}
                      </span>

                      {temGps ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold rounded-full text-[11px] border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span>{cli.pontos.length} ponto{cli.pontos.length !== 1 ? 's' : ''}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-500/10 text-rose-700 dark:text-rose-300 font-bold rounded-full text-[11px] border border-rose-500/20">
                          <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                          <span>Localização Pendente</span>
                        </span>
                      )}
                    </div>

                    {/* Nome, Grupos e Localização */}
                    <div>
                      <h4 className="font-bold text-text-primary text-sm leading-snug">
                        {cli.cliente}
                      </h4>

                      {/* Badges de Grupos / Redes */}
                      {gruposDoCliente.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {gruposDoCliente.map(g => {
                            const corInfo = GRUPO_CORES[g.cor] || GRUPO_CORES.emerald;
                            return (
                              <span 
                                key={g.id}
                                className={cn(
                                  "px-2 py-0.5 rounded-lg text-[10px] font-bold border flex items-center gap-1",
                                  corInfo.bg, corInfo.text, corInfo.border
                                )}
                              >
                                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", corInfo.dot || "bg-emerald-500")} />
                                <span>{g.nome}</span>
                              </span>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 text-xs text-text-secondary mt-1">
                        <MapPin size={13} className="text-info shrink-0" />
                        <span>{cli.municipio || 'Sem município'}{cli.bairro ? ` - ${cli.bairro}` : ''}</span>
                      </div>
                      {temGps && pontoPadrao && (
                        <div className="text-[11px] text-text-tertiary mt-1 font-mono flex items-center gap-1 flex-wrap">
                          <span className="font-semibold text-text-secondary">{pontoPadrao.nomeLocal || 'Principal'}:</span>
                          <span>{Number(pontoPadrao.lat).toFixed(5)}, {Number(pontoPadrao.lng).toFixed(5)}</span>
                        </div>
                      )}
                    </div>

                    {/* Ações & Rotas */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border-tertiary/60">
                      {/* Navegação */}
                      {temGps && pontoPadrao && pontoPadrao.lat && pontoPadrao.lng ? (
                        <div className="flex items-center gap-1.5">
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${pontoPadrao.lat},${pontoPadrao.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 bg-background-primary hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-border-secondary rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1"
                            title="Abrir no Google Maps"
                          >
                            <MapIcon className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Maps</span>
                          </a>
                          <a
                            href={`https://waze.com/ul?ll=${pontoPadrao.lat},${pontoPadrao.lng}&navigate=yes`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 bg-background-primary hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-border-secondary rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1"
                            title="Abrir no Waze"
                          >
                            <Navigation className="w-3.5 h-3.5 text-cyan-600" />
                            <span>Waze</span>
                          </a>
                        </div>
                      ) : (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${cli.cliente} ${cli.municipio || ''} ${cli.bairro || ''}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-text-tertiary hover:text-primary transition-colors py-1.5"
                          title="Pesquisar endereço no Google Maps"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Buscar</span>
                        </a>
                      )}

                      {/* Gerenciar / Cadastrar */}
                      <button
                        type="button"
                        onClick={() => {
                          setModalGerenciarCliente(cli);
                          setModalNovoPonto(false);
                        }}
                        className={cn(
                          "px-3 py-1.5 font-bold rounded-xl text-xs transition-all shadow-xs shrink-0 cursor-pointer",
                          temGps
                            ? "bg-background-primary hover:bg-border-tertiary text-text-primary border border-border-secondary"
                            : "bg-primary hover:bg-primary/90 text-white shadow-primary/20"
                        )}
                      >
                        {temGps ? 'Gerenciar Locais' : '+ Cadastrar GPS'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 2. VISÃO EM TABELA PARA TELAS MÉDIAS E GRANDES (hidden md:block) */}
          <div className="hidden md:block bg-background-secondary rounded-2xl border border-border-secondary overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-background-tertiary/80 border-b border-border-secondary text-text-secondary dark:text-text-tertiary font-bold text-xs uppercase tracking-wider">
                    <th className="py-3.5 px-4 w-[110px] min-w-[90px]">Cód. Cliente</th>
                    <th className="py-3.5 px-4 min-w-[260px]">Cliente / Razão Social</th>
                    <th className="py-3.5 px-4 w-[200px] min-w-[160px]">Município / Bairro</th>
                    <th className="py-3.5 px-4 w-[150px] min-w-[130px] text-center">Status GPS</th>
                    <th className="py-3.5 px-4 w-[130px] min-w-[110px] text-center">Navegação</th>
                    <th className="py-3.5 px-4 w-[180px] min-w-[170px] text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-tertiary/50 text-xs">
                  {clientesFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-text-tertiary">
                        <MapPinned className="w-10 h-10 mx-auto mb-2 opacity-30 text-primary" />
                        <p className="font-semibold text-text-secondary text-sm">Nenhum cliente encontrado</p>
                        <p className="text-xs text-text-tertiary mt-0.5">Tente ajustar a busca ou o filtro selecionado.</p>
                      </td>
                    </tr>
                  ) : (
                    clientesFiltrados.map((cli) => {
                      const temGps = Array.isArray(cli.pontos) && cli.pontos.length > 0;
                      const pontoPadrao = temGps ? (cli.pontos.find(p => p.padrao) || cli.pontos[0]) : null;
                      const gruposDoCliente = codClienteToGrupos.get(String(cli.codCliente).trim()) || [];

                      return (
                        <tr 
                          key={cli.codCliente}
                          className="hover:bg-background-tertiary/40 transition-colors"
                        >
                          {/* Código do Cliente */}
                          <td className="py-3.5 px-4 font-mono font-bold text-xs text-text-primary">
                            <span className="px-2.5 py-1 bg-background-primary border border-border-secondary rounded-lg inline-block shadow-2xs">
                              {cli.codCliente}
                            </span>
                          </td>

                          {/* Nome do Cliente e Grupos */}
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-text-primary text-sm block leading-snug">
                              {cli.cliente}
                            </span>

                            {/* Badges de Grupos / Redes */}
                            {gruposDoCliente.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {gruposDoCliente.map(g => {
                                  const corInfo = GRUPO_CORES[g.cor] || GRUPO_CORES.emerald;
                                  return (
                                    <span 
                                      key={g.id}
                                      className={cn(
                                        "px-2 py-0.5 rounded-md text-[10px] font-bold border inline-flex items-center gap-1 shadow-2xs",
                                        corInfo.bg, corInfo.text, corInfo.border
                                      )}
                                    >
                                      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", corInfo.dot || "bg-emerald-500")} />
                                      <span>{g.nome}</span>
                                    </span>
                                  );
                                })}
                              </div>
                            )}

                            {temGps && pontoPadrao && (
                              <span className="text-[11px] text-text-tertiary flex items-center gap-1.5 mt-0.5 font-mono">
                                <span className="font-semibold text-text-secondary font-sans">{pontoPadrao.nomeLocal || 'Principal'}:</span>
                                <span>{Number(pontoPadrao.lat).toFixed(5)}, {Number(pontoPadrao.lng).toFixed(5)}</span>
                              </span>
                            )}
                          </td>

                          {/* Município / Bairro */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-text-primary text-xs">{cli.municipio || '-'}</div>
                            <div className="text-[11px] text-text-secondary font-medium">{cli.bairro || ''}</div>
                          </td>

                          {/* Status GPS */}
                          <td className="py-3.5 px-4 text-center">
                            {temGps ? (
                              <span className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold rounded-full text-xs border border-emerald-500/20 whitespace-nowrap">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>{cli.pontos.length} ponto{cli.pontos.length !== 1 ? 's' : ''}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 bg-rose-500/10 text-rose-700 dark:text-rose-300 font-bold rounded-full text-xs border border-rose-500/20 whitespace-nowrap">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                                <span>Pendente</span>
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
                                  className="p-1.5 bg-background-primary hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-border-secondary rounded-lg text-xs font-semibold transition-all shadow-xs"
                                  title="Abrir no Google Maps"
                                >
                                  <MapIcon className="w-4 h-4" />
                                </a>
                                <a
                                  href={`https://waze.com/ul?ll=${pontoPadrao.lat},${pontoPadrao.lng}&navigate=yes`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 bg-background-primary hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-border-secondary rounded-lg text-xs font-semibold transition-all shadow-xs"
                                  title="Abrir no Waze"
                                >
                                  <Navigation className="w-4 h-4" />
                                </a>
                              </div>
                            ) : (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${cli.cliente} ${cli.municipio || ''} ${cli.bairro || ''}`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center gap-1 px-2.5 py-1 bg-background-primary hover:bg-background-tertiary text-text-secondary hover:text-text-primary border border-border-secondary rounded-lg text-xs font-semibold transition-all shadow-xs"
                                title="Pesquisar endereço no Google Maps"
                              >
                                <ExternalLink className="w-3 h-3 text-text-tertiary" />
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
                                "inline-flex items-center justify-center whitespace-nowrap px-3.5 py-1.5 font-bold rounded-xl text-xs transition-all shadow-xs cursor-pointer",
                                temGps
                                  ? "bg-background-primary hover:bg-border-tertiary text-text-primary border border-border-secondary"
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
              {/* Seção de Grupos / Redes do Cliente */}
              <div className="p-3.5 bg-background-primary/80 border border-border-tertiary rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                    <Boxes className="w-3.5 h-3.5 text-primary" />
                    Grupo / Rede de Supermercados
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAbrirCriarGrupo()}
                    className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    Novo Grupo
                  </button>
                </div>
                
                {gruposClientes.length === 0 ? (
                  <p className="text-[11px] text-text-tertiary italic">
                    Nenhum grupo cadastrado ainda. Crie grupos como "Atakarejo", "Rede Mix", "Hiperideal" para classificar os clientes.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {gruposClientes.map(g => {
                      const jaPertence = Array.isArray(g.codClientes) && g.codClientes.includes(String(modalGerenciarCliente.codCliente).trim());
                      const corInfo = GRUPO_CORES[g.cor] || GRUPO_CORES.emerald;
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => handleToggleGrupoParaCliente(g.id, modalGerenciarCliente.codCliente)}
                          className={cn(
                            "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer",
                            jaPertence
                              ? `${corInfo.badge} shadow-xs border-transparent scale-100`
                              : "bg-background-secondary text-text-secondary border-border-tertiary hover:border-border-secondary"
                          )}
                        >
                          {jaPertence && <Check size={12} strokeWidth={3} />}
                          <span>{g.nome}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-1">
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

      {/* MODAL DE CRIAR / EDITAR GRUPO DE CLIENTES */}
      {modalGrupo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-background-secondary border border-border-secondary w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 border-b border-border-secondary flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <Boxes size={22} />
                </div>
                <div>
                  <h3 className="text-base font-black text-text-primary">
                    {modalGrupo.id ? 'Editar Grupo / Rede' : 'Criar Novo Grupo / Rede'}
                  </h3>
                  <p className="text-xs text-text-tertiary">
                    Agrupe e gerencie clientes de uma mesma bandeira comercial
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalGrupo(null)}
                className="p-2 text-text-tertiary hover:text-text-primary hover:bg-background-tertiary rounded-xl cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Nome & Cor */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-text-primary mb-1">
                    Nome da Rede / Grupo *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Atakarejo, Rede Mix, Hiperideal, Mercantil..."
                    value={modalGrupo.nome}
                    onChange={(e) => setModalGrupo({ ...modalGrupo, nome: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-background-primary border border-border-secondary rounded-xl text-text-primary focus:ring-2 focus:ring-primary focus:outline-none font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-primary mb-1">
                    Cor de Destaque
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap p-1.5 bg-background-primary border border-border-secondary rounded-xl">
                    {Object.entries(GRUPO_CORES).map(([corKey, corVal]) => (
                      <button
                        key={corKey}
                        type="button"
                        onClick={() => setModalGrupo({ ...modalGrupo, cor: corKey })}
                        className={cn(
                          "w-6 h-6 rounded-lg transition-transform flex items-center justify-center cursor-pointer",
                          modalGrupo.cor === corKey ? "scale-110 ring-2 ring-white shadow-md" : "opacity-80 hover:opacity-100"
                        )}
                        style={{ backgroundColor: corVal.hex }}
                        title={corVal.name}
                      >
                        {modalGrupo.cor === corKey && <Check size={12} className="text-white drop-shadow" strokeWidth={3} />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-xs font-bold text-text-primary mb-1">
                  Descrição / Observações (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Lojas da rede Atakarejo na Região Metropolitana de Salvador"
                  value={modalGrupo.descricao}
                  onChange={(e) => setModalGrupo({ ...modalGrupo, descricao: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-background-primary border border-border-secondary rounded-xl text-text-primary focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              {/* Seleção de Clientes / Lojas */}
              <div className="pt-2 border-t border-border-secondary space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-primary" />
                      Vincular Lojas / Clientes ao Grupo
                    </span>
                    <span className="text-[11px] text-text-tertiary block">
                      {modalGrupo.codClientes?.length || 0} cliente(s) selecionado(s) neste grupo
                    </span>
                  </div>

                  {/* Ações em Massa */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSelecionarTodosBuscaGrupo(clientesFiltradosGrupoModal)}
                      className="px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      + Marcar Todos ({clientesFiltradosGrupoModal.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDesmarcarTodosBuscaGrupo(clientesFiltradosGrupoModal)}
                      className="px-2.5 py-1 bg-background-primary hover:bg-background-tertiary text-text-tertiary hover:text-danger rounded-lg text-[11px] font-bold transition-colors border border-border-secondary cursor-pointer"
                    >
                      Desmarcar Busca
                    </button>
                  </div>
                </div>

                {/* Input de Busca no Modal */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                  <input
                    type="text"
                    placeholder="Digite o nome do cliente ou código para filtrar (ex: ATAKAREJO)..."
                    value={grupoBuscaCliente}
                    onChange={(e) => setGrupoBuscaCliente(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 text-xs bg-background-primary border border-border-secondary rounded-xl text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  {grupoBuscaCliente && (
                    <button
                      onClick={() => setGrupoBuscaCliente('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Lista de Seleção de Clientes */}
                <div className="max-h-56 overflow-y-auto border border-border-secondary rounded-2xl divide-y divide-border-tertiary bg-background-primary/50 p-1">
                  {clientesFiltradosGrupoModal.length === 0 ? (
                    <div className="p-6 text-center text-xs text-text-tertiary">
                      Nenhum cliente encontrado com o termo informado.
                    </div>
                  ) : (
                    clientesFiltradosGrupoModal.map((c) => {
                      const isSelected = modalGrupo.codClientes?.includes(String(c.codCliente).trim());
                      return (
                        <div
                          key={c.codCliente}
                          onClick={() => handleToggleClienteNoGrupoModal(c.codCliente)}
                          className={cn(
                            "p-2.5 rounded-xl flex items-center justify-between gap-2.5 text-xs cursor-pointer transition-colors",
                            isSelected ? "bg-emerald-500/10 text-text-primary font-semibold" : "hover:bg-background-secondary text-text-secondary"
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={cn(
                              "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                              isSelected ? "bg-emerald-600 border-emerald-600 text-white" : "border-border-tertiary"
                            )}>
                              {isSelected && <Check size={12} strokeWidth={3} />}
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-text-primary block truncate">
                                {c.cliente}
                              </span>
                              <span className="text-[10.5px] text-text-tertiary">
                                Cód: <strong className="font-mono text-text-secondary">{c.codCliente}</strong> {c.municipio ? ` • ${c.municipio}` : ''} {c.bairro ? `(${c.bairro})` : ''}
                              </span>
                            </div>
                          </div>

                          {isSelected && (
                            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] rounded-full shrink-0">
                              Selecionado
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-background-primary/80 border-t border-border-secondary flex items-center justify-between">
              <button
                type="button"
                onClick={() => setModalGrupo(null)}
                className="px-4 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary rounded-xl cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={salvandoGrupo || !modalGrupo.nome?.trim()}
                onClick={handleSalvarGrupo}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {salvandoGrupo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>{salvandoGrupo ? 'Salvando...' : 'Salvar Grupo'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}