import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Package, RotateCcw, FileText, LogOut, UploadCloud, Camera, Truck } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';

export function Layout({ children }) {
  const { currentUser, logout } = useStore();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/', icon: Package, label: 'Entregas', roles: ['Motorista', 'Monitoramento'] },
    { path: '/frota', icon: Truck, label: 'Frota', roles: ['Operacao', 'Monitoramento'] },
    { path: '/devolucoes', icon: RotateCcw, label: 'Devoluções', roles: ['Operacao', 'Monitoramento'] },
    { path: '/relatorios', icon: Camera, label: 'Relatórios', roles: ['Monitoramento'] },
    { path: '/canhotos', icon: FileText, label: 'Canhotos', roles: ['Monitoramento'] },
    { path: '/importacao', icon: UploadCloud, label: 'Importar', roles: ['Monitoramento'] },
  ].filter(item => item.roles.includes(currentUser?.role));

  if (!currentUser) return <Navigate to="/login" />;

  return (
    <div className="flex flex-col min-h-screen bg-background-tertiary">
      {/* Topbar */}
      <header className="sticky top-0 z-10 glass-panel px-4 py-3 flex items-center justify-between shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="LogisTrack Logo" className="w-8 h-8 object-contain rounded-full bg-white p-0.5 shadow-sm" />
            <div>
              <h1 className="text-lg font-semibold text-text-primary leading-tight">LogisTrack</h1>
              <p className="text-[11px] text-text-secondary leading-tight">
                {currentUser.role} {currentUser.placa ? `- ${currentUser.placa}` : ''}
              </p>
            </div>
          </div>
        </div>
        <button 
          onClick={handleLogout}
          className="p-2 text-text-secondary hover:text-danger hover:bg-danger/10 rounded-full transition-colors"
        >
          <LogOut size={20} />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 pb-24">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full glass-panel border-t border-border-tertiary pb-safe">
        <div className="flex justify-around items-center px-2 py-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex flex-col items-center p-2 rounded-lg min-w-[64px] transition-colors",
                  isActive ? "text-info" : "text-text-secondary hover:text-text-primary hover:bg-background-secondary"
                )}
              >
                <Icon size={24} className={cn("mb-1", isActive ? "stroke-[2.5px]" : "stroke-2")} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
