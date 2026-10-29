import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { Lock, Eye, EyeOff, CheckCircle2, AlertTriangle, Loader2, ArrowLeft, ShieldCheck } from 'lucide-react';
import { auth } from '../lib/firebase';
import { Logo } from '../components/Common/Logo';

export function RedefinirSenha() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const oobCode = searchParams.get('oobCode');
  const mode = searchParams.get('mode');

  const [email, setEmail] = useState('');
  const [verificandoCodigo, setVerificandoCodigo] = useState(true);
  const [codigoValido, setCodigoValido] = useState(false);
  const [erroValidacao, setErroValidacao] = useState('');

  const [novaSenha, setNovaSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erroSalvar, setErroSalvar] = useState('');

  useEffect(() => {
    if (!oobCode || (mode && mode !== 'resetPassword')) {
      setVerificandoCodigo(false);
      setErroValidacao('Link de redefinição inválido ou incompleto. Solicite um novo link na tela de login.');
      return;
    }

    verifyPasswordResetCode(auth, oobCode)
      .then((userEmail) => {
        setEmail(userEmail);
        setCodigoValido(true);
        setVerificandoCodigo(false);
      })
      .catch((err) => {
        setVerificandoCodigo(false);
        const code = String(err?.code || '');
        if (code === 'auth/expired-action-code') {
          setErroValidacao('Este link de redefinição já expirou. Solicite um novo link na tela de login.');
        } else if (code === 'auth/invalid-action-code') {
          setErroValidacao('Este link de redefinição já foi utilizado ou é inválido.');
        } else {
          setErroValidacao('Não foi possível validar a solicitação de redefinição.');
        }
      });
  }, [oobCode, mode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErroSalvar('');

    if (novaSenha.length < 6) {
      setErroSalvar('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (novaSenha !== confirmaSenha) {
      setErroSalvar('A confirmação de senha não confere com a nova senha digitada.');
      return;
    }

    setSalvando(true);
    try {
      await confirmPasswordReset(auth, oobCode, novaSenha);
      setSucesso(true);
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 3000);
    } catch (err) {
      const code = String(err?.code || '');
      if (code === 'auth/weak-password') {
        setErroSalvar('A senha informada é fraca. Crie uma senha mais segura com letras e números.');
      } else {
        setErroSalvar('Erro ao registrar nova senha. O link pode ter expirado.');
      }
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-tertiary flex flex-col justify-center px-5 py-10 relative">
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center justify-center">
        <div className="w-20 h-20 mb-4 rounded-2xl bg-background-secondary border border-border-secondary flex items-center justify-center p-3 shadow-md">
          <Logo className="w-full h-full" />
        </div>
        <h2 className="text-center text-2xl sm:text-3xl font-bold leading-9 tracking-tight text-text-primary">
          LogisTrack
        </h2>
        <p className="mt-1 text-center text-xs sm:text-sm text-text-secondary font-medium">
          Gestão de Segurança e Acesso — RJ Alimentos
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-[440px]">
        <div className="glass-panel px-6 py-7 shadow-md rounded-2xl sm:px-10">
          {verificandoCodigo ? (
            <div className="py-10 flex flex-col items-center justify-center gap-3 text-text-secondary">
              <Loader2 className="w-7 h-7 animate-spin text-info" />
              <span className="text-sm font-semibold">Validando link de segurança...</span>
            </div>
          ) : erroValidacao ? (
            <div className="space-y-5 text-center">
              <div className="w-12 h-12 rounded-2xl bg-danger/15 text-danger border border-danger/30 flex items-center justify-center mx-auto">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-text-primary">Link Indisponível</h3>
                <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
                  {erroValidacao}
                </p>
              </div>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-info hover:bg-info/90 text-white text-xs font-bold shadow-xs transition-all"
              >
                <ArrowLeft size={14} />
                <span>Voltar para o Login</span>
              </Link>
            </div>
          ) : sucesso ? (
            <div className="space-y-5 text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-text-primary">Senha Redefinida!</h3>
                <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
                  Sua nova senha de acesso foi salva com sucesso no sistema. Redirecionando para o login...
                </p>
              </div>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-info hover:bg-info/90 text-white text-xs font-bold shadow-xs transition-all"
              >
                <span>Acessar Agora</span>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="text-center pb-1">
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-info/10 text-info border border-info/20 mb-2">
                  <ShieldCheck size={12} /> Redefinição Segura
                </div>
                <h3 className="text-lg font-bold text-text-primary">Criar Nova Senha</h3>
                {email && (
                  <p className="text-xs text-text-secondary mt-0.5 font-mono">
                    {email}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Nova Senha
                </label>
                <div className="relative">
                  <input
                    type={mostrarSenha ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="block w-full rounded-xl border border-border-secondary py-2.5 pl-3.5 pr-10 text-text-primary shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-info sm:text-sm bg-background-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha((v) => !v)}
                    className="absolute right-3 top-2.5 text-text-muted hover:text-text-primary cursor-pointer p-0.5"
                    tabIndex={-1}
                  >
                    {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Confirmação da Nova Senha
                </label>
                <div className="relative">
                  <input
                    type={mostrarSenha ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={confirmaSenha}
                    onChange={(e) => setConfirmaSenha(e.target.value)}
                    placeholder="Repita a nova senha"
                    className="block w-full rounded-xl border border-border-secondary py-2.5 pl-3.5 pr-10 text-text-primary shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-info sm:text-sm bg-background-primary"
                  />
                </div>
              </div>

              {erroSalvar && (
                <div className="text-xs font-medium text-danger bg-danger/10 border border-danger/25 p-3 rounded-xl">
                  {erroSalvar}
                </div>
              )}

              <button
                type="submit"
                disabled={salvando}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-info hover:bg-info/90 text-white text-sm font-bold shadow-xs cursor-pointer transition-all disabled:opacity-60"
              >
                {salvando && <Loader2 size={16} className="animate-spin" />}
                <span>{salvando ? 'Salvando Senha...' : 'Confirmar Nova Senha'}</span>
              </button>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="text-xs font-medium text-text-secondary hover:text-text-primary hover:underline"
                >
                  Cancelar e voltar para login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
