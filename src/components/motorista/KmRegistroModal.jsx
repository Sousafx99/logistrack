import { useState, useEffect, useRef } from 'react';
import { Gauge, Camera, X, CheckCircle, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';

export function KmRegistroModal({ isOpen, onClose, data, placa, carga, modo = 'ajuste', onSuccess }) {
  const { kmRegistros, salvarKmRegistro } = useStore();
  
  const docId = `${data}_${(placa || 'sem-placa').replace(/[\/\\]/g, '-')}_${(carga || 'sem-carga').replace(/[\/\\]/g, '-')}`;
  const registroAtual = (kmRegistros || []).find(k => k.id === docId) || {};

  const [kmInicial, setKmInicial] = useState('');
  const [kmFinal, setKmFinal] = useState('');
  const [fotoKmInicial, setFotoKmInicial] = useState(null);
  const [fotoKmFinal, setFotoKmFinal] = useState(null);
  const [observacao, setObservacao] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const fileInputRefInicial = useRef(null);
  const fileInputRefFinal = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setKmInicial(registroAtual.kmInicial !== null && registroAtual.kmInicial !== undefined ? String(registroAtual.kmInicial) : '');
      setKmFinal(registroAtual.kmFinal !== null && registroAtual.kmFinal !== undefined ? String(registroAtual.kmFinal) : '');
      setFotoKmInicial(registroAtual.fotoKmInicial || null);
      setFotoKmFinal(registroAtual.fotoKmFinal || null);
      setObservacao(registroAtual.observacao || '');
      setErro('');
    }
  }, [isOpen, registroAtual]);

  if (!isOpen) return null;

  const handleCaptureFoto = (e, tipo) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.65);
        if (tipo === 'inicial') {
          setFotoKmInicial(compressedBase64);
        } else {
          setFotoKmFinal(compressedBase64);
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const numInicial = kmInicial !== '' ? Number(kmInicial) : null;
  const numFinal = kmFinal !== '' ? Number(kmFinal) : null;
  const kmExecutadoCalc = (numInicial !== null && numFinal !== null && numFinal >= numInicial) 
    ? numFinal - numInicial 
    : null;

  const handleSalvar = async (e) => {
    e?.preventDefault();
    setErro('');

    if (modo === 'inicial' && (numInicial === null || isNaN(numInicial) || numInicial <= 0)) {
      setErro('Por favor, informe um KM Inicial válido.');
      return;
    }

    if (modo === 'final' && (numFinal === null || isNaN(numFinal) || numFinal <= 0)) {
      setErro('Por favor, informe um KM Final válido.');
      return;
    }

    if (numInicial !== null && numFinal !== null && numFinal < numInicial) {
      setErro(`O KM Final (${numFinal}) não pode ser menor que o KM Inicial (${numInicial}).`);
      return;
    }

    setSalvando(true);
    try {
      await salvarKmRegistro({
        ...registroAtual,
        data,
        placa,
        carga,
        kmInicial: numInicial,
        kmFinal: numFinal,
        fotoKmInicial,
        fotoKmFinal,
        observacao,
        ...(modo === 'inicial' && !registroAtual.dataHoraInicio ? { dataHoraInicio: new Date().toISOString() } : {}),
        ...(modo === 'final' && !registroAtual.dataHoraFim ? { dataHoraFim: new Date().toISOString() } : {})
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setErro('Erro ao salvar registro de KM. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="glass-panel w-full max-w-md rounded-2xl p-6 border border-border-secondary shadow-2xl relative flex flex-col max-h-[90vh] overflow-y-auto">
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-text-tertiary hover:text-text-primary p-1.5 rounded-full hover:bg-background-secondary transition-colors"
        >
          <X size={20} />
        </button>

        {/* Cabeçalho */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-info/10 text-info rounded-xl border border-info/20">
            <Gauge size={24} />
          </div>
          <div>
            <h3 className="text-base font-bold text-text-primary">
              {modo === 'inicial' ? 'Iniciar Rota - KM Inicial' : modo === 'final' ? 'Finalizar Rota - KM Final' : 'Ajustar Quilometragem (KM)'}
            </h3>
            <p className="text-xs text-text-secondary font-medium">
              Placa: <strong className="text-info">{placa}</strong> • Carga: <strong>{carga || 'N/A'}</strong>
            </p>
          </div>
        </div>

        {modo === 'inicial' && (
          <div className="mb-4 p-3 bg-info/10 border border-info/20 rounded-xl text-xs text-info flex items-start gap-2">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <span>Informe o <strong>KM Inicial</strong> do hodômetro do caminhão para registrar o início desta viagem.</span>
          </div>
        )}

        {modo === 'final' && (
          <div className="mb-4 p-3 bg-success/10 border border-success/20 rounded-xl text-xs text-success flex items-start gap-2">
            <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>Informe o <strong>KM Final</strong> para calcular a distância total percorrida na rota.</span>
          </div>
        )}

        <form onSubmit={handleSalvar} className="space-y-4">
          
          {/* Campo KM Inicial */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-text-secondary uppercase">
                KM Inicial {modo === 'inicial' && <span className="text-danger">*</span>}
              </label>
              {registroAtual.dataHoraInicio && (
                <span className="text-[10px] text-text-tertiary">
                  Iniciado em: {new Date(registroAtual.dataHoraInicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type="number"
                inputMode="numeric"
                step="1"
                placeholder="Ex: 125430"
                value={kmInicial}
                onChange={(e) => setKmInicial(e.target.value)}
                autoFocus={modo === 'inicial'}
                className="w-full bg-background-secondary border border-border-secondary rounded-xl px-3.5 py-3 text-base font-bold text-text-primary focus:ring-2 focus:ring-info focus:border-transparent outline-none tracking-wider"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-text-tertiary">
                KM
              </span>
            </div>

            {/* Foto opcional do Hodômetro Inicial */}
            <div className="flex items-center justify-between pt-1">
              <input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                ref={fileInputRefInicial} 
                onChange={(e) => handleCaptureFoto(e, 'inicial')} 
                className="hidden" 
              />
              <button
                type="button"
                onClick={() => fileInputRefInicial.current?.click()}
                className="text-[11px] font-bold text-text-tertiary hover:text-info flex items-center gap-1.5 transition-colors"
              >
                <Camera size={14} />
                {fotoKmInicial ? 'Alterar Foto do Painel' : 'Tirar Foto do Painel (Opcional)'}
              </button>
              {fotoKmInicial && (
                <span className="text-[10px] font-bold text-success flex items-center gap-1">
                  <CheckCircle size={12} /> Foto anexada
                </span>
              )}
            </div>
          </div>

          {/* Campo KM Final */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-text-secondary uppercase">
                KM Final {modo === 'final' && <span className="text-danger">*</span>}
              </label>
              {registroAtual.dataHoraFim && (
                <span className="text-[10px] text-text-tertiary">
                  Finalizado em: {new Date(registroAtual.dataHoraFim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type="number"
                inputMode="numeric"
                step="1"
                placeholder="Ex: 125680"
                value={kmFinal}
                onChange={(e) => setKmFinal(e.target.value)}
                autoFocus={modo === 'final'}
                className="w-full bg-background-secondary border border-border-secondary rounded-xl px-3.5 py-3 text-base font-bold text-text-primary focus:ring-2 focus:ring-info focus:border-transparent outline-none tracking-wider"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-text-tertiary">
                KM
              </span>
            </div>

            {/* Foto opcional do Hodômetro Final */}
            <div className="flex items-center justify-between pt-1">
              <input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                ref={fileInputRefFinal} 
                onChange={(e) => handleCaptureFoto(e, 'final')} 
                className="hidden" 
              />
              <button
                type="button"
                onClick={() => fileInputRefFinal.current?.click()}
                className="text-[11px] font-bold text-text-tertiary hover:text-info flex items-center gap-1.5 transition-colors"
              >
                <Camera size={14} />
                {fotoKmFinal ? 'Alterar Foto Final' : 'Tirar Foto do Painel (Opcional)'}
              </button>
              {fotoKmFinal && (
                <span className="text-[10px] font-bold text-success flex items-center gap-1">
                  <CheckCircle size={12} /> Foto anexada
                </span>
              )}
            </div>
          </div>

          {/* Resumo de KM Percorrido */}
          {kmExecutadoCalc !== null && (
            <div className="p-3.5 bg-background-secondary border border-border-secondary rounded-xl flex items-center justify-between">
              <span className="text-xs font-bold text-text-secondary">Distância Percorrida:</span>
              <div className="flex items-center gap-1.5 text-base font-black text-success">
                <span>{kmExecutadoCalc.toLocaleString('pt-BR')}</span>
                <span className="text-xs font-bold text-text-tertiary">KM</span>
              </div>
            </div>
          )}

          {/* Observações Opcionais */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-tertiary uppercase">Observações (Opcional)</label>
            <input
              type="text"
              placeholder="Ex: Desvio de rota para abastecimento..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="w-full bg-background-secondary border border-border-secondary rounded-xl px-3 py-2 text-xs text-text-primary focus:ring-1 focus:ring-info outline-none"
            />
          </div>

          {erro && (
            <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-xs font-bold text-danger flex items-center gap-2">
              <AlertTriangle size={16} className="flex-shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-background-secondary hover:bg-background-tertiary text-text-secondary text-xs font-bold rounded-xl border border-border-secondary transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="flex-1 py-3 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-xl shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2"
            >
              {salvando ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle size={16} />
                  {modo === 'inicial' ? 'Iniciar Viagem' : modo === 'final' ? 'Confirmar KM Final' : 'Salvar Ajustes'}
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
