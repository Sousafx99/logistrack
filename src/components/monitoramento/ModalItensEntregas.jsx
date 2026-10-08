import { useState, useMemo, useEffect } from 'react';
import { 
  Package, Search, X, Truck, Hash, MapPin, 
  ArrowUpDown, Filter
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/utils';

export function ModalItensEntregas({ isOpen, onClose, entregasSelecionadas = [] }) {
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [ordenacao, setOrdenacao] = useState('produto-asc'); // 'produto-asc', 'qtd-desc', 'nota-asc', 'cliente-asc'

  // Fechar com ESC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Metadados das entregas selecionadas
  const metadadosSelecao = useMemo(() => {
    const placas = new Set();
    const cargas = new Set();
    const clientes = new Set();

    entregasSelecionadas.forEach(e => {
      if (e.placa) placas.add(String(e.placa).toUpperCase());
      if (e.carga) cargas.add(String(e.carga));
      if (e.cliente) clientes.add(String(e.cliente));
    });

    return {
      totalNotas: entregasSelecionadas.length,
      placas: Array.from(placas),
      cargas: Array.from(cargas),
      totalClientes: clientes.size
    };
  }, [entregasSelecionadas]);

  // Lista plana de todos os itens de todas as notas selecionadas
  const todasLinhasItens = useMemo(() => {
    const lista = [];

    entregasSelecionadas.forEach(entrega => {
      const itensDaNota = Array.isArray(entrega.itens) && entrega.itens.length > 0
        ? entrega.itens
        : [{
            codigo: 'S/C',
            descricao: `Volume geral - NF ${entrega.nota}`,
            qtd: entrega.volumes || 1,
            peso: entrega.peso || 0,
            valor: entrega.valor || 0
          }];

      itensDaNota.forEach((item, itemIdx) => {
        const codigo = String(item.codigo || item.codProduto || 'S/C').trim();
        const descricao = String(item.descricao || item.produto || 'Item sem descrição').trim();
        const qtd = Number(item.qtd) !== undefined && !isNaN(Number(item.qtd)) ? Number(item.qtd) : 1;
        const peso = Number(item.peso) || 0;
        const valor = Number(item.valor) || 0;

        lista.push({
          idUnico: `${entrega.id}-${itemIdx}-${codigo}`,
          entregaId: entrega.id,
          nota: entrega.nota,
          cliente: entrega.cliente || 'CLIENTE NÃO IDENTIFICADO',
          codCliente: entrega.codCliente || '',
          bairro: entrega.bairro || '',
          cidade: entrega.cidade || '',
          rota: entrega.rota || '',
          placa: entrega.placa || '',
          carga: entrega.carga || '',
          status: entrega.status || 'Pendente',
          codigo,
          descricao,
          qtd,
          peso,
          valor
        });
      });
    });

    return lista;
  }, [entregasSelecionadas]);

  // Linhas filtradas e ordenadas
  const linhasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    const resultado = todasLinhasItens.filter(linha => {
      const matchTexto = !termo ||
        linha.descricao.toLowerCase().includes(termo) ||
        linha.codigo.toLowerCase().includes(termo) ||
        String(linha.nota).includes(termo) ||
        String(linha.cliente || '').toLowerCase().includes(termo) ||
        String(linha.bairro || '').toLowerCase().includes(termo);

      if (!matchTexto) return false;
      if (filtroStatus !== 'todos' && linha.status !== filtroStatus) return false;

      return true;
    });

    // Ordenação
    resultado.sort((a, b) => {
      if (ordenacao === 'produto-asc') return a.descricao.localeCompare(b.descricao);
      if (ordenacao === 'qtd-desc') return b.qtd - a.qtd;
      if (ordenacao === 'nota-asc') return String(a.nota).localeCompare(String(b.nota), undefined, { numeric: true });
      if (ordenacao === 'cliente-asc') return a.cliente.localeCompare(b.cliente);
      return 0;
    });

    return resultado;
  }, [todasLinhasItens, busca, filtroStatus, ordenacao]);

  // Totais calculados sobre as linhas filtradas
  const totaisFiltrados = useMemo(() => {
    let caixas = 0;
    let peso = 0;
    let valor = 0;
    const notasSet = new Set();
    const produtosSet = new Set();

    linhasFiltradas.forEach(l => {
      caixas += l.qtd;
      peso += l.peso;
      valor += l.valor;
      notasSet.add(l.nota);
      produtosSet.add(l.codigo !== 'S/C' ? l.codigo : l.descricao);
    });

    return {
      totalCaixas: caixas,
      totalPeso: peso,
      totalValor: valor,
      totalNotas: notasSet.size,
      totalProdutos: produtosSet.size
    };
  }, [linhasFiltradas]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-background-primary rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col border border-border-secondary shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Cabeçalho do Modal */}
        <div className="bg-background-secondary p-4 sm:p-5 border-b border-border-secondary shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center border border-purple-500/30 shrink-0">
                <Package size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black text-text-primary tracking-tight">
                    Itens das Entregas Selecionadas
                  </h2>
                  <span className="bg-purple-500/20 text-purple-300 text-[11px] font-bold px-2 py-0.5 rounded-full border border-purple-500/30">
                    {metadadosSelecao.totalNotas} nota{metadadosSelecao.totalNotas > 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-xs text-text-tertiary mt-0.5 flex items-center gap-2 flex-wrap">
                  {metadadosSelecao.placas.length > 0 && (
                    <span className="font-semibold text-text-secondary flex items-center gap-1">
                      <Truck size={12} className="text-info" />
                      {metadadosSelecao.placas.join(', ')}
                    </span>
                  )}
                  {metadadosSelecao.cargas.length > 0 && (
                    <span className="text-text-muted">
                      • Carga: <strong className="text-text-secondary">{metadadosSelecao.cargas.join(', ')}</strong>
                    </span>
                  )}
                  <span className="text-text-muted">
                    • {metadadosSelecao.totalClientes} cliente{metadadosSelecao.totalClientes > 1 ? 's' : ''}
                  </span>
                </p>
              </div>
            </div>

            <button 
              onClick={onClose}
              className="p-2 text-text-tertiary hover:text-text-primary hover:bg-background-primary rounded-xl transition-colors cursor-pointer"
              title="Fechar (Esc)"
            >
              <X size={20} />
            </button>
          </div>

          {/* Cards de Métricas Rápidas (Totais Calculados) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
            <div className="bg-background-primary/80 border border-border-secondary rounded-xl p-2.5 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-info/15 text-info flex items-center justify-center shrink-0">
                <Package size={16} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-text-muted block leading-none">Total Caixas</span>
                <span className="text-sm font-black text-text-primary truncate block mt-0.5">
                  {totaisFiltrados.totalCaixas} <span className="text-[10px] font-medium text-text-tertiary">cx</span>
                </span>
              </div>
            </div>

            <div className="bg-background-primary/80 border border-border-secondary rounded-xl p-2.5 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0">
                <Hash size={16} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-text-muted block leading-none">Produtos</span>
                <span className="text-sm font-black text-text-primary truncate block mt-0.5">
                  {totaisFiltrados.totalProdutos} <span className="text-[10px] font-medium text-text-tertiary">únicos</span>
                </span>
              </div>
            </div>

            <div className="bg-background-primary/80 border border-border-secondary rounded-xl p-2.5 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                <span className="text-xs font-black">KG</span>
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-text-muted block leading-none">Peso Total</span>
                <span className="text-sm font-black text-text-primary truncate block mt-0.5">
                  {totaisFiltrados.totalPeso.toFixed(1)} <span className="text-[10px] font-medium text-text-tertiary">kg</span>
                </span>
              </div>
            </div>

            <div className="bg-background-primary/80 border border-border-secondary rounded-xl p-2.5 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                <span className="text-xs font-black">R$</span>
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-text-muted block leading-none">Valor Total</span>
                <span className="text-sm font-black text-text-primary truncate block mt-0.5">
                  {totaisFiltrados.totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Barra de Filtros e Busca em Tempo Real */}
        <div className="bg-background-primary p-3 sm:px-5 sm:py-3 border-b border-border-secondary shrink-0 flex flex-wrap items-center justify-between gap-2.5">
          {/* Campo de Busca Rápida */}
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
            <input 
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Filtrar por produto, código, nota ou cliente..."
              className="w-full bg-background-secondary border border-border-secondary focus:border-purple-500 rounded-xl pl-9 pr-8 py-2 text-xs font-semibold text-text-primary placeholder:text-text-muted focus:ring-1 focus:ring-purple-500 outline-none transition-all"
              autoFocus
            />
            {busca && (
              <button 
                onClick={() => setBusca('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary p-0.5 rounded cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Filtros de Status e Ordenação */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="bg-background-secondary border border-border-secondary rounded-xl px-2.5 py-2 text-xs font-bold text-text-secondary focus:outline-none cursor-pointer"
            >
              <option value="todos">Todos os Status</option>
              <option value="Pendente">Pendente</option>
              <option value="No cliente">No cliente</option>
              <option value="Descarregando">Descarregando</option>
              <option value="Entrega total">Entrega total</option>
              <option value="Entrega parcial">Entrega parcial</option>
              <option value="Devolução total">Devolução total</option>
            </select>

            <select
              value={ordenacao}
              onChange={(e) => setOrdenacao(e.target.value)}
              className="bg-background-secondary border border-border-secondary rounded-xl px-2.5 py-2 text-xs font-bold text-text-secondary focus:outline-none cursor-pointer"
            >
              <option value="produto-asc">Ordenar por Produto (A-Z)</option>
              <option value="qtd-desc">Maior Quantidade de Caixas</option>
              <option value="nota-asc">Por Número de Nota (NF)</option>
              <option value="cliente-asc">Por Nome do Cliente</option>
            </select>
          </div>
        </div>

        {/* Tabela de Itens com Scroll */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-[#0d0f15]/50">
          <div className="bg-background-secondary rounded-2xl border border-border-secondary overflow-x-auto shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-background-primary/90 border-b border-border-secondary text-[10px] uppercase font-bold text-text-muted tracking-wider sticky top-0 z-10 backdrop-blur-sm">
                <tr>
                  <th className="py-3 px-3.5 whitespace-nowrap">NF</th>
                  <th className="py-3 px-3.5">Cliente / Bairro</th>
                  <th className="py-3 px-3 whitespace-nowrap">Cód.</th>
                  <th className="py-3 px-3.5">Produto</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Qtd (cx)</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Peso (kg)</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-tertiary/60">
                {linhasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-text-muted">
                      <Package size={32} className="mx-auto mb-2 opacity-30 text-purple-400" />
                      <p className="font-bold text-text-primary text-sm">Nenhum item encontrado</p>
                      <p className="text-xs text-text-muted mt-1">
                        Tente alterar o termo da busca ou limpar os filtros.
                      </p>
                      {busca && (
                        <button
                          onClick={() => setBusca('')}
                          className="mt-3 text-xs font-bold text-purple-400 hover:underline cursor-pointer"
                        >
                          Limpar pesquisa
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  linhasFiltradas.map((linha) => (
                    <tr 
                      key={linha.idUnico} 
                      className={cn(
                        "hover:bg-background-primary/50 transition-colors",
                        linha.status === 'Entrega total' ? 'bg-emerald-500/[0.02]' : ''
                      )}
                    >
                      {/* Nota Fiscal */}
                      <td className="py-2.5 px-3.5 font-black text-text-primary whitespace-nowrap">
                        <span className="text-xs px-2 py-0.5 rounded bg-background-primary border border-border-tertiary inline-block">
                          {linha.nota}
                        </span>
                      </td>

                      {/* Cliente e Bairro */}
                      <td className="py-2.5 px-3.5 max-w-[240px]">
                        <span className="font-bold text-text-primary block truncate" title={linha.cliente}>
                          {linha.cliente}
                        </span>
                        <span className="text-[10px] text-text-tertiary block truncate">
                          {linha.bairro ? `${linha.bairro} - ${linha.cidade}` : linha.cidade}
                        </span>
                      </td>

                      {/* Código do Produto */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-purple-300 font-bold whitespace-nowrap">
                        {linha.codigo}
                      </td>

                      {/* Descrição do Produto */}
                      <td className="py-2.5 px-3.5 font-bold text-text-primary">
                        {linha.descricao}
                      </td>

                      {/* Quantidade em Caixas */}
                      <td className="py-2.5 px-3 text-right font-black text-purple-300 whitespace-nowrap">
                        <span className="bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-lg inline-block">
                          {linha.qtd} cx
                        </span>
                      </td>

                      {/* Peso */}
                      <td className="py-2.5 px-3 text-right text-text-secondary font-medium whitespace-nowrap">
                        {linha.peso.toFixed(1)}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <Badge status={linha.status}>{linha.status}</Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rodapé do Modal */}
        <div className="bg-background-secondary p-3 sm:px-5 sm:py-3.5 border-t border-border-secondary flex items-center justify-between gap-2 shrink-0">
          <span className="text-xs text-text-tertiary">
            Exibindo <strong className="text-text-primary">{linhasFiltradas.length}</strong> de <strong className="text-text-primary">{todasLinhasItens.length}</strong> itens
            {busca && ` (filtrados por "${busca}")`}
          </span>

          <button
            onClick={onClose}
            className="bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-950/20 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
