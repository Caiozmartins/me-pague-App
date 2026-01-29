# 💳 Me Pague - Engenharia Financeira & Gestão de Crédito

> **Versão:** 1.0.1 (Web/Mobile)
> **Status:** 🚀 Em Produção (Vercel/Expo)

O **Me Pague** é uma aplicação de engenharia financeira desenhada para resolver a complexidade da partilha de cartões de crédito. O sistema implementa regras de negócio avançadas para **projeção de faturas**, **cálculo de juros rotativos** e **rateio de despesas** entre dependentes, garantindo integridade de dados (ACID).

## ✨ Destaques de Engenharia

### ⚛️ Integridade de Dados (ACID)
Utilização intensiva de `runTransaction` do Firestore para garantir consistência financeira:
- **Atomicidade:** O débito do limite do cartão e a criação da despesa ocorrem numa única transação atómica.
- **Prevenção de Race Conditions:** Uso de `increment` atómico para atualizações de saldo simultâneas.

### 📱 Cross-Platform & Web Support
Arquitetura adaptável que roda tanto como App Nativo quanto como PWA:
- **Expo Router:** Gestão de rotas compatível com URLs da Web e navegação nativa.
- **Platform Detection:** O app desativa módulos nativos (como biometria) automaticamente quando roda no navegador.
- **Safe Area Context:** Adapta-se a Notches e barras de navegação em iOS, Android e Web.

### 🛡️ Segurança
- **Client-Side Validation:** Proteção de rotas via Context API (`AuthContext`).
- **Firebase Auth:** Persistência de sessão segura e gestão de usuários.

## 🚀 Funcionalidades Core

* **Motor de Parcelamento:** Projeta lançamentos futuros respeitando a virada do mês e vencimento.
* **Smart Billing:** Decide automaticamente se a compra entra na fatura atual ou próxima.
* **Gestão de Dependentes:** Calcula individualmente a dívida de cada pessoa na fatura.
* **Modo Dark Premium:** UI otimizada para conforto visual (`#0f172a`).

## 🛠️ Stack Tecnológico

* **Core:** React Native + React Native Web (Expo SDK 50)
* **Linguagem:** TypeScript
* **Backend:** Firebase Firestore & Auth
* **Deploy:** Vercel (Web) / EAS (Mobile)
* **UI:** Stylesheet, Vector Icons, Masked Text

## 📸 Screenshots

<div style="display: flex; flex-direction: row; overflow-x: auto; gap: 15px;">
  <img src="./assets/image.png" alt="Dashboard" width="200" style="border-radius: 10px; border: 1px solid #333;" />
  <img src="./assets/image-1.png" alt="Pessoas" width="200" style="border-radius: 10px; border: 1px solid #333;" />
  <img src="./assets/image-2.png" alt="Cartões" width="200" style="border-radius: 10px; border: 1px solid #333;" />
</div>

## 👷 Como Rodar o Projeto

1. **Clone o repositório:**
   ```bash
   git clone [https://github.com/Caiozmartins/me-pague-App.git](https://github.com/Caiozmartins/me-pague-App.git)

2. **Instale as dependências:**

**Bash**
npm install

3. **Execute (Web ou Mobile):**
Bash
npx expo start

Pressione w para Web ou leia o QR Code com seu celular.

👨‍💻 Autor
Desenvolvido por Caio Martins Estudante de Engenharia de Software - UCB

LinkedIn • GitHub