import { db } from './firebase';
import { 
  collection, doc, setDoc, updateDoc, deleteDoc, 
  writeBatch, getDocs, getDoc, query, where, onSnapshot, arrayUnion 
} from 'firebase/firestore';

// References
const entregasRef = collection(db, 'entregas');
const devolucoesRef = collection(db, 'devolucoes');
const despesasRef = collection(db, 'despesas');
const motoristasRef = collection(db, 'motoristas');
const cargasFinalizadasRef = collection(db, 'cargas_finalizadas');
const kmRegistrosRef = collection(db, 'km_registros');
const clientesGeolocRef = collection(db, 'clientes_geoloc');
const solicitacoesGeolocRef = collection(db, 'solicitacoes_geoloc');
const solicitacoesDevolucaoRef = collection(db, 'solicitacoes_devolucao');
const gruposClientesRef = collection(db, 'grupos_clientes');
const veiculosRef = collection(db, 'veiculos_cadastro');
const funcionariosRJRef = collection(db, 'funcionarios_rj');
const cargasProgramacaoRef = collection(db, 'cargas_programacao');
const credenciaisFrotaRef = collection(db, 'credenciais_frota');
const rastreamentoFrotaRef = collection(db, 'rastreamento_frota');
const rotasGpsRef = collection(db, 'rotas_gps');
const fcmTokensRef = collection(db, 'fcm_tokens');

// Helper para criar listeners resilientes que se auto-reconectam em caso de queda de rede ou oscilações
function createResilientListener(targetRef, transform, callback, name = 'Colecao') {
  let unsubscribe = null;
  let retryTimeout = null;
  let isStopped = false;

  const connect = () => {
    if (isStopped) return;
    try {
      if (unsubscribe) {
        try { unsubscribe(); } catch (_) {}
        unsubscribe = null;
      }

      unsubscribe = onSnapshot(
        targetRef,
        { includeMetadataChanges: true },
        (snapshot) => {
          try {
            const data = transform(snapshot);
            callback(data, snapshot.metadata);
          } catch (err) {
            console.error(`[Firestore:${name}] Erro ao mapear dados:`, err);
          }
        },
        (error) => {
          console.warn(`[Firestore:${name}] Conexão oscilou ou falhou:`, error?.message || error);
          if (!isStopped) {
            if (retryTimeout) clearTimeout(retryTimeout);
            retryTimeout = setTimeout(() => {
              console.log(`[Firestore:${name}] Reconectando listener em tempo real...`);
              connect();
            }, 5000);
          }
        }
      );
    } catch (err) {
      console.error(`[Firestore:${name}] Exceção ao registrar listener:`, err);
      if (!isStopped) {
        if (retryTimeout) clearTimeout(retryTimeout);
        retryTimeout = setTimeout(connect, 5000);
      }
    }
  };

  connect();

  return () => {
    isStopped = true;
    if (retryTimeout) clearTimeout(retryTimeout);
    if (unsubscribe) {
      try { unsubscribe(); } catch (_) {}
    }
  };
}

export const firestoreService = {
  // Listeners resilientes (usados no useEffect principal para alimentar o Zustand)
  subscribeFuncionariosRJ: (callback) => {
    return createResilientListener(
      funcionariosRJRef,
      (snapshot) => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      callback,
      'funcionarios_rj'
    );
  },

  subscribeConfigDiarias: (callback) => {
    return createResilientListener(
      doc(db, 'configuracoes', 'tabela_diarias'),
      (snap) => snap.exists() ? snap.data() : null,
      callback,
      'configuracoes_diarias'
    );
  },

  subscribeVeiculos: (callback) => {
    return createResilientListener(
      veiculosRef,
      (snapshot) => snapshot.docs.map(doc => ({ id: doc.id, placa: doc.id, ...doc.data() })),
      callback,
      'veiculos_cadastro'
    );
  },

  subscribeGruposClientes: (callback) => {
    return createResilientListener(
      gruposClientesRef,
      (snapshot) => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      callback,
      'grupos_clientes'
    );
  },

  subscribeSolicitacoesDevolucao: (callback) => {
    return createResilientListener(
      solicitacoesDevolucaoRef,
      (snapshot) => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      callback,
      'solicitacoes_devolucao'
    );
  },

  subscribeEntregas: (callback) => {
    return createResilientListener(
      entregasRef,
      (snapshot) => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      callback,
      'entregas'
    );
  },

  subscribeDevolucoes: (callback) => {
    return createResilientListener(
      devolucoesRef,
      (snapshot) => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      callback,
      'devolucoes'
    );
  },

  subscribeDespesas: (callback) => {
    return createResilientListener(
      despesasRef,
      (snapshot) => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      callback,
      'despesas'
    );
  },

  subscribeMotoristas: (callback) => {
    return createResilientListener(
      motoristasRef,
      (snapshot) => snapshot.docs.map(doc => ({ placa: doc.id, ...doc.data() })),
      callback,
      'motoristas'
    );
  },

  subscribeCargasFinalizadas: (callback) => {
    return createResilientListener(
      cargasFinalizadasRef,
      (snapshot) => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      callback,
      'cargas_finalizadas'
    );
  },

  subscribeKmRegistros: (callback) => {
    return createResilientListener(
      kmRegistrosRef,
      (snapshot) => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      callback,
      'km_registros'
    );
  },

  subscribeClientesGeoloc: (callback) => {
    return createResilientListener(
      clientesGeolocRef,
      (snapshot) => snapshot.docs.map(doc => ({ id: doc.id, codCliente: doc.id, ...doc.data() })),
      callback,
      'clientes_geoloc'
    );
  },

  subscribeSolicitacoesGeoloc: (callback) => {
    return createResilientListener(
      solicitacoesGeolocRef,
      (snapshot) => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      callback,
      'solicitacoes_geoloc'
    );
  },

  subscribeCargasProgramacao: (callback) => {
    return createResilientListener(
      cargasProgramacaoRef,
      (snapshot) => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      callback,
      'cargas_programacao'
    );
  },

  // --- Listeners Otimizados Exclusivos para o Perfil Motorista (Filtrados por Placa e Últimos 7 Dias) ---
  subscribeEntregasMotorista: (placa, dataMinima, callback) => {
    const placaNorm = String(placa || '').trim().toUpperCase();
    const q = query(entregasRef, where('placa', '==', placaNorm));
    const finalizadas = ['Entrega total', 'Entrega parcial', 'Devolução total', 'Reentrega', 'Carga parada', 'No estoque'];
    return createResilientListener(
      q,
      (snapshot) => snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(item => !dataMinima || !item.data || item.data >= dataMinima || !finalizadas.includes(item.status)),
      callback,
      `entregas_motorista_${placaNorm}`
    );
  },

  subscribeMotoristaUnico: (placa, callback) => {
    const placaNorm = String(placa || '').trim().toUpperCase();
    return createResilientListener(
      doc(db, 'motoristas', placaNorm),
      (snap) => snap.exists() ? [{ placa: snap.id, ...snap.data() }] : [],
      callback,
      `motorista_${placaNorm}`
    );
  },

  subscribeDespesasMotorista: (placa, dataMinima, callback) => {
    const placaNorm = String(placa || '').trim().toUpperCase();
    const q = query(despesasRef, where('motorista_placa', '==', placaNorm));
    return createResilientListener(
      q,
      (snapshot) => snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(item => {
          if (item.status === 'Pendente') return true;
          const dataRef = item.data || (item.data_solicitacao ? String(item.data_solicitacao).split('T')[0] : '');
          return !dataMinima || !dataRef || dataRef >= dataMinima;
        }),
      callback,
      `despesas_motorista_${placaNorm}`
    );
  },

  subscribeKmRegistrosMotorista: (placa, dataMinima, callback) => {
    const placaNorm = String(placa || '').trim().toUpperCase();
    const q = query(kmRegistrosRef, where('placa', '==', placaNorm));
    return createResilientListener(
      q,
      (snapshot) => snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(item => !dataMinima || !item.data || item.data >= dataMinima),
      callback,
      `km_motorista_${placaNorm}`
    );
  },

  subscribeCargasFinalizadasMotorista: (placa, dataMinima, callback) => {
    const placaNorm = String(placa || '').trim().toUpperCase();
    const q = query(cargasFinalizadasRef, where('placa', '==', placaNorm));
    return createResilientListener(
      q,
      (snapshot) => snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(item => !dataMinima || !item.data || item.data >= dataMinima),
      callback,
      `cargas_finalizadas_motorista_${placaNorm}`
    );
  },

  subscribeSolicitacoesDevolucaoMotorista: (placa, dataMinima, callback) => {
    const placaNorm = String(placa || '').trim().toUpperCase();
    const q = query(solicitacoesDevolucaoRef, where('placa', '==', placaNorm));
    return createResilientListener(
      q,
      (snapshot) => snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(item => {
          if (item.statusSolicitacao === 'Pendente') return true;
          const dataRef = item.data ? String(item.data).split('T')[0] : (item.criadoEm ? String(item.criadoEm).split('T')[0] : '');
          return !dataMinima || !dataRef || dataRef >= dataMinima;
        }),
      callback,
      `solic_dev_motorista_${placaNorm}`
    );
  },

  subscribeSolicitacoesGeolocMotorista: (placa, dataMinima, callback) => {
    const placaNorm = String(placa || '').trim().toUpperCase();
    const q = query(solicitacoesGeolocRef, where('motoristaPlaca', '==', placaNorm));
    return createResilientListener(
      q,
      (snapshot) => snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(item => {
          if ((item.status || '').toLowerCase() === 'pendente') return true;
          const dataRef = item.data ? String(item.data).split('T')[0] : (item.criadoEm ? String(item.criadoEm).split('T')[0] : '');
          return !dataMinima || !dataRef || dataRef >= dataMinima;
        }),
      callback,
      `solic_geoloc_motorista_${placaNorm}`
    );
  },

  buscarClientesGeolocPorCodigos: async (codigosArray = []) => {
    const unicos = Array.from(new Set(codigosArray.map(c => String(c || '').trim()).filter(Boolean)));
    if (unicos.length === 0) return [];
    const snaps = await Promise.all(
      unicos.map(cod => getDoc(doc(db, 'clientes_geoloc', cod)).catch(() => null))
    );
    return snaps
      .filter(s => s && s.exists())
      .map(s => ({ id: s.id, codCliente: s.id, ...s.data() }));
  },

  salvarCargaProgramacao: async (docId, dados) => {
    const idStr = String(docId).trim();
    const docRef = doc(db, 'cargas_programacao', idStr);
    await setDoc(docRef, {
      ...dados,
      id: idStr,
      atualizadoEm: new Date().toISOString()
    }, { merge: true });
    return idStr;
  },

  salvarCargasProgramacaoEmLote: async (lista) => {
    if (!lista || lista.length === 0) return;
    
    // Busca dados existentes na coleção cargas_programacao para preservar placas e prioridades manuais
    let mapaExistente = new Map();
    try {
      const snap = await getDocs(cargasProgramacaoRef);
      snap.docs.forEach(d => {
        mapaExistente.set(d.id, d.data());
      });
    } catch (err) {
      console.warn("Não foi possível carregar cargas_programacao existentes antes do merge:", err);
    }

    const batch = writeBatch(db);
    lista.forEach(item => {
      const idStr = item.id || `${item.data}_${item.carga}`;
      const docRef = doc(db, 'cargas_programacao', idStr);
      const existente = mapaExistente.get(idStr);

      const placaValida = (item.placa && item.placa !== 'SEM PLACA' && item.placa !== 'Sem Placa')
        ? item.placa
        : (existente?.placa || item.placa || 'SEM PLACA');

      const priValida = (item.prioridade !== null && item.prioridade !== undefined && item.prioridade !== '')
        ? item.prioridade
        : (existente?.prioridade ?? item.prioridade ?? null);

      const rotaValida = (item.rota && item.rota !== 'N/D') ? item.rota : (existente?.rota || item.rota || '');
      const tipoValido = (item.tipoVeiculo && item.tipoVeiculo !== 'N/D') ? item.tipoVeiculo : (existente?.tipoVeiculo || item.tipoVeiculo || 'N/D');
      const obsValida = item.observacao || existente?.observacao || '';

      const docData = {
        ...(existente || {}),
        ...item,
        id: idStr,
        placa: placaValida,
        prioridade: priValida !== undefined ? priValida : null,
        rota: rotaValida,
        tipoVeiculo: tipoValido,
        observacao: obsValida,
        atualizadoEm: new Date().toISOString()
      };

      // Limpar campos undefined para evitar erro de serialização do Firestore
      Object.keys(docData).forEach(k => {
        if (docData[k] === undefined) {
          docData[k] = null;
        }
      });

      batch.set(docRef, docData, { merge: true });
    });
    await batch.commit();
  },

  // Sincronização direta e forçada do servidor (Server bypass de cache)
  forcarSincronizacaoEntregas: async () => {
    const snap = await getDocs(entregasRef);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  forcarSincronizacaoGeral: async () => {
    const [snapEntregas, snapMotoristas, snapDevolucoes, snapVeiculos] = await Promise.all([
      getDocs(entregasRef),
      getDocs(motoristasRef),
      getDocs(devolucoesRef),
      getDocs(veiculosRef)
    ]);
    return {
      entregas: snapEntregas.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      motoristas: snapMotoristas.docs.map(doc => ({ placa: doc.id, ...doc.data() })),
      devolucoes: snapDevolucoes.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      veiculos: snapVeiculos.docs.map(doc => ({ id: doc.id, placa: doc.id, ...doc.data() }))
    };
  },

  salvarClienteGeoloc: async (codCliente, dadosCliente) => {
    const docId = String(codCliente).trim();
    const cRef = doc(db, 'clientes_geoloc', docId);
    await setDoc(cRef, {
      ...dadosCliente,
      codCliente: docId,
      atualizadoEm: new Date().toISOString()
    }, { merge: true });
    return docId;
  },

  salvarPontoCliente: async (codCliente, ponto, dadosBasicosCliente = {}) => {
    const docId = String(codCliente).trim();
    const cRef = doc(db, 'clientes_geoloc', docId);
    const snap = await getDoc(cRef);
    const existing = snap.exists() ? snap.data() : { pontos: [], ...dadosBasicosCliente };
    
    const { editIndex, ...pontoSemIndex } = ponto || {};
    let pontos = existing.pontos ? [...existing.pontos] : [];
    const pontoId = pontoSemIndex.id || `${Date.now()}`;
    const pontoComId = {
      ...pontoSemIndex,
      id: pontoId,
      lat: Number(pontoSemIndex.lat),
      lng: Number(pontoSemIndex.lng),
      criadoEm: pontoSemIndex.criadoEm || new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    };

    if (pontoComId.padrao) {
      pontos = pontos.map(p => ({ ...p, padrao: false }));
    }

    const exists = pontos.some(p => p.id && p.id === pontoId);
    if (exists) {
      pontos = pontos.map(p => p.id === pontoId ? pontoComId : p);
    } else if (editIndex !== undefined && editIndex !== null && editIndex >= 0 && editIndex < pontos.length) {
      pontos[editIndex] = pontoComId;
    } else {
      pontos = [...pontos, pontoComId];
    }

    await setDoc(cRef, {
      ...existing,
      ...dadosBasicosCliente,
      codCliente: docId,
      pontos,
      atualizadoEm: new Date().toISOString()
    }, { merge: true });

    return pontoId;
  },

  importarClientesGeolocEmLote: async (clientesLista) => {
    const chunks = [];
    for (let i = 0; i < clientesLista.length; i += 400) {
      chunks.push(clientesLista.slice(i, i + 400));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      for (const item of chunk) {
        const docId = String(item.codCliente || item.id).trim();
        if (!docId) continue;
        const cRef = doc(db, 'clientes_geoloc', docId);
        batch.set(cRef, {
          codCliente: docId,
          cliente: item.cliente || `Cliente ${docId}`,
          municipio: item.municipio || '',
          bairro: item.bairro || '',
          pontos: Array.isArray(item.pontos) ? item.pontos : [],
          atualizadoEm: new Date().toISOString()
        }, { merge: true });
      }
      await batch.commit();
    }
  },

  removerPontoCliente: async (codCliente, pontoId) => {
    const docId = String(codCliente).trim();
    const cRef = doc(db, 'clientes_geoloc', docId);
    const snap = await getDoc(cRef);
    if (snap.exists()) {
      const data = snap.data();
      const pontos = (data.pontos || []).filter(p => p.id !== pontoId);
      await updateDoc(cRef, {
        pontos,
        atualizadoEm: new Date().toISOString()
      });
    }
  },

  solicitarAjusteGeoloc: async (solicitacao) => {
    const docId = `solic_${Date.now()}_${String(solicitacao.codCliente).replace(/[\/\\]/g, '-')}`;
    const sRef = doc(db, 'solicitacoes_geoloc', docId);
    const payload = {
      ...solicitacao,
      id: docId,
      codCliente: String(solicitacao.codCliente).trim(),
      lat: Number(solicitacao.lat),
      lng: Number(solicitacao.lng),
      status: 'Pendente',
      criadoEm: new Date().toISOString()
    };
    await setDoc(sRef, payload);
    return docId;
  },

  aprovarSolicitacaoGeoloc: async (solicitacaoId, dadosAprovados = {}) => {
    const sRef = doc(db, 'solicitacoes_geoloc', solicitacaoId);
    const snap = await getDoc(sRef);
    if (!snap.exists()) return;

    const solic = snap.data();
    const codCliente = String(solic.codCliente).trim();

    // 1. Salvar no cadastro do cliente
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

    await firestoreService.salvarPontoCliente(codCliente, novoPonto, {
      cliente: solic.clienteNome || '',
      municipio: solic.municipio || '',
      bairro: solic.bairro || ''
    });

    // 2. Marcar solicitação como Aprovada
    await updateDoc(sRef, {
      status: 'Aprovado',
      aprovadoEm: new Date().toISOString()
    });
  },

  recusarSolicitacaoGeoloc: async (solicitacaoId, motivo = '') => {
    const sRef = doc(db, 'solicitacoes_geoloc', solicitacaoId);
    await updateDoc(sRef, {
      status: 'Recusado',
      motivoRecusa: motivo,
      recusadoEm: new Date().toISOString()
    });
  },

  // Grupos / Redes de Clientes
  salvarGrupoCliente: async (grupoData) => {
    const docId = String(grupoData.id || `grupo_${Date.now()}`).trim();
    const gRef = doc(db, 'grupos_clientes', docId);
    const snap = await getDoc(gRef);
    const agora = new Date().toISOString();

    const dados = {
      ...grupoData,
      id: docId,
      nome: (grupoData.nome || '').trim(),
      cor: grupoData.cor || 'emerald',
      descricao: (grupoData.descricao || '').trim(),
      codClientes: Array.isArray(grupoData.codClientes) ? Array.from(new Set(grupoData.codClientes.map(String).map(s => s.trim()).filter(Boolean))) : [],
      atualizadoEm: agora,
      criadoEm: snap.exists() ? (snap.data().criadoEm || agora) : (grupoData.criadoEm || agora)
    };

    await setDoc(gRef, dados, { merge: true });
    return docId;
  },

  removerGrupoCliente: async (grupoId) => {
    const docId = String(grupoId).trim();
    const gRef = doc(db, 'grupos_clientes', docId);
    await deleteDoc(gRef);
  },

  atribuirClientesAoGrupo: async (grupoId, codClientesArray = []) => {
    const docId = String(grupoId).trim();
    const gRef = doc(db, 'grupos_clientes', docId);
    const snap = await getDoc(gRef);
    if (!snap.exists()) return;

    const grupo = snap.data();
    const existing = new Set((grupo.codClientes || []).map(String));
    codClientesArray.forEach(cod => {
      if (cod) existing.add(String(cod).trim());
    });

    await updateDoc(gRef, {
      codClientes: Array.from(existing),
      atualizadoEm: new Date().toISOString()
    });
  },

  removerClienteDoGrupo: async (grupoId, codCliente) => {
    const docId = String(grupoId).trim();
    const gRef = doc(db, 'grupos_clientes', docId);
    const snap = await getDoc(gRef);
    if (!snap.exists()) return;

    const grupo = snap.data();
    const codStr = String(codCliente).trim();
    const novosClientes = (grupo.codClientes || []).map(String).filter(c => c !== codStr);

    await updateDoc(gRef, {
      codClientes: novosClientes,
      atualizadoEm: new Date().toISOString()
    });
  },

  salvarKmRegistro: async (kmData) => {
    const dataStr = kmData.data || 'sem-data';
    const placaStr = (kmData.placa || 'sem-placa').replace(/[\/\\]/g, '-');
    const cargaStr = (kmData.carga || 'sem-carga').replace(/[\/\\]/g, '-');
    const docId = kmData.id || `${dataStr}_${placaStr}_${cargaStr}`;
    const kRef = doc(db, 'km_registros', docId);

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

    await setDoc(kRef, payload, { merge: true });
    return docId;
  },

  salvarCargaFinalizada: async (cargaData) => {
    const docId = `${cargaData.data || 'sem-data'}_${(cargaData.carga || 'sem-carga').replace(/[\/\\]/g, '-')}_${(cargaData.placa || '').replace(/[\/\\]/g, '-')}`;
    const cRef = doc(db, 'cargas_finalizadas', docId);
    await setDoc(cRef, { ...cargaData, id: docId, finalizadoEm: new Date().toISOString() }, { merge: true });
    return docId;
  },

  removerCargaFinalizada: async (id) => {
    const cRef = doc(db, 'cargas_finalizadas', id);
    await deleteDoc(cRef);
  },


  salvarMotorista: async (placa, dados) => {
    const docId = String(placa || dados.placa || dados.id || `mot_${Date.now()}`).trim().toUpperCase();
    const mRef = doc(db, 'motoristas', docId);
    await setDoc(mRef, {
      ...dados,
      placa: docId,
      atualizadoEm: new Date().toISOString()
    }, { merge: true });
    return docId;
  },

  removerMotorista: async (placa) => {
    const docId = String(placa).trim().toUpperCase();
    const mRef = doc(db, 'motoristas', docId);
    await deleteDoc(mRef);
  },

  salvarVeiculo: async (placa, dados) => {
    const docId = String(placa || dados.placa || dados.id).trim().toUpperCase();
    const vRef = doc(db, 'veiculos_cadastro', docId);
    const snap = await getDoc(vRef);
    const agora = new Date().toISOString();
    const payload = {
      ...dados,
      placa: docId,
      atualizadoEm: agora,
      criadoEm: snap.exists() ? (snap.data().criadoEm || agora) : (dados.criadoEm || agora)
    };
    await setDoc(vRef, payload, { merge: true });
    return docId;
  },

  salvarConfigDiarias: async (tabela) => {
    const cRef = doc(db, 'configuracoes', 'tabela_diarias');
    await setDoc(cRef, {
      tabela,
      atualizadoEm: new Date().toISOString()
    }, { merge: true });
  },

  removerVeiculo: async (placa) => {
    const docId = String(placa).trim().toUpperCase();
    const vRef = doc(db, 'veiculos_cadastro', docId);
    await deleteDoc(vRef);
  },

  salvarFuncionarioRJ: async (param1, param2) => {
    let docId;
    let dados;
    if (typeof param1 === 'string') {
      docId = param1.trim();
      dados = param2 || {};
    } else {
      dados = param1 || {};
      docId = String(dados.id || `func_${Date.now()}`).trim();
    }
    const fRef = doc(db, 'funcionarios_rj', docId);
    const agora = new Date().toISOString();
    const payload = {
      ...dados,
      id: docId,
      atualizadoEm: agora
    };
    if (!payload.criadoEm) {
      payload.criadoEm = agora;
    }
    // Sanitização rigorosa: o Firestore lança erro fatal se houver qualquer campo com valor undefined
    Object.keys(payload).forEach(k => {
      if (payload[k] === undefined) delete payload[k];
    });

    await setDoc(fRef, payload, { merge: true });
    return docId;
  },

  removerFuncionarioRJ: async (id) => {
    const docId = String(id).trim();
    const fRef = doc(db, 'funcionarios_rj', docId);
    await deleteDoc(fRef);
  },

  importarFuncionariosRJEmLote: async (lista) => {
    const batch = writeBatch(db);
    const agora = new Date().toISOString();
    lista.forEach(item => {
      const docId = String(item.id || `func_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`).trim();
      const fRef = doc(db, 'funcionarios_rj', docId);
      const payload = {
        ...item,
        id: docId,
        criadoEm: item.criadoEm || agora,
        atualizadoEm: agora
      };
      Object.keys(payload).forEach(k => {
        if (payload[k] === undefined) delete payload[k];
      });
      batch.set(fRef, payload, { merge: true });
    });
    await batch.commit();
  },

  adicionarDespesa: async (despesa) => {
    const newDocRef = doc(despesasRef);
    await setDoc(newDocRef, despesa);
    return newDocRef.id;
  },

  salvarDespesaPorId: async (id, despesa) => {
    const dRef = doc(db, 'despesas', id);
    await setDoc(dRef, despesa, { merge: true });
    return id;
  },

  atualizarDespesa: async (id, dados) => {
    const dRef = doc(db, 'despesas', id);
    await updateDoc(dRef, dados);
  },

  removerDespesa: async (id) => {
    const dRef = doc(db, 'despesas', id);
    await deleteDoc(dRef);
  },

  limparTodasDespesas: async () => {
    const snap = await getDocs(despesasRef);
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 400) {
      const batch = writeBatch(db);
      docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  },

  // Importar Prévia de Cargas (8164 + Programação)
  importarPreviaCargas: async (entregasPrevia, kmEstimados = []) => {
    // 1. Gravar entregas da prévia
    const chunks = [];
    for (let i = 0; i < entregasPrevia.length; i += 400) {
      chunks.push(entregasPrevia.slice(i, i + 400));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach(entrega => {
        const docId = entrega.id || `PREV-${entrega.pedido}-${Date.now()}`;
        const dRef = doc(db, 'entregas', docId);
        batch.set(dRef, {
          ...entrega,
          id: docId,
          isPrevia: true,
          statusFaturamento: 'Previa',
          notaProvisoria: true,
          atualizadoEm: new Date().toISOString()
        }, { merge: true });
      });
      await batch.commit();
    }

    // 2. Gravar KM Estimado / Previsto das cargas da programação
    if (Array.isArray(kmEstimados) && kmEstimados.length > 0) {
      const batchKm = writeBatch(db);
      kmEstimados.forEach(item => {
        const { data, placa, carga, kmPrevisto } = item;
        if (!data || !carga) return;
        const docId = `${data}_${(placa || 'sem-placa').replace(/[\/\\]/g, '-')}_${(carga || 'sem-carga').replace(/[\/\\]/g, '-')}`;
        const kRef = doc(db, 'km_registros', docId);
        batchKm.set(kRef, {
          id: docId,
          data,
          placa: (placa || '').toUpperCase(),
          carga: String(carga).trim(),
          kmPrevisto: Number(kmPrevisto) || 0,
          atualizadoEm: new Date().toISOString()
        }, { merge: true });
      });
      await batchKm.commit();
    }
  },

  // Importar
  importarEntregas: async (novasEntregas, entregasAtuais) => {
    // Firestore batch limit is 500, we need to chunk it
    const chunks = [];
    for (let i = 0; i < novasEntregas.length; i += 400) {
      chunks.push(novasEntregas.slice(i, i + 400));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      
      chunk.forEach(nova => {
        // Tenta encontrar por Nota Fiscal OU por Pedido + Carga (caso tenha sido importado via Prévia 8164)
        const index = entregasAtuais.findIndex(e => {
          if (e.nota && nova.nota && String(e.nota).trim() === String(nova.nota).trim()) return true;
          if (e.pedido && nova.pedido && String(e.pedido).trim() === String(nova.pedido).trim()) {
            if (e.carga && nova.carga && String(e.carga).trim() === String(nova.carga).trim()) return true;
            if (e.isPrevia) return true;
          }
          return false;
        });

        let finalDoc = {};
        let docId = '';
        const novaDataFat = nova.dataFaturamento || nova.data;
        const novaPlacaOrig = nova.placaOriginal || nova.placa;

        if (index >= 0) {
          const e = entregasAtuais[index];
          docId = e.id;
          const dataCustomizada = e.data && e.dataFaturamento && e.data !== e.dataFaturamento;
          const placaCustomizada = e.placa && e.placaOriginal && e.placa !== e.placaOriginal;

          let historicoAtualizado = Array.isArray(e.historico) ? [...e.historico] : [];
          if (e.isPrevia) {
            historicoAtualizado.push({
              status: e.status,
              data: new Date().toISOString(),
              role: 'Sistema',
              observacao: `Faturamento confirmado: NF ${nova.nota} gerada no ERP`
            });
          }

          finalDoc = {
            ...e,
            ...nova,
            id: docId,
            nota: nova.nota,
            isPrevia: false,
            statusFaturamento: 'Faturado',
            notaProvisoria: false,
            data: dataCustomizada ? e.data : (nova.data || e.data),
            dataFaturamento: novaDataFat || e.dataFaturamento || e.data,
            placa: placaCustomizada ? e.placa : (nova.placa || e.placa),
            placaOriginal: novaPlacaOrig || e.placaOriginal || e.placa,
            status: e.status,
            canhoto: e.canhoto || false,
            horaChegada: e.horaChegada || null,
            horaSaida: e.horaSaida || null,
            tempoFormatado: e.tempoFormatado || null,
            historico: historicoAtualizado,
            atualizadoEm: new Date().toISOString()
          };
        } else {
          docId = `${nova.nota}-${Date.now()}`;
          finalDoc = {
            ...nova,
            id: docId,
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
              role: 'Sistema',
              observacao: 'Importação inicial (Faturamento 8132)'
            }],
            atualizadoEm: new Date().toISOString()
          };
        }

        const dRef = doc(db, 'entregas', docId);
        batch.set(dRef, finalDoc, { merge: true });
      });

      await batch.commit();
    }
  },

  // Atualização em Lote de Entregas por Planilha (Rotas & Cargas)
  atualizarEntregasPorPlanilha: async (linhas, opcoes = {}, entregasAtuais = []) => {
    const { cadastrarNovas = true, atualizarPlaca = true, atualizarPesosValores = true } = opcoes;
    const nowIso = new Date().toISOString();

    const chunks = [];
    for (let i = 0; i < linhas.length; i += 400) {
      chunks.push(linhas.slice(i, i + 400));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);

      chunk.forEach(item => {
        if (!item.nota) return;
        const strNota = String(item.nota).trim();
        const existente = entregasAtuais.find(e => String(e.nota || '').trim() === strNota);

        const novoStatus = item.status;
        const isChegada = ['No cliente', 'Descarregando'].includes(novoStatus);
        const isConclusao = ['Entrega total', 'Entrega parcial', 'Devolução total', 'Reentrega', 'Carga parada'].includes(novoStatus);

        if (existente) {
          const docId = existente.id;
          const statusMudou = novoStatus && existente.status !== novoStatus;

          let historicoAtualizado = Array.isArray(existente.historico) ? [...existente.historico] : [];
          if (statusMudou) {
            historicoAtualizado.push({
              status: novoStatus,
              data: nowIso,
              role: 'Sistema',
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
              tempoFormatado = `${tempoMinutos}m`;
            }
          }

          const camposAtualizados = {
            ...existente,
            id: docId,
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

          const dRef = doc(db, 'entregas', docId);
          batch.set(dRef, camposAtualizados, { merge: true });
        } else if (cadastrarNovas) {
          const docId = `${strNota}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          const horaChegada = isChegada ? nowIso : null;
          const horaSaida = isConclusao ? nowIso : null;

          const novoDoc = {
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
              role: 'Sistema',
              observacao: `Importado via planilha de Rotas & Cargas (Status: ${novoStatus || 'Pendente'})`
            }],
            atualizadoEm: nowIso
          };

          const dRef = doc(db, 'entregas', docId);
          batch.set(dRef, novoDoc, { merge: true });
        }
      });

      await batch.commit();
    }
  },

  // Salva uma cópia operacional de reentrega e registra na programação
  salvarReentrega: async (novaEntrega, progObj, devAtualizada) => {
    const batch = writeBatch(db);
    const docRefEntrega = doc(db, 'entregas', novaEntrega.id);
    batch.set(docRefEntrega, novaEntrega, { merge: true });

    if (progObj && progObj.id) {
      const docRefProg = doc(db, 'cargas_programacao', progObj.id);
      batch.set(docRefProg, progObj, { merge: true });
    }

    if (devAtualizada && devAtualizada.id) {
      const docRefDev = doc(db, 'devolucoes', devAtualizada.id);
      batch.set(docRefDev, devAtualizada, { merge: true });
    }

    await batch.commit();
  },

  // Remover por Data (Preserva SEMPRE reentregas agendadas)
  removerEntregasPorData: async (dataStr) => {
    const q = query(entregasRef, where('data', '==', dataStr));
    const snapshot = await getDocs(q);
    
    // NUNCA remover documentos de reentrega (isReentrega: true ou IDs iniciados em REENT-)
    const docsParaExcluir = snapshot.docs.filter(d => {
      const data = d.data();
      return !data.isReentrega && !d.id.startsWith('REENT-');
    });

    const chunks = [];
    for (let i = 0; i < docsParaExcluir.length; i += 400) {
      chunks.push(docsParaExcluir.slice(i, i + 400));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach(d => {
        batch.delete(d.ref);
      });
      await batch.commit();
    }
  },

  // Limpar Todas as Entregas, Devoluções e Cargas (Mantém clientes_geoloc e motoristas)
  limparTodasEntregas: async () => {
    // 1. Entregas
    const snapEntregas = await getDocs(entregasRef);
    for (let i = 0; i < snapEntregas.docs.length; i += 400) {
      const batch = writeBatch(db);
      snapEntregas.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    // 2. Devoluções
    const snapDevolucoes = await getDocs(devolucoesRef);
    for (let i = 0; i < snapDevolucoes.docs.length; i += 400) {
      const batch = writeBatch(db);
      snapDevolucoes.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    // 3. Cargas Finalizadas
    const snapCargas = await getDocs(cargasFinalizadasRef);
    for (let i = 0; i < snapCargas.docs.length; i += 400) {
      const batch = writeBatch(db);
      snapCargas.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    // 4. Registros de KM
    const snapKm = await getDocs(kmRegistrosRef);
    for (let i = 0; i < snapKm.docs.length; i += 400) {
      const batch = writeBatch(db);
      snapKm.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    // 5. Solicitações de Devolução
    const snapSolic = await getDocs(solicitacoesDevolucaoRef);
    for (let i = 0; i < snapSolic.docs.length; i += 400) {
      const batch = writeBatch(db);
      snapSolic.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  },

  // Atualizações e Remoções pontuais de Entregas
  atualizarEntrega: async (id, dados) => {
    const dRef = doc(db, 'entregas', id);
    await updateDoc(dRef, dados);
  },

  removerEntregaPorId: async (id) => {
    const dRef = doc(db, 'entregas', id);
    await deleteDoc(dRef);
  },

  removerEntregasPorCarga: async (carga, dataStr) => {
    let q = query(entregasRef, where('carga', '==', String(carga).trim()));
    if (dataStr) {
      q = query(entregasRef, where('carga', '==', String(carga).trim()), where('data', '==', dataStr));
    }
    const snapshot = await getDocs(q);

    // NUNCA apagar reentregas agendadas ao remover uma carga
    const docsParaExcluir = snapshot.docs.filter(d => {
      const data = d.data();
      return !data.isReentrega && !d.id.startsWith('REENT-');
    });

    const chunks = [];
    for (let i = 0; i < docsParaExcluir.length; i += 400) {
      chunks.push(docsParaExcluir.slice(i, i + 400));
    }
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  },

  atribuirPlacaCarga: async (carga, novaPlaca, dataStr) => {
    const placaNorm = String(novaPlaca).trim().toUpperCase();
    let q = query(entregasRef, where('carga', '==', String(carga).trim()));
    if (dataStr) {
      q = query(entregasRef, where('carga', '==', String(carga).trim()), where('data', '==', dataStr));
    }
    const snapshot = await getDocs(q);
    const chunks = [];
    for (let i = 0; i < snapshot.docs.length; i += 400) {
      chunks.push(snapshot.docs.slice(i, i + 400));
    }
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach(d => {
        batch.update(d.ref, {
          placa: placaNorm,
          placaOriginal: placaNorm,
          atualizadoEm: new Date().toISOString()
        });
      });
      await batch.commit();
    }
  },

  atribuirPlacaEntrega: async (id, novaPlaca) => {
    const placaNorm = String(novaPlaca).trim().toUpperCase();
    const dRef = doc(db, 'entregas', id);
    await updateDoc(dRef, {
      placa: placaNorm,
      placaOriginal: placaNorm,
      atualizadoEm: new Date().toISOString()
    });
  },

  // Solicitações de Devolução
  salvarSolicitacaoDevolucao: async (solicitacao) => {
    const id = solicitacao.id || `solic_dev_${Date.now()}_${solicitacao.nota || ''}`;
    const dRef = doc(db, 'solicitacoes_devolucao', id);
    await setDoc(dRef, { ...solicitacao, id }, { merge: true });
    return id;
  },

  atualizarSolicitacaoDevolucao: async (id, dados) => {
    const dRef = doc(db, 'solicitacoes_devolucao', id);
    await updateDoc(dRef, dados);
  },

  // Devoluções
  adicionarDevolucao: async (devolucao) => {
    const id = `dev-${Date.now()}`;
    const dRef = doc(db, 'devolucoes', id);
    await setDoc(dRef, { ...devolucao, id });
  },

  atualizarDevolucao: async (id, dados) => {
    const dRef = doc(db, 'devolucoes', id);
    await updateDoc(dRef, dados);
  },

  getDevolucao: async (id) => {
    const dRef = doc(db, 'devolucoes', id);
    const snap = await getDoc(dRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() };
    }
    return null;
  },

  removerDevolucao: async (id) => {
    const dRef = doc(db, 'devolucoes', id);
    await deleteDoc(dRef);
  },

  restaurarBackup: async (backupData) => {
    // Restaura entregas
    if (backupData.entregas && Array.isArray(backupData.entregas)) {
      const chunks = [];
      for (let i = 0; i < backupData.entregas.length; i += 400) {
        chunks.push(backupData.entregas.slice(i, i + 400));
      }
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(e => {
          if (e.id) {
            const dRef = doc(db, 'entregas', e.id);
            batch.set(dRef, e, { merge: true });
          }
        });
        await batch.commit();
      }
    }

    // Restaura devoluções
    if (backupData.devolucoes && Array.isArray(backupData.devolucoes)) {
      const chunks = [];
      for (let i = 0; i < backupData.devolucoes.length; i += 400) {
        chunks.push(backupData.devolucoes.slice(i, i + 400));
      }
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(d => {
          if (d.id) {
            const dRef = doc(db, 'devolucoes', d.id);
            batch.set(dRef, d, { merge: true });
          }
        });
        await batch.commit();
      }
    }
  },

  // --- Credenciais da Frota (Exclusivo Monitoramento) ---
  subscribeCredenciaisFrota: (callback) => {
    return createResilientListener(
      credenciaisFrotaRef,
      (snapshot) => snapshot.docs.map(d => ({ placa: d.id, ...d.data() })),
      callback,
      'credenciais_frota'
    );
  },

  // --- Rastreamento GPS da Frota (5 em 5 min em Rota + Trajeto no Mapa) ---
  subscribeRastreamentoFrota: (callback) => {
    return createResilientListener(
      rastreamentoFrotaRef,
      (snapshot) => snapshot.docs.map(d => ({ placa: d.id, ...d.data() })),
      callback,
      'rastreamento_frota'
    );
  },

  subscribeRotasGpsPorDatas: (datasOuDataMinima = [], callback) => {
    let target = rotasGpsRef;

    if (typeof datasOuDataMinima === 'string' && datasOuDataMinima.trim()) {
      target = query(rotasGpsRef, where('data', '>=', datasOuDataMinima.trim()));
    } else if (Array.isArray(datasOuDataMinima)) {
      const datasLimpa = Array.from(new Set(datasOuDataMinima.filter(Boolean))).slice(0, 10);
      if (datasLimpa.length === 1) {
        target = query(rotasGpsRef, where('data', '==', datasLimpa[0]));
      } else if (datasLimpa.length > 1) {
        target = query(rotasGpsRef, where('data', 'in', datasLimpa));
      }
    }

    return createResilientListener(
      target,
      (snapshot) => snapshot.docs.map(d => ({ id: d.id, ...d.data() })),
      callback,
      'rotas_gps'
    );
  },

  registrarPontoGpsRota: async ({ placa, data, carga = '', motoristaNome = '', lat, lng, speedKmh = 0, accuracy = null }) => {
    const placaNorm = String(placa || '').trim().toUpperCase();
    if (!placaNorm || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return;

    const agora = new Date().toISOString();
    const ponto = {
      lat: Number(Number(lat).toFixed(6)),
      lng: Number(Number(lng).toFixed(6)),
      t: agora,
      v: Math.max(0, Math.round(Number(speedKmh) || 0)),
      ...(accuracy !== null && Number.isFinite(Number(accuracy)) ? { acc: Math.round(Number(accuracy)) } : {})
    };

    const dataRef = data || agora.slice(0, 10);
    const liveRef = doc(db, 'rastreamento_frota', placaNorm);
    const rotaId = `${dataRef}_${placaNorm}`;
    const rotaRef = doc(db, 'rotas_gps', rotaId);

    const batch = writeBatch(db);
    batch.set(liveRef, {
      placa: placaNorm,
      data: dataRef,
      ...(carga ? { carga } : {}),
      ...(motoristaNome ? { motoristaNome } : {}),
      lat: ponto.lat,
      lng: ponto.lng,
      speedKmh: ponto.v,
      accuracy: ponto.acc ?? null,
      gpsAtivo: true,
      emRota: true,
      atualizadoEm: agora
    }, { merge: true });

    batch.set(rotaRef, {
      id: rotaId,
      data: dataRef,
      placa: placaNorm,
      ...(carga ? { carga } : {}),
      ...(motoristaNome ? { motoristaNome } : {}),
      gpsAtivo: true,
      ultimoPonto: ponto,
      atualizadoEm: agora,
      pontos: arrayUnion(ponto)
    }, { merge: true });

    await batch.commit();
    return ponto;
  },

  atualizarStatusGpsVeiculo: async ({ placa, data, carga = '', motoristaNome = '', gpsAtivo, emRota }) => {
    const placaNorm = String(placa || '').trim().toUpperCase();
    if (!placaNorm) return;
    const agora = new Date().toISOString();
    const liveRef = doc(db, 'rastreamento_frota', placaNorm);
    await setDoc(liveRef, {
      placa: placaNorm,
      ...(data ? { data } : {}),
      ...(carga ? { carga } : {}),
      ...(motoristaNome ? { motoristaNome } : {}),
      ...(gpsAtivo !== undefined ? { gpsAtivo: Boolean(gpsAtivo) } : {}),
      ...(emRota !== undefined ? { emRota: Boolean(emRota) } : {}),
      atualizadoEm: agora
    }, { merge: true });
  },

  // --- Tokens de Push Notification (Android FCM & Windows Web Push) ---
  salvarTokenFcm: async ({ tokenId, token, uid, role, subRole = null, placa = null, platform = 'web' }) => {
    if (!token || !tokenId) return;
    const tRef = doc(fcmTokensRef, tokenId);
    await setDoc(tRef, {
      token,
      uid: uid || null,
      role: role || null,
      subRole: subRole || null,
      placa: placa ? String(placa).toUpperCase() : null,
      platform,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 180) : '',
      atualizadoEm: new Date().toISOString()
    }, { merge: true });
  },

  removerTokenFcm: async (tokenId) => {
    if (!tokenId) return;
    await deleteDoc(doc(fcmTokensRef, tokenId)).catch(() => {});
  }
};
