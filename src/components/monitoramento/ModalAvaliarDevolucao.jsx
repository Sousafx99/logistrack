import { useState, useEffect, useMemo } from 'react';
import { 
  X, CheckCircle, AlertTriangle, RotateCcw, Package, 
  User, Truck, Hash, MapPin, Clock, Edit2, ShieldAlert, 
  ArrowRight, Check, Ban, AlertCircle, FileText
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { MOTIVOS_DEVOLUCAO, TRATAMENTO_MERCADORIA, STATUS_DEVOLUCAO_GERAL, getTipoDevolucaoBadge } from '../../data/mockData';
import { cn } from '../../lib/utils';

const formatarDataHora = (isoStr) => {
  if (!isoStr) return '--/-- --:--';
  try {
    const d = new Date(isoStr);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    const hora = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${ano} às ${hora}:${min}`;
  } catch {
    return '--/-- --:--';
  }
};

export function ModalAvaliarDevolucao({ 
  isOpen, 
  onClose, 
  placa, 
  solicitacaoId,
  solicitacaoInicialId 
}) {
  const { solicitacoesDevolucao = [], avaliarSolicitacaoDevolucao, currentUser } = useStore();

  const idAlvo = solicitacaoId || solicitacaoInicialId;
  const solicEspecifica = idAlvo 
    ? (solicitacoesDevolucao || []).find(s => s.id === idAlvo) 
    : null;

  // Se a solicitação informada já foi tratada, abre em modo histórico/ficha
  const isHistorico = solicEspecifica && solicEspecifica.statusSolicitacao !== 'Pendente';

  // Filtrar solicitações pendentes deste veículo (ou todas se placa não for especificada)
  const solicitacoesPendentes = useMemo(() => {
    return (solicitacoesDevolucao || []).filter(s => {
      const isPendente = s.statusSolicitacao === 'Pendente';
      if (!placa) return isPendente;
      return isPendente && s.placa === placa;
    });
  }, [solicitacoesDevolucao, placa]);

  const [solicIndex, setSolicIndex] = useState(0);
  const [modoAlteracao, setModoAlteracao] = useState(false);
  const [modoRejeicao, setModoRejeicao] = useState(false);
  const [processando, setProcessando] = useState(false);

  // Form State para Alterar e Aprovar
  const [tipoSelecionado, setTipoSelecionado] = useState('Total');
  const [motivoSelecionado, setMotivoSelecionado] = useState('');
  const [tratamentoSelecionado, setTratamentoSelecionado] = useState('Aguardando definição');
  const [obsMonitoramento, setObsMonitoramento] = useState('');
  const [motivoRecusa, setMotivoRecusa] = useState('');

  // Sincronizar solicitação selecionada
  useEffect(() => {
    if (idAlvo && !isHistorico) {
      const idx = solicitacoesPendentes.findIndex(s => s.id === idAlvo);
      if (idx >= 0) setSolicIndex(idx);
    } else {
      setSolicIndex(0);
    }
  }, [idAlvo, solicitacoesPendentes.length, isHistorico]);

  const solicAtual = isHistorico ? solicEspecifica : (solicEspecifica || solicitacoesPendentes[solicIndex] || null);

  useEffect(() => {
    if (solicAtual && !isHistorico) {
      setTipoSelecionado(solicAtual.tipo || 'Total');
      setMotivoSelecionado(solicAtual.motivo || '');
      setTratamentoSelecionado('Aguardando definição');
      setObsMonitoramento('');
      setMotivoRecusa('');
      setModoAlteracao(false);
      setModoRejeicao(false);
    }
  }, [solicAtual?.id, isHistorico]);

  if (!isOpen || !solicAtual) {
    if (isOpen && solicitacoesPendentes.length === 0 && !isHistorico) {
      return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background-primary border border-border-secondary rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-success/15 text-success flex items-center justify-center mx-auto">
              <CheckCircle size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-text-primary">Nenhuma Solicitação Pendente</h3>
              <p className="text-xs text-text-tertiary mt-1">Todas as ocorrências deste veículo já foram avaliadas pelo monitoramento.</p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-info text-white font-bold rounded-xl text-xs hover:bg-info/90 transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      );
    }
    return null;
  }

  const badgeInfo = getTipoDevolucaoBadge(solicAtual.tipo);
  const badgeInfoNovo = getTipoDevolucaoBadge(tipoSelecionado);

  const handleAprovarDireto = async () => {
    try {
      setProcessando(true);
      await avaliarSolicitacaoDevolucao(solicAtual.id, {
        decisao: 'aprovar',
        tipoFinal: solicAtual.tipo,
        motivoFinal: solicAtual.motivo,
        tratamentoFinal: 'Aguardando definição'
      });

      if (solicitacoesPendentes.length <= 1) {
        onClose();
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao aprovar solicitação.');
    } finally {
      setProcessando(false);
    }
  };

  const handleAlterarEAprovar = async () => {
    try {
      setProcessando(true);
      await avaliarSolicitacaoDevolucao(solicAtual.id, {
        decisao: 'alterar_e_aprovar',
        tipoFinal: tipoSelecionado,
        motivoFinal: motivoSelecionado || solicAtual.motivo,
        tratamentoFinal: tratamentoSelecionado,
        observacaoMonitoramento: obsMonitoramento
      });

      if (solicitacoesPendentes.length <= 1) {
        onClose();
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao alterar e aprovar solicitação.');
    } finally {
      setProcessando(false);
    }
  };

  const handleRejeitar = async () => {
    try {
      setProcessando(true);
      await avaliarSolicitacaoDevolucao(solicAtual.id, {
        decisao: 'rejeitar',
        observacaoMonitoramento: motivoRecusa || 'Solicitação de devolução recusada pelo Monitoramento. Entrega mantida como pendente.'
      });

      if (solicitacoesPendentes.length <= 1) {
        onClose();
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao rejeitar solicitação.');
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-background-primary w-full max-w-2xl rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-border-secondary my-auto flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        
        {/* Header do Modal */}
        <div className="px-5 py-4 border-b border-border-tertiary flex justify-between items-center bg-background-secondary flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center font-bold border",
              solicAtual.statusSolicitacao === 'Recusado' || solicAtual.statusSolicitacao === 'Recusada'
                ? "bg-rose-500/15 text-rose-500 border-rose-500/20"
                : solicAtual.statusSolicitacao === 'Alterado e Aprovado' || solicAtual.statusSolicitacao === 'Alterada'
                  ? "bg-blue-500/15 text-blue-500 border-blue-500/20"
                  : isHistorico
                    ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/20"
                    : "bg-rose-500/15 text-rose-500 border-rose-500/20"
            )}>
              {isHistorico ? <FileText size={20} /> : <RotateCcw size={20} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base text-text-primary">
                  {isHistorico ? 'Ficha da Solicitação de Ocorrência' : 'Solicitação de Ocorrência / Devolução'}
                </h3>
                {!isHistorico && solicitacoesPendentes.length > 1 && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-danger text-white">
                    {solicIndex + 1} de {solicitacoesPendentes.length}
                  </span>
                )}
                {isHistorico && (
                  <span className={cn(
                    "text-[10px] font-black uppercase px-2 py-0.5 rounded-full border",
                    solicAtual.statusSolicitacao === 'Recusado' || solicAtual.statusSolicitacao === 'Recusada'
                      ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                      : solicAtual.statusSolicitacao === 'Alterado e Aprovado' || solicAtual.statusSolicitacao === 'Alterada'
                        ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                        : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  )}>
                    {solicAtual.statusSolicitacao}
                  </span>
                )}
              </div>
              <p className="text-xs text-text-tertiary">
                {isHistorico ? 'Histórico e dados operacionais da solicitação' : 'Avalie e defina a decisão operacional para a entrega'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-xl hover:bg-background-tertiary text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Abas se houver mais de 1 solicitação pendente no modo avaliação */}
        {!isHistorico && solicitacoesPendentes.length > 1 && (
          <div className="flex items-center gap-1 px-5 pt-3 pb-1 border-b border-border-secondary/60 bg-background-secondary/30 overflow-x-auto">
            {solicitacoesPendentes.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setSolicIndex(idx)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer",
                  idx === solicIndex 
                    ? "bg-info text-white shadow-sm" 
                    : "bg-background-primary text-text-secondary border border-border-tertiary hover:text-text-primary"
                )}
              >
                <span>NF: {s.nota}</span>
                <span className="text-[9px] opacity-80 uppercase">({s.tipo})</span>
              </button>
            ))}
          </div>
        )}

        {/* Conteúdo da Solicitação */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
          
          {/* Cartão de Resumo do Motorista e Veículo */}
          <div className="p-3.5 rounded-2xl bg-background-secondary border border-border-secondary flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-background-primary border border-border-secondary flex items-center justify-center text-info font-mono font-bold">
                <Truck size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider font-mono bg-background-primary px-2 py-0.5 rounded border border-border-secondary text-text-primary">
                    {solicAtual.placa}
                  </span>
                  {solicAtual.carga && (
                    <span className="text-[11px] font-bold text-text-tertiary">
                      Carga: {solicAtual.carga}
                    </span>
                  )}
                </div>
                {solicAtual.motoristaNome && (
                  <p className="text-xs font-semibold text-text-secondary mt-0.5">
                    Motorista: {solicAtual.motoristaNome}
                  </p>
                )}
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-text-tertiary block">
                Solicitado em:
              </span>
              <span className="text-xs font-bold text-text-primary font-mono">
                {solicAtual.criadoEm ? formatarDataHora(solicAtual.criadoEm) : formatarDataHora(solicAtual.data)}
              </span>
            </div>
          </div>

          {/* Dados da Nota Fiscal e Cliente */}
          <div className="p-4 rounded-2xl bg-background-primary border border-border-secondary space-y-3">
            <div className="flex items-start justify-between gap-2 border-b border-border-tertiary pb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base font-black text-text-primary font-mono">
                    NF: {solicAtual.nota}
                  </span>
                  <span className={cn("text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md shadow-sm tracking-wider flex items-center gap-1", badgeInfo.badgeClass)}>
                    <RotateCcw size={10} strokeWidth={2.5} />
                    {badgeInfo.label}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-text-primary leading-tight">
                  {solicAtual.cliente}
                </h4>
                <div className="flex flex-wrap gap-2 text-xs text-text-secondary mt-1 font-medium">
                  {solicAtual.codCliente && (
                    <span className="flex items-center"><Hash size={12} className="mr-0.5 text-info" /> Cód: {solicAtual.codCliente}</span>
                  )}
                  {solicAtual.bairro && (
                    <span className="flex items-center"><MapPin size={12} className="mr-0.5 text-warning" /> {solicAtual.bairro} {solicAtual.cidade ? `- ${solicAtual.cidade}` : ''}</span>
                  )}
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] uppercase font-bold text-text-tertiary block">Peso Informado:</span>
                <span className="text-base font-black text-danger">
                  {(Number(solicAtual.pesoTotalDevolvido) || 0).toFixed(3)} <span className="text-[10px] font-bold text-text-tertiary">kg</span>
                </span>
              </div>
            </div>

            {/* Motivo Informado pelo Motorista */}
            <div className="p-3 rounded-xl bg-background-secondary/70 border border-border-tertiary text-xs">
              <span className="text-[10px] font-black uppercase text-text-tertiary block mb-1">
                Motivo / Justificativa do Motorista:
              </span>
              <p className="text-text-primary font-semibold italic">
                "{solicAtual.motivo || 'Motivo não detalhado'}"
              </p>
            </div>

            {/* Itens Devolvidos se houver */}
            {solicAtual.itensDevolvidos && solicAtual.itensDevolvidos.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-text-secondary flex items-center gap-1.5">
                  <Package size={13} className="text-info" /> Itens Marcados para Devolução ({solicAtual.itensDevolvidos.length}):
                </span>
                <div className="max-h-36 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {solicAtual.itensDevolvidos.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 rounded-lg bg-background-secondary text-xs border border-border-tertiary">
                      <div className="min-w-0 flex-1 pr-2">
                        <span className="font-bold text-text-primary block truncate">
                          {item.codigo ? `[${item.codigo}] ` : ''}{item.descricao}
                        </span>
                      </div>
                      <div className="text-right shrink-0 font-mono font-bold text-text-secondary text-[11px]">
                        <span>{item.qtd} cx</span>
                        {item.peso > 0 && <span> • {Number(item.peso).toFixed(3)} kg</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Card de Resolução e Decisão do Monitoramento (Exibido quando em modo Ficha / Histórico) */}
          {isHistorico && (
            <div className={cn(
              "p-4 rounded-2xl border space-y-3",
              solicAtual.statusSolicitacao === 'Recusado' || solicAtual.statusSolicitacao === 'Recusada'
                ? "bg-rose-500/10 border-rose-500/30"
                : "bg-emerald-500/10 border-emerald-500/30"
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={16} className={solicAtual.statusSolicitacao === 'Recusado' ? "text-rose-400" : "text-emerald-400"} />
                  <span className="text-xs font-black uppercase text-text-primary">
                    Decisão do Monitoramento:
                  </span>
                  <span className={cn(
                    "text-[10px] font-black uppercase px-2 py-0.5 rounded-md border",
                    solicAtual.statusSolicitacao === 'Recusado' || solicAtual.statusSolicitacao === 'Recusada'
                      ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                      : solicAtual.statusSolicitacao === 'Alterado e Aprovado' || solicAtual.statusSolicitacao === 'Alterada'
                        ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                        : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  )}>
                    {solicAtual.statusSolicitacao}
                  </span>
                </div>
                {solicAtual.respondidoEm && (
                  <span className="text-[10px] text-text-tertiary font-medium">
                    {formatarDataHora(solicAtual.respondidoEm)}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {solicAtual.statusAprovado && (
                  <div className="p-2.5 rounded-xl bg-background-primary/80 border border-border-tertiary">
                    <span className="text-[10px] font-bold text-text-tertiary uppercase block">Status Aplicado na Rota:</span>
                    <span className="font-black text-text-primary mt-0.5 block">{solicAtual.statusAprovado}</span>
                  </div>
                )}
                {solicAtual.tratamento && (
                  <div className="p-2.5 rounded-xl bg-background-primary/80 border border-border-tertiary">
                    <span className="text-[10px] font-bold text-text-tertiary uppercase block">Tratamento da Mercadoria:</span>
                    <span className="font-black text-info mt-0.5 block">{solicAtual.tratamento}</span>
                  </div>
                )}
              </div>

              {solicAtual.observacaoMonitoramento && (
                <div className="p-2.5 rounded-xl bg-background-primary/80 border border-border-tertiary text-xs">
                  <span className="text-[10px] font-bold text-text-tertiary uppercase block mb-0.5">Observação / Justificativa:</span>
                  <p className="text-text-primary italic font-medium">"{solicAtual.observacaoMonitoramento}"</p>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-border-tertiary/40 text-[10px] text-text-tertiary">
                <span className="flex items-center gap-1">
                  <Clock size={11} className="text-info" />
                  Disponível por 24h a partir do atendimento
                </span>
                {solicAtual.respondidoPor && (
                  <p>
                    Respondido por: <strong className="text-text-secondary">{solicAtual.respondidoPor}</strong>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Painel de Rejeição (se clicou em Rejeitar) */}
          {!isHistorico && modoRejeicao && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-3 animate-in fade-in">
              <div className="flex items-center gap-2 text-rose-500 font-bold text-sm">
                <Ban size={16} />
                <span>Rejeitar Solicitação de Devolução</span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Ao rejeitar, a ocorrência não será gravada e a entrega permanecerá na rota do motorista como <strong>Pendente</strong> para nova tentativa ou resolução.
              </p>
              <div>
                <label className="block text-[11px] font-bold text-text-secondary mb-1">
                  Motivo da Recusa (opcional para feedback ao motorista):
                </label>
                <textarea
                  value={motivoRecusa}
                  onChange={(e) => setMotivoRecusa(e.target.value)}
                  placeholder="Ex: Cliente aceitou receber a mercadoria; prosseguir com a descarga..."
                  className="w-full bg-background-primary border border-border-secondary rounded-xl p-2.5 text-xs text-text-primary focus:outline-none focus:border-rose-500 h-20 resize-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setModoRejeicao(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-text-tertiary hover:bg-background-secondary transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleRejeitar}
                  disabled={processando}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-danger hover:bg-danger/90 text-white shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Ban size={14} />
                  <span>Confirmar Recusa</span>
                </button>
              </div>
            </div>
          )}

          {/* Painel de Alteração (se clicou em Alterar e Aprovar) */}
          {!isHistorico && modoAlteracao && (
            <div className="p-4 rounded-2xl bg-info/10 border border-info/30 space-y-3 animate-in fade-in">
              <div className="flex items-center gap-2 text-info font-bold text-sm">
                <Edit2 size={16} />
                <span>Ajustar Decisão e Aprovar</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">Tipo de Ocorrência Final</label>
                  <select
                    value={tipoSelecionado}
                    onChange={(e) => setTipoSelecionado(e.target.value)}
                    className="w-full bg-background-primary border border-border-secondary rounded-xl p-2 text-xs font-bold text-text-primary focus:outline-none focus:border-info"
                  >
                    <option value="Total">Devolução Total</option>
                    <option value="Parcial">Entrega Parcial</option>
                    <option value="Reentrega">Reentrega</option>
                    <option value="Devolução de gramatura">Devolução de gramatura</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">Tratamento da Mercadoria</label>
                  <select
                    value={tratamentoSelecionado}
                    onChange={(e) => setTratamentoSelecionado(e.target.value)}
                    className="w-full bg-background-primary border border-border-secondary rounded-xl p-2 text-xs font-bold text-text-primary focus:outline-none focus:border-info"
                  >
                    {TRATAMENTO_MERCADORIA.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">Motivo Oficial</label>
                <select
                  value={motivoSelecionado}
                  onChange={(e) => setMotivoSelecionado(e.target.value)}
                  className="w-full bg-background-primary border border-border-secondary rounded-xl p-2 text-xs font-medium text-text-primary focus:outline-none focus:border-info"
                >
                  <option value="" disabled>Selecione um motivo...</option>
                  {MOTIVOS_DEVOLUCAO.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">Observação do Monitoramento</label>
                <input
                  type="text"
                  value={obsMonitoramento}
                  onChange={(e) => setObsMonitoramento(e.target.value)}
                  placeholder="Ex: Autorizado reagendamento para amanhã..."
                  className="w-full bg-background-primary border border-border-secondary rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-info"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setModoAlteracao(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-text-tertiary hover:bg-background-secondary transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAlterarEAprovar}
                  disabled={processando}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-info hover:bg-info/90 text-white shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Check size={14} />
                  <span>Aprovar com Ajustes</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer com Botões de Ação */}
        {isHistorico ? (
          <div className="p-4 sm:p-5 border-t border-border-secondary bg-background-secondary/70 flex justify-end flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-background-primary hover:bg-background-tertiary border border-border-secondary text-text-primary text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
            >
              Fechar Ficha
            </button>
          </div>
        ) : !modoAlteracao && !modoRejeicao ? (
          <div className="p-4 sm:p-5 border-t border-border-secondary bg-background-secondary/70 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
            
            {/* Ação de Rejeição */}
            <button
              type="button"
              onClick={() => setModoRejeicao(true)}
              disabled={processando}
              className="px-4 py-2.5 rounded-xl border border-danger/30 text-danger hover:bg-danger/10 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Ban size={15} />
              <span>Rejeitar</span>
            </button>

            {/* Ações de Aprovação */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setModoAlteracao(true)}
                disabled={processando}
                className="px-4 py-2.5 rounded-xl border border-info/40 bg-info/5 hover:bg-info/15 text-info text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Edit2 size={14} />
                <span>Mudar Status / Tipo</span>
              </button>

              <button
                type="button"
                onClick={handleAprovarDireto}
                disabled={processando}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-2 active:scale-95"
              >
                <CheckCircle size={16} />
                <span>Aprovar {badgeInfo.label}</span>
              </button>
            </div>
          </div>
        ) : null}

      </div>
    </div>
  );
}

