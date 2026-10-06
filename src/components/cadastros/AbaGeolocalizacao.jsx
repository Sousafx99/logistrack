import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  MapPin, Navigation, Map as MapIcon, Search, Plus, Trash2, CheckCircle2, 
  XCircle, Clock, AlertTriangle, ExternalLink, Compass, ShieldCheck, 
  Check, X, Edit3, User, Truck, Building2, ChevronRight, RefreshCw,
  Filter, Globe, MapPinned, UploadCloud, DownloadCloud, FileSpreadsheet, Loader2, FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';

export function AbaGeolocalizacao() {
  const [searchParams] = useSearchParams();
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

  // Filtro principal: 'todos' | 'sem_gps' | 'com_gps' | 'solicitacoes'
  const [filtroPrincipal, setFiltroPrincipal] = useState('todos');
  const [filtroStatusSolic, setFiltroStatusSolic] = useState('Pendente'); // 'Pendente' | 'Aprovado' | 'Recusado' | 'Todos'
  const [buscaTexto, setBuscaTexto] = useState('');

  // Sincronizar com parâmetros de rota/URL ao abrir via notificação
  useEffect(() => {
    const aba = searchParams.get('aba') || searchParams.get('filtro');
    if (aba === 'solicitacoes' || aba === 'solicitacao' || aba === 'gps') {
      setFiltroPrincipal('solicitacoes');
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
    const map = new Map();

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
          atualizadoEm: ''
        });
      } else {
        const item = map.get(cod);
        if (nomeCliente && (!item.cliente || item.cliente.startsWith('Cliente '))) item.cliente = nomeCliente;
        if (cidade && !item.municipio) item.municipio = cidade;
        if (bairro && !item.bairro) item.bairro = bairro;
      }
    });

    return Array.from(map.values()).sort((a, b) => (a.cliente || '').localeCompare(b.cliente || ''));
  }, [clientesGeoloc, entregas]);

  // Estatísticas Gerais
  const stats = useMemo(() => {
    const totalClientes = todosClientes.length;
    const comGps = todosClientes.filter(c => (c.pontos || []).length > 0).length;
    const semGps = totalClientes - comGps;
    const totalPontos = todosClientes.reduce((acc, c) => acc + (c.pontos || []).length, 0);

    return { totalClientes, comGps, semGps, totalPontos };
  }, [todosClientes]);

  // Lista Filtrada de Clientes
  const clientesFiltrados = useMemo(() => {
    return todosClientes.filter(c => {
      const temGps = (c.pontos || []).length > 0;

      if (filtroPrincipal === 'com_gps' && !temGps) return false;
      if (filtroPrincipal === 'sem_gps' && temGps) return false;

      if (buscaTexto.trim()) {
        const t = buscaTexto.toLowerCase().trim();
        const match = 
          c.codCliente.toLowerCase().includes(t) ||
          (c.cliente || '').toLowerCase().includes(t) ||
          (c.municipio || '').toLowerCase().includes(t) ||
          (c.bairro || '').toLowerCase().includes(t);
        if (!match) return false;
      }

      return true;
    });
  }, [todosClientes, filtroPrincipal, buscaTexto]);

  // Solicitações Filtradas
  const solicitacoesFiltradas = useMemo(() => {
    return (solicitacoesGeoloc || [])
      .filter(s => {
        if (!s) return false;
        if (filtroStatusSolic !== 'Todos' && (s.status || '').toLowerCase() !== filtroStatusSolic.toLowerCase()) {
          return false;
        }
        if (buscaTexto.trim()) {
          const t = buscaTexto.toLowerCase().trim();
          const match = 
            String(s.codCliente || '').toLowerCase().includes(t) ||
            String(s.clienteNome || '').toLowerCase().includes(t) ||
            String(s.motoristaNome || '').toLowerCase().includes(t) ||
            String(s.motoristaPlaca || '').toLowerCase().includes(t) ||
            String(s.municipio || '').toLowerCase().includes(t) ||
            String(s.bairro || '').toLowerCase().includes(t) ||
            String(s.nomeLocalSugerido || '').toLowerCase().includes(t);
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.criadoEm || 0) - new Date(a.criadoEm || 0));
  }, [solicitacoesGeoloc, filtroStatusSolic, buscaTexto]);

  // Handlers de Aprovação/Recusa
  const handleConfirmarAprovacao = async () => {
    if (!modalAprovar) return;
    try {
      await aprovarSolicitacaoGeoloc(modalAprovar.id, {
        nomeLocal: nomeLocalAprovado.trim() || modalAprovar.nomeLocalSugerido || 'Ponto de Descarga',
        lat: Number(modalAprovar.lat),
        lng: Number(modalAprovar.lng),
        endereco: modalAprovar.endereco || ''
      });
      setModalAprovar(null);
      setNomeLocalAprovado('');
    } catch (error) {
      console.error("Erro ao aprovar solicitação:", error);
      alert("Erro ao aprovar a solicitação de GPS.");
    }
  };

  const handleConfirmarRecusa = async () => {
    if (!modalRecusar) return;
    try {
      await recusarSolicitacaoGeoloc(modalRecusar.id, motivoRecusa);
      setModalRecusar(null);
      setMotivoRecusa('');
    } catch (error) {
      console.error("Erro ao recusar solicitação:", error);
      alert("Erro ao recusar a solicitação de GPS.");
    }
  };

  const handleSalvarNovoPonto = async (e) => {
    e.preventDefault();
    if (!modalGerenciarCliente) return;

    const latNum = Number(novoPontoForm.lat);
    const lngNum = Number(novoPontoForm.lng);

    if (isNaN(latNum) || isNaN(lngNum) || latNum === 0 || lngNum === 0) {
      alert("Coordenadas inválidas. Informe valores numéricos de Latitude e Longitude válidos.");
      return;
    }

    try {
      await salvarPontoCliente(modalGerenciarCliente.codCliente, {
        nomeLocal: novoPontoForm.nomeLocal || 'Ponto de Descarga',
        lat: latNum,
        lng: lngNum,
        endereco: novoPontoForm.endereco || '',
        padrao: !!novoPontoForm.padrao
      }, {
        cliente: modalGerenciarCliente.cliente,
        municipio: modalGerenciarCliente.municipio,
        bairro: modalGerenciarCliente.bairro
      });

      setModalNovoPonto(false);
      setNovoPontoForm({ nomeLocal: '', lat: '', lng: '', endereco: '', padrao: false });

      // Atualiza o modal de cliente em aberto
      const cAtualizado = (clientesGeoloc || []).find(c => String(c.codCliente) === String(modalGerenciarCliente.codCliente));
      if (cAtualizado) {
        setModalGerenciarCliente(cAtualizado);
      }
    } catch (err) {
      console.error("Erro ao cadastrar ponto GPS:", err);
      alert("Erro ao cadastrar o ponto GPS.");
    }
  };

  const handleRemoverPonto = async (pontoId) => {
    if (!modalGerenciarCliente) return;
    if (window.confirm("Deseja realmente excluir este ponto GPS?")) {
      try {
        await removerPontoCliente(modalGerenciarCliente.codCliente, pontoId);
        const cAtualizado = (clientesGeoloc || []).find(c => String(c.codCliente) === String(modalGerenciarCliente.codCliente));
        if (cAtualizado) {
          setModalGerenciarCliente(cAtualizado);
        }
      } catch (err) {
        console.error("Erro ao excluir ponto:", err);
      }
    }
  };

  // Importação e Exportação XLSX
  const handleExportarXLSX = () => {
    if (todosClientes.length === 0) return;

    const dataRows = [];
    todosClientes.forEach(c => {
      const pontos = c.pontos || [];
      if (pontos.length === 0) {
        dataRows.push({
          'Código Cliente': c.codCliente,
          'Razão Social': c.cliente,
          'Município': c.municipio || '',
          'Bairro': c.bairro || '',
          'Nome do Ponto': 'Sem GPS',
          'Latitude': '',
          'Longitude': '',
          'Endereço': '',
          'Padrão': 'Não'
        });
      } else {
        pontos.forEach(p => {
          dataRows.push({
            'Código Cliente': c.codCliente,
            'Razão Social': c.cliente,
            'Município': c.municipio || '',
            'Bairro': c.bairro || '',
            'Nome do Ponto': p.nomeLocal || 'Ponto de Descarga',
            'Latitude': p.lat,
            'Longitude': p.lng,
            'Endereço': p.endereco || '',
            'Padrão': p.padrao ? 'Sim' : 'Não'
          });
        });
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(dataRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Geolocalizacao_Clientes");
    XLSX.writeFile(workbook, `Base_GPS_Clientes_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleBaixarModeloXLSX = () => {
    const dataModelo = [
      {
        'Código Cliente': '1042',
        'Razão Social': 'MERCANTIL RODRIGUES LTDA',
        'Município': 'SALVADOR',
        'Bairro': 'CALÇADA',
        'Nome do Ponto': 'Doca 01 - Portão Principal',
        'Latitude': -12.94632,
        'Longitude': -38.49811,
        'Endereço': 'Av. Fernandes da Cunha, 120',
        'Padrão': 'Sim'
      },
      {
        'Código Cliente': '2088',
        'Razão Social': 'HIPERIDEAL SUPERMERCADOS',
        'Município': 'SALVADOR',
        'Bairro': 'PITUBA',
        'Nome do Ponto': 'Recebimento de Mercadorias',
        'Latitude': -13.00115,
        'Longitude': -38.45934,
        'Endereço': 'Rua das Hortênsias, 550',
        'Padrão': 'Sim'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(dataModelo);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Modelo_GPS");
    XLSX.writeFile(workbook, `Modelo_Planilha_GPS.xlsx`);
  };

  const handleProcessarArquivoGps = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setArquivoGps(file);
    setErroImportacaoGps('');
    setResultadoGps(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (rows.length === 0) {
          setErroImportacaoGps("A planilha está vazia.");
          return;
        }

        // Agrupar por codCliente
        const mapaImport = new Map();
        let invalidos = 0;

        rows.forEach(r => {
          const cod = String(r['Código Cliente'] || r['Codigo Cliente'] || r['codCliente'] || r['CODIGO'] || r['COD'] || '').trim();
          if (!cod) {
            invalidos++;
            return;
          }

          const lat = parseFloat(String(r['Latitude'] || r['lat'] || r['LATITUDE']).replace(',', '.'));
          const lng = parseFloat(String(r['Longitude'] || r['lng'] || r['LONGITUDE']).replace(',', '.'));

          if (!mapaImport.has(cod)) {
            mapaImport.set(cod, {
              codCliente: cod,
              cliente: String(r['Razão Social'] || r['Razao Social'] || r['Cliente'] || r['cliente'] || `Cliente ${cod}`).trim(),
              municipio: String(r['Município'] || r['Municipio'] || r['Cidade'] || r['cidade'] || '').trim(),
              bairro: String(r['Bairro'] || r['bairro'] || '').trim(),
              pontos: []
            });
          }

          if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
            const isPadrao = String(r['Padrão'] || r['Padrao'] || r['padrao']).toLowerCase().includes('s');
            mapaImport.get(cod).pontos.push({
              id: `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              nomeLocal: String(r['Nome do Ponto'] || r['Nome Local'] || r['nomeLocal'] || 'Doca / Ponto de Descarga').trim(),
              lat,
              lng,
              endereco: String(r['Endereço'] || r['Endereco'] || r['endereco'] || '').trim(),
              padrao: isPadrao,
              criadoEm: new Date().toISOString()
            });
          }
        });

        const listFinal = Array.from(mapaImport.values());
        setResultadoGps({
          totalLinhas: rows.length,
          totalClientes: listFinal.length,
          totalComPontos: listFinal.filter(c => c.pontos.length > 0).length,
          totalPontos: listFinal.reduce((acc, c) => acc + c.pontos.length, 0),
          dados: listFinal
        });
      } catch (err) {
        console.error("Erro na leitura da planilha GPS:", err);
        setErroImportacaoGps("Não foi possível ler o arquivo. Certifique-se de que é um arquivo Excel (.xlsx, .xls) válido.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSalvarImportacaoLote = async () => {
    if (!resultadoGps || !resultadoGps.dados || resultadoGps.dados.length === 0) return;

    setImportandoGps(true);
    try {
      await importarClientesGeolocEmLote(resultadoGps.dados);
      setModalImportar(false);
      setArquivoGps(null);
      setResultadoGps(null);
      alert("Geolocalizações importadas com sucesso!");
    } catch (err) {
      console.error("Erro na importação em lote:", err);
      alert("Houve um erro ao gravar as geolocalizações no banco.");
    } finally {
      setImportandoGps(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Cards de KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-background-primary p-3.5 sm:p-4 rounded-2xl border border-border-secondary shadow-xs">
          <div className="flex items-center justify-between text-text-secondary mb-1">
            <span className="text-xs font-bold">Total de Clientes</span>
            <Building2 size={16} className="text-info" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-text-primary font-mono">
            {stats.totalClientes}
          </div>
          <p className="text-[11px] text-text-tertiary mt-0.5">Base cadastrada</p>
        </div>

        <div className="bg-background-primary p-3.5 sm:p-4 rounded-2xl border border-border-secondary shadow-xs">
          <div className="flex items-center justify-between text-emerald-400 mb-1">
            <span className="text-xs font-bold text-text-secondary">Com GPS Ativo</span>
            <CheckCircle2 size={16} />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
            {stats.comGps}
          </div>
          <p className="text-[11px] text-text-tertiary mt-0.5">
            {stats.totalPontos} ponto(s) cadastrado(s)
          </p>
        </div>

        <div className="bg-background-primary p-3.5 sm:p-4 rounded-2xl border border-border-secondary shadow-xs">
          <div className="flex items-center justify-between text-amber-400 mb-1">
            <span className="text-xs font-bold text-text-secondary">Sem Coordenadas</span>
            <AlertTriangle size={16} />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono">
            {stats.semGps}
          </div>
          <p className="text-[11px] text-text-tertiary mt-0.5">Aguardando mapeamento</p>
        </div>

        <div 
          onClick={() => setFiltroPrincipal('solicitacoes')}
          className={cn(
            "bg-background-primary p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer shadow-xs",
            pendentesCount > 0 
              ? "border-cyan-500/50 hover:border-cyan-500 ring-1 ring-cyan-500/30 bg-cyan-500/5" 
              : "border-border-secondary hover:border-border-primary"
          )}
        >
          <div className="flex items-center justify-between text-cyan-400 mb-1">
            <span className="text-xs font-bold text-text-secondary">Solicitações Motoristas</span>
            <Compass size={16} className={pendentesCount > 0 ? "animate-spin" : ""} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl sm:text-2xl font-black text-cyan-400 font-mono">
              {pendentesCount}
            </span>
            {pendentesCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-500 text-white animate-pulse">
                Pendente
              </span>
            )}
          </div>
          <p className="text-[11px] text-text-tertiary mt-0.5">Clique para avaliar</p>
        </div>
      </div>

      {/* Barra de Filtros e Ações */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-background-primary p-3 sm:p-4 rounded-2xl border border-border-secondary shadow-xs">
        {/* Navegação de Abas Internas */}
        <div className="flex items-center gap-1.5 p-1 bg-background-secondary rounded-xl border border-border-secondary w-full sm:w-auto overflow-x-auto">
          <button
            type="button"
            onClick={() => setFiltroPrincipal('todos')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
              filtroPrincipal === 'todos' ? "bg-info text-white shadow-xs" : "text-text-secondary hover:text-text-primary"
            )}
          >
            Todos ({stats.totalClientes})
          </button>

          <button
            type="button"
            onClick={() => setFiltroPrincipal('com_gps')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
              filtroPrincipal === 'com_gps' ? "bg-emerald-600 text-white shadow-xs" : "text-text-secondary hover:text-text-primary"
            )}
          >
            Com GPS ({stats.comGps})
          </button>

          <button
            type="button"
            onClick={() => setFiltroPrincipal('sem_gps')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
              filtroPrincipal === 'sem_gps' ? "bg-amber-600 text-white shadow-xs" : "text-text-secondary hover:text-text-primary"
            )}
          >
            Sem GPS ({stats.semGps})
          </button>

          <button
            type="button"
            onClick={() => setFiltroPrincipal('solicitacoes')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer relative",
              filtroPrincipal === 'solicitacoes' ? "bg-cyan-600 text-white shadow-xs" : "text-text-secondary hover:text-text-primary"
            )}
          >
            <Compass size={14} />
            <span>Solicitações</span>
            {pendentesCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            )}
          </button>
        </div>

        {/* Botões de Importação e Exportação */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={handleExportarXLSX}
            className="px-3 py-1.5 rounded-xl border border-border-secondary hover:bg-background-secondary text-text-primary text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Exportar Planilha Completa de GPS"
          >
            <FileSpreadsheet size={15} className="text-emerald-500" />
            <span className="hidden sm:inline">Exportar</span>
          </button>

          <button
            type="button"
            onClick={() => setModalImportar(true)}
            className="px-3.5 py-1.5 rounded-xl bg-info hover:bg-info/90 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
          >
            <UploadCloud size={15} />
            <span>Importar Planilha</span>
          </button>
        </div>
      </div>

      {/* Campo de Busca */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
        <input
          type="text"
          value={buscaTexto}
          onChange={(e) => setBuscaTexto(e.target.value)}
          placeholder={filtroPrincipal === 'solicitacoes' ? "Buscar solicitações por cliente, motorista, placa, código ou bairro..." : "Buscar por código do cliente, razão social, município ou bairro..."}
          className="w-full bg-background-primary border border-border-secondary rounded-2xl pl-10 pr-4 py-3 text-xs sm:text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-info transition-colors shadow-xs"
        />
        {buscaTexto && (
          <button
            type="button"
            onClick={() => setBuscaTexto('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary p-1"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Visão de Solicitações de Motoristas */}
      {filtroPrincipal === 'solicitacoes' ? (
        <div className="space-y-4">
          {/* Subfiltro de Status da Solicitação */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-tertiary font-bold">Status:</span>
            {['Pendente', 'Aprovado', 'Recusado', 'Todos'].map(st => (
              <button
                key={st}
                type="button"
                onClick={() => setFiltroStatusSolic(st)}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  filtroStatusSolic === st 
                    ? "bg-background-secondary text-text-primary border border-info" 
                    : "text-text-tertiary hover:text-text-secondary"
                )}
              >
                {st}
              </button>
            ))}
          </div>

          {solicitacoesFiltradas.length === 0 ? (
            <div className="bg-background-primary p-12 text-center rounded-2xl border border-border-secondary text-text-tertiary">
              <Compass size={40} className="mx-auto mb-3 opacity-30 text-cyan-400" />
              <p className="text-sm font-bold text-text-primary">Nenhuma solicitação encontrada</p>
              <p className="text-xs text-text-tertiary mt-1">Quando os motoristas enviarem pontos no local de entrega, eles aparecerão aqui.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {solicitacoesFiltradas.map(solic => {
                const isPendente = (solic.status || '').toLowerCase() === 'pendente';
                const isAprovado = (solic.status || '').toLowerCase() === 'aprovado';
                const isRecusado = (solic.status || '').toLowerCase() === 'recusado';
                const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${solic.lat},${solic.lng}`;

                return (
                  <div 
                    key={solic.id}
                    className={cn(
                      "bg-background-primary rounded-2xl border p-4 shadow-xs flex flex-col justify-between transition-all",
                      isPendente ? "border-cyan-500/40 ring-1 ring-cyan-500/20" : "border-border-secondary opacity-90"
                    )}
                  >
                    <div>
                      {/* Topo do Card */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-xs bg-background-secondary px-2 py-0.5 rounded border border-border-secondary text-text-primary">
                              Cód: {solic.codCliente}
                            </span>
                            <span className="font-mono font-bold text-xs text-info bg-info/10 px-2 py-0.5 rounded">
                              {solic.motoristaPlaca || 'S/ Placa'}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-text-primary mt-1.5">
                            {solic.clienteNome || `Cliente ${solic.codCliente}`}
                          </h4>
                        </div>

                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border flex items-center gap-1",
                          isPendente && "bg-cyan-500/15 text-cyan-400 border-cyan-500/30 animate-pulse",
                          isAprovado && "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
                          isRecusado && "bg-rose-500/15 text-rose-400 border-rose-500/30"
                        )}>
                          {isPendente ? 'Pendente' : isAprovado ? 'Aprovado' : 'Recusado'}
                        </span>
                      </div>

                      {/* Coordenadas e Local Sugerido */}
                      <div className="p-3 bg-background-secondary/50 rounded-xl space-y-1.5 text-xs my-2.5">
                        <div className="flex items-center justify-between text-cyan-400 font-mono font-bold">
                          <span>Lat: {Number(solic.lat).toFixed(6)}, Lng: {Number(solic.lng).toFixed(6)}</span>
                          <a 
                            href={mapsUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[11px] underline hover:text-cyan-300 flex items-center gap-1"
                          >
                            <span>Abrir Mapa</span>
                            <ExternalLink size={12} />
                          </a>
                        </div>
                        {solic.nomeLocalSugerido && (
                          <p className="text-text-primary font-medium">
                            <strong>Local:</strong> {solic.nomeLocalSugerido}
                          </p>
                        )}
                        {solic.observacao && (
                          <p className="text-text-secondary italic text-[11px]">
                            "{solic.observacao}"
                          </p>
                        )}
                        <div className="flex items-center justify-between text-[11px] text-text-tertiary pt-1 border-t border-border-secondary/50">
                          <span>Motorista: {solic.motoristaNome || 'Motorista'}</span>
                          <span>{solic.municipio || ''} {solic.bairro ? `• ${solic.bairro}` : ''}</span>
                        </div>
                      </div>
                    </div>

                    {/* Ações de Aprovação */}
                    {isPendente ? (
                      <div className="flex items-center gap-2 pt-2 border-t border-border-secondary">
                        <button
                          type="button"
                          onClick={() => {
                            setModalAprovar(solic);
                            setNomeLocalAprovado(solic.nomeLocalSugerido || 'Ponto de Descarga');
                          }}
                          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Check size={14} />
                          <span>Aprovar Ponto GPS</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setModalRecusar(solic)}
                          className="px-3 py-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          Recusar
                        </button>
                      </div>
                    ) : (
                      <div className="text-[11px] text-text-tertiary pt-2 border-t border-border-secondary flex justify-between items-center">
                        <span>{isAprovado ? `Aprovado em ${new Date(solic.aprovadoEm || solic.criadoEm).toLocaleDateString('pt-BR')}` : `Recusado: ${solic.motivoRecusa || 'Sem motivo'}`}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Visão de Tabela e Cards de Clientes & GPS */
        <div className="space-y-4">
          {/* Tabela Desktop */}
          <div className="hidden md:block bg-background-primary rounded-2xl border border-border-secondary shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-background-secondary/70 border-b border-border-secondary text-text-secondary">
                    <th className="py-3 px-4 font-bold w-[12%]">Código</th>
                    <th className="py-3 px-4 font-bold w-[34%]">Razão Social / Loja</th>
                    <th className="py-3 px-4 font-bold w-[22%]">Localização</th>
                    <th className="py-3 px-4 font-bold w-[18%] text-center">Status GPS</th>
                    <th className="py-3 px-4 font-bold w-[14%] text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-secondary/60">
                  {clientesFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-text-tertiary">
                        Nenhum cliente encontrado para os filtros selecionados
                      </td>
                    </tr>
                  ) : (
                    clientesFiltrados.map((c) => {
                      const pontos = c.pontos || [];
                      const temGps = pontos.length > 0;
                      const pontoPrincipal = pontos.find(p => p.padrao) || pontos[0];

                      return (
                        <tr key={c.codCliente} className="hover:bg-background-secondary/40 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-text-primary">
                            {c.codCliente}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-text-primary block text-sm">
                              {c.cliente}
                            </span>
                            {temGps && pontoPrincipal && (
                              <span className="text-[11px] text-cyan-400 font-mono block mt-0.5">
                                Lat: {Number(pontoPrincipal.lat).toFixed(5)}, Lng: {Number(pontoPrincipal.lng).toFixed(5)}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-text-secondary">
                            <span className="block font-medium text-text-primary">{c.municipio || '-'}</span>
                            <span className="text-[11px] text-text-tertiary">{c.bairro || '-'}</span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {temGps ? (
                              <span className="px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1">
                                <CheckCircle2 size={12} />
                                <span>{pontos.length} Ponto(s) GPS</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 inline-flex items-center gap-1">
                                <AlertTriangle size={12} />
                                <span>Sem Coordenadas</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setModalGerenciarCliente(c);
                                setModalNovoPonto(false);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-info/10 hover:bg-info hover:text-white text-info font-bold text-[11px] border border-info/30 hover:border-info transition-all cursor-pointer inline-flex items-center gap-1"
                            >
                              <MapPin size={13} />
                              <span>{temGps ? 'Ver Pontos' : '+ Add GPS'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {clientesFiltrados.length > 0 && (
              <div className="p-3 bg-background-secondary/30 border-t border-border-secondary flex justify-between items-center text-xs text-text-tertiary">
                <span>Mostrando {clientesFiltrados.length} cliente(s)</span>
                <span>Total: {todosClientes.length}</span>
              </div>
            )}
          </div>

          {/* Cards Mobile */}
          <div className="block md:hidden space-y-3">
            {clientesFiltrados.length === 0 ? (
              <div className="bg-background-primary p-8 text-center rounded-2xl border border-border-secondary text-text-tertiary text-xs">
                Nenhum cliente encontrado
              </div>
            ) : (
              clientesFiltrados.map(c => {
                const pontos = c.pontos || [];
                const temGps = pontos.length > 0;
                const pontoPrincipal = pontos.find(p => p.padrao) || pontos[0];

                return (
                  <div 
                    key={c.codCliente}
                    className="bg-background-primary p-4 rounded-2xl border border-border-secondary shadow-xs space-y-3"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs bg-background-secondary px-2 py-0.5 rounded border border-border-secondary text-text-primary">
                            {c.codCliente}
                          </span>
                          {temGps ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                              <CheckCircle2 size={11} /> {pontos.length} Ponto(s)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                              <AlertTriangle size={11} /> Sem GPS
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-text-primary mt-1.5">
                          {c.cliente}
                        </h4>
                        <p className="text-xs text-text-tertiary">
                          {c.municipio || 'Sem cidade'} {c.bairro ? `• ${c.bairro}` : ''}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setModalGerenciarCliente(c);
                          setModalNovoPonto(false);
                        }}
                        className="p-2.5 bg-info/10 hover:bg-info hover:text-white rounded-xl text-info border border-info/30 text-xs font-bold transition-all shrink-0"
                      >
                        <MapPin size={16} />
                      </button>
                    </div>

                    {temGps && pontoPrincipal && (
                      <div className="text-[11px] font-mono text-cyan-400 bg-background-secondary/40 p-2 rounded-xl flex items-center justify-between">
                        <span>Lat: {Number(pontoPrincipal.lat).toFixed(5)}, Lng: {Number(pontoPrincipal.lng).toFixed(5)}</span>
                        <a 
                          href={`https://www.google.com/maps/search/?api=1&query=${pontoPrincipal.lat},${pontoPrincipal.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-info underline hover:text-info/80 flex items-center gap-0.5"
                        >
                          <span>Ver</span>
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Modal Gerenciar Pontos GPS do Cliente */}
      {modalGerenciarCliente && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-background-primary border border-border-secondary rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-5 border-b border-border-secondary flex justify-between items-center bg-background-secondary/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-info/10 text-info flex items-center justify-center font-bold">
                  <MapPin size={20} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-text-primary">
                    {modalGerenciarCliente.cliente}
                  </h3>
                  <p className="text-xs font-mono text-text-tertiary">
                    Código: {modalGerenciarCliente.codCliente} • {modalGerenciarCliente.municipio}
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setModalGerenciarCliente(null)} 
                className="p-2 text-text-tertiary hover:text-text-primary hover:bg-background-secondary rounded-xl transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                  Pontos de Entrega Cadastrados ({(modalGerenciarCliente.pontos || []).length})
                </h4>
                <button
                  type="button"
                  onClick={() => setModalNovoPonto(!modalNovoPonto)}
                  className="text-xs font-bold text-info hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Adicionar Novo Ponto</span>
                </button>
              </div>

              {/* Formulário Novo Ponto */}
              {modalNovoPonto && (
                <form onSubmit={handleSalvarNovoPonto} className="p-4 bg-background-secondary/60 border border-info/30 rounded-2xl space-y-3">
                  <h5 className="text-xs font-bold text-info flex items-center gap-1.5">
                    <MapPinned size={14} />
                    <span>Novo Ponto Geográfico</span>
                  </h5>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-text-secondary">Latitude *</label>
                      <input
                        type="number"
                        step="any"
                        required
                        value={novoPontoForm.lat}
                        onChange={(e) => setNovoPontoForm(prev => ({ ...prev, lat: e.target.value }))}
                        placeholder="Ex: -12.94632"
                        className="w-full bg-background-primary border border-border-secondary rounded-xl px-3 py-1.5 text-xs text-text-primary font-mono focus:outline-none focus:border-info"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-text-secondary">Longitude *</label>
                      <input
                        type="number"
                        step="any"
                        required
                        value={novoPontoForm.lng}
                        onChange={(e) => setNovoPontoForm(prev => ({ ...prev, lng: e.target.value }))}
                        placeholder="Ex: -38.49811"
                        className="w-full bg-background-primary border border-border-secondary rounded-xl px-3 py-1.5 text-xs text-text-primary font-mono focus:outline-none focus:border-info"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-text-secondary">Nome do Ponto / Doca</label>
                    <input
                      type="text"
                      value={novoPontoForm.nomeLocal}
                      onChange={(e) => setNovoPontoForm(prev => ({ ...prev, nomeLocal: e.target.value }))}
                      placeholder="Ex: Doca 02 - Fundos, Portão Lateral"
                      className="w-full bg-background-primary border border-border-secondary rounded-xl px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-info"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-text-secondary">Endereço de Referência</label>
                    <input
                      type="text"
                      value={novoPontoForm.endereco}
                      onChange={(e) => setNovoPontoForm(prev => ({ ...prev, endereco: e.target.value }))}
                      placeholder="Ex: Av. Principal, 1000"
                      className="w-full bg-background-primary border border-border-secondary rounded-xl px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-info"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-text-secondary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={novoPontoForm.padrao}
                        onChange={(e) => setNovoPontoForm(prev => ({ ...prev, padrao: e.target.checked }))}
                        className="rounded text-info"
                      />
                      <span>Definir como ponto padrão</span>
                    </label>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setModalNovoPonto(false)}
                        className="px-3 py-1.5 text-xs text-text-tertiary hover:text-text-primary"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-info text-white rounded-xl text-xs font-bold hover:bg-info/90 shadow-xs"
                      >
                        Salvar Ponto
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Lista de Pontos Existentes */}
              {(modalGerenciarCliente.pontos || []).length === 0 ? (
                <div className="p-8 text-center bg-background-secondary/30 rounded-2xl border border-border-secondary text-text-tertiary text-xs">
                  Nenhum ponto de coordenadas GPS cadastrado para este cliente.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {(modalGerenciarCliente.pontos || []).map((ponto, idx) => (
                    <div 
                      key={ponto.id || idx}
                      className="p-3.5 bg-background-secondary/40 border border-border-secondary rounded-2xl flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-text-primary">
                            {ponto.nomeLocal || `Ponto ${idx + 1}`}
                          </span>
                          {ponto.padrao && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              Padrão
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-cyan-400 text-[11px]">
                          Lat: {Number(ponto.lat).toFixed(6)}, Lng: {Number(ponto.lng).toFixed(6)}
                        </p>
                        {ponto.endereco && (
                          <p className="text-text-tertiary text-[11px]">{ponto.endereco}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${ponto.lat},${ponto.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-info hover:bg-info/10 rounded-xl transition-colors"
                          title="Abrir no Google Maps"
                        >
                          <ExternalLink size={15} />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleRemoverPonto(ponto.id)}
                          className="p-2 text-text-tertiary hover:text-danger hover:bg-danger/10 rounded-xl transition-colors"
                          title="Excluir Ponto"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-background-secondary/50 border-t border-border-secondary flex justify-end">
              <button
                type="button"
                onClick={() => setModalGerenciarCliente(null)}
                className="px-5 py-2 bg-info hover:bg-info/90 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Aprovação de Solicitação */}
      {modalAprovar && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-background-primary border border-border-secondary rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-5 border-b border-border-secondary bg-background-secondary/30 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 size={22} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-text-primary">
                    Aprovar Ponto de Descarga
                  </h3>
                  <p className="text-xs text-text-tertiary">
                    {modalAprovar.clienteNome || `Cliente ${modalAprovar.codCliente}`}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setModalAprovar(null)} className="p-2 text-text-tertiary hover:text-text-primary rounded-xl">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3.5 bg-background-secondary/50 rounded-2xl space-y-2 text-xs">
                <div className="flex justify-between items-center text-cyan-400 font-mono font-bold">
                  <span>Lat: {Number(modalAprovar.lat).toFixed(6)}, Lng: {Number(modalAprovar.lng).toFixed(6)}</span>
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${modalAprovar.lat},${modalAprovar.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline flex items-center gap-1 text-[11px]"
                  >
                    <span>Ver no Maps</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
                <p className="text-text-tertiary text-[11px]">
                  Enviado pelo motorista <strong>{modalAprovar.motoristaNome || modalAprovar.motoristaPlaca}</strong>
                </p>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-text-secondary">
                  Nome do Local / Doca de Descarga *
                </label>
                <input
                  type="text"
                  required
                  value={nomeLocalAprovado}
                  onChange={(e) => setNomeLocalAprovado(e.target.value)}
                  placeholder="Ex: Doca Principal, Entrada Lateral"
                  className="w-full bg-background-secondary border border-border-secondary rounded-xl px-3 py-2 text-xs sm:text-sm text-text-primary font-bold focus:outline-none focus:border-info"
                />
              </div>
            </div>

            <div className="p-4 bg-background-secondary/50 border-t border-border-secondary flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalAprovar(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-text-tertiary hover:text-text-primary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarAprovacao}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5"
              >
                <Check size={14} />
                <span>Confirmar e Salvar no Cliente</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Recusa */}
      {modalRecusar && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-background-primary border border-border-secondary rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-5 border-b border-border-secondary bg-background-secondary/30 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                  <XCircle size={22} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-text-primary">
                    Recusar Ponto GPS
                  </h3>
                  <p className="text-xs text-text-tertiary">
                    {modalRecusar.clienteNome || `Cliente ${modalRecusar.codCliente}`}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setModalRecusar(null)} className="p-2 text-text-tertiary hover:text-text-primary rounded-xl">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <label className="block text-xs font-bold text-text-secondary">
                Motivo da Recusa (Opcional)
              </label>
              <textarea
                rows={3}
                value={motivoRecusa}
                onChange={(e) => setMotivoRecusa(e.target.value)}
                placeholder="Ex: Coordenadas imprecisas, fora do raio do cliente..."
                className="w-full bg-background-secondary border border-border-secondary rounded-xl p-3 text-xs text-text-primary focus:outline-none focus:border-rose-500 resize-none"
              />
            </div>

            <div className="p-4 bg-background-secondary/50 border-t border-border-secondary flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalRecusar(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-text-tertiary hover:text-text-primary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarRecusa}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                Recusar Solicitação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Importação de Planilha GPS */}
      {modalImportar && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-background-primary border border-border-secondary rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-5 border-b border-border-secondary bg-background-secondary/30 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-info/10 text-info flex items-center justify-center font-bold">
                  <UploadCloud size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-text-primary">
                    Importar Base de Geolocalizações
                  </h3>
                  <p className="text-xs text-text-tertiary">
                    Atualize os pontos GPS dos clientes em massa via planilha Excel
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => {
                  setModalImportar(false);
                  setArquivoGps(null);
                  setResultadoGps(null);
                }} 
                className="p-2 text-text-tertiary hover:text-text-primary rounded-xl"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text-secondary">
                  Envie sua planilha com as colunas: Código, Latitude, Longitude...
                </span>
                <button
                  type="button"
                  onClick={handleBaixarModeloXLSX}
                  className="text-xs text-info hover:underline font-bold flex items-center gap-1 cursor-pointer"
                >
                  <DownloadCloud size={13} />
                  <span>Baixar Modelo</span>
                </button>
              </div>

              {/* Área de Dropzone */}
              <div 
                onClick={() => inputGpsRef.current?.click()}
                className="border-2 border-dashed border-border-secondary hover:border-info/60 rounded-2xl p-6 text-center cursor-pointer bg-background-secondary/30 transition-all hover:bg-background-secondary/60"
              >
                <input 
                  type="file" 
                  ref={inputGpsRef} 
                  accept=".xlsx, .xls, .csv" 
                  onChange={handleProcessarArquivoGps} 
                  className="hidden" 
                />
                <FileSpreadsheet size={36} className="mx-auto mb-2 text-emerald-500 opacity-80" />
                <p className="text-xs font-bold text-text-primary">
                  {arquivoGps ? arquivoGps.name : "Clique para selecionar a planilha de GPS (.xlsx)"}
                </p>
                <p className="text-[11px] text-text-tertiary mt-1">
                  Formatos aceitos: Excel (.xlsx, .xls)
                </p>
              </div>

              {erroImportacaoGps && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400">
                  {erroImportacaoGps}
                </div>
              )}

              {/* Resultado da Análise da Planilha */}
              {resultadoGps && (
                <div className="p-4 bg-background-secondary/60 border border-border-secondary rounded-2xl space-y-2 text-xs">
                  <h5 className="font-bold text-text-primary flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 size={15} />
                    <span>Planilha Processada com Sucesso</span>
                  </h5>
                  <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
                    <div className="p-2 bg-background-primary rounded-lg">
                      <span className="text-text-tertiary text-[10px] block">Linhas:</span>
                      <strong className="text-text-primary text-sm">{resultadoGps.totalLinhas}</strong>
                    </div>
                    <div className="p-2 bg-background-primary rounded-lg">
                      <span className="text-text-tertiary text-[10px] block">Clientes:</span>
                      <strong className="text-text-primary text-sm">{resultadoGps.totalClientes}</strong>
                    </div>
                    <div className="p-2 bg-background-primary rounded-lg">
                      <span className="text-text-tertiary text-[10px] block">Com Coordenadas:</span>
                      <strong className="text-emerald-400 text-sm">{resultadoGps.totalComPontos}</strong>
                    </div>
                    <div className="p-2 bg-background-primary rounded-lg">
                      <span className="text-text-tertiary text-[10px] block">Total de Pontos GPS:</span>
                      <strong className="text-cyan-400 text-sm">{resultadoGps.totalPontos}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-background-secondary/50 border-t border-border-secondary flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setModalImportar(false);
                  setArquivoGps(null);
                  setResultadoGps(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-text-tertiary hover:text-text-primary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSalvarImportacaoLote}
                disabled={importandoGps || !resultadoGps}
                className="px-5 py-2 bg-info hover:bg-info/90 text-white rounded-xl text-xs font-bold disabled:opacity-50 shadow-xs flex items-center gap-1.5"
              >
                {importandoGps ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Importando...</span>
                  </>
                ) : (
                  <span>Gravar na Base de Dados</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
