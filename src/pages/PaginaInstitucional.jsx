import { Link } from 'react-router-dom';
import { 
  Truck, Navigation, ShieldCheck, CheckCircle2, 
  BarChart3, FileSpreadsheet, Lock, ArrowRight, 
  Smartphone, MapPin, Gauge, Layers, Users
} from 'lucide-react';
import { Logo } from '../components/Common/Logo';

export function PaginaInstitucional() {
  return (
    <div className="min-h-screen bg-background-tertiary text-text-primary flex flex-col">
      {/* Topo / Navbar Pública */}
      <header className="sticky top-0 z-40 bg-background-primary/90 backdrop-blur-md border-b border-border-secondary shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-background-secondary border border-border-secondary flex items-center justify-center p-2 shadow-xs">
              <Logo className="w-full h-full" />
            </div>
            <div>
              <span className="text-lg font-black tracking-tight text-text-primary">LogisTrack</span>
              <span className="hidden sm:inline-block ml-2 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-info/10 text-info border border-info/20">
                Logística & Telemetria
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              to="/privacidade"
              className="text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors hidden sm:block"
            >
              Privacidade
            </Link>
            <Link
              to="/login"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-info text-white text-xs font-bold shadow-xs hover:bg-info/90 transition-all cursor-pointer"
            >
              <span>Acessar Plataforma</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20 flex flex-col gap-16">
        <section className="text-center space-y-5 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-info/10 border border-info/25 text-info text-xs font-extrabold tracking-wide">
            <ShieldCheck size={14} /> Plataforma Desenvolvida por Adson Sousa
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-text-primary leading-tight">
            Monitoramento Inteligente de Frotas e Gestão de Entregas
          </h1>
          <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
            O <strong>LogisTrack</strong> é uma solução tecnológica completa para controle operacional de frotas, rastreamento de veículos via GPS, gestão de devoluções, canhotos digitais e conciliação em tempo real.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <Link
              to="/login"
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-info text-white text-sm font-bold shadow-md hover:bg-info/90 transition-all cursor-pointer"
            >
              <span>Entrar no Sistema</span>
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/privacidade"
              className="flex items-center gap-2 px-5 py-3.5 rounded-xl bg-background-primary border border-border-secondary text-text-primary text-sm font-bold hover:bg-background-secondary transition-all"
            >
              <span>Termos & Privacidade</span>
            </Link>
          </div>
        </section>

        {/* Pilares Funcionais */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-panel p-6 rounded-2xl shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-info/10 text-info flex items-center justify-center border border-info/20">
              <Navigation size={20} />
            </div>
            <h3 className="text-base font-bold text-text-primary">Rastreamento e Telemetria GPS</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Acompanhamento ao vivo de motoristas em rota com mapa interativo, registro de paradas, medição de velocidade e histórico de deslocamento.
            </p>
          </div>

          <div className="glass-panel p-6 rounded-2xl shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
              <Truck size={20} />
            </div>
            <h3 className="text-base font-bold text-text-primary">Gestão de Cargas e Devoluções</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Tratamento ágil de ocorrências, reentregas agendadas, conferência de canhotos fiscais e controle de status de entrega com validação em campo.
            </p>
          </div>

          <div className="glass-panel p-6 rounded-2xl shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
              <BarChart3 size={20} />
            </div>
            <h3 className="text-base font-bold text-text-primary">Dashboards & Prestação de Contas</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Controle de despesas operacionais com PIX, relatórios analíticos, modo painel para TVs de monitoramento e integração de dados de múltiplos veículos.
            </p>
          </div>
        </section>

        {/* Finalidade do App (para aprovação do Google) */}
        <section className="glass-panel p-6 sm:p-8 rounded-2xl shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <Lock size={18} className="text-info" /> Finalidade e Escopo de Acesso
          </h2>
          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
            O LogisTrack foi idealizado e construído pelo desenvolvedor Adson Sousa para atender a demanda de transporte e logística corporativa. O acesso ao painel administrativo e ao aplicativo móvel de motoristas é restrito a operadores cadastrados com credenciais emitidas pela administração.
          </p>
          <div className="flex flex-wrap gap-4 pt-2 text-xs font-semibold text-text-primary">
            <div className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> Autenticação Google OAuth Segura</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> Criptografia de Dados em Trânsito</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> Aplicativos Nativos Android</div>
          </div>
        </section>
      </main>

      {/* Rodapé */}
      <footer className="border-t border-border-secondary bg-background-primary py-8 text-xs text-text-secondary">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <p className="font-bold text-text-primary">LogisTrack Plataforma Logística</p>
            <p className="text-[11px] text-text-tertiary">Desenvolvido por Adson dos Santos Sousa • Todos os direitos reservados</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <Link to="/privacidade" className="hover:text-text-primary">Política de Privacidade</Link>
            <Link to="/termos" className="hover:text-text-primary">Termos de Uso</Link>
            <Link to="/login" className="text-info hover:underline">Área de Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default PaginaInstitucional;
