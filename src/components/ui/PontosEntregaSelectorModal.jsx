import React from 'react';
import { MapPin, Navigation, ExternalLink, X, Map as MapIcon, Compass } from 'lucide-react';
import { cn } from '../../lib/utils';

export function PontosEntregaSelectorModal({
  isOpen,
  onClose,
  clienteNome,
  codCliente,
  pontos = []
}) {
  if (!isOpen) return null;

  const handleOpenMaps = (lat, lng) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank');
  };

  const handleOpenWaze = (lat, lng) => {
    const url = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base leading-tight">
                Locais de Entrega do Cliente
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Selecione o ponto para abrir no Maps ou Waze
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Header Cliente */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-md">
                Cód: {codCliente || 'N/A'}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {pontos.length} ponto{pontos.length !== 1 ? 's' : ''} cadastrado{pontos.length !== 1 ? 's' : ''}
              </span>
            </div>
            <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm mt-1">
              {clienteNome || 'Cliente não identificado'}
            </h4>
          </div>

          {/* Lista de Pontos */}
          {pontos.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <Compass className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Nenhum ponto de GPS cadastrado
              </p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                O motorista pode marcar a localização quando estiver na porta do cliente.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pontos.map((ponto, idx) => (
                <div
                  key={ponto.id || idx}
                  className={cn(
                    "p-4 rounded-xl border transition-all space-y-3",
                    ponto.padrao
                      ? "bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50"
                      : "bg-white dark:bg-slate-950/50 border-slate-200 dark:border-slate-800"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h5 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                          {ponto.nomeLocal || `Ponto ${idx + 1}`}
                        </h5>
                        {ponto.padrao && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full">
                            Principal
                          </span>
                        )}
                      </div>
                      {ponto.endereco && (
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          {ponto.endereco}
                        </p>
                      )}
                      {ponto.criadoPor && (
                        <p className="text-[11px] text-slate-400">
                          Cadastrado por: {ponto.criadoPor}
                        </p>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 shrink-0">
                      {Number(ponto.lat).toFixed(4)}, {Number(ponto.lng).toFixed(4)}
                    </span>
                  </div>

                  {/* Ações de Navegação */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleOpenMaps(ponto.lat, ponto.lng)}
                      className="flex items-center justify-center gap-2 py-2 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-semibold text-xs rounded-xl transition-all shadow-sm"
                    >
                      <MapIcon className="w-3.5 h-3.5" />
                      Google Maps
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenWaze(ponto.lat, ponto.lng)}
                      className="flex items-center justify-center gap-2 py-2 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-950/30 text-cyan-700 dark:text-cyan-400 font-semibold text-xs rounded-xl transition-all shadow-sm"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      Waze
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
