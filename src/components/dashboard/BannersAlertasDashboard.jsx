import React, { useMemo } from 'react';
import { 
  AlertTriangle, 
  Clock, 
  RotateCcw, 
  MapPin, 
  DollarSign, 
  CheckCircle2, 
  Bell,
  ChevronRight,
  Truck
} from 'lucide-react';
import { useStore } from '../../store/useStore';

export function BannersAlertasDashboard({ 
  entregas = [], 
  veiculos = [], 
  onSelectVeiculo 
}) {
  const { 
    solicitacoesDevolucao = [], 
    solicitacoesGeoloc = [], 
    despesas = [] 
  } = useStore();

  const agora = Date.now();

  // 1. Veículos ativos com mais de 30 minutos sem atualização operacional
  // Regra: Só conta se a 8132 da carga foi importada e se o motorista iniciou a rota
  const carrosSemAtualizacao30Min = useMemo(() => {
    const alertas = [];

    (veiculos || []).forEach(v => {
      // Veículos que ainda têm entregas em aberto
      const isAtivo = (v.pendentes > 0 || v.noCliente > 0 || v.descarregando > 0);
      if (!isAtivo) return;

      const entregasDoVeiculo = entregas.filter(e => 
        (e.placa || '').trim().toUpperCase() === v.placa
      );
      if (entregasDoVeiculo.length === 0) return;

      // Regra 1: Só conta se já tiver subido a planilha 8132 da carga (não conta se for apenas prévia 8164)
      const tem8132 = entregasDoVeiculo.some(e => 
        e.isPrevia === false || 
        e.statusFaturamento === 'Faturado' || 
        (e.nota && !String(e.nota).startsWith('PED:'))
      );
      if (!tem8132) return;

      // Regra 2: Preferencialmente quando o motorista da carga iniciar a rota
      // Considera iniciada quando alguma entrega mudou de status (saiu de pendente), tem horário registrado ou check-in
      const rotaIniciada = entregasDoVeiculo.some(e => {
        const st = String(e.status || '').trim().toLowerCase();
        const mudouStatus = st && st !== 'pendente' && st !== 'aguardando início' && st !== 'aguardando inicio';
        const temHorario = Boolean(e.horaSaida || e.horaChegada);
        const temHistorico = Array.isArray(e.historico) && e.historico.some(h => {
          const hst = String(h.status || '').trim().toLowerCase();
          return hst && hst !== 'pendente';
        });
        return mudouStatus || temHorario || temHistorico;
      });
      if (!rotaIniciada) return;

      // Encontra o timestamp mais recente de alteração operacional
      let ultimoTimestamp = 0;
      let ultimoStatus = 'Em Trânsito';

      entregasDoVeiculo.forEach(e => {
        if (Array.isArray(e.historico) && e.historico.length > 0) {
          e.historico.forEach(h => {
            if (h.data) {
              const t = new Date(h.data).getTime();
              if (t > ultimoTimestamp) {
                ultimoTimestamp = t;
                ultimoStatus = h.status || e.status;
              }
            }
          });
        }
        if (e.horaSaida) {
          const t = new Date(e.horaSaida).getTime();
          if (t > ultimoTimestamp) {
            ultimoTimestamp = t;
            ultimoStatus = e.status;
          }
        }
        if (e.horaChegada) {
          const t = new Date(e.horaChegada).getTime();
          if (t > ultimoTimestamp) {
            ultimoTimestamp = t;
            ultimoStatus = e.status;
          }
        }
        if (ultimoTimestamp === 0 && e.atualizadoEm) {
          const t = new Date(e.atualizadoEm).getTime();
          if (t > ultimoTimestamp) {
            ultimoTimestamp = t;
            ultimoStatus = e.status;
          }
        }
      });

      if (ultimoTimestamp > 0) {
        const diffMinutos = Math.floor((agora - ultimoTimestamp) / 60000);
        if (diffMinutos >= 30) {
          alertas.push({
            placa: v.placa,
            motoristaNome: v.motoristaNome,
            minutos: diffMinutos,
            ultimoStatus: ultimoStatus || 'Em Rota',
            carga: v.carga || entregasDoVeiculo[0]?.carga || '',
            veiculoOriginal: v
          });
        }
      }
    });

    return alertas.sort((a, b) => b.minutos - a.minutos);
  }, [entregas, veiculos, agora]);

  // 2. Notificações Operacionais Pendentes
  const devolucoesPendentes = useMemo(() => {
    return (solicitacoesDevolucao || []).filter(s => 
      s && (s.status === 'Pendente' || s.status === 'Pendente de recebimento' || s.status === 'Confirmado pelo motorista')
    );
  }, [solicitacoesDevolucao]);

  const geolocPendentes = useMemo(() => {
    return (solicitacoesGeoloc || []).filter(s => s && s.status === 'Pendente');
  }, [solicitacoesGeoloc]);

  const despesasPendentes = useMemo(() => {
    return (despesas || []).filter(d => d && d.status === 'Pendente');
  }, [despesas]);

  const totalNotificacoesPendentes = devolucoesPendentes.length + geolocPendentes.length + despesasPendentes.length;

  return (
    <div className="space-y-3.5">
      {/* 1. NOTIFICAÇÕES OPERACIONAIS (POSICIONADA NO TOPO CONFORME SOLICITADO) */}
      <div className="bg-background-secondary rounded-2xl p-4 sm:p-5 border border-border-primary shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-5 rounded-full bg-rose-500 shrink-0" />
            <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
              <Bell size={16} className="text-rose-500" />
              Notificações Operacionais
            </h4>
          </div>
          {totalNotificacoesPendentes > 0 ? (
            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 animate-pulse">
              {totalNotificacoesPendentes} pendente(s)
            </span>
          ) : (
            <span className="text-xs font-mono font-semibold text-zinc-400">
              0 pendentes
            </span>
          )}
        </div>

        {totalNotificacoesPendentes === 0 ? (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 text-xs sm:text-sm">
            <CheckCircle2 size={18} className="shrink-0 text-emerald-500" />
            <span className="font-semibold">Nenhuma solicitação ou pendência aguardando atenção no momento.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs sm:text-sm">
            {/* Banner 1: Devoluções */}
            <div className={`p-3 rounded-xl border flex flex-col justify-between ${
              devolucoesPendentes.length > 0 
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300' 
                : 'bg-zinc-50 dark:bg-zinc-800/30 border-zinc-200/40 dark:border-zinc-800 text-zinc-400'
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold uppercase flex items-center gap-1.5">
                  <RotateCcw size={14} /> Devoluções
                </span>
                <span className="font-mono font-black text-base">
                  {devolucoesPendentes.length}
                </span>
              </div>
              <span className="text-[11px] sm:text-xs leading-tight opacity-85 font-medium">
                {devolucoesPendentes.length > 0 ? 'Aguardando validação de docas' : 'Nenhuma pendente'}
              </span>
            </div>

            {/* Banner 2: Geolocalização */}
            <div className={`p-3 rounded-xl border flex flex-col justify-between ${
              geolocPendentes.length > 0 
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300' 
                : 'bg-zinc-50 dark:bg-zinc-800/30 border-zinc-200/40 dark:border-zinc-800 text-zinc-400'
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold uppercase flex items-center gap-1.5">
                  <MapPin size={14} /> Pontos GPS
                </span>
                <span className="font-mono font-black text-base">
                  {geolocPendentes.length}
                </span>
              </div>
              <span className="text-[11px] sm:text-xs leading-tight opacity-85 font-medium">
                {geolocPendentes.length > 0 ? 'Solicitações de clientes' : 'Nenhuma pendente'}
              </span>
            </div>

            {/* Banner 3: Despesas */}
            <div className={`p-3 rounded-xl border flex flex-col justify-between ${
              despesasPendentes.length > 0 
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300' 
                : 'bg-zinc-50 dark:bg-zinc-800/30 border-zinc-200/40 dark:border-zinc-800 text-zinc-400'
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold uppercase flex items-center gap-1.5">
                  <DollarSign size={14} /> Despesas
                </span>
                <span className="font-mono font-black text-base">
                  {despesasPendentes.length}
                </span>
              </div>
              <span className="text-[11px] sm:text-xs leading-tight opacity-85 font-medium">
                {despesasPendentes.length > 0 ? 'Reembolsos em análise' : 'Nenhuma pendente'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 2. TEMPO SEM ATUALIZAÇÃO (SEM O ">30 MIN", FORMATO CARDS) */}
      <div className="bg-background-secondary rounded-2xl p-4 sm:p-5 border border-border-primary shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-5 rounded-full bg-amber-500 shrink-0" />
            <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
              <Clock size={16} className="text-amber-500" />
              Tempo sem Atualização
            </h4>
          </div>
          <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full ${
            carrosSemAtualizacao30Min.length > 0 
              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30' 
              : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
          }`}>
            {carrosSemAtualizacao30Min.length} veículo(s)
          </span>
        </div>

        {carrosSemAtualizacao30Min.length === 0 ? (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs sm:text-sm">
            <CheckCircle2 size={18} className="shrink-0 text-emerald-500" />
            <span className="font-semibold">
              Todos os veículos com rotas ativas registraram check-in recentemente ou aguardam início de rota.
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
            {carrosSemAtualizacao30Min.map((item, idx) => {
              const formatarTempo = (m) => {
                const h = Math.floor(m / 60);
                const r = m % 60;
                if (h > 0) return `${h}h ${r}min`;
                return `${r} min`;
              };

              return (
                <div
                  key={idx}
                  onClick={() => onSelectVeiculo && onSelectVeiculo(item.veiculoOriginal)}
                  className="flex flex-col justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 hover:bg-rose-500/10 dark:hover:bg-rose-500/10 border border-rose-500/25 hover:border-rose-500/40 transition-all cursor-pointer group shadow-2xs"
                  title="Clique para destacar este veículo no painel superior"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
                      <span className="font-mono font-black text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-rose-500 transition-colors">
                        {item.placa}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono font-black px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25">
                      há {formatarTempo(item.minutos)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-1.5 mt-1 text-xs">
                    <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-300 truncate max-w-[120px]">
                      {item.motoristaNome ? item.motoristaNome : (item.carga ? `Carga ${item.carga}` : 'Motorista')}
                    </span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-zinc-200 dark:bg-zinc-700/80 text-zinc-800 dark:text-zinc-200 shrink-0">
                      {item.ultimoStatus}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
