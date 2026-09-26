import { useState, useEffect } from 'react';
import { X, DollarSign, Send, CreditCard, Package, Sparkles, Tag, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

const TIPOS_DESPESA = [
  'Descarga',
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

    const numValor = parseFloat(String(valor).replace(',', '.'));
    if (isNaN(numValor) || numValor <= 0) {
      alert('Por favor, informe um valor válido.');
      return;
    }

    const notasDetalhes = notasSelecionadas.map(nota => {
      const ent = (entregasDisponiveis || []).find(e => String(e.nota) === String(nota));
      return {
        nota,
        cliente: ent?.cliente || ''
      };
    });

    onConfirm({
      tipo,
      valor: numValor,
      nome_recebedor: nomeRecebedor,
      chave_pix: chavePix,
      observacao,
      notas_vinculadas: notasSelecionadas,
      notas_detalhes: notasDetalhes
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
    <div className="fixed inset-0 z-50 bg-background-primary/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-background-secondary w-full max-w-lg rounded-2xl shadow-2xl border border-border-secondary flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Cabeçalho Fixo */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-tertiary bg-background-secondary/95 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-info/10 text-info border border-info/20">
              <DollarSign size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary leading-tight">
                Solicitar Reembolso
              </h2>
              <p className="text-[11px] text-text-tertiary">
                Envie o comprovante/dados da despesa para conferência
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-background-primary rounded-xl transition-colors cursor-pointer"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corpo com Scroll Suave */}
        <form id="form-solicitacao-despesa" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
          
          {/* Linha 1: Tipo de Despesa + Valor (lado a lado no desktop e telas médias) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-text-secondary uppercase mb-1 flex items-center gap-1">
                <Tag size={12} className="text-info" /> Tipo de Despesa <span className="text-rose-500">*</span>
              </label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="w-full bg-background-primary border border-border-secondary rounded-xl px-3 py-2 text-xs font-semibold text-text-primary focus:ring-2 focus:ring-info outline-none shadow-2xs cursor-pointer"
              >
                {TIPOS_DESPESA.map(t => (
                  <option key={t} value={t} className="bg-slate-900 text-white">{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-text-secondary uppercase mb-1 flex items-center gap-1">
                <DollarSign size={12} className="text-success" /> Valor Solicitado <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs text-text-tertiary font-bold font-mono">R$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0,00"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  className="w-full bg-background-primary border border-border-secondary rounded-xl pl-9 pr-3 py-2 text-xs font-black font-mono text-text-primary focus:ring-2 focus:ring-info outline-none shadow-2xs placeholder:text-text-tertiary/50"
                  required
                />
              </div>
            </div>
          </div>

          {/* Card Destacado: Dados para Pagamento PIX */}
          <div className="bg-background-primary/70 border border-border-secondary rounded-xl p-3.5 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-info uppercase flex items-center gap-1.5">
                <CreditCard size={14} /> Dados para Pagamento PIX
              </h3>
              {isPixDoPerfil && (
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                  <Sparkles size={10} /> PIX do Perfil
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] font-bold text-text-secondary uppercase">
                    Nome do Recebedor <span className="text-rose-500">*</span>
                  </label>
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
                  placeholder="Ex: Carlos da Silva / Balsa"
                  value={nomeRecebedor}
                  onChange={(e) => setNomeRecebedor(e.target.value)}
                  className="w-full bg-background-secondary border border-border-secondary rounded-lg px-3 py-1.5 text-xs text-text-primary focus:ring-2 focus:ring-info outline-none font-medium shadow-2xs"
                  required
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] font-bold text-text-secondary uppercase">
                    Chave PIX <span className="text-rose-500">*</span>
                  </label>
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
                  placeholder="CPF, Telefone, Email ou Aleatória"
                  value={chavePix}
                  onChange={(e) => setChavePix(e.target.value)}
                  className="w-full bg-background-secondary border border-border-secondary rounded-lg px-3 py-1.5 text-xs text-text-primary focus:ring-2 focus:ring-info outline-none font-mono shadow-2xs"
                  required
                />
              </div>
            </div>

            {!pixDoPerfil && (
              <p className="text-[10px] text-text-tertiary leading-tight pt-0.5">
                💡 Dica: Salve seu PIX no menu <strong>Perfil</strong> para preenchimento automático em futuras solicitações.
              </p>
            )}
          </div>

          {/* Observações / Motivo */}
          <div>
            <label className="block text-[11px] font-bold text-text-secondary uppercase mb-1">
              Observações / Justificativa (Opcional)
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Pagamento de balsa para travessia em Santos..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="w-full bg-background-primary border border-border-secondary rounded-xl px-3 py-2 text-xs text-text-primary focus:ring-2 focus:ring-info outline-none resize-none shadow-2xs placeholder:text-text-tertiary/60"
            />
          </div>

          {/* Vincular a Notas Fiscais da Carga Atual */}
          {entregasDisponiveis && entregasDisponiveis.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-text-secondary uppercase flex items-center gap-1">
                  <Package size={12} className="text-info" /> Vincular a Notas da Carga (Opcional)
                </label>
                {notasSelecionadas.length > 0 && (
                  <span className="text-[10px] font-bold text-info bg-info/10 px-2 py-0.5 rounded-full border border-info/20">
                    {notasSelecionadas.length} selecionada(s)
                  </span>
                )}
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1 custom-scrollbar">
                {entregasDisponiveis.map(entrega => {
                  const isSelected = notasSelecionadas.includes(entrega.nota);
                  return (
                    <button
                      type="button"
                      key={entrega.id || entrega.nota}
                      onClick={() => toggleNota(entrega.nota)}
                      className={cn(
                        "flex items-center justify-between p-2 rounded-xl text-left transition-all border cursor-pointer shadow-2xs text-xs",
                        isSelected
                          ? "bg-info/15 border-info text-text-primary ring-1 ring-info/30"
                          : "bg-background-primary/80 border-border-secondary text-text-secondary hover:bg-background-primary hover:text-text-primary"
                      )}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-mono font-bold flex items-center gap-1 text-text-primary text-[11px]">
                          <Package size={11} className={cn(isSelected ? "text-info" : "opacity-50")} />
                          <span>NF: {entrega.nota}</span>
                        </div>
                        <p className="text-[10px] text-text-tertiary truncate max-w-[170px]" title={entrega.cliente}>
                          {entrega.cliente || 'Cliente'}
                        </p>
                      </div>
                      <div className={cn(
                        "w-4 h-4 rounded-md flex items-center justify-center shrink-0 border transition-colors",
                        isSelected ? "bg-info text-white border-info" : "border-border-tertiary bg-background-secondary"
                      )}>
                        {isSelected && <Check size={11} strokeWidth={3} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </form>

        {/* Rodapé Fixo */}
        <div className="px-5 py-3.5 border-t border-border-tertiary bg-background-secondary/95 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-text-secondary hover:text-text-primary hover:bg-background-primary border border-border-tertiary transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          
          <button
            type="submit"
            form="form-solicitacao-despesa"
            className="px-5 py-2 rounded-xl bg-info hover:bg-info/90 text-white font-bold text-xs shadow-md shadow-info/20 flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
          >
            <Send size={14} />
            <span>Enviar Solicitação</span>
          </button>
        </div>

      </div>
    </div>
  );
}
