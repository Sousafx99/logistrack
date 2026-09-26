import { useState, useEffect, useMemo } from 'react';
import { X, Package, CheckCircle, AlertCircle, RotateCcw, AlertTriangle, Send } from 'lucide-react';
import { cn } from '../../lib/utils';
import { MOTIVOS_DEVOLUCAO, MOTIVOS_DEVOLUCAO_MOTORISTA } from '../../data/mockData';

export function DevolucaoModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  entrega, 
  tipo: initialTipo = 'Total',
  isSolicitacao = true
}) {
  const [tipo, setTipo] = useState(initialTipo);
  const [motivo, setMotivo] = useState('');
  const [motivoCustom, setMotivoCustom] = useState('');
  const [observacao, setObservacao] = useState('');
  const [itensDevolvidos, setItensDevolvidos] = useState([]);

  useEffect(() => {
    if (isOpen && entrega) {
      setTipo(initialTipo || 'Total');
      setMotivo('');
      setMotivoCustom('');
      setObservacao('');

      if (entrega.itens && entrega.itens.length > 0) {
        if (initialTipo === 'Total' || initialTipo === 'Reentrega') {
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
      } else {
        setItensDevolvidos([]);
      }
    }
  }, [isOpen, entrega, initialTipo]);

  // Recalcula itens quando tipo muda
  const handleTipoChange = (novoTipo) => {
    setTipo(novoTipo);
    if (!entrega?.itens) return;

    if (novoTipo === 'Total' || novoTipo === 'Reentrega') {
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
  };

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
  const isReentrega = tipo === 'Reentrega';
  const isParcial = tipo === 'Parcial';

  // Peso total calculado
  const pesoTotalCalculado = useMemo(() => {
    if (isTotal || isReentrega) {
      return Number(entrega.peso) || itensDevolvidos.reduce((acc, i) => acc + (Number(i.peso) || 0), 0);
    }
    return itensDevolvidos.reduce((acc, i) => acc + (Number(i.peso) || 0), 0);
  }, [isTotal, isReentrega, entrega.peso, itensDevolvidos]);

  // Validação para habilitar envio
  const canSubmit = useMemo(() => {
    const motivoFinal = motivo === 'OUTRO' ? motivoCustom.trim() : motivo;
    if (!motivoFinal) return false;

    if (isTotal || isReentrega) return true;
    // Na parcial, ao menos 1 item deve ter qtd > 0 ou peso > 0
    return itensDevolvidos.some(i => Number(i.qtd) > 0 || Number(i.peso) > 0);
  }, [motivo, motivoCustom, isTotal, isReentrega, itensDevolvidos]);

  const handleSubmit = () => {
    const motivoFinal = motivo === 'OUTRO' 
      ? (motivoCustom.trim() || 'Outro motivo não especificado') 
      : (motivo || 'Motivo não informado');

    const itensReais = (isTotal || isReentrega)
      ? (itensDevolvidos.length > 0 ? itensDevolvidos : (entrega.itens || []))
      : itensDevolvidos.filter(i => Number(i.qtd) > 0 || Number(i.peso) > 0).map(i => ({
          ...i,
          qtd: Number(i.qtd) || 0,
          peso: Number(i.peso) || 0
        }));

    onConfirm(
      tipo, 
      itensReais, 
      motivoFinal,
      {
        observacao: observacao.trim(),
        pesoTotalDevolvido: pesoTotalCalculado,
        entregaId: entrega.id,
        nota: entrega.nota,
        codCliente: entrega.codCliente,
        cliente: entrega.cliente,
        bairro: entrega.bairro,
        cidade: entrega.cidade,
        placa: entrega.placa,
        carga: entrega.carga,
        data: entrega.data
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-background-primary border border-border-secondary rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col w-full max-w-lg max-h-[90vh] animate-in zoom-in-95 duration-200 overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 sm:p-5 border-b border-border-secondary bg-background-secondary rounded-t-2xl sm:rounded-t-3xl flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center font-bold border",
              isTotal ? "bg-danger/15 text-danger border-danger/30" : 
              isParcial ? "bg-orange-500/15 text-orange-400 border-orange-500/30" : 
              "bg-purple-500/15 text-purple-400 border-purple-500/30"
            )}>
              <RotateCcw size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-text-primary leading-tight">
                {isSolicitacao ? 'Solicitar Ocorrência / Devolução' : 'Registrar Devolução'}
              </h2>
              <p className="text-xs text-text-tertiary">
                {isSolicitacao ? 'O monitoramento avaliará e autorizará a ocorrência' : 'Lançamento direto'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-background-primary hover:bg-border-tertiary rounded-xl text-text-secondary active:scale-95 transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
          
          {/* Dados da Nota */}
          <div className="bg-background-secondary border border-border-secondary rounded-xl p-3 flex justify-between items-center">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-info font-mono">NF: {entrega.nota}</span>
                {entrega.pedido && <span className="text-[10px] text-text-tertiary">Ped: {entrega.pedido}</span>}
              </div>
              <p className="text-xs font-bold text-text-primary mt-0.5">{entrega.cliente}</p>
              {entrega.bairro && <p className="text-[10px] text-text-tertiary">{entrega.bairro} {entrega.cidade ? `- ${entrega.cidade}` : ''}</p>}
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] uppercase font-bold text-text-tertiary block">Total NF</span>
              <span className="text-xs font-black text-text-primary font-mono">{Number(entrega.peso || 0).toFixed(1)} kg</span>
            </div>
          </div>

          {/* Seleção do Tipo de Solicitação */}
          <div>
            <label className="text-[11px] uppercase font-bold text-text-secondary block mb-1.5">
              Tipo de Ocorrência Desejada:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleTipoChange('Total')}
                className={cn(
                  "py-2.5 px-2 rounded-xl text-xs font-bold border transition-all text-center flex flex-col items-center justify-center gap-1 cursor-pointer",
                  isTotal 
                    ? "bg-danger text-white border-danger shadow-sm shadow-danger/20" 
                    : "bg-background-secondary border-border-tertiary text-text-secondary hover:text-text-primary"
                )}
              >
                <span>Devolução Total</span>
              </button>

              <button
                type="button"
                onClick={() => handleTipoChange('Parcial')}
                className={cn(
                  "py-2.5 px-2 rounded-xl text-xs font-bold border transition-all text-center flex flex-col items-center justify-center gap-1 cursor-pointer",
                  isParcial 
                    ? "bg-orange-500 text-white border-orange-500 shadow-sm shadow-orange-500/20" 
                    : "bg-background-secondary border-border-tertiary text-text-secondary hover:text-text-primary"
                )}
              >
                <span>Entrega Parcial</span>
              </button>

              <button
                type="button"
                onClick={() => handleTipoChange('Reentrega')}
                className={cn(
                  "py-2.5 px-2 rounded-xl text-xs font-bold border transition-all text-center flex flex-col items-center justify-center gap-1 cursor-pointer",
                  isReentrega 
                    ? "bg-purple-600 text-white border-purple-600 shadow-sm shadow-purple-600/20" 
                    : "bg-background-secondary border-border-tertiary text-text-secondary hover:text-text-primary"
                )}
              >
                <span>Reentrega</span>
              </button>
            </div>
          </div>

          {/* Seleção do Motivo */}
          <div>
            <label className="text-[11px] uppercase font-bold text-text-secondary block mb-1.5">
              Motivo da Ocorrência: <span className="text-danger">*</span>
            </label>
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full bg-background-primary border border-border-secondary rounded-xl px-3 py-2.5 text-xs font-medium text-text-primary focus:ring-2 focus:ring-info focus:outline-none"
            >
              <option value="">Selecione o motivo da ocorrência...</option>
              {(isSolicitacao ? MOTIVOS_DEVOLUCAO_MOTORISTA : MOTIVOS_DEVOLUCAO).map(m => (
                <option key={m} value={m} className="bg-slate-900 text-white py-1">{m}</option>
              ))}
              <option value="OUTRO" className="bg-slate-900 text-amber-400 font-bold py-1">Outro motivo (digitar detalhadamente)</option>
            </select>

            {motivo === 'OUTRO' && (
              <input
                type="text"
                value={motivoCustom}
                onChange={(e) => setMotivoCustom(e.target.value)}
                placeholder="Especifique o motivo da ocorrência..."
                className="w-full mt-2 bg-background-primary border border-border-secondary rounded-xl px-3 py-2 text-xs text-text-primary focus:ring-2 focus:ring-info"
              />
            )}
          </div>

          {/* Observação Adicional */}
          <div>
            <label className="text-[11px] uppercase font-bold text-text-secondary block mb-1.5">
              Observações Adicionais (opcional):
            </label>
            <input
              type="text"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: Falei com encarregado João; retorno agendado..."
              className="w-full bg-background-primary border border-border-secondary rounded-xl px-3 py-2 text-xs text-text-primary focus:ring-2 focus:ring-info"
            />
          </div>

          {/* Lista de Itens */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xs font-bold text-text-primary flex items-center">
                <Package size={14} className="mr-1.5 text-info" />
                {isTotal ? 'Itens Sendo Devolvidos Totalmente' : isReentrega ? 'Itens para Reentrega' : 'Informe as quantidades devolvidas:'}
              </h3>
              <span className="text-[11px] font-bold text-danger font-mono">
                {pesoTotalCalculado.toFixed(3)} kg
              </span>
            </div>
            
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
              {itensDevolvidos.map(item => (
                <div key={item.codigo} className="bg-background-secondary border border-border-tertiary rounded-xl p-3">
                  <div className="mb-2">
                    <span className="font-semibold text-xs text-text-primary block leading-tight">{item.descricao}</span>
                    <span className="text-[10px] text-text-tertiary font-mono">Cód: {item.codigo} • Total NFE: {item.maxQtd} cx ({Number(item.maxPeso).toFixed(3)}kg)</span>
                  </div>
                  
                  {(isTotal || isReentrega) ? (
                    <div className={cn(
                      "flex justify-between text-xs font-bold px-3 py-1.5 rounded-lg font-mono",
                      isTotal ? "text-danger bg-danger/10" : "text-purple-400 bg-purple-500/10"
                    )}>
                      <span>Quantidade: {item.qtd} cx</span>
                      <span>{Number(item.peso).toFixed(3)} kg</span>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] uppercase font-bold text-text-tertiary block mb-1">Qtd Devolvida (cx)</label>
                        <input 
                          type="number" 
                          min="0"
                          max={item.maxQtd}
                          value={item.qtd}
                          onChange={(e) => handleItemChange(item.codigo, 'qtd', e.target.value)}
                          className="w-full bg-background-primary border border-border-secondary rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:ring-warning"
                          placeholder="0"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] uppercase font-bold text-text-tertiary block mb-1">Peso Devolvido (kg)</label>
                        <input 
                          type="number" 
                          step="0.001"
                          min="0"
                          max={item.maxPeso}
                          value={item.peso}
                          onChange={(e) => handleItemChange(item.codigo, 'peso', e.target.value)}
                          className="w-full bg-background-primary border border-border-secondary rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:ring-warning"
                          placeholder="0.000"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {itensDevolvidos.length === 0 && (
                <p className="text-xs text-text-tertiary text-center py-3">Nenhum item detalhado nesta nota.</p>
              )}
            </div>
          </div>

          {/* Aviso informativo de fluxo de autorização */}
          {isSolicitacao && (
            <div className="bg-info/10 border border-info/20 rounded-xl p-3 flex items-start gap-2 text-xs text-text-secondary">
              <AlertCircle size={16} className="text-info shrink-0 mt-0.5" />
              <p>
                Esta ocorrência será enviada como <strong>solicitação pendente</strong> para a equipe de Monitoramento aprovar ou definir a tratativa adequada.
              </p>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-secondary bg-background-secondary rounded-b-2xl sm:rounded-b-3xl flex gap-3 flex-shrink-0">
          <button 
            onClick={onClose}
            className="flex-1 py-3 bg-background-primary text-text-secondary hover:text-text-primary rounded-xl font-bold text-xs border border-border-tertiary active:scale-95 transition-transform cursor-pointer"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
              "flex-1 py-3 rounded-xl font-bold text-xs flex justify-center items-center active:scale-95 transition-all text-white shadow-md cursor-pointer",
              isTotal ? "bg-danger hover:bg-danger/90" : isParcial ? "bg-orange-500 hover:bg-orange-600" : "bg-purple-600 hover:bg-purple-700",
              !canSubmit && "opacity-50 pointer-events-none"
            )}
          >
            <Send size={15} className="mr-2" />
            {isSolicitacao ? 'Enviar Solicitação' : 'Confirmar Lançamento'}
          </button>
        </div>

      </div>
    </div>
  );
}

