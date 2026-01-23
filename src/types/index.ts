// src/types/index.ts

// Tipos auxiliares
export type AuthProvider = 'email' | 'google';
export type IncomeType = 'salary' | 'bico' | 'extra' | 'refund';

// 1. O Usuário (Você/O "Banco")
export interface User {
  id: string;
  email: string;
  name?: string;
  authProvider: AuthProvider;
  createdAt: string; 
}

// 2. Cartão de Crédito
export interface Card {
  id: string;
  userId: string;
  name: string;      // Ex: "Nubank Violeta"
  bank: string;      // Ex: "Nubank"
  limit: number;     // Limite total
  closingDay: number; // Dia que fecha a fatura (Melhor dia de compra)
  dueDay: number;     // Dia do vencimento
  createdAt: string;
}

// 3. Pessoa (Quem te deve)
export interface Person {
  id: string;
  userId: string;
  name: string;           // Ex: "Mãe", "João"
  note?: string;
  currentBalance: number; // Otimização: Saldo atualizado (Positivo = te deve)
  createdAt: string;
}

// 4. Transação (Gastos no cartão)
export interface Transaction {
  id: string;
  userId: string;
  personId: string;       // Quem gastou
  cardId: string;         // Qual cartão usou
  amount: number;         // Valor da parcela (ou total se à vista)
  date: string;           // Data da compra (ISO Date)
  
  // Campos calculados para facilitar relatórios
  invoiceMonth: string;   // Ex: "2024-05" (Mês de competência da fatura)
  
  description: string;
  category: string;       // Ex: "Alimentação", "Uber"
  
  // Controle de parcelamento
  isInstallment: boolean;
  installmentCount: number;    // Total de parcelas (ex: 10)
  installmentIndex: number;    // Qual é essa parcela (ex: 1)
  installmentGroupId?: string; // ID único que une todas as 10 parcelas dessa compra
  
  createdAt: string;
}

// 5. Pagamento (Quando alguém te paga)
export interface Payment {
  id: string;
  userId: string;
  personId: string; // Quem pagou
  amount: number;
  date: string;
  note?: string;    // Ex: "Pix referente ao Uber"
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