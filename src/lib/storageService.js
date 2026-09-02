import { storage } from './firebase';
import { ref, uploadBytes, uploadString, getDownloadURL } from 'firebase/storage';

export const storageService = {
  /**
   * Faz upload da foto da canhoteira física finalizada pelo motorista
   * @param {string|Blob|File} dataUrlOrFile - DataURL base64 ou File/Blob da foto
   * @param {string} data - Data da rota (YYYY-MM-DD)
   * @param {string} carga - Identificador da carga
   * @param {string} placa - Placa do veículo
   * @returns {Promise<string>} URL de download da imagem no Firebase Storage ou dataUrl original em fallback
   */
  uploadCanhoteira: async (dataUrlOrFile, data, carga, placa) => {
    try {
      const sanitizedData = (data || 'sem-data').replace(/[\/\\]/g, '-');
      const sanitizedCarga = (carga || 'sem-carga').replace(/[\/\\]/g, '-');
      const sanitizedPlaca = (placa || 'sem-placa').replace(/[\/\\]/g, '-');
      const filename = `canhoteiras/${sanitizedData}/${sanitizedPlaca}_${sanitizedCarga}_${Date.now()}.jpg`;
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

      const downloadUrl = await getDownloadURL(storageRef);
      return downloadUrl;
    } catch (error) {
      console.warn('Firebase Storage upload failed, falling back to local data:', error);
      // Retorna a string original se falhar o upload (resiliência offline)
      if (typeof dataUrlOrFile === 'string') return dataUrlOrFile;
      return '';
    }
  },

  /**
   * Upload de comprovante de despesa / reembolso
   */
  uploadComprovanteDespesa: async (dataUrlOrFile, despesaId) => {
    try {
      const filename = `despesas/${despesaId || Date.now()}_${Date.now()}.jpg`;
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
    } catch (error) {
      console.warn('Erro ao enviar comprovante para o Storage:', error);
      if (typeof dataUrlOrFile === 'string') return dataUrlOrFile;
      return '';
    }
  },

  /**
   * Upload de foto individual de canhoto de NF
   */
  uploadFotoCanhoto: async (dataUrlOrFile, nota) => {
    try {
      const filename = `canhotos/NF_${nota || Date.now()}_${Date.now()}.jpg`;
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
    } catch (error) {
      console.warn('Erro ao enviar foto do canhoto para o Storage:', error);
      if (typeof dataUrlOrFile === 'string') return dataUrlOrFile;
      return '';
    }
  }
};
