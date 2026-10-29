import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { Eye, EyeOff, Loader2, Mail, Sun, Moon, Monitor, KeyRound, CheckCircle2, Truck, ShieldCheck } from 'lucide-react';
import { useStore } from '../store/useStore';
import { auth } from '../lib/firebase';
import { Logo } from '../components/Common/Logo';
import { IS_MOTORISTA_APK, IS_GESTAO_APK, IS_NATIVE_APK } from '../lib/appConfig';
import {
  getThemePreference,
  cycleThemePreference,
  subscribeThemeChange
} from '../lib/themeManager';
import { registerDeviceForNotifications } from '../lib/pushNotifications';

const EMAILS_AUTORIZADOS_MONITORAMENTO = new Set([
  'adson.sousa@rjalimentos.com.br',
  'kathellen.silva@rjalimentos.com.br',
  'anderson.silva@rjalimentos.com.br'
]);

function traduzirErroFirebase(err, role) {
  const code = String(err?.code || '');
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found' ||
    code === 'auth/invalid-email'
  ) {
    if (role === 'Motorista') {
      return 'Credenciais inválidas. Confira os dados informados ou consulte a Gestão Logística.';
    }
    if (role === 'Monitoramento') {
      return 'E-mail corporativo ou senha inválidos. Caso necessário, utilize a opção de redefinição de senha por e-mail.';
    }
    return 'Credenciais de acesso inválidas.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Acesso temporariamente bloqueado por excesso de tentativas. Aguarde alguns instantes ou redefina sua senha por e-mail.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Falha de conexão com o servidor. Verifique sua rede Wi-Fi ou dados móveis.';
  }
  return err?.message || 'Não foi possível autenticar sua sessão.';
}

export function Login() {
  const defaultRole = IS_MOTORISTA_APK ? 'Motorista' : IS_GESTAO_APK ? 'Monitoramento' : 'Motorista';

  const [role, setRole] = useState(defaultRole);
  const [usuario, setUsuario] = useState('');
  const [emailMonitoramento, setEmailMonitoramento] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [themePref, setThemePref] = useState(getThemePreference());

  const login = useStore(state => state.login);
  const enviarRedefinicaoSenhaEmail = useStore(state => state.enviarRedefinicaoSenhaEmail);
  const currentUser = useStore(state => state.currentUser);
  const navigate = useNavigate();

  useEffect(() => {
    return subscribeThemeChange(({ preference }) => setThemePref(preference));
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === 'Motorista') navigate('/', { replace: true });
    else if (currentUser.role === 'Operacao') {
      navigate(currentUser.subRole === 'Financeiro' ? '/custos' : '/devolucoes', { replace: true });
    } else if (currentUser.role === 'TV') {
      navigate('/tv', { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  }, [currentUser, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');
    setLoading(true);

    try {
      const creds =
        role === 'Monitoramento'
          ? { email: emailMonitoramento, senha }
          : { usuario, senha };

      const user = await login(role, creds);

      if (user) {
        registerDeviceForNotifications(user, (url) => {
          if (url) navigate(url);
        }).catch(() => {});

        if (user.role === 'Motorista') {
          navigate('/', { replace: true });
        } else if (user.role === 'Operacao') {
          navigate(user.subRole === 'Financeiro' ? '/custos' : '/devolucoes', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      } else {
        setError('Preencha todos os campos obrigatórios para continuar.');
      }
    } catch (err) {
      setError(traduzirErroFirebase(err, role));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordEmail = async () => {
    setError('');
    setInfoMsg('');
    const targetEmail = String(emailMonitoramento || '').trim().toLowerCase();
    if (!targetEmail) {
      setError('Informe seu e-mail corporativo no campo acima para receber as instruções de redefinição de senha.');
      return;
    }

    setResetLoading(true);
    try {
      await enviarRedefinicaoSenhaEmail(targetEmail);
      setInfoMsg(`Instruções de redefinição enviadas para ${targetEmail}. Verifique sua caixa de entrada e a pasta de Spam.`);
    } catch (err) {
      setError(traduzirErroFirebase(err, 'Monitoramento'));
    } finally {
      setResetLoading(false);
    }
  };

  const handleGoogleMonitoramento = async () => {
    setError('');
    setInfoMsg('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      const emailLower = String(cred.user?.email || '').trim().toLowerCase();
      const tokenRes = await cred.user.getIdTokenResult();
      const isAllowed =
        tokenRes.claims?.role === 'Monitoramento' ||
        EMAILS_AUTORIZADOS_MONITORAMENTO.has(emailLower);

      if (!isAllowed) {
        await signOut(auth);
        setError('Esta conta corporativa não possui permissão de acesso ao módulo de Monitoramento.');
        return;
      }

      const userObj = {
        uid: cred.user.uid,
        role: 'Monitoramento',
        email: emailLower,
        nome: tokenRes.claims?.nome || cred.user.displayName || emailLower
      };
      useStore.getState().setCurrentUserFromFirebase(userObj);
      registerDeviceForNotifications(userObj, (url) => {
        if (url) navigate(url);
      }).catch(() => {});
      navigate('/', { replace: true });
    } catch (err) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setError(traduzirErroFirebase(err, 'Monitoramento'));
      }
    } finally {
      setLoading(false);
    }
  };

  const themeIcon = themePref === 'dark' ? <Moon size={16} /> : themePref === 'system' ? <Monitor size={16} /> : <Sun size={16} />;
  const themeLabel = themePref === 'dark' ? 'Escuro' : themePref === 'system' ? 'Sistema' : 'Creme';

  return (
    <div className="min-h-screen bg-background-tertiary flex flex-col justify-center px-5 py-10 relative">
      {/* Botão de Tema no canto superior direito */}
      <div className="fixed top-4 right-4 z-20" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
        <button
          type="button"
          onClick={() => cycleThemePreference()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-background-secondary border border-border-secondary text-text-primary text-xs font-bold shadow-sm hover:border-info/50 transition-all cursor-pointer"
          title="Alternar tema (Claro Creme / Escuro / Sistema)"
        >
          {themeIcon}
          <span>Tema: {themeLabel}</span>
        </button>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center justify-center">
        <div className="w-20 h-20 mb-4 rounded-2xl bg-background-secondary border border-border-secondary flex items-center justify-center p-3 shadow-md">
          <Logo className="w-full h-full" />
        </div>
        <div className="flex items-center gap-2">
          <h2 className="text-center text-3xl font-bold leading-9 tracking-tight text-text-primary">
            LogisTrack
          </h2>
          {IS_MOTORISTA_APK && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-info/15 text-info border border-info/30 flex items-center gap-1">
              <Truck size={12} /> Motorista
            </span>
          )}
          {IS_GESTAO_APK && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <ShieldCheck size={12} /> Gestão
            </span>
          )}
        </div>
        <p className="mt-1.5 text-center text-sm text-text-secondary font-medium">
          {IS_MOTORISTA_APK
            ? 'Módulo Operacional de Entregas & Rotas — RJ Alimentos'
            : IS_GESTAO_APK
              ? 'Gestão Logística, Docas e Financeiro — RJ Alimentos'
              : 'Sistema Integrado de Monitoramento Logístico — RJ Alimentos'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-[460px]">
        <div className="glass-panel px-6 py-7 shadow-md rounded-2xl sm:px-10">
          <form className="space-y-5" onSubmit={handleLogin}>
            {/* Seletor de Perfil (oculto no APK Motorista que já é exclusivo) */}
            {!IS_MOTORISTA_APK && (
              <div>
                <label className="block text-sm font-semibold leading-6 text-text-primary">
                  Perfil de Acesso
                </label>
                <div className="mt-1.5">
                  <select
                    value={role}
                    onChange={(e) => {
                      setRole(e.target.value);
                      setError('');
                      setInfoMsg('');
                    }}
                    className="block w-full rounded-xl border border-border-secondary py-2.5 px-3.5 text-text-primary font-semibold shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-info sm:text-sm bg-background-primary"
                  >
                    {!IS_GESTAO_APK && <option value="Motorista">Motorista (Frota)</option>}
                    <option value="Monitoramento">Monitoramento (Gestão)</option>
                    <option value="Operacao">Operação (Docas / Financeiro)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Campos do Motorista (sem exemplos de placa) */}
            {role === 'Motorista' && (
              <div>
                <label className="block text-sm font-semibold leading-6 text-text-primary">
                  Placa do Veículo
                </label>
                <div className="mt-1.5">
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    value={usuario}
                    onChange={(e) => setUsuario(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7))}
                    placeholder="Informe a placa"
                    className="block w-full rounded-xl border border-border-secondary py-2.5 px-3.5 text-text-primary font-mono font-bold tracking-wider shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-info sm:text-sm bg-background-primary uppercase placeholder:normal-case placeholder:font-sans placeholder:font-normal placeholder:tracking-normal"
                  />
                </div>
              </div>
            )}

            {/* Campos do Monitoramento (sem dicas ou botões de e-mail expostos) */}
            {role === 'Monitoramento' && (
              <div>
                <label className="block text-sm font-semibold leading-6 text-text-primary">
                  E-mail Corporativo
                </label>
                <div className="mt-1.5 relative">
                  <Mail size={16} className="absolute left-3.5 top-3 text-text-muted pointer-events-none" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={emailMonitoramento}
                    onChange={(e) => setEmailMonitoramento(e.target.value)}
                    placeholder="Informe seu e-mail corporativo"
                    className="block w-full rounded-xl border border-border-secondary py-2.5 pl-10 pr-3.5 text-text-primary font-medium shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-info sm:text-sm bg-background-primary"
                  />
                </div>
              </div>
            )}

            {/* Campo de Senha com botão Olho (sem exemplo de padrão de senha) */}
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold leading-6 text-text-primary">
                  {role === 'Motorista' ? 'Senha do Veículo' : 'Senha de Acesso'}
                </label>
                {role === 'Monitoramento' && (
                  <button
                    type="button"
                    disabled={resetLoading}
                    onClick={handleResetPasswordEmail}
                    className="text-xs font-bold text-info hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {resetLoading ? <Loader2 size={12} className="animate-spin" /> : <KeyRound size={12} />}
                    <span>Redefinir senha por e-mail</span>
                  </button>
                )}
              </div>
              <div className="mt-1.5 relative">
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Digite sua senha"
                  className="block w-full rounded-xl border border-border-secondary py-2.5 pl-3.5 pr-10 text-text-primary shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-info sm:text-sm bg-background-primary"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((v) => !v)}
                  className="absolute right-3 top-2.5 text-text-muted hover:text-text-primary cursor-pointer p-0.5"
                  tabIndex={-1}
                  title={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-xs sm:text-sm font-medium text-danger bg-danger/10 border border-danger/25 p-3 rounded-xl">
                {error}
              </div>
            )}

            {infoMsg && (
              <div className="text-xs sm:text-sm font-medium text-success bg-success/10 border border-success/25 p-3 rounded-xl flex items-start gap-2">
                <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                <span>{infoMsg}</span>
              </div>
            )}

            <div className="space-y-2.5 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-info px-4 py-3 text-sm font-bold leading-6 text-white shadow-sm hover:bg-info/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info transition-all cursor-pointer disabled:opacity-60"
              >
                {loading && <Loader2 size={18} className="animate-spin" />}
                <span>{loading ? 'Autenticando...' : 'Entrar no Sistema'}</span>
              </button>

              {role === 'Monitoramento' && !IS_NATIVE_APK && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleGoogleMonitoramento}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-background-primary border border-border-secondary px-4 py-2.5 text-xs sm:text-sm font-bold text-text-primary hover:bg-background-tertiary transition-all cursor-pointer disabled:opacity-60"
                >
                  <span>Entrar com Conta Google Corporativa</span>
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
