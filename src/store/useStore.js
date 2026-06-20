import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { mockEntregas, mockDevolucoes } from '../data/mockData';
import { firestoreService } from '../lib/firestoreService';

const getBrasiliaDateString = () => {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  return `${year}-${month}-${day}`;
};

export const useStore = create(
  persist(
    (set, get) => ({
      // --- Estado Inicial ---
      currentUser: null, // { role: 'Motorista' | 'Operacao' | 'Monitoramento', placa?: 'OKT9410' }
      entregas: mockEntregas,
      devolucoes: mockDevolucoes,
      cargasFinalizadas: [], // { carga: string, data: string, fotoBase64: string }
      canhotos: [],
      despesas: [],
      motoristas: [],
      globalFilters: {
        data: getBrasiliaDateString(),
        visaoMonitoramento: { datas: [], placas: [], status: 'Em Aberto', busca: '' },
        devolucoes: { placa: '', status: '', busca: '' },
        relatorios: { placas: [], cargas: [], rcas: [], status: [], datas: [] },
        canhotos: { placa: '', carga: '', busca: '' }
      },

      setGlobalFilters: (filters) => set((state) => ({
        globalFilters: { ...state.globalFilters, ...filters }
      })),

      // Setters para Sincronismo com Firestore
      setEntregas: (data) => set({ entregas: data }),
      setDevolucoes: (data) => set({ devolucoes: data }),
      setDespesas: (data) => set({ despesas: data }),
      setMotoristas: (data) => set({ motoristas: data }),

      salvarPerfilMotorista: async (dados) => {
        const placa = get().currentUser?.placa;
        if (!placa) return;

        const motoristaUpdate = {
          ...dados,
          ultima_atualizacao: new Date().toISOString()
        };

        // Otimista
        set(state => {
          const exists = state.motoristas.find(m => m.placa === placa);
          if (exists) {
            return { motoristas: state.motoristas.map(m => m.placa === placa ? { ...m, ...motoristaUpdate } : m) };
          } else {
            return { motoristas: [...state.motoristas, { placa, ...motoristaUpdate }] };
          }
        });

        await firestoreService.salvarMotorista(placa, motoristaUpdate);
      },

      atualizarMotoristaAdmin: async (placa, dados) => {
        const motoristaUpdate = {
          ...dados,
          ultima_atualizacao: new Date().toISOString()
        };

        // Otimista
        set(state => {
          const exists = state.motoristas.find(m => m.placa === placa);
          if (exists) {
            return { motoristas: state.motoristas.map(m => m.placa === placa ? { ...m, ...motoristaUpdate } : m) };
          } else {
            return { motoristas: [...state.motoristas, { placa, ...motoristaUpdate }] };
          }
        });

        await firestoreService.salvarMotorista(placa, motoristaUpdate);
      },

      solicitarDespesa: async (dadosDespesa) => {
        const nova = {
          ...dadosDespesa,
          data_solicitacao: new Date().toISOString(),
          status: 'Pendente',
          motorista_placa: get().currentUser?.placa || 'Desconhecido'
        };
        // Otimista
        const tempId = `temp-${Date.now()}`;
        set(state => ({ despesas: [...(state.despesas || []), { id: tempId, ...nova }] }));
        
        await firestoreService.adicionarDespesa(nova);
      },

      atualizarStatusDespesa: async (id, status) => {
        set(state => ({
          despesas: (state.despesas || []).map(d => d.id === id ? { ...d, status } : d)
        }));
        await firestoreService.atualizarDespesa(id, { status });
      },

      // --- Ações de Autenticação ---
      login: (role, credentials) => {
        if (role === 'Motorista') {
          if (credentials.usuario && credentials.senha && credentials.usuario.toUpperCase() === credentials.senha.toUpperCase()) {
            set({ currentUser: { role, placa: credentials.usuario.toUpperCase() } });
            return true;
          }
          return false;
        } else if (role === 'Monitoramento') {
          if (credentials.senha === '@rj2026') {
            set({ currentUser: { role } });
            return true;
          }
          return false;
        } else if (role === 'Operacao') {
          if (credentials.senha === 'pmlog01') {
            set({ currentUser: { role } });
            return true;
          }
          return false;
        }
        return false;
      },
      logout: () => set({ currentUser: null }),

      // --- Ações de Entregas ---
      atualizarStatusEntrega: async (id, novoStatus) => {
        const entrega = get().entregas.find(e => e.id === id);
        const hist = entrega?.historico || [];
        const newHist = {
          status: novoStatus,
          data: new Date().toISOString(),
          role: get().currentUser?.role || 'Sistema',
          observacao: `Status alterado para ${novoStatus}`
        };

        // UI Otimista
        set((state) => ({
          entregas: state.entregas.map((e) => e.id === id ? { ...e, status: novoStatus, historico: [...(e.historico || []), newHist] } : e)
        }));

        await firestoreService.atualizarEntrega(id, { status: novoStatus, historico: [...hist, newHist] });

        if (novoStatus === 'Reentrega') {
          const entregaPrincipal = get().entregas.find(e => e.id === id);
          const jaTemReentrega = get().devolucoes.some(d => d.notaId === id && d.tipo === 'Reentrega');
          
          if (entregaPrincipal && !jaTemReentrega) {
            const novaDevolucao = {
              notaId: id,
              nota: entregaPrincipal.nota,
              placa: entregaPrincipal.placa,
              tipo: 'Reentrega',
              itens: [],
              quantidadeKg: Number(entregaPrincipal.peso) || 0,
              status: 'Pendente de recebimento',
              tratamento: 'Aguardando definição',
              observacao: 'Reentrega sinalizada no sistema',
              data: new Date().toISOString(),
              historico: [{
                status: 'Pendente de recebimento',
                tratamento: 'Aguardando definição',
                data: new Date().toISOString(),
                role: get().currentUser?.role || 'Sistema',
                observacao: 'Reentrega sinalizada no sistema'
              }]
            };
            await firestoreService.adicionarDevolucao(novaDevolucao);
          }
        }
      },
      
      transferirPlaca: async (id, novaPlaca) => {
        const entrega = get().entregas.find(e => e.id === id);
        const hist = entrega?.historico || [];
        const newHist = {
          status: entrega?.status || 'Transferência',
          data: new Date().toISOString(),
          role: get().currentUser?.role || 'Sistema',
          observacao: `Transferido para placa ${novaPlaca.toUpperCase()}`
        };
        set((state) => ({
          entregas: state.entregas.map((e) => e.id === id ? { ...e, placa: novaPlaca.toUpperCase(), historico: [...(e.historico || []), newHist] } : e)
        }));
        await firestoreService.atualizarEntrega(id, { placa: novaPlaca.toUpperCase(), historico: [...hist, newHist] });
      },

      moverParaEstoque: async (id) => {
        const entrega = get().entregas.find(e => e.id === id);
        const hist = entrega?.historico || [];
        const newHist = {
          status: 'No estoque',
          data: new Date().toISOString(),
          role: get().currentUser?.role || 'Sistema',
          observacao: 'Movido para o estoque'
        };
        set((state) => ({
          entregas: state.entregas.map((e) => e.id === id ? { ...e, status: 'No estoque', placa: null, historico: [...(e.historico || []), newHist] } : e)
        }));
        await firestoreService.atualizarEntrega(id, { status: 'No estoque', placa: null, historico: [...hist, newHist] });
      },

      atualizarStatusEntregaEmMassa: async (ids, novoStatus) => {
        const newHist = {
          status: novoStatus,
          data: new Date().toISOString(),
          role: get().currentUser?.role || 'Sistema',
          observacao: `Status alterado em lote para ${novoStatus}`
        };
        set((state) => ({
          entregas: state.entregas.map((e) => ids.includes(e.id) ? { ...e, status: novoStatus, historico: [...(e.historico || []), newHist] } : e)
        }));

        for (const id of ids) {
          const entrega = get().entregas.find(e => e.id === id);
          const hist = entrega?.historico || [];
          await firestoreService.atualizarEntrega(id, { status: novoStatus, historico: [...hist, newHist] });
          if (novoStatus === 'Reentrega') {
            const entregaPrincipal = get().entregas.find(e => e.id === id);
            const jaTemReentrega = get().devolucoes.some(d => d.notaId === id && d.tipo === 'Reentrega');
            if (entregaPrincipal && !jaTemReentrega) {
              const novaDevolucao = {
                notaId: id,
                nota: entregaPrincipal.nota,
                placa: entregaPrincipal.placa,
                tipo: 'Reentrega',
                itens: [],
                quantidadeKg: Number(entregaPrincipal.peso) || 0,
                status: 'Pendente de recebimento',
                tratamento: 'Aguardando definição',
                observacao: 'Reentrega sinalizada no sistema',
                data: new Date().toISOString(),
                historico: [{
                  status: 'Pendente de recebimento',
                  tratamento: 'Aguardando definição',
                  data: new Date().toISOString(),
                  role: get().currentUser?.role || 'Sistema',
                  observacao: 'Reentrega sinalizada no sistema'
                }]
              };
              await firestoreService.adicionarDevolucao(novaDevolucao);
            }
          }
        }
      },

      transferirPlacaEmMassa: async (ids, novaPlaca) => {
        const newHist = {
          status: 'Transferência',
          data: new Date().toISOString(),
          role: get().currentUser?.role || 'Sistema',
          observacao: `Transferido em lote para placa ${novaPlaca.toUpperCase()}`
        };
        set((state) => ({
          entregas: state.entregas.map((e) => ids.includes(e.id) ? { ...e, placa: novaPlaca.toUpperCase(), historico: [...(e.historico || []), newHist] } : e)
        }));
        for (const id of ids) {
          const entrega = get().entregas.find(e => e.id === id);
          const hist = entrega?.historico || [];
          await firestoreService.atualizarEntrega(id, { placa: novaPlaca.toUpperCase(), historico: [...hist, newHist] });
        }
      },

      moverParaEstoqueEmMassa: async (ids) => {
        const newHist = {
          status: 'No estoque',
          data: new Date().toISOString(),
          role: get().currentUser?.role || 'Sistema',
          observacao: 'Movido em lote para o estoque'
        };
        set((state) => ({
          entregas: state.entregas.map((e) => ids.includes(e.id) ? { ...e, status: 'No estoque', placa: null, historico: [...(e.historico || []), newHist] } : e)
        }));
        for (const id of ids) {
          const entrega = get().entregas.find(e => e.id === id);
          const hist = entrega?.historico || [];
          await firestoreService.atualizarEntrega(id, { status: 'No estoque', placa: null, historico: [...hist, newHist] });
        }
      },

      toggleCanhoto: async (id) => {
        const entrega = get().entregas.find(e => e.id === id);
        if(!entrega) return;
        const novoStatus = !entrega.canhoto;
        set((state) => ({
          entregas: state.entregas.map((e) => e.id === id ? { ...e, canhoto: novoStatus } : e)
        }));
        await firestoreService.atualizarEntrega(id, { canhoto: novoStatus });
      },

      toggleCanhotoEmMassa: async (ids, canhotoStatus) => {
        set((state) => ({
          entregas: state.entregas.map((e) => ids.includes(e.id) ? { ...e, canhoto: canhotoStatus } : e)
        }));
        for (const id of ids) {
           await firestoreService.atualizarEntrega(id, { canhoto: canhotoStatus });
        }
      },

      finalizarCarga: (carga, data, fotoBase64) => set((state) => ({
        cargasFinalizadas: [
          ...state.cargasFinalizadas, 
          { carga, data, fotoBase64, finalizadoEm: new Date().toISOString() }
        ]
      })),

      registrarDevolucao: async (entregaId, tipo, itensDevolvidos, motivo) => {
        const statusNovo = tipo === 'Total' ? 'Devolução total' : 'Entrega parcial';
        const entregaOriginal = get().entregas.find(e => e.id === entregaId);
        const histOriginal = entregaOriginal?.historico || [];
        const newHist = {
          status: statusNovo,
          data: new Date().toISOString(),
          role: get().currentUser?.role || 'Sistema',
          observacao: motivo || `Lançamento de devolução ${tipo}`
        };

        set((state) => ({
          entregas: state.entregas.map(e => e.id === entregaId ? { ...e, status: statusNovo, historico: [...(e.historico || []), newHist] } : e)
        }));

        await firestoreService.atualizarEntrega(entregaId, { status: statusNovo, historico: [...histOriginal, newHist] });

        const entregaPrincipal = get().entregas.find(e => e.id === entregaId);
        const novaDevolucao = {
          notaId: entregaId,
          nota: entregaPrincipal ? entregaPrincipal.nota : 'Desconhecida',
          placa: entregaPrincipal ? entregaPrincipal.placa : 'Desconhecida',
          tipo: tipo, 
          itens: itensDevolvidos, 
          quantidadeKg: itensDevolvidos.reduce((acc, curr) => acc + (Number(curr.peso) || 0), 0),
          status: 'Pendente de recebimento',
          tratamento: 'Aguardando definição',
          observacao: motivo,
          data: new Date().toISOString(),
          historico: [{
            status: 'Pendente de recebimento',
            tratamento: 'Aguardando definição',
            data: new Date().toISOString(),
            role: get().currentUser?.role || 'Sistema',
            observacao: motivo
          }]
        };
        await firestoreService.adicionarDevolucao(novaDevolucao);
      },

      importarEntregas: async (novasEntregas) => {
        const entregasAtuais = [...get().entregas];
        await firestoreService.importarEntregas(novasEntregas, entregasAtuais);
      },

      removerEntregasPorData: async (dataStr) => {
        set((state) => ({
          entregas: state.entregas.filter(e => e.data !== dataStr)
        }));
        await firestoreService.removerEntregasPorData(dataStr);
      },

      restaurarBackup: async (backupData) => {
        // As atualizações no Zustand acontecerão via onSnapshot automaticamente
        await firestoreService.restaurarBackup(backupData);
      },

      // --- Ações de Devolução ---
      adicionarDevolucao: async (devolucao) => {
        const dataStr = new Date().toISOString();
        const novaDev = { 
          ...devolucao, 
          tratamento: devolucao.tratamento || 'Aguardando definição',
          data: dataStr,
          historico: [{
            status: devolucao.status || 'Pendente de recebimento',
            tratamento: devolucao.tratamento || 'Aguardando definição',
            data: dataStr,
            role: get().currentUser?.role || 'Sistema',
            observacao: 'Lançamento manual de devolução'
          }]
        };
        await firestoreService.adicionarDevolucao(novaDev);
      },
      
      atualizarStatusDevolucao: async (id, novoStatus, observacao = '', tratamento) => {
        const dev = get().devolucoes.find(d => d.id === id);
        if(!dev) return;

        const hist = dev.historico || [];
        const updateData = { 
          status: novoStatus,
          ...(tratamento ? { tratamento } : {}),
          historico: [...hist, {
            status: novoStatus,
            tratamento: tratamento || dev.tratamento || 'Aguardando definição',
            data: new Date().toISOString(),
            role: get().currentUser?.role || 'Sistema',
            observacao: observacao || `Status alterado para ${novoStatus}`
          }]
        };
        set((state) => ({
          devolucoes: state.devolucoes.map(d => d.id === id ? { ...d, ...updateData } : d)
        }));
        await firestoreService.atualizarDevolucao(id, updateData);
      },

      removerDevolucao: async (id) => {
        set((state) => ({
          devolucoes: state.devolucoes.filter(d => d.id !== id)
        }));
        await firestoreService.removerDevolucao(id);
      },

      editarDevolucao: async (id, dadosAtualizados) => {
        set((state) => ({
          devolucoes: state.devolucoes.map(d => d.id === id ? { ...d, ...dadosAtualizados } : d)
        }));
        await firestoreService.atualizarDevolucao(id, dadosAtualizados);
      }
    }),
    {
      name: 'logistrack-storage',
      partialize: (state) => Object.fromEntries(
        // Não persistir globalFilters (pois resetam por sessão)
        // Não persistir entregas e devolucoes pois o Firestore gerencia e previne conflitos de abas antigas
        Object.entries(state).filter(([key]) => !['globalFilters', 'entregas', 'devolucoes'].includes(key))
      ),
    }
  )
);
