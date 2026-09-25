import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { 
  Package, RotateCcw, FileText, LogOut, UploadCloud, 
  Truck, DollarSign, Gauge, Users, Layers, SlidersHorizontal, 
  MapPin, FileBarChart, Settings, X, ChevronRight
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';

export function Layout({ children }) {
  const { currentUser, logout, solicitacoesGeoloc } = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuConfigAberto, setMenuConfigAberto] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!currentUser) return <Navigate to="/login" />;

  const isMotorista = currentUser.role === 'Motorista';
  const pendenciasGeoloc = (solicitacoesGeoloc || []).filter(s => s.status === 'pendente').length;

  // Definição dos 3 Módulos Principais
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
        { path: '/clientes', label: 'Base de Clientes & GPS', icon: MapPin, roles: ['Monitoramento'] },
      ].filter(sub => sub.roles.includes(currentUser.role))
    }
  ].filter(m => m.roles.includes(currentUser.role));

  // Identifica o módulo ativo atual
  const activeModule = modules.find(m => m.paths.includes(location.pathname)) || (location.pathname === '/importacao' ? {
    id: 'importacao',
    label: 'Importação',
    subItems: [{ path: '/importacao', label: 'Importação de Cargas', icon: UploadCloud }]
  } : modules[0]);

  return (
    <div className="flex flex-col min-h-screen bg-background-tertiary">
      {/* Topbar Principal */}
      <header className="sticky top-0 z-30 bg-background-primary/95 backdrop-blur-md border-b border-border-secondary shadow-xs">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-2.5 relative flex items-center justify-between">
          
          {/* 1. LADO ESQUERDO: Nome e Logo sempre à esquerda */}
          <div className="flex items-center gap-3 shrink-0">
            <img 
              src="/logo.png" 
              alt="LogisTrack Logo" 
              className="w-8 h-8 sm:w-9 sm:h-9 object-contain rounded-full bg-white p-0.5 shadow-xs border border-border-secondary shrink-0" 
            />
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base sm:text-lg font-bold text-text-primary tracking-tight leading-none">
                  LogisTrack
                </h1>
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

          {/* 2. CENTRO: Seletores de modo SEMPRE centralizados (Desktop / Tablet) */}
          {!isMotorista && modules.length > 0 && (
            <div className="hidden md:flex items-center absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2">
              <nav className="flex items-center gap-1 bg-background-secondary/90 p-1 rounded-xl border border-border-secondary shadow-xs">
                {modules.map((mod) => {
                  const isModActive = activeModule?.id === mod.id;
                  const Icon = mod.icon;
                  
                  return (
                    <button
                      key={mod.id}
                      onClick={() => {
                        if (!mod.paths.includes(location.pathname)) {
                          navigate(mod.defaultPath);
                        }
                      }}
                      className={cn(
                        "relative flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer select-none",
                        isModActive 
                          ? "bg-info text-white shadow-xs" 
                          : "text-text-secondary hover:text-text-primary hover:bg-background-tertiary"
                      )}
                    >
                      <Icon size={15} className={cn(isModActive ? "stroke-[2.5px]" : "stroke-2")} />
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
            </div>
          )}

          {/* 3. LADO DIREITO: Opção de Importação junto com Sair (Ícone de engrenagem + popup) */}
          <div className="flex items-center gap-2 shrink-0">
            {!isMotorista && (
              <div className="relative">
                <button
                  onClick={() => setMenuConfigAberto(!menuConfigAberto)}
                  title="Configurações e Ferramentas"
                  className={cn(
                    "p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-background-secondary border border-border-secondary/60 transition-colors cursor-pointer flex items-center gap-1.5",
                    menuConfigAberto && "bg-background-secondary text-text-primary border-border-secondary"
                  )}
                >
                  <Settings size={18} className={cn(menuConfigAberto ? "rotate-45 transition-transform duration-200" : "")} />
                </button>

                {/* Dropdown Popup do Menu de Ferramentas / Configurações */}
                {menuConfigAberto && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setMenuConfigAberto(false)} 
                    />
                    <div className="absolute right-0 mt-2 w-64 z-50 bg-background-primary border border-border-secondary rounded-xl shadow-2xl p-2.5 animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-2.5 py-2 border-b border-border-tertiary mb-1">
                        <p className="text-xs font-bold text-text-primary">Ferramentas & Ações</p>
                        <p className="text-[11px] text-text-secondary">Acesso rápido administrativo</p>
                      </div>

                      <div className="space-y-1">
                        <button
                          onClick={() => {
                            navigate('/importacao');
                            setMenuConfigAberto(false);
                          }}
                          className={cn(
                            "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer",
                            location.pathname === '/importacao' 
                              ? "bg-info/15 text-info font-semibold" 
                              : "text-text-primary hover:bg-background-secondary"
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            <UploadCloud size={16} className="text-info" />
                            <span>Importação de Cargas</span>
                          </div>
                          <ChevronRight size={14} className="text-text-muted" />
                        </button>
                      </div>

                      <div className="border-t border-border-tertiary my-1.5" />

                      <button
                        onClick={() => {
                          setMenuConfigAberto(false);
                          handleLogout();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-danger hover:bg-danger/10 transition-colors text-left cursor-pointer"
                      >
                        <LogOut size={16} />
                        <span>Sair do Sistema</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Botão de Logout Rápido apenas para Motorista (não tem menu de engrenagem) */}
            {isMotorista && (
              <button 
                onClick={handleLogout}
                title="Sair do sistema"
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-text-secondary hover:text-danger hover:bg-danger/10 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">Sair</span>
              </button>
            )}
          </div>
        </div>

        {/* 4. SUB-NAVBAR: Seleção centralizada com estética de pasta de arquivo (sem ser colorido) */}
        {!isMotorista && activeModule && activeModule.subItems && activeModule.subItems.length > 0 && (
          <div className="bg-background-secondary/40 border-t border-border-secondary pt-2 px-4 sm:px-6 lg:px-8">
            <div className="w-full flex justify-center items-end overflow-x-auto scrollbar-none">
              <div className="flex items-end gap-1 sm:gap-2">
                {activeModule.subItems.map((sub) => {
                  const isSubActive = location.pathname === sub.path;
                  const SubIcon = sub.icon;

                  return (
                    <button
                      key={sub.path}
                      onClick={() => navigate(sub.path)}
                      className={cn(
                        "relative flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm rounded-t-lg transition-all cursor-pointer select-none",
                        // Estética de aba de pasta de arquivo (Folder Tab):
                        isSubActive 
                          ? "bg-background-tertiary text-text-primary font-bold border-t border-x border-border-secondary border-b-transparent shadow-xs -mb-[1px] z-10" 
                          : "bg-background-primary/40 hover:bg-background-secondary/80 text-text-secondary hover:text-text-primary font-medium border-t border-x border-transparent hover:border-border-secondary/40"
                      )}
                    >
                      <SubIcon 
                        size={15} 
                        className={cn(
                          isSubActive ? "text-text-primary stroke-[2.2px]" : "text-text-secondary stroke-2"
                        )} 
                      />
                      <span>{sub.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className={cn(
        "flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6",
        !isMotorista && "pb-24 md:pb-8"
      )}>
        <div className="w-full">
          {children}
        </div>
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


