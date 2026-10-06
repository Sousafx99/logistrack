import React, { useState, useMemo } from 'react';
import { 
  User, Search, Plus, Edit3, Trash2, Check, X, 
  Phone, MessageSquare, DollarSign, Truck, Copy,
  CheckCircle2, FileSpreadsheet, ExternalLink, ShieldCheck, CreditCard,
  Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';
import { getPresetPorTipo } from './AbaVeiculos';

export const TIPOS_CHAVE_PIX = [
  'CPF / CNPJ',
  'Celular / Telefone',
  'E-mail',
  'Chave Aleatória (EVP)'
];

export function AbaMotoristas() {
  const { 
    motoristas = [], 
    entregas = [], 
    veiculos = [],
    configDiarias,
    atualizarMotoristaAdmin, 
    removerMotoristaAdmin 
  } = useStore();

  const [buscaTexto, setBuscaTexto] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos'); // 'todos' | 'Ativo' | 'Inativo'
  
  // Modal de Criação / Edição de Motorista
  const [modalMotorista, setModalMotorista] = useState(null); // null | { placa, nome, telefone, chave_pix, tipo_chave_pix, cpf, status, observacao }
  const [salvando, setSalvando] = useState(false);
  const [pixCopiado, setPixCopiado] = useState(null);

  // Mapa de veículos para consulta rápida de tipo e diária
  const veiculosMap = useMemo(() => {
    const map = new Map();
    (veiculos || []).forEach(v => {
      const p = String(v.placa || v.id || '').trim().toUpperCase();
      if (p) map.set(p, v);
    });
    return map;
  }, [veiculos]);

  // 1. Consolidar Lista Completa de Motoristas
  const motoristasConsolidados = useMemo(() => {
    const map = new Map();

    // Motoristas já cadastrados
    (motoristas || []).forEach(m => {
      const p = String(m.placa || m.id || `mot_${Date.now()}`).trim().toUpperCase();
      const veiculoVinculado = veiculosMap.get(p);
      const tipoVeiculo = veiculoVinculado?.tipo || '3/4';
      const preset = getPresetPorTipo(tipoVeiculo, configDiarias?.tabela);
      const valorDiaria = veiculoVinculado?.valorDiaria !== undefined && veiculoVinculado?.valorDiaria !== ''
        ? Number(veiculoVinculado.valorDiaria)
        : preset.valorDiaria;

      map.set(p, {
        placa: p,
        nome: m.nome || '',
        telefone: m.telefone || '',
        chave_pix: m.chave_pix || m.chavePix || '',
        tipo_chave_pix: m.tipo_chave_pix || m.tipoChavePix || 'CPF / CNPJ',
        cpf: m.cpf || '',
        status: m.status || 'Ativo',
        observacao: m.observacao || '',
        tipoVeiculo,
        valorDiaria,
        isCadastrado: true,
        totalEntregas: 0
      });
    });

    // Detectar motoristas vinculados a veículos cadastrados
    (veiculos || []).forEach(v => {
      const p = String(v.placa || '').trim().toUpperCase();
      if (p && v.motoristaPadrao && !map.has(p)) {
        const preset = getPresetPorTipo(v.tipo || '3/4');
        const valorDiaria = v.valorDiaria !== undefined && v.valorDiaria !== ''
          ? Number(v.valorDiaria)
          : preset.valorDiaria;

        map.set(p, {
          placa: p,
          nome: v.motoristaPadrao,
          telefone: '',
          chave_pix: '',
          tipo_chave_pix: 'CPF / CNPJ',
          cpf: '',
          status: 'Ativo',
          observacao: '',
          tipoVeiculo: v.tipo || '3/4',
          valorDiaria,
          isCadastrado: false,
          totalEntregas: 0
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => (a.nome || a.placa).localeCompare(b.nome || b.placa));
  }, [motoristas, veiculos, veiculosMap]);

  // Filtragem
  const motoristasFiltrados = useMemo(() => {
    return motoristasConsolidados.filter(m => {
      if (filtroStatus !== 'todos' && m.status !== filtroStatus) return false;

      if (buscaTexto.trim()) {
        const t = buscaTexto.toLowerCase().trim();
        const match = 
          (m.nome || '').toLowerCase().includes(t) ||
          m.placa.toLowerCase().includes(t) ||
          (m.telefone || '').includes(t) ||
          (m.chave_pix || '').toLowerCase().includes(t) ||
          (m.cpf || '').includes(t) ||
          (m.observacao || '').toLowerCase().includes(t);
        if (!match) return false;
      }

      return true;
    });
  }, [motoristasConsolidados, filtroStatus, buscaTexto]);

  // KPIs
  const kpis = useMemo(() => {
    const total = motoristasConsolidados.length;
    const comWhats = motoristasConsolidados.filter(m => !!m.telefone).length;
    const comPix = motoristasConsolidados.filter(m => !!m.chave_pix).length;
    const ativos = motoristasConsolidados.filter(m => m.status === 'Ativo').length;
    return { total, comWhats, comPix, ativos };
  }, [motoristasConsolidados]);

  // Ações
  const handleAbrirNovoMotorista = () => {
    setModalMotorista({
      placa: '',
      nome: '',
      telefone: '',
      chave_pix: '',
      tipo_chave_pix: 'CPF / CNPJ',
      cpf: '',
      status: 'Ativo',
      observacao: ''
    });
  };

  const handleAbrirEditarMotorista = (m) => {
    setModalMotorista({
      placa: m.placa,
      nome: m.nome || '',
      telefone: m.telefone || '',
      chave_pix: m.chave_pix || '',
      tipo_chave_pix: m.tipo_chave_pix || 'CPF / CNPJ',
      cpf: m.cpf || '',
      status: m.status || 'Ativo',
      observacao: m.observacao || ''
    });
  };

  const handleCopiarPix = (chave) => {
    if (!chave) return;
    navigator.clipboard.writeText(chave);
    setPixCopiado(chave);
    setTimeout(() => setPixCopiado(null), 2500);
  };

  const handleSalvar = async (e) => {
    e?.preventDefault();
    if (!modalMotorista || (!modalMotorista.nome.trim() && !modalMotorista.placa.trim())) return;

    setSalvando(true);
    try {
      const placaAlvo = (modalMotorista.placa || `mot_${Date.now()}`).trim().toUpperCase();
      await atualizarMotoristaAdmin(placaAlvo, {
        ...modalMotorista,
        placa: placaAlvo
      });
      setModalMotorista(null);
    } catch (err) {
      console.error("Erro ao salvar motorista:", err);
      alert("Erro ao salvar dados do motorista.");
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (placa, nome) => {
    if (window.confirm(`Tem certeza que deseja remover o motorista "${nome || placa}" do cadastro?`)) {
      try {
        await removerMotoristaAdmin(placa);
      } catch (err) {
        console.error("Erro ao remover motorista:", err);
        alert("Erro ao excluir motorista.");
      }
    }
  };

  const formatarLinkWhatsApp = (tel) => {
    if (!tel) return '#';
    const limpo = tel.replace(/\D/g, '');
    const ddi = limpo.length <= 11 ? `55${limpo}` : limpo;
    return `https://wa.me/${ddi}`;
  };

  const handleExportarXLSX = () => {
    if (motoristasFiltrados.length === 0) return;

    const dataRows = motoristasFiltrados.map(m => ({
      'Nome do Motorista': m.nome || '-',
      'Veículo (Placa)': m.placa || '-',
      'Tipo de Veículo': m.tipoVeiculo || '-',
      'Valor Diária': m.valorDiaria ? `R$ ${m.valorDiaria}` : '-',
      'Telefone / WhatsApp': m.telefone || '-',
      'Tipo Chave PIX': m.tipo_chave_pix || '-',
      'Chave PIX': m.chave_pix || '-',
      'CPF': m.cpf || '-',
      'Status': m.status || 'Ativo',
      'Observações': m.observacao || '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Motoristas");
    XLSX.writeFile(workbook, `Cadastro_Motoristas_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-4">
      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-background-primary p-3.5 sm:p-4 rounded-2xl border border-border-secondary shadow-xs">
          <div className="flex items-center justify-between text-text-secondary mb-1">
            <span className="text-xs font-bold">Equipe Total</span>
            <User size={16} className="text-info" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-text-primary font-mono">
            {kpis.total}
          </div>
          <p className="text-[11px] text-text-tertiary mt-0.5">Condutores cadastrados</p>
        </div>

        <div className="bg-background-primary p-3.5 sm:p-4 rounded-2xl border border-border-secondary shadow-xs">
          <div className="flex items-center justify-between text-emerald-400 mb-1">
            <span className="text-xs font-bold text-text-secondary">Ativos</span>
            <CheckCircle2 size={16} />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
            {kpis.ativos}
          </div>
          <p className="text-[11px] text-text-tertiary mt-0.5">Em operação regular</p>
        </div>

        <div className="bg-background-primary p-3.5 sm:p-4 rounded-2xl border border-border-secondary shadow-xs">
          <div className="flex items-center justify-between text-emerald-400 mb-1">
            <span className="text-xs font-bold text-text-secondary">Com WhatsApp</span>
            <MessageSquare size={16} />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
            {kpis.comWhats}
          </div>
          <p className="text-[11px] text-text-tertiary mt-0.5">Contato direto ativo</p>
        </div>

        <div className="bg-background-primary p-3.5 sm:p-4 rounded-2xl border border-border-secondary shadow-xs">
          <div className="flex items-center justify-between text-teal-400 mb-1">
            <span className="text-xs font-bold text-text-secondary">Chave PIX Salva</span>
            <CreditCard size={16} />
          </div>
          <div className="text-xl sm:text-2xl font-black text-teal-400 font-mono">
            {kpis.comPix}
          </div>
          <p className="text-[11px] text-text-tertiary mt-0.5">Para reembolsos ágeis</p>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-background-primary p-3 sm:p-4 rounded-2xl border border-border-secondary shadow-xs">
        <div className="flex flex-1 items-center gap-2.5 w-full">
          {/* Campo de Busca */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              value={buscaTexto}
              onChange={(e) => setBuscaTexto(e.target.value)}
              placeholder="Buscar por nome do motorista, placa, telefone, PIX ou CPF..."
              className="w-full bg-background-secondary border border-border-secondary rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-info transition-colors shadow-xs"
            />
            {buscaTexto && (
              <button
                type="button"
                onClick={() => setBuscaTexto('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary p-1"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filtro de Status */}
          <div className="w-36 sm:w-44 shrink-0">
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="w-full bg-background-secondary border border-border-secondary rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-text-primary focus:outline-none focus:border-info transition-colors shadow-xs cursor-pointer"
            >
              <option value="todos">Todos os Status</option>
              <option value="Ativo">Ativo</option>
              <option value="Inativo">Inativo</option>
            </select>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={handleExportarXLSX}
            className="px-3 py-2 rounded-xl border border-border-secondary hover:bg-background-secondary text-text-primary text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Exportar Planilha de Motoristas"
          >
            <FileSpreadsheet size={15} className="text-emerald-500" />
            <span className="hidden sm:inline">Exportar Excel</span>
          </button>

          <button
            type="button"
            onClick={handleAbrirNovoMotorista}
            className="px-4 py-2 rounded-xl bg-info hover:bg-info/90 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer shrink-0"
          >
            <Plus size={16} />
            <span>Novo Motorista</span>
          </button>
        </div>
      </div>

      {/* Tabela de Motoristas (Desktop) */}
      <div className="hidden md:block bg-background-primary rounded-2xl border border-border-secondary shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-background-secondary/70 border-b border-border-secondary text-text-secondary">
                <th className="py-3.5 px-4 font-bold w-[22%]">Motorista</th>
                <th className="py-3.5 px-4 font-bold w-[16%]">Veículo & Diária</th>
                <th className="py-3.5 px-4 font-bold w-[18%]">Contato (WhatsApp)</th>
                <th className="py-3.5 px-4 font-bold w-[24%]">Chave PIX (Reembolsos)</th>
                <th className="py-3.5 px-4 font-bold w-[10%] text-center">Status</th>
                <th className="py-3.5 px-4 font-bold w-[10%] text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-secondary/60">
              {motoristasFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-text-tertiary">
                    Nenhum motorista encontrado para os filtros selecionados
                  </td>
                </tr>
              ) : (
                motoristasFiltrados.map((m) => {
                  const isAtivo = m.status === 'Ativo';
                  const temWhats = !!m.telefone;
                  const temPix = !!m.chave_pix;
                  const preset = getPresetPorTipo(m.tipoVeiculo);

                  return (
                    <tr key={m.placa || m.nome} className="hover:bg-background-secondary/40 transition-colors">
                      {/* Nome e CPF */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-text-primary block text-sm">
                          {m.nome || 'Motorista Sem Nome'}
                        </span>
                        {m.cpf && (
                          <span className="text-[11px] text-text-tertiary font-mono">
                            CPF: {m.cpf}
                          </span>
                        )}
                      </td>

                      {/* Placa, Tipo e Diária */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-black text-sm text-info block">
                          {m.placa || '-'}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={cn("text-[9.5px] font-bold px-1.5 py-0.2 rounded border", preset.badgeColor)}>
                            {preset.label}
                          </span>
                          {m.valorDiaria > 0 && (
                            <span className="text-[10px] font-mono font-bold text-emerald-400">
                              R$ {m.valorDiaria}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* WhatsApp / Telefone */}
                      <td className="py-3.5 px-4">
                        {temWhats ? (
                          <a
                            href={formatarLinkWhatsApp(m.telefone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold transition-colors"
                            title="Abrir conversa no WhatsApp"
                          >
                            <MessageSquare size={13} className="shrink-0" />
                            <span>{m.telefone}</span>
                          </a>
                        ) : (
                          <span className="text-text-tertiary italic text-[11px]">Sem telefone</span>
                        )}
                      </td>

                      {/* Chave PIX */}
                      <td className="py-3.5 px-4">
                        {temPix ? (
                          <div className="flex items-center gap-1.5">
                            <div className="truncate max-w-[200px]">
                              <span className="text-[10px] uppercase font-bold text-text-tertiary block">
                                {m.tipo_chave_pix || 'PIX'}
                              </span>
                              <span className="font-mono font-bold text-xs text-text-primary truncate block" title={m.chave_pix}>
                                {m.chave_pix}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopiarPix(m.chave_pix)}
                              className={cn(
                                "p-1.5 rounded-lg border transition-all cursor-pointer shrink-0",
                                pixCopiado === m.chave_pix
                                  ? "bg-emerald-500 text-white border-emerald-500"
                                  : "bg-background-secondary text-text-tertiary hover:text-text-primary border-border-secondary"
                              )}
                              title="Copiar Chave PIX"
                            >
                              {pixCopiado === m.chave_pix ? <Check size={13} /> : <Copy size={13} />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-text-tertiary italic text-[11px]">Sem chave cadastrada</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border inline-flex items-center gap-1",
                          isAtivo 
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                            : "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"
                        )}>
                          <span className={cn("w-1.5 h-1.5 rounded-full", isAtivo ? "bg-emerald-400" : "bg-zinc-400")} />
                          {m.status}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleAbrirEditarMotorista(m)}
                            className="p-1.5 text-text-tertiary hover:text-info hover:bg-background-secondary rounded-lg transition-colors cursor-pointer"
                            title="Editar Motorista"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExcluir(m.placa, m.nome)}
                            className="p-1.5 text-text-tertiary hover:text-danger hover:bg-danger/10 rounded-lg transition-colors cursor-pointer"
                            title="Remover Motorista"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {motoristasFiltrados.length > 0 && (
          <div className="p-3 bg-background-secondary/30 border-t border-border-secondary flex justify-between items-center text-xs text-text-tertiary">
            <span>Mostrando {motoristasFiltrados.length} motorista(s)</span>
            <span>Total na equipe: {motoristasConsolidados.length}</span>
          </div>
        )}
      </div>

      {/* Cards de Motoristas (Mobile) */}
      <div className="block md:hidden space-y-3">
        {motoristasFiltrados.length === 0 ? (
          <div className="bg-background-primary p-8 text-center rounded-2xl border border-border-secondary text-text-tertiary text-xs">
            Nenhum motorista encontrado
          </div>
        ) : (
          motoristasFiltrados.map(m => {
            const isAtivo = m.status === 'Ativo';
            const temWhats = !!m.telefone;
            const temPix = !!m.chave_pix;
            const preset = getPresetPorTipo(m.tipoVeiculo);

            return (
              <div 
                key={m.placa || m.nome}
                className="bg-background-primary p-4 rounded-2xl border border-border-secondary shadow-xs space-y-3"
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-text-primary">
                      {m.nome || 'Motorista Sem Nome'}
                    </h4>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="font-mono font-bold text-xs text-info bg-info/10 px-1.5 py-0.5 rounded border border-info/20">
                        {m.placa || 'Sem Placa'}
                      </span>
                      <span className={cn("text-[10px] font-bold px-1.5 py-0.2 rounded border", preset.badgeColor)}>
                        {preset.label}
                      </span>
                    </div>
                  </div>

                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                    isAtivo 
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      : "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"
                  )}>
                    {m.status}
                  </span>
                </div>

                {/* WhatsApp e PIX no Mobile */}
                <div className="space-y-2 pt-1 border-t border-border-secondary/60 text-xs">
                  {temWhats && (
                    <div className="flex items-center justify-between">
                      <span className="text-text-tertiary text-[11px]">WhatsApp:</span>
                      <a
                        href={formatarLinkWhatsApp(m.telefone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-emerald-400 font-bold"
                      >
                        <MessageSquare size={13} />
                        <span>{m.telefone}</span>
                      </a>
                    </div>
                  )}

                  {temPix && (
                    <div className="flex items-center justify-between">
                      <span className="text-text-tertiary text-[11px]">PIX ({m.tipo_chave_pix}):</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono font-bold text-text-primary text-[11px] truncate max-w-[130px]">
                          {m.chave_pix}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopiarPix(m.chave_pix)}
                          className="p-1 rounded bg-background-secondary text-text-secondary hover:text-text-primary border border-border-secondary"
                        >
                          {pixCopiado === m.chave_pix ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Ações Mobile */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-border-secondary/60">
                  <button
                    type="button"
                    onClick={() => handleAbrirEditarMotorista(m)}
                    className="px-3 py-1.5 rounded-xl bg-background-secondary hover:bg-info hover:text-white text-text-primary border border-border-secondary text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 size={13} />
                    <span>Editar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExcluir(m.placa, m.nome)}
                    className="px-3 py-1.5 rounded-xl bg-danger/10 hover:bg-danger hover:text-white text-danger border border-danger/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>Excluir</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL DE CADASTRO / EDIÇÃO DE MOTORISTA */}
      {modalMotorista && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-background-primary border border-border-secondary rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-border-secondary flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-info/15 text-info flex items-center justify-center font-bold">
                  <User size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-text-primary">
                    {modalMotorista.nome ? `Editar: ${modalMotorista.nome}` : 'Novo Motorista'}
                  </h3>
                  <p className="text-xs text-text-tertiary">
                    Cadastro completo de condutor, contatos e dados bancários
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalMotorista(null)}
                className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-background-secondary rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSalvar} className="p-4 space-y-3.5 flex-1 overflow-y-auto custom-scrollbar">
              {/* Nome */}
              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">
                  Nome Completo do Motorista *
                </label>
                <input
                  type="text"
                  required
                  value={modalMotorista.nome}
                  onChange={(e) => setModalMotorista({ ...modalMotorista, nome: e.target.value })}
                  placeholder="Ex: Carlos Alberto da Silva"
                  className="w-full bg-background-secondary border border-border-secondary rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-info"
                />
              </div>

              {/* Placa do Veículo e CPF */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    Placa do Veículo Principal
                  </label>
                  <input
                    type="text"
                    maxLength={8}
                    value={modalMotorista.placa}
                    onChange={(e) => setModalMotorista({ ...modalMotorista, placa: e.target.value.toUpperCase() })}
                    placeholder="Ex: ABC1D23"
                    className="w-full bg-background-secondary border border-border-secondary rounded-xl px-3 py-2 text-xs font-mono uppercase font-bold text-text-primary focus:outline-none focus:border-info"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    CPF (Opcional)
                  </label>
                  <input
                    type="text"
                    value={modalMotorista.cpf}
                    onChange={(e) => setModalMotorista({ ...modalMotorista, cpf: e.target.value })}
                    placeholder="000.000.000-00"
                    className="w-full bg-background-secondary border border-border-secondary rounded-xl px-3 py-2 text-xs font-mono text-text-primary focus:outline-none focus:border-info"
                  />
                </div>
              </div>

              {/* Telefone / WhatsApp */}
              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1 flex items-center gap-1">
                  <Phone size={13} className="text-emerald-400" />
                  <span>Telefone / WhatsApp (com DDD)</span>
                </label>
                <input
                  type="text"
                  value={modalMotorista.telefone}
                  onChange={(e) => setModalMotorista({ ...modalMotorista, telefone: e.target.value })}
                  placeholder="Ex: 71 99999-8888"
                  className="w-full bg-background-secondary border border-border-secondary rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-info"
                />
              </div>

              {/* Chave PIX e Tipo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    Tipo de Chave
                  </label>
                  <select
                    value={modalMotorista.tipo_chave_pix}
                    onChange={(e) => setModalMotorista({ ...modalMotorista, tipo_chave_pix: e.target.value })}
                    className="w-full bg-background-secondary border border-border-secondary rounded-xl px-3 py-2 text-xs font-medium text-text-primary focus:outline-none focus:border-info cursor-pointer"
                  >
                    {TIPOS_CHAVE_PIX.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-text-secondary mb-1 flex items-center gap-1">
                    <CreditCard size={13} className="text-teal-400" />
                    <span>Chave PIX para Reembolsos</span>
                  </label>
                  <input
                    type="text"
                    value={modalMotorista.chave_pix}
                    onChange={(e) => setModalMotorista({ ...modalMotorista, chave_pix: e.target.value })}
                    placeholder="Chave PIX do motorista"
                    className="w-full bg-background-secondary border border-border-secondary rounded-xl px-3 py-2 text-xs font-mono text-text-primary focus:outline-none focus:border-info"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">
                  Status do Motorista
                </label>
                <select
                  value={modalMotorista.status}
                  onChange={(e) => setModalMotorista({ ...modalMotorista, status: e.target.value })}
                  className="w-full bg-background-secondary border border-border-secondary rounded-xl px-3 py-2 text-xs font-medium text-text-primary focus:outline-none focus:border-info cursor-pointer"
                >
                  <option value="Ativo">Ativo na Operação</option>
                  <option value="Inativo">Inativo / Afastado</option>
                </select>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">
                  Observações Gerais (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={modalMotorista.observacao}
                  onChange={(e) => setModalMotorista({ ...modalMotorista, observacao: e.target.value })}
                  placeholder="Ex: Motorista com CNH E, atende rotas do Recôncavo e Feira"
                  className="w-full bg-background-secondary border border-border-secondary rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-info resize-none"
                />
              </div>

              {/* Rodapé */}
              <div className="pt-3 border-t border-border-secondary flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalMotorista(null)}
                  className="px-4 py-2 rounded-xl border border-border-secondary text-text-secondary hover:text-text-primary hover:bg-background-secondary text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-5 py-2 rounded-xl bg-info hover:bg-info/90 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {salvando ? 'Salvando...' : 'Salvar Motorista'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AbaMotoristas;
