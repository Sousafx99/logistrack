import { db } from './firebase';
import { 
  collection, doc, setDoc, updateDoc, deleteDoc, 
  writeBatch, getDocs, getDoc, query, where, onSnapshot 
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

export const firestoreService = {
  // Listeners (usados no useEffect principal para alimentar o Zustand)
  subscribeEntregas: (callback) => {
    return onSnapshot(entregasRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    });
  },

  subscribeDevolucoes: (callback) => {
    return onSnapshot(devolucoesRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    });
  },

  subscribeDespesas: (callback) => {
    return onSnapshot(despesasRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    });
  },

  subscribeMotoristas: (callback) => {
    return onSnapshot(motoristasRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ placa: doc.id, ...doc.data() }));
      callback(data);
    });
  },

  subscribeCargasFinalizadas: (callback) => {
    return onSnapshot(cargasFinalizadasRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    });
  },

  subscribeKmRegistros: (callback) => {
    return onSnapshot(kmRegistrosRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    });
  },

  subscribeClientesGeoloc: (callback) => {
    return onSnapshot(clientesGeolocRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, codCliente: doc.id, ...doc.data() }));
      callback(data);
    });
  },

  subscribeSolicitacoesGeoloc: (callback) => {
    return onSnapshot(solicitacoesGeolocRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    });
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
    
    let pontos = existing.pontos || [];
    const pontoId = ponto.id || `${Date.now()}`;
    const pontoComId = {
      ...ponto,
      id: pontoId,
      lat: Number(ponto.lat),
      lng: Number(ponto.lng),
      criadoEm: ponto.criadoEm || new Date().toISOString()
    };

    const exists = pontos.some(p => p.id === pontoId);
    if (exists) {
      pontos = pontos.map(p => p.id === pontoId ? pontoComId : p);
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
    const mRef = doc(db, 'motoristas', placa);
    await setDoc(mRef, dados, { merge: true });
  },

  adicionarDespesa: async (despesa) => {
    const newDocRef = doc(despesasRef);
    await setDoc(newDocRef, despesa);
    return newDocRef.id;
  },

  atualizarDespesa: async (id, dados) => {
    const dRef = doc(db, 'despesas', id);
    await updateDoc(dRef, dados);
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
        const index = entregasAtuais.findIndex(e => e.nota === nova.nota);
        let finalDoc = {};
        let docId = '';

        if (index >= 0) {
          const e = entregasAtuais[index];
          docId = e.id;
          finalDoc = {
            ...nova,
            status: e.status,
            canhoto: e.canhoto || false
          };
        } else {
          docId = `${nova.nota}-${Date.now()}`;
          finalDoc = {
            ...nova,
            status: 'Pendente',
            canhoto: false,
            historico: [{
              status: 'Pendente',
              data: new Date().toISOString(),
              role: 'Sistema',
              observacao: 'Importação inicial'
            }]
          };
        }

        const dRef = doc(db, 'entregas', docId);
        batch.set(dRef, finalDoc, { merge: true });
      });

      await batch.commit();
    }
  },

  // Remover por Data
  removerEntregasPorData: async (dataStr) => {
    const q = query(entregasRef, where('data', '==', dataStr));
    const snapshot = await getDocs(q);
    
    const chunks = [];
    for (let i = 0; i < snapshot.docs.length; i += 400) {
      chunks.push(snapshot.docs.slice(i, i + 400));
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
  },

  // Atualizações simples de Entregas
  atualizarEntrega: async (id, dados) => {
    const dRef = doc(db, 'entregas', id);
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
  }
};
