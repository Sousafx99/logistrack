import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';

export function Login() {
  const [role, setRole] = useState('Motorista');
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const login = useStore(state => state.login);
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');

    const success = login(role, { usuario, senha });
    
    if (success) {
      if (role === 'Operacao') navigate('/devolucoes');
      else navigate('/');
    } else {
      setError(role === 'Motorista' ? 'Credenciais inválidas. A senha é a própria placa.' : 'Senha de acesso incorreta.');
    }
  };

  return (
    <div className="min-h-screen bg-background-tertiary flex flex-col justify-center px-6 py-12">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="text-center text-2xl font-bold leading-9 tracking-tight text-text-primary">
          LogisTrack
        </h2>
        <p className="mt-2 text-center text-sm text-text-secondary">
          Sistema de Monitoramento Logístico
        </p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-[480px]">
        <div className="glass-panel px-6 py-8 shadow-sm sm:rounded-xl sm:px-12">
          <form className="space-y-6" onSubmit={handleLogin}>
            
            <div>
              <label className="block text-sm font-medium leading-6 text-text-primary">
                Perfil de Acesso
              </label>
              <div className="mt-2">
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="block w-full rounded-md border-0 py-2.5 px-3 text-text-primary shadow-sm ring-1 ring-inset ring-border-secondary focus:ring-2 focus:ring-inset focus:ring-info sm:text-sm sm:leading-6 bg-background-primary"
                >
                  <option value="Motorista">Motorista</option>
                  <option value="Operacao">Operação</option>
                  <option value="Monitoramento">Monitoramento</option>
                </select>
              </div>
            </div>

            {role === 'Motorista' && (
              <div>
                <label className="block text-sm font-medium leading-6 text-text-primary">
                  Placa do Veículo (Usuário)
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    required
                    value={usuario}
                    onChange={(e) => setUsuario(e.target.value.toUpperCase())}
                    placeholder="Ex: OKT9410"
                    className="block w-full rounded-md border-0 py-2.5 px-3 text-text-primary shadow-sm ring-1 ring-inset ring-border-secondary focus:ring-2 focus:ring-inset focus:ring-info sm:text-sm sm:leading-6 bg-background-primary uppercase"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium leading-6 text-text-primary">
                Senha {role !== 'Motorista' ? '(Acesso Restrito)' : ''}
              </label>
              <div className="mt-2">
                <input
                  type="password"
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className={`block w-full rounded-md border-0 py-2.5 px-3 text-text-primary shadow-sm ring-1 ring-inset ring-border-secondary focus:ring-2 focus:ring-inset focus:ring-info sm:text-sm sm:leading-6 bg-background-primary ${role === 'Motorista' ? 'uppercase' : ''}`}
                />
              </div>
            </div>

            {error && (
              <div className="text-sm text-danger bg-danger/10 p-3 rounded-md">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                className="flex w-full justify-center rounded-md bg-info px-3 py-3 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-info/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info transition-colors"
              >
                Entrar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
