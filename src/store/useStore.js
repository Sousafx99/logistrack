import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  signInWithEmailAndPassword,
  signInWithCustomToken,
  sendPasswordResetEmail,
  signOut
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { firestoreService } from '../lib/firestoreService';
import { storageService } from '../lib/storageService';
import { normalizarRCA } from '../lib/utils';
import { authFetch, apiUrl } from '../lib/appConfig';
import { dispatchRemotePush, unregisterCurrentDeviceToken } from '../lib/pushNotifications';
import { stopRouteGpsTracking } from '../lib/rotaGpsService';

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

// Mecanismo de Auto-Cura e Resiliência de Reentregas Agendadas
// Garante que qualquer reentrega confirmada na aba Devoluções NUNCA desapareça,
// recriando-a automaticamente se uma importação ou limpeza de data a tiver suprimido.
const reconciliarReentregasAgendadas = (entregas, devolucoes, cargasProg = []) => {
  if (!Array.isArray(devolucoes) || devolucoes.length === 0) return entregas;
  const entregasMap = new Map();
  (entregas || []).forEach(e => {
    if (e && e.id) entregasMap.set(e.id, e);
  });

  let alterado = false;
  devolucoes.forEach(dev => {
    if (!dev || dev.status !== 'Reentrega Agendada') return;
    const notaStr = String(dev.nota || dev.nf || '').trim();
    if (!notaStr) return;

    let dataReent = dev.dataReentrega;
    let placaReent = dev.placaReentrega;
    if (!dataReent || !placaReent) {
      const match = String(dev.tratamento || '').match(/Agendado p\/\s*(\d{4}-\d{2}-\d{2})\s*\(([^)]+)\)/i);
      if (match) {
        if (!dataReent) dataReent = match[1];
        if (!placaReent) placaReent = match[2].trim().toUpperCase();
      }
    }

    if (!dataReent) return;

    // 1. Verifica se alguma carga da programação nesta data cita esta NF explicitamente na observação
    const progComEssaNota = (cargasProg || []).find(cp => 
      cp.data === dataReent && 
      cp.observacao && 
      cp.observacao.includes(notaStr)
    );
    if (progComEssaNota && progComEssaNota.placa && progComEssaNota.placa !== 'SEM PLACA') {
      placaReent = String(progComEssaNota.placa).trim().toUpperCase();
    }

    if (!placaReent) return;

    // 2. Se a entrega já existe na lista nesta data com uma placa válida atribuída, NUNCA altere sua placa!
    const entregaJaExiste = Array.from(entregasMap.values()).find(e => 
      (e.isReentrega || String(e.id || '').startsWith('REENT-')) &&
      String(e.nota || '').trim() === notaStr &&
      e.data === dataReent
    );

    if (entregaJaExiste) {
      // Já existe na data alvo: preserva a placa que já está nela
      return;
    }

    // Se ainda não existe para esta data, gera a partir da original
    const original = Array.from(entregasMap.values()).find(e => 
      String(e.nota || '').trim() === notaStr && !e.isReentrega
    ) || Array.from(entregasMap.values()).find(e => String(e.nota || '').trim() === notaStr);

    if (original) {
      const progDoVeiculo = (cargasProg || []).find(cp => 
        cp.data === dataReent && 
        String(cp.placa || '').trim().toUpperCase() === placaReent && 
        !String(cp.carga || '').toUpperCase().includes('PARADA')
      );

      const cargaReent = dev.cargaReentrega 
        || (progDoVeiculo ? progDoVeiculo.carga : 'CARGA PARADA');

      const priReent = dev.prioridadeReentrega 
        ?? (progDoVeiculo?.prioridade ?? original.priCarregamento ?? null);

      const docId = `REENT-${notaStr}-${dataReent}`;
      const novaEntrega = {
        ...original,
        id: docId,
        nota: notaStr,
        pedido: original.pedido || notaStr,
        codCliente: original.codCliente || '',
        cliente: original.cliente || 'CLIENTE NÃO IDENTIFICADO',
        cidade: original.cidade || original.municipio || '',
        municipio: original.municipio || original.cidade || '',
        bairro: original.bairro || '',
        rota: progDoVeiculo?.rota || original.rota || '',
        placa: placaReent,
        placaOriginal: original.placaOriginal || original.placa,
        carga: cargaReent,
        data: dataReent,
        dataFaturamento: original.dataFaturamento || original.data,
        dataOriginalFaturamento: original.dataFaturamento || original.data,
        rca: original.rca || '',
        status: 'Pendente',
        canhoto: false,
        isReentrega: true,
        valorFaturamento: 0,
        peso: original.peso || 0,
        valor: original.valor || 0,
        statusFaturamento: 'Previa',
        notaProvisoria: false,
        priCarregamento: priReent,
        observacaoProgramacao: `Reentrega NF ${notaStr}`,
        observacao: `Reentrega auto-reconciliada para ${dataReent} no veículo ${placaReent}`,
        historico: [
          {
            status: 'Pendente',
            data: new Date().toISOString(),
            role: 'Sistema',
            observacao: `Reentrega auto-reconciliada para ${dataReent} (${placaReent})`
          }
        ],
        atualizadoEm: new Date().toISOString()
      };

      entregasMap.set(docId, novaEntrega);
      alterado = true;
      try {
        firestoreService.salvarReentrega(novaEntrega, null, null).catch(err => {
          console.warn('[AutoHeal] Erro ao sincronizar reentrega no Firestore:', err);
        });
      } catch (_) {}
    }
  });

  return alterado ? Array.from(entregasMap.values()) : entregas;
};

export const useStore = create(
  persist(
    (set, get) => ({
      // --- Estado Inicial ---
      currentUser: null, // { uid, role: 'Motorista' | 'Operacao' | 'Monitoramento' | 'TV', placa?: 'OKT9410', email?: string, nome?: string }
      authReady: false,
      setAuthReady: (ready) => set({ authReady: Boolean(ready) }),
      setCurrentUserFromFirebase: (userObj) => set({ currentUser: userObj, authReady: true }),
      entregas: [],
      devolucoes: [],
      cargasFinalizadas: [],
      canhotos: [],
      despesas: [],
      motoristas: [],
      veiculos: [],
      credenciaisFrota: [], // [{ placa, senha, ativo, atualizadoEm }] - somente Monitoramento
      rastreamentoFrota: [], // [{ placa, data, carga, lat, lng, speedKmh, gpsAtivo, emRota, atualizadoEm }]
      rotasGps: [], // [{ id, data, placa, carga, pontos: [{ lat, lng, t, v }] }]
      kmRegistros: [],
      clientesGeoloc: [], // { codCliente, cliente, municipio, bairro, pontos: [{ id, nomeLocal, lat, lng, endereco, padrao, criadoPor, criadoEm }] }
      solicitacoesGeoloc: [], // { id, codCliente, clienteNome, motoristaPlaca, motoristaNome, carga, data, lat, lng, precisaoMetros, nomeLocalSugerido, status, motivoRecusa, criadoEm }
      gruposClientes: [], // { id, nome, cor, descricao, codClientes: string[], criadoEm, atualizadoEm }
      configDiarias: null, // { tabela: Array, atualizadoEm: string }
      funcionariosRJ: [], // { id, nome, email, whatsapp, setor, cargo, status, receberRelatorios, receberOcorrencias, observacao }
      modalPerfilMotoristaOpen: false,
      setModalPerfilMotoristaOpen: (open) => set({ modalPerfilMotoristaOpen: open }),

      // Rastreamento de sincronização em tempo real (multi-máquinas e telão)
      ultimaSincronizacao: null,
      sincronizandoAoVivo: false,
      setSincronizandoAoVivo: (val) => set({ sincronizandoAoVivo: val }),

      // Programação de Cargas Oficial & Despesas Operacionais
      cargasProgramacao: [],
      setCargasProgramacao: (data) => set({ cargasProgramacao: data || [] }),

      globalFilters: {
        data: getBrasiliaDateString(),
        visaoMonitoramento: { datas: [], placas: [], status: 'Em Aberto', busca: '' },
        devolucoes: { datas: [], notas: [], placas: [], tipos: [], status: [], rcas: [], busca: '' },
        relatorios: { placas: [], cargas: [], rcas: [], status: [], datas: [], clientes: [], grupos: [] },
        canhotos: { placa: '', carga: '', busca: '' }
      },

      setGlobalFilters: (filters) => set((state) => ({
        globalFilters: { ...state.globalFilters, ...filters }
      })),

      // Setters para Sincronismo com Firestore
      setFuncionariosRJ: (data) => set({ funcionariosRJ: data || [] }),
      setConfigDiarias: (data) => set({ configDiarias: data }),
      setVeiculos: (data) => set({ veiculos: data || [] }),
      setCredenciaisFrota: (data) => set({ credenciaisFrota: data || [] }),
      setRastreamentoFrota: (data) => set({ rastreamentoFrota: data || [] }),
      setRotasGps: (data) => set({ rotasGps: data || [] }),
      setGruposClientes: (data) => set({ gruposClientes: data || [] }),
      setEntregas: (data) => set((state) => {
        const hoje = getBrasiliaDateString();
        const listaNormalizada = (data || []).map(e => (e && e.rca) ? { ...e, rca: normalizarRCA(e.rca) } : e);
        
        // Deduplica por nota fiscal e data para permitir reentregas em novas datas sem duplicar pedidos provisórios
        const notasMap = new Map();
        const pedidosComNotaReal = new Set();

        // 1. Identifica pedidos que já possuem Nota Fiscal oficial emitida
        listaNormalizada.forEach(item => {
          if (!item) return;
          const isProv = item.notaProvisoria || String(item.nota || '').startsWith('PED:') || String(item.id || '').startsWith('PREV-');
          if (!isProv && item.pedido) {
            pedidosComNotaReal.add(String(item.pedido).trim());
          }
        });

        // 2. Monta o mapa de entregas garantindo que:
        //    a) Reentregas agendadas em datas futuras ou marcadas como isReentrega NUNCA são descartadas!
        //    b) Pedidos provisórios que já têm NF real emitida são descartados (evita duplicar cliente como 3949)!
        listaNormalizada.forEach(item => {
          if (!item) return;

          const isProv = item.notaProvisoria || String(item.nota || '').startsWith('PED:') || String(item.id || '').startsWith('PREV-');
          const pedidoStr = String(item.pedido || '').trim();

          // Se for provisório e o pedido já possui NF real emitida, ignora o provisório duplicado
          if (isProv && pedidoStr && pedidosComNotaReal.has(pedidoStr)) {
            return;
          }

          const notaStr = item.nota ? String(item.nota).trim() : '';
          const dataStr = item.data ? String(item.data).trim() : '';

          let chave;
          if (item.isReentrega || String(item.id || '').startsWith('REENT-')) {
            chave = `REENT_${notaStr}_${dataStr}_${item.placa || ''}`;
          } else if (notaStr && dataStr) {
            chave = `${notaStr}_${dataStr}`;
          } else if (notaStr) {
            chave = notaStr;
          } else {
            chave = String(item.id || Math.random());
          }

          if (!notasMap.has(chave)) {
            notasMap.set(chave, item);
          } else {
            // Se já existe e a nova tem status mais recente ou diferente de Pendente, mescla
            const existente = notasMap.get(chave);
            if (item.status && item.status !== 'Pendente' && existente.status === 'Pendente') {
              notasMap.set(chave, { ...existente, ...item });
            }
          }
        });
        const lista = Array.from(notasMap.values());
        const listaComReentregas = reconciliarReentregasAgendadas(lista, state.devolucoes || [], state.cargasProgramacao || []);
        const temHoje = listaComReentregas.some(e => e.data === hoje);
        
        let dataAlvo = hoje;
        if (!temHoje && listaComReentregas.length > 0) {
          const datas = Array.from(new Set(listaComReentregas.map(e => e.data).filter(Boolean)));
          datas.sort((a, b) => b.localeCompare(a));
          if (datas.length > 0) {
            dataAlvo = datas[0];
          }
        }

        const dataAtual = state.globalFilters?.data;
        const temDataAtual = listaComReentregas.some(e => e.data === dataAtual);
        // Se a data atual não existir nas entregas ou for hoje sem ter carga, seleciona a dataAlvo
        const dataFinal = (temDataAtual && (dataAtual !== hoje || temHoje)) ? dataAtual : dataAlvo;

        return {
          entregas: listaComReentregas,
          ultimaSincronizacao: new Date(),
          globalFilters: {
            ...state.globalFilters,
            data: dataFinal
          }
        };
      }),
      setDevolucoes: (data) => set((state) => {
        // Deduplica devoluções por notaId ou (nota + data/status)
        const mapaDev = new Map();
        (data || []).forEach(d => {
          if (!d) return;
          const notaStr = String(d.nota || d.nf || '').trim();
          const chave = d.notaId || (notaStr && d.status === 'Pendente de recebimento' ? `dev_${notaStr}_pendente` : d.id);
          if (!mapaDev.has(chave)) {
            mapaDev.set(chave, d);
          } else {
            const existente = mapaDev.get(chave);
            const dataNovo = new Date(d.atualizadoEm || d.data || 0).getTime();
            const dataExistente = new Date(existente.atualizadoEm || existente.data || 0).getTime();
            if (dataNovo >= dataExistente) {
              mapaDev.set(chave, d);
            }
          }
        });
        const devDeduplicadas = Array.from(mapaDev.values());

        const entregasReconciliadas = reconciliarReentregasAgendadas(state.entregas || [], devDeduplicadas, state.cargasProgramacao || []);
        return {
          devolucoes: devDeduplicadas,
          entregas: entregasReconciliadas,
          ultimaSincronizacao: new Date()
        };
      }),
      setDespesas: (data) => set({ despesas: data }),
      setMotoristas: (data) => set({ motoristas: data }),
      setCargasFinalizadas: (data) => set({ cargasFinalizadas: data }),
      setKmRegistros: (data) => set({ kmRegistros: data }),
      setClientesGeoloc: (data) => set({ clientesGeoloc: data }),
      mesclarClientesGeoloc: (novosClientes) => set((state) => {
        if (!Array.isArray(novosClientes) || novosClientes.length === 0) return {};
        const mapa = new Map();
        (state.clientesGeoloc || []).forEach(c => {
          const id = String(c?.codCliente || c?.id || '').trim();
          if (id) mapa.set(id, c);
        });
        novosClientes.forEach(c => {
          const id = String(c?.codCliente || c?.id || '').trim();
          if (id) mapa.set(id, { ...(mapa.get(id) || {}), ...c });
        });
        return { clientesGeoloc: Array.from(mapa.values()) };
      }),
      setEntregasMotorista: (data, placa, dataMinima) => {
        const placaNorm = String(placa || '').trim().toUpperCase();
        const atuaisSalvas = (get().entregas || []).filter(e => {
          const ePlaca = String(e?.placa || '').trim().toUpperCase();
          if (ePlaca !== placaNorm) return false;
          return dataMinima && e?.data && e.data < dataMinima;
        });
        const idsNovos = new Set((data || []).map(d => d?.id).filter(Boolean));
        const antigasPreservadas = atuaisSalvas.filter(a => !idsNovos.has(a.id));
        get().setEntregas([...antigasPreservadas, ...(data || [])]);
      },
      setSolicitacoesGeoloc: (data) => set({ solicitacoesGeoloc: data }),
      setSolicitacoesDevolucao: (data) => set({ solicitacoesDevolucao: data }),

      // Força a busca direta no servidor (bypass de cache) e atualiza todas as coleções do dashboard
      forcarSincronizacaoGeral: async () => {
        set({ sincronizandoAoVivo: true });
        try {
          const dados = await firestoreService.forcarSincronizacaoGeral();
          if (dados.entregas) get().setEntregas(dados.entregas);
          if (dados.motoristas) get().setMotoristas(dados.motoristas);
          if (dados.devolucoes) get().setDevolucoes(dados.devolucoes);
          if (dados.veiculos) get().setVeiculos(dados.veiculos);
          set({ ultimaSincronizacao: new Date(), sincronizandoAoVivo: false });
          return { success: true, totalEntregas: dados.entregas?.length || 0 };
        } catch (err) {
          console.error('[useStore] Erro ao forçar sincronização geral:', err);
          set({ sincronizandoAoVivo: false });
          return { success: false, error: err.message };
        }
      },

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
        } else if (kmData.kmExecutado !== undefined && kmData.kmExecutado !== '' && kmData.kmExecutado !== null) {
          kmExecutado = Number(kmData.kmExecutado);
        }

        let diferencaKm = null;
        if (kmExecutado !== null && kmPrevisto !== null) {
          diferencaKm = kmExecutado - kmPrevisto;
        }

        // Envia fotos de KM para o Firebase Storage (evita gravar Base64 pesado dentro do Firestore)
        let fotoKmInicialUrl = kmData.fotoKmInicial || null;
        let fotoKmFinalUrl = kmData.fotoKmFinal || null;

        if (fotoKmInicialUrl && typeof fotoKmInicialUrl === 'string' && fotoKmInicialUrl.startsWith('data:')) {
          fotoKmInicialUrl = await storageService.uploadFotoKm(fotoKmInicialUrl, dataStr, placaStr, 'inicial');
        }
        if (fotoKmFinalUrl && typeof fotoKmFinalUrl === 'string' && fotoKmFinalUrl.startsWith('data:')) {
          fotoKmFinalUrl = await storageService.uploadFotoKm(fotoKmFinalUrl, dataStr, placaStr, 'final');
        }

        const payload = {
          ...kmData,
          id: docId,
          kmInicial,
          kmFinal,
          kmPrevisto,
          kmExecutado,
          diferencaKm,
          fotoKmInicial: fotoKmInicialUrl,
          fotoKmFinal: fotoKmFinalUrl,
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

      salvarKmValores: async (data, placa, carga, valores) => {
        const docId = `${data}_${(placa || 'sem-placa').replace(/[\/\\]/g, '-')}_${(carga || 'sem-carga').replace(/[\/\\]/g, '-')}`;
        const existing = (get().kmRegistros || []).find(k => k.id === docId) || {};
        
        let kmInicial = valores.kmInicial !== undefined ? (valores.kmInicial === '' || valores.kmInicial === null ? null : Number(valores.kmInicial)) : (existing.kmInicial ?? null);
        let kmFinal = valores.kmFinal !== undefined ? (valores.kmFinal === '' || valores.kmFinal === null ? null : Number(valores.kmFinal)) : (existing.kmFinal ?? null);
        let kmPrevisto = valores.kmPrevisto !== undefined ? (valores.kmPrevisto === '' || valores.kmPrevisto === null ? null : Number(valores.kmPrevisto)) : (existing.kmPrevisto ?? null);
        let kmExecutado = valores.kmExecutado !== undefined ? (valores.kmExecutado === '' || valores.kmExecutado === null ? null : Number(valores.kmExecutado)) : (existing.kmExecutado ?? null);

        if (valores.kmExecutado !== undefined && kmExecutado !== null) {
          if (kmInicial !== null && (valores.kmFinal === undefined || valores.kmFinal === null)) {
            kmFinal = kmInicial + kmExecutado;
          }
        } else if (kmInicial !== null && kmFinal !== null && kmFinal >= kmInicial) {
          kmExecutado = kmFinal - kmInicial;
        }

        return get().salvarKmRegistro({
          ...existing,
          data,
          placa,
          carga,
          kmInicial,
          kmFinal,
          kmPrevisto,
          kmExecutado
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
        const { editIndex, ...pontoSemIndex } = ponto || {};
        const pontoId = pontoSemIndex.id || `${Date.now()}`;
        const pontoComId = {
          ...pontoSemIndex,
          id: pontoId,
          lat: Number(pontoSemIndex.lat),
          lng: Number(pontoSemIndex.lng),
          criadoEm: pontoSemIndex.criadoEm || new Date().toISOString(),
          atualizadoEm: new Date().toISOString()
        };

        set(state => {
          const list = state.clientesGeoloc || [];
          const client = list.find(c => String(c.codCliente).trim() === docId || String(c.id).trim() === docId);
          let pontos = client?.pontos ? [...client.pontos] : [];
          if (pontoComId.padrao) {
            pontos = pontos.map(p => ({ ...p, padrao: false }));
          }
          if (pontos.some(p => p.id && p.id === pontoId)) {
            pontos = pontos.map(p => p.id === pontoId ? pontoComId : p);
          } else if (editIndex !== undefined && editIndex !== null && editIndex >= 0 && editIndex < pontos.length) {
            pontos[editIndex] = pontoComId;
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
        const res = await firestoreService.solicitarAjusteGeoloc(payload);
        dispatchRemotePush({
          targetType: 'gestao',
          targetRoles: ['Monitoramento'],
          title: `📍 Sugestão de GPS • ${solicitacao.motoristaPlaca || 'Frota'}`,
          body: `${solicitacao.clienteNome || solicitacao.codCliente}: nova coordenada enviada pelo motorista.`,
          url: '/cadastros?aba=geolocalizacao',
          tag: `geoloc-${docId}`,
          soundType: 'alarm'
        });
        return res;
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
          if (solic.motoristaPlaca) {
            dispatchRemotePush({
              targetType: 'placa',
              targetPlaca: solic.motoristaPlaca,
              title: '✅ Localização Aprovada!',
              body: `O GPS do cliente ${solic.clienteNome || solic.codCliente} foi validado pelo Monitoramento.`,
              url: '/',
              tag: `geoloc-ok-${solicitacaoId}`,
              soundType: 'alarm'
            });
          }
        }
        return firestoreService.aprovarSolicitacaoGeoloc(solicitacaoId, dadosAprovados);
      },

      recusarSolicitacaoGeoloc: async (solicitacaoId, motivo = '') => {
        const solic = (get().solicitacoesGeoloc || []).find(s => s.id === solicitacaoId);
        set(state => ({
          solicitacoesGeoloc: (state.solicitacoesGeoloc || []).map(s => s.id === solicitacaoId ? { ...s, status: 'Recusado', motivoRecusa: motivo, recusadoEm: new Date().toISOString() } : s)
        }));
        if (solic?.motoristaPlaca) {
          dispatchRemotePush({
            targetType: 'placa',
            targetPlaca: solic.motoristaPlaca,
            title: '⚠️ Sugestão de GPS Recusada',
            body: `${solic.clienteNome || solic.codCliente}: ${motivo || 'Verifique com o monitoramento.'}`,
            url: '/',
            tag: `geoloc-no-${solicitacaoId}`,
            soundType: 'alarm'
          });
        }
        return firestoreService.recusarSolicitacaoGeoloc(solicitacaoId, motivo);
      },

      // Ações de Grupos / Redes de Clientes
      salvarGrupoCliente: async (grupoData) => {
        const docId = String(grupoData.id || `grupo_${Date.now()}`).trim();
        const agora = new Date().toISOString();
        const grupoPronto = {
          ...grupoData,
          id: docId,
          nome: (grupoData.nome || '').trim(),
          cor: grupoData.cor || 'emerald',
          descricao: (grupoData.descricao || '').trim(),
          codClientes: Array.isArray(grupoData.codClientes) ? Array.from(new Set(grupoData.codClientes.map(String).map(s => s.trim()).filter(Boolean))) : [],
          atualizadoEm: agora,
          criadoEm: grupoData.criadoEm || agora
        };

        set(state => {
          const list = state.gruposClientes || [];
          const exists = list.some(g => g.id === docId);
          if (exists) {
            return { gruposClientes: list.map(g => g.id === docId ? grupoPronto : g) };
          } else {
            return { gruposClientes: [...list, grupoPronto] };
          }
        });

        return firestoreService.salvarGrupoCliente(grupoPronto);
      },

      removerGrupoCliente: async (grupoId) => {
        const docId = String(grupoId).trim();
        set(state => ({
          gruposClientes: (state.gruposClientes || []).filter(g => g.id !== docId)
        }));
        return firestoreService.removerGrupoCliente(docId);
      },

      atribuirClientesAoGrupo: async (grupoId, codClientesArray = []) => {
        const docId = String(grupoId).trim();
        set(state => ({
          gruposClientes: (state.gruposClientes || []).map(g => {
            if (g.id === docId) {
              const setCli = new Set((g.codClientes || []).map(String));
              codClientesArray.forEach(c => c && setCli.add(String(c).trim()));
              return { ...g, codClientes: Array.from(setCli), atualizadoEm: new Date().toISOString() };
            }
            return g;
          })
        }));
        return firestoreService.atribuirClientesAoGrupo(docId, codClientesArray);
      },

      removerClienteDoGrupo: async (grupoId, codCliente) => {
        const docId = String(grupoId).trim();
        const codStr = String(codCliente).trim();
        set(state => ({
          gruposClientes: (state.gruposClientes || []).map(g => {
            if (g.id === docId) {
              return {
                ...g,
                codClientes: (g.codClientes || []).map(String).filter(c => c !== codStr),
                atualizadoEm: new Date().toISOString()
              };
            }
            return g;
          })
        }));
        return firestoreService.removerClienteDoGrupo(docId, codCliente);
      },

      salvarPerfilMotorista: async (dados) => {
        const placa = get().currentUser?.placa;
        if (!placa) return;

        const tel = dados.whatsapp || dados.telefone || '';
        const pixVal = dados.chavePix || dados.chave_pix || dados.pix || '';
        const tipoPixVal = dados.tipoPix || dados.tipo_chave_pix || '';

        const motoristaUpdate = {
          ...dados,
          whatsapp: tel,
          telefone: tel,
          chavePix: pixVal,
          chave_pix: pixVal,
          pix: pixVal,
          ...(tipoPixVal ? { tipoPix: tipoPixVal, tipo_chave_pix: tipoPixVal } : {}),
          ultima_atualizacao: new Date().toISOString()
        };

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
        const tel = dados.telefone || dados.whatsapp || '';
        const pixVal = dados.chave_pix || dados.chavePix || dados.pix || '';
        const tipoPixVal = dados.tipo_chave_pix || dados.tipoPix || '';

        const motoristaUpdate = {
          ...dados,
          ...(tel ? { telefone: tel, whatsapp: tel } : {}),
          ...(pixVal !== undefined ? { chave_pix: pixVal, chavePix: pixVal, pix: pixVal } : {}),
          ...(tipoPixVal ? { tipo_chave_pix: tipoPixVal, tipoPix: tipoPixVal } : {}),
          ultima_atualizacao: new Date().toISOString()
        };

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

      removerMotoristaAdmin: async (placa) => {
        const p = String(placa).trim().toUpperCase();
        set(state => ({
          motoristas: (state.motoristas || []).filter(m => (m.placa || m.id) !== p)
        }));
        await firestoreService.removerMotorista(p);
      },

      salvarVeiculo: async (veiculoData) => {
        const placa = String(veiculoData.placa || veiculoData.id || '').trim().toUpperCase();
        if (!placa) return;

        const jaExistiaCredencial = (get().credenciaisFrota || []).some(c => c.placa === placa);
        const isVirtual = /^(SAB|RES)\d+/i.test(placa) || veiculoData.tipo === 'Sem Custo';

        const payload = {
          ...veiculoData,
          placa,
          atualizadoEm: new Date().toISOString()
        };

        set(state => {
          const list = state.veiculos || [];
          const exists = list.some(v => v.placa === placa);
          if (exists) {
            return { veiculos: list.map(v => v.placa === placa ? { ...v, ...payload } : v) };
          } else {
            return { veiculos: [...list, payload] };
          }
        });

        await firestoreService.salvarVeiculo(placa, payload);

        // Gera automaticamente a senha rj+placa+2digitos ao cadastrar novo veículo operacional
        if (!jaExistiaCredencial && !isVirtual && get().currentUser?.role === 'Monitoramento') {
          try {
            await get().alterarSenhaMotoristaPlaca(placa, veiculoData.senhaAcesso || '');
          } catch (err) {
            console.warn('[salvarVeiculo] Aviso ao provisionar senha automática:', err?.message);
          }
        }
      },

      alterarSenhaMotoristaPlaca: async (placa, novaSenha = '') => {
        const placaNorm = String(placa || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (!placaNorm) throw new Error('Placa inválida.');

        const res = await authFetch('/api/admin-auth', {
          method: 'POST',
          body: JSON.stringify({
            action: 'upsertDriverPassword',
            placa: placaNorm,
            senha: novaSenha ? String(novaSenha).trim().toLowerCase() : ''
          })
        });

        const data = await res.json();
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || 'Não foi possível atualizar a senha do veículo.');
        }

        set(state => {
          const list = state.credenciaisFrota || [];
          const item = {
            placa: placaNorm,
            senha: data.senha,
            ativo: data.ativo,
            atualizadoEm: new Date().toISOString()
          };
          const exists = list.some(c => c.placa === placaNorm);
          return {
            credenciaisFrota: exists
              ? list.map(c => c.placa === placaNorm ? { ...c, ...item } : c)
              : [...list, item]
          };
        });

        return data;
      },

      removerVeiculo: async (placa) => {
        const p = String(placa).trim().toUpperCase();
        set(state => ({
          veiculos: (state.veiculos || []).filter(v => v.placa !== p),
          credenciaisFrota: (state.credenciaisFrota || []).filter(c => c.placa !== p)
        }));
        await firestoreService.removerVeiculo(p);
        authFetch('/api/admin-auth', {
          method: 'POST',
          body: JSON.stringify({ action: 'deleteDriverAuth', placa: p })
        }).catch(() => {});
      },

      salvarConfigDiarias: async (tabela) => {
        set({ configDiarias: { tabela, atualizadoEm: new Date().toISOString() } });
        await firestoreService.salvarConfigDiarias(tabela);
      },

      salvarFuncionarioRJ: async (param1, param2) => {
        let id;
        let dados;
        if (typeof param1 === 'string') {
          id = param1.trim();
          dados = param2 || {};
        } else {
          dados = param1 || {};
          id = String(dados.id || `func_${Date.now()}`).trim();
        }

        const payload = {
          ...dados,
          id,
          nome: String(dados.nome || '').trim(),
          email: String(dados.email || '').trim().toLowerCase(),
          whatsapp: String(dados.whatsapp || '').trim(),
          setor: dados.setor || 'Comercial',
          cargo: String(dados.cargo || '').trim(),
          status: dados.status || 'Ativo',
          receberRelatorios: Boolean(dados.receberRelatorios),
          receberOcorrencias: Boolean(dados.receberOcorrencias),
          observacao: String(dados.observacao || '').trim(),
          atualizadoEm: new Date().toISOString()
        };

        Object.keys(payload).forEach(k => {
          if (payload[k] === undefined) delete payload[k];
        });

        set(state => {
          const list = state.funcionariosRJ || [];
          const exists = list.some(f => f.id === id);
          return {
            funcionariosRJ: exists ? list.map(f => f.id === id ? { ...f, ...payload } : f) : [...list, payload]
          };
        });
        await firestoreService.salvarFuncionarioRJ(id, payload);
      },

      removerFuncionarioRJ: async (id) => {
        const idStr = String(id).trim();
        set(state => ({
          funcionariosRJ: (state.funcionariosRJ || []).filter(f => f.id !== idStr)
        }));
        await firestoreService.removerFuncionarioRJ(idStr);
      },

      importarFuncionariosRJEmLote: async (lista) => {
        set(state => {
          const current = [...(state.funcionariosRJ || [])];
          lista.forEach(novo => {
            const idx = current.findIndex(f => f.id === novo.id || (f.nome && novo.nome && f.nome.toLowerCase() === novo.nome.toLowerCase()));
            if (idx >= 0) {
              current[idx] = { ...current[idx], ...novo };
            } else {
              current.push(novo);
            }
          });
          return { funcionariosRJ: current };
        });
        await firestoreService.importarFuncionariosRJEmLote(lista);
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

          const valorFmt = Number(dadosDespesa.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          dispatchRemotePush({
            targetType: 'gestao',
            targetRoles: ['Monitoramento', 'Operacao'],
            operacaoSubRole: 'Financeiro',
            title: `💰 Nova Despesa (${placa}) • ${valorFmt}`,
            body: `${dadosDespesa.tipo || 'Reembolso'} — Recebedor: ${dadosDespesa.nome_recebedor || placa}`,
            url: '/custos',
            tag: `desp-${docId}`,
            soundType: 'alarm'
          });
        } catch (err) {
          console.error('Erro ao adicionar despesa no Firestore/Storage:', err);
        }
      },

      atualizarStatusDespesa: async (id, status, observacao = '') => {
        const despesaAlvo = (get().despesas || []).find(d => d.id === id);
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

        if (despesaAlvo?.motorista_placa) {
          const valorFmt = Number(despesaAlvo.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          const isPago = status === 'Pago' || status === 'Aprovado';
          dispatchRemotePush({
            targetType: 'placa',
            targetPlaca: despesaAlvo.motorista_placa,
            title: status === 'Pago' ? `💸 PIX Pago! (${valorFmt})` : `📋 Despesa ${status} (${valorFmt})`,
            body: `${despesaAlvo.tipo || 'Reembolso'}${observacao ? ` — ${observacao}` : ''}`,
            url: '/',
            tag: `desp-resp-${id}-${status}`,
            soundType: isPago ? 'coin' : 'alarm'
          });
        }
      },

      removerDespesa: async (id) => {
        set(state => ({
          despesas: (state.despesas || []).filter(d => d.id !== id)
        }));
        await firestoreService.removerDespesa(id);
      },

      limparTodasDespesas: async () => {
        set({ despesas: [] });
        await firestoreService.limparTodasDespesas();
      },

      sincronizarDespesaProgramacao: async ({ data, carga, placa, tipoChave, tipoNome, valor, observacao }) => {
        if (!data || !carga) return;
        // KM rodado é um custo exclusivo da programação e nunca deve ser inserido na coleção de despesas
        if (tipoChave === 'km_rodado' || tipoChave === 'km' || String(tipoNome || '').toLowerCase().includes('km rodado')) {
          return;
        }
        const docId = `despesa_prog_${data}_${carga}_${tipoChave}`;
        const numVal = Number(valor) || 0;
        
        if (numVal <= 0) {
          const existente = (get().despesas || []).find(d => d.id === docId);
          if (existente) {
            set(state => ({ despesas: (state.despesas || []).filter(d => d.id !== docId) }));
            try {
              await firestoreService.removerDespesa(docId);
            } catch (err) {
              console.warn('Erro ao remover despesa zerada:', err);
            }
          }
          return;
        }

        const nowIso = new Date().toISOString();
        const payload = {
          id: docId,
          tipo: tipoNome || tipoChave,
          valor: numVal,
          motorista_placa: (placa || '').toUpperCase(),
          carga: String(carga || '').trim(),
          data_solicitacao: `${data}T08:00:00.000Z`,
          data: data,
          status: 'Pendente',
          origem: 'programacao',
          observacao: observacao || `Programação Carga ${carga} (${tipoNome || tipoChave})`,
          nome_recebedor: `Operação - Carga ${carga}`,
          criadoEm: nowIso,
          atualizadoEm: nowIso
        };

        set(state => {
          const list = (state.despesas || []).filter(d => d.id !== docId);
          return { despesas: [...list, payload] };
        });

        try {
          await firestoreService.salvarDespesaPorId(docId, payload);
        } catch (err) {
          console.error('Erro ao sincronizar despesa da programacao no Firestore:', err);
        }
      },

      // --- Ações de Autenticação Real (Firebase Auth + Custom Claims) ---
      login: async (role, credentials) => {
        auth.languageCode = 'pt-BR';

        if (role === 'Motorista') {
          const placa = String(credentials?.usuario || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
          const senhaLimpa = String(credentials?.senha || '').trim().toLowerCase();
          if (!placa || !senhaLimpa) return false;

          const emailInterno = `${placa.toLowerCase()}@frota.logistrack.app`;
          const cred = await signInWithEmailAndPassword(auth, emailInterno, senhaLimpa);
          const tokenRes = await cred.user.getIdTokenResult();
          const claimPlaca = String(tokenRes.claims?.placa || placa).toUpperCase();

          const user = {
            uid: cred.user.uid,
            role: 'Motorista',
            placa: claimPlaca
          };
          set({ currentUser: user, authReady: true });
          try { sessionStorage.setItem('logistrack_recem_logado', 'true'); } catch {}
          return user;
        }

        if (role === 'Monitoramento') {
          const email = String(credentials?.email || credentials?.usuario || '').trim().toLowerCase();
          const senha = String(credentials?.senha || '').trim();
          if (!email || !senha) return false;

          const cred = await signInWithEmailAndPassword(auth, email, senha);
          const tokenRes = await cred.user.getIdTokenResult();
          if (tokenRes.claims?.role !== 'Monitoramento') {
            await signOut(auth);
            throw new Error('Este e-mail não possui permissão de Monitoramento.');
          }

          const user = {
            uid: cred.user.uid,
            role: 'Monitoramento',
            email: cred.user.email,
            nome: tokenRes.claims?.nome || cred.user.displayName || email
          };
          set({ currentUser: user, authReady: true });
          return user;
        }

        if (role === 'Operacao') {
          const pass = String(credentials?.senha || '').trim();
          const setorPreferido = credentials?.subRole;
          let targetEmails = ['docas@frota.logistrack.app', 'financeiro@frota.logistrack.app'];
          if (pass === 'pmfin01' || setorPreferido === 'Financeiro') {
            targetEmails = ['financeiro@frota.logistrack.app', 'docas@frota.logistrack.app'];
          }

          let lastErr = null;
          for (const emailOp of targetEmails) {
            try {
              const cred = await signInWithEmailAndPassword(auth, emailOp, pass);
              const tokenRes = await cred.user.getIdTokenResult();
              const subRole = tokenRes.claims?.subRole || (emailOp.startsWith('financeiro') ? 'Financeiro' : 'Docas');
              const user = {
                uid: cred.user.uid,
                role: 'Operacao',
                subRole,
                setor: subRole,
                nome: tokenRes.claims?.nome || `Operação • ${subRole}`
              };
              set({ currentUser: user, authReady: true });
              return user;
            } catch (e) {
              lastErr = e;
            }
          }
          if (lastErr) throw lastErr;
          return false;
        }

        return false;
      },

      loginModoTV: async (pinDigitado) => {
        const pinClean = String(pinDigitado || '').trim().replace(/\D/g, '');
        if (pinClean.length !== 4) return false;

        // Calcula o PIN ddmm do dia corrente no fuso de Brasília
        const parts = new Intl.DateTimeFormat('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          day: '2-digit',
          month: '2-digit'
        }).formatToParts(new Date());
        const ddmmHoje = `${parts.find(p => p.type === 'day')?.value || ''}${parts.find(p => p.type === 'month')?.value || ''}`;

        if (pinClean !== ddmmHoje) {
          return false;
        }

        try {
          const res = await fetch(apiUrl('/api/tv-auth'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: pinClean })
          });
          const data = await res.json();
          if (res.ok && data?.customToken) {
            const cred = await signInWithCustomToken(auth, data.customToken);
            const user = { uid: cred.user.uid, role: 'TV', nome: 'Painel Modo TV' };
            set({ currentUser: user, authReady: true });
            return user;
          }
        } catch {}

        // Fallback seguro usando conta restrita somente-leitura (role === 'TV')
        const cred = await signInWithEmailAndPassword(auth, 'tv@frota.logistrack.app', 'tv_painel_rj_readonly_2026');
        const user = { uid: cred.user.uid, role: 'TV', nome: 'Painel Modo TV' };
        set({ currentUser: user, authReady: true });
        return user;
      },

      enviarRedefinicaoSenhaEmail: async (email) => {
        const emailClean = String(email || '').trim().toLowerCase();
        if (!emailClean || !emailClean.includes('@')) {
          throw new Error('Informe um e-mail válido.');
        }
        auth.languageCode = 'pt-BR';
        await sendPasswordResetEmail(auth, emailClean, {
          url: 'https://logistrackapp.vercel.app/redefinir-senha',
          handleCodeInApp: false
        });
        return true;
      },

      logout: async () => {
        try {
          sessionStorage.removeItem('logistrack_recem_logado');
        } catch {}
        await stopRouteGpsTracking({ silent: true }).catch(() => {});
        await unregisterCurrentDeviceToken().catch(() => {});
        await signOut(auth).catch(() => {});
        set({ currentUser: null, credenciaisFrota: [] });
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

        try {
          await firestoreService.atualizarEntrega(id, fieldsToUpdate);
        } catch (err) {
          console.error("Erro ao salvar status no Firestore:", err);
          alert(`Atenção: Não foi possível salvar o status no servidor (Firestore). Erro: ${err.message}`);
        }

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
        if (!entrega || !novaPlaca) return;
        const placaFormatada = novaPlaca.trim().toUpperCase();
        const placaOriginal = entrega.placaOriginal || entrega.placa;
        const hist = entrega?.historico || [];
        const newHist = {
          status: entrega?.status || 'Transferência',
          data: new Date().toISOString(),
          role: get().currentUser?.role || 'Sistema',
          observacao: `Transferido para placa ${placaFormatada} (Placa original: ${placaOriginal})`
        };
        set((state) => ({
          entregas: state.entregas.map((e) => e.id === id ? { 
            ...e, 
            placa: placaFormatada, 
            placaOriginal, 
            historico: [...(e.historico || []), newHist] 
          } : e)
        }));
        await firestoreService.atualizarEntrega(id, { 
          placa: placaFormatada, 
          placaOriginal, 
          historico: [...hist, newHist] 
        });
      },

      transferirPlacaPorCarga: async (carga, data, novaPlaca) => {
        if (!carga || !novaPlaca) return;
        const cStr = String(carga).trim();
        const dStr = data ? String(data).trim() : '';
        const pFormatada = String(novaPlaca).trim().toUpperCase();

        // 1. Filtrar entregas da carga
        const entregasDaCarga = (get().entregas || []).filter(e => {
          const matchCarga = String(e.carga || '').trim() === cStr;
          const matchData = dStr ? String(e.data || '').trim() === dStr : true;
          return matchCarga && matchData;
        });

        // 2. Transferir todas as entregas para a nova placa no monitoramento
        if (entregasDaCarga.length > 0) {
          const ids = entregasDaCarga.map(e => e.id);
          await get().transferirPlacaEmMassa(ids, pFormatada);
        }

        // 3. Atualizar ou registrar em cargasProgramacao
        const docId = dStr ? `${dStr}_${cStr}` : cStr;
        const existente = (get().cargasProgramacao || []).find(c => c.id === docId || (c.carga === cStr && (!dStr || c.data === dStr)));
        const payloadProg = {
          ...(existente || {}),
          id: docId,
          carga: cStr,
          data: dStr || existente?.data || new Date().toISOString().split('T')[0],
          placa: pFormatada
        };

        set((state) => {
          const lista = (state.cargasProgramacao || []).filter(c => c.id !== docId && !(c.carga === cStr && (!dStr || c.data === dStr)));
          return {
            cargasProgramacao: [...lista, payloadProg]
          };
        });

        await firestoreService.salvarCargaProgramacao(docId, payloadProg);
      },

      salvarDadosCargaProgramacao: async (docId, dados) => {
        const idStr = String(docId).trim();
        const idAlt = idStr.replace(/\s+/g, '_');
        const listaProg = get().cargasProgramacao || [];
        const existente = listaProg.find(c => 
          c.id === idStr || 
          c.id === idAlt || 
          (c.data === dados.data && c.carga === dados.carga && (!dados.placa || c.placa === dados.placa))
        );
        const finalId = existente?.id || idAlt;

        const payload = {
          ...(existente || {}),
          ...dados,
          id: finalId
        };

        set((state) => {
          const lista = (state.cargasProgramacao || []).filter(c => c.id !== finalId && c.id !== idStr && c.id !== idAlt);
          let entregasAtualizadas = state.entregas || [];
          if (dados.prioridade !== undefined) {
            entregasAtualizadas = entregasAtualizadas.map(e => {
              const eDataMatch = !dados.data || e.data === dados.data;
              const isParada = String(e.carga || '').toUpperCase().includes('PARADA') && String(dados.carga || '').toUpperCase().includes('PARADA');
              const cargaMatch = isParada ? (e.placa === dados.placa) : (e.carga === dados.carga);
              if (eDataMatch && cargaMatch) {
                return { ...e, priCarregamento: dados.prioridade };
              }
              return e;
            });
          }
          return {
            cargasProgramacao: [...lista, payload],
            entregas: entregasAtualizadas
          };
        });

        await firestoreService.salvarCargaProgramacao(finalId, payload);
      },

      alterarDataEntrega: async (id, novaData) => {
        const entrega = get().entregas.find(e => e.id === id);
        if (!entrega || !novaData) return;
        const dataFaturamento = entrega.dataFaturamento || entrega.data;
        const hist = entrega?.historico || [];
        const newHist = {
          status: entrega?.status || 'Alteração de Data',
          data: new Date().toISOString(),
          role: get().currentUser?.role || 'Sistema',
          observacao: `Data operacional alterada de ${entrega.data} para ${novaData} (Faturamento original: ${dataFaturamento})`
        };
        set((state) => ({
          entregas: state.entregas.map((e) => e.id === id ? { 
            ...e, 
            data: novaData, 
            dataFaturamento, 
            historico: [...(e.historico || []), newHist] 
          } : e)
        }));
        await firestoreService.atualizarEntrega(id, { 
          data: novaData, 
          dataFaturamento, 
          historico: [...hist, newHist] 
        });
      },

      alterarExpedicaoEntrega: async (id, novaData, novaPlaca, novaCarga) => {
        const entrega = get().entregas.find(e => e.id === id);
        if (!entrega) return;
        const dataFaturamento = entrega.dataFaturamento || entrega.data;
        const dFinal = novaData || entrega.data;
        const pFinal = novaPlaca ? String(novaPlaca).trim().toUpperCase() : entrega.placa;
        const cFinal = novaCarga ? String(novaCarga).trim() : entrega.carga;

        const hist = entrega?.historico || [];
        const newHist = {
          status: entrega?.status || 'Alteração Operacional',
          data: new Date().toISOString(),
          role: get().currentUser?.role || 'Sistema',
          observacao: `Expedição atualizada: Data ${entrega.data} ➔ ${dFinal} (Fat: ${dataFaturamento}) | Placa ${entrega.placa} ➔ ${pFinal}${cFinal !== entrega.carga ? ` | Carga ${entrega.carga} ➔ ${cFinal}` : ''}`
        };

        const updatePayload = {
          data: dFinal,
          dataFaturamento,
          placa: pFinal,
          carga: cFinal,
          historico: [...hist, newHist]
        };

        set((state) => ({
          entregas: state.entregas.map((e) => e.id === id ? { ...e, ...updatePayload } : e)
        }));

        await firestoreService.atualizarEntrega(id, updatePayload);
      },

      transferirCargaCompleta: async ({ carga, dataOrigem, novaData, novaPlaca }) => {
        if (!carga) return;
        const cStr = String(carga).trim();
        const dOrigemStr = dataOrigem ? String(dataOrigem).trim() : '';
        const entregasDaCarga = (get().entregas || []).filter(e => {
          const matchCarga = String(e.carga || '').trim() === cStr;
          const matchData = dOrigemStr ? String(e.data || '').trim() === dOrigemStr : true;
          return matchCarga && matchData;
        });

        for (const e of entregasDaCarga) {
          await get().alterarExpedicaoEntrega(e.id, novaData, novaPlaca);
        }

        if (novaPlaca) {
          const docId = novaData ? `${novaData}_${cStr}` : (dOrigemStr ? `${dOrigemStr}_${cStr}` : cStr);
          const payloadProg = {
            id: docId,
            carga: cStr,
            data: novaData || dOrigemStr || new Date().toISOString().split('T')[0],
            placa: String(novaPlaca).trim().toUpperCase()
          };
          await firestoreService.salvarCargaProgramacao(docId, payloadProg);
        }
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

          try {
            await firestoreService.atualizarEntrega(id, updatePayload);
          } catch (err) {
            console.error(`Erro ao salvar status em massa no Firestore para doc ${id}:`, err);
          }

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
        if (!ids || ids.length === 0 || !novaPlaca) return;
        const placaFormatada = novaPlaca.trim().toUpperCase();
        const nowIso = new Date().toISOString();
        set((state) => ({
          entregas: state.entregas.map((e) => {
            if (!ids.includes(e.id)) return e;
            const placaOriginal = e.placaOriginal || e.placa;
            const newHist = {
              status: e.status || 'Transferência',
              data: nowIso,
              role: get().currentUser?.role || 'Sistema',
              observacao: `Transferido em lote para placa ${placaFormatada} (Placa original: ${placaOriginal})`
            };
            return {
              ...e,
              placa: placaFormatada,
              placaOriginal,
              historico: [...(e.historico || []), newHist]
            };
          })
        }));
        for (const id of ids) {
          const entrega = get().entregas.find(e => e.id === id);
          const placaOriginal = entrega?.placaOriginal || entrega?.placa;
          const hist = entrega?.historico || [];
          const newHist = {
            status: entrega?.status || 'Transferência',
            data: nowIso,
            role: get().currentUser?.role || 'Sistema',
            observacao: `Transferido em lote para placa ${placaFormatada} (Placa original: ${placaOriginal})`
          };
          await firestoreService.atualizarEntrega(id, { 
            placa: placaFormatada, 
            placaOriginal, 
            historico: [...hist, newHist] 
          });
        }
      },

      alterarDataEntregaEmMassa: async (ids, novaData) => {
        if (!ids || ids.length === 0 || !novaData) return;
        const nowIso = new Date().toISOString();
        set((state) => ({
          entregas: state.entregas.map((e) => {
            if (!ids.includes(e.id)) return e;
            const dataFaturamento = e.dataFaturamento || e.data;
            const newHist = {
              status: e.status || 'Alteração de Data',
              data: nowIso,
              role: get().currentUser?.role || 'Sistema',
              observacao: `Data operacional alterada em lote de ${e.data} para ${novaData} (Faturamento original: ${dataFaturamento})`
            };
            return {
              ...e,
              data: novaData,
              dataFaturamento,
              historico: [...(e.historico || []), newHist]
            };
          })
        }));
        for (const id of ids) {
          const entrega = get().entregas.find(e => e.id === id);
          const dataFaturamento = entrega?.dataFaturamento || entrega?.data;
          const hist = entrega?.historico || [];
          const newHist = {
            status: entrega?.status || 'Alteração de Data',
            data: nowIso,
            role: get().currentUser?.role || 'Sistema',
            observacao: `Data operacional alterada em lote de ${entrega?.data} para ${novaData} (Faturamento original: ${dataFaturamento})`
          };
          await firestoreService.atualizarEntrega(id, { 
            data: novaData, 
            dataFaturamento, 
            historico: [...hist, newHist] 
          });
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
        const todasDevs = get().devolucoes || [];
        const devExistente = todasDevs.find(d => 
          d.notaId === entregaId || 
          (entregaPrincipal && String(d.nota || '').trim() === String(entregaPrincipal.nota || '').trim() && d.status === 'Pendente de recebimento')
        );

        const novaDevolucao = {
          ...(devExistente || {}),
          id: devExistente ? devExistente.id : `dev-${Date.now()}`,
          notaId: entregaId,
          nota: entregaPrincipal ? entregaPrincipal.nota : 'Desconhecida',
          placa: entregaPrincipal ? entregaPrincipal.placa : 'Desconhecida',
          tipo: tipo, 
          itens: itensDevolvidos, 
          quantidadeKg: itensDevolvidos.reduce((acc, curr) => acc + (Number(curr.peso) || 0), 0),
          status: 'Pendente de recebimento',
          tratamento: devExistente?.tratamento || 'Aguardando definição',
          observacao: motivo,
          data: devExistente?.data || new Date().toISOString(),
          atualizadoEm: new Date().toISOString(),
          historico: [
            ...(devExistente?.historico || []),
            {
              status: 'Pendente de recebimento',
              tratamento: devExistente?.tratamento || 'Aguardando definição',
              data: new Date().toISOString(),
              role: get().currentUser?.role || 'Sistema',
              observacao: motivo
            }
          ]
        };

        if (devExistente) {
          set((state) => ({
            devolucoes: (state.devolucoes || []).map(d => d.id === devExistente.id ? novaDevolucao : d)
          }));
          await firestoreService.atualizarDevolucao(devExistente.id, novaDevolucao);
        } else {
          set((state) => ({
            devolucoes: [novaDevolucao, ...(state.devolucoes || [])]
          }));
          await firestoreService.adicionarDevolucao(novaDevolucao);
        }
      },

      importarPreviaCargas: async (entregasPrevia, kmEstimados = []) => {
        const entregasAtuais = [...get().entregas];
        const listaAtualizada = [...entregasAtuais];

        (entregasPrevia || []).forEach(nova => {
          const index = listaAtualizada.findIndex(e => 
            (e.pedido && nova.pedido && String(e.pedido).trim() === String(nova.pedido).trim() && String(e.carga || '').trim() === String(nova.carga || '').trim()) ||
            (e.nota && nova.nota && String(e.nota).trim() === String(nova.nota).trim())
          );

          if (index >= 0) {
            const existente = listaAtualizada[index];
            listaAtualizada[index] = {
              ...existente,
              ...nova,
              id: existente.id,
              status: existente.status,
              isPrevia: true,
              statusFaturamento: 'Previa',
              notaProvisoria: true,
              atualizadoEm: new Date().toISOString()
            };
          } else {
            const docId = `PREV-${nova.pedido}-${Date.now()}`;
            listaAtualizada.push({
              ...nova,
              id: docId,
              isPrevia: true,
              statusFaturamento: 'Previa',
              notaProvisoria: true,
              status: 'Pendente',
              canhoto: false,
              historico: [{
                status: 'Pendente',
                data: new Date().toISOString(),
                role: get().currentUser?.role || 'Sistema',
                observacao: 'Importação de Prévia (8164 + Programação)'
              }],
              atualizadoEm: new Date().toISOString()
            });
          }
        });

        // Atualiza kmRegistros localmente
        const kmRegistrosAtuais = [...(get().kmRegistros || [])];
        if (Array.isArray(kmEstimados) && kmEstimados.length > 0) {
          kmEstimados.forEach(item => {
            const { data, placa, carga, kmPrevisto } = item;
            if (!data || !carga) return;
            const docId = `${data}_${(placa || 'sem-placa').replace(/[\/\\]/g, '-')}_${(carga || 'sem-carga').replace(/[\/\\]/g, '-')}`;
            const idxKm = kmRegistrosAtuais.findIndex(k => k.id === docId);
            if (idxKm >= 0) {
              kmRegistrosAtuais[idxKm] = {
                ...kmRegistrosAtuais[idxKm],
                kmPrevisto: Number(kmPrevisto) || kmRegistrosAtuais[idxKm].kmPrevisto,
                atualizadoEm: new Date().toISOString()
              };
            } else {
              kmRegistrosAtuais.push({
                id: docId,
                data,
                placa: (placa || '').toUpperCase(),
                carga: String(carga).trim(),
                kmPrevisto: Number(kmPrevisto) || 0,
                kmInicial: null,
                kmFinal: null,
                kmExecutado: null,
                atualizadoEm: new Date().toISOString()
              });
            }
          });
        }

        set({ entregas: listaAtualizada, kmRegistros: kmRegistrosAtuais });

        // Sincroniza com o Firestore
        try {
          await firestoreService.importarPreviaCargas(entregasPrevia, kmEstimados);
        } catch (err) {
          console.error('Erro ao salvar prévia no Firestore:', err);
          throw err;
        }
      },

      importarEntregas: async (novasEntregas) => {
        const entregasAtuais = [...get().entregas];
        const novasNormalizadas = (novasEntregas || []).map(e => e.rca ? { ...e, rca: normalizarRCA(e.rca) } : e);
        
        // Atualização otimista imediata no estado local do Zustand
        const listaAtualizada = [...entregasAtuais];
        novasNormalizadas.forEach(nova => {
          // Busca por nota ou por pedido/carga caso seja prévia
          const index = listaAtualizada.findIndex(e => {
            if (e.nota && nova.nota && String(e.nota).trim() === String(nova.nota).trim()) return true;
            if (e.pedido && nova.pedido && String(e.pedido).trim() === String(nova.pedido).trim()) {
              if (e.carga && nova.carga && String(e.carga).trim() === String(nova.carga).trim()) return true;
              if (e.isPrevia) return true;
            }
            return false;
          });

          const novaDataFat = nova.dataFaturamento || nova.data;
          const novaPlacaOrig = nova.placaOriginal || nova.placa;

          if (index >= 0) {
            const existente = listaAtualizada[index];
            const dataCustomizada = existente.data && existente.dataFaturamento && existente.data !== existente.dataFaturamento;
            const placaCustomizada = existente.placa && existente.placaOriginal && existente.placa !== existente.placaOriginal;

            let historicoAtualizado = Array.isArray(existente.historico) ? [...existente.historico] : [];
            if (existente.isPrevia) {
              historicoAtualizado.push({
                status: existente.status,
                data: new Date().toISOString(),
                role: get().currentUser?.role || 'Sistema',
                observacao: `Faturamento confirmado: NF ${nova.nota} gerada no ERP`
              });
            }

            listaAtualizada[index] = {
              ...existente,
              ...nova,
              id: existente.id,
              nota: nova.nota,
              isPrevia: false,
              statusFaturamento: 'Faturado',
              notaProvisoria: false,
              data: dataCustomizada ? existente.data : (nova.data || existente.data),
              dataFaturamento: novaDataFat || existente.dataFaturamento || existente.data,
              placa: placaCustomizada ? existente.placa : (nova.placa || existente.placa),
              placaOriginal: novaPlacaOrig || existente.placaOriginal || existente.placa,
              status: existente.status,
              canhoto: existente.canhoto || false,
              horaChegada: existente.horaChegada || null,
              horaSaida: existente.horaSaida || null,
              tempoFormatado: existente.tempoFormatado || null,
              historico: historicoAtualizado,
              atualizadoEm: new Date().toISOString()
            };
          } else {
            listaAtualizada.push({
              ...nova,
              id: `${nova.nota}-${Date.now()}`,
              isPrevia: false,
              statusFaturamento: 'Faturado',
              notaProvisoria: false,
              dataFaturamento: novaDataFat,
              placaOriginal: novaPlacaOrig,
              status: 'Pendente',
              canhoto: false,
              historico: [{
                status: 'Pendente',
                data: new Date().toISOString(),
                role: get().currentUser?.role || 'Sistema',
                observacao: 'Importação inicial (Faturamento 8132)'
              }],
              atualizadoEm: new Date().toISOString()
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

      atualizarEntregasPorPlanilha: async (linhas, opcoes = {}) => {
        const { cadastrarNovas = true, atualizarPlaca = true, atualizarPesosValores = true } = opcoes;
        const nowIso = new Date().toISOString();
        const entregasAtuais = [...get().entregas];
        const listaAtualizada = [...entregasAtuais];

        (linhas || []).forEach(item => {
          if (!item.nota) return;
          const strNota = String(item.nota).trim();
          const index = listaAtualizada.findIndex(e => String(e.nota || '').trim() === strNota);

          const novoStatus = item.status;
          const isChegada = ['No cliente', 'Descarregando'].includes(novoStatus);
          const isConclusao = ['Entrega total', 'Entrega parcial', 'Devolução total', 'Reentrega', 'Carga parada'].includes(novoStatus);

          if (index >= 0) {
            const existente = listaAtualizada[index];
            const statusMudou = novoStatus && existente.status !== novoStatus;

            let historicoAtualizado = Array.isArray(existente.historico) ? [...existente.historico] : [];
            if (statusMudou) {
              historicoAtualizado.push({
                status: novoStatus,
                data: nowIso,
                role: get().currentUser?.role || 'Sistema',
                observacao: `Status alterado de "${existente.status}" para "${novoStatus}" via planilha de Rotas & Cargas`
              });
            }

            let horaChegada = existente.horaChegada || null;
            let horaSaida = existente.horaSaida || null;
            let tempoMinutos = existente.tempoMinutos !== undefined ? existente.tempoMinutos : null;
            let tempoFormatado = existente.tempoFormatado || null;

            if (isChegada && !horaChegada) {
              horaChegada = nowIso;
            }
            if (isConclusao && statusMudou) {
              horaSaida = nowIso;
              if (horaChegada) {
                const diffMs = new Date(horaSaida).getTime() - new Date(horaChegada).getTime();
                tempoMinutos = Math.max(0, Math.round(diffMs / 60000));
                tempoFormatado = formatarDuracaoMinutos(tempoMinutos);
              }
            }

            listaAtualizada[index] = {
              ...existente,
              id: existente.id,
              ...(novoStatus ? { status: novoStatus } : {}),
              ...(statusMudou ? { historico: historicoAtualizado } : {}),
              ...(novoStatus === 'Entrega total' ? { canhoto: true } : {}),
              ...(horaChegada ? { horaChegada } : {}),
              ...(horaSaida ? { horaSaida } : {}),
              ...(tempoMinutos !== null ? { tempoMinutos, tempoFormatado } : {}),
              ...(atualizarPlaca && item.placa ? { placa: String(item.placa).toUpperCase().trim() } : {}),
              ...(atualizarPesosValores && item.peso > 0 ? { peso: item.peso } : {}),
              ...(atualizarPesosValores && item.valor > 0 ? { valor: item.valor } : {}),
              ...(item.codCliente && !existente.codCliente ? { codCliente: item.codCliente } : {}),
              ...(item.cliente && (!existente.cliente || existente.cliente === 'CLIENTE NÃO IDENTIFICADO') ? { cliente: item.cliente } : {}),
              ...(item.municipio && !existente.municipio ? { municipio: item.municipio, cidade: item.municipio } : {}),
              ...(item.bairro && !existente.bairro ? { bairro: item.bairro } : {}),
              atualizadoEm: nowIso
            };
          } else if (cadastrarNovas) {
            const docId = `${strNota}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
            const horaChegada = isChegada ? nowIso : null;
            const horaSaida = isConclusao ? nowIso : null;

            listaAtualizada.push({
              id: docId,
              nota: strNota,
              codCliente: item.codCliente || '',
              cliente: item.cliente || 'CLIENTE NÃO IDENTIFICADO',
              municipio: item.municipio || '',
              cidade: item.municipio || '',
              bairro: item.bairro || '',
              placa: item.placa ? String(item.placa).toUpperCase().trim() : '',
              placaOriginal: item.placa ? String(item.placa).toUpperCase().trim() : '',
              peso: item.peso || 0,
              valor: item.valor || 0,
              data: item.data || nowIso.split('T')[0],
              dataFaturamento: item.data || nowIso.split('T')[0],
              status: novoStatus || 'Pendente',
              statusFaturamento: 'Faturado',
              isPrevia: false,
              canhoto: novoStatus === 'Entrega total',
              horaChegada,
              horaSaida,
              historico: [{
                status: novoStatus || 'Pendente',
                data: nowIso,
                role: get().currentUser?.role || 'Sistema',
                observacao: `Importado via planilha de Rotas & Cargas (Status: ${novoStatus || 'Pendente'})`
              }],
              atualizadoEm: nowIso
            });
          }
        });

        // Atualização otimista imediata no Zustand
        set({ entregas: listaAtualizada });

        // Sincroniza com o Firestore
        try {
          await firestoreService.atualizarEntregasPorPlanilha(linhas, opcoes, entregasAtuais);
        } catch (err) {
          console.error('Erro ao sincronizar atualização em lote no Firestore:', err);
          throw err;
        }
      },

      agendarReentrega: async ({ 
        nota, 
        novaData, 
        novaPlaca, 
        novaCarga = 'CARGA PARADA', 
        novaRota = '', 
        priCarregamento = null,
        observacao = '' 
      }) => {
        const strNota = String(nota).trim();
        const entregasAtuais = get().entregas || [];
        const original = entregasAtuais.find(e => String(e.nota).trim() === strNota && !e.isReentrega) 
          || entregasAtuais.find(e => String(e.nota).trim() === strNota);

        if (!original) {
          throw new Error(`Nota ${strNota} não encontrada no sistema.`);
        }

        const nowIso = new Date().toISOString();
        const idNovaEntrega = `REENT-${strNota}-${novaData}`;
        const placaFormatada = String(novaPlaca).toUpperCase().trim();
        const isCargaParada = String(novaCarga).toUpperCase().includes('PARADA') || String(novaCarga).toUpperCase().includes('REENTREGA');
        const cargaFormatada = isCargaParada ? 'CARGA PARADA' : String(novaCarga).trim();

        const priFinal = (priCarregamento !== null && priCarregamento !== undefined && priCarregamento !== '' && !isNaN(Number(priCarregamento)))
          ? Number(priCarregamento)
          : (original.priCarregamento !== undefined && original.priCarregamento !== null ? Number(original.priCarregamento) : null);

        const novaEntregaObj = {
          ...original,
          id: idNovaEntrega,
          nota: strNota,
          pedido: original.pedido || strNota,
          codCliente: original.codCliente || '',
          cliente: original.cliente || 'CLIENTE NÃO IDENTIFICADO',
          cidade: original.cidade || original.municipio || '',
          municipio: original.municipio || original.cidade || '',
          bairro: original.bairro || '',
          rota: novaRota || original.rota || '',
          placa: placaFormatada,
          placaOriginal: original.placaOriginal || original.placa,
          carga: cargaFormatada,
          data: novaData,
          dataFaturamento: original.dataFaturamento || original.data,
          dataOriginalFaturamento: original.dataFaturamento || original.data,
          rca: original.rca || '',
          status: 'Pendente',
          canhoto: false,
          isReentrega: true,
          valorFaturamento: 0,
          peso: original.peso || 0,
          valor: original.valor || 0,
          statusFaturamento: 'Previa',
          notaProvisoria: false,
          priCarregamento: priFinal,
          observacaoProgramacao: observacao || `Reentrega NF ${strNota}`,
          observacao: observacao || `Reentrega agendada na placa ${placaFormatada} (Origem: ${original.placa} em ${original.data})`,
          historico: [{
            status: 'Pendente',
            data: nowIso,
            role: get().currentUser?.role || 'Sistema',
            observacao: `Reentrega agendada para ${novaData} no veículo ${placaFormatada} (Carga: ${cargaFormatada})`
          }],
          itens: original.itens || [],
          atualizadoEm: nowIso
        };

        const indexExistente = entregasAtuais.findIndex(e => e.id === idNovaEntrega);
        let novasEntregas;
        if (indexExistente >= 0) {
          novasEntregas = [...entregasAtuais];
          novasEntregas[indexExistente] = novaEntregaObj;
        } else {
          novasEntregas = [novaEntregaObj, ...entregasAtuais];
        }

        // Atualiza a devolução se existir
        const devAtual = (get().devolucoes || []).find(d => String(d.nota || d.nf).trim() === strNota);
        let devAtualizadas = get().devolucoes || [];
        let payloadDev = null;
        if (devAtual) {
          const hist = devAtual.historico || [];
          payloadDev = {
            ...devAtual,
            status: 'Reentrega Agendada',
            tratamento: `Agendado p/ ${novaData} (${placaFormatada})`,
            historico: [...hist, {
              data: nowIso,
              usuario: get().currentUser?.nome || 'Usuário',
              role: get().currentUser?.role || 'Monitoramento',
              status: 'Reentrega Agendada',
              observacao: `Reentrega agendada para o dia ${novaData} no veículo ${placaFormatada} (Carga: ${cargaFormatada})`
            }],
            atualizadoEm: nowIso
          };
          devAtualizadas = devAtualizadas.map(d => d.id === devAtual.id ? payloadDev : d);
        }

        // Atualiza / cria a linha na programação de cargas
        const cargasProgAtuais = get().cargasProgramacao || [];
        let docIdProg;
        let progExistente = null;

        if (isCargaParada) {
          docIdProg = `${novaData}_CARGA_PARADA_${placaFormatada}`;
          progExistente = cargasProgAtuais.find(cp => 
            cp.id === docIdProg || 
            (cp.data === novaData && String(cp.carga).toUpperCase().includes('PARADA') && String(cp.placa).toUpperCase().trim() === placaFormatada)
          );
        } else {
          docIdProg = `${novaData}_${cargaFormatada}`;
          progExistente = cargasProgAtuais.find(cp => 
            cp.id === docIdProg || 
            (cp.data === novaData && String(cp.carga).trim() === cargaFormatada)
          );
        }

        let obsProg = observacao || `Reentrega NF ${strNota}`;
        if (progExistente?.observacao && !progExistente.observacao.includes(strNota)) {
          obsProg = `${progExistente.observacao}; ${obsProg}`;
        }

        const progObj = {
          ...(progExistente || {}),
          id: docIdProg,
          data: novaData,
          carga: cargaFormatada,
          placa: placaFormatada,
          rota: novaRota || progExistente?.rota || original.rota || '',
          prioridade: priFinal !== null ? priFinal : (progExistente?.prioridade || null),
          observacao: obsProg,
          isReentrega: isCargaParada ? true : (progExistente?.isReentrega || false),
          atualizadoEm: nowIso
        };

        const indexProgExistente = cargasProgAtuais.findIndex(cp => cp.id === docIdProg);
        let novasCargasProg;
        if (indexProgExistente >= 0) {
          novasCargasProg = [...cargasProgAtuais];
          novasCargasProg[indexProgExistente] = progObj;
        } else {
          novasCargasProg = [...cargasProgAtuais, progObj];
        }

        set({ 
          entregas: novasEntregas,
          devolucoes: devAtualizadas,
          cargasProgramacao: novasCargasProg
        });

        await firestoreService.salvarReentrega(novaEntregaObj, progObj, payloadDev);
        return novaEntregaObj;
      },

      removerEntregasPorData: async (dataStr) => {
        set((state) => ({
          entregas: state.entregas.filter(e => {
            if (e.data !== dataStr) return true;
            // Preserva reentregas agendadas nesta data
            if (e.isReentrega || String(e.id || '').startsWith('REENT-')) return true;
            return false;
          })
        }));
        await firestoreService.removerEntregasPorData(dataStr);
      },

      removerEntregaPorId: async (id) => {
        set((state) => ({
          entregas: state.entregas.filter(e => e.id !== id)
        }));
        await firestoreService.removerEntregaPorId(id);
      },

      removerEntregasPorCarga: async (carga, dataStr) => {
        const cargaStr = String(carga).trim();
        set((state) => ({
          entregas: state.entregas.filter(e => {
            const matchCarga = String(e.carga || '').trim() === cargaStr;
            const matchData = dataStr ? e.data === dataStr : true;
            if (matchCarga && matchData) {
              // Preserva reentregas agendadas
              if (e.isReentrega || String(e.id || '').startsWith('REENT-')) return true;
              return false;
            }
            return true;
          })
        }));
        await firestoreService.removerEntregasPorCarga(cargaStr, dataStr);
      },

      atribuirPlacaCarga: async (carga, novaPlaca, dataStr) => {
        const cargaStr = String(carga).trim();
        const placaNorm = String(novaPlaca).trim().toUpperCase();
        set((state) => ({
          entregas: state.entregas.map(e => {
            const matchCarga = String(e.carga || '').trim() === cargaStr;
            const matchData = dataStr ? e.data === dataStr : true;
            if (matchCarga && matchData) {
              return {
                ...e,
                placa: placaNorm,
                placaOriginal: placaNorm,
                atualizadoEm: new Date().toISOString()
              };
            }
            return e;
          })
        }));
        await firestoreService.atribuirPlacaCarga(cargaStr, placaNorm, dataStr);
      },

      atribuirPlacaEntrega: async (id, novaPlaca) => {
        const placaNorm = String(novaPlaca).trim().toUpperCase();
        set((state) => ({
          entregas: state.entregas.map(e => e.id === id ? {
            ...e,
            placa: placaNorm,
            placaOriginal: placaNorm,
            atualizadoEm: new Date().toISOString()
          } : e)
        }));
        await firestoreService.atribuirPlacaEntrega(id, placaNorm);
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
        const notaStr = String(devolucao.nota || devolucao.nf || '').trim();
        const existentes = get().devolucoes || [];
        const existente = existentes.find(d => 
          (devolucao.notaId && d.notaId === devolucao.notaId) ||
          (notaStr && String(d.nota || d.nf || '').trim() === notaStr && d.status === 'Pendente de recebimento')
        );

        if (existente) {
          await get().editarDevolucao(existente.id, devolucao);
          return;
        }

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
        const usuarioNome = get().currentUser?.nome || get().currentUser?.email || 'Usuário';
        const usuarioRole = get().currentUser?.role || 'Sistema';
        const tratFinal = tratamento || dev.tratamento || 'Aguardando definição';
        const updateData = { 
          status: novoStatus,
          ...(tratamento ? { tratamento } : {}),
          historico: [...hist, {
            status: novoStatus,
            tratamento: tratFinal,
            statusAnterior: dev.status,
            tratamentoAnterior: dev.tratamento || 'Aguardando definição',
            data: new Date().toISOString(),
            usuario: usuarioNome,
            role: usuarioRole,
            observacao: observacao || `Status: "${dev.status}" ➔ "${novoStatus}" | Tratamento: "${dev.tratamento || 'Aguardando definição'}" ➔ "${tratFinal}"`
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
          semRetornoFisico: dados.semRetornoFisico || dados.tipo === 'Devolução de gramatura' || dados.subtipo === 'gramatura',
          subtipo: dados.subtipo || (dados.tipo === 'Devolução de gramatura' ? 'gramatura' : 'fisica'),
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

        dispatchRemotePush({
          targetType: 'gestao',
          targetRoles: ['Monitoramento', 'Operacao'],
          operacaoSubRole: 'Docas',
          title: `🚨 Devolução ${novaSolicitacao.tipo} (${novaSolicitacao.placa})`,
          body: `NF ${novaSolicitacao.nota} • ${novaSolicitacao.cliente || ''} — ${novaSolicitacao.motivo}`,
          url: '/devolucoes',
          tag: `solic-dev-${docId}`,
          soundType: 'alarm'
        });

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
            else if (tipo === 'Parcial' || tipo === 'Devolução de gramatura' || String(tipo).toLowerCase().includes('gramatura')) statusParaEntrega = 'Entrega parcial';
            else if (tipo === 'Reentrega') statusParaEntrega = 'Reentrega';
            else statusParaEntrega = 'Devolução total';
          }

          const itens = itensFinal !== undefined ? itensFinal : (solic.itensDevolvidos || []);
          const peso = pesoFinal !== undefined ? Number(pesoFinal) : (Number(solic.pesoTotalDevolvido) || 0);
          const motivo = motivoFinal || solic.motivo || 'Devolução autorizada pelo Monitoramento';
          const tratamento = tratamentoFinal || 'Aguardando definição';
          const isGram = tipo === 'Devolução de gramatura' || !!solic.semRetornoFisico || String(tipo).toLowerCase().includes('gramatura');

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
            semRetornoFisico: isGram,
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

          if (solic.placa) {
            dispatchRemotePush({
              targetType: 'placa',
              targetPlaca: solic.placa,
              title: `✅ Devolução Autorizada • NF ${solic.nota}`,
              body: `${tipo} aprovada pelo Monitoramento${observacaoMonitoramento ? `: ${observacaoMonitoramento}` : '.'}`,
              url: '/',
              tag: `resp-dev-${solicitacaoId}`,
              soundType: 'alarm'
            });
          }

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

          if (solic.placa) {
            dispatchRemotePush({
              targetType: 'placa',
              targetPlaca: solic.placa,
              title: `❌ Devolução Recusada • NF ${solic.nota}`,
              body: motivoRecusa,
              url: '/',
              tag: `resp-dev-rec-${solicitacaoId}`,
              soundType: 'alarm'
            });
          }
        }
      },

      editarDevolucao: async (id, dadosAtualizados) => {
        const devAtual = (get().devolucoes || []).find(d => d.id === id);
        const hist = devAtual?.historico || [];
        const usuarioNome = get().currentUser?.nome || get().currentUser?.email || 'Usuário';
        const usuarioRole = get().currentUser?.role || 'Monitoramento';
        const newHist = {
          data: new Date().toISOString(),
          usuario: usuarioNome,
          role: usuarioRole,
          status: dadosAtualizados.status || devAtual?.status || 'Pendente de recebimento',
          tratamento: dadosAtualizados.tratamento || devAtual?.tratamento || 'Aguardando definição',
          observacao: `Alteração cadastral: ${dadosAtualizados.tipo ? `Tipo=${dadosAtualizados.tipo}; ` : ''}${dadosAtualizados.quantidadeKg ? `Peso=${dadosAtualizados.quantidadeKg}kg; ` : ''}${dadosAtualizados.observacao ? `Motivo=${dadosAtualizados.observacao}` : ''}`
        };
        const payloadComHist = {
          ...dadosAtualizados,
          historico: [...hist, newHist]
        };
        set((state) => ({
          devolucoes: (state.devolucoes || []).map(d => d.id === id ? { ...d, ...payloadComHist } : d)
        }));
        await firestoreService.atualizarDevolucao(id, payloadComHist);

        // Se o tipo da devolução foi alterado, sincronizar com o status da entrega
        if (dadosAtualizados.tipo && devAtual) {
          const tipoNovo = dadosAtualizados.tipo;
          let statusParaEntrega = 'Devolução total';
          if (tipoNovo === 'Parcial' || tipoNovo === 'Devolução de gramatura' || String(tipoNovo).toLowerCase().includes('gramatura')) statusParaEntrega = 'Entrega parcial';
          else if (tipoNovo === 'Reentrega') statusParaEntrega = 'Reentrega';
          else if (tipoNovo === 'Total') statusParaEntrega = 'Devolução total';

          const entrega = (get().entregas || []).find(e => (devAtual.notaId && e.id === devAtual.notaId) || String(e.nota) === String(devAtual.nota));
          if (entrega && entrega.status !== statusParaEntrega) {
            const hist = entrega.historico || [];
            const newHist = {
              status: statusParaEntrega,
              data: new Date().toISOString(),
              role: get().currentUser?.role || 'Monitoramento',
              observacao: `Devolução editada: tipo alterado para ${tipoNovo} (peso: ${dadosAtualizados.quantidadeKg || devAtual.quantidadeKg || 0}kg)`
            };
            const updatePayload = {
              status: statusParaEntrega,
              historico: [...hist, newHist]
            };
            set(state => ({
              entregas: (state.entregas || []).map(e => e.id === entrega.id ? { ...e, ...updatePayload } : e)
            }));
            await firestoreService.atualizarEntrega(entrega.id, updatePayload);
          }
        }
      }
    }),
    {
      name: 'logistrack-storage',
      // A sessão de login vem assinada criptograficamente do Firebase Auth (IndexedDB), evitando escalonamento via localStorage
      partialize: () => ({}),
    }
  )
);

