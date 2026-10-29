import { initializeApp } from "firebase/app";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";

const isCustomDomain = typeof window !== 'undefined' && (
  window.location.hostname === 'logistrackapp.vercel.app' ||
  window.location.hostname === 'logistrack-chi.vercel.app'
);

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCP6Avh-wdDL6KD-WfbYlDLgbZQclhtNEc",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || (isCustomDomain ? "logistrackapp.vercel.app" : "monitoramento-485e2.firebaseapp.com"),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "monitoramento-485e2",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "monitoramento-485e2.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1002971228613",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1002971228613:web:5408cd8b560a4dbb0403ac",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-NKKSXGBMNB"
};

export const app = initializeApp(firebaseConfig);

// Inicializa Firestore com persistência offline e suporte a múltiplas abas
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

// Inicializa Storage e Auth com persistência local de sessão contínua
export const storage = getStorage(app);
export const auth = getAuth(app);

if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('[Auth] Persistência local configurada automaticamente:', err);
  });
}

