import { useEffect, lazy, Suspense, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Loader2 } from 'lucide-react';
import { Layout } from './components/Layout/Layout';
import { Login } from './pages/Login';
import { Entregas } from './pages/Entregas';
import { useStore } from './store/useStore';
import { auth } from './lib/firebase';
import { firestoreService } from './lib/firestoreService';
import { IS_MOTORISTA_APK, IS_GESTAO_APK, IS_NATIVE_APK } from './lib/appConfig';
import { initNativeBackButton } from './lib/mobileBridge';
import {
  getSystemNotificationPermission,
  registerDeviceForNotifications,
  ensureServiceWorkerRegistration
} from './lib/pushNotifications';
import { useAutoVersionReload } from './hooks/useAutoVersionReload';

const IS_MOTORISTA_BUILD = import.meta.env.VITE_APP_FLAVOR === 'motorista';

// Lazy-loaded pages (excluídas automaticamente do bundle do APK Motorista)
const Devolucoes = IS_MOTORISTA_BUILD ? null : lazy(() => import('./pages/Devolucoes').then(m => ({ default: m.Devolucoes })));
const Canhotos = IS_MOTORISTA_BUILD ? null : lazy(() => import('./pages/Canhotos').then(m => ({ default: m.Canhotos })));
const Importacao = IS_MOTORISTA_BUILD ? null : lazy(() => import('./pages/Importacao').then(m => ({ default: m.Importacao })));
const Exportacao = IS_MOTORISTA_BUILD ? null : lazy(() => import('./pages/Exportacao').then(m => ({ default: m.Exportacao })));
const ApiRest = IS_MOTORISTA_BUILD ? null : lazy(() => import('./pages/ApiRest').then(m => ({ default: m.ApiRest })));
const Relatorios = IS_MOTORISTA_BUILD ? null : lazy(() => import('./pages/Relatorios').then(m => ({ default: m.Relatorios })));
const GuiaImpressao = IS_MOTORISTA_BUILD ? null : lazy(() => import('./pages/GuiaImpressao').then(m => ({ default: m.GuiaImpressao })));
const StatusFrota = IS_MOTORISTA_BUILD ? null : lazy(() => import('./pages/StatusFrota').then(m => ({ default: m.StatusFrota })));
const Despesas = IS_MOTORISTA_BUILD ? null : lazy(() => import('./pages/Despesas').then(m => ({ default: m.Despesas })));
const Cadastros = IS_MOTORISTA_BUILD ? null : lazy(() => import('./pages/Cadastros').then(m => ({ default: m.Cadastros })));
const KmControle = IS_MOTORISTA_BUILD ? null : lazy(() => import('./pages/KmControle').then(m => ({ default: m.KmControle })));
const DashboardLogistico = IS_MOTORISTA_BUILD ? null : lazy(() => import('./pages/DashboardLogistico').then(m => ({ default: m.DashboardLogistico })));
const ModoTV = IS_MOTORISTA_BUILD ? null : lazy(() => import('./pages/ModoTV').then(m => ({ default: m.ModoTV })));
const ProgramacaoCargas = IS_MOTORISTA_BUILD ? null : lazy(() => import('./pages/ProgramacaoCargas').then(m => ({ default: m.ProgramacaoCargas })));

const EMAILS_MONITORAMENTO_PERMITIDOS = new Set([
  'adson.sousa@rjalimentos.com.br',
  'kathellen.silva@rjalimentos.com.br',
  'anderson.silva@rjalimentos.com.br'
]);

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

const AuthBootScreen = () => (
  <div className="min-h-screen bg-background-tertiary flex flex-col items-center justify-center text-text-secondary gap-3">
    <Loader2 className="w-7 h-7 animate-spin text-info" />
    <span className="text-sm font-semibold text-text-primary">Verificando sessão segura...</span>
  </div>
);

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles, allowedSubRoles }) => {
  const currentUser = useStore(state => state.currentUser);
  const authReady = useStore(state => state.authReady);

  if (!authReady) return <AuthBootScreen />;
  if (!currentUser) return <Navigate to="/login" replace />;

  const getDefaultPath = () => {
    if (currentUser.role === 'Motorista') return '/';
    if (currentUser.role === 'TV') return '/tv';
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
  const userSubRole = currentUser?.subRole || null;
  const userPlaca = currentUser?.placa ? String(currentUser.placa).trim().toUpperCase() : null;
  const codigosGeolocBuscadosRef = useRef(new Set());

  // Monitora continuamente a publicação de novas versões na Vercel (desativado automaticamente no APK)
  useAutoVersionReload(60000);

  // Botão físico Voltar do Android + pré-registro do Service Worker na Web
  useEffect(() => {
    initNativeBackButton();
    if (!IS_NATIVE_APK) {
      ensureServiceWorkerRegistration();
    }
  }, []);

  // Sincronização oficial da sessão com o Firebase Auth (Custom Claims)
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        useStore.getState().setCurrentUserFromFirebase(null);
        return;
      }

      try {
        const tokenRes = await fbUser.getIdTokenResult();
        const claims = tokenRes.claims || {};
        const emailLower = String(fbUser.email || '').trim().toLowerCase();

        let role = claims.role || null;
        if (!role && EMAILS_MONITORAMENTO_PERMITIDOS.has(emailLower)) {
          role = 'Monitoramento';
        }
        if (!role && emailLower.endsWith('@frota.logistrack.app')) {
          const prefix = emailLower.split('@')[0];
          if (prefix === 'docas' || prefix === 'financeiro') role = 'Operacao';
          else if (prefix === 'tv') role = 'TV';
          else role = 'Motorista';
        }

        // Bloqueio rígido de perfil por APK (Motorista vs Gestão)
        if ((IS_MOTORISTA_APK && role !== 'Motorista') || (IS_GESTAO_APK && (role === 'Motorista' || role === 'TV')) || !role) {
          await signOut(auth).catch(() => {});
          useStore.getState().setCurrentUserFromFirebase(null);
          return;
        }

        let userObj;
        if (role === 'Motorista') {
          const placa = String(claims.placa || emailLower.split('@')[0] || '').trim().toUpperCase();
          userObj = { uid: fbUser.uid, role: 'Motorista', placa };
        } else if (role === 'Operacao') {
          const subRole = claims.subRole || (emailLower.startsWith('financeiro') ? 'Financeiro' : 'Docas');
          userObj = {
            uid: fbUser.uid,
            role: 'Operacao',
            subRole,
            setor: subRole,
            nome: claims.nome || `Operação • ${subRole}`
          };
        } else if (role === 'TV') {
          userObj = { uid: fbUser.uid, role: 'TV', nome: 'Painel Modo TV' };
        } else {
          userObj = {
            uid: fbUser.uid,
            role: 'Monitoramento',
            email: emailLower,
            nome: claims.nome || fbUser.displayName || emailLower
          };
        }

        useStore.getState().setCurrentUserFromFirebase(userObj);

        // Registra Push automaticamente no APK Android ou quando o navegador já concedeu permissão
        if (role !== 'TV') {
          const perm = await getSystemNotificationPermission();
          if (IS_NATIVE_APK || perm === 'granted') {
            registerDeviceForNotifications(userObj, (url) => {
              if (url && typeof window !== 'undefined') {
                window.location.href = url;
              }
            }).catch(() => {});
          }
        }
      } catch (err) {
        console.error('[Auth] Falha ao restaurar sessão:', err);
        useStore.getState().setCurrentUserFromFirebase(null);
      }
    });

    return () => unsubAuth();
  }, []);

  // Assinaturas em tempo real do Firestore estritamente segregadas por perfil autenticado
  useEffect(() => {
    if (!userRole) return;

    // --- 1. MODO MOTORISTA: Apenas dados da própria placa e dos últimos 7 dias ---
    if (userRole === 'Motorista' && userPlaca) {
      const dataMinima7Dias = getBrasiliaDateStringOffset(7);

      const unsubEntregas = firestoreService.subscribeEntregasMotorista(userPlaca, dataMinima7Dias, async (data) => {
        useStore.getState().setEntregasMotorista(data, userPlaca, dataMinima7Dias);

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

    // --- 2. MODO TV (RESTRITO): Apenas coleções de status operacional, ZERO dados financeiros ou PII ---
    if (userRole === 'TV') {
      const unsubEntregas = firestoreService.subscribeEntregas((data) => {
        useStore.getState().setEntregas(data);
      });
      const unsubDevolucoes = firestoreService.subscribeDevolucoes((data) => {
        useStore.getState().setDevolucoes(data);
      });
      const unsubSolicDevolucao = firestoreService.subscribeSolicitacoesDevolucao((data) => {
        useStore.getState().setSolicitacoesDevolucao(data);
      });
      const unsubSolicGeoloc = firestoreService.subscribeSolicitacoesGeoloc((data) => {
        useStore.getState().setSolicitacoesGeoloc(data);
      });
      const unsubVeiculos = firestoreService.subscribeVeiculos((data) => {
        useStore.getState().setVeiculos(data);
      });
      const unsubCargasProg = firestoreService.subscribeCargasProgramacao((data) => {
        useStore.getState().setCargasProgramacao(data);
      });

      return () => {
        unsubEntregas();
        unsubDevolucoes();
        unsubSolicDevolucao();
        unsubSolicGeoloc();
        unsubVeiculos();
        unsubCargasProg();
      };
    }

    // --- 3. MODO MONITORAMENTO & OPERAÇÃO: Visão completa da operação ---
    const unsubs = [];

    unsubs.push(firestoreService.subscribeEntregas((data) => {
      useStore.getState().setEntregas(data);
    }));

    unsubs.push(firestoreService.subscribeDevolucoes((data) => {
      useStore.getState().setDevolucoes(data);
    }));

    unsubs.push(firestoreService.subscribeDespesas((data) => {
      useStore.getState().setDespesas(data);
    }));

    unsubs.push(firestoreService.subscribeMotoristas((data) => {
      useStore.getState().setMotoristas(data);
    }));

    unsubs.push(firestoreService.subscribeCargasFinalizadas((data) => {
      useStore.getState().setCargasFinalizadas(data);
    }));

    unsubs.push(firestoreService.subscribeKmRegistros((data) => {
      useStore.getState().setKmRegistros(data);
    }));

    unsubs.push(firestoreService.subscribeClientesGeoloc((data) => {
      useStore.getState().setClientesGeoloc(data);
    }));

    unsubs.push(firestoreService.subscribeSolicitacoesGeoloc((data) => {
      useStore.getState().setSolicitacoesGeoloc(data);
    }));

    unsubs.push(firestoreService.subscribeSolicitacoesDevolucao((data) => {
      useStore.getState().setSolicitacoesDevolucao(data);
    }));

    unsubs.push(firestoreService.subscribeGruposClientes((data) => {
      useStore.getState().setGruposClientes(data);
    }));

    unsubs.push(firestoreService.subscribeVeiculos((data) => {
      useStore.getState().setVeiculos(data);
    }));

    unsubs.push(firestoreService.subscribeConfigDiarias((data) => {
      useStore.getState().setConfigDiarias(data);
    }));

    unsubs.push(firestoreService.subscribeCargasProgramacao((data) => {
      useStore.getState().setCargasProgramacao(data);
    }));

    if (userRole === 'Monitoramento') {
      unsubs.push(firestoreService.subscribeFuncionariosRJ((data) => {
        useStore.getState().setFuncionariosRJ(data);
      }));
      unsubs.push(firestoreService.subscribeCredenciaisFrota((data) => {
        useStore.getState().setCredenciaisFrota(data);
      }));
    }

    if (userRole === 'Monitoramento' || (userRole === 'Operacao' && (userSubRole || 'Docas') === 'Docas')) {
      const dataMinimaRotas = getBrasiliaDateStringOffset(7);
      unsubs.push(firestoreService.subscribeRastreamentoFrota((data) => {
        useStore.getState().setRastreamentoFrota(data);
      }));
      unsubs.push(firestoreService.subscribeRotasGpsPorDatas(dataMinimaRotas, (data) => {
        useStore.getState().setRotasGps(data);
      }));
    }

    return () => {
      unsubs.forEach(fn => {
        try { if (typeof fn === 'function') fn(); } catch {}
      });
    };
  }, [userRole, userSubRole, userPlaca]);

  // Se for o APK exclusivo de Motoristas, expõe somente as rotas /login e /
  if (IS_MOTORISTA_BUILD) {
    return (
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={
            <ProtectedRoute allowedRoles={['Motorista']}>
              <Entregas />
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />

        {!IS_GESTAO_APK && ModoTV && (
          <>
            <Route path="/tv" element={
              <Suspense fallback={<PageLoader />}>
                <ModoTV />
              </Suspense>
            } />
            <Route path="/telao" element={<Navigate to="/tv" replace />} />
          </>
        )}

        <Route path="/" element={
          <ProtectedRoute allowedRoles={IS_GESTAO_APK ? ['Monitoramento'] : ['Motorista', 'Monitoramento']}>
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

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
