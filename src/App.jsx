import { useEffect, lazy, Suspense, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Layout } from './components/Layout/Layout';
import { Login } from './pages/Login';
import { Entregas } from './pages/Entregas';
import { useStore } from './store/useStore';
import { firestoreService } from './lib/firestoreService';
import { useAutoVersionReload } from './hooks/useAutoVersionReload';

// Lazy-loaded pages (Carregadas sob demanda apenas para Monitoramento / Operação)
const Devolucoes = lazy(() => import('./pages/Devolucoes').then(m => ({ default: m.Devolucoes })));
const Canhotos = lazy(() => import('./pages/Canhotos').then(m => ({ default: m.Canhotos })));
const Importacao = lazy(() => import('./pages/Importacao').then(m => ({ default: m.Importacao })));
const Exportacao = lazy(() => import('./pages/Exportacao').then(m => ({ default: m.Exportacao })));
const ApiRest = lazy(() => import('./pages/ApiRest').then(m => ({ default: m.ApiRest })));
const Relatorios = lazy(() => import('./pages/Relatorios').then(m => ({ default: m.Relatorios })));
const GuiaImpressao = lazy(() => import('./pages/GuiaImpressao').then(m => ({ default: m.GuiaImpressao })));
const StatusFrota = lazy(() => import('./pages/StatusFrota').then(m => ({ default: m.StatusFrota })));
const Despesas = lazy(() => import('./pages/Despesas').then(m => ({ default: m.Despesas })));
const Cadastros = lazy(() => import('./pages/Cadastros').then(m => ({ default: m.Cadastros })));
const KmControle = lazy(() => import('./pages/KmControle').then(m => ({ default: m.KmControle })));
const DashboardLogistico = lazy(() => import('./pages/DashboardLogistico').then(m => ({ default: m.DashboardLogistico })));
const ProgramacaoCargas = lazy(() => import('./pages/ProgramacaoCargas').then(m => ({ default: m.ProgramacaoCargas })));

// Helper para calcular a data de N dias atrás no fuso de Brasília (YYYY-MM-DD)
const getBrasiliaDateStringOffset = (daysAgo = 7) => {
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  return `${year}-${month}-${day}`;
};

const PageLoader = () => (
  <div className="flex items-center justify-center py-20 text-text-secondary">
    <Loader2 className="w-6 h-6 animate-spin mr-2 text-info" />
    <span className="text-sm font-medium">Carregando tela...</span>
  </div>
);

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles, allowedSubRoles }) => {
  const { currentUser } = useStore();
  
  if (!currentUser) return <Navigate to="/login" />;
  
  const getDefaultPath = () => {
    if (currentUser.role === 'Motorista') return '/';
    if (currentUser.role === 'Operacao') {
      return currentUser.subRole === 'Financeiro' ? '/custos' : '/devolucoes';
    }
    return '/';
  };

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to={getDefaultPath()} replace />;
  }

  if (allowedSubRoles && currentUser.role === 'Operacao' && !allowedSubRoles.includes(currentUser.subRole || 'Docas')) {
    return <Navigate to={getDefaultPath()} replace />;
  }
  
  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
    </Layout>
  );
};

function App() {
  const currentUser = useStore(state => state.currentUser);
  const userRole = currentUser?.role || null;
  const userPlaca = currentUser?.placa ? String(currentUser.placa).trim().toUpperCase() : null;
  const codigosGeolocBuscadosRef = useRef(new Set());

  // Monitora continuamente a publicação de novas versões na Vercel e atualiza o app automaticamente
  useAutoVersionReload(60000);

  useEffect(() => {
    if (!userRole) return;

    // --- MODO MOTORISTA: Baixa apenas dados da própria placa e dos últimos 7 dias ---
    if (userRole === 'Motorista' && userPlaca) {
      const dataMinima7Dias = getBrasiliaDateStringOffset(7);

      const unsubEntregas = firestoreService.subscribeEntregasMotorista(userPlaca, dataMinima7Dias, async (data) => {
        useStore.getState().setEntregasMotorista(data, userPlaca, dataMinima7Dias);

        // Busca sob demanda apenas o GPS dos clientes presentes nas entregas deste motorista
        const codigosFaltantes = Array.from(
          new Set((data || []).map(e => String(e?.codCliente || '').trim()).filter(Boolean))
        ).filter(cod => !codigosGeolocBuscadosRef.current.has(cod));

        if (codigosFaltantes.length > 0) {
          codigosFaltantes.forEach(c => codigosGeolocBuscadosRef.current.add(c));
          const clientesGeolocEncontrados = await firestoreService.buscarClientesGeolocPorCodigos(codigosFaltantes);
          if (clientesGeolocEncontrados.length > 0) {
            useStore.getState().mesclarClientesGeoloc(clientesGeolocEncontrados);
          }
        }
      });

      const unsubMotorista = firestoreService.subscribeMotoristaUnico(userPlaca, (data) => {
        useStore.getState().setMotoristas(data);
      });

      const unsubDespesas = firestoreService.subscribeDespesasMotorista(userPlaca, dataMinima7Dias, (data) => {
        useStore.getState().setDespesas(data);
      });

      const unsubKmRegistros = firestoreService.subscribeKmRegistrosMotorista(userPlaca, dataMinima7Dias, (data) => {
        useStore.getState().setKmRegistros(data);
      });

      const unsubCargasFinalizadas = firestoreService.subscribeCargasFinalizadasMotorista(userPlaca, dataMinima7Dias, (data) => {
        useStore.getState().setCargasFinalizadas(data);
      });

      const unsubSolicitacoesDevolucao = firestoreService.subscribeSolicitacoesDevolucaoMotorista(userPlaca, dataMinima7Dias, (data) => {
        useStore.getState().setSolicitacoesDevolucao(data);
      });

      const unsubSolicitacoesGeoloc = firestoreService.subscribeSolicitacoesGeolocMotorista(userPlaca, dataMinima7Dias, (data) => {
        useStore.getState().setSolicitacoesGeoloc(data);
      });

      return () => {
        unsubEntregas();
        unsubMotorista();
        unsubDespesas();
        unsubKmRegistros();
        unsubCargasFinalizadas();
        unsubSolicitacoesDevolucao();
        unsubSolicitacoesGeoloc();
      };
    }

    // --- MODO MONITORAMENTO & OPERAÇÃO: Visão completa da operação ---
    const unsubEntregas = firestoreService.subscribeEntregas((data) => {
      useStore.getState().setEntregas(data);
    });
    
    const unsubDevolucoes = firestoreService.subscribeDevolucoes((data) => {
      useStore.getState().setDevolucoes(data);
    });

    const unsubDespesas = firestoreService.subscribeDespesas((data) => {
      useStore.getState().setDespesas(data);
    });

    const unsubMotoristas = firestoreService.subscribeMotoristas((data) => {
      useStore.getState().setMotoristas(data);
    });

    const unsubCargasFinalizadas = firestoreService.subscribeCargasFinalizadas((data) => {
      useStore.getState().setCargasFinalizadas(data);
    });

    const unsubKmRegistros = firestoreService.subscribeKmRegistros((data) => {
      useStore.getState().setKmRegistros(data);
    });

    const unsubClientesGeoloc = firestoreService.subscribeClientesGeoloc((data) => {
      useStore.getState().setClientesGeoloc(data);
    });

    const unsubSolicitacoesGeoloc = firestoreService.subscribeSolicitacoesGeoloc((data) => {
      useStore.getState().setSolicitacoesGeoloc(data);
    });

    const unsubSolicitacoesDevolucao = firestoreService.subscribeSolicitacoesDevolucao((data) => {
      useStore.getState().setSolicitacoesDevolucao(data);
    });

    const unsubGruposClientes = firestoreService.subscribeGruposClientes((data) => {
      useStore.getState().setGruposClientes(data);
    });

    const unsubVeiculos = firestoreService.subscribeVeiculos((data) => {
      useStore.getState().setVeiculos(data);
    });

    const unsubConfigDiarias = firestoreService.subscribeConfigDiarias((data) => {
      useStore.getState().setConfigDiarias(data);
    });

    const unsubFuncionariosRJ = firestoreService.subscribeFuncionariosRJ((data) => {
      useStore.getState().setFuncionariosRJ(data);
    });

    const unsubCargasProgramacao = firestoreService.subscribeCargasProgramacao((data) => {
      useStore.getState().setCargasProgramacao(data);
    });

    return () => {
      unsubEntregas();
      unsubDevolucoes();
      unsubDespesas();
      unsubMotoristas();
      unsubVeiculos();
      unsubConfigDiarias();
      unsubFuncionariosRJ();
      unsubCargasProgramacao();
      unsubCargasFinalizadas();
      unsubKmRegistros();
      unsubClientesGeoloc();
      unsubSolicitacoesGeoloc();
      unsubSolicitacoesDevolucao();
      unsubGruposClientes();
    };
  }, [userRole, userPlaca]);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={
          <ProtectedRoute allowedRoles={['Motorista', 'Monitoramento']}>
            <Entregas />
          </ProtectedRoute>
        } />
        
        <Route path="/dashboard" element={
          <ProtectedRoute allowedRoles={['Operacao', 'Monitoramento']}>
            <DashboardLogistico />
          </ProtectedRoute>
        } />

        <Route path="/programacao" element={
          <ProtectedRoute allowedRoles={['Operacao', 'Monitoramento']}>
            <ProgramacaoCargas />
          </ProtectedRoute>
        } />
        
        <Route path="/devolucoes" element={
          <ProtectedRoute allowedRoles={['Operacao', 'Monitoramento']} allowedSubRoles={['Docas']}>
            <Devolucoes />
          </ProtectedRoute>
        } />

        <Route path="/frota" element={
          <ProtectedRoute allowedRoles={['Operacao', 'Monitoramento']} allowedSubRoles={['Docas']}>
            <StatusFrota />
          </ProtectedRoute>
        } />
        
        <Route path="/canhotos" element={
          <ProtectedRoute allowedRoles={['Monitoramento']}>
            <Canhotos />
          </ProtectedRoute>
        } />
        
        <Route path="/importacao" element={
          <ProtectedRoute allowedRoles={['Monitoramento']}>
            <Importacao />
          </ProtectedRoute>
        } />

        <Route path="/exportacao" element={
          <ProtectedRoute allowedRoles={['Monitoramento']}>
            <Exportacao />
          </ProtectedRoute>
        } />

        <Route path="/api-rest" element={
          <ProtectedRoute allowedRoles={['Monitoramento']}>
            <ApiRest />
          </ProtectedRoute>
        } />

        <Route path="/relatorios" element={
          <ProtectedRoute allowedRoles={['Monitoramento']}>
            <Relatorios />
          </ProtectedRoute>
        } />

        <Route path="/imprimir-guia/:id" element={
          <ProtectedRoute allowedRoles={['Operacao', 'Monitoramento']} allowedSubRoles={['Docas']}>
            <GuiaImpressao />
          </ProtectedRoute>
        } />

        <Route path="/custos" element={
          <ProtectedRoute allowedRoles={['Operacao', 'Monitoramento']} allowedSubRoles={['Financeiro']}>
            <Despesas />
          </ProtectedRoute>
        } />
        
        <Route path="/km" element={
          <ProtectedRoute allowedRoles={['Monitoramento']}>
            <KmControle />
          </ProtectedRoute>
        } />

        <Route path="/cadastros" element={
          <ProtectedRoute allowedRoles={['Monitoramento']}>
            <Cadastros />
          </ProtectedRoute>
        } />

        <Route path="/clientes" element={
          <ProtectedRoute allowedRoles={['Monitoramento']}>
            <Cadastros />
          </ProtectedRoute>
        } />

        <Route path="/geolocalizacao" element={<Navigate to="/cadastros?aba=geolocalizacao" replace />} />
        
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
