import { useState, useEffect, useMemo } from 'react';
import { X, Package, RotateCcw, Send, Scale, Truck } from 'lucide-react';
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
  const isInitialGramatura = initialTipo === 'Devolução de gramatura' || String(initialTipo || '').toLowerCase().includes('gramatura');
  const defaultMotivoGramatura = isSolicitacao ? 'Falta de peso / Dev. gramatura' : '17 - OPERACIONAL - FALTA DE PESO GRAMATURA CAIXA';

  const [tipo, setTipo] = useState(isInitialGramatura ? 'Parcial' : (initialTipo || 'Total'));
  const [modalidadeParcial, setModalidadeParcial] = useState(isInitialGramatura ? 'gramatura' : 'fisica');
  const [pesoGramaturaAvulso, setPesoGramaturaAvulso] = useState('');
  const [motivo, setMotivo] = useState(isInitialGramatura ? defaultMotivoGramatura : '');
  const [motivoCustom, setMotivoCustom] = useState('');
  const [observacao, setObservacao] = useState('');
  const [itensDevolvidos, setItensDevolvidos] = useState([]);

  useEffect(() => {
    if (isOpen && entrega) {
      const isGram = initialTipo === 'Devolução de gramatura' || String(initialTipo || '').toLowerCase().includes('gramatura');
      setTipo(isGram ? 'Parcial' : (initialTipo || 'Total'));
      setModalidadeParcial(isGram ? 'gramatura' : 'fisica');
      setPesoGramaturaAvulso('');
      setMotivo(isGram ? defaultMotivoGramatura : '');
      setMotivoCustom('');
      setObservacao('');

      if (entrega.itens && entrega.itens.length > 0) {
        if (!isGram && (initialTipo === 'Total' || initialTipo === 'Reentrega')) {
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
      } else {
        setItensDevolvidos([]);
      }
    }
  }, [isOpen, entrega, initialTipo, defaultMotivoGramatura]);

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
  const isGramatura = isParcial && modalidadeParcial === 'gramatura';

  // Peso total calculado
  const pesoTotalCalculado = useMemo(() => {
    if (isTotal || isReentrega) {
      return Number(entrega?.peso) || itensDevolvidos.reduce((acc, i) => acc + (Number(i.peso) || 0), 0);
    }
    if (isGramatura && itensDevolvidos.length === 0) {
      return Number(pesoGramaturaAvulso) || 0;
    }
    return itensDevolvidos.reduce((acc, i) => acc + (Number(i.peso) || 0), 0);
  }, [isTotal, isReentrega, isGramatura, pesoGramaturaAvulso, entrega?.peso, itensDevolvidos]);

  // Validação para habilitar envio
  const canSubmit = useMemo(() => {
    const motivoFinal = motivo === 'OUTRO' ? motivoCustom.trim() : motivo;
    if (!motivoFinal) return false;

    if (isTotal || isReentrega) return true;

    if (isGramatura) {
      if (itensDevolvidos.length === 0) {
        return Number(pesoGramaturaAvulso) > 0;
      }
      return itensDevolvidos.some(i => Number(i.peso) > 0);
    }
    
    // Na parcial física, ao menos 1 item deve ter qtd > 0 ou peso > 0
    return itensDevolvidos.some(i => Number(i.qtd) > 0 || Number(i.peso) > 0);
  }, [motivo, motivoCustom, isTotal, isReentrega, isGramatura, pesoGramaturaAvulso, itensDevolvidos]);

  if (!isOpen || !entrega) return null;

  const handleSubmit = () => {
    const motivoFinal = motivo === 'OUTRO' 
      ? (motivoCustom.trim() || 'Outro motivo não especificado') 
      : (motivo || 'Motivo não informado');

    const tipoFinal = isGramatura ? 'Devolução de gramatura' : tipo;

    let itensReais = [];
    if (isGramatura) {
      if (itensDevolvidos.length > 0) {
        itensReais = itensDevolvidos
          .filter(i => Number(i.peso) > 0)
          .map(i => ({
            ...i,
            qtd: 0,
            peso: Number(i.peso) || 0,
            semRetornoFisico: true
          }));
      } else if (Number(pesoGramaturaAvulso) > 0) {
        itensReais = [{
          codigo: '',
          descricao: 'Diferença de Gramatura (Geral)',
          qtd: 0,
          peso: Number(pesoGramaturaAvulso) || 0,
          semRetornoFisico: true
        }];
      }
    } else if (isTotal || isReentrega) {
      itensReais = itensDevolvidos.length > 0 ? itensDevolvidos : (entrega.itens || []);
    } else {
      itensReais = itensDevolvidos
        .filter(i => Number(i.qtd) > 0 || Number(i.peso) > 0)
        .map(i => ({
          ...i,
          qtd: Number(i.qtd) || 0,
          peso: Number(i.peso) || 0,
          semRetornoFisico: false
        }));
    }

    onConfirm(
      tipoFinal, 
      itensReais, 
      motivoFinal,
      {
        observacao: observacao.trim(),
        pesoTotalDevolvido: pesoTotalCalculado,
        semRetornoFisico: isGramatura,
        subtipo: isGramatura ? 'gramatura' : 'fisica',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-background-primary border border-border-secondary rounded-2xl shadow-2xl flex flex-col w-full max-w-lg max-h-[90vh] overflow-hidden">
        
        {/* Header enxuto */}
        <div className="flex justify-between items-center px-4 py-3.5 border-b border-border-secondary bg-background-secondary flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <RotateCcw size={18} className="text-text-secondary" />
            <h2 className="text-sm sm:text-base font-bold text-text-primary">
              {isSolicitacao ? 'Registrar Ocorrência' : 'Lançar Devolução'}
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-border-tertiary rounded-lg text-text-secondary transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar">
          
          {/* Resumo da Nota */}
          <div className="bg-background-secondary border border-border-secondary rounded-xl px-3.5 py-2.5 flex justify-between items-center">
            <div className="min-w-0 pr-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-info font-mono">NF {entrega.nota}</span>
                {entrega.pedido && <span className="text-[10px] text-text-tertiary">Ped: {entrega.pedido}</span>}
              </div>
              <p className="text-xs font-bold text-text-primary truncate mt-0.5">{entrega.cliente}</p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] uppercase font-semibold text-text-tertiary block">Total NF</span>
              <span className="text-xs font-black text-text-primary font-mono">{Number(entrega.peso || 0).toFixed(1)} kg</span>
            </div>
          </div>

          {/* Tipo de Ocorrência */}
          <div>
            <label className="text-[11px] uppercase font-bold text-text-secondary block mb-1.5">
              Tipo:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleTipoChange('Total')}
                className={cn(
                  "py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer",
                  isTotal 
                    ? "bg-info text-white border-info shadow-xs" 
                    : "bg-background-secondary border-border-tertiary text-text-secondary hover:text-text-primary"
                )}
              >
                Devolução Total
              </button>

              <button
                type="button"
                onClick={() => handleTipoChange('Parcial')}
                className={cn(
                  "py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer",
                  isParcial 
                    ? "bg-info text-white border-info shadow-xs" 
                    : "bg-background-secondary border-border-tertiary text-text-secondary hover:text-text-primary"
                )}
              >
                Entrega Parcial
              </button>

              <button
                type="button"
                onClick={() => handleTipoChange('Reentrega')}
                className={cn(
                  "py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer",
                  isReentrega 
                    ? "bg-info text-white border-info shadow-xs" 
                    : "bg-background-secondary border-border-tertiary text-text-secondary hover:text-text-primary"
                )}
              >
                Reentrega
              </button>
            </div>
          </div>

          {/* Subtipo da Entrega Parcial (Direto e limpo) */}
          {isParcial && (
            <div className="grid grid-cols-2 gap-2 p-1 bg-background-secondary rounded-xl border border-border-secondary">
              <button
                type="button"
                onClick={() => setModalidadeParcial('fisica')}
                className={cn(
                  "py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                  modalidadeParcial === 'fisica'
                    ? "bg-background-primary text-text-primary shadow-xs border border-border-secondary"
                    : "text-text-tertiary hover:text-text-secondary"
                )}
              >
                <Truck size={14} />
                <span>Devolução Física</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setModalidadeParcial('gramatura');
                  if (!motivo) setMotivo(defaultMotivoGramatura);
                }}
                className={cn(
                  "py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                  modalidadeParcial === 'gramatura'
                    ? "bg-background-primary text-text-primary shadow-xs border border-border-secondary"
                    : "text-text-tertiary hover:text-text-secondary"
                )}
              >
                <Scale size={14} />
                <span>Dev. de Gramatura</span>
              </button>
            </div>
          )}

          {/* Seleção do Motivo */}
          <div>
            <label className="text-[11px] uppercase font-bold text-text-secondary block mb-1">
              Motivo: <span className="text-danger">*</span>
            </label>
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full bg-background-secondary border border-border-secondary rounded-xl px-3 py-2.5 text-xs font-medium text-text-primary focus:ring-2 focus:ring-info focus:outline-none"
            >
              <option value="">Selecione o motivo...</option>
              {(isSolicitacao ? MOTIVOS_DEVOLUCAO_MOTORISTA : MOTIVOS_DEVOLUCAO).map(m => (
                <option key={m} value={m} className="bg-slate-900 text-white py-1">{m}</option>
              ))}
              <option value="OUTRO" className="bg-slate-900 text-amber-400 font-bold py-1">
                Outro motivo (digitar detalhadamente)
              </option>
            </select>

            {motivo === 'OUTRO' && (
              <input
                type="text"
                value={motivoCustom}
                onChange={(e) => setMotivoCustom(e.target.value)}
                placeholder="Digite o motivo..."
                className="w-full mt-2 bg-background-secondary border border-border-secondary rounded-xl px-3 py-2 text-xs text-text-primary focus:ring-2 focus:ring-info focus:outline-none"
              />
            )}
          </div>

          {/* Observação Opcional */}
          <div>
            <label className="text-[11px] uppercase font-bold text-text-secondary block mb-1">
              Observação (opcional):
            </label>
            <input
              type="text"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: Falei com encarregado João..."
              className="w-full bg-background-secondary border border-border-secondary rounded-xl px-3 py-2 text-xs text-text-primary focus:ring-2 focus:ring-info focus:outline-none"
            />
          </div>

          {/* Lista de Itens (Unificada para Total, Reentrega, Parcial Física e Parcial por Gramatura) */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[11px] uppercase font-bold text-text-secondary flex items-center gap-1.5">
                {isGramatura ? <Scale size={13} /> : <Package size={13} />}
                {isTotal
                  ? 'Itens da Nota:'
                  : isReentrega
                    ? 'Itens para Reentrega:'
                    : isGramatura
                      ? 'Peso da falta por item (kg):'
                      : 'Quantidades devolvidas:'}
              </span>
              <span className="text-xs font-black text-text-primary font-mono">
                Total: {pesoTotalCalculado.toFixed(3)} kg
              </span>
            </div>

            {itensDevolvidos.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                {itensDevolvidos.map(item => (
                  <div key={item.codigo} className="bg-background-secondary border border-border-tertiary rounded-xl p-2.5">
                    <div className="flex justify-between items-baseline gap-2 mb-2">
                      <span className="font-bold text-xs text-text-primary leading-tight">{item.descricao}</span>
                      <span className="text-[10px] text-text-tertiary font-mono shrink-0">
                        {item.maxQtd} cx • {Number(item.maxPeso).toFixed(3)} kg
                      </span>
                    </div>

                    {(isTotal || isReentrega) ? (
                      <div className="flex justify-between text-xs font-bold px-2.5 py-1.5 rounded-lg bg-background-primary text-text-secondary font-mono border border-border-tertiary">
                        <span>{item.qtd} cx</span>
                        <span>{Number(item.peso).toFixed(3)} kg</span>
                      </div>
                    ) : isGramatura ? (
                      /* Na Gramatura: APENAS o campo de Peso (kg) por item, sem Qtd de caixas */
                      <div>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            max={item.maxPeso}
                            value={item.peso}
                            onChange={(e) => handleItemChange(item.codigo, 'peso', e.target.value)}
                            className="w-full bg-background-primary border border-border-secondary rounded-lg pl-3 pr-9 py-1.5 text-xs font-semibold text-text-primary focus:ring-2 focus:ring-info focus:outline-none"
                            placeholder="Peso da falta (0.000)"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-text-tertiary pointer-events-none">
                            kg
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* Na Parcial Física: Qtd (cx) e Peso (kg) */
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-semibold text-text-tertiary block mb-0.5">Caixas (cx)</label>
                          <input
                            type="number"
                            min="0"
                            max={item.maxQtd}
                            value={item.qtd}
                            onChange={(e) => handleItemChange(item.codigo, 'qtd', e.target.value)}
                            className="w-full bg-background-primary border border-border-secondary rounded-lg px-2.5 py-1.5 text-xs font-semibold text-text-primary focus:ring-2 focus:ring-info focus:outline-none"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-text-tertiary block mb-0.5">Peso (kg)</label>
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            max={item.maxPeso}
                            value={item.peso}
                            onChange={(e) => handleItemChange(item.codigo, 'peso', e.target.value)}
                            className="w-full bg-background-primary border border-border-secondary rounded-lg px-2.5 py-1.5 text-xs font-semibold text-text-primary focus:ring-2 focus:ring-info focus:outline-none"
                            placeholder="0.000"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : isGramatura ? (
              <div className="relative">
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={pesoGramaturaAvulso}
                  onChange={(e) => setPesoGramaturaAvulso(e.target.value)}
                  placeholder="Informe o peso da falta (kg)"
                  className="w-full bg-background-secondary border border-border-secondary rounded-xl px-3 py-2 text-xs font-bold text-text-primary focus:ring-2 focus:ring-info focus:outline-none"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-tertiary pointer-events-none">
                  kg
                </span>
              </div>
            ) : (
              <p className="text-xs text-text-tertiary text-center py-3 bg-background-secondary rounded-xl border border-border-tertiary">
                Nota sem itens detalhados ({Number(entrega.peso || 0).toFixed(1)} kg).
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-border-secondary bg-background-secondary flex gap-2.5 flex-shrink-0">
          <button 
            onClick={onClose}
            className="flex-1 py-2.5 bg-background-primary text-text-secondary hover:text-text-primary rounded-xl font-bold text-xs border border-border-tertiary active:scale-95 transition-transform cursor-pointer"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
              "flex-1 py-2.5 rounded-xl font-bold text-xs flex justify-center items-center active:scale-95 transition-all text-white bg-info hover:bg-info/90 shadow-sm cursor-pointer",
              !canSubmit && "opacity-40 pointer-events-none"
            )}
          >
            <Send size={14} className="mr-1.5" />
            {isSolicitacao ? 'Enviar' : 'Confirmar'}
          </button>
        </div>

      </div>
    </div>
  );
}
