import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { mockEntregas, mockDevolucoes } from '../data/mockData';
import { firestoreService } from '../lib/firestoreService';

export const useStore = create(
  persist(
    (set, get) => ({
      // --- Estado Inicial ---
      currentUser: null, // { role: 'Motorista' | 'Operacao' | 'Monitoramento', placa?: 'OKT9410' }
      entregas: mockEntregas,
      devolucoes: mockDevolucoes,
      cargasFinalizadas: [], // { carga: string, data: string, fotoBase64: string }
      canhotos: [],
      globalFilters: {
        data: new Date().toISOString().split('T')[0],
        visaoMonitoramento: { datas: [], placas: [], status: 'Em Aberto', busca: '' },
        devolucoes: { placa: '', status: '', busca: '' },
        relatorios: { placa: '', carga: '', rca: '', status: '' },
        canhotos: { placa: '', carga: '', busca: '' }
      },

      setGlobalFilters: (filters) => set((state) => ({
        globalFilters: { ...state.globalFilters, ...filters }
      })),

      // Setters para Sincronismo com Firestore
      setEntregas: (data) => set({ entregas: data }),
      setDevolucoes: (data) => set({ devolucoes: data }),

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
        // UI Otimista
        set((state) => ({
          entregas: state.entregas.map((e) => e.id === id ? { ...e, status: novoStatus } : e)
        }));

        await firestoreService.atualizarEntrega(id, { status: novoStatus });

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
              observacao: 'Reentrega sinalizada no sistema',
              data: new Date().toISOString(),
              historico: [{
                status: 'Pendente de recebimento',
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
        set((state) => ({
          entregas: state.entregas.map((e) => e.id === id ? { ...e, placa: novaPlaca.toUpperCase() } : e)
        }));
        await firestoreService.atualizarEntrega(id, { placa: novaPlaca.toUpperCase() });
      },

      moverParaEstoque: async (id) => {
        set((state) => ({
          entregas: state.entregas.map((e) => e.id === id ? { ...e, status: 'No estoque', placa: null } : e)
        }));
        await firestoreService.atualizarEntrega(id, { status: 'No estoque', placa: null });
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
        set((state) => ({
          entregas: state.entregas.map(e => e.id === entregaId ? { ...e, status: statusNovo } : e)
        }));

        await firestoreService.atualizarEntrega(entregaId, { status: statusNovo });

        const entregaPrincipal = get().entregas.find(e => e.id === entregaId);
        const novaDevolucao = {
          notaId: entregaId,
          nota: entregaPrincipal ? entregaPrincipal.nota : 'Desconhecida',
          placa: entregaPrincipal ? entregaPrincipal.placa : 'Desconhecida',
          tipo: tipo, 
          itens: itensDevolvidos, 
          quantidadeKg: itensDevolvidos.reduce((acc, curr) => acc + (Number(curr.peso) || 0), 0),
          status: 'Pendente de recebimento',
          observacao: motivo,
          data: new Date().toISOString(),
          historico: [{
            status: 'Pendente de recebimento',
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

      // --- Ações de Devolução ---
      adicionarDevolucao: async (devolucao) => {
        const dataStr = new Date().toISOString();
        const novaDev = { 
          ...devolucao, 
          data: dataStr,
          historico: [{
            status: devolucao.status || 'Pendente de recebimento',
            data: dataStr,
            role: get().currentUser?.role || 'Sistema',
            observacao: 'Lançamento manual de devolução'
          }]
        };
        await firestoreService.adicionarDevolucao(novaDev);
      },
      
      atualizarStatusDevolucao: async (id, novoStatus, observacao = '') => {
        const dev = get().devolucoes.find(d => d.id === id);
        if(!dev) return;

        const hist = dev.historico || [];
        const updateData = { 
          status: novoStatus,
          historico: [...hist, {
            status: novoStatus,
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
