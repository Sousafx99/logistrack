import { useState, useEffect } from 'react';
import { MapPin, Navigation, Compass, CheckCircle2, AlertTriangle, Loader2, X, RefreshCw } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';

export function SolicitarGeolocModal({
  isOpen,
  onClose,
  cliente,
  motoristaPlaca,
  motoristaNome,
  carga,
  data
}) {
  const { solicitarAjusteGeoloc } = useStore();

  const [coords, setCoords] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [loadingGps, setLoadingGps] = useState(false);
  const [erroGps, setErroGps] = useState('');
  const [nomeLocal, setNomeLocal] = useState('');
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  const obterLocalizacao = () => {
    setLoadingGps(true);
    setErroGps('');
    setCoords(null);
    setAccuracy(null);

    if (!navigator.geolocation) {
      setErroGps('Geolocalização não é suportada pelo seu navegador/aparelho.');
      setLoadingGps(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setAccuracy(Math.round(position.coords.accuracy));
        setLoadingGps(false);
      },
      (error) => {
        let msg = 'Não foi possível capturar o GPS.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Permissão de localização negada. Ative a localização nas configurações do seu celular/navegador.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = 'Sinal de GPS indisponível no momento. Certifique-se de que o GPS está ligado.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'Tempo limite esgotado ao buscar GPS. Tente novamente em um local com melhor sinal.';
        }
        setErroGps(msg);
        setLoadingGps(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  };

  useEffect(() => {
    if (isOpen) {
      setNomeLocal('');
      setObservacao('');
      setErroGps('');
      setSucesso(false);
      setSalvando(false);
      obterLocalizacao();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!coords) {
      setErroGps('Aguarde a captura do GPS antes de enviar.');
      return;
    }

    try {
      setSalvando(true);
      await solicitarAjusteGeoloc({
        codCliente: cliente?.codCliente || cliente?.cod_cliente || '',
        clienteNome: cliente?.cliente || cliente?.nome || '',
        municipio: cliente?.municipio || '',
        bairro: cliente?.bairro || '',
        endereco: cliente?.endereco || '',
        motoristaPlaca: motoristaPlaca || '',
        motoristaNome: motoristaNome || '',
        carga: carga || '',
        data: data || '',
        lat: coords.lat,
        lng: coords.lng,
        precisaoMetros: accuracy,
        nomeLocalSugerido: nomeLocal.trim() || 'Ponto de Descarga',
        observacao: observacao.trim()
      });

      setSucesso(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Erro ao enviar geolocalização:', err);
      setErroGps('Erro ao enviar solicitação ao servidor. Verifique sua conexão.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base leading-tight">
                Marcar Localização do Cliente
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Captura via GPS na porta do cliente
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
          {sucesso ? (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-500 rounded-full flex items-center justify-center animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Localização Enviada com Sucesso!
              </h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
                O monitoramento recebeu as coordenadas deste cliente para validação.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Card Cliente */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-md">
                    Cód: {cliente?.codCliente || cliente?.cod_cliente || 'N/A'}
                  </span>
                  {cliente?.municipio && (
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {cliente.municipio}{cliente?.bairro ? ` - ${cliente.bairro}` : ''}
                    </span>
                  )}
                </div>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  {cliente?.cliente || cliente?.nome || 'Cliente não identificado'}
                </h4>
                {cliente?.endereco && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {cliente.endereco}
                  </p>
                )}
              </div>

              {/* Status do GPS */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Compass className="w-4 h-4 text-emerald-500" />
                    Sinal de GPS do Celular
                  </span>
                  <button
                    type="button"
                    onClick={obterLocalizacao}
                    disabled={loadingGps}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 disabled:opacity-50"
                  >
                    <RefreshCw className={cn("w-3 h-3", loadingGps && "animate-spin")} />
                    Atualizar GPS
                  </button>
                </div>

                {loadingGps && (
                  <div className="py-4 flex flex-col items-center justify-center space-y-2">
                    <Loader2 className="w-7 h-7 text-emerald-500 animate-spin" />
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      Obtendo coordenadas via satélite...
                    </p>
                  </div>
                )}

                {erroGps && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-lg flex items-start gap-2.5 text-rose-700 dark:text-rose-300 text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <p className="font-semibold">Erro no GPS</p>
                      <p>{erroGps}</p>
                    </div>
                  </div>
                )}

                {coords && !loadingGps && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Latitude</span>
                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {coords.lat.toFixed(6)}
                        </span>
                      </div>
                      <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Longitude</span>
                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {coords.lng.toFixed(6)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs px-1">
                      <span className="text-slate-500 dark:text-slate-400">Precisão estimada:</span>
                      <span className={cn(
                        "font-semibold px-2 py-0.5 rounded-full text-[11px]",
                        accuracy <= 20 
                          ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                          : accuracy <= 50
                            ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                            : "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300"
                      )}>
                        ± {accuracy} metros {accuracy <= 20 ? '(Excelente)' : accuracy <= 50 ? '(Boa)' : '(Baixa)'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Identificação do Ponto / Referência */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nome do Local / Ponto (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Entrada Principal, Portão dos Fundos, Galpão 2"
                    value={nomeLocal}
                    onChange={(e) => setNomeLocal(e.target.value)}
                    className="w-full text-sm px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Observação ou Instrução para Próximas Entregas (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ex: Tocar campainha no portão preto ao lado da rampa"
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    className="w-full text-sm px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-900 dark:text-slate-100 resize-none"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!coords || loadingGps || salvando}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow-md hover:shadow-lg disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 transition-all"
                >
                  {salvando ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Navigation className="w-4 h-4" />
                      Salvar e Enviar
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
