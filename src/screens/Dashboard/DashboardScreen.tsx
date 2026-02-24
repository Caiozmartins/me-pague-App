// DashboardScreen.tsx - Versão Integral (corrigida: SafeArea/rodapé/TabBar/FAB)
import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  AppState,
  KeyboardAvoidingView,
  ScrollView,
  StatusBar,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TextInputMask } from 'react-native-masked-text';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  addDoc,
  collection,
  deleteDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  doc,
  getDoc,
  Timestamp,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

import { db, auth } from '../../config/firebaseConfig';
import { AuthContext } from '../../contexts/AuthContext';
import { startOfMonth, endOfMonth, addMonths } from 'date-fns';

const REVOLVING_INTEREST = 0.12;

const CATEGORIES = [
  'Alimentação',
  'Assinaturas',
  'Casa',
  'Cuidado Pessoal',
  'Educação',
  'Lazer',
  'Mercado',
  'Roupa',
  'Trabalho',
  'Transporte',
];

type PickerItem = { label: string; value: string; [key: string]: any };

interface Transaction {
  id: string;
  description: string;
  category: string;
  amount: number;
  cardName: string;
  personName: string;
  personId: string;
  cardId?: string;
  createdAt: any;
  dateString: string;
  installments?: string | null;
  paid?: boolean;
  origin?: 'purchase' | 'revolving';
}

interface TrialSubscription {
  id: string;
  userId: string;
  name: string;
  cardId: string;
  cardName: string;
  endDate: any;
  notifyDaysBefore: number;
  notificationId?: string | null;
  createdAt?: any;
}

/* SmartPicker: Substitui o seletor nativo por um Modal cross-platform. */
function SmartPicker({
  label,
  items,
  selectedValue,
  onValueChange,
  placeholder = 'Selecione...',
  variant = 'input',
  fullWidth = false,
}: {
  label?: string;
  items: PickerItem[];
  selectedValue: string;
  onValueChange: (v: string) => void;
  placeholder?: string;
  variant?: 'input' | 'compact';
  fullWidth?: boolean;
}) {
  const [showModal, setShowModal] = useState(false);
  const isCompact = variant === 'compact';
  const selectedItem = items.find((i) => i.value === selectedValue);
  const displayLabel = selectedItem ? selectedItem.label : placeholder;

  return (
    <View style={[styles.inputGroup, isCompact && { marginBottom: 0, paddingHorizontal: 0 }, fullWidth && { paddingHorizontal: 0 }]}>
      {!!label && <Text style={styles.label}>{label}</Text>}

      <TouchableOpacity
        style={[styles.pickerBox, isCompact ? styles.pickerBoxCompact : styles.pickerBoxInput]}
        onPress={() => setShowModal(true)}
        activeOpacity={0.85}
      >
        <Text style={[styles.pickerText, !selectedItem && { color: '#64748b' }]} numberOfLines={1}>
          {displayLabel}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#94a3b8" />
      </TouchableOpacity>

      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <TouchableOpacity style={styles.iosModalOverlay} activeOpacity={1} onPress={() => setShowModal(false)}>
          <View style={styles.iosModalContent}>
            <View style={styles.iosHeader}>
              <Text style={styles.iosHeaderTitle}>{label || 'Selecionar'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={styles.iosDoneText}>Pronto</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 340 }}>
              {items.map((item) => (
                <TouchableOpacity
                  key={String(item.value)}
                  style={styles.pickerMenuItem}
                  onPress={() => {
                    onValueChange(item.value);
                    setShowModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerMenuItemText,
                      selectedValue === item.value && { color: '#3B82F6', fontWeight: 'bold' },
                    ]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                  {selectedValue === item.value && <Ionicons name="checkmark" size={20} color="#3B82F6" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

export default function DashboardScreen() {
  const { user } = useContext(AuthContext);

  // Estados de UI e Controle
  const [menuVisible, setMenuVisible] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [dueAlerts, setDueAlerts] = useState<string[]>([]);
  const [isValuesVisible, setIsValuesVisible] = useState(true);

  // Estados de Pagamento
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentValue, setPaymentValue] = useState('');
  const [selectedCardForPay, setSelectedCardForPay] = useState<string>('');

  // Estados de Dados do Firestore
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [monthTransactions, setMonthTransactions] = useState<Transaction[]>([]);
  const [myCards, setMyCards] = useState<PickerItem[]>([]);
  const [myPeople, setMyPeople] = useState<PickerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Filtros de Data e Categoria
  const [currentDate, setCurrentDate] = useState(new Date());
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Gestão de Assinaturas Temporárias
  const [trialModalVisible, setTrialModalVisible] = useState(false);
  const [trialSubscriptions, setTrialSubscriptions] = useState<TrialSubscription[]>([]);
  const [trialName, setTrialName] = useState('');
  const [trialCardId, setTrialCardId] = useState('');
  const [trialEndDateText, setTrialEndDateText] = useState('');
  const [trialNotifyDays, setTrialNotifyDays] = useState('1');
  const [isSavingTrial, setIsSavingTrial] = useState(false);

  // Formulário de Despesa (Novo/Editar)
  const [modalVisible, setModalVisible] = useState(false);
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [dateText, setDateText] = useState('');
  const [selectedCard, setSelectedCard] = useState('');
  const [selectedPerson, setSelectedPerson] = useState('');
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentsCount, setInstallmentsCount] = useState('2');
  const [editingId, setEditingId] = useState<string | null>(null);

  const categoryFilterItems: PickerItem[] = [
    { label: 'Todas', value: 'all' },
    ...CATEGORIES.map((c) => ({ label: c, value: c })),
  ];

  const isOwnerPersonId = (personId?: string | null) => Boolean(user?.uid && personId === user.uid);
  const formatMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const getInvoiceMonthKeyFromPurchaseDate = (purchaseDate: Date, closingDayRaw?: number) => {
    const closingDay = Number(closingDayRaw);
    if (!Number.isFinite(closingDay) || closingDay <= 0) return formatMonthKey(purchaseDate);
    const maxDay = new Date(purchaseDate.getFullYear(), purchaseDate.getMonth() + 1, 0).getDate();
    const safeClosingDay = Math.min(Math.max(Math.trunc(closingDay), 1), maxDay);
    const invoiceDate = new Date(purchaseDate);
    if (purchaseDate.getDate() > safeClosingDay) {
      invoiceDate.setMonth(invoiceDate.getMonth() + 1);
    }
    return formatMonthKey(invoiceDate);
  };
  const getCardClosingDay = (cardId?: string) => {
    if (!cardId) return undefined;
    const card = myCards.find((c) => c.value === cardId);
    return Number(card?.day);
  };
  const getNextDateByDay = (day: number, hour = 9) => {
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth();

    const buildDate = (targetYear: number, targetMonth: number) => {
      const maxDay = new Date(targetYear, targetMonth + 1, 0).getDate();
      const targetDay = Math.min(Math.max(day, 1), maxDay);
      return new Date(targetYear, targetMonth, targetDay, hour, 0, 0, 0);
    };

    let candidate = buildDate(year, month);
    if (candidate <= now) {
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
      candidate = buildDate(year, month);
    }
    return candidate;
  };
  const parsePtBrDate = (value: string) => {
    const parts = value.split('/');
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const parsed = new Date(year, month, day);
    if (Number.isNaN(parsed.getTime())) return null;
    if (parsed.getDate() !== day || parsed.getMonth() !== month || parsed.getFullYear() !== year) return null;
    return parsed;
  };
  const toPtBrDate = (value: Date) => value.toLocaleDateString('pt-BR');
  const getTrialReminderDate = (endDate: Date, notifyDaysBefore: number) => {
    const reminder = new Date(endDate);
    reminder.setDate(reminder.getDate() - Math.max(1, notifyDaysBefore));
    reminder.setHours(9, 0, 0, 0);
    return reminder;
  };
  const triggerSuccessHaptic = async () => {
    if (Platform.OS === 'web') return;
    try {
      const hapticsModule = Haptics as any;
      const notificationType = hapticsModule?.NotificationFeedbackType?.Success;
      if (typeof hapticsModule?.notificationAsync === 'function' && notificationType !== undefined) {
        await hapticsModule.notificationAsync(notificationType);
        return;
      }

      const impactStyle = hapticsModule?.ImpactFeedbackStyle?.Light;
      if (typeof hapticsModule?.impactAsync === 'function' && impactStyle !== undefined) {
        await hapticsModule.impactAsync(impactStyle);
      }
    } catch {
      // No-op: alguns builds/simuladores não expõem o módulo nativo de haptics.
    }
  };

  // Listener das Transações (Real-time)
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const start = Timestamp.fromDate(startOfMonth(addMonths(currentDate, -1)));
    const end = Timestamp.fromDate(endOfMonth(currentDate));

    const qTrans = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid),
      where('createdAt', '>=', start),
      where('createdAt', '<=', end),
      orderBy('createdAt', 'desc')
    );

    const unsubTrans = onSnapshot(
      qTrans,
      (snap) => {
        const list = snap.docs.map((d) => {
          const data: any = d.data();
          const dateObj = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
          return {
            id: d.id,
            ...data,
            dateString: dateObj.toLocaleDateString('pt-BR'),
          };
        }) as Transaction[];

        const currentMonthKey = formatMonthKey(currentDate);
        const invoicesMonthList = list.filter((t) => {
          const purchaseDate = t.createdAt?.toDate ? t.createdAt.toDate() : null;
          if (!purchaseDate) return false;
          const closingDay = getCardClosingDay(t.cardId);
          return getInvoiceMonthKeyFromPurchaseDate(purchaseDate, closingDay) === currentMonthKey;
        });

        setMonthTransactions(invoicesMonthList);
        const finalList =
          categoryFilter === 'all' ? invoicesMonthList : invoicesMonthList.filter((t) => t.category === categoryFilter);
        setFilteredTransactions(finalList);
        setLoading(false);
      },
      (error) => {
        console.error('Dashboard transactions snapshot error:', error);
        setLoading(false);
        Alert.alert('Permissão', 'Sem permissão para ler transações. Verifique as regras do Firestore.');
      }
    );

    return () => unsubTrans();
  }, [user, currentDate, categoryFilter, myCards]);

  // Listener de Cartões e Pessoas
  useEffect(() => {
    if (!user) return;

    const unsubCards = onSnapshot(
      query(collection(db, 'cards'), where('userId', '==', user.uid)),
      (snap) => {
        const list: PickerItem[] = snap.docs.map((d) => ({
          label: d.data().name,
          value: d.id,
          day: d.data().closingDay,
          dueDay: d.data().dueDay,
          totalLimit: d.data().totalLimit,
          availableLimit: d.data().availableLimit,
        }));
        setMyCards(list);

        if (list.length > 0 && !selectedCard) setSelectedCard(list[0].value);

        // Alerta de Vencimento (Janela de 3 dias)
        const today = new Date().getDate();
        const alerts: string[] = [];
        list.forEach((card) => {
          const dueDay = Number(card.dueDay ?? card.day);
          if (!Number.isNaN(dueDay) && dueDay > 0) {
            const diff = dueDay - today;
            if (diff >= 0 && diff <= 3) {
              alerts.push(
                diff === 0 ? `O cartão ${card.label} vence HOJE!` : `O cartão ${card.label} vence em ${diff} dias.`
              );
            }
          }
        });

        if (alerts.length > 0) {
          setDueAlerts(alerts);
          setAlertVisible(true);
        }
      },
      (error) => {
        console.error('Dashboard cards snapshot error:', error);
      }
    );

    const unsubPeople = onSnapshot(
      query(collection(db, 'people'), where('userId', '==', user.uid)),
      (snap) => {
        const dbList = snap.docs.map((d) => ({ label: d.data().name, value: d.id }));
        const ownerOption = { label: user.displayName || 'Eu (Titular)', value: user.uid };
        setMyPeople([ownerOption, ...dbList]);
        if (!selectedPerson) setSelectedPerson(ownerOption.value);
      },
      (error) => {
        console.error('Dashboard people snapshot error:', error);
      }
    );

    return () => {
      unsubCards();
      unsubPeople();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const unsubTrials = onSnapshot(
      query(collection(db, 'trial_subscriptions'), where('userId', '==', user.uid)),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }) as TrialSubscription)
          .sort((a, b) => {
            const aMs = a.endDate?.toDate ? a.endDate.toDate().getTime() : 0;
            const bMs = b.endDate?.toDate ? b.endDate.toDate().getTime() : 0;
            return aMs - bMs;
          });
        setTrialSubscriptions(list);
      },
      (error: any) => {
        if (error?.code === 'permission-denied') {
          console.warn('Trial subscriptions snapshot skipped: missing Firestore permission.');
          return;
        }
        console.error('Trial subscriptions snapshot error:', error);
      }
    );

    return () => unsubTrials();
  }, [user]);

  // Fechamento automático: snapshot mensal por cartão
  useEffect(() => {
    if (!user || myCards.length === 0) return;

    const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

    const syncInvoices = async () => {
      try {
        const byCard = new Map<
          string,
          {
            cardName: string;
            totalAmount: number;
            paidAmount: number;
            pendingAmount: number;
            revolvingAmount: number;
            transactionCount: number;
          }
        >();

        myCards.forEach((card) => {
          byCard.set(card.value, {
            cardName: card.label,
            totalAmount: 0,
            paidAmount: 0,
            pendingAmount: 0,
            revolvingAmount: 0,
            transactionCount: 0,
          });
        });

        monthTransactions.forEach((t) => {
          if (!t.cardId) return;
          const summary = byCard.get(t.cardId) || {
            cardName: t.cardName || 'Cartão',
            totalAmount: 0,
            paidAmount: 0,
            pendingAmount: 0,
            revolvingAmount: 0,
            transactionCount: 0,
          };
          const amount = Number(t.amount || 0);
          summary.totalAmount += amount;
          summary.transactionCount += 1;
          if (t.paid) summary.paidAmount += amount;
          else summary.pendingAmount += amount;
          if (t.origin === 'revolving') summary.revolvingAmount += amount;
          byCard.set(t.cardId, summary);
        });

        const batch = writeBatch(db);
        byCard.forEach((summary, cardId) => {
          const card = myCards.find((c) => c.value === cardId);
          const closingDay = Number(card?.day || 1);
          const monthEndDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
          const closeDate = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            Math.min(Math.max(closingDay, 1), monthEndDay),
            23,
            59,
            59,
            999
          );
          const isClosed = new Date() > closeDate;
          const invoiceId = `${user.uid}_${cardId}_${monthKey}`;
          batch.set(
            doc(db, 'invoices', invoiceId),
            {
              userId: user.uid,
              cardId,
              cardName: summary.cardName,
              monthKey,
              totalAmount: parseFloat(summary.totalAmount.toFixed(2)),
              paidAmount: parseFloat(summary.paidAmount.toFixed(2)),
              pendingAmount: parseFloat(summary.pendingAmount.toFixed(2)),
              revolvingAmount: parseFloat(summary.revolvingAmount.toFixed(2)),
              transactionCount: summary.transactionCount,
              isClosed,
              closedAt: isClosed ? Timestamp.fromDate(closeDate) : null,
              updatedAt: Timestamp.now(),
            },
            { merge: true }
          );
        });

        await batch.commit();
      } catch (error: any) {
        if (error?.code === 'permission-denied') {
          console.warn('Invoice snapshot sync skipped: missing Firestore permission for invoices.');
          return;
        }
        console.error('Invoice snapshot sync error:', error);
      }
    };

    syncInvoices();
  }, [user, myCards, monthTransactions, currentDate]);

  // Lembretes inteligentes: vencimento e limite baixo
  useEffect(() => {
    if (!user || Platform.OS === 'web' || myCards.length === 0) return;

    const scheduleReminders = async () => {
      try {
        const existing = await Notifications.getPermissionsAsync();
        let finalStatus = existing.status;
        if (finalStatus !== 'granted') {
          const requested = await Notifications.requestPermissionsAsync();
          finalStatus = requested.status;
        }
        if (finalStatus !== 'granted') return;

        const monthKey = new Date().toISOString().slice(0, 7);
        const signature = myCards
          .map((c) => `${c.value}:${Number(c.dueDay ?? c.day)}:${Number(c.availableLimit || 0)}:${Number(c.totalLimit || 0)}`)
          .join('|');
        const syncKey = `reminders-sync:${user.uid}:${monthKey}`;
        const previousSignature = await AsyncStorage.getItem(syncKey);
        if (previousSignature === signature) return;

        const idsKey = `reminder-ids:${user.uid}`;
        const oldIdsRaw = await AsyncStorage.getItem(idsKey);
        if (oldIdsRaw) {
          const oldIds = JSON.parse(oldIdsRaw) as string[];
          await Promise.all(oldIds.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => null)));
        }

        const nextIds: string[] = [];
        for (const card of myCards) {
          const dueDay = Number(card.dueDay ?? card.day);
          if (Number.isFinite(dueDay) && dueDay > 0) {
            const preDay = dueDay - 3;
            if (preDay > 0) {
              const preDate = getNextDateByDay(preDay, 9);
              const preId = await Notifications.scheduleNotificationAsync({
                content: {
                  title: 'Fatura próxima do vencimento',
                  body: `${card.label}: vence em 3 dias.`,
                },
                trigger: {
                  type: Notifications.SchedulableTriggerInputTypes.DATE,
                  date: preDate,
                },
              });
              nextIds.push(preId);
            }

            const dueDate = getNextDateByDay(dueDay, 9);
            const dueId = await Notifications.scheduleNotificationAsync({
              content: {
                title: 'Fatura vence hoje',
                body: `${card.label}: vencimento da fatura.`,
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: dueDate,
              },
            });
            nextIds.push(dueId);
          }

          const totalLimit = Number(card.totalLimit || 0);
          const availableLimit = Number(card.availableLimit || 0);
          if (totalLimit > 0 && availableLimit / totalLimit <= 0.15) {
            const lowLimitKey = `low-limit:${user.uid}:${card.value}:${monthKey}`;
            const alreadyNotified = await AsyncStorage.getItem(lowLimitKey);
            if (!alreadyNotified) {
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: 'Limite do cartão baixo',
                  body: `${card.label}: limite disponível abaixo de 15%.`,
                },
                trigger: null,
              });
              await AsyncStorage.setItem(lowLimitKey, '1');
            }
          }
        }

        await AsyncStorage.setItem(idsKey, JSON.stringify(nextIds));
        await AsyncStorage.setItem(syncKey, signature);
      } catch (error) {
        console.error('Reminder scheduling error:', error);
      }
    };

    scheduleReminders();
  }, [user, myCards]);

  const changeMonth = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const resetForm = () => {
    setDesc('');
    setCategory(CATEGORIES[0]);
    setAmount('');
    setDateText('');
    setIsInstallment(false);
    setInstallmentsCount('2');
    if (user) setSelectedPerson(user.uid);
    setEditingId(null);
  };

  const openNewModal = () => {
    resetForm();
    setDateText(new Date().toLocaleDateString('pt-BR'));
    setModalVisible(true);
  };

  // Cálculos
  const monthTotal = filteredTransactions.reduce((acc, t) => acc + (t.amount || 0), 0);

  // Handler de Pagamento
  async function handlePayBill(amountPaid: number, cardId: string) {
    if (!cardId) return Alert.alert('Erro', 'Selecione um cartão primeiro.');
    if (isNaN(amountPaid) || amountPaid <= 0) return Alert.alert('Erro', 'Valor inválido.');

    try {
      const cardObj = myCards.find((c) => c.value === cardId);
      if (!cardObj) return;

      const cardTransactions = filteredTransactions
        .filter((t) => t.cardId === cardId && !t.paid)
        .sort((a, b) => {
          const aMs = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          const bMs = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
          return aMs - bMs;
        });
      const totalDue = cardTransactions.reduce((acc, t) => acc + (t.amount || 0), 0);

      if (totalDue === 0) return Alert.alert('Aviso', 'Não há faturas pendentes para este cartão neste mês.');

      await runTransaction(db, async (tx) => {
        const cardRef = doc(db, 'cards', cardId);
        const txRefs = cardTransactions.map((t) => doc(db, 'transactions', t.id));
        const personIds = Array.from(
          new Set(cardTransactions.map((t) => t.personId).filter((pid) => Boolean(pid) && !isOwnerPersonId(pid)))
        );
        const personRefs = personIds.map((id) => doc(db, 'people', id));

        // READS
        const cardSnap = await tx.get(cardRef);
        const txSnaps: any[] = [];
        for (const r of txRefs) txSnaps.push(await tx.get(r));
        const personSnaps: any[] = [];
        for (const r of personRefs) personSnaps.push(await tx.get(r));

        if (!cardSnap.exists()) throw new Error('Cartão não encontrado');

        const effectivePaid = Math.min(Number(amountPaid || 0), totalDue);

        // atualiza limite
        const currentAvailable = Number(cardSnap.data().availableLimit || 0);
        const maxLimit = Number(cardSnap.data().limit ?? cardSnap.data().creditLimit ?? cardSnap.data().totalLimit ?? NaN);
        let newAvailable = currentAvailable + effectivePaid;
        newAvailable = Math.max(0, newAvailable);
        if (!Number.isNaN(maxLimit)) newAvailable = Math.min(newAvailable, maxLimit);
        tx.update(cardRef, { availableLimit: newAvailable });

        const reduceByPerson = new Map<string, number>();
        const interestByPerson = new Map<string, number>();
        const unpaidRolloverByPerson = new Map<string, { principal: number; personName: string }>();
        let remainingToApply = effectivePaid;

        // aplica pagamento de forma progressiva: quita total e, se necessário, parcial da próxima transação
        for (let i = 0; i < txRefs.length; i++) {
          const snap = txSnaps[i];
          const tRef = txRefs[i];
          if (!snap || !snap.exists()) continue;
          const data: any = snap.data();
          if (data.paid) continue;

          const pid = data.personId;
          const personName = data.personName || 'Pessoa';
          const amt = Number(data.amount || 0);
          if (amt <= 0) continue;

          const applied = Math.min(amt, remainingToApply);
          const remainingAmount = parseFloat((amt - applied).toFixed(2));
          remainingToApply = parseFloat((remainingToApply - applied).toFixed(2));

          if (pid && !isOwnerPersonId(pid)) {
            reduceByPerson.set(pid, (reduceByPerson.get(pid) || 0) + applied);
          }

          if (remainingAmount <= 0.000001) {
            tx.update(tRef, { paid: true });
          } else {
            const previous = unpaidRolloverByPerson.get(pid || '');
            unpaidRolloverByPerson.set(pid || '', {
              principal: (previous?.principal || 0) + remainingAmount,
              personName: previous?.personName || personName,
            });
            tx.update(tRef, { paid: true });
          }
        }

        // no pagamento parcial, rola o saldo remanescente para o próximo mês com juros por pessoa
        if (effectivePaid < totalDue) {
          const nextMonthDate = new Date(currentDate);
          nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);

          unpaidRolloverByPerson.forEach((entry, pid) => {
            const principal = parseFloat(entry.principal.toFixed(2));
            if (principal <= 0) return;

            const interest = parseFloat((principal * REVOLVING_INTEREST).toFixed(2));
            interestByPerson.set(pid, (interestByPerson.get(pid) || 0) + interest);

            const newRef = doc(collection(db, 'transactions'));
            tx.set(newRef, {
              userId: user?.uid,
              description: `Rotativo (${cardObj.label})`,
              category: 'Outros',
              amount: parseFloat((principal + interest).toFixed(2)),
              cardId,
              cardName: cardObj.label,
              personId: pid || user?.uid,
              personName: entry.personName,
              createdAt: Timestamp.fromDate(nextMonthDate),
              paid: false,
              origin: 'revolving',
              installments: null,
            });
          });
        }

        // atualiza saldo da pessoa
        for (let i = 0; i < personIds.length; i++) {
          const personId = personIds[i];
          const amountToReduce = reduceByPerson.get(personId) || 0;
          const interestToAdd = interestByPerson.get(personId) || 0;
          if (amountToReduce === 0 && interestToAdd === 0) continue;
          const pSnap = personSnaps[i];
          if (!pSnap || !pSnap.exists()) continue;
          const currentBalance = Number(pSnap.data().currentBalance || 0);
          tx.update(personRefs[i], { currentBalance: currentBalance - amountToReduce + interestToAdd });
        }
      });

      if (amountPaid < totalDue) {
        Alert.alert(
          'Atenção',
          'Pagamento parcial aplicado. O saldo restante foi rolado para o próximo mês com juros rotativos.'
        );
      } else {
        Alert.alert('Sucesso', 'Fatura quitada totalmente!');
      }
    } catch (error: any) {
      console.error('handlePayBill error:', error);
      Alert.alert('Erro', `Falha ao processar pagamento${error?.message ? `: ${error.message}` : ''}`);
    }
  }

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch {
      Alert.alert('Erro', 'Não foi possível sair do app.');
    }
  };

  async function handleTogglePaid(item: Transaction) {
    try {
      await runTransaction(db, async (tx) => {
        const transRef = doc(db, 'transactions', item.id);
        const transSnap = await tx.get(transRef);
        if (!transSnap.exists()) throw new Error('Transação não encontrada');

        const currentPaid = Boolean(transSnap.data().paid);
        const nextPaid = !currentPaid;
        const amountVal = transSnap.data().amount || 0;
        const cardId = transSnap.data().cardId;
        const personId = transSnap.data().personId;

        const cardRef = cardId ? doc(db, 'cards', cardId) : null;
        const personRef = personId && !isOwnerPersonId(personId) ? doc(db, 'people', personId) : null;

        const cardSnap = cardRef ? await tx.get(cardRef) : null;
        const personSnap = personRef ? await tx.get(personRef) : null;

        tx.update(transRef, { paid: nextPaid });

        if (personRef && personSnap && personSnap.exists()) {
          const currentBalance = Number(personSnap.data().currentBalance || 0);
          const newBalance = nextPaid ? currentBalance - Number(amountVal) : currentBalance + Number(amountVal);
          tx.update(personRef, { currentBalance: newBalance });
        }

        if (cardRef && cardSnap && cardSnap.exists()) {
          const currentAvailable = Number(cardSnap.data().availableLimit || 0);
          const maxLimit = Number(cardSnap.data().limit ?? cardSnap.data().creditLimit ?? cardSnap.data().totalLimit ?? NaN);
          let newAvailable = nextPaid ? currentAvailable + Number(amountVal) : currentAvailable - Number(amountVal);
          newAvailable = Math.max(0, newAvailable);
          if (!Number.isNaN(maxLimit)) newAvailable = Math.min(newAvailable, maxLimit);
          tx.update(cardRef, { availableLimit: newAvailable });
        }
      });

      if (!item.paid) {
        await triggerSuccessHaptic();
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Falha ao atualizar status.');
    }
  }

  async function handleDeleteTransaction(id: string) {
    Alert.alert('Excluir', 'Deseja apagar esta despesa? O valor será estornado do cartão e da dívida.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          try {
            await runTransaction(db, async (tx) => {
              const transRef = doc(db, 'transactions', id);
              const transSnap = await tx.get(transRef);
              if (!transSnap.exists()) return;

              const transData: any = transSnap.data();
              const valorEstorno = transData.amount || 0;
              const idDoCartao = transData.cardId;
              const idDaPessoa = transData.personId;
              const wasPaid = Boolean(transData.paid);

              const cardRef = idDoCartao ? doc(db, 'cards', idDoCartao) : null;
              const personRef = idDaPessoa && !isOwnerPersonId(idDaPessoa) ? doc(db, 'people', idDaPessoa) : null;

              const cardSnap = cardRef ? await tx.get(cardRef) : null;
              const personSnap = personRef ? await tx.get(personRef) : null;

              if (cardRef && cardSnap && cardSnap.exists() && !wasPaid) {
                const currentAvailable = Number(cardSnap.data().availableLimit || 0);
                const maxLimit = Number(cardSnap.data().limit ?? cardSnap.data().creditLimit ?? cardSnap.data().totalLimit ?? NaN);
                let newAvailable = currentAvailable + Number(valorEstorno || 0);
                newAvailable = Math.max(0, newAvailable);
                if (!Number.isNaN(maxLimit)) newAvailable = Math.min(newAvailable, maxLimit);
                tx.update(cardRef, { availableLimit: newAvailable });
              }

              if (personRef && personSnap && personSnap.exists() && !wasPaid) {
                const currentBalance = Number(personSnap.data().currentBalance || 0);
                tx.update(personRef, { currentBalance: currentBalance - Number(valorEstorno || 0) });
              }

              tx.delete(transRef);
            });
          } catch (e) {
            console.error(e);
            Alert.alert('Erro', 'Não foi possível estornar.');
          }
        },
      },
    ]);
  }

  function handleEditTransaction(item: Transaction) {
    setEditingId(item.id);
    setDesc(item.description || '');
    setCategory(item.category || CATEGORIES[0]);
    setSelectedPerson(item.personId || (user?.uid ?? ''));
    setSelectedCard(item.cardId || '');
    setAmount(Number(item.amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));

    const d = item.createdAt?.toDate ? item.createdAt.toDate() : new Date();
    setDateText(d.toLocaleDateString('pt-BR'));

    setIsInstallment(false);
    setInstallmentsCount('2');
    setModalVisible(true);
  }

  async function handleAddTransaction() {
    if (!desc || !amount || !selectedCard || !selectedPerson || !dateText) {
      return Alert.alert('Ops', 'Preencha tudo!');
    }

    const cleanAmount = amount.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
    const rawValue = parseFloat(cleanAmount);
    if (Number.isNaN(rawValue) || rawValue <= 0) return Alert.alert('Erro', 'Valor inválido.');

    const parts = dateText.split('/');
    if (parts.length !== 3) return Alert.alert('Erro', 'Data inválida. Use DD/MM/AAAA.');
    const purchaseDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    if (Number.isNaN(purchaseDate.getTime())) return Alert.alert('Erro', 'Data inválida.');

    setIsSaving(true);

    try {
      const cardObj = myCards.find((c) => c.value === selectedCard);
      const personObj = myPeople.find((p) => p.value === selectedPerson);

      // EDIT
      if (editingId) {
        await runTransaction(db, async (tx) => {
          const transRef = doc(db, 'transactions', editingId);
          const oldSnap = await tx.get(transRef);
          if (!oldSnap.exists()) throw new Error('Transação não encontrada');

          const oldAmount = Number(oldSnap.data().amount || 0);
          const oldPaid = Boolean(oldSnap.data().paid);
          const oldCardId = oldSnap.data().cardId ? String(oldSnap.data().cardId) : '';
          const oldPersonId = oldSnap.data().personId ? String(oldSnap.data().personId) : '';
          const diff = rawValue - oldAmount;

          if (!oldPaid) {
            const sameCard = oldCardId === selectedCard;
            const oldCardRef = oldCardId ? doc(db, 'cards', oldCardId) : null;
            const newCardRef = selectedCard ? doc(db, 'cards', selectedCard) : null;
            const oldCardSnap = oldCardRef ? await tx.get(oldCardRef) : null;
            const newCardSnap = newCardRef ? await tx.get(newCardRef) : null;

            const applyCardDelta = (
              cardRef: ReturnType<typeof doc> | null,
              cardSnap: any,
              delta: number
            ) => {
              if (!cardRef || !cardSnap || !cardSnap.exists()) return;
              const currentAvailable = Number(cardSnap.data().availableLimit || 0);
              const maxLimit = Number(
                cardSnap.data().limit ?? cardSnap.data().creditLimit ?? cardSnap.data().totalLimit ?? NaN
              );
              let nextAvailable = currentAvailable + delta;
              nextAvailable = Math.max(0, nextAvailable);
              if (!Number.isNaN(maxLimit)) nextAvailable = Math.min(nextAvailable, maxLimit);
              tx.update(cardRef, { availableLimit: nextAvailable });
            };

            if (sameCard) {
              if (diff > 0) {
                const available = Number(newCardSnap?.data()?.availableLimit || 0);
                if (diff > available) throw new Error('Limite insuficiente para aumentar essa despesa.');
              }
              applyCardDelta(newCardRef, newCardSnap, -diff);
            } else {
              const newCardAvailable = Number(newCardSnap?.data()?.availableLimit || 0);
              if (rawValue > newCardAvailable) throw new Error('Limite insuficiente no novo cartão.');
              applyCardDelta(oldCardRef, oldCardSnap, oldAmount);
              applyCardDelta(newCardRef, newCardSnap, -rawValue);
            }

            const samePerson = oldPersonId === selectedPerson;
            const oldPersonRef = oldPersonId && !isOwnerPersonId(oldPersonId) ? doc(db, 'people', oldPersonId) : null;
            const newPersonRef =
              selectedPerson && !isOwnerPersonId(selectedPerson) ? doc(db, 'people', selectedPerson) : null;
            const oldPersonSnap = oldPersonRef ? await tx.get(oldPersonRef) : null;
            const newPersonSnap = newPersonRef ? await tx.get(newPersonRef) : null;

            const applyPersonDelta = (
              personRef: ReturnType<typeof doc> | null,
              personSnap: any,
              delta: number
            ) => {
              if (!personRef) return;
              if (personSnap && personSnap.exists()) {
                const currentBalance = Number(personSnap.data().currentBalance || 0);
                tx.update(personRef, { currentBalance: currentBalance + delta });
              } else {
                tx.set(personRef, { currentBalance: delta }, { merge: true });
              }
            };

            if (samePerson) {
              applyPersonDelta(newPersonRef, newPersonSnap, diff);
            } else {
              applyPersonDelta(oldPersonRef, oldPersonSnap, -oldAmount);
              applyPersonDelta(newPersonRef, newPersonSnap, rawValue);
            }
          }

          tx.update(transRef, {
            description: desc,
            category,
            amount: rawValue,
            cardId: selectedCard,
            cardName: cardObj?.label || '?',
            personId: selectedPerson,
            personName: personObj?.label || '?',
            createdAt: Timestamp.fromDate(purchaseDate),
          });
        });

        setEditingId(null);
        setModalVisible(false);
        await triggerSuccessHaptic();
        Alert.alert('Sucesso', 'Despesa editada!');
        return;
      }

      // NEW
      const totalInstallments = isInstallment ? parseInt(installmentsCount, 10) : 1;
      const installmentValue = rawValue / totalInstallments;

      await runTransaction(db, async (tx) => {
        const cardRef = selectedCard ? doc(db, 'cards', selectedCard) : null;
        const personRef = selectedPerson && !isOwnerPersonId(selectedPerson) ? doc(db, 'people', selectedPerson) : null;

        const cardSnap = cardRef ? await tx.get(cardRef) : null;
        const personSnap = personRef ? await tx.get(personRef) : null;

        if (cardRef && (!cardSnap || !cardSnap.exists())) throw new Error('Cartão não encontrado');

        const currentAvailable = cardSnap && cardSnap.exists() ? cardSnap.data().availableLimit || 0 : 0;
        const currentPersonBalance = personSnap && personSnap.exists() ? personSnap.data().currentBalance || 0 : 0;

        if (cardRef) {
          if (rawValue > Number(currentAvailable || 0)) {
            throw new Error('Limite insuficiente para essa compra.');
          }
          const maxLimit = Number(cardSnap?.data()?.limit ?? cardSnap?.data()?.creditLimit ?? cardSnap?.data()?.totalLimit ?? NaN);
          let newAvailable = Number(currentAvailable) - Number(rawValue || 0);
          newAvailable = Math.max(0, newAvailable);
          if (!Number.isNaN(maxLimit)) newAvailable = Math.min(newAvailable, maxLimit);
          tx.update(cardRef, { availableLimit: newAvailable });
        }

        if (personRef) {
          if (personSnap && personSnap.exists()) {
            tx.update(personRef, { currentBalance: currentPersonBalance + rawValue });
          } else {
            tx.set(personRef, { currentBalance: currentPersonBalance + rawValue }, { merge: true });
          }
        }

        for (let i = 0; i < totalInstallments; i++) {
          const transactionDate = new Date(purchaseDate);
          transactionDate.setMonth(transactionDate.getMonth() + i);

          const newRef = doc(collection(db, 'transactions'));
          tx.set(newRef, {
            userId: user?.uid,
            description: isInstallment && totalInstallments > 1 ? `${desc} (${i + 1}/${totalInstallments})` : desc,
            category,
            amount: parseFloat(installmentValue.toFixed(2)),
            cardId: selectedCard,
            cardName: cardObj?.label || '?',
            personId: selectedPerson,
            personName: personObj?.label || '?',
            createdAt: Timestamp.fromDate(transactionDate),
            paid: false,
            origin: 'purchase',
            installments: isInstallment && totalInstallments > 1 ? `${i + 1}/${totalInstallments}` : null,
          });
        }
      });

      setModalVisible(false);
      await triggerSuccessHaptic();
      Alert.alert('Sucesso', 'Lançado!');
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Falha ao salvar.');
    } finally {
      setIsSaving(false);
    }
  }

  function resetTrialForm() {
    setTrialName('');
    setTrialCardId(myCards[0]?.value || '');
    setTrialEndDateText(new Date().toLocaleDateString('pt-BR'));
    setTrialNotifyDays('1');
  }

  async function handleSaveTrialSubscription() {
    if (!user) return;
    if (!trialName.trim() || !trialCardId || !trialEndDateText.trim()) {
      return Alert.alert('Erro', 'Preencha nome, cartão e data final.');
    }

    const notifyDaysBefore = parseInt(trialNotifyDays, 10);
    if (!Number.isFinite(notifyDaysBefore) || notifyDaysBefore <= 0) {
      return Alert.alert('Erro', 'Dias antes deve ser maior que zero.');
    }

    const endDate = parsePtBrDate(trialEndDateText.trim());
    if (!endDate) return Alert.alert('Erro', 'Data inválida. Use DD/MM/AAAA.');

    const card = myCards.find((c) => c.value === trialCardId);
    if (!card) return Alert.alert('Erro', 'Cartão inválido.');

    setIsSavingTrial(true);
    try {
      const permissions = await Notifications.getPermissionsAsync();
      let finalStatus = permissions.status;
      if (finalStatus !== 'granted') {
        const requested = await Notifications.requestPermissionsAsync();
        finalStatus = requested.status;
      }

      const reminderDate = getTrialReminderDate(endDate, notifyDaysBefore);
      let notificationId: string | null = null;

      if (finalStatus === 'granted') {
        if (reminderDate > new Date()) {
          notificationId = await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Assinatura grátis acabando',
              body: `${trialName.trim()} será cobrada em ${notifyDaysBefore} dia(s).`,
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: reminderDate,
            },
          });
        } else {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Assinatura grátis acabando',
              body: `${trialName.trim()} pode cobrar hoje. Revise ou cancele.`,
            },
            trigger: null,
          });
        }
      }

      await addDoc(collection(db, 'trial_subscriptions'), {
        userId: user.uid,
        name: trialName.trim(),
        cardId: card.value,
        cardName: card.label,
        endDate: Timestamp.fromDate(new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999)),
        notifyDaysBefore,
        notificationId,
        createdAt: Timestamp.now(),
      });

      setTrialModalVisible(false);
      resetTrialForm();
      Alert.alert('Sucesso', 'Assinatura temporária adicionada.');
    } catch (error: any) {
      if (error?.code === 'permission-denied') {
        console.warn('Save trial subscription skipped: missing Firestore permission.');
        Alert.alert('Permissão', 'Sem permissão para salvar assinatura temporária. Atualize as regras do Firestore.');
        return;
      }
      console.error('Save trial subscription error:', error);
      Alert.alert('Erro', 'Não foi possível salvar a assinatura temporária.');
    } finally {
      setIsSavingTrial(false);
    }
  }

  async function handleDeleteTrialSubscription(item: TrialSubscription) {
    Alert.alert('Excluir', `Remover "${item.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            if (item.notificationId) {
              await Notifications.cancelScheduledNotificationAsync(item.notificationId).catch(() => null);
            }
            await deleteDoc(doc(db, 'trial_subscriptions', item.id));
          } catch (error) {
            console.error('Delete trial subscription error:', error);
            Alert.alert('Erro', 'Não foi possível remover.');
          }
        },
      },
    ]);
  }

  // Immersive Android
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let mounted = true;

    try {
      Immersive?.setImmersive?.(true);
    } catch (e) {
      console.warn('Immersive não disponível:', e);
    }

    const sub = AppState.addEventListener?.('change', (state) => {
      if (state === 'active' && mounted) {
        try {
          Immersive?.setImmersive?.(true);
        } catch {}
      }
    });

    return () => {
      mounted = false;
      try {
        Immersive?.setImmersive?.(false);
      } catch {}
      sub?.remove?.();
    };
  }, []);

  return (
    // ✅ SAFE AREA só TOP/LEFT/RIGHT (sem bottom por causa da TabBar)
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => changeMonth(-1)}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>

          <Text style={styles.monthTitle}>
            {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}
          </Text>

          <TouchableOpacity onPress={() => changeMonth(1)}>
            <Ionicons name="chevron-forward" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.headerControls}>
          <View>
            <Text style={styles.headerLabel}>Fatura Estimada</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={styles.headerValue}>
                {isValuesVisible
                  ? monthTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                  : '••••••••'}
              </Text>
              <TouchableOpacity onPress={() => setIsValuesVisible(!isValuesVisible)}>
                <Ionicons
                  name={isValuesVisible ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color="rgba(255,255,255,0.6)"
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              style={styles.payBillButton}
              onPress={() => {
                const defaultCard = selectedCard || myCards[0]?.value || '';
                setSelectedCardForPay(defaultCard);

                const totalForCard = filteredTransactions
                  .filter((t) => t.cardId === defaultCard && !t.paid)
                  .reduce((acc, t) => acc + (t.amount || 0), 0);

                setPaymentValue(totalForCard.toFixed(2).replace('.', ','));
                setPaymentModalVisible(true);
              }}
            >
              <Text style={styles.payBillText}>PAGAR</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.profileIcon} onPress={() => setMenuVisible(true)}>
              <Ionicons name="person-circle-outline" size={28} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* EXTRATO */}
      <View style={styles.body}>
        <View style={styles.bodyHeader}>
          <Text style={styles.sectionTitle}>Extrato</Text>
          <View style={{ width: 170 }}>
            <SmartPicker
              items={categoryFilterItems}
              selectedValue={categoryFilter}
              onValueChange={(v) => setCategoryFilter(v || 'all')}
              placeholder="Categoria"
              variant="compact"
            />
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color="#3B82F6" />
        ) : (
          <FlatList
            data={filteredTransactions}
            keyExtractor={(item) => item.id}
            // ✅ tira aquele “vazio gigante” no fim
            contentContainerStyle={{ paddingBottom: 24 }}
            // ✅ dá só o espaço necessário pro FAB, sem ficar feio quando tem poucos itens
            ListFooterComponent={<View style={{ height: 90 }} />}
            renderItem={({ item }) => {
              const isPaid = Boolean(item.paid);
              return (
                <View style={[styles.cardItem, isPaid ? styles.cardItemPaid : styles.cardItemPending]}>
                  <View style={[styles.statusBar, isPaid ? styles.statusBarPaid : styles.statusBarPending]} />
                  <View style={styles.iconBox}>
                    <Ionicons name="pricetag" size={18} color="#3B82F6" />
                  </View>

                  <View style={styles.itemInfo}>
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {item.description}
                    </Text>
                    <Text style={styles.itemSubtitle}>
                      {item.dateString} • {item.cardName}
                    </Text>
                  </View>

                  <View style={styles.itemMeta}>
                    <Text style={styles.itemAmount}>
                      {isValuesVisible ? `R$ ${Number(item.amount || 0).toFixed(2)}` : '••••'}
                    </Text>
                    <View style={styles.personBadge}>
                      <Text style={styles.personBadgeText} numberOfLines={1}>
                        {item.personName}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.actionButtons}>
                    <TouchableOpacity onPress={() => handleEditTransaction(item)} style={styles.actionButton}>
                      <Ionicons name="create-outline" size={20} color="#94a3b8" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteTransaction(item.id)} style={styles.actionButton}>
                      <Ionicons name="trash-outline" size={20} color="#EF4444" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleTogglePaid(item)} style={styles.actionButton}>
                      <Ionicons
                        name={item.paid ? 'checkmark-circle' : 'checkmark-circle-outline'}
                        size={22}
                        color={item.paid ? '#00ca39ff' : '#94a3b8'}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        )}
      </View>

      {/* ✅ FAB acima da TabBar */}
      <TouchableOpacity style={styles.fab} onPress={openNewModal}>
        <Ionicons name="add" size={32} color="#FFF" />
      </TouchableOpacity>

      {/* --- MODAIS --- */}

      {/* MODAL PAGAMENTO */}
      <Modal visible={paymentModalVisible} transparent animationType="fade">
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>Pagar Fatura</Text>

            <Text style={styles.label}>Cartão</Text>
            <View style={{ width: '100%', marginBottom: 12 }}>
              <SmartPicker
                items={myCards}
                selectedValue={selectedCardForPay}
                onValueChange={(v: string) => {
                  setSelectedCardForPay(v || '');
                  const totalForCard = filteredTransactions
                    .filter((t) => t.cardId === v && !t.paid)
                    .reduce((acc, t) => acc + (t.amount || 0), 0);
                  setPaymentValue(totalForCard.toFixed(2).replace('.', ','));
                }}
                placeholder="Selecione o cartão"
              />
            </View>

            <Text style={styles.label}>Valor para este cartão:</Text>
            <TextInput
              style={styles.amountInput}
              keyboardType="numeric"
              value={paymentValue}
              onChangeText={setPaymentValue}
              autoFocus
            />

            <TouchableOpacity
              style={styles.saveButton}
              onPress={() => {
                const val = Number(String(paymentValue).replace(/\./g, '').replace(',', '.'));
                if (!selectedCardForPay) return Alert.alert('Erro', 'Selecione um cartão para pagar.');
                handlePayBill(val, selectedCardForPay);
                setPaymentModalVisible(false);
              }}
            >
              <Text style={styles.saveButtonText}>Confirmar Pagamento</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setPaymentModalVisible(false)} style={{ marginTop: 15 }}>
              <Text style={{ color: '#94a3b8' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL ADICIONAR/EDITAR */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setModalVisible(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetKeyboard}>
            <View style={styles.sheetContainer}>
              <View style={styles.sheetHandle} />
              <ScrollView contentContainerStyle={{ paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{editingId ? 'Editar Despesa' : 'Nova Despesa'}</Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <Ionicons name="close-circle" size={34} color="#94a3b8" />
                  </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Descrição</Text>
                  <TextInput
                    style={styles.input}
                    value={desc}
                    onChangeText={setDesc}
                    placeholder="Ex: Jantar"
                    placeholderTextColor="#64748b"
                  />
                </View>

                <View style={styles.row}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={styles.label}>Valor (R$)</Text>
                    <TextInputMask type={'money'} style={styles.input} value={amount} onChangeText={setAmount} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Data</Text>
                    <TextInputMask
                      type={'datetime'}
                      options={{ format: 'DD/MM/YYYY' }}
                      style={styles.input}
                      value={dateText}
                      onChangeText={setDateText}
                    />
                  </View>
                </View>

                {!editingId && (
                  <>
                    <View style={styles.switchContainer}>
                      <Text style={styles.switchLabel}>Parcelado?</Text>
                      <Switch value={isInstallment} onValueChange={setIsInstallment} trackColor={{ false: '#334155', true: '#3B82F6' }} />
                    </View>

                    {isInstallment && (
                      <View style={styles.inputGroup}>
                        <Text style={styles.label}>Nº Parcelas</Text>
                        <TextInput style={styles.input} keyboardType="numeric" value={installmentsCount} onChangeText={setInstallmentsCount} />
                      </View>
                    )}
                  </>
                )}

                <SmartPicker
                  label="Categoria"
                  items={CATEGORIES.map((c) => ({ label: c, value: c }))}
                  selectedValue={category}
                  onValueChange={setCategory}
                />

                <View style={styles.row}>
                  <View style={{ flex: 1, marginRight: 5 }}>
                    <SmartPicker label="Cartão" items={myCards} selectedValue={selectedCard} onValueChange={setSelectedCard} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 5 }}>
                    <SmartPicker label="Quem usou?" items={myPeople} selectedValue={selectedPerson} onValueChange={setSelectedPerson} />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.saveButton, isSaving && { opacity: 0.7 }]}
                  onPress={handleAddTransaction}
                  disabled={isSaving}
                >
                  <Text style={styles.saveButtonText}>{isSaving ? 'SALVANDO...' : editingId ? 'SALVAR' : 'LANÇAR'}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* MODAL ALERTA */}
      <Modal visible={alertVisible} transparent animationType="fade">
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            <Ionicons name="warning" size={40} color="#EF4444" />
            <Text style={styles.alertTitle}>Atenção!</Text>
            {dueAlerts.map((msg, idx) => (
              <Text key={idx} style={styles.alertText}>
                {msg}
              </Text>
            ))}
            <TouchableOpacity style={styles.alertButton} onPress={() => setAlertVisible(false)}>
              <Text style={styles.alertButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL MENU PERFIL */}
      <Modal visible={menuVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuContent}>
            <View style={styles.menuHeader}>
              <Ionicons name="person-circle" size={50} color="#3B82F6" />
              <Text style={styles.menuUserEmail}>{user?.email}</Text>
            </View>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                resetTrialForm();
                setTrialModalVisible(true);
              }}
            >
              <Ionicons name="timer-outline" size={22} color="#FFF" />
              <Text style={styles.menuItemText}>Assinaturas Temporárias</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={22} color="#EF4444" />
              <Text style={[styles.menuItemText, { color: '#EF4444' }]}>Sair do App</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* MODAL ASSINATURAS TEMPORÁRIAS */}
      <Modal visible={trialModalVisible} transparent animationType="fade">
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>Assinaturas Temporárias</Text>

            <View style={{ width: '100%' }}>
              <Text style={styles.label}>Nome do Serviço</Text>
              <TextInput
                style={styles.input}
                value={trialName}
                onChangeText={setTrialName}
                placeholder="Ex: Netflix grátis"
                placeholderTextColor="#64748b"
              />
            </View>

            <View style={{ width: '100%', marginTop: 12 }}>
              <SmartPicker
                label="Cartão"
                items={myCards}
                selectedValue={trialCardId}
                onValueChange={(v) => setTrialCardId(v || '')}
                placeholder="Selecione o cartão"
                fullWidth
              />
            </View>

            <View style={{ width: '100%', marginTop: 12 }}>
              <Text style={styles.label}>Fim do Período Grátis</Text>
              <TextInputMask
                type={'datetime'}
                options={{ format: 'DD/MM/YYYY' }}
                style={styles.input}
                value={trialEndDateText}
                onChangeText={setTrialEndDateText}
              />
            </View>

            <View style={{ width: '100%', marginTop: 12 }}>
              <Text style={styles.label}>Avisar Quantos Dias Antes</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={trialNotifyDays}
                onChangeText={setTrialNotifyDays}
              />
            </View>

            <TouchableOpacity style={[styles.saveButton, isSavingTrial && { opacity: 0.7 }]} onPress={handleSaveTrialSubscription} disabled={isSavingTrial}>
              <Text style={styles.saveButtonText}>{isSavingTrial ? 'SALVANDO...' : 'Adicionar'}</Text>
            </TouchableOpacity>

            <ScrollView style={{ width: '100%', maxHeight: 220, marginTop: 14 }}>
              {trialSubscriptions.length === 0 ? (
                <Text style={styles.alertText}>Nenhuma assinatura temporária cadastrada.</Text>
              ) : (
                trialSubscriptions.map((item) => {
                  const endDate = item.endDate?.toDate ? item.endDate.toDate() : null;
                  return (
                    <View key={item.id} style={styles.trialItem}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.trialTitle}>{item.name}</Text>
                        <Text style={styles.trialSubtitle}>
                          {item.cardName} • fim {endDate ? toPtBrDate(endDate) : '--'}
                        </Text>
                        <Text style={styles.trialSubtitle}>Aviso: {item.notifyDaysBefore} dia(s) antes</Text>
                      </View>
                      <TouchableOpacity onPress={() => handleDeleteTrialSubscription(item)} style={styles.actionButton}>
                        <Ionicons name="trash-outline" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </ScrollView>

            <TouchableOpacity onPress={() => setTrialModalVisible(false)} style={{ marginTop: 15 }}>
              <Text style={{ color: '#94a3b8' }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },

  // ✅ removido paddingTop gigante (SafeArea cuida do topo)
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20, backgroundColor: '#0f172a' },

  monthNav: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  monthTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginHorizontal: 20 },

  headerControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 15 },
  headerLabel: { color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  headerValue: { color: '#FFF', fontSize: 32, fontWeight: 'bold', fontVariant: ['tabular-nums'] },

  profileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },

  payBillButton: { backgroundColor: '#00ff66ff', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 10 },
  payBillText: { color: '#000000ff', fontWeight: 'bold', fontSize: 14 },

  body: { flex: 1, paddingHorizontal: 20, marginTop: 20 },
  bodyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#FFF', textTransform: 'capitalize' },

  cardItem: {
    backgroundColor: '#1e293b',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    position: 'relative',
    overflow: 'hidden',
  },
  cardItemPending: { borderColor: '#334155', backgroundColor: '#1e293b' },
  cardItemPaid: { borderColor: 'rgba(16, 185, 129, 0.28)', backgroundColor: 'rgba(16, 185, 129, 0.035)' },
  statusBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  statusBarPending: { backgroundColor: 'rgba(59, 130, 246, 0.7)' },
  statusBarPaid: { backgroundColor: 'rgba(16, 185, 129, 0.85)' },
  cardItemOverdue: { borderColor: '#EF4444', backgroundColor: 'rgba(239, 68, 68, 0.05)' },

  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  itemInfo: { flex: 1, paddingHorizontal: 12, minWidth: 0 },
  itemTitle: { fontSize: 16, fontWeight: '600', color: '#f1f5f9' },
  itemSubtitle: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  itemMeta: { alignItems: 'flex-end', minWidth: 100, marginRight: 8 },
  itemAmount: { fontSize: 16, fontWeight: '700', color: '#FFF', fontVariant: ['tabular-nums'] },

  personBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.14)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginTop: 6,
    maxWidth: 100,
  },
  personBadgeText: { color: '#93c5fd', fontSize: 10, fontWeight: '700' },

  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: '#334155',
    gap: 6,
  },
  actionButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ✅ sobe o FAB pra não ficar colado na TabBar / safe-area
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
  },

  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheetKeyboard: {
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: '#334155',
    maxHeight: '88%',
    paddingBottom: 16,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 99,
    backgroundColor: '#475569',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFF' },

  inputGroup: { marginBottom: 15, paddingHorizontal: 20 },
  label: { fontSize: 12, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase' },

  input: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFF',
    borderWidth: 1,
    borderColor: '#334155',
  },

  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, paddingHorizontal: 20 },

  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginHorizontal: 20,
  },
  switchLabel: { color: '#FFF', fontSize: 16 },

  saveButton: { backgroundColor: '#3B82F6', borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 10, marginHorizontal: 20 },
  saveButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },

  pickerBox: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerBoxInput: { paddingVertical: 16, paddingHorizontal: 16, minHeight: 56 },
  pickerBoxCompact: { paddingVertical: 10, paddingHorizontal: 12, minHeight: 44 },
  pickerText: { color: '#f1f5f9', fontSize: 16, flex: 1, marginRight: 10 },

  iosModalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  iosModalContent: { backgroundColor: '#1e293b', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40, borderTopWidth: 1, borderColor: '#334155' },
  iosHeader: { padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#334155', backgroundColor: '#0f172a', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  iosHeaderTitle: { color: '#FFF', fontWeight: 'bold' },
  iosDoneText: { color: '#3B82F6', fontSize: 17, fontWeight: 'bold' },

  pickerMenuItem: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#334155', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerMenuItemText: { color: '#FFF', fontSize: 16, flex: 1, marginRight: 10 },

  alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  alertBox: { backgroundColor: '#1e293b', borderRadius: 20, padding: 25, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  alertTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFF', marginBottom: 15 },
  alertText: { fontSize: 16, color: '#cbd5e1', marginBottom: 15, textAlign: 'center' },
  alertButton: { backgroundColor: '#EF4444', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 10, width: '100%', alignItems: 'center' },
  alertButtonText: { color: '#FFF', fontWeight: 'bold' },
  trialItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    marginBottom: 10,
  },
  trialTitle: { color: '#FFF', fontWeight: '700', fontSize: 14, marginBottom: 4 },
  trialSubtitle: { color: '#94a3b8', fontSize: 12 },

  amountInput: { backgroundColor: '#0f172a', color: '#FFF', fontSize: 24, padding: 15, width: '100%', textAlign: 'center', borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#334155' },

  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 80, paddingRight: 20 },
  menuContent: { backgroundColor: '#1e293b', borderRadius: 20, width: 220, padding: 15, borderWidth: 1, borderColor: '#334155' },
  menuHeader: { alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#334155', paddingBottom: 15, marginBottom: 10 },
  menuUserEmail: { color: '#94a3b8', fontSize: 12, marginTop: 5 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#334155' },
  menuItemText: { color: '#FFF', marginLeft: 10, fontSize: 16 },
});

// ✅ carga segura do módulo nativo (não quebra web/ios)
let Immersive: any = null;
try {
  if (Platform.OS === 'android') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Immersive = require('react-native-immersive');
  }
} catch {
  Immersive = null;
}
