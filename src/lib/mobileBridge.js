import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { App as CapApp } from '@capacitor/app';

/**
 * Exporta planilha XLSX funcionando tanto no navegador quanto no APK Android (via Share/Save nativo)
 */
export async function exportWorkbookMobileOrWeb(workbook, filename = 'relatorio.xlsx') {
  const XLSX = await import('xlsx');
  const safeName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;

  if (Capacitor.isNativePlatform()) {
    try {
      const base64Data = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
      const saved = await Filesystem.writeFile({
        path: safeName,
        data: base64Data,
        directory: Directory.Cache
      });
      await Share.share({
        title: safeName,
        text: `Arquivo gerado pelo LogisTrack: ${safeName}`,
        url: saved.uri,
        dialogTitle: 'Salvar ou Compartilhar Planilha'
      });
      return true;
    } catch (err) {
      console.error('[mobileBridge] Falha ao exportar XLSX nativo:', err);
    }
  }

  XLSX.writeFile(workbook, safeName);
  return true;
}

/**
 * Exporta texto/CSV/JSON funcionando tanto no navegador quanto no APK Android
 */
export async function exportTextFileMobileOrWeb(content, filename, mimeType = 'text/csv;charset=utf-8;') {
  if (Capacitor.isNativePlatform()) {
    try {
      const utf8Bytes = new TextEncoder().encode(content);
      let binary = '';
      for (let i = 0; i < utf8Bytes.length; i++) {
        binary += String.fromCharCode(utf8Bytes[i]);
      }
      const base64Data = btoa(binary);
      const saved = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache
      });
      await Share.share({
        title: filename,
        url: saved.uri,
        dialogTitle: 'Salvar ou Compartilhar Arquivo'
      });
      return true;
    } catch (err) {
      console.error('[mobileBridge] Falha ao exportar arquivo nativo:', err);
    }
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}

/**
 * Exporta imagem DataURL (ex: comprovante de reembolso PNG) no APK Android ou Web
 */
export async function exportImageDataUrlMobileOrWeb(dataUrl, filename = 'comprovante.png') {
  if (Capacitor.isNativePlatform()) {
    try {
      const base64Only = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      const saved = await Filesystem.writeFile({
        path: filename,
        data: base64Only,
        directory: Directory.Cache
      });
      await Share.share({
        title: filename,
        url: saved.uri,
        dialogTitle: 'Compartilhar Comprovante'
      });
      return true;
    } catch (err) {
      console.error('[mobileBridge] Falha ao compartilhar imagem nativa:', err);
    }
  }

  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return true;
}

// Pilha global de handlers para o botão físico "Voltar" do Android
const backHandlers = [];
let listenerInitialized = false;

export function initNativeBackButton(onNavigateRootBack) {
  if (!Capacitor.isNativePlatform() || listenerInitialized) return;
  listenerInitialized = true;

  CapApp.addListener('backButton', ({ canGoBack }) => {
    // 1. Se houver algum modal registrado no topo da pilha, fecha apenas o modal
    while (backHandlers.length > 0) {
      const topHandler = backHandlers[backHandlers.length - 1];
      if (typeof topHandler === 'function') {
        const handled = topHandler();
        if (handled !== false) return;
      }
      backHandlers.pop();
    }

    // 2. Se houver callback customizado de rota
    if (typeof onNavigateRootBack === 'function') {
      const handled = onNavigateRootBack(canGoBack);
      if (handled) return;
    }

    // 3. Volta no histórico ou minimiza o app sem matar o processo em segundo plano
    if (canGoBack && window.history.length > 1) {
      window.history.back();
    } else {
      CapApp.minimizeApp().catch(() => {});
    }
  });
}

export function pushBackHandler(fn) {
  backHandlers.push(fn);
  return () => {
    const idx = backHandlers.lastIndexOf(fn);
    if (idx >= 0) backHandlers.splice(idx, 1);
  };
}
