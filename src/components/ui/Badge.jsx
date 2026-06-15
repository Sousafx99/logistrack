import { cn } from "../../lib/utils";

const statusColors = {
  'Pendente': 'bg-warning/20 text-warning border-warning/30',
  'No cliente': 'bg-info/20 text-info border-info/30',
  'Descarregando': 'bg-info/20 text-info border-info/30',
  'Entrega total': 'bg-success/20 text-success border-success/30',
  'Entrega parcial': 'bg-success/20 text-success border-success/30',
  'Devolução total': 'bg-danger/20 text-danger border-danger/30',
  'Carga parada': 'bg-danger/20 text-danger border-danger/30',
  'Reentrega': 'bg-warning/20 text-warning border-warning/30',
  'No estoque': 'bg-background-secondary text-text-secondary border-border-secondary',
};

export function Badge({ children, status, className }) {
  const colorClass = statusColors[status] || 'bg-background-secondary text-text-secondary border-border-secondary';
  
  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
      colorClass,
      className
    )}>
      {children}
    </span>
  );
}
