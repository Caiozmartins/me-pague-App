// src/types/index.ts

// Tipos auxiliares
export type AuthProvider = 'email' | 'google';
export type IncomeType = 'salary' | 'bico' | 'extra' | 'refund';

// 1. O Usuário
export interface User {
  id: string;
  email: string;
  name?: string;
  authProvider: AuthProvider;
  createdAt: string; 
}

// 2. Cartão de Crédito (AJUSTADO)
export interface Card {
  id: string;
  userId: string;
  name: string;
  bank?: string;
  totalLimit: number;     // Limite total aprovado
  availableLimit: number; // Limite que sobra após as compras
  closingDay: number;
  dueDay?: number;
  last4: string;
  createdAt: string;
}

// 3. Pessoa (Quem te deve)
export interface Person {
  id: string;
  userId: string;
  name: string;           // Ex: "Mãe", "João"
  note?: string;
  currentBalance: number; // Saldo atualizado (Positivo = te deve)
  createdAt: string;
}

// 4. Transação (Gastos no cartão)
export interface Transaction {
  id: string;
  userId: string;
  personId: string;       // Quem gastou
  cardId: string;         // Qual cartão usou
  cardName: string;       // Nome do cartão para exibição rápida
  personName: string;     // Nome da pessoa para exibição rápida
  amount: number;         // Valor da parcela (ou total se à vista)
  dateString: string;     // Data formatada para exibição
  
  invoiceMonth: string;   // Ex: "2024-05"
  
  description: string;
  category: string;       
  
  isInstallment: boolean;
  installmentCount: number;    
  installmentIndex: number;    
  installmentGroupId?: string; 
  
  paid: boolean;          // Controle de pagamento
  createdAt: any;         // Timestamp do Firebase
}

// 5. Pagamento (Quando alguém te paga)
export interface Payment {
  id: string;
  userId: string;
  personId: string; 
  amount: number;
  date: string;
  note?: string;    
  createdAt: string;
}

// 6. Renda (Seu dinheiro pessoal)
export interface Income {
  id: string;
  userId: string;
  amount: number;
  date: string;
  type: IncomeType;
  description: string;
  createdAt: string;
}