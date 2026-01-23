// src/config/firebaseConfig.ts

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Suas chaves do Firebase (Copiadas do console)
const firebaseConfig = {
  apiKey: "AIzaSyDwg9lYM8mUETNEKd5-143AgEoJRL9Mcec",
  authDomain: "controle-financeiro-caad3.firebaseapp.com",
  projectId: "controle-financeiro-caad3",
  storageBucket: "controle-financeiro-caad3.firebasestorage.app",
  messagingSenderId: "79699851087",
  appId: "1:79699851087:web:b453a998874c01901ab73a"
};

// 1. Inicializa o App
const app = initializeApp(firebaseConfig);

// 2. Inicializa e exporta a Autenticação
export const auth = getAuth(app);

// 3. Inicializa e exporta o Banco de Dados (Firestore)
export const db = getFirestore(app);