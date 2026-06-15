import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCP6Avh-wdDL6KD-WfbYlDLgbZQclhtNEc",
  authDomain: "monitoramento-485e2.firebaseapp.com",
  projectId: "monitoramento-485e2",
  storageBucket: "monitoramento-485e2.firebasestorage.app",
  messagingSenderId: "1002971228613",
  appId: "1:1002971228613:web:5408cd8b560a4dbb0403ac",
  measurementId: "G-NKKSXGBMNB"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
