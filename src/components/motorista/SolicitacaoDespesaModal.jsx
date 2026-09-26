import { useState, useEffect } from 'react';
import { X, DollarSign, Send, CreditCard, Package, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';

const TIPOS_DESPESA = [
  'Descarregamento',
  'Pedágio',
  'Balsa',
  'Ajudante extra',
  'Impressão',
  'Pernoite',
  'Outro'
];

export function SolicitacaoDespesaModal({ isOpen, onClose, onConfirm, entregasDisponiveis = [], motoristaAtual = null }) {
  const [tipo, setTipo] = useState(TIPOS_DESPESA[0]);
  const [valor, setValor] = useState('');
  const [nomeRecebedor, setNomeRecebedor] = useState('');
  const [chavePix, setChavePix] = useState('');
  const [observacao, setObservacao] = useState('');
  const [notasSelecionadas, setNotasSelecionadas] = useState([]);

  // Puxa e preenche automaticamente o PIX e o Nome do Motorista quando o modal abrir
  useEffect(() => {
    if (isOpen) {
      const pixPerfil = motoristaAtual?.chavePix || motoristaAtual?.chave_pix || motoristaAtual?.pix || '';
      const nomePerfil = motoristaAtual?.nome || '';
      
      setChavePix(pixPerfil);
      setNomeRecebedor(nomePerfil);
    }
  }, [isOpen, motoristaAtual]);

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
      observacao,
      notas_vinculadas: notasSelecionadas
    });
    
    // Reset
    setTipo(TIPOS_DESPESA[0]);
    setValor('');
    setObservacao('');
    setNotasSelecionadas([]);
  };

  const toggleNota = (notaId) => {
    setNotasSelecionadas(prev => 
      prev.includes(notaId) ? prev.filter(id => id !== notaId) : [...prev, notaId]
    );
  };

  const pixDoPerfil = motoristaAtual?.chavePix || motoristaAtual?.chave_pix || motoristaAtual?.pix || '';
  const isPixDoPerfil = Boolean(pixDoPerfil && chavePix.trim() === pixDoPerfil.trim());

  return (
    <div className="fixed inset-0 z-50 bg-background-primary/80 backdrop-blur-sm flex items-end justify-center sm:items-center p-0 sm:p-4">
      <div className="bg-background-secondary w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl border border-border-secondary p-4 animate-in slide-in-from-bottom-10 h-[88vh] sm:h-auto overflow-y-auto custom-scrollbar">
        
        <div className="flex justify-between items-center mb-4 sticky top-0 bg-background-secondary pt-2 pb-2 z-10 border-b border-border-tertiary">
          <h2 className="text-lg font-bold text-text-primary flex items-center">
            <DollarSign className="mr-2 text-info" />
            Solicitar Reembolso
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-text-tertiary hover:text-text-primary hover:bg-background-primary rounded-full transition-colors cursor-pointer"
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
              className="w-full bg-background-primary border border-border-secondary rounded-xl px-4 py-3 text-sm text-text-primary focus:ring-2 focus:ring-info outline-none font-medium"
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

          <div className="bg-info/10 border border-info/20 rounded-xl p-3.5 mb-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-info uppercase flex items-center">
                <CreditCard size={14} className="mr-1.5" /> Dados para Pagamento PIX
              </h3>
              {isPixDoPerfil && (
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1 animate-in fade-in">
                  <Sparkles size={10} /> PIX do seu Perfil
                </span>
              )}
            </div>
            
            <div className="space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] font-bold text-text-secondary uppercase">Nome do Recebedor</label>
                  {motoristaAtual?.nome && nomeRecebedor !== motoristaAtual.nome && (
                    <button
                      type="button"
                      onClick={() => setNomeRecebedor(motoristaAtual.nome)}
                      className="text-[10px] font-semibold text-info hover:underline cursor-pointer"
                    >
                      Usar meu nome
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Ex: Carlos da Silva / Balsa de Santos..."
                  value={nomeRecebedor}
                  onChange={(e) => setNomeRecebedor(e.target.value)}
                  className="w-full bg-background-primary border border-border-secondary rounded-lg px-3 py-2 text-sm text-text-primary focus:ring-2 focus:ring-info outline-none font-medium"
                  required
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] font-bold text-text-secondary uppercase">Chave PIX</label>
                  {pixDoPerfil && !isPixDoPerfil && (
                    <button
                      type="button"
                      onClick={() => setChavePix(pixDoPerfil)}
                      className="text-[10px] font-bold text-info hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Sparkles size={10} /> Restaurar meu PIX
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Ex: CPF, Telefone, Email ou Chave Aleatória..."
                  value={chavePix}
                  onChange={(e) => setChavePix(e.target.value)}
                  className="w-full bg-background-primary border border-border-secondary rounded-lg px-3 py-2 text-sm text-text-primary focus:ring-2 focus:ring-info outline-none font-mono"
                  required
                />
                {!pixDoPerfil && (
                  <p className="text-[10px] text-text-tertiary mt-1.5 leading-tight">
                    💡 Cadastre sua chave PIX no menu <strong>Perfil</strong> para preenchimento automático.
                  </p>
                )}
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

          {entregasDisponiveis && entregasDisponiveis.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Vincular a Notas Fiscais (Opcional)</label>
              <div className="bg-background-primary border border-border-secondary rounded-xl max-h-40 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {entregasDisponiveis.map(entrega => (
                  <label key={entrega.id} className="flex items-center gap-3 p-2 hover:bg-background-secondary rounded-lg cursor-pointer transition-colors border border-transparent hover:border-border-tertiary">
                    <input 
                      type="checkbox"
                      checked={notasSelecionadas.includes(entrega.nota)}
                      onChange={() => toggleNota(entrega.nota)}
                      className="w-4 h-4 rounded text-info focus:ring-info border-border-tertiary bg-background-primary"
                    />
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-text-primary flex items-center">
                          <Package size={14} className="mr-1.5 opacity-70" /> NF: {entrega.nota}
                        </span>
                        <span className="text-xs font-medium text-text-tertiary">{entrega.cliente?.substring(0, 15)}...</span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-info hover:bg-info/90 text-white font-bold py-4 rounded-xl shadow-lg shadow-info/20 flex justify-center items-center active:scale-[0.98] transition-all cursor-pointer"
          >
            <Send className="mr-2" size={20} />
            Enviar Solicitação
          </button>
        </form>

      </div>
    </div>
  );
}
