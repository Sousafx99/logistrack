import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { mockEntregas, mockDevolucoes } from '../data/mockData';
import { firestoreService } from '../lib/firestoreService';
import { storageService } from '../lib/storageService';

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

const formatarDuracaoMinutos = (minutos) => {
  if (minutos === null || minutos === undefined || isNaN(minutos)) return null;
  const m = Math.max(0, Math.round(minutos));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem} min`;
  return `${h}h ${rem}min`;
};

export const useStore = create(
  persist(
    (set, get) => ({
      // --- Estado Inicial ---
      currentUser: null, // { role: 'Motorista' | 'Operacao' | 'Monitoramento', placa?: 'OKT9410' }
      entregas: mockEntregas,
      devolucoes: mockDevolucoes,
      cargasFinalizadas: [], // { carga: string, data: string, placa: string, fotoUrl: string, fotoBase64: string }
      canhotos: [],
      despesas: [],
      motoristas: [],
      kmRegistros: [], // { id, data, placa, carga, motoristaNome, kmPrevisto, kmInicial, kmFinal, kmExecutado, diferencaKm, fotoKmInicial, fotoKmFinal, atualizadoEm }
      clientesGeoloc: [], // { codCliente, cliente, municipio, bairro, pontos: [{ id, nomeLocal, lat, lng, endereco, padrao, criadoPor, criadoEm }] }
      solicitacoesGeoloc: [], // { id, codCliente, clienteNome, motoristaPlaca, motoristaNome, carga, data, lat, lng, precisaoMetros, nomeLocalSugerido, status, motivoRecusa, criadoEm }
      modalPerfilMotoristaOpen: false,
      setModalPerfilMotoristaOpen: (open) => set({ modalPerfilMotoristaOpen: open }),

      globalFilters: {
        data: getBrasiliaDateString(),
        visaoMonitoramento: { datas: [], placas: [], status: 'Em Aberto', busca: '' },
        devolucoes: { datas: [], notas: [], placas: [], tipos: [], status: [], rcas: [], busca: '' },
        relatorios: { placas: [], cargas: [], rcas: [], status: [], datas: [] },
        canhotos: { placa: '', carga: '', busca: '' }
      },

      setGlobalFilters: (filters) => set((state) => ({
        globalFilters: { ...state.globalFilters, ...filters }
      })),

      // Setters para Sincronismo com Firestore
      setEntregas: (data) => set((state) => {
        const hoje = getBrasiliaDateString();
        const lista = data || [];
        const temHoje = lista.some(e => e.data === hoje);
        
        let dataAlvo = hoje;
        if (!temHoje && lista.length > 0) {
          const datas = Array.from(new Set(lista.map(e => e.data).filter(Boolean)));
          datas.sort((a, b) => b.localeCompare(a));
          if (datas.length > 0) {
            dataAlvo = datas[0];
          }
        }

        const dataAtual = state.globalFilters?.data;
        const temDataAtual = lista.some(e => e.data === dataAtual);
        // Se a data atual não existir nas entregas ou for hoje sem ter carga, seleciona a dataAlvo
        const dataFinal = (temDataAtual && (dataAtual !== hoje || temHoje)) ? dataAtual : dataAlvo;

        return {
          entregas: lista,
          globalFilters: {
            ...state.globalFilters,
            data: dataFinal
          }
        };
      }),
      setDevolucoes: (data) => set({ devolucoes: data }),
      setDespesas: (data) => set({ despesas: data }),
      setMotoristas: (data) => set({ motoristas: data }),
      setCargasFinalizadas: (data) => set({ cargasFinalizadas: data }),
      setKmRegistros: (data) => set({ kmRegistros: data }),
      setClientesGeoloc: (data) => set({ clientesGeoloc: data }),
      setSolicitacoesGeoloc: (data) => set({ solicitacoesGeoloc: data }),
      setSolicitacoesDevolucao: (data) => set({ solicitacoesDevolucao: data }),

      // Ações de Controle de KM
      salvarKmRegistro: async (kmData) => {
        const dataStr = kmData.data || 'sem-data';
        const placaStr = (kmData.placa || 'sem-placa').replace(/[\/\\]/g, '-');
        const cargaStr = (kmData.carga || 'sem-carga').replace(/[\/\\]/g, '-');
        const docId = kmData.id || `${dataStr}_${placaStr}_${cargaStr}`;

        const kmInicial = kmData.kmInicial !== undefined && kmData.kmInicial !== '' && kmData.kmInicial !== null ? Number(kmData.kmInicial) : null;
        const kmFinal = kmData.kmFinal !== undefined && kmData.kmFinal !== '' && kmData.kmFinal !== null ? Number(kmData.kmFinal) : null;
        const kmPrevisto = kmData.kmPrevisto !== undefined && kmData.kmPrevisto !== '' && kmData.kmPrevisto !== null ? Number(kmData.kmPrevisto) : null;
        
        let kmExecutado = null;
        if (kmInicial !== null && kmFinal !== null && kmFinal >= kmInicial) {
          kmExecutado = kmFinal - kmInicial;
        }

        let diferencaKm = null;
        if (kmExecutado !== null && kmPrevisto !== null) {
          diferencaKm = kmExecutado - kmPrevisto;
        }

        const payload = {
          ...kmData,
          id: docId,
          kmInicial,
          kmFinal,
          kmPrevisto,
          kmExecutado,
          diferencaKm,
          atualizadoEm: new Date().toISOString()
        };

        // Atualização otimista
        set(state => {
          const list = state.kmRegistros || [];
          const exists = list.some(k => k.id === docId);
          if (exists) {
            return { kmRegistros: list.map(k => k.id === docId ? { ...k, ...payload } : k) };
          } else {
            return { kmRegistros: [...list, payload] };
          }
        });

        await firestoreService.salvarKmRegistro(payload);
        return docId;
      },

      salvarKmPrevisto: async (data, placa, carga, kmPrevisto) => {
        const docId = `${data}_${(placa || 'sem-placa').replace(/[\/\\]/g, '-')}_${(carga || 'sem-carga').replace(/[\/\\]/g, '-')}`;
        const existing = (get().kmRegistros || []).find(k => k.id === docId) || {};
        return get().salvarKmRegistro({
          ...existing,
          data,
          placa,
          carga,
          kmPrevisto
        });
      },

      registrarKmInicial: async (data, placa, carga, kmInicial, fotoBase64 = null) => {
        const docId = `${data}_${(placa || 'sem-placa').replace(/[\/\\]/g, '-')}_${(carga || 'sem-carga').replace(/[\/\\]/g, '-')}`;
        const existing = (get().kmRegistros || []).find(k => k.id === docId) || {};
        return get().salvarKmRegistro({
          ...existing,
          data,
          placa,
          carga,
          kmInicial,
          ...(fotoBase64 ? { fotoKmInicial: fotoBase64 } : {}),
          dataHoraInicio: existing.dataHoraInicio || new Date().toISOString()
        });
      },

      registrarKmFinal: async (data, placa, carga, kmFinal, fotoBase64 = null) => {
        const docId = `${data}_${(placa || 'sem-placa').replace(/[\/\\]/g, '-')}_${(carga || 'sem-carga').replace(/[\/\\]/g, '-')}`;
        const existing = (get().kmRegistros || []).find(k => k.id === docId) || {};
        return get().salvarKmRegistro({
          ...existing,
          data,
          placa,
          carga,
          kmFinal,
          ...(fotoBase64 ? { fotoKmFinal: fotoBase64 } : {}),
          dataHoraFim: new Date().toISOString()
        });
      },

      // Ações de Geolocalização de Clientes
      salvarClienteGeoloc: async (codCliente, dadosCliente) => {
        const docId = String(codCliente).trim();
        set(state => {
          const list = state.clientesGeoloc || [];
          const exists = list.some(c => String(c.codCliente).trim() === docId || String(c.id).trim() === docId);
          const updated = { ...dadosCliente, codCliente: docId, id: docId, atualizadoEm: new Date().toISOString() };
          if (exists) {
            return { clientesGeoloc: list.map(c => (String(c.codCliente).trim() === docId || String(c.id).trim() === docId) ? { ...c, ...updated } : c) };
          } else {
            return { clientesGeoloc: [...list, updated] };
          }
        });
        return firestoreService.salvarClienteGeoloc(docId, dadosCliente);
      },

      salvarPontoCliente: async (codCliente, ponto, dadosBasicosCliente = {}) => {
        const docId = String(codCliente).trim();
        const pontoId = ponto.id || `${Date.now()}`;
        const pontoComId = {
          ...ponto,
          id: pontoId,
          lat: Number(ponto.lat),
          lng: Number(ponto.lng),
          criadoEm: ponto.criadoEm || new Date().toISOString()
        };

        set(state => {
          const list = state.clientesGeoloc || [];
          const client = list.find(c => String(c.codCliente).trim() === docId || String(c.id).trim() === docId);
          let pontos = client?.pontos ? [...client.pontos] : [];
          if (pontos.some(p => p.id === pontoId)) {
            pontos = pontos.map(p => p.id === pontoId ? pontoComId : p);
          } else {
            pontos = [...pontos, pontoComId];
          }
          const updatedClient = {
            ...(client || {}),
            ...dadosBasicosCliente,
            codCliente: docId,
            id: docId,
            pontos,
            atualizadoEm: new Date().toISOString()
          };
          if (client) {
            return { clientesGeoloc: list.map(c => (String(c.codCliente).trim() === docId || String(c.id).trim() === docId) ? updatedClient : c) };
          } else {
            return { clientesGeoloc: [...list, updatedClient] };
          }
        });

        return firestoreService.salvarPontoCliente(docId, pontoComId, dadosBasicosCliente);
      },

      removerPontoCliente: async (codCliente, pontoId) => {
        const docId = String(codCliente).trim();
        set(state => {
          const list = state.clientesGeoloc || [];
          return {
            clientesGeoloc: list.map(c => {
              if (String(c.codCliente).trim() === docId || String(c.id).trim() === docId) {
                return {
                  ...c,
                  pontos: (c.pontos || []).filter(p => p.id !== pontoId),
                  atualizadoEm: new Date().toISOString()
                };
              }
              return c;
            })
          };
        });
        return firestoreService.removerPontoCliente(docId, pontoId);
      },

      importarClientesGeolocEmLote: async (clientesLista) => {
        set(state => {
          const map = new Map();
          (state.clientesGeoloc || []).forEach(c => map.set(String(c.codCliente || c.id).trim(), c));
          clientesLista.forEach(c => {
            const cod = String(c.codCliente || c.id).trim();
            if (cod) {
              const existing = map.get(cod) || {};
              map.set(cod, { ...existing, ...c, codCliente: cod, atualizadoEm: new Date().toISOString() });
            }
          });
          return { clientesGeoloc: Array.from(map.values()) };
        });

        await firestoreService.importarClientesGeolocEmLote(clientesLista);
      },

      solicitarAjusteGeoloc: async (solicitacao) => {
        const docId = `solic_${Date.now()}_${String(solicitacao.codCliente).replace(/[\/\\]/g, '-')}`;
        const payload = {
          ...solicitacao,
          id: docId,
          codCliente: String(solicitacao.codCliente).trim(),
          lat: Number(solicitacao.lat),
          lng: Number(solicitacao.lng),
          status: 'Pendente',
          criadoEm: new Date().toISOString()
        };
        set(state => ({
          solicitacoesGeoloc: [payload, ...(state.solicitacoesGeoloc || [])]
        }));
        return firestoreService.solicitarAjusteGeoloc(payload);
      },

      aprovarSolicitacaoGeoloc: async (solicitacaoId, dadosAprovados = {}) => {
        const solic = (get().solicitacoesGeoloc || []).find(s => s.id === solicitacaoId);
        set(state => ({
          solicitacoesGeoloc: (state.solicitacoesGeoloc || []).map(s => s.id === solicitacaoId ? { ...s, status: 'Aprovado', aprovadoEm: new Date().toISOString() } : s)
        }));
        if (solic) {
          const codCliente = String(solic.codCliente).trim();
          const novoPonto = {
            id: `${Date.now()}`,
            nomeLocal: dadosAprovados.nomeLocal || solic.nomeLocalSugerido || 'Ponto de Descarga',
            lat: Number(dadosAprovados.lat || solic.lat),
            lng: Number(dadosAprovados.lng || solic.lng),
            endereco: dadosAprovados.endereco || solic.endereco || '',
            padrao: true,
            criadoPor: `Motorista (${solic.motoristaPlaca || 'S/ Placa'}) - ${solic.motoristaNome || ''}`,
            criadoEm: new Date().toISOString()
          };
          await get().salvarPontoCliente(codCliente, novoPonto, {
            cliente: solic.clienteNome || '',
            municipio: solic.municipio || '',
            bairro: solic.bairro || ''
          });
        }
        return firestoreService.aprovarSolicitacaoGeoloc(solicitacaoId, dadosAprovados);
      },

      recusarSolicitacaoGeoloc: async (solicitacaoId, motivo = '') => {
        set(state => ({
          solicitacoesGeoloc: (state.solicitacoesGeoloc || []).map(s => s.id === solicitacaoId ? { ...s, status: 'Recusado', motivoRecusa: motivo, recusadoEm: new Date().toISOString() } : s)
        }));
        return firestoreService.recusarSolicitacaoGeoloc(solicitacaoId, motivo);
      },

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
        const placa = get().currentUser?.placa || 'Desconhecido';
        const tempId = `temp-${Date.now()}`;
        let comprovanteUrl = dadosDespesa.comprovante || '';
        const nowIso = new Date().toISOString();

        const nova = {
          ...dadosDespesa,
          id: tempId,
          data_solicitacao: nowIso,
          criadoEm: nowIso,
          status: 'Pendente',
          motorista_placa: placa
        };

        // Otimista
        set(state => ({ despesas: [...(state.despesas || []), nova] }));
        
        try {
          if (dadosDespesa.comprovante && dadosDespesa.comprovante.startsWith('data:')) {
            comprovanteUrl = await storageService.uploadComprovanteDespesa(dadosDespesa.comprovante, tempId);
          }

          const docId = await firestoreService.adicionarDespesa({
            ...dadosDespesa,
            comprovante: comprovanteUrl,
            data_solicitacao: nowIso,
            criadoEm: nowIso,
            status: 'Pendente',
            motorista_placa: placa
          });

          set(state => ({
            despesas: (state.despesas || []).map(d => d.id === tempId ? { ...d, id: docId, comprovante: comprovanteUrl } : d)
          }));
        } catch (err) {
          console.error('Erro ao adicionar despesa no Firestore/Storage:', err);
        }
      },

      atualizarStatusDespesa: async (id, status, observacao = '') => {
        const nowIso = new Date().toISOString();
        const payload = {
          status,
          respondidoEm: nowIso,
          atualizadoEm: nowIso,
          ...(observacao ? { observacaoMonitoramento: observacao } : {})
        };
        set(state => ({
          despesas: (state.despesas || []).map(d => d.id === id ? { ...d, ...payload } : d)
        }));
        await firestoreService.atualizarDespesa(id, payload);
      },

      // --- Ações de Autenticação ---
      login: (role, credentials) => {
        if (role === 'Motorista') {
          const u = String(credentials?.usuario || '').trim().toUpperCase();
          const s = String(credentials?.senha || '').trim().toUpperCase();
          if (u && s && u === s) {
            set({ currentUser: { role, placa: u } });
            try {
              sessionStorage.setItem('logistrack_recem_logado', 'true');
            } catch (e) {}
            return true;
          }
          return false;
        } else if (role === 'Monitoramento') {
          if (String(credentials?.senha || '').trim() === '@rj2026') {
            set({ currentUser: { role } });
            return true;
          }
          return false;
        } else if (role === 'Operacao') {
          if (String(credentials?.senha || '').trim() === 'pmlog01') {
            set({ currentUser: { role } });
            return true;
          }
          return false;
        }
        return false;
      },
      logout: () => {
        try {
          sessionStorage.removeItem('logistrack_recem_logado');
        } catch (e) {}
        set({ currentUser: null });
      },

      // --- Ações de Entregas ---
      atualizarStatusEntrega: async (id, novoStatus) => {
        const entrega = get().entregas.find(e => e.id === id);
        if (!entrega) return;
        const nowIso = new Date().toISOString();
        const hist = entrega?.historico || [];
        const newHist = {
          status: novoStatus,
          data: nowIso,
          role: get().currentUser?.role || 'Sistema',
          observacao: `Status alterado para ${novoStatus}`
        };

        const isChegada = ['No cliente', 'Descarregando'].includes(novoStatus);
        const isConclusao = ['Entrega total', 'Entrega parcial', 'Devolução total', 'Reentrega', 'Carga parada'].includes(novoStatus);

        let horaChegada = entrega.horaChegada || null;
        let horaSaida = entrega.horaSaida || null;
        let tempoMinutos = entrega.tempoMinutos !== undefined ? entrega.tempoMinutos : null;
        let tempoFormatado = entrega.tempoFormatado || null;

        const todasEntregas = get().entregas;
        const codCli = entrega.codCliente;
        const notasDoMesmoCliente = todasEntregas.filter(e => 
          e.data === entrega.data && 
          (e.carga || '') === (entrega.carga || '') && 
          (e.placa || '') === (entrega.placa || '') && 
          ((codCli && e.codCliente === codCli) || (e.cliente && e.cliente === entrega.cliente))
        );

        if (isChegada && !horaChegada) {
          const jaTemChegadaEmOutra = notasDoMesmoCliente.find(e => e.horaChegada)?.horaChegada;
          horaChegada = jaTemChegadaEmOutra || nowIso;
        }

        if (isConclusao) {
          horaSaida = nowIso;
          if (!horaChegada) {
            horaChegada = notasDoMesmoCliente.find(e => e.horaChegada)?.horaChegada || null;
          }
          if (horaChegada) {
            const diffMs = new Date(horaSaida).getTime() - new Date(horaChegada).getTime();
            tempoMinutos = Math.max(0, Math.round(diffMs / 60000));
            tempoFormatado = formatarDuracaoMinutos(tempoMinutos);
          }
        }

        const isDevolucaoStatus = ['Devolução total', 'Entrega parcial', 'Reentrega', 'Devolução de gramatura'].includes(novoStatus);

        const fieldsToUpdate = {
          status: novoStatus,
          historico: [...hist, newHist],
          ...(horaChegada ? { horaChegada } : {}),
          ...(horaSaida ? { horaSaida } : {}),
          ...(tempoMinutos !== null ? { tempoMinutos, tempoFormatado } : {}),
          ...(!isDevolucaoStatus ? { solicitacaoDevolucaoPendente: false, solicitacaoDevolucaoTipo: null } : {})
        };

        // UI Otimista
        set((state) => ({
          entregas: state.entregas.map((e) => {
            if (e.id === id) {
              return { ...e, ...fieldsToUpdate };
            }
            if (isChegada && horaChegada && notasDoMesmoCliente.some(n => n.id === e.id) && !e.horaChegada) {
              return { ...e, horaChegada };
            }
            return e;
          })
        }));

        await firestoreService.atualizarEntrega(id, fieldsToUpdate);

        // Se o novo status NÃO for de devolução/reentrega (ex: mudou para Pendente, No cliente, Entrega total):
        // remove qualquer registro de devolução existente vinculado a esta nota
        if (!isDevolucaoStatus) {
          const devolucoesRemover = (get().devolucoes || []).filter(d => 
            d.notaId === id || String(d.nota) === String(entrega.nota)
          );
          if (devolucoesRemover.length > 0) {
            const idsParaRemover = devolucoesRemover.map(d => d.id);
            set(state => ({
              devolucoes: (state.devolucoes || []).filter(d => !idsParaRemover.includes(d.id))
            }));
            for (const dev of devolucoesRemover) {
              await firestoreService.removerDevolucao(dev.id);
            }
          }

          // Cancela solicitações pendentes desta nota se houver
          const solicsParaCancelar = (get().solicitacoesDevolucao || []).filter(s =>
            (s.entregaId === id || String(s.nota) === String(entrega.nota)) && s.statusSolicitacao === 'Pendente'
          );
          if (solicsParaCancelar.length > 0) {
            set(state => ({
              solicitacoesDevolucao: (state.solicitacoesDevolucao || []).map(s => 
                solicsParaCancelar.some(sc => sc.id === s.id) ? { ...s, statusSolicitacao: 'Cancelado' } : s
              )
            }));
            for (const s of solicsParaCancelar) {
              await firestoreService.atualizarSolicitacaoDevolucao(s.id, { statusSolicitacao: 'Cancelado' });
            }
          }
        }

        if (isChegada && horaChegada) {
          for (const irma of notasDoMesmoCliente) {
            if (irma.id !== id && !irma.horaChegada) {
              await firestoreService.atualizarEntrega(irma.id, { horaChegada });
            }
          }
        }

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
        const nowIso = new Date().toISOString();
        const isChegada = ['No cliente', 'Descarregando'].includes(novoStatus);
        const isConclusao = ['Entrega total', 'Entrega parcial', 'Devolução total', 'Reentrega', 'Carga parada'].includes(novoStatus);

        const newHist = {
          status: novoStatus,
          data: nowIso,
          role: get().currentUser?.role || 'Sistema',
          observacao: `Status alterado em lote para ${novoStatus}`
        };

        set((state) => ({
          entregas: state.entregas.map((e) => {
            if (!ids.includes(e.id)) return e;
            const horaChegada = (isChegada && !e.horaChegada) ? nowIso : (e.horaChegada || null);
            let horaSaida = isConclusao ? nowIso : (e.horaSaida || null);
            let tempoMinutos = e.tempoMinutos;
            let tempoFormatado = e.tempoFormatado;
            if (isConclusao && horaChegada) {
              const diffMs = new Date(horaSaida).getTime() - new Date(horaChegada).getTime();
              tempoMinutos = Math.max(0, Math.round(diffMs / 60000));
              tempoFormatado = formatarDuracaoMinutos(tempoMinutos);
            }
            return {
              ...e,
              status: novoStatus,
              historico: [...(e.historico || []), newHist],
              ...(horaChegada ? { horaChegada } : {}),
              ...(horaSaida ? { horaSaida } : {}),
              ...(tempoMinutos !== null && tempoMinutos !== undefined ? { tempoMinutos, tempoFormatado } : {})
            };
          })
        }));

        for (const id of ids) {
          const entrega = get().entregas.find(e => e.id === id);
          const hist = entrega?.historico || [];
          const horaChegada = (isChegada && !entrega?.horaChegada) ? nowIso : (entrega?.horaChegada || null);
          let horaSaida = isConclusao ? nowIso : (entrega?.horaSaida || null);
          let tempoMinutos = entrega?.tempoMinutos;
          let tempoFormatado = entrega?.tempoFormatado;
          if (isConclusao && horaChegada) {
            const diffMs = new Date(horaSaida).getTime() - new Date(horaChegada).getTime();
            tempoMinutos = Math.max(0, Math.round(diffMs / 60000));
            tempoFormatado = formatarDuracaoMinutos(tempoMinutos);
          }

          const isDevolucaoStatus = ['Devolução total', 'Entrega parcial', 'Reentrega', 'Devolução de gramatura'].includes(novoStatus);

          const updatePayload = {
            status: novoStatus,
            historico: [...hist, newHist],
            ...(horaChegada ? { horaChegada } : {}),
            ...(horaSaida ? { horaSaida } : {}),
            ...(tempoMinutos !== null && tempoMinutos !== undefined ? { tempoMinutos, tempoFormatado } : {}),
            ...(!isDevolucaoStatus ? { solicitacaoDevolucaoPendente: false, solicitacaoDevolucaoTipo: null } : {})
          };

          await firestoreService.atualizarEntrega(id, updatePayload);

          if (!isDevolucaoStatus) {
            const devolucoesRemover = (get().devolucoes || []).filter(d => 
              d.notaId === id || (entrega && String(d.nota) === String(entrega.nota))
            );
            if (devolucoesRemover.length > 0) {
              const idsParaRemover = devolucoesRemover.map(d => d.id);
              set(state => ({
                devolucoes: (state.devolucoes || []).filter(d => !idsParaRemover.includes(d.id))
              }));
              for (const dev of devolucoesRemover) {
                await firestoreService.removerDevolucao(dev.id);
              }
            }
          }

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

      finalizarCarga: async (carga, data, fotoBase64, placaParam) => {
        const placa = placaParam || get().currentUser?.placa || 'Sem Placa';
        const finalizadoEm = new Date().toISOString();
        const docId = `${data || 'sem-data'}_${(carga || 'sem-carga').replace(/[\/\\]/g, '-')}_${placa.replace(/[\/\\]/g, '-')}`;

        const tempItem = { 
          id: docId,
          carga, 
          data, 
          placa, 
          fotoBase64, 
          fotoUrl: fotoBase64,
          finalizadoEm 
        };
        
        // Atualização otimista no Zustand
        set((state) => ({
          cargasFinalizadas: [
            ...(state.cargasFinalizadas || []).filter(cf => cf.id !== docId && !(cf.carga === carga && cf.data === data && cf.placa === placa)), 
            tempItem
          ]
        }));

        try {
          // Upload para o Firebase Storage (se foto for base64)
          let fotoUrl = fotoBase64;
          if (fotoBase64 && typeof fotoBase64 === 'string' && fotoBase64.startsWith('data:')) {
            fotoUrl = await storageService.uploadCanhoteira(fotoBase64, data, carga, placa);
          }

          // Salva no Firestore
          await firestoreService.salvarCargaFinalizada({
            id: docId,
            carga,
            data,
            placa,
            fotoUrl: fotoUrl || '',
            // Se for fallback base64 salva fotoBase64 para exibição
            ...(fotoUrl.startsWith('data:') ? { fotoBase64: fotoUrl } : {}),
            finalizadoEm
          });
        } catch (err) {
          console.error('Erro ao finalizar carga no Firebase:', err);
        }
      },

      registrarDevolucao: async (entregaId, tipo, itensDevolvidos, motivo) => {
        const statusNovo = tipo === 'Total' ? 'Devolução total' : 'Entrega parcial';
        const entregaOriginal = get().entregas.find(e => e.id === entregaId);
        const histOriginal = entregaOriginal?.historico || [];
        const nowIso = new Date().toISOString();
        const newHist = {
          status: statusNovo,
          data: nowIso,
          role: get().currentUser?.role || 'Sistema',
          observacao: motivo || `Lançamento de devolução ${tipo}`
        };

        const horaSaida = nowIso;
        let horaChegada = entregaOriginal?.horaChegada || null;
        let tempoMinutos = entregaOriginal?.tempoMinutos;
        let tempoFormatado = entregaOriginal?.tempoFormatado;

        if (!horaChegada) {
          const todasEntregas = get().entregas;
          const codCli = entregaOriginal?.codCliente;
          const notasDoMesmoCliente = todasEntregas.filter(e => 
            e.data === entregaOriginal?.data && 
            (e.carga || '') === (entregaOriginal?.carga || '') && 
            (e.placa || '') === (entregaOriginal?.placa || '') && 
            ((codCli && e.codCliente === codCli) || (e.cliente && e.cliente === entregaOriginal?.cliente))
          );
          horaChegada = notasDoMesmoCliente.find(e => e.horaChegada)?.horaChegada || null;
        }

        if (horaChegada) {
          const diffMs = new Date(horaSaida).getTime() - new Date(horaChegada).getTime();
          tempoMinutos = Math.max(0, Math.round(diffMs / 60000));
          tempoFormatado = formatarDuracaoMinutos(tempoMinutos);
        }

        const updatePayload = {
          status: statusNovo,
          historico: [...histOriginal, newHist],
          horaSaida,
          ...(horaChegada ? { horaChegada } : {}),
          ...(tempoMinutos !== null && tempoMinutos !== undefined ? { tempoMinutos, tempoFormatado } : {})
        };

        set((state) => ({
          entregas: state.entregas.map(e => e.id === entregaId ? { ...e, ...updatePayload } : e)
        }));

        await firestoreService.atualizarEntrega(entregaId, updatePayload);

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
        
        // Atualização otimista imediata no estado local do Zustand
        const listaAtualizada = [...entregasAtuais];
        novasEntregas.forEach(nova => {
          const index = listaAtualizada.findIndex(e => e.nota === nova.nota);
          if (index >= 0) {
            listaAtualizada[index] = {
              ...listaAtualizada[index],
              ...nova,
              status: listaAtualizada[index].status,
              canhoto: listaAtualizada[index].canhoto || false
            };
          } else {
            listaAtualizada.push({
              ...nova,
              id: `${nova.nota}-${Date.now()}`,
              status: 'Pendente',
              canhoto: false,
              historico: [{
                status: 'Pendente',
                data: new Date().toISOString(),
                role: get().currentUser?.role || 'Sistema',
                observacao: 'Importação inicial'
              }]
            });
          }
        });

        set({ entregas: listaAtualizada });

        // Sincroniza com o Firestore
        try {
          await firestoreService.importarEntregas(novasEntregas, entregasAtuais);
        } catch (err) {
          console.error('Erro ao sincronizar importação no Firestore:', err);
          throw err;
        }
      },

      removerEntregasPorData: async (dataStr) => {
        set((state) => ({
          entregas: state.entregas.filter(e => e.data !== dataStr)
        }));
        await firestoreService.removerEntregasPorData(dataStr);
      },

      limparTodasEntregas: async () => {
        set({
          entregas: [],
          devolucoes: [],
          solicitacoesDevolucao: [],
          cargasFinalizadas: [],
          kmRegistros: []
        });
        await firestoreService.limparTodasEntregas();
      },

      restaurarBackup: async (backupData) => {
        // As atualizações no Zustand acontecerão via onSnapshot automaticamente
        await firestoreService.restaurarBackup(backupData);
      },

      // --- Ações de Devolução ---
      adicionarDevolucao: async (devolucao) => {
        const tempId = `dev-${Date.now()}`;
        const dataStr = new Date().toISOString();
        const novaDev = { 
          ...devolucao, 
          id: devolucao.id || tempId,
          tratamento: devolucao.tratamento || 'Aguardando definição',
          data: devolucao.data || dataStr,
          historico: [{
            status: devolucao.status || 'Pendente de recebimento',
            tratamento: devolucao.tratamento || 'Aguardando definição',
            data: dataStr,
            role: get().currentUser?.role || 'Sistema',
            observacao: 'Lançamento manual de devolução'
          }]
        };
        set((state) => ({
          devolucoes: [novaDev, ...(state.devolucoes || []).filter(d => d.id !== novaDev.id)]
        }));
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

      // --- Ações de Solicitação e Avaliação de Devolução ---
      solicitarDevolucaoMotorista: async (dados) => {
        const docId = `solic_dev_${Date.now()}_${dados.nota || ''}`;
        const nowIso = new Date().toISOString();
        const novaSolicitacao = {
          id: docId,
          entregaId: dados.entregaId,
          nota: dados.nota,
          codCliente: dados.codCliente || '',
          cliente: dados.cliente || '',
          bairro: dados.bairro || '',
          cidade: dados.cidade || '',
          placa: dados.placa || get().currentUser?.placa || 'Sem Placa',
          motoristaNome: dados.motoristaNome || '',
          carga: dados.carga || '',
          data: dados.data || '',
          tipo: dados.tipo || 'Total', // 'Total' | 'Parcial' | 'Reentrega' | 'Devolução de gramatura'
          motivo: dados.motivo || 'Não informado',
          itensDevolvidos: dados.itensDevolvidos || [],
          pesoTotalDevolvido: Number(dados.pesoTotalDevolvido) || 0,
          statusSolicitacao: 'Pendente',
          criadoEm: nowIso
        };

        // 1. Atualiza lista de solicitações no Zustand (otimista)
        set(state => ({
          solicitacoesDevolucao: [novaSolicitacao, ...(state.solicitacoesDevolucao || []).filter(s => s.id !== docId)]
        }));

        // 2. Atualiza status da entrega para marcar a pendência de autorização
        const entregaOriginal = get().entregas.find(e => e.id === dados.entregaId || String(e.nota) === String(dados.nota));
        if (entregaOriginal) {
          const hist = entregaOriginal.historico || [];
          const newHist = {
            status: `Solicitação: ${dados.tipo}`,
            data: nowIso,
            role: 'Motorista',
            observacao: `Solicitou ${dados.tipo} (${dados.motivo || 'Sem motivo'}). Aguardando autorização do Monitoramento.`
          };
          const updateEntrega = {
            solicitacaoDevolucaoPendente: true,
            solicitacaoDevolucaoTipo: dados.tipo,
            solicitacaoDevolucaoId: docId,
            historico: [...hist, newHist]
          };
          set(state => ({
            entregas: state.entregas.map(e => e.id === entregaOriginal.id ? { ...e, ...updateEntrega } : e)
          }));
          await firestoreService.atualizarEntrega(entregaOriginal.id, updateEntrega);
        }

        // 3. Salva a solicitação no Firestore
        await firestoreService.salvarSolicitacaoDevolucao(novaSolicitacao);
        return docId;
      },

      avaliarSolicitacaoDevolucao: async (solicitacaoId, { decisao, tipoFinal, statusFinal, motivoFinal, tratamentoFinal, itensFinal, pesoFinal, observacaoMonitoramento }) => {
        const solic = (get().solicitacoesDevolucao || []).find(s => s.id === solicitacaoId);
        const nowIso = new Date().toISOString();
        const respondidoPor = get().currentUser?.role || 'Monitoramento';

        if (!solic) return;

        if (decisao === 'aprovar' || decisao === 'alterar_e_aprovar') {
          const tipo = tipoFinal || solic.tipo || 'Total';
          let statusParaEntrega = statusFinal;
          if (!statusParaEntrega) {
            if (tipo === 'Total') statusParaEntrega = 'Devolução total';
            else if (tipo === 'Parcial') statusParaEntrega = 'Entrega parcial';
            else if (tipo === 'Reentrega') statusParaEntrega = 'Reentrega';
            else statusParaEntrega = 'Devolução total';
          }

          const itens = itensFinal !== undefined ? itensFinal : (solic.itensDevolvidos || []);
          const peso = pesoFinal !== undefined ? Number(pesoFinal) : (Number(solic.pesoTotalDevolvido) || 0);
          const motivo = motivoFinal || solic.motivo || 'Devolução autorizada pelo Monitoramento';
          const tratamento = tratamentoFinal || 'Aguardando definição';

          // 1. Atualizar status da solicitação no Zustand
          set(state => ({
            solicitacoesDevolucao: (state.solicitacoesDevolucao || []).map(s => 
              s.id === solicitacaoId ? {
                ...s,
                statusSolicitacao: decisao === 'alterar_e_aprovar' ? 'Alterado e Aprovado' : 'Aprovado',
                statusAprovado: statusParaEntrega,
                tipoAprovado: tipo,
                tratamento,
                observacaoMonitoramento: observacaoMonitoramento || '',
                respondidoEm: nowIso,
                respondidoPor
              } : s
            )
          }));

          // 2. Atualizar a entrega para o novo status
          const entrega = get().entregas.find(e => e.id === solic.entregaId || String(e.nota) === String(solic.nota));
          if (entrega) {
            const hist = entrega.historico || [];
            const newHist = {
              status: statusParaEntrega,
              data: nowIso,
              role: respondidoPor,
              observacao: `${decisao === 'alterar_e_aprovar' ? 'Solicitação alterada e aprovada' : 'Solicitação aprovada'}: ${tipo} (${motivo})`
            };
            
            let horaChegada = entrega.horaChegada || null;
            let horaSaida = nowIso;
            let tempoMinutos = entrega.tempoMinutos;
            let tempoFormatado = entrega.tempoFormatado;
            if (horaChegada) {
              const diffMs = new Date(horaSaida).getTime() - new Date(horaChegada).getTime();
              tempoMinutos = Math.max(0, Math.round(diffMs / 60000));
              tempoFormatado = formatarDuracaoMinutos(tempoMinutos);
            }

            const updatePayload = {
              status: statusParaEntrega,
              solicitacaoDevolucaoPendente: false,
              solicitacaoDevolucaoStatus: 'Aprovado',
              historico: [...hist, newHist],
              horaSaida,
              ...(horaChegada ? { horaChegada } : {}),
              ...(tempoMinutos !== null && tempoMinutos !== undefined ? { tempoMinutos, tempoFormatado } : {})
            };

            set(state => ({
              entregas: state.entregas.map(e => e.id === entrega.id ? { ...e, ...updatePayload } : e)
            }));
            await firestoreService.atualizarEntrega(entrega.id, updatePayload);
          }

          // 3. Criar registro oficial em devoluções
          const novaDevolucao = {
            notaId: entrega?.id || solic.entregaId,
            nota: solic.nota,
            placa: solic.placa,
            tipo: tipo,
            itens: itens,
            quantidadeKg: peso,
            status: 'Pendente de recebimento',
            tratamento: tratamento,
            observacao: motivo,
            data: nowIso,
            historico: [{
              status: 'Pendente de recebimento',
              tratamento: tratamento,
              data: nowIso,
              role: respondidoPor,
              observacao: `Aprovado pelo Monitoramento: ${motivo}`
            }]
          };
          await get().adicionarDevolucao(novaDevolucao);

          // 4. Atualizar registro no Firestore da solicitação
          await firestoreService.atualizarSolicitacaoDevolucao(solicitacaoId, {
            statusSolicitacao: decisao === 'alterar_e_aprovar' ? 'Alterado e Aprovado' : 'Aprovado',
            statusAprovado: statusParaEntrega,
            tipoAprovado: tipo,
            tratamento,
            observacaoMonitoramento: observacaoMonitoramento || '',
            respondidoEm: nowIso,
            respondidoPor
          });

        } else if (decisao === 'rejeitar') {
          // Rejeição da solicitação
          const motivoRecusa = observacaoMonitoramento || 'Solicitação recusada pelo Monitoramento';

          // 1. Atualizar a solicitação
          set(state => ({
            solicitacoesDevolucao: (state.solicitacoesDevolucao || []).map(s => 
              s.id === solicitacaoId ? {
                ...s,
                statusSolicitacao: 'Recusado',
                observacaoMonitoramento: motivoRecusa,
                respondidoEm: nowIso,
                respondidoPor
              } : s
            )
          }));

          // 2. Atualizar a entrega (continua Pendente)
          const entrega = get().entregas.find(e => e.id === solic.entregaId || String(e.nota) === String(solic.nota));
          if (entrega) {
            const hist = entrega.historico || [];
            const newHist = {
              status: entrega.status === 'No cliente' ? 'No cliente' : 'Pendente',
              data: nowIso,
              role: respondidoPor,
              observacao: `Solicitação de devolução RECUSADA pelo Monitoramento: ${motivoRecusa}`
            };

            const updatePayload = {
              status: entrega.status === 'No cliente' ? 'No cliente' : 'Pendente',
              solicitacaoDevolucaoPendente: false,
              solicitacaoDevolucaoStatus: 'Recusado',
              historico: [...hist, newHist]
            };

            set(state => ({
              entregas: state.entregas.map(e => e.id === entrega.id ? { ...e, ...updatePayload } : e)
            }));
            await firestoreService.atualizarEntrega(entrega.id, updatePayload);
          }

          // 3. Atualizar no Firestore
          await firestoreService.atualizarSolicitacaoDevolucao(solicitacaoId, {
            statusSolicitacao: 'Recusado',
            observacaoMonitoramento: motivoRecusa,
            respondidoEm: nowIso,
            respondidoPor
          });
        }
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
      partialize: (state) => ({
        currentUser: state.currentUser
      }),
    }
  )
);

