import { useState, useMemo } from 'react';
import { 
  Truck, 
  MapPin, 
  User, 
  Clock, 
  Timer, 
  CheckCircle2, 
  AlertTriangle, 
  Eye, 
  EyeOff, 
  Bell, 
  ExternalLink, 
  Flag, 
  Package as PackageIcon,
  Navigation,
  Building2
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/utils';
import { useStore } from '../../store/useStore';

const formatarHora = (isoStr) => {
  if (!isoStr) return '--:--';
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
};

const formatarDataHora = (isoStr) => {
  if (!isoStr) return '--/-- --:--';
  try {
    const d = new Date(isoStr);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    const hora = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${ano} ${hora}:${min}`;
  } catch {
    return '--/-- --:--';
  }
};

export function VisaoCardsVeiculos({
  entregasFiltradas = [],
  onStatusChange,
  onAbrirDevolucao
}) {
  const { motoristas = [] } = useStore();
  const [cardsExpandidos, setCardsExpandidos] = useState({});
  const [paradaSelecionada, setParadaSelecionada] = useState({});

  const toggleExpandir = (placaCargaKey) => {
    setCardsExpandidos(prev => ({
      ...prev,
      [placaCargaKey]: !prev[placaCargaKey]
    }));
  };

  const finalizadasSet = useMemo(() => new Set(['Entrega total', 'Entrega parcial', 'Devolução total', 'Reentrega', 'Carga parada']), []);

  // Agrupamento dos veículos a partir das entregas filtradas
  const veiculosAgrupados = useMemo(() => {
    const map = new Map();

    entregasFiltradas.forEach(e => {
      const placa = (e.placa || 'SEM PLACA').trim().toUpperCase();
      const carga = (e.carga || 'SEM CARGA').trim();
      const data = e.data || '';
      const key = `${placa}__${carga}__${data}`;

      if (!map.has(key)) {
        // Encontrar motorista cadastrado pela placa
        const motoristaInfo = motoristas.find(m => (m.placa || '').trim().toUpperCase() === placa);
        
        map.set(key, {
          key,
          placa,
          carga,
          data,
          motoristaNome: motoristaInfo?.nome || e.motorista || 'Motorista não informado',
          motoristaTelefone: motoristaInfo?.telefone || '',
          entregas: []
        });
      }

      map.get(key).entregas.push(e);
    });

    const lista = Array.from(map.values()).map(veiculo => {
      const totalNotas = veiculo.entregas.length;
      let finalizadasCount = 0;
      let emAndamentoCount = 0;
      let pendentesCount = 0;
      let devolucoesCount = 0;
      let paradasCount = 0;

      // Agrupamento por cliente (parada)
      const clientesMap = new Map();
      let ultimaAtualizacao = null;
      let ultimoClienteNome = '--';

      veiculo.entregas.forEach(ent => {
        const isFin = finalizadasSet.has(ent.status);
        if (isFin) finalizadasCount++;
        else if (['No cliente', 'Descarregando'].includes(ent.status)) emAndamentoCount++;
        else pendentesCount++;

        if (['Devolução total', 'Entrega parcial'].includes(ent.status)) {
          devolucoesCount++;
        }
        if (ent.status === 'Carga parada') {
          paradasCount++;
        }

        // Rastrear última atualização
        const horaRef = ent.horaSaida || ent.horaChegada || ent.atualizadoEm;
        if (horaRef) {
          if (!ultimaAtualizacao || new Date(horaRef) > new Date(ultimaAtualizacao)) {
            ultimaAtualizacao = horaRef;
            ultimoClienteNome = ent.cliente || ultimoClienteNome;
          }
        }

        const cliKey = `${ent.codCliente || ''}-${ent.cliente || ''}`;
        if (!clientesMap.has(cliKey)) {
          clientesMap.set(cliKey, {
            codCliente: ent.codCliente,
            cliente: ent.cliente,
            bairro: ent.bairro,
            municipio: ent.municipio,
            endereco: ent.endereco,
            notas: [],
            statusGeral: 'Pendente',
            horaChegada: ent.horaChegada || null,
            horaSaida: ent.horaSaida || null,
            tempoMinutos: ent.tempoMinutos || null,
            tempoFormatado: ent.tempoFormatado || null
          });
        }
        const cliObj = clientesMap.get(cliKey);
        cliObj.notas.push(ent);
        if (ent.horaChegada && !cliObj.horaChegada) cliObj.horaChegada = ent.horaChegada;
        if (ent.horaSaida && !cliObj.horaSaida) cliObj.horaSaida = ent.horaSaida;
        if (ent.tempoFormatado) cliObj.tempoFormatado = ent.tempoFormatado;
      });

      // Determinar status consolidado de cada parada de cliente
      const paradas = Array.from(clientesMap.values()).map((parada, idx) => {
        const statuses = parada.notas.map(n => n.status);
        let status = 'Pendente';

        if (statuses.some(s => ['No cliente', 'Descarregando'].includes(s))) {
          status = 'No cliente';
        } else if (statuses.every(s => s === 'Entrega total')) {
          status = 'Entrega total';
        } else if (statuses.some(s => s === 'Carga parada')) {
          status = 'Carga parada';
        } else if (statuses.some(s => ['Devolução total', 'Entrega parcial'].includes(s))) {
          status = 'Devolução';
        } else if (statuses.some(s => finalizadasSet.has(s))) {
          status = 'Parcial Concluído';
        }

        return {
          ...parada,
          ordem: idx + 1,
          statusCalculado: status
        };
      });

      // Se nenhum cliente foi marcado com data, pega o último da lista
      if (ultimoClienteNome === '--' && paradas.length > 0) {
        const concluidas = paradas.filter(p => p.statusCalculado === 'Entrega total' || p.statusCalculado === 'Devolução');
        if (concluidas.length > 0) {
          ultimoClienteNome = concluidas[concluidas.length - 1].cliente;
        } else {
          ultimoClienteNome = paradas[0].cliente;
        }
      }

      const progressoPorcentagem = totalNotas > 0 ? Math.round((finalizadasCount / totalNotas) * 100) : 0;

      return {
        ...veiculo,
        totalNotas,
        finalizadasCount,
        emAndamentoCount,
        pendentesCount,
        devolucoesCount,
        paradasCount,
        progressoPorcentagem,
        ultimaAtualizacao,
        ultimoClienteNome,
        paradas
      };
    });

    // Ordenar: primeiro veículos em andamento (com pendências), depois por placa
    return lista.sort((a, b) => {
      if (a.pendentesCount > 0 && b.pendentesCount === 0) return -1;
      if (a.pendentesCount === 0 && b.pendentesCount > 0) return 1;
      return a.placa.localeCompare(b.placa);
    });
  }, [entregasFiltradas, motoristas, finalizadasSet]);

  if (veiculosAgrupados.length === 0) {
    return (
      <div className="glass-panel p-12 text-center rounded-2xl border border-border-secondary">
        <Truck className="mx-auto h-16 w-16 text-text-tertiary/40 mb-4" />
        <h3 className="text-lg font-bold text-text-primary">Nenhum veículo encontrado</h3>
        <p className="text-sm text-text-tertiary mt-1">Ajuste os filtros de data, placa ou status para visualizar os cards.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full">
      {/* Grid de Cards dos Veículos */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
        {veiculosAgrupados.map((veiculo) => {
          const isExpandido = !!cardsExpandidos[veiculo.key];
          const progresso = veiculo.progressoPorcentagem;
          const temAlerta = veiculo.devolucoesCount > 0 || veiculo.paradasCount > 0;

          return (
            <div
              key={veiculo.key}
              className={cn(
                "bg-background-secondary border rounded-2xl p-4 shadow-sm transition-all duration-200 flex flex-col justify-between",
                isExpandido 
                  ? "border-primary/50 ring-1 ring-primary/30 shadow-md" 
                  : "border-border-secondary hover:border-border-tertiary hover:shadow"
              )}
            >
              {/* Topo do Card: Placa em Destaque + Último Cliente e Data */}
              <div>
                <div className="flex items-start justify-between gap-2">
                  {/* Lado Esquerdo: Placa Gigante & Motorista */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-background-primary border border-border-secondary flex items-center justify-center text-text-primary shadow-inner flex-shrink-0">
                      <Truck size={20} className="text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-black tracking-wider text-text-primary font-mono uppercase bg-background-primary px-2 py-0.5 rounded-lg border border-border-secondary">
                          {veiculo.placa}
                        </span>
                        {veiculo.carga && veiculo.carga !== 'SEM CARGA' && (
                          <span className="text-[11px] font-bold text-text-tertiary bg-background-primary/50 px-1.5 py-0.5 rounded border border-border-secondary/60">
                            Carga: {veiculo.carga}
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-text-secondary mt-1 flex items-center gap-1 truncate max-w-[180px] sm:max-w-[220px]">
                        <User size={12} className="text-text-tertiary flex-shrink-0" />
                        <span className="truncate">{veiculo.motoristaNome}</span>
                      </div>
                    </div>
                  </div>

                  {/* Lado Direito: Último cliente & Última Atualização */}
                  <div className="text-right flex flex-col items-end max-w-[160px] sm:max-w-[200px]">
                    <div className="text-[10px] text-text-tertiary uppercase font-bold tracking-tight">
                      Último cliente:
                    </div>
                    <div 
                      className="text-xs font-bold text-text-primary truncate w-full text-right"
                      title={veiculo.ultimoClienteNome}
                    >
                      {veiculo.ultimoClienteNome}
                    </div>
                    <div className="text-[10px] text-text-tertiary font-medium mt-0.5 flex items-center justify-end gap-1">
                      <Clock size={10} />
                      <span>{veiculo.ultimaAtualizacao ? formatarDataHora(veiculo.ultimaAtualizacao) : '--/-- --:--'}</span>
                    </div>
                  </div>
                </div>

                {/* Linha Central: Progresso, Quantidade e Ações */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border-secondary/60">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-bold text-text-tertiary uppercase tracking-wider">
                      Progresso
                    </span>
                    <span className={cn(
                      "text-lg font-black tracking-tight",
                      progresso === 100 
                        ? "text-success" 
                        : progresso > 0 
                          ? "text-info" 
                          : "text-text-tertiary"
                    )}>
                      {progresso}%
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-extrabold text-text-secondary font-mono bg-background-primary px-2 py-0.5 rounded-md border border-border-secondary">
                      {veiculo.finalizadasCount}/{veiculo.totalNotas}
                    </span>

                    {temAlerta && (
                      <div 
                        className="relative text-rose-500 animate-bounce"
                        title={veiculo.devolucoesCount > 0 ? `${veiculo.devolucoesCount} devolução(ões)` : "Carga com ocorrência"}
                      >
                        <Bell size={18} className="fill-rose-500/20" />
                        <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 bg-rose-600 text-white rounded-full text-[9px] font-black flex items-center justify-center">
                          {veiculo.devolucoesCount || '!'}
                        </span>
                      </div>
                    )}

                    <button
                      onClick={() => toggleExpandir(veiculo.key)}
                      className={cn(
                        "p-1.5 rounded-lg border transition-all flex items-center gap-1 text-xs font-bold",
                        isExpandido
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-background-primary text-text-secondary border-border-secondary hover:text-text-primary hover:bg-border-tertiary"
                      )}
                      title={isExpandido ? "Recolher rota" : "Visualizar paradas da rota"}
                    >
                      {isExpandido ? <EyeOff size={15} /> : <Eye size={15} />}
                      <span className="hidden sm:inline">{isExpandido ? "Ocultar" : "Rota"}</span>
                    </button>
                  </div>
                </div>

                {/* Barra Gráfica de Progresso com Caminhão em Trajeto */}
                <div className="mt-3 relative pt-3 pb-1">
                  <div className="flex items-center justify-between text-text-tertiary mb-1">
                    <div className="flex items-center gap-1 text-[10px] font-bold">
                      <Building2 size={13} className="text-text-tertiary" />
                      <span>CD</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-bold">
                      <span>FIM</span>
                      <Flag size={13} className={progresso === 100 ? "text-success" : "text-text-tertiary"} />
                    </div>
                  </div>

                  {/* Linha da Estrada */}
                  <div className="relative w-full h-2 bg-background-primary rounded-full overflow-visible border border-border-secondary">
                    {/* Linha preenchida de progresso */}
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500 ease-out",
                        progresso === 100 ? "bg-success" : "bg-emerald-500"
                      )}
                      style={{ width: `${progresso}%` }}
                    />

                    {/* Ícone do Caminhão se movendo sobre a linha */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-500 ease-out text-text-primary bg-background-primary border border-border-secondary rounded-full p-1 shadow-md"
                      style={{ left: `${Math.min(Math.max(progresso, 4), 96)}%` }}
                      title={`${progresso}% concluído`}
                    >
                      <Truck size={13} className={progresso === 100 ? "text-success" : "text-primary"} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção Expandida: Timeline Sequencial de Paradas + Detalhes */}
              {isExpandido && (
                <div className="mt-4 pt-4 border-t border-border-secondary/80 space-y-4">
                  
                  {/* Cabeçalho da Rota com Código */}
                  <div className="flex items-center justify-between bg-background-primary/80 px-3 py-2 rounded-xl border border-border-secondary">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                        <Truck size={14} />
                      </div>
                      <span className="text-xs font-bold text-text-primary font-mono">
                        {veiculo.carga && veiculo.carga !== 'SEM CARGA' ? veiculo.carga : veiculo.placa} - ROTA DE ENTREGAS
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-text-tertiary">
                      {veiculo.paradas.length} parada(s)
                    </span>
                  </div>

                  {/* Sequência Gráfica de Marcos/Paradas (como no print da referência) */}
                  <div className="bg-background-primary p-3 rounded-xl border border-border-secondary overflow-x-auto hide-scrollbar">
                    <div className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-2">
                      Sequência do Trajeto
                    </div>
                    <div className="flex items-center gap-3 min-w-max py-1">
                      {/* CD Início */}
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 flex items-center justify-center">
                          <Building2 size={16} />
                        </div>
                        <span className="text-[9px] font-bold text-text-tertiary">CD (Início)</span>
                      </div>

                      {/* Conector */}
                      <div className="w-4 h-0.5 bg-border-tertiary" />

                      {/* Paradas de Clientes */}
                      {veiculo.paradas.map((parada, idx) => {
                        const isConcluida = parada.statusCalculado === 'Entrega total';
                        const isEmAtendimento = parada.statusCalculado === 'No cliente';
                        const isDevolucao = parada.statusCalculado === 'Devolução';
                        const isParada = parada.statusCalculado === 'Carga parada';
                        const isAtiva = paradaSelecionada[veiculo.key] === idx;

                        return (
                          <div key={idx} className="flex items-center gap-3">
                            <button
                              onClick={() => setParadaSelecionada(prev => ({
                                ...prev,
                                [veiculo.key]: prev[veiculo.key] === idx ? null : idx
                              }))}
                              className={cn(
                                "flex flex-col items-center gap-1 group transition-transform active:scale-95 focus:outline-none",
                                isAtiva ? "scale-105" : ""
                              )}
                              title={`#${idx + 1} - ${parada.cliente} (${parada.statusCalculado})`}
                            >
                              <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm",
                                isConcluida 
                                  ? "bg-emerald-500 text-white shadow-emerald-500/20" 
                                  : isEmAtendimento
                                    ? "bg-info text-white ring-4 ring-info/30 animate-pulse"
                                    : isDevolucao
                                      ? "bg-rose-500 text-white shadow-rose-500/20"
                                      : isParada
                                        ? "bg-amber-500 text-white shadow-amber-500/20"
                                        : "bg-background-secondary border border-border-tertiary text-text-tertiary hover:border-info hover:text-info",
                                isAtiva ? "ring-2 ring-primary ring-offset-2 ring-offset-background-primary" : ""
                              )}>
                                {isConcluida ? (
                                  <CheckCircle2 size={16} />
                                ) : isEmAtendimento ? (
                                  <User size={16} />
                                ) : isDevolucao ? (
                                  <AlertTriangle size={16} />
                                ) : isParada ? (
                                  <AlertTriangle size={16} />
                                ) : (
                                  <MapPin size={15} />
                                )}
                              </div>
                              <span className={cn(
                                "text-[9px] font-bold max-w-[50px] truncate",
                                isAtiva ? "text-primary font-black" : "text-text-tertiary group-hover:text-text-primary"
                              )}>
                                #{idx + 1}
                              </span>
                            </button>

                            {/* Linha conectora até a próxima parada */}
                            <div className={cn(
                              "w-4 h-0.5",
                              isConcluida ? "bg-emerald-500" : "bg-border-tertiary"
                            )} />
                          </div>
                        );
                      })}

                      {/* CD Retorno / Fim */}
                      <div className="flex flex-col items-center gap-1">
                        <div className={cn(
                          "w-8 h-8 rounded-full border flex items-center justify-center",
                          progresso === 100 
                            ? "bg-emerald-500 text-white border-emerald-500" 
                            : "bg-background-secondary border-border-tertiary text-text-tertiary"
                        )}>
                          <Flag size={15} />
                        </div>
                        <span className="text-[9px] font-bold text-text-tertiary">Fim</span>
                      </div>
                    </div>
                  </div>

                  {/* Lista Detalhada das Paradas do Veículo */}
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {veiculo.paradas.map((parada, idx) => {
                      const isAtiva = paradaSelecionada[veiculo.key] === idx;

                      return (
                        <div
                          key={idx}
                          className={cn(
                            "p-3 rounded-xl border transition-all text-xs",
                            isAtiva 
                              ? "bg-background-primary border-primary/60 shadow-sm ring-1 ring-primary/20" 
                              : "bg-background-primary/50 border-border-secondary hover:bg-background-primary"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2">
                              <span className="w-5 h-5 rounded-full bg-background-secondary border border-border-tertiary text-[10px] font-bold flex items-center justify-center text-text-secondary flex-shrink-0 mt-0.5">
                                {idx + 1}
                              </span>
                              <div>
                                <div className="font-bold text-text-primary flex items-center gap-1.5 flex-wrap">
                                  <span>{parada.codCliente ? `[${parada.codCliente}] ` : ''}{parada.cliente}</span>
                                </div>
                                <div className="text-[11px] text-text-tertiary mt-0.5 flex items-center gap-1">
                                  <MapPin size={11} />
                                  <span>{parada.bairro || 'Bairro não informado'}{parada.municipio ? ` - ${parada.municipio}` : ''}</span>
                                </div>
                              </div>
                            </div>

                            <Badge variant={
                              parada.statusCalculado === 'Entrega total' ? 'success' :
                              parada.statusCalculado === 'No cliente' ? 'info' :
                              parada.statusCalculado === 'Devolução' ? 'danger' :
                              parada.statusCalculado === 'Carga parada' ? 'warning' : 'default'
                            }>
                              {parada.statusCalculado}
                            </Badge>
                          </div>

                          {/* Tempos de Chegada, Saída e Estadia */}
                          {(parada.horaChegada || parada.horaSaida || parada.tempoFormatado) && (
                            <div className="mt-2 pt-2 border-t border-border-secondary/60 flex flex-wrap items-center gap-3 text-[11px] text-text-secondary bg-background-secondary/50 px-2 py-1 rounded-lg">
                              {parada.horaChegada && (
                                <div className="flex items-center gap-1">
                                  <Clock size={11} className="text-info" />
                                  <span>Chegada: <strong>{formatarHora(parada.horaChegada)}</strong></span>
                                </div>
                              )}
                              {parada.horaSaida && (
                                <div className="flex items-center gap-1">
                                  <Clock size={11} className="text-success" />
                                  <span>Saída: <strong>{formatarHora(parada.horaSaida)}</strong></span>
                                </div>
                              )}
                              {parada.tempoFormatado && (
                                <div className="flex items-center gap-1 text-primary font-bold">
                                  <Timer size={12} />
                                  <span>Estadia: {parada.tempoFormatado}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Lista de Notas Fiscais vinculadas a este cliente */}
                          <div className="mt-2 pt-2 border-t border-border-secondary/60 space-y-1.5">
                            <div className="text-[10px] font-bold text-text-tertiary uppercase">
                              Notas ({parada.notas.length}):
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {parada.notas.map(n => (
                                <div 
                                  key={n.id}
                                  className="flex items-center justify-between bg-background-secondary p-1.5 rounded-lg border border-border-secondary text-[11px]"
                                >
                                  <div className="flex items-center gap-1.5 truncate">
                                    <PackageIcon size={12} className="text-text-tertiary flex-shrink-0" />
                                    <span className="font-mono font-bold text-text-primary">NF {n.nota}</span>
                                    {n.valor && (
                                      <span className="text-text-tertiary">
                                        R$ {Number(n.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                      </span>
                                    )}
                                  </div>
                                  <Badge size="sm" variant={
                                    n.status === 'Entrega total' ? 'success' :
                                    n.status === 'No cliente' ? 'info' :
                                    ['Devolução total', 'Entrega parcial'].includes(n.status) ? 'danger' : 'default'
                                  }>
                                    {n.status}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Link de Trajeto / Google Maps */}
                          {parada.endereco && (
                            <div className="mt-2 text-right">
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${parada.endereco}, ${parada.bairro || ''} ${parada.municipio || ''}`)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-info hover:underline"
                              >
                                <Navigation size={11} />
                                <span>Ver no Google Maps</span>
                                <ExternalLink size={10} />
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
