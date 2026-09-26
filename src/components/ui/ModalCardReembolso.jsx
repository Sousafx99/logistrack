import { useState, useRef } from 'react';
import { 
  X, DollarSign, Share2, Copy, Check, MessageSquare, 
  Package, CreditCard, Tag, CheckCircle2, FileText, User,
  Download, Image as ImageIcon, Loader2
} from 'lucide-react';
import { toPng, toBlob } from 'html-to-image';
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

  // Notas vinculadas com o nome do cliente - cada nota em uma linha separada
  let notasLinhas = [];
  if (despesa.notas_detalhes && despesa.notas_detalhes.length > 0) {
    notasLinhas = despesa.notas_detalhes.map(n => `  • NF ${n.nota}${n.cliente ? ` - ${n.cliente}` : ''}`);
  } else if (despesa.notas_vinculadas && despesa.notas_vinculadas.length > 0) {
    notasLinhas = despesa.notas_vinculadas.map(nota => {
      const ent = (entregas || []).find(e => String(e.nota) === String(nota));
      return `  • NF ${nota}${ent?.cliente ? ` - ${ent.cliente}` : ''}`;
    });
  }

  if (notasLinhas.length > 0) {
    texto += `\n- Notas:\n${notasLinhas.join('\n')}`;
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
  const [isGerandoImagem, setIsGerandoImagem] = useState(false);
  const [imagemBaixada, setImagemBaixada] = useState(false);
  const [imagemCopiada, setImagemCopiada] = useState(false);
  const cardRef = useRef(null);

  if (!isOpen || !despesa) return null;

  const textoCompartilhamento = formatarTextoReembolso(despesa, entregas);
  const valorFormatado = (Number(despesa.valor) || 0).toFixed(2).replace('.', ',');
  const dataFormatada = new Date(despesa.data_solicitacao || despesa.criadoEm || Date.now()).toLocaleString('pt-BR');

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

  const getNomeArquivo = () => {
    const p = (despesa.motorista_placa || 'Veiculo').replace(/[^a-zA-Z0-9]/g, '_');
    const t = (despesa.tipo || 'Despesa').replace(/[^a-zA-Z0-9]/g, '_');
    return `Reembolso_${p}_${t}.png`;
  };

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

  // Gerar Blob PNG do card
  const gerarBlobCard = async () => {
    if (!cardRef.current) return null;
    return await toBlob(cardRef.current, {
      pixelRatio: 2.5,
      cacheBust: true,
      backgroundColor: '#0f172a'
    });
  };

  // Baixar imagem do card
  const handleBaixarImagem = async () => {
    if (!cardRef.current || isGerandoImagem) return;
    setIsGerandoImagem(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2.5,
        cacheBust: true,
        backgroundColor: '#0f172a'
      });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = getNomeArquivo();
      link.click();
      setImagemBaixada(true);
      setTimeout(() => setImagemBaixada(false), 2500);
    } catch (err) {
      console.error('Erro ao baixar imagem:', err);
      alert('Não foi possível gerar o arquivo de imagem.');
    } finally {
      setIsGerandoImagem(false);
    }
  };

  // Copiar imagem para a área de transferência (para colar no WhatsApp Web / Telegram)
  const handleCopiarImagem = async () => {
    if (!cardRef.current || isGerandoImagem) return;
    setIsGerandoImagem(true);
    try {
      const blob = await gerarBlobCard();
      if (blob && navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new window.ClipboardItem({ 'image/png': blob })
        ]);
        setImagemCopiada(true);
        setTimeout(() => setImagemCopiada(false), 2500);
      } else {
        await handleBaixarImagem();
      }
    } catch (err) {
      console.warn('Erro ao copiar imagem diretamente para clipboard, acionando download:', err);
      await handleBaixarImagem();
    } finally {
      setIsGerandoImagem(false);
    }
  };

  // Compartilhamento unificado: Imagem + Texto (Nativo celular ou WhatsApp + Imagem)
  const handleCompartilharCompleto = async () => {
    if (!cardRef.current || isGerandoImagem) return;
    setIsGerandoImagem(true);
    try {
      const blob = await gerarBlobCard();
      if (!blob) throw new Error('Falha ao gerar blob');

      const file = new File([blob], getNomeArquivo(), { type: 'image/png' });

      // Se o dispositivo suportar compartilhamento nativo de arquivos (Android/iOS)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Reembolso - ${despesa.motorista_placa || 'Veículo'}`,
          text: textoCompartilhamento,
          files: [file]
        });
      } else {
        // No computador / navegadores sem suporte a files no share:
        // Tenta copiar a imagem para o clipboard, copia o texto e abre o WhatsApp
        try {
          if (navigator.clipboard && window.ClipboardItem) {
            await navigator.clipboard.write([
              new window.ClipboardItem({ 'image/png': blob })
            ]);
            setImagemCopiada(true);
          } else {
            handleBaixarImagem();
          }
        } catch (e) {
          handleBaixarImagem();
        }
        handleCopiarTexto();
        handleCompartilharWhatsApp();
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Erro no compartilhamento:', err);
        handleCopiarTexto();
        handleCompartilharWhatsApp();
      }
    } finally {
      setIsGerandoImagem(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] bg-background-primary/80 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-background-secondary w-full max-w-lg rounded-2xl shadow-2xl border border-border-secondary flex flex-col max-h-[94vh] sm:max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-150">
        
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
                Gere a imagem do comprovante e compartilhe com 1 clique
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
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4 custom-scrollbar">
          
          {/* Card Visual com ref para captura de Imagem */}
          <div 
            ref={cardRef}
            className="p-4 sm:p-5 rounded-2xl border-2 border-emerald-500/40 bg-slate-900 text-white shadow-xl space-y-3.5 relative overflow-hidden"
            style={{
              background: 'linear-gradient(145deg, #090d16 0%, #0f172a 100%)',
              color: '#ffffff'
            }}
          >
            {/* Faixa decorativa superior */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-700/80 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black bg-slate-800 px-2.5 py-1 rounded-lg text-emerald-400 border border-slate-700 font-mono tracking-wider">
                  {despesa.motorista_placa || 'SEM PLACA'}
                </span>
                <span className="text-xs font-bold text-sky-400 flex items-center gap-1">
                  <Tag size={12} /> {despesa.tipo}
                </span>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-xs">
                <CheckCircle2 size={12} /> {despesa.status}
              </span>
            </div>

            {/* Valor em Grande Destaque */}
            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wide">
                  Valor Aprovado para Reembolso:
                </span>
                <span className="text-2xl font-black text-emerald-400 font-mono tracking-tight">
                  R$ {valorFormatado}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <DollarSign size={22} />
              </div>
            </div>

            {/* Dados do PIX e Recebedor */}
            <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/80 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium flex items-center gap-1">
                  <User size={13} className="text-slate-400" /> Recebedor:
                </span>
                <span className="text-white font-bold truncate max-w-[200px]" title={despesa.nome_recebedor}>
                  {despesa.nome_recebedor || 'Não informado'}
                </span>
              </div>

              <div className="flex justify-between items-center border-t border-slate-700/60 pt-2">
                <span className="text-slate-400 font-medium flex items-center gap-1">
                  <CreditCard size={13} className="text-slate-400" /> Chave PIX:
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-emerald-300 text-[11px] truncate max-w-[180px]" title={despesa.chave_pix}>
                    {despesa.chave_pix || 'Não informada'}
                  </span>
                  {despesa.chave_pix && (
                    <button
                      type="button"
                      onClick={handleCopiarPix}
                      className={cn(
                        "p-1 rounded transition-colors cursor-pointer text-[10px] font-bold flex items-center gap-0.5",
                        pixCopiado ? "bg-emerald-500 text-white" : "text-slate-400 hover:text-white hover:bg-slate-700"
                      )}
                      title="Copiar Chave PIX"
                    >
                      {pixCopiado ? <Check size={11} /> : <Copy size={11} />}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Notas Fiscais Vinculadas com Nome do Cliente - Cada uma em sua linha */}
            {notasComCliente.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
                  <Package size={12} className="text-sky-400" /> Notas Vinculadas ({notasComCliente.length}):
                </span>
                <div className="space-y-1">
                  {notasComCliente.map((n, idx) => (
                    <div 
                      key={idx} 
                      className="p-2 bg-slate-800/70 border border-slate-700/70 rounded-lg text-xs flex items-center justify-between gap-2"
                    >
                      <span className="font-mono font-bold text-sky-300 shrink-0 text-[11px]">
                        NF {n.nota}
                      </span>
                      {n.cliente ? (
                        <span className="text-[11px] text-slate-300 font-medium truncate text-right max-w-[220px]" title={n.cliente}>
                          {n.cliente}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 italic">Sem cliente</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Observações */}
            {despesa.observacao && (
              <div className="text-xs text-slate-300 bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                  Motivo / Observação:
                </span>
                <p className="italic text-slate-200">"{despesa.observacao}"</p>
              </div>
            )}

            {/* Parecer do Monitoramento */}
            {despesa.observacaoMonitoramento && (
              <div className="text-xs text-emerald-200 bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-500/30">
                <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-0.5">
                  Parecer do Monitoramento:
                </span>
                <p className="italic font-medium">"{despesa.observacaoMonitoramento}"</p>
              </div>
            )}

            {/* Rodapé do Card Imprimível */}
            <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-[10px] text-slate-500">
              <span>LogisTrack • Gestão Logística</span>
              <span>{dataFormatada}</span>
            </div>
          </div>

          {/* Atalhos para Ações de Imagem */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBaixarImagem}
              disabled={isGerandoImagem}
              className="flex-1 py-2 px-3 rounded-xl bg-background-primary hover:bg-background-secondary border border-border-secondary text-text-primary text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50 shadow-2xs"
              title="Baixar imagem PNG do card"
            >
              {isGerandoImagem ? (
                <Loader2 size={14} className="animate-spin text-info" />
              ) : imagemBaixada ? (
                <Check size={14} className="text-emerald-500" />
              ) : (
                <Download size={14} className="text-info" />
              )}
              <span>{imagemBaixada ? 'Imagem Baixada!' : 'Baixar Imagem'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopiarImagem}
              disabled={isGerandoImagem}
              className="flex-1 py-2 px-3 rounded-xl bg-background-primary hover:bg-background-secondary border border-border-secondary text-text-primary text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50 shadow-2xs"
              title="Copiar imagem para colar diretamente no WhatsApp Web"
            >
              {isGerandoImagem ? (
                <Loader2 size={14} className="animate-spin text-info" />
              ) : imagemCopiada ? (
                <Check size={14} className="text-emerald-500" />
              ) : (
                <ImageIcon size={14} className="text-sky-500" />
              )}
              <span>{imagemCopiada ? 'Imagem Copiada!' : 'Copiar Imagem'}</span>
            </button>
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
            <pre className="text-[11px] font-mono text-text-secondary whitespace-pre-wrap bg-background-secondary p-2.5 rounded-lg border border-border-tertiary/70 leading-relaxed max-h-32 overflow-y-auto">
              {textoCompartilhamento}
            </pre>
          </div>
        </div>

        {/* Rodapé Fixo com Botões de Ação */}
        <div className="px-4 sm:px-5 py-3.5 border-t border-border-tertiary bg-background-secondary/95 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-text-secondary hover:text-text-primary hover:bg-background-primary border border-border-tertiary transition-colors cursor-pointer"
          >
            Fechar
          </button>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Botão de Compartilhar Completo (Imagem + Texto) */}
            <button
              type="button"
              onClick={handleCompartilharCompleto}
              disabled={isGerandoImagem}
              className="px-3.5 py-2 rounded-xl bg-info hover:bg-info/90 text-white font-bold text-xs shadow-md shadow-info/20 flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              title="Compartilhar imagem e texto completo"
            >
              {isGerandoImagem ? <Loader2 size={13} className="animate-spin" /> : <Share2 size={13} />}
              <span>Compartilhar Card + Texto</span>
            </button>

            {/* Enviar no WhatsApp */}
            <button
              type="button"
              onClick={handleCompartilharWhatsApp}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              title="Abrir WhatsApp com texto formatado"
            >
              <MessageSquare size={13} />
              <span>WhatsApp</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
