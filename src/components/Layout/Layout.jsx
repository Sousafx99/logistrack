import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { 
  Package, RotateCcw, FileText, LogOut, UploadCloud, 
  Truck, DollarSign, Gauge, Users, Layers, SlidersHorizontal, 
  MapPin, FileBarChart, Bell
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';

export function Layout({ children }) {
  const { currentUser, logout, solicitacoesGeoloc } = useStore();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!currentUser) return <Navigate to="/login" />;

  const isMotorista = currentUser.role === 'Motorista';
  const pendenciasGeoloc = (solicitacoesGeoloc || []).filter(s => s.status === 'pendente').length;

  // Definição dos Módulos Principais e suas Sub-abas
  const modules = [
    {
      id: 'monitoramento',
      label: 'Monitoramento',
      icon: Layers,
      defaultPath: currentUser.role === 'Operacao' ? '/devolucoes' : '/',
      paths: ['/', '/relatorios', '/devolucoes', '/frota'],
      roles: ['Monitoramento', 'Operacao'],
      subItems: [
        { path: '/', label: 'Entregas', icon: Package, roles: ['Monitoramento'] },
        { path: '/relatorios', label: 'Relatórios', icon: FileBarChart, roles: ['Monitoramento'] },
        { path: '/devolucoes', label: 'Devoluções', icon: RotateCcw, roles: ['Monitoramento', 'Operacao'] },
        { path: '/frota', label: 'Frota', icon: Truck, roles: ['Monitoramento', 'Operacao'] },
      ].filter(sub => sub.roles.includes(currentUser.role))
    },
    {
      id: 'controles',
      label: 'Controles',
      icon: SlidersHorizontal,
      defaultPath: '/custos',
      paths: ['/custos', '/km', '/canhotos'],
      roles: ['Monitoramento'],
      subItems: [
        { path: '/custos', label: 'Custos', icon: DollarSign, roles: ['Monitoramento'] },
        { path: '/km', label: 'KM', icon: Gauge, roles: ['Monitoramento'] },
        { path: '/canhotos', label: 'Canhotos', icon: FileText, roles: ['Monitoramento'] },
      ].filter(sub => sub.roles.includes(currentUser.role))
    },
    {
      id: 'clientes',
      label: 'Clientes',
      icon: Users,
      defaultPath: '/clientes',
      paths: ['/clientes'],
      roles: ['Monitoramento'],
      badge: pendenciasGeoloc,
      subItems: [
        { path: '/clientes', label: 'Clientes & Localizações', icon: MapPin, roles: ['Monitoramento'] },
      ].filter(sub => sub.roles.includes(currentUser.role))
    },
    {
      id: 'importacao',
      label: 'Importar',
      icon: UploadCloud,
      defaultPath: '/importacao',
      paths: ['/importacao'],
      roles: ['Monitoramento'],
      isAction: true,
      subItems: [
        { path: '/importacao', label: 'Importação de Planilha', icon: UploadCloud, roles: ['Monitoramento'] },
      ].filter(sub => sub.roles.includes(currentUser.role))
    }
  ].filter(m => m.roles.includes(currentUser.role));

  // Identifica o módulo ativo atual
  const activeModule = modules.find(m => m.paths.includes(location.pathname)) || modules[0];

  return (
    <div className="flex flex-col min-h-screen bg-background-tertiary">
      {/* Topbar Principal */}
      <header className="sticky top-0 z-30 bg-background-primary/95 backdrop-blur-md border-b border-border-secondary shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2">
          
          {/* Logo e Info de Usuário */}
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="LogisTrack Logo" className="w-8 h-8 sm:w-9 sm:h-9 object-contain rounded-full bg-white p-0.5 shadow-xs border border-border-secondary shrink-0" />
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base sm:text-lg font-bold text-text-primary tracking-tight leading-none">LogisTrack</h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-info/10 text-info border border-info/20 leading-none">
                  {currentUser.role}
                </span>
              </div>
              {currentUser.placa && (
                <p className="text-[11px] text-text-secondary font-mono font-medium leading-none mt-1">
                  {currentUser.placa}
                </p>
              )}
            </div>
          </div>

          {/* Seletor de Módulos (Desktop / Tablet) */}
          {!isMotorista && modules.length > 0 && (
            <nav className="hidden md:flex items-center gap-1.5 bg-background-secondary/80 p-1 rounded-xl border border-border-secondary">
              {modules.map((mod) => {
                const isModActive = activeModule?.id === mod.id;
                const Icon = mod.icon;
                
                return (
                  <button
                    key={mod.id}
                    onClick={() => {
                      // Se já está no módulo, vai para a defaultPath se não estiver em nenhuma sub-rota válida
                      if (!mod.paths.includes(location.pathname)) {
                        navigate(mod.defaultPath);
                      }
                    }}
                    className={cn(
                      "relative flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer",
                      isModActive 
                        ? "bg-info text-white shadow-xs" 
                        : "text-text-secondary hover:text-text-primary hover:bg-background-tertiary"
                    )}
                  >
                    <Icon size={16} className={cn(isModActive ? "stroke-[2.5px]" : "stroke-2")} />
                    <span>{mod.label}</span>
                    {mod.badge > 0 && (
                      <span className={cn(
                        "ml-0.5 px-1.5 py-0.2 text-[10px] font-bold rounded-full",
                        isModActive ? "bg-white text-info" : "bg-danger text-white animate-pulse"
                      )}>
                        {mod.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          )}

          {/* Ações / Logout */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button 
              onClick={handleLogout}
              title="Sair do sistema"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-text-secondary hover:text-danger hover:bg-danger/10 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>

        {/* Sub-Navbar Contextual (Exibe as sub-abas do módulo ativo) */}
        {!isMotorista && activeModule && activeModule.subItems && activeModule.subItems.length > 1 && (
          <div className="bg-background-secondary/60 border-t border-border-tertiary px-3 sm:px-6 py-1.5">
            <div className="max-w-7xl mx-auto flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted mr-1 hidden sm:inline">
                {activeModule.label}:
              </span>
              {activeModule.subItems.map((sub) => {
                const isSubActive = location.pathname === sub.path;
                const SubIcon = sub.icon;

                return (
                  <button
                    key={sub.path}
                    onClick={() => navigate(sub.path)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all cursor-pointer",
                      isSubActive 
                        ? "bg-background-primary text-info font-semibold shadow-xs border border-border-secondary" 
                        : "text-text-secondary hover:text-text-primary hover:bg-background-primary/50"
                    )}
                  >
                    <SubIcon size={14} className={cn(isSubActive ? "text-info stroke-[2.5px]" : "stroke-2")} />
                    <span>{sub.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className={cn(
        "flex-1 overflow-y-auto p-3 sm:p-5",
        !isMotorista && "pb-24 md:pb-8"
      )}>
        {children}
      </main>

      {/* Bottom Navigation Mobile (Para Monitoramento e Operação) */}
      {!isMotorista && (
        <nav className="md:hidden fixed bottom-0 w-full bg-background-primary/95 backdrop-blur-md border-t border-border-secondary pb-safe z-30 shadow-lg">
          <div className="flex justify-around items-center px-1 py-1.5">
            {modules.map((mod) => {
              const isModActive = activeModule?.id === mod.id;
              const Icon = mod.icon;
              
              return (
                <button
                  key={mod.id}
                  onClick={() => navigate(mod.defaultPath)}
                  className={cn(
                    "relative flex flex-col items-center p-1.5 rounded-lg min-w-[56px] transition-colors cursor-pointer",
                    isModActive ? "text-info font-semibold" : "text-text-secondary hover:text-text-primary"
                  )}
                >
                  <div className="relative">
                    <Icon size={20} className={cn("mb-0.5", isModActive ? "stroke-[2.5px]" : "stroke-2")} />
                    {mod.badge > 0 && (
                      <span className="absolute -top-1 -right-2 w-4 h-4 bg-danger text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                        {mod.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] tracking-tight">{mod.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

