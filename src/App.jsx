import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout/Layout';
import { Login } from './pages/Login';
import { Entregas } from './pages/Entregas';
import { Devolucoes } from './pages/Devolucoes';
import { Canhotos } from './pages/Canhotos';
import { Importacao } from './pages/Importacao';
import { Exportacao } from './pages/Exportacao';
import { ApiRest } from './pages/ApiRest';
import { Relatorios } from './pages/Relatorios';
import { GuiaImpressao } from './pages/GuiaImpressao';
import { StatusFrota } from './pages/StatusFrota';
import { Despesas } from './pages/Despesas';
import { Clientes } from './pages/Clientes';
import { KmControle } from './pages/KmControle';
import { useStore } from './store/useStore';
import { firestoreService } from './lib/firestoreService';

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
  
  return <Layout>{children}</Layout>;
};

function App() {
  useEffect(() => {
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

    return () => {
      unsubEntregas();
      unsubDevolucoes();
      unsubDespesas();
      unsubMotoristas();
      unsubCargasFinalizadas();
      unsubKmRegistros();
      unsubClientesGeoloc();
      unsubSolicitacoesGeoloc();
      unsubSolicitacoesDevolucao();
    };
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={
          <ProtectedRoute allowedRoles={['Motorista', 'Monitoramento']}>
            <Entregas />
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

        <Route path="/clientes" element={
          <ProtectedRoute allowedRoles={['Monitoramento']}>
            <Clientes />
          </ProtectedRoute>
        } />

        <Route path="/geolocalizacao" element={<Navigate to="/clientes" replace />} />
        
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
