# Me Pague

Aplicativo de controle de gastos em cartão de crédito com foco em:
- fechamento e vencimento por cartão
- lançamento de compras (à vista e parceladas)
- controle por pessoa (dependentes)
- pagamento de fatura com lógica de rotativo
- relatórios mensais
- assinaturas temporárias com lembrete antes do fim do período grátis

Projeto em React Native (Expo) com Firebase Auth + Firestore e suporte Web (PWA).

## Stack atual
- Expo SDK 54
- React 19 + React Native 0.81
- TypeScript (strict)
- Firebase Auth + Firestore
- React Navigation (tabs + stack)
- Expo Notifications

## Fluxo de navegação
- `App.tsx`: decide entre Login e App autenticado
- `src/navigation/AppStack.tsx`: abas principais
  - `Dashboard`
  - `Pessoas` (stack `PeopleList` -> `PersonDetail`)
  - `Cartões`
  - `Relatórios`

## Funcionalidades implementadas

### Dashboard
- Lançamento de despesa com cartão/pessoa/categoria/data
- Parcelamento (gera transações futuras)
- Edição/exclusão de transações com estorno consistente de saldo/limite
- Marcar item como pago
- Pagar fatura por cartão
- Geração de rotativo ao pagar parcialmente
- Cálculo de competência da fatura por `closingDay`:
  - compra após fechamento vai para o mês seguinte
- Snapshot mensal em `invoices`
- Lembretes de vencimento e limite baixo
- Assinaturas temporárias (`trial_subscriptions`) com notificação local antes da cobrança

### Cartões
- CRUD de cartões com:
  - nome
  - limite total/disponível
  - dia de fechamento
  - dia de vencimento
  - final do cartão

### Pessoas
- CRUD de pessoas
- Bloqueio de exclusão se houver transações vinculadas
- Tela de detalhe por pessoa com pendências

### Relatórios
- KPIs do mês (total, compras, rotativo)
- Distribuição por pessoa e categoria
- Exportação CSV
- Exportação PDF (web via print)

### Autenticação
- Login com email/senha
- Cadastro
- Recuperação de senha

## Estrutura de pastas
```txt
src/
  components/
  config/
  contexts/
  navigation/
  screens/
    Auth/
    Cards/
    Dashboard/
    People/
    Reports/
  types/
```

## Coleções Firestore usadas
- `cards`
- `people`
- `transactions`
- `payments`
- `invoices`
- `trial_subscriptions`
- `user_prefs`

## Regras de segurança Firestore (base recomendada)
Publique no Firebase Console > Firestore > Rules:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }
    function ownerReq() { return signedIn() && request.resource.data.userId == request.auth.uid; }
    function ownerRes() { return signedIn() && resource.data.userId == request.auth.uid; }

    match /cards/{id} {
      allow create: if ownerReq();
      allow read, update, delete: if ownerRes();
    }

    match /people/{id} {
      allow create: if ownerReq();
      allow read, update, delete: if ownerRes();
    }

    match /transactions/{id} {
      allow create: if ownerReq();
      allow read, update, delete: if ownerRes();
    }

    match /payments/{id} {
      allow create: if ownerReq();
      allow read, update, delete: if ownerRes();
    }

    match /invoices/{id} {
      allow create: if ownerReq();
      allow read, update, delete: if ownerRes();
    }

    match /trial_subscriptions/{id} {
      allow create: if ownerReq();
      allow read, update, delete: if ownerRes();
    }

    match /user_prefs/{uid} {
      allow read, write: if signedIn() && uid == request.auth.uid;
    }
  }
}
```

## Como rodar localmente

### 1) Instalar dependências
```bash
npm install
```

### 2) Iniciar Expo
```bash
npm start
```

Atalhos no terminal Expo:
- `i`: iOS Simulator
- `a`: Android Emulator
- `w`: Web

### Scripts disponíveis
- `npm start`
- `npm run ios`
- `npm run android`
- `npm run web`
- `npm run build:web`

## iOS (build e distribuição)

Pré-requisito: conta Apple Developer ativa.

### Build com EAS
```bash
npx eas login
npx eas build:configure
npx eas build -p ios --profile production
```

### Envio para TestFlight
```bash
npx eas submit -p ios
```

Configuração atual relevante:
- `app.json`:
  - `ios.bundleIdentifier`: `com.caio.mepague`
- `eas.json`:
  - profile `production` com `autoIncrement: true`

## Web / PWA
- Build estático:
```bash
npm run build:web
```
- `vercel.json` já possui rewrite para SPA:
  - `/(.*) -> /index.html`
- Existe prompt de instalação PWA em `src/components/PWAInstallPrompt.tsx`

## Troubleshooting rápido

### "Missing or insufficient permissions"
Faltam rules para a coleção acessada. Publique as regras acima no Firestore.

### Erro de trigger em notificações
No Expo SDK atual, use trigger em formato:
- `type: Notifications.SchedulableTriggerInputTypes.DATE`
- `date: <Date>`

### Assinatura temporária não salva
Verifique regras de `trial_subscriptions` e se usuário está autenticado.

## Observações de manutenção
- `src/navigation/AppNavigator.tsx`, `src/navigation/AuthStack.tsx`, `src/contexts/DataContext.tsx` e telas em `src/screens/Transactions/` estão vazios e não participam do fluxo atual.
- As chaves Firebase estão em `src/config/firebaseConfig.ts`. Para produção, o ideal é migrar para variáveis de ambiente.
