import { useState } from 'react';
import { 
  X, DollarSign, Share2, Copy, Check, MessageSquare, 
  Package, CreditCard, Tag, CheckCircle2, FileText, User
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Badge } from './Badge';

export function formatarTextoReembolso(despesa, entregas = []) {
  if (!despesa) return '';

  const placa = despesa.motorista_placa || 'Sem Placa';
  const servico = despesa.tipo || 'Despesa';
  const valorFormatado = (Number(despesa.valor) || 0).toFixed(2).replace('.', ',');
  const pix = despesa.chave_pix || 'Não informado';
  const nome = despesa.nome_recebedor || 'Não informado';

  let texto = `*${placa}* solicitando reembolso referente ao pagamento de *${servico}* no valor de *R$ ${valorFormatado}*\n- Pix: ${pix}\n- Nome: ${nome}`;

  // Notas vinculadas com o nome do cliente
  let notasTexto = '';
  if (despesa.notas_detalhes && despesa.notas_detalhes.length > 0) {
    notasTexto = despesa.notas_detalhes.map(n => `NF ${n.nota}${n.cliente ? ` (${n.cliente})` : ''}`).join(', ');
  } else if (despesa.notas_vinculadas && despesa.notas_vinculadas.length > 0) {
    notasTexto = despesa.notas_vinculadas.map(nota => {
      const ent = (entregas || []).find(e => String(e.nota) === String(nota));
      return `NF ${nota}${ent?.cliente ? ` (${ent.cliente})` : ''}`;
    }).join(', ');
  }

  if (notasTexto) {
    texto += `\n- Notas: ${notasTexto}`;
  }

  if (despesa.observacao) {
    texto += `\n- Obs: ${despesa.observacao}`;
  }

  if (despesa.status === 'Aprovado' || despesa.status === 'Aprovada') {
    texto += `\n- Status: ✅ Aprovado pelo Monitoramento`;
  }

  return texto;
}

export function ModalCardReembolso({ isOpen, onClose, despesa, entregas = [] }) {
  const [copiado, setCopiado] = useState(false);
  const [pixCopiado, setPixCopiado] = useState(false);

  if (!isOpen || !despesa) return null;

  const textoCompartilhamento = formatarTextoReembolso(despesa, entregas);
  const valorFormatado = (Number(despesa.valor) || 0).toFixed(2).replace('.', ',');
  const isAprovado = despesa.status === 'Aprovado' || despesa.status === 'Aprovada';

  // Obter lista de notas com cliente
  const notasComCliente = (despesa.notas_detalhes && despesa.notas_detalhes.length > 0)
    ? despesa.notas_detalhes
    : (despesa.notas_vinculadas || []).map(nota => {
        const ent = (entregas || []).find(e => String(e.nota) === String(nota));
        return {
          nota,
          cliente: ent?.cliente || ''
        };
      });

  const handleCopiarTexto = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(textoCompartilhamento);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    }
  };

  const handleCopiarPix = () => {
    if (despesa.chave_pix && navigator.clipboard) {
      navigator.clipboard.writeText(despesa.chave_pix);
      setPixCopiado(true);
      setTimeout(() => setPixCopiado(false), 2000);
    }
  };

  const handleCompartilharWhatsApp = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(textoCompartilhamento)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCompartilharNativo = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Reembolso - ${despesa.motorista_placa || 'Veículo'}`,
          text: textoCompartilhamento
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          handleCopiarTexto();
        }
      }
    } else {
      handleCopiarTexto();
    }
  };

  return (
    <div className="fixed inset-0 z-[130] bg-background-primary/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-background-secondary w-full max-w-lg rounded-2xl shadow-2xl border border-border-secondary flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-tertiary bg-background-secondary/95 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary leading-tight flex items-center gap-2">
                Card de Reembolso Aprovado
              </h2>
              <p className="text-[11px] text-text-tertiary">
                Pronto para envio e compartilhamento com a equipe/financeiro
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

        {/* Corpo do Modal: Visual do Card */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
          
          {/* Card Visual de Comprovante */}
          <div className="glass-panel p-4 rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-b from-emerald-500/5 via-background-primary/95 to-background-primary shadow-lg space-y-3.5 relative overflow-hidden">
            
            {/* Faixa decorativa superior */}
            <div className="flex items-center justify-between gap-2 border-b border-border-tertiary pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black bg-background-secondary px-2.5 py-1 rounded-lg text-text-primary border border-border-tertiary font-mono tracking-wider">
                  {despesa.motorista_placa || 'SEM PLACA'}
                </span>
                <span className="text-xs font-bold text-info flex items-center gap-1">
                  <Tag size={12} /> {despesa.tipo}
                </span>
              </div>
              <Badge status={despesa.status}>{despesa.status}</Badge>
            </div>

            {/* Valor em Grande Destaque */}
            <div className="bg-background-secondary/80 p-3.5 rounded-xl border border-border-tertiary flex items-center justify-between">
              <div>
                <span className="text-[10px] text-text-tertiary font-bold uppercase block">
                  Valor Aprovado para Reembolso:
                </span>
                <span className="text-2xl font-black text-emerald-500 font-mono">
                  R$ {valorFormatado}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
                <DollarSign size={22} />
              </div>
            </div>

            {/* Dados do PIX e Recebedor */}
            <div className="bg-background-secondary/60 p-3 rounded-xl border border-border-tertiary space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-text-tertiary font-medium flex items-center gap-1">
                  <User size={13} /> Nome:
                </span>
                <span className="text-text-primary font-bold truncate max-w-[200px]" title={despesa.nome_recebedor}>
                  {despesa.nome_recebedor || 'Não informado'}
                </span>
              </div>

              <div className="flex justify-between items-center border-t border-border-tertiary/60 pt-2">
                <span className="text-text-tertiary font-medium flex items-center gap-1">
                  <CreditCard size={13} /> Chave PIX:
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-text-primary text-[11px] truncate max-w-[180px]" title={despesa.chave_pix}>
                    {despesa.chave_pix || 'Não informada'}
                  </span>
                  {despesa.chave_pix && (
                    <button
                      type="button"
                      onClick={handleCopiarPix}
                      className={cn(
                        "p-1 rounded transition-colors cursor-pointer text-[10px] font-bold flex items-center gap-0.5",
                        pixCopiado ? "bg-emerald-500 text-white" : "text-text-tertiary hover:text-text-primary hover:bg-background-tertiary"
                      )}
                      title="Copiar Chave PIX"
                    >
                      {pixCopiado ? <Check size={11} /> : <Copy size={11} />}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Notas Fiscais Vinculadas com Nome do Cliente */}
            {notasComCliente.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] text-text-tertiary font-bold uppercase flex items-center gap-1">
                  <Package size={12} className="text-info" /> Notas Vinculadas ({notasComCliente.length}):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {notasComCliente.map((n, idx) => (
                    <div 
                      key={idx} 
                      className="p-2 bg-background-secondary/80 border border-border-tertiary rounded-lg text-xs flex items-center justify-between gap-1.5"
                    >
                      <span className="font-mono font-bold text-text-primary shrink-0 text-[11px]">
                        NF: {n.nota}
                      </span>
                      {n.cliente && (
                        <span className="text-[10px] text-text-tertiary truncate max-w-[120px]" title={n.cliente}>
                          {n.cliente}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Observações */}
            {despesa.observacao && (
              <div className="text-xs text-text-secondary bg-background-primary/70 p-2.5 rounded-lg border border-border-tertiary">
                <span className="text-[10px] uppercase font-bold text-text-tertiary block mb-0.5">
                  Motivo / Observação:
                </span>
                <p className="italic text-text-primary">"{despesa.observacao}"</p>
              </div>
            )}

            {/* Parecer do Monitoramento */}
            {despesa.observacaoMonitoramento && (
              <div className="text-xs text-text-secondary bg-info/10 p-2.5 rounded-lg border border-info/20">
                <span className="text-[10px] uppercase font-bold text-info block mb-0.5">
                  Parecer do Monitoramento:
                </span>
                <p className="italic text-text-primary font-medium">"{despesa.observacaoMonitoramento}"</p>
              </div>
            )}
          </div>

          {/* Prévia do Texto Padrão */}
          <div className="bg-background-primary border border-border-secondary rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-text-tertiary uppercase flex items-center gap-1">
                <FileText size={12} className="text-info" /> Texto Formatado para WhatsApp:
              </span>
              <button
                type="button"
                onClick={handleCopiarTexto}
                className="text-[10px] font-bold text-info hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copiado ? (
                  <>
                    <Check size={11} className="text-emerald-500" />
                    <span className="text-emerald-500">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy size={11} />
                    <span>Copiar Texto</span>
                  </>
                )}
              </button>
            </div>
            <pre className="text-[11px] font-mono text-text-secondary whitespace-pre-wrap bg-background-secondary p-2.5 rounded-lg border border-border-tertiary/70 leading-relaxed max-h-28 overflow-y-auto">
              {textoCompartilhamento}
            </pre>
          </div>
        </div>

        {/* Rodapé Fixo com Botões de Ação */}
        <div className="px-5 py-3.5 border-t border-border-tertiary bg-background-secondary/95 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-text-secondary hover:text-text-primary hover:bg-background-primary border border-border-tertiary transition-colors cursor-pointer"
          >
            Fechar
          </button>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              type="button"
              onClick={handleCopiarTexto}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs",
                copiado
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "bg-background-primary text-text-primary border-border-secondary hover:bg-background-secondary"
              )}
            >
              {copiado ? <Check size={13} /> : <Copy size={13} />}
              <span>{copiado ? 'Copiado!' : 'Copiar Texto'}</span>
            </button>

            <button
              type="button"
              onClick={handleCompartilharWhatsApp}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
            >
              <MessageSquare size={14} />
              <span>Enviar no WhatsApp</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
