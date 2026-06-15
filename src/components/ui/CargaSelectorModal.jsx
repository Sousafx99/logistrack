import { useState, useMemo } from 'react';
import { format, parseISO, getDate, getMonth, getYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Folder, FolderOpen, Calendar, X, ChevronRight, ChevronDown, Package } from 'lucide-react';
import { cn } from '../../lib/utils';

// Helper recursivo para renderizar pastas
const Node = ({ name, children, onSelect, depth = 0 }) => {
  const [isOpen, setIsOpen] = useState(depth === 0); // Abre o ano por padrão
  const isLeaf = Array.isArray(children);

  if (isLeaf) {
    return (
      <div className="flex flex-col space-y-1 mt-1">
        {children.map((item, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(`${item.data}|${item.carga}`)}
            className="flex items-center text-left py-3 px-4 ml-4 bg-background-secondary rounded-xl active:bg-background-tertiary transition-colors border border-border-tertiary"
          >
            <Calendar size={16} className="text-info mr-3 flex-shrink-0" />
            <div className="flex-1">
              <span className="block text-sm font-bold text-text-primary">
                {format(parseISO(item.data), "dd 'de' MMMM", { locale: ptBR })}
              </span>
              <span className="flex items-center text-xs text-text-tertiary mt-0.5">
                <Package size={12} className="mr-1" /> Carga: {item.carga}
              </span>
            </div>
            <ChevronRight size={16} className="text-text-tertiary" />
          </button>
        ))}
      </div>
    );
  }

  // É uma pasta
  return (
    <div className="mt-2">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center w-full py-3 px-2 rounded-lg hover:bg-background-secondary transition-colors"
      >
        {isOpen ? (
          <FolderOpen size={18} className="text-info mr-3" />
        ) : (
          <Folder size={18} className="text-text-secondary mr-3" />
        )}
        <span className="flex-1 text-left font-semibold text-text-primary text-sm">{name}</span>
        {isOpen ? <ChevronDown size={16} className="text-text-tertiary" /> : <ChevronRight size={16} className="text-text-tertiary" />}
      </button>
      
      {isOpen && (
        <div className="ml-4 pl-2 border-l border-border-tertiary flex flex-col gap-1">
          {Object.entries(children).map(([key, value]) => (
            <Node key={key} name={key} children={value} onSelect={onSelect} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export function CargaSelectorModal({ isOpen, onClose, onSelect, cargasDisponiveis }) {
  const tree = useMemo(() => {
    const root = {};
    
    cargasDisponiveis.forEach(c => {
      const date = parseISO(c.data);
      const year = getYear(date).toString();
      const month = format(date, 'MMMM', { locale: ptBR });
      const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1);
      
      const day = getDate(date);
      const quinzena = day <= 15 ? '1ª Quinzena' : '2ª Quinzena';

      if (!root[year]) root[year] = {};
      if (!root[year][capitalizedMonth]) root[year][capitalizedMonth] = {};
      if (!root[year][capitalizedMonth][quinzena]) root[year][capitalizedMonth][quinzena] = [];
      
      root[year][capitalizedMonth][quinzena].push(c);
    });

    return root;
  }, [cargasDisponiveis]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background-primary/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex-1" onClick={onClose} />
      <div className="bg-background-primary border-t border-border-secondary rounded-t-3xl shadow-2xl flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-full duration-300">
        
        <div className="flex justify-between items-center p-5 border-b border-border-secondary">
          <div>
            <h2 className="text-lg font-bold text-text-primary leading-tight">Selecionar Carga</h2>
            <p className="text-xs text-text-secondary mt-0.5">Navegue pelas datas</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-background-secondary rounded-full text-text-secondary active:scale-95 transition-transform"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 hide-scrollbar">
          {Object.keys(tree).length === 0 ? (
            <div className="text-center py-10 text-text-tertiary">
              <Calendar className="mx-auto mb-2 opacity-20" size={32} />
              <p className="text-sm">Nenhuma carga disponível</p>
            </div>
          ) : (
            Object.entries(tree).map(([year, months]) => (
              <Node key={year} name={year} children={months} onSelect={onSelect} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
