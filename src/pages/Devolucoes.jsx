import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Plus, RotateCcw, Search, Trash2, Edit2, Filter, Clock, User, Printer, Mail, ChevronDown, ChevronUp, Hash, MapPin } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Badge } from '../components/ui/Badge';
import { MOTIVOS_DEVOLUCAO, STATUS_DEVOLUCAO_GERAL, STATUS_DEVOLUCAO_MONITORAMENTO, TRATAMENTO_MERCADORIA } from '../data/mockData';
import { cn } from '../lib/utils';

export function Devolucoes() {
  const { devolucoes, entregas, adicionarDevolucao, atualizarStatusDevolucao, removerDevolucao, editarDevolucao, currentUser } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [editandoDevolucao, setEditandoDevolucao] = useState(null);
  
  // Novos modais
  const [alterandoStatus, setAlterandoStatus] = useState(null);
  const [verHistorico, setVerHistorico] = useState(null);
  const [novaObservacaoStatus, setNovaObservacaoStatus] = useState('');
  const [novoStatusSelecionado, setNovoStatusSelecionado] = useState('');
  const [novoTratamentoSelecionado, setNovoTratamentoSelecionado] = useState('');
  const [clientesExpandidos, setClientesExpandidos] = useState({});
  const [alterandoStatusGrupo, setAlterandoStatusGrupo] = useState(null);
  const [editandoMotivoGrupo, setEditandoMotivoGrupo] = useState(null);

  const toggleCliente = (id) => setClientesExpandidos(prev => ({...prev, [id]: !prev[id]}));

  const { globalFilters, setGlobalFilters } = useStore();
  
  const busca = globalFilters.devolucoes.busca;
  const dataSelecionada = globalFilters.data;
  const placaSelecionada = globalFilters.devolucoes.placa;
  const statusSelecionado = globalFilters.devolucoes.status;

  const setBusca = (val) => setGlobalFilters({ devolucoes: { ...globalFilters.devolucoes, busca: val }});
  const setDataSelecionada = (val) => setGlobalFilters({ data: val });
  const setPlacaSelecionada = (val) => setGlobalFilters({ devolucoes: { ...globalFilters.devolucoes, placa: val }});
  const setStatusSelecionado = (val) => setGlobalFilters({ devolucoes: { ...globalFilters.devolucoes, status: val }});

  // Form State
  const [novaDevolucao, setNovaDevolucao] = useState({
    nota: '',
    tipo: 'Total',
    quantidadeKg: '',
    status: 'Pendente de recebimento',
    tratamento: 'Aguardando definição',
    observacao: ''
  });

  const placasDisponiveis = useMemo(() => {
    const plates = new Set(devolucoes.filter(d => d.data.startsWith(dataSelecionada)).map(d => d.placa).filter(Boolean));
    return Array.from(plates).sort();
  }, [devolucoes, dataSelecionada]);

  const devolucoesFiltradas = useMemo(() => {
    return devolucoes.filter(d => {
      const matchData = d.data.startsWith(dataSelecionada);
      const matchPlaca = placaSelecionada ? d.placa === placaSelecionada : true;
      const matchStatus = statusSelecionado ? d.status === statusSelecionado : true;
      const term = busca.toLowerCase();
      const matchBusca = term ? (d.nota.includes(term) || d.status.toLowerCase().includes(term) || (d.placa && d.placa.toLowerCase().includes(term))) : true;
      
      return matchData && matchPlaca && matchStatus && matchBusca;
    });
  }, [devolucoes, dataSelecionada, placaSelecionada, statusSelecionado, busca]);

  const clientesAgrupados = useMemo(() => {
    const map = new Map();
    devolucoesFiltradas.forEach(dev => {
      // Cruzar dados com as entregas para extrair informações do cliente
      const entrega = entregas.find(e => String(e.nota) === String(dev.nota));
      const cliente = entrega?.cliente || 'CLIENTE DESCONHECIDO';
      const codCliente = entrega?.codCliente || '';
      const bairro = entrega?.bairro || '';
      const placa = dev.placa || entrega?.placa || 'SEM PLACA';
      
      const key = `${placa}-${codCliente}-${cliente}`;
      
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          cliente,
          codCliente,
          bairro,
          placa,
          devolucoes: []
        });
      }
      map.get(key).devolucoes.push(dev);
    });

    const result = Array.from(map.values());
    
    // Ordenar devoluções internas por número da nota
    result.forEach(grupo => {
      grupo.devolucoes.sort((a, b) => (Number(a.nota) || 0) - (Number(b.nota) || 0));
    });

    // Ordenar os grupos pela primeira nota fiscal do grupo
    return result.sort((a, b) => {
      const minA = a.devolucoes[0] ? (Number(a.devolucoes[0].nota) || 0) : 0;
      const minB = b.devolucoes[0] ? (Number(b.devolucoes[0].nota) || 0) : 0;
      return minA - minB;
    });
  }, [devolucoesFiltradas, entregas]);

  const handleSubmit = (e) => {
    e.preventDefault();
    adicionarDevolucao({
      ...novaDevolucao,
      quantidadeKg: parseFloat(novaDevolucao.quantidadeKg)
    });
    setShowModal(false);
    setNovaDevolucao({
      nota: '', tipo: 'Total', quantidadeKg: '', status: 'Pendente de recebimento', tratamento: 'Aguardando definição', observacao: ''
    });
  };

  const handleDelete = (id) => {
    if (confirm("Tem certeza que deseja remover este lançamento de devolução?")) {
      removerDevolucao(id);
    }
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    editarDevolucao(editandoDevolucao.id, {
      observacao: editandoDevolucao.observacao,
    });
    setEditandoDevolucao(null);
  };

  const handleStatusSubmit = (e) => {
    e.preventDefault();
    if (novoStatusSelecionado || novoTratamentoSelecionado) {
      atualizarStatusDevolucao(alterandoStatus.id, novoStatusSelecionado || alterandoStatus.status, novaObservacaoStatus, novoTratamentoSelecionado || alterandoStatus.tratamento);
    }
    setAlterandoStatus(null);
    setNovaObservacaoStatus('');
    setNovoStatusSelecionado('');
    setNovoTratamentoSelecionado('');
  };

  const handleEditSubmitGrupo = async (e) => {
    e.preventDefault();
    await Promise.all(editandoMotivoGrupo.devolucoes.map(dev => 
      editarDevolucao(dev.id, { observacao: editandoMotivoGrupo.observacao })
    ));
    setEditandoMotivoGrupo(null);
  };

  const handleStatusSubmitGrupo = async (e) => {
    e.preventDefault();
    if (novoStatusSelecionado || novoTratamentoSelecionado) {
      await Promise.all(alterandoStatusGrupo.devolucoes.map(dev => 
        atualizarStatusDevolucao(
          dev.id, 
          novoStatusSelecionado || dev.status, 
          novaObservacaoStatus, 
          novoTratamentoSelecionado || dev.tratamento
        )
      ));
    }
    setAlterandoStatusGrupo(null);
    setNovaObservacaoStatus('');
    setNovoStatusSelecionado('');
    setNovoTratamentoSelecionado('');
  };

  const handleSendEmail = (dev) => {
    // Tentar achar a entrega para pegar dados do cliente
    const entrega = entregas.find(e => String(e.nota) === String(dev.nota));
    const codCliente = entrega?.codCliente || 'N/A';
    const nomeCliente = entrega?.cliente || 'N/A';
    
    let statusNota = entrega?.status;
    if (!statusNota) {
      if (dev.tipo === 'Total') statusNota = 'Devolução total';
      else if (dev.tipo === 'Parcial') statusNota = 'Entrega parcial';
      else statusNota = dev.tipo;
    }

    // Saudação baseada no horário
    const hora = new Date().getHours();
    let saudacao = 'Bom dia!';
    if (hora >= 12 && hora < 18) saudacao = 'Boa tarde!';
    else if (hora >= 18) saudacao = 'Boa noite!';

    const assunto = `OCORRÊNCIA - CLIENTE ${codCliente} - NF ${dev.nota}`;
    const corpo = `${saudacao}\n\nPara ciência:\nCliente: ${nomeCliente}\nStatus: ${statusNota}\nMotivo: ${dev.observacao || 'Não informado'}`;

    const mailUrl = `https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=&su=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
    window.open(mailUrl, '_blank', 'noopener,noreferrer');
  };

  const handleSendEmailGrupo = (grupo) => {
    const notasStr = grupo.devolucoes.map(d => d.nota).join('/');
    
    const hora = new Date().getHours();
    let saudacao = 'Bom dia!';
    if (hora >= 12 && hora < 18) saudacao = 'Boa tarde!';
    else if (hora >= 18) saudacao = 'Boa noite!';

    const assunto = `OCORRência - CLIENTE ${grupo.codCliente || 'S/N'} - NF ${notasStr}`;
    
    let detalhesNfs = grupo.devolucoes.map(dev => {
      const entrega = entregas.find(e => String(e.nota) === String(dev.nota));
      let statusNota = entrega?.status;
      if (!statusNota) {
        if (dev.tipo === 'Total') statusNota = 'Devolução total';
        else if (dev.tipo === 'Parcial') statusNota = 'Entrega parcial';
        else statusNota = dev.tipo;
      }
      return `* NF ${dev.nota} - Status: ${statusNota} - Motivo: ${dev.observacao || 'Não informado'}`;
    }).join('\n');

    const corpo = `${saudacao}\n\nPara ciência:\nCliente: ${grupo.cliente}\nNotas: ${grupo.devolucoes.map(d => d.nota).join(', ')}\n\nDetalhes por NF:\n${detalhesNfs}`;

    const mailUrl = `https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=&su=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
    window.open(mailUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Devoluções</h2>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-info text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center shadow-sm"
        >
          <Plus size={16} className="mr-1" /> Nova
        </button>
      </div>

      {/* Filtros */}
      <div className="glass-panel p-4 rounded-xl space-y-3">
        <div className="flex items-center text-xs uppercase font-bold text-text-tertiary mb-2">
          <Filter size={14} className="mr-1" /> Filtros
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-text-tertiary mb-1">Data</label>
            <input 
              type="date" 
              value={dataSelecionada}
              onChange={(e) => { setDataSelecionada(e.target.value); setPlacaSelecionada(''); }}
              className="w-full bg-background-primary border border-border-secondary rounded-lg px-3 py-2 text-sm focus:ring-info font-bold"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-text-tertiary mb-1">Placa</label>
            <select 
              value={placaSelecionada}
              onChange={(e) => setPlacaSelecionada(e.target.value)}
              className="w-full bg-background-primary border border-border-secondary rounded-lg px-3 py-2 text-sm focus:ring-info font-bold"
            >
              <option value="">Todas as Placas</option>
              {placasDisponiveis.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-text-tertiary mb-1">Status</label>
            <select 
              value={statusSelecionado}
              onChange={(e) => setStatusSelecionado(e.target.value)}
              className="w-full bg-background-primary border border-border-secondary rounded-lg px-3 py-2 text-sm focus:ring-info font-bold"
            >
              <option value="">Todos</option>
              {STATUS_DEVOLUCAO_GERAL.map(s => <option key={s} value={s}>{s}</option>)}
              {currentUser?.role === 'Monitoramento' && STATUS_DEVOLUCAO_MONITORAMENTO.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="relative mt-2">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input 
            type="text" 
            placeholder="Buscar por NF, Placa..." 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-background-primary border border-border-secondary rounded-xl pl-10 pr-4 py-2 text-sm shadow-sm"
          />
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {clientesAgrupados.length === 0 ? (
          <div className="text-center text-text-tertiary py-8 glass-panel rounded-xl">
            <RotateCcw className="mx-auto h-10 w-10 mb-2 opacity-50" />
            <p>Nenhuma devolução encontrada.</p>
          </div>
        ) : (
          clientesAgrupados.map(grupo => {
            const isExpanded = !!clientesExpandidos[grupo.id];
            const pesoTotal = grupo.devolucoes.reduce((acc, curr) => acc + (Number(curr.quantidadeKg) || 0), 0);
            
            return (
              <div key={grupo.id} className="glass-panel rounded-xl transition-all overflow-hidden border border-border-secondary">
                {/* Cabeçalho do Cliente */}
                <div 
                  onClick={() => toggleCliente(grupo.id)}
                  className="bg-background-secondary/50 p-4 border-b border-border-secondary flex justify-between items-start cursor-pointer hover:bg-background-secondary/70 transition-colors"
                >
                   <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-bold bg-background-primary px-2 py-0.5 rounded text-text-secondary border border-border-tertiary shadow-sm">
                          {grupo.placa}
                        </span>
                      </div>
                      <h3 className="font-bold text-text-primary text-base leading-tight mb-1">{grupo.cliente}</h3>
                      <div className="flex flex-wrap gap-2 text-xs text-text-secondary mt-2">
                        <div className="flex items-center"><Hash size={14} className="mr-1 opacity-70 text-info" /> {grupo.codCliente || 'S/N'}</div>
                        <div className="flex items-center"><MapPin size={14} className="mr-1 opacity-70 text-warning" /> {grupo.bairro || 'S/N'}</div>
                      </div>
                   </div>
                   <div className="flex flex-col items-end gap-2 shrink-0 pl-2">
                      <div className="text-right flex flex-col items-end">
                        <span className="block font-black text-danger text-lg leading-none">{pesoTotal.toFixed(3)} <span className="text-[10px] font-bold text-text-tertiary">kg</span></span>
                        <span className="text-[10px] uppercase font-bold text-text-tertiary mt-1">{grupo.devolucoes.length} {grupo.devolucoes.length === 1 ? 'nota' : 'notas'}</span>
                      </div>
                      
                      <div className="flex items-center gap-1.5 mt-1" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => handleSendEmailGrupo(grupo)} className="bg-background-primary border border-border-secondary text-text-tertiary hover:text-info p-1.5 rounded-lg transition-colors" title="E-mail do Grupo"><Mail size={14} /></button>
                        {currentUser?.role !== 'Operacao' && (
                          <button onClick={() => setEditandoMotivoGrupo({...grupo, observacao: ''})} className="bg-background-primary border border-border-secondary text-info hover:text-info/80 p-1.5 rounded-lg transition-colors" title="Editar Motivo Geral"><Edit2 size={14} /></button>
                        )}
                        <button onClick={() => { setAlterandoStatusGrupo(grupo); setNovoStatusSelecionado(''); setNovoTratamentoSelecionado(''); }} className="bg-info/10 text-info hover:bg-info/20 border border-info/20 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors uppercase flex items-center h-[28px]" title="Mudar Status Geral">Status</button>
                        
                        <div className="bg-background-primary p-1 rounded-md border border-border-tertiary ml-1 h-[28px] w-[28px] flex items-center justify-center cursor-pointer pointer-events-none">
                          {isExpanded ? <ChevronUp size={16} className="text-text-primary" /> : <ChevronDown size={16} className="text-text-primary" />}
                        </div>
                      </div>
                   </div>
                </div>

                {/* Lista de Notas Fiscais (Devoluções) */}
                {isExpanded && (
                  <div className="p-3 space-y-3 bg-background-primary/30">
                    {grupo.devolucoes.map(dev => (
                      <div key={dev.id} className={cn("bg-background-secondary rounded-lg p-3 border", dev.tipo === 'Reentrega' ? 'border-warning/50 shadow-sm' : 'border-border-tertiary')}>
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-bold text-text-primary text-sm mb-1">NF: {dev.nota}</h4>
                            <p className="text-[10px] text-text-secondary">{new Date(dev.data).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
                          </div>
                          <div className="text-right flex flex-col items-end">
                            <div className="flex gap-3 mb-2 items-center bg-background-primary rounded-lg px-2 py-1 border border-border-secondary">
                              <button onClick={() => handleSendEmail(dev)} className="text-text-tertiary hover:text-info transition-colors" title="Enviar E-mail (Gmail)"><Mail size={14} /></button>
                              <button onClick={() => window.open(`/imprimir-guia/${dev.id}`, '_blank')} className="text-text-tertiary hover:text-text-primary transition-colors" title="Imprimir Guia"><Printer size={14} /></button>
                              {currentUser?.role !== 'Operacao' && (
                                <button onClick={() => setEditandoDevolucao(dev)} className="text-info hover:text-info/80 transition-colors" title="Editar Motivo"><Edit2 size={14} /></button>
                              )}
                              <button onClick={() => setVerHistorico(dev)} className="text-text-tertiary hover:text-text-primary transition-colors" title="Histórico"><Clock size={14} /></button>
                              <button onClick={() => handleDelete(dev.id)} className="text-danger hover:text-danger/80 transition-colors" title="Excluir"><Trash2 size={14} /></button>
                            </div>
                            <span className="block font-bold text-danger text-xs">{(dev.quantidadeKg || 0).toFixed(3)} kg</span>
                            <span className="text-[10px] text-text-tertiary font-bold uppercase mt-0.5">{dev.tipo}</span>
                          </div>
                        </div>
                        
                        {dev.itens && dev.itens.length > 0 && (
                          <div className="mt-3 bg-background-primary p-2 rounded-lg text-xs space-y-1 border border-border-secondary">
                            <span className="font-bold text-text-primary block mb-1">Itens Devolvidos:</span>
                            {dev.itens.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-text-secondary border-b border-border-tertiary last:border-0 pb-1 last:pb-0">
                                <span className="truncate pr-2">- {item.descricao} ({item.codigo})</span>
                                <span className="flex-shrink-0 font-medium">{item.qtd} cx | {item.peso.toFixed(3)}kg</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {dev.observacao && (
                          <p className="text-[11px] bg-background-primary p-2 rounded-md mt-2 text-text-secondary italic border border-border-tertiary border-l-2 border-l-warning">
                            Motivo: "{dev.observacao}"
                          </p>
                        )}

                        <div className="mt-3 pt-3 border-t border-border-secondary flex items-center justify-between">
                          <div className="flex flex-col gap-1">
                            <Badge status={dev.status === 'Pendente de recebimento' ? 'Pendente' : (dev.status === 'Recebido na operação' || dev.status === 'Devolução lançada') ? 'Entrega total' : dev.status === 'Confirmado pelo motorista' ? 'No cliente' : 'Devolução total'}>
                              Status: {dev.status}
                            </Badge>
                            {dev.tratamento && (
                              <Badge status={dev.tratamento === 'Aguardando definição' ? 'Pendente' : dev.tratamento === 'Reentrega' ? 'Reentrega' : dev.tratamento === 'Manter bloqueada (Segregada)' ? 'Devolução total' : 'Entrega total'}>
                                Tratamento: {dev.tratamento}
                              </Badge>
                            )}
                          </div>
                          
                          <button 
                            onClick={() => {
                              setAlterandoStatus(dev);
                              setNovoStatusSelecionado(dev.status);
                              setNovoTratamentoSelecionado(dev.tratamento || 'Aguardando definição');
                            }}
                            className="bg-info/10 text-info hover:bg-info/20 border border-info/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                          >
                            Mudar Status
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal Nova Devolução */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-background-primary w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border-tertiary flex justify-between items-center bg-background-secondary">
              <h3 className="font-semibold">Lançar Devolução</h3>
              <button onClick={() => setShowModal(false)} className="text-text-tertiary text-xl leading-none">&times;</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Nota Fiscal</label>
                  <input required type="text" value={novaDevolucao.nota} onChange={e => setNovaDevolucao({...novaDevolucao, nota: e.target.value})} className="w-full bg-background-secondary border-none rounded-lg p-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Tipo</label>
                  <select value={novaDevolucao.tipo} onChange={e => setNovaDevolucao({...novaDevolucao, tipo: e.target.value})} className="w-full bg-background-secondary border-none rounded-lg p-2 text-sm">
                    <option >Total</option>
                    <option >Parcial</option>
                    <option >Devolução de gramatura</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Quantidade (kg)</label>
                <input required type="number" step="0.001" value={novaDevolucao.quantidadeKg} onChange={e => setNovaDevolucao({...novaDevolucao, quantidadeKg: e.target.value})} className="w-full bg-background-secondary border-none rounded-lg p-2 text-sm" placeholder="Ex: 18.5" />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Motivo / Observação</label>
                <select 
                  required
                  value={novaDevolucao.observacao} 
                  onChange={e => setNovaDevolucao({...novaDevolucao, observacao: e.target.value})} 
                  className="w-full bg-background-secondary border-none rounded-lg p-2 text-sm"
                >
                  <option value="" disabled>Selecione um motivo...</option>
                  {MOTIVOS_DEVOLUCAO.map(m => (
                    <option key={m} value={m} >
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Tratamento da Mercadoria</label>
                <select 
                  value={novaDevolucao.tratamento} 
                  onChange={e => setNovaDevolucao({...novaDevolucao, tratamento: e.target.value})} 
                  className="w-full bg-background-secondary border-none rounded-lg p-2 text-sm"
                >
                  {TRATAMENTO_MERCADORIA.map(t => (
                    <option key={t} value={t} >
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <button type="submit" className="w-full bg-info text-white font-semibold rounded-xl py-3 mt-2 hover:bg-info/90">
                Salvar Devolução
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Motivo */}
      {editandoDevolucao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-background-primary w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border-tertiary flex justify-between items-center bg-background-secondary">
              <h3 className="font-semibold">Editar Motivo (NF: {editandoDevolucao.nota})</h3>
              <button onClick={() => setEditandoDevolucao(null)} className="text-text-tertiary text-xl leading-none">&times;</button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Motivo Principal</label>
                <select 
                  required
                  value={editandoDevolucao.observacao} 
                  onChange={e => setEditandoDevolucao({...editandoDevolucao, observacao: e.target.value})} 
                  className="w-full bg-background-secondary border-none rounded-lg p-2 text-sm"
                >
                  <option value="" disabled>Selecione um motivo...</option>
                  <option value="Aguardando preenchimento do Monitoramento" className="font-bold text-warning">Pendente de preenchimento</option>
                  {MOTIVOS_DEVOLUCAO.map(m => (
                    <option key={m} value={m} >
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <button type="submit" className="w-full bg-info text-white font-semibold rounded-xl py-3 mt-2 hover:bg-info/90">
                Salvar Alterações
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Motivo Grupo */}
      {editandoMotivoGrupo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-background-primary w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border-tertiary flex justify-between items-center bg-background-secondary">
              <h3 className="font-semibold">Editar Motivo Geral ({editandoMotivoGrupo.cliente})</h3>
              <button onClick={() => setEditandoMotivoGrupo(null)} className="text-text-tertiary text-xl leading-none">&times;</button>
            </div>
            
            <form onSubmit={handleEditSubmitGrupo} className="p-4 space-y-4">
              <div className="bg-info/10 text-info p-3 rounded-lg text-xs font-medium border border-info/20">
                Atenção: Esta ação mudará o motivo de todas as {editandoMotivoGrupo.devolucoes.length} NFs deste cliente.
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Motivo para todas NFs</label>
                <select 
                  required
                  value={editandoMotivoGrupo.observacao} 
                  onChange={e => setEditandoMotivoGrupo({...editandoMotivoGrupo, observacao: e.target.value})} 
                  className="w-full bg-background-secondary border-none rounded-lg p-2 text-sm"
                >
                  <option value="" disabled>Selecione um motivo...</option>
                  <option value="Aguardando preenchimento do Monitoramento" className="font-bold text-warning">Pendente de preenchimento</option>
                  {MOTIVOS_DEVOLUCAO.map(m => (
                    <option key={m} value={m} >
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <button type="submit" className="w-full bg-info text-white font-semibold rounded-xl py-3 mt-2 hover:bg-info/90">
                Salvar Motivo em Lote
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Alterar Status (Novo fluxo com Histórico) */}
      {alterandoStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-background-primary w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border-tertiary flex justify-between items-center bg-background-secondary">
              <h3 className="font-semibold">Alterar Status e Tratamento (NF: {alterandoStatus.nota})</h3>
              <button onClick={() => { setAlterandoStatus(null); setNovoStatusSelecionado(''); setNovoTratamentoSelecionado(''); setNovaObservacaoStatus(''); }} className="text-text-tertiary text-xl leading-none">&times;</button>
            </div>
            
            <form onSubmit={handleStatusSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Novo Status da Devolução</label>
                <select 
                  required
                  value={novoStatusSelecionado} 
                  onChange={e => setNovoStatusSelecionado(e.target.value)} 
                  className="w-full bg-background-secondary border-none rounded-lg p-2 text-sm font-semibold"
                >
                  <option value="" disabled>Selecione...</option>
                  {STATUS_DEVOLUCAO_GERAL.map(s => <option key={s} value={s} >{s}</option>)}
                  {currentUser?.role === 'Monitoramento' && STATUS_DEVOLUCAO_MONITORAMENTO.map(s => <option key={s} value={s} >{s}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Novo Tratamento da Mercadoria</label>
                <select 
                  required
                  value={novoTratamentoSelecionado} 
                  onChange={e => setNovoTratamentoSelecionado(e.target.value)} 
                  className="w-full bg-background-secondary border-none rounded-lg p-2 text-sm font-semibold"
                >
                  <option value="" disabled>Selecione...</option>
                  {TRATAMENTO_MERCADORIA.map(t => <option key={t} value={t} >{t}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Observação Adicional (Opcional)</label>
                <textarea 
                  value={novaObservacaoStatus}
                  onChange={e => setNovaObservacaoStatus(e.target.value)}
                  className="w-full bg-background-secondary border-none rounded-lg p-3 text-sm h-24 resize-none focus:ring-1 focus:ring-info"
                  placeholder="Justifique a mudança de status se necessário..."
                />
              </div>

              <button type="submit" className="w-full bg-info text-white font-semibold rounded-xl py-3 mt-2 hover:bg-info/90 disabled:opacity-50 transition-opacity" disabled={!novoStatusSelecionado || !novoTratamentoSelecionado}>
                Confirmar Alteração
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Alterar Status Grupo */}
      {alterandoStatusGrupo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-background-primary w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border-tertiary flex justify-between items-center bg-background-secondary">
              <h3 className="font-semibold">Alterar Status Geral ({alterandoStatusGrupo.cliente})</h3>
              <button onClick={() => { setAlterandoStatusGrupo(null); setNovoStatusSelecionado(''); setNovoTratamentoSelecionado(''); setNovaObservacaoStatus(''); }} className="text-text-tertiary text-xl leading-none">&times;</button>
            </div>
            
            <form onSubmit={handleStatusSubmitGrupo} className="p-4 space-y-4">
              <div className="bg-info/10 text-info p-3 rounded-lg text-xs font-medium border border-info/20">
                Atenção: Esta ação mudará o Status e Tratamento de todas as {alterandoStatusGrupo.devolucoes.length} NFs deste cliente. Campos vazios não serão alterados.
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Novo Status Geral</label>
                <select 
                  value={novoStatusSelecionado} 
                  onChange={e => setNovoStatusSelecionado(e.target.value)} 
                  className="w-full bg-background-secondary border-none rounded-lg p-2 text-sm font-semibold"
                >
                  <option value="" disabled>Manter os status atuais...</option>
                  {STATUS_DEVOLUCAO_GERAL.map(s => <option key={s} value={s} >{s}</option>)}
                  {currentUser?.role === 'Monitoramento' && STATUS_DEVOLUCAO_MONITORAMENTO.map(s => <option key={s} value={s} >{s}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Novo Tratamento Geral</label>
                <select 
                  value={novoTratamentoSelecionado} 
                  onChange={e => setNovoTratamentoSelecionado(e.target.value)} 
                  className="w-full bg-background-secondary border-none rounded-lg p-2 text-sm font-semibold"
                >
                  <option value="" disabled>Manter os tratamentos atuais...</option>
                  {TRATAMENTO_MERCADORIA.map(t => <option key={t} value={t} >{t}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Observação Geral (Opcional)</label>
                <textarea 
                  value={novaObservacaoStatus}
                  onChange={e => setNovaObservacaoStatus(e.target.value)}
                  className="w-full bg-background-secondary border-none rounded-lg p-3 text-sm h-24 resize-none focus:ring-1 focus:ring-info"
                  placeholder="Justifique a mudança de status se necessário..."
                />
              </div>

              <button type="submit" className="w-full bg-info text-white font-semibold rounded-xl py-3 mt-2 hover:bg-info/90 disabled:opacity-50 transition-opacity" disabled={!novoStatusSelecionado && !novoTratamentoSelecionado}>
                Confirmar Alteração em Lote
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ver Histórico */}
      {verHistorico && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-background-primary w-full max-w-md rounded-2xl shadow-xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="px-4 py-3 border-b border-border-tertiary flex justify-between items-center bg-background-secondary">
              <h3 className="font-semibold flex items-center gap-2"><Clock size={18} className="text-info" /> Histórico da Devolução</h3>
              <button onClick={() => setVerHistorico(null)} className="text-text-tertiary hover:text-text-primary text-xl leading-none">&times;</button>
            </div>
            
            <div className="p-4 overflow-y-auto space-y-4 flex-1 hide-scrollbar">
              <div className="mb-4">
                <span className="text-xs text-text-secondary uppercase font-bold block mb-1">Nota Fiscal</span>
                <span className="text-lg font-bold text-text-primary">{verHistorico.nota}</span>
              </div>

              {verHistorico.historico && verHistorico.historico.length > 0 ? (
                <div className="relative border-l-2 border-border-tertiary ml-2 pl-5 space-y-6">
                  {verHistorico.historico.map((hist, idx) => {
                    const isLast = idx === verHistorico.historico.length - 1;
                    return (
                      <div key={idx} className="relative">
                        {/* Timeline dot */}
                        <div className={cn(
                          "absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-background-primary",
                          isLast ? "bg-info" : "bg-text-tertiary"
                        )}></div>
                        
                        <div className="mb-1 flex justify-between items-start">
                          <div className="flex flex-col gap-1">
                            <Badge status={hist.status === 'Pendente de recebimento' ? 'Pendente' : (hist.status === 'Recebido na operação' || hist.status === 'Devolução lançada') ? 'Entrega total' : hist.status === 'Confirmado pelo motorista' ? 'No cliente' : 'Devolução total'}>
                              Status: {hist.status}
                            </Badge>
                            {hist.tratamento && (
                              <Badge status={hist.tratamento === 'Aguardando definição' ? 'Pendente' : hist.tratamento === 'Reentrega' ? 'Reentrega' : hist.tratamento === 'Manter bloqueada (Segregada)' ? 'Devolução total' : 'Entrega total'}>
                                Tratamento: {hist.tratamento}
                              </Badge>
                            )}
                          </div>
                          <span className="text-[10px] text-text-tertiary font-medium">
                            {new Date(hist.data).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                          </span>
                        </div>
                        
                        <div className="bg-background-secondary p-3 rounded-xl border border-border-tertiary mt-2">
                          <div className="flex items-center gap-1.5 mb-2 border-b border-border-tertiary/50 pb-2">
                            <User size={12} className="text-info" />
                            <span className="text-[10px] font-bold text-text-secondary uppercase">{hist.role || 'Desconhecido'}</span>
                          </div>
                          {hist.observacao ? (
                            <p className="text-xs text-text-primary leading-relaxed">"{hist.observacao}"</p>
                          ) : (
                            <p className="text-xs text-text-tertiary italic">Sem observações.</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10 text-text-tertiary text-sm glass-panel rounded-xl">
                  <Clock className="mx-auto mb-3 opacity-20" size={32} />
                  <p className="font-medium">Nenhum histórico registrado.</p>
                  <p className="text-xs opacity-70 mt-1">Devoluções antigas não possuem histórico.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
