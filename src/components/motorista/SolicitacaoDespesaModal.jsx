import { useState } from 'react';
import { X, DollarSign, Send, CreditCard } from 'lucide-react';

const TIPOS_DESPESA = [
  'Descarregamento',
  'Pedágio',
  'Balsa',
  'Ajudante extra',
  'Impressão',
  'Outro'
];

export function SolicitacaoDespesaModal({ isOpen, onClose, onConfirm }) {
  const [tipo, setTipo] = useState(TIPOS_DESPESA[0]);
  const [valor, setValor] = useState('');
  const [nomeRecebedor, setNomeRecebedor] = useState('');
  const [chavePix, setChavePix] = useState('');
  const [observacao, setObservacao] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!valor || !nomeRecebedor || !chavePix) {
      alert('Por favor, preencha os campos obrigatórios (Valor, Recebedor, Chave PIX).');
      return;
    }

    const numValor = parseFloat(valor.replace(',', '.'));
    if (isNaN(numValor) || numValor <= 0) {
      alert('Por favor, informe um valor válido.');
      return;
    }

    onConfirm({
      tipo,
      valor: numValor,
      nome_recebedor: nomeRecebedor,
      chave_pix: chavePix,
      observacao
    });
    
    // Reset
    setTipo(TIPOS_DESPESA[0]);
    setValor('');
    setNomeRecebedor('');
    setChavePix('');
    setObservacao('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-background-primary/80 backdrop-blur-sm flex items-end justify-center sm:items-center">
      <div className="bg-background-secondary w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl border border-border-secondary p-4 animate-in slide-in-from-bottom-10 h-[85vh] sm:h-auto overflow-y-auto">
        
        <div className="flex justify-between items-center mb-4 sticky top-0 bg-background-secondary pt-2 pb-2 z-10 border-b border-border-tertiary">
          <h2 className="text-lg font-bold text-text-primary flex items-center">
            <DollarSign className="mr-2 text-info" />
            Solicitar Reembolso
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-text-tertiary hover:text-text-primary hover:bg-background-primary rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Tipo de Despesa</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full bg-background-primary border border-border-secondary rounded-xl px-4 py-3 text-sm text-text-primary focus:ring-2 focus:ring-info outline-none"
            >
              {TIPOS_DESPESA.map(t => (
                <option key={t} value={t} className="bg-slate-900 text-white">{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Valor (R$)</label>
            <div className="relative">
              <span className="absolute left-4 top-3 text-text-tertiary font-bold">R$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="w-full bg-background-primary border border-border-secondary rounded-xl pl-12 pr-4 py-3 text-sm text-text-primary focus:ring-2 focus:ring-info outline-none font-bold"
                required
              />
            </div>
          </div>

          <div className="bg-info/10 border border-info/20 rounded-xl p-3 mb-2">
            <h3 className="text-xs font-bold text-info uppercase mb-2 flex items-center"><CreditCard size={14} className="mr-1" /> Dados para Pagamento</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Nome do Recebedor</label>
                <input
                  type="text"
                  placeholder="Ex: João da Silva / Nome da Balsa"
                  value={nomeRecebedor}
                  onChange={(e) => setNomeRecebedor(e.target.value)}
                  className="w-full bg-background-primary border border-border-secondary rounded-lg px-3 py-2 text-sm text-text-primary focus:ring-2 focus:ring-info outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Chave PIX</label>
                <input
                  type="text"
                  placeholder="Ex: CPF, Telefone, Email..."
                  value={chavePix}
                  onChange={(e) => setChavePix(e.target.value)}
                  className="w-full bg-background-primary border border-border-secondary rounded-lg px-3 py-2 text-sm text-text-primary focus:ring-2 focus:ring-info outline-none font-medium"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Observações / NF Relacionada</label>
            <textarea
              placeholder="Ex: Pagamento referente a descarga da nota 123..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="w-full bg-background-primary border border-border-secondary rounded-xl px-4 py-3 text-sm text-text-primary focus:ring-2 focus:ring-info outline-none resize-none h-20"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-info hover:bg-info/90 text-white font-bold py-4 rounded-xl shadow-lg shadow-info/20 flex justify-center items-center active:scale-[0.98] transition-all"
          >
            <Send className="mr-2" size={20} />
            Enviar Solicitação
          </button>
        </form>

      </div>
    </div>
  );
}
