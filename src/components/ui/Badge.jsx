import { cn } from "../../lib/utils";

const statusColors = {
  'Pendente': 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  'No cliente': 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  'Descarregando': 'bg-blue-600/20 text-blue-400 border-blue-600/40 font-bold',
  'Entrega total': 'bg-success/15 text-success border-success/30',
  'Entrega parcial': 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  'Devolução total': 'bg-danger/15 text-danger border-danger/30',
  'Devolução': 'bg-danger/15 text-danger border-danger/30',
  'Carga parada': 'bg-yellow-400/15 text-yellow-400 border-yellow-400/30',
  'Reentrega': 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  'No estoque': 'bg-background-secondary text-text-secondary border-border-secondary',
  'Retornando': 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'Finalizado': 'bg-success/15 text-success border-success/30',
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
