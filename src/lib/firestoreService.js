import { db } from './firebase';
import { 
  collection, doc, setDoc, updateDoc, deleteDoc, 
  writeBatch, getDocs, getDoc, query, where, onSnapshot 
} from 'firebase/firestore';

// References
const entregasRef = collection(db, 'entregas');
const devolucoesRef = collection(db, 'devolucoes');

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
