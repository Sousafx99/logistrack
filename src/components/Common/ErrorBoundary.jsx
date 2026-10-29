import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    const msg = String(error?.message || error || 'Erro inesperado');
    // Se for falha de carregamento de chunk após atualização na Vercel, recarrega automaticamente uma única vez
    if (
      typeof window !== 'undefined' &&
      (msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Importing a module script failed') ||
        msg.includes('Loading chunk'))
    ) {
      const lastAutoReload = Number(sessionStorage.getItem('lt_chunk_reload_ts') || 0);
      if (Date.now() - lastAutoReload > 15000) {
        sessionStorage.setItem('lt_chunk_reload_ts', String(Date.now()));
        window.location.reload();
      }
    }
    return { hasError: true, errorMessage: msg };
  }

  componentDidCatch(error, info) {
    console.error('[LogisTrack ErrorBoundary]', error, info);
  }

  handleReload = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background-tertiary flex items-center justify-center p-5">
          <div className="max-w-md w-full bg-background-primary border border-border-secondary rounded-2xl shadow-lg p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary">
                Atualização de Tela Necessária
              </h2>
              <p className="text-xs text-text-secondary mt-1">
                O sistema detectou uma falha temporária ao montar esta tela. Clique abaixo para restaurar imediatamente.
              </p>
            </div>
            {this.state.errorMessage && (
              <p className="text-[11px] font-mono text-text-tertiary bg-background-secondary border border-border-tertiary rounded-lg p-2.5 break-words text-left">
                {this.state.errorMessage}
              </p>
            )}
            <button
              type="button"
              onClick={this.handleReload}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-info hover:bg-info/90 text-white text-sm font-bold shadow-xs cursor-pointer transition-all"
            >
              <RefreshCw size={16} />
              <span>Recarregar Sistema</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
