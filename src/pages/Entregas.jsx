import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';

const VisaoMotorista = lazy(() =>
  import('../components/motorista/VisaoMotorista').then(m => ({ default: m.VisaoMotorista }))
);
const VisaoMonitoramento = lazy(() =>
  import('../components/monitoramento/VisaoMonitoramento').then(m => ({ default: m.VisaoMonitoramento }))
);

export function Entregas() {
  const { currentUser } = useStore();

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20 text-text-secondary">
          <Loader2 className="w-6 h-6 animate-spin mr-2 text-info" />
          <span className="text-sm font-medium">Carregando módulo...</span>
        </div>
      }
    >
      {currentUser?.role === 'Motorista' ? <VisaoMotorista /> : <VisaoMonitoramento />}
    </Suspense>
  );
}
