import { storage } from './firebase';
import { ref, uploadBytes, uploadString, getDownloadURL } from 'firebase/storage';

async function uploadImageToStorage(filename, dataUrlOrFile) {
  const storageRef = ref(storage, filename);
  if (typeof dataUrlOrFile === 'string' && dataUrlOrFile.startsWith('data:')) {
    await uploadString(storageRef, dataUrlOrFile, 'data_url', {
      contentType: 'image/jpeg'
    });
  } else {
    await uploadBytes(storageRef, dataUrlOrFile, {
      contentType: 'image/jpeg'
    });
  }
  return await getDownloadURL(storageRef);
}

export const storageService = {
  uploadCanhoteira: async (dataUrlOrFile, data, carga, placa) => {
    try {
      const sanitizedData = (data || 'sem-data').replace(/[\/\\]/g, '-');
      const sanitizedCarga = (carga || 'sem-carga').replace(/[\/\\]/g, '-');
      const sanitizedPlaca = (placa || 'sem-placa').replace(/[\/\\]/g, '-');
      const filename = `canhoteiras/${sanitizedData}/${sanitizedPlaca}_${sanitizedCarga}_${Date.now()}.jpg`;
      return await uploadImageToStorage(filename, dataUrlOrFile);
    } catch (error) {
      console.warn('Firebase Storage upload failed, falling back to local data:', error);
      if (typeof dataUrlOrFile === 'string') return dataUrlOrFile;
      return '';
    }
  },

  uploadFotoKm: async (dataUrlOrFile, data, placa, tipo = 'inicial') => {
    if (!dataUrlOrFile) return null;
    if (typeof dataUrlOrFile === 'string' && !dataUrlOrFile.startsWith('data:')) {
      return dataUrlOrFile; // Já é URL do Storage
    }
    try {
      const sanitizedData = (data || 'sem-data').replace(/[\/\\]/g, '-');
      const sanitizedPlaca = (placa || 'sem-placa').replace(/[\/\\]/g, '-');
      const filename = `km/${sanitizedData}/${sanitizedPlaca}_${tipo}_${Date.now()}.jpg`;
      return await uploadImageToStorage(filename, dataUrlOrFile);
    } catch (error) {
      console.warn('Erro ao enviar foto de KM para o Storage:', error);
      if (typeof dataUrlOrFile === 'string') return dataUrlOrFile;
      return null;
    }
  },

  uploadComprovanteDespesa: async (dataUrlOrFile, despesaId) => {
    try {
      const filename = `despesas/${despesaId || Date.now()}_${Date.now()}.jpg`;
      return await uploadImageToStorage(filename, dataUrlOrFile);
    } catch (error) {
      console.warn('Erro ao enviar comprovante para o Storage:', error);
      if (typeof dataUrlOrFile === 'string') return dataUrlOrFile;
      return '';
    }
  },

  uploadFotoCanhoto: async (dataUrlOrFile, nota) => {
    try {
      const filename = `canhotos/NF_${nota || Date.now()}_${Date.now()}.jpg`;
      return await uploadImageToStorage(filename, dataUrlOrFile);
    } catch (error) {
      console.warn('Erro ao enviar foto do canhoto para o Storage:', error);
      if (typeof dataUrlOrFile === 'string') return dataUrlOrFile;
      return '';
    }
  }
};
