import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout/Layout';
import { Login } from './pages/Login';
import { Entregas } from './pages/Entregas';
import { Devolucoes } from './pages/Devolucoes';
import { Canhotos } from './pages/Canhotos';
import { Importacao } from './pages/Importacao';
import { Relatorios } from './pages/Relatorios';
import { GuiaImpressao } from './pages/GuiaImpressao';
import { StatusFrota } from './pages/StatusFrota';
import { Despesas } from './pages/Despesas';
import { useStore } from './store/useStore';
import { firestoreService } from './lib/firestoreService';

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { currentUser } = useStore();
  
  if (!currentUser) return <Navigate to="/login" />;
  if (allowedRoles && !allowedRoles.includes(currentUser.role)) return <Navigate to="/" />;
  
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

    return () => {
      unsubEntregas();
      unsubDevolucoes();
      unsubDespesas();
      unsubMotoristas();
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
          <ProtectedRoute allowedRoles={['Operacao', 'Monitoramento']}>
            <Devolucoes />
          </ProtectedRoute>
        } />

        <Route path="/frota" element={
          <ProtectedRoute allowedRoles={['Operacao', 'Monitoramento']}>
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

        <Route path="/relatorios" element={
          <ProtectedRoute allowedRoles={['Monitoramento']}>
            <Relatorios />
          </ProtectedRoute>
        } />

        <Route path="/imprimir-guia/:id" element={
          <ProtectedRoute allowedRoles={['Operacao', 'Monitoramento']}>
            <GuiaImpressao />
          </ProtectedRoute>
        } />

        <Route path="/custos" element={
          <ProtectedRoute allowedRoles={['Monitoramento']}>
            <Despesas />
          </ProtectedRoute>
        } />
        
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
