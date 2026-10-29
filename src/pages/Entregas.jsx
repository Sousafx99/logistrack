import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { VisaoMotorista } from '../components/motorista/VisaoMotorista';

const IS_MOTORISTA_BUILD = import.meta.env.VITE_APP_FLAVOR === 'motorista';

const VisaoMonitoramento = IS_MOTORISTA_BUILD
  ? null
  : lazy(() =>
      import('../components/monitoramento/VisaoMonitoramento').then((m) => ({
        default: m.VisaoMonitoramento
      }))
    );

export function Entregas() {
  const currentUser = useStore((state) => state.currentUser);

  if (IS_MOTORISTA_BUILD || currentUser?.role === 'Motorista') {
    return <VisaoMotorista />;
  }

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20 text-text-secondary">
          <Loader2 className="w-6 h-6 animate-spin mr-2 text-info" />
          <span className="text-sm font-medium">Carregando painel...</span>
        </div>
      }
    >
      {VisaoMonitoramento ? <VisaoMonitoramento /> : null}
    </Suspense>
  );
}
