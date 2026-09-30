import { cn } from "../../lib/utils";

const statusColors = {
  'Pendente': 'bg-amber-500/10 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40 font-bold',
  'Autorizado': 'bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/40 font-bold',
  'Aprovado': 'bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/40 font-bold',
  'Pago': 'bg-teal-500/10 dark:bg-teal-500/20 text-teal-800 dark:text-teal-300 border-teal-500/40 font-bold',
  'Rejeitado': 'bg-rose-500/10 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/40 font-bold',
  'No cliente': 'bg-sky-500/10 dark:bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-500/40 font-bold',
  'Descarregando': 'bg-blue-600/10 dark:bg-blue-600/20 text-blue-800 dark:text-blue-300 border-blue-600/40 font-bold',
  'Entrega total': 'bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/40 font-bold',
  'Entrega parcial': 'bg-orange-500/10 dark:bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-500/40 font-bold',
  'Devolução total': 'bg-rose-500/10 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/40 font-bold',
  'Devolução': 'bg-rose-500/10 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/40 font-bold',
  'Carga parada': 'bg-amber-500/15 dark:bg-yellow-400/15 text-amber-900 dark:text-yellow-300 border-amber-500/40 dark:border-yellow-400/40 font-bold',
  'Reentrega': 'bg-purple-500/10 dark:bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-500/40 font-bold',
  'No estoque': 'bg-background-secondary text-text-primary border-border-secondary font-bold',
  'Retornando': 'bg-blue-500/10 dark:bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-500/40 font-bold',
  'Finalizado': 'bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/40 font-bold',
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
