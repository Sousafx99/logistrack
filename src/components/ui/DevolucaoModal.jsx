import { useState, useEffect } from 'react';
import { X, Package, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { MOTIVOS_DEVOLUCAO } from '../../data/mockData';

export function DevolucaoModal({ isOpen, onClose, onConfirm, entrega, tipo }) {
  const [itensDevolvidos, setItensDevolvidos] = useState([]);
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    if (isOpen && entrega && entrega.itens) {
      if (tipo === 'Total') {
        // Preenche com todos os itens na quantidade e peso originais
        setItensDevolvidos(
          entrega.itens.map(item => ({
            codigo: item.codigo,
            descricao: item.descricao,
            qtd: item.qtd,
            peso: item.peso,
            maxQtd: item.qtd,
            maxPeso: item.peso
          }))
        );
      } else {
        // Preenche com zerado para devolução parcial
        setItensDevolvidos(
          entrega.itens.map(item => ({
            codigo: item.codigo,
            descricao: item.descricao,
            qtd: '',
            peso: '',
            maxQtd: item.qtd,
            maxPeso: item.peso
          }))
        );
      }
    }
  }, [isOpen, entrega, tipo]);

  if (!isOpen || !entrega) return null;

  const handleItemChange = (codigo, field, value) => {
    setItensDevolvidos(prev => prev.map(item => {
      if (item.codigo === codigo) {
        let finalValue = value;
        const numericValue = value === '' ? '' : Number(value);
        
        if (numericValue !== '') {
          if (field === 'qtd' && numericValue > item.maxQtd) {
            finalValue = String(item.maxQtd);
          } else if (field === 'peso' && numericValue > item.maxPeso) {
            finalValue = String(item.maxPeso);
          }
        }
        
        return { ...item, [field]: finalValue };
      }
      return item;
    }));
  };

  const isTotal = tipo === 'Total';
  
  // Na devolução parcial, precisamos garantir que ao menos 1 item tenha qtd > 0 ou peso > 0
  const canSubmit = (isTotal || itensDevolvidos.some(i => Number(i.qtd) > 0 || Number(i.peso) > 0)) && motivo !== '';

  const handleSubmit = () => {
    
    // Filtrar apenas itens que realmente tiveram devolução na parcial
    const itensReais = isTotal 
      ? itensDevolvidos 
      : itensDevolvidos.filter(i => Number(i.qtd) > 0 || Number(i.peso) > 0).map(i => ({
          ...i,
          qtd: Number(i.qtd) || 0,
          peso: Number(i.peso) || 0
        }));

    onConfirm(tipo, itensReais, motivo);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background-primary/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-background-primary border border-border-secondary rounded-2xl shadow-2xl flex flex-col w-full max-w-md max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        <div className="flex justify-between items-center p-4 border-b border-border-secondary bg-background-secondary rounded-t-2xl">
          <div className="flex items-center space-x-2">
            <AlertCircle className={isTotal ? "text-danger" : "text-warning"} size={20} />
            <h2 className="text-lg font-bold text-text-primary">
              {isTotal ? 'Devolução Total' : 'Entrega Parcial'}
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-background-primary rounded-full text-text-secondary active:scale-95 transition-transform"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 hide-scrollbar space-y-4">
          <div className="bg-info/10 border border-info/20 rounded-xl p-3">
            <p className="text-sm font-semibold text-info">NF: {entrega.nota}</p>
            <p className="text-xs text-text-secondary mt-1">{entrega.cliente}</p>
          </div>

          <div>
            <h3 className="text-sm font-bold text-text-primary mb-3 flex items-center">
              <Package size={16} className="mr-2" />
              {isTotal ? 'Itens Sendo Devolvidos' : 'Informe o que está sendo devolvido:'}
            </h3>
            
            <div className="space-y-3">
              {itensDevolvidos.map(item => (
                <div key={item.codigo} className="bg-background-secondary border border-border-tertiary rounded-xl p-3">
                  <div className="mb-2">
                    <span className="font-semibold text-sm text-text-primary block leading-tight">{item.descricao}</span>
                    <span className="text-xs text-text-tertiary">Cód: {item.codigo} | Total NFE: {item.maxQtd} cx ({item.maxPeso.toFixed(3)}kg)</span>
                  </div>
                  
                  {isTotal ? (
                    <div className="flex justify-between text-sm font-bold text-danger bg-danger/10 px-3 py-1.5 rounded-lg">
                      <span>Voltou: {item.qtd} cx</span>
                      <span>{item.peso.toFixed(3)} kg</span>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] uppercase font-bold text-text-tertiary block mb-1">Qtd (cx)</label>
                        <input 
                          type="number" 
                          min="0"
                          max={item.maxQtd}
                          value={item.qtd}
                          onChange={(e) => handleItemChange(item.codigo, 'qtd', e.target.value)}
                          className="w-full bg-background-primary border border-border-secondary rounded-lg px-3 py-2 text-sm text-text-primary focus:ring-warning"
                          placeholder="0"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] uppercase font-bold text-text-tertiary block mb-1">Peso (kg)</label>
                        <input 
                          type="number" 
                          step="0.001"
                          min="0"
                          max={item.maxPeso}
                          value={item.peso}
                          onChange={(e) => handleItemChange(item.codigo, 'peso', e.target.value)}
                          className="w-full bg-background-primary border border-border-secondary rounded-lg px-3 py-2 text-sm text-text-primary focus:ring-warning"
                          placeholder="0.000"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {itensDevolvidos.length === 0 && (
                <p className="text-xs text-text-tertiary text-center">Nenhum item encontrado nesta nota.</p>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-text-primary mb-2 flex items-center">
              Motivo da Devolução
            </h3>
            <select 
              value={motivo} 
              onChange={e => setMotivo(e.target.value)} 
              className="w-full bg-background-secondary border border-border-secondary rounded-xl p-3 text-sm focus:ring-warning text-text-primary"
            >
              <option value="" disabled>Selecione um motivo...</option>
              {MOTIVOS_DEVOLUCAO.map(m => (
                <option key={m} value={m} className="bg-slate-900 text-white">
                  {m}
                </option>
              ))}
            </select>
          </div>

        </div>

        <div className="p-4 border-t border-border-secondary bg-background-secondary rounded-b-2xl flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-3 bg-background-primary text-text-secondary rounded-xl font-bold text-sm border border-border-tertiary active:scale-95 transition-transform"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
              "flex-1 py-3 rounded-xl font-bold text-sm flex justify-center items-center active:scale-95 transition-transform text-white",
              isTotal ? "bg-danger hover:bg-danger/90" : "bg-warning hover:bg-warning/90",
              !canSubmit && "opacity-50 pointer-events-none"
            )}
          >
            <CheckCircle size={18} className="mr-2" />
            Confirmar
          </button>
        </div>

      </div>
    </div>
  );
}
