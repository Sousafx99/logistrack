import { useStore } from '../store/useStore';
import { VisaoMotorista } from '../components/motorista/VisaoMotorista';
import { VisaoMonitoramento } from '../components/monitoramento/VisaoMonitoramento';

export function Entregas() {
  const { currentUser } = useStore();

  if (currentUser.role === 'Motorista') {
    return <VisaoMotorista />;
  }

  // Se for Monitoramento ou Operação
  return <VisaoMonitoramento />;
}
