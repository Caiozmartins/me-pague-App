// DashboardScreen.tsx
import React, { useState, useEffect, useContext } from 'react';
import { signOut } from 'firebase/auth'; 
import { auth } from '../../config/firebaseConfig'; 
const REVOLVING_INTEREST = 0.12; // 12% de juros sobre o que não for pago (Crédito Rotativo)
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
  KeyboardAvoidingView,
  ScrollView,
  StatusBar,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';
import { AuthContext } from '../../contexts/AuthContext';
import { startOfMonth, endOfMonth } from 'date-fns';
import { TextInputMask } from 'react-native-masked-text';

const CATEGORIES = [
  'Roupa',
  'Alimentação',
  'Mercado',
  'Transporte',
  'Lazer',
  'Saúde',
  'Casa',
  'Trabalho',
  'Assinaturas',
  'Educação',
];

type PickerItem = { label: string; value: string };

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
}

const SmartPicker = ({
  label,
  items,
  selectedValue,
  onValueChange,
  placeholder = 'Selecione...',
  variant = 'input', 
}: {
  label?: string;
  items: PickerItem[];
  selectedValue: string;
  onValueChange: (v: string) => void;
  placeholder?: string;
  variant?: 'input' | 'compact';
}) => {
  const [showModal, setShowModal] = useState(false);

  const isCompact = variant === 'compact';
  const selectedItem = items.find((i) => i.value === selectedValue);
  const displayLabel = selectedItem ? selectedItem.label : placeholder;

  const boxStyle = [
    styles.pickerBox,
    isCompact ? styles.pickerBoxCompact : styles.pickerBoxInput,
  ];

  if (Platform.OS === 'android') {
    return (
      <View style={[styles.inputGroup, isCompact && { marginBottom: 0 }]}>
        {!!label && <Text style={styles.label}>{label}</Text>}

        <View style={boxStyle}>
          <Picker
            selectedValue={selectedValue}
            onValueChange={(v) => onValueChange(String(v))}
            style={styles.androidPicker}
            dropdownIconColor="#94a3b8"
            mode="dropdown"
          >
            <Picker.Item label={placeholder} value="" />
            {items.map((item) => (
              <Picker.Item key={item.value} label={item.label} value={item.value} />
            ))}
          </Picker>
        </View>
      </View>
    );
  }

  // iOS
  return (
    <View style={[styles.inputGroup, isCompact && { marginBottom: 0 }]}>
      {!!label && <Text style={styles.label}>{label}</Text>}

      <TouchableOpacity
        style={boxStyle}
        onPress={() => setShowModal(true)}
        activeOpacity={0.85}
      >
        <Text
          style={[
            styles.pickerText,
            !selectedItem && { color: '#64748b' },
            isCompact && { fontSize: 14 },
          ]}
          numberOfLines={1}
        >
          {displayLabel}
        </Text>
        <Ionicons name="chevron-down" size={isCompact ? 16 : 20} color="#94a3b8" />
      </TouchableOpacity>

      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <TouchableOpacity
          style={styles.iosModalOverlay}
          activeOpacity={1}
          onPress={() => setShowModal(false)}
        >
          <View style={styles.iosModalContent}>
            <View style={styles.iosHeader}>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={styles.iosDoneText}>Pronto</Text>
              </TouchableOpacity>
            </View>

            <Picker
              selectedValue={selectedValue}
              onValueChange={(v) => onValueChange(String(v))}
              itemStyle={{ color: '#FFF', fontSize: 18 }}
            >
              <Picker.Item label={placeholder} value="" />
              {items.map((item) => (
                <Picker.Item key={item.value} label={item.label} value={item.value} />
              ))}
            </Picker>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

export default function DashboardScreen() {
  const { user } = useContext(AuthContext);

  // Estados de Controle e UI
  const [menuVisible, setMenuVisible] = useState(false); 
  const [alertVisible, setAlertVisible] = useState(false); // Adicionado
  const [dueAlerts, setDueAlerts] = useState<string[]>([]); // Adicionado

  async function handlePayBill(amountPaid: number, cardId: string) {
    if (!cardId) return Alert.alert("Erro", "Selecione um cartão primeiro.");
    if (isNaN(amountPaid) || amountPaid <= 0) return Alert.alert("Erro", "Valor inválido.");

    try {
      const cardObj = myCards.find(c => c.value === cardId);
      if (!cardObj) return;

      const cardTransactions = filteredTransactions.filter(t => t.cardId === cardId && !t.paid);
      const totalDue = cardTransactions.reduce((acc, t) => acc + (t.amount || 0), 0);

      if (totalDue === 0) return Alert.alert("Aviso", "Não há faturas pendentes para este cartão neste mês.");

      const cardRef = doc(db, "cards", cardId);
      const cardSnap = await getDoc(cardRef);
      if (cardSnap.exists()) {
        const currentAvailable = cardSnap.data().availableLimit || 0;
        await updateDoc(cardRef, { availableLimit: currentAvailable + amountPaid });
      }

      if (amountPaid < totalDue) {
        const remaining = totalDue - amountPaid;
        const interest = remaining * REVOLVING_INTEREST;
        const nextMonthDate = new Date(currentDate);
        nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);

        await addDoc(collection(db, "transactions"), {
          userId: user?.uid,
          description: `Resíduo + Encargos (${cardObj.label})`,
          category: 'Outros',
          amount: parseFloat((remaining + interest).toFixed(2)),
          cardId: cardId,
          cardName: cardObj.label,
          personId: user?.uid, 
          personName: user?.displayName || 'Eu (Titular)',
          createdAt: Timestamp.fromDate(nextMonthDate),
          paid: false
        });
        
        Alert.alert("Atenção", "Fatura paga parcialmente. O saldo restante com juros foi lançado na próxima fatura.");
      } else {
        Alert.alert("Sucesso", "Fatura quitada totalmente!");
      }

      const batchPromises = cardTransactions.map(t => 
        updateDoc(doc(db, "transactions", t.id), { paid: true })
      );
      await Promise.all(batchPromises);

    } catch (error) {
      Alert.alert("Erro", "Falha ao processar pagamento.");
    }
  }

  const handleLogout = async () => {
    try {
      await signOut(auth); 
    } catch (error) {
      Alert.alert("Erro", "Não foi possível sair do app.");
    }
  };

  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [myCards, setMyCards] = useState<any[]>([]);
  const [myPeople, setMyPeople] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [salary, setSalary] = useState(0);
  const [salaryFilter, setSalaryFilter] = useState('all');
  const [salaryModalVisible, setSalaryModalVisible] = useState(false);
  const [tempSalary, setTempSalary] = useState('');

  const [isValuesVisible, setIsValuesVisible] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  const [categoryFilter, setCategoryFilter] = useState('all');

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

  const peopleFilterItems: PickerItem[] = [
    { label: 'Todos (Fatura Total)', value: 'all' },
    ...myPeople,
  ];

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const start = Timestamp.fromDate(startOfMonth(currentDate));
    const end = Timestamp.fromDate(endOfMonth(currentDate));

    const qTrans = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid),
      where('createdAt', '>=', start),
      where('createdAt', '<=', end),
      orderBy('createdAt', 'desc')
    );

    const unsubTrans = onSnapshot(qTrans, (snap) => {
      const list = snap.docs.map((d) => {
        const data: any = d.data();
        const dateObj = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
        return {
          id: d.id,
          ...data,
          dateString: dateObj.toLocaleDateString('pt-BR'),
        };
      }) as Transaction[];

      const finalList =
        categoryFilter === 'all' ? list : list.filter((t) => t.category === categoryFilter);

      setFilteredTransactions(finalList);
      setLoading(false);
    });

    return () => unsubTrans();
  }, [user, currentDate, categoryFilter]);

  useEffect(() => {
    if (!user) return;

    (async () => {
      const docRef = doc(db, 'user_prefs', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) setSalary(docSnap.data().salary || 0);
    })();

    const unsubCards = onSnapshot(
      query(collection(db, 'cards'), where('userId', '==', user.uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({
          label: d.data().name,
          value: d.id,
          day: d.data().closingDay, 
        }));
        setMyCards(list);
        if (list.length > 0 && !selectedCard) setSelectedCard(list[0].value);

        // --- LÓGICA DO ALERTA DE VENCIMENTO ---
        const today = new Date().getDate();
        const alerts: string[] = [];
        list.forEach((card: any) => {
          const dueDay = parseInt(card.day);
          if (!isNaN(dueDay)) {
            const diff = dueDay - today;
            if (diff >= 0 && diff <= 3) {
              alerts.push(diff === 0 ? `O cartão ${card.label} vence HOJE!` : `O cartão ${card.label} vence em ${diff} dias.`);
            }
          }
        });
        if (alerts.length > 0) {
          setDueAlerts(alerts);
          setAlertVisible(true);
        }
      }
    );

    const unsubPeople = onSnapshot(
      query(collection(db, 'people'), where('userId', '==', user.uid)),
      (snap) => {
        const dbList = snap.docs.map((d) => ({ label: d.data().name, value: d.id }));
        const ownerOption = { label: user.displayName || 'Eu (Titular)', value: user.uid };
        setMyPeople([ownerOption, ...dbList]);
        if (!selectedPerson) setSelectedPerson(ownerOption.value);
      }
    );

    return () => {
      unsubCards();
      unsubPeople();
    };
  }, [user]);

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
  
  async function handleTogglePaid(item: Transaction) {
    try {
      const ref = doc(db, 'transactions', item.id);
      const nextPaid = !Boolean(item.paid);
      
      await updateDoc(ref, { paid: nextPaid });

      if (item.personId) {
        const personRef = doc(db, 'people', item.personId);
        const personSnap = await getDoc(personRef);
        if (personSnap.exists()) {
          const currentBalance = personSnap.data().currentBalance || 0;
          const newBalance = nextPaid ? currentBalance - item.amount : currentBalance + item.amount;
          await updateDoc(personRef, { currentBalance: newBalance });
        }
      }
    } catch {
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
            const transRef = doc(db, 'transactions', id);
            const transSnap = await getDoc(transRef);

            if (transSnap.exists()) {
              const transData = transSnap.data();
              const valorEstorno = transData.amount || 0;
              const idDoCartao = transData.cardId; 
              const idDaPessoa = transData.personId;
              const isPaid = transData.paid;

              if (idDoCartao) {
                const cardRef = doc(db, 'cards', idDoCartao);
                const cardSnap = await getDoc(cardRef);
                if (cardSnap.exists()) {
                  const currentAvailable = cardSnap.data().availableLimit || 0;
                  await updateDoc(cardRef, { availableLimit: currentAvailable + valorEstorno });
                }
              }

              if (idDaPessoa && !isPaid) {
                const personRef = doc(db, 'people', idDaPessoa);
                const personSnap = await getDoc(personRef);
                if (personSnap.exists()) {
                  const currentBalance = personSnap.data().currentBalance || 0;
                  await updateDoc(personRef, { currentBalance: currentBalance - valorEstorno });
                }
              }
              
              await deleteDoc(transRef);
            }
          } catch (e) {
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
    setAmount(
      Number(item.amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    );

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

    const cleanAmount = amount
      .replace('R$', '')
      .replace(/\./g, '')
      .replace(',', '.')
      .trim();

    const rawValue = parseFloat(cleanAmount);
    if (Number.isNaN(rawValue) || rawValue <= 0) return Alert.alert('Erro', 'Valor inválido.');

    const parts = dateText.split('/');
    if (parts.length !== 3) return Alert.alert('Erro', 'Data inválida. Use DD/MM/AAAA.');
    const purchaseDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    if (Number.isNaN(purchaseDate.getTime())) return Alert.alert('Erro', 'Data inválida.');

    setIsSaving(true);

    try {
      const cardObj = myCards.find((c) => c.value === selectedCard);
      const personObj = myPeople.find((p) => p.value === selectedPerson);

      if (editingId) {
        const ref = doc(db, 'transactions', editingId);
        
        const oldSnap = await getDoc(ref);
        if (oldSnap.exists()) {
          const oldAmount = oldSnap.data().amount || 0;
          const oldPaid = oldSnap.data().paid || false;
          const diff = rawValue - oldAmount;
          
          if (selectedCard) {
            const cardRef = doc(db, "cards", selectedCard);
            const cardSnap = await getDoc(cardRef);
            if (cardSnap.exists()) {
              const currentAvailable = cardSnap.data().availableLimit || 0;
              await updateDoc(cardRef, { availableLimit: currentAvailable - diff });
            }
          }

          if (selectedPerson && !oldPaid) {
            const personRef = doc(db, "people", selectedPerson);
            const personSnap = await getDoc(personRef);
            if (personSnap.exists()) {
              const currentPersonBalance = personSnap.data().currentBalance || 0;
              await updateDoc(personRef, { currentBalance: currentPersonBalance + diff });
            }
          }
        }

        const cardDueDay = cardObj ? parseInt(cardObj.day) : null;
        const editedDate = new Date(purchaseDate);
        if (cardDueDay && !Number.isNaN(cardDueDay)) editedDate.setDate(cardDueDay);

        await updateDoc(ref, {
          description: desc,
          category,
          amount: rawValue,
          cardName: cardObj?.label || '?',
          personId: selectedPerson,
          personName: personObj?.label || '?',
          createdAt: Timestamp.fromDate(editedDate),
        });

        setEditingId(null);
        setModalVisible(false);
        Alert.alert('Sucesso', 'Despesa editada!');
        return;
      }

      const totalInstallments = isInstallment ? parseInt(installmentsCount) : 1;
      if (Number.isNaN(totalInstallments) || totalInstallments < 1) {
        return Alert.alert('Erro', 'Número de parcelas inválido.');
      }

      const installmentValue = rawValue / totalInstallments;

      let invoiceMonthOffset = 0;
      const cardDueDay = cardObj ? parseInt(cardObj.day) : null;
      if (cardDueDay && !Number.isNaN(cardDueDay)) {
        if (purchaseDate.getDate() >= cardDueDay - 7) invoiceMonthOffset = 1;
      }

      const batchPromises: Promise<any>[] = [];
      for (let i = 0; i < totalInstallments; i++) {
        const transactionDate = new Date(purchaseDate);
        transactionDate.setMonth(transactionDate.getMonth() + i + invoiceMonthOffset);
        if (cardDueDay && !Number.isNaN(cardDueDay)) transactionDate.setDate(cardDueDay);

        batchPromises.push(
          addDoc(collection(db, 'transactions'), {
            userId: user?.uid,
            description:
              isInstallment && totalInstallments > 1 ? `${desc} (${i + 1}/${totalInstallments})` : desc,
            category,
            amount: parseFloat(installmentValue.toFixed(2)),
            cardId: selectedCard, 
            cardName: cardObj?.label || '?',
            personId: selectedPerson,
            personName: personObj?.label || '?',
            createdAt: Timestamp.fromDate(transactionDate),
            paid: false,
            installments: isInstallment && totalInstallments > 1 ? `${i + 1}/${totalInstallments}` : null,
          })
        );
      }

      await Promise.all(batchPromises);

      if (selectedCard) {
        const cardRef = doc(db, "cards", selectedCard);
        const cardSnap = await getDoc(cardRef);
        if (cardSnap.exists()) {
          const currentAvailable = cardSnap.data().availableLimit || 0;
          await updateDoc(cardRef, { availableLimit: currentAvailable - rawValue });
        }
      }

      if (selectedPerson) {
        const personRef = doc(db, "people", selectedPerson);
        const personSnap = await getDoc(personRef);
        if (personSnap.exists()) {
          const currentPersonBalance = personSnap.data().currentBalance || 0;
          await updateDoc(personRef, { currentBalance: currentPersonBalance + rawValue });
        }
      }

      setModalVisible(false);
      Alert.alert('Sucesso', 'Lançado!');
    } catch (e) {
      console.log(e);
      Alert.alert('Erro', 'Falha ao salvar.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveSalary() {
    if (!user) return;
    const val = parseFloat(tempSalary.replace(',', '.'));
    if (isNaN(val)) return Alert.alert('Erro', 'Valor inválido');
    await setDoc(doc(db, 'user_prefs', user.uid), { salary: val }, { merge: true });
    setSalary(val);
    setSalaryModalVisible(false);
  }

  const monthTotal = filteredTransactions.reduce((acc, t) => acc + (t.amount || 0), 0);

  const salarySpent =
    salaryFilter === 'all'
      ? monthTotal
      : filteredTransactions
          .filter((t) => t.personId === salaryFilter)
          .reduce((acc, t) => acc + (t.amount || 0), 0);

  const salaryPercent = salary > 0 ? (salarySpent / salary) * 100 : 0;
  const progressColor = salaryPercent > 90 ? '#EF4444' : salaryPercent > 60 ? '#F59E0B' : '#10B981';
  
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

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

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 15 }}>
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
            {/* NOVO BOTÃO DE PAGAR FATURA */}
            <TouchableOpacity 
              style={styles.payBillButton}
              onPress={() => {
                Alert.prompt(
                  "Pagar Fatura",
                  "Digite o valor que deseja pagar da fatura deste cartão:",
                  [
                    { text: "Cancelar", style: "cancel" },
                    { 
                      text: "Confirmar", 
                      onPress: (val?: string) => handlePayBill(parseFloat(val?.replace(',','.') || "0"), selectedCard)
                    }
                  ],
                  "plain-text",
                  monthTotal.toString()
                );
              }}
            >
              <Text style={styles.payBillText}>PAGAR</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.profileIcon} 
              onPress={() => setMenuVisible(true)} 
            >
              <Ionicons name="person-circle-outline" size={28} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.salaryBox}>
        <View style={styles.salaryHeader}>
          <Text style={styles.salaryTitle}>Comprometimento</Text>
          <View style={{ width: 170 }}>
            <SmartPicker
              items={peopleFilterItems}
              selectedValue={salaryFilter}
              onValueChange={(v) => setSalaryFilter(v || 'all')}
              placeholder="Todos"
              variant="compact"
            />
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5, marginBottom: 5 }}>
          <Text style={styles.salaryValue}>{isValuesVisible ? `R$ ${salarySpent.toFixed(2)}` : '••••'}</Text>
          <Text style={{ color: '#94a3b8', fontSize: 12 }}>
            ({isValuesVisible ? `${salaryPercent.toFixed(1)}%` : '••%'})
          </Text>
        </View>

        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${Math.min(salaryPercent, 100)}%`, backgroundColor: progressColor }]} />
        </View>
      </View>

      <View style={styles.body}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
          <Text style={styles.sectionTitle}>
            Extrato de {currentDate.toLocaleDateString('pt-BR', { month: 'long' })}
          </Text>

          <View style={{ width: 170 }}>
            <SmartPicker
              items={categoryFilterItems}
              selectedValue={categoryFilter}
              onValueChange={(v) => setCategoryFilter(v ? v : 'all')}
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
            contentContainerStyle={{ paddingBottom: 110 }}
            renderItem={({ item }) => {
              const dueDate = item.createdAt?.toDate ? item.createdAt.toDate() : new Date();
              const isPaid = Boolean(item.paid);
              const isOverdue = !isPaid && dueDate < new Date();

              return (
                <View style={[styles.cardItem, isPaid && styles.cardItemPaid, isOverdue && styles.cardItemOverdue]}>
                  <View style={styles.iconBox}>
                    <Ionicons name="pricetag" size={18} color="#3B82F6" />
                  </View>

                  <View style={{ flex: 1, paddingHorizontal: 12 }}>
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {item.description}
                    </Text>
                    <Text style={styles.itemSubtitle}>
                      {item.dateString} • {item.cardName} • {item.category}
                    </Text>
                    {isPaid && <Text style={styles.paidLabel}>PAGA</Text>}
                    {isOverdue && <Text style={styles.overdueLabel}>ATRASADA</Text>}
                  </View>

                  <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
                    <Text style={styles.itemAmount}>
                      {isValuesVisible ? `R$ ${Number(item.amount || 0).toFixed(2)}` : '••••'}
                    </Text>
                    <View style={styles.personBadge}>
                      <Text style={styles.personBadgeText}>{item.personName}</Text>
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
                        color={item.paid ? '#10B981' : '#94a3b8'}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        )}
      </View>

      <TouchableOpacity style={styles.fab} onPress={openNewModal}>
        <Ionicons name="add" size={32} color="#FFF" />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, backgroundColor: '#1e293b' }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? 'Editar Despesa' : 'Nova Despesa'}</Text>
              <TouchableOpacity
                style={{ marginTop: 10 }}
                onPress={() => {
                  setModalVisible(false);
                  setEditingId(null);
                }}
              >
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
                <TextInputMask
                  type={'money'}
                  style={styles.input}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="R$ 0,00"
                  placeholderTextColor="#64748b"
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Data</Text>
                <TextInputMask
                  type={'datetime'}
                  options={{ format: 'DD/MM/YYYY' }}
                  style={styles.input}
                  value={dateText}
                  onChangeText={setDateText}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor="#64748b"
                />
              </View>
            </View>

            {!editingId && (
              <>
                <View style={styles.switchContainer}>
                  <Text style={styles.switchLabel}>Parcelado?</Text>
                  <Switch
                    value={isInstallment}
                    onValueChange={setIsInstallment}
                    trackColor={{ false: '#334155', true: '#3B82F6' }}
                  />
                </View>

                {isInstallment && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Nº Parcelas</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={installmentsCount}
                      onChangeText={setInstallmentsCount}
                      placeholder="Ex: 10"
                      placeholderTextColor="#64748b"
                    />
                  </View>
                )}
              </>
            )}

            <SmartPicker
              label="Categoria"
              items={CATEGORIES.map((c) => ({ label: c, value: c }))}
              selectedValue={category}
              onValueChange={(v) => setCategory(v || CATEGORIES[0])}
              placeholder="Selecione uma categoria"
              variant="input"
            />

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 5 }}>
                <SmartPicker
                  label="Cartão"
                  items={myCards}
                  selectedValue={selectedCard}
                  onValueChange={(v) => setSelectedCard(v)}
                  placeholder="Selecione..."
                  variant="input"
                />
              </View>

              <View style={{ flex: 1, marginLeft: 5 }}>
                <SmartPicker
                  label="Quem usou?"
                  items={myPeople}
                  selectedValue={selectedPerson}
                  onValueChange={(v) => setSelectedPerson(v)}
                  placeholder="Selecione..."
                  variant="input"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveButton, isSaving && { opacity: 0.7 }]}
              onPress={handleAddTransaction}
              disabled={isSaving}
            >
              <Text style={styles.saveButtonText}>
                {isSaving ? 'SALVANDO...' : editingId ? 'SALVAR' : 'LANÇAR'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={salaryModalVisible} transparent animationType="fade">
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>Definir Salário</Text>
            <TextInput
              style={styles.salaryInput}
              keyboardType="numeric"
              value={tempSalary}
              onChangeText={setTempSalary}
              autoFocus
              placeholder="Ex: 3500"
              placeholderTextColor="#64748b"
            />
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveSalary}>
              <Text style={styles.saveButtonText}>Salvar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSalaryModalVisible(false)} style={{ marginTop: 15 }}>
              <Text style={{ color: '#94a3b8' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* NOVO: MODAL DE ALERTA DE VENCIMENTO */}
      <Modal visible={alertVisible} transparent animationType="fade">
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            <Ionicons name="warning" size={40} color="#EF4444" />
            <Text style={styles.alertTitle}>Atenção!</Text>
            {dueAlerts.map((msg, index) => <Text key={index} style={styles.alertText}>{msg}</Text>)}
            <TouchableOpacity style={styles.alertButton} onPress={() => setAlertVisible(false)}>
              <Text style={styles.alertButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL MENU DO PERFIL */}
      <Modal visible={menuVisible} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.menuOverlay} 
          activeOpacity={1} 
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuContent}>
            <View style={styles.menuHeader}>
              <Ionicons name="person-circle" size={50} color="#3B82F6" />
              <Text style={styles.menuUserEmail}>{user?.email}</Text>
            </View>

            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => {
                setMenuVisible(false);
                setTempSalary(String(salary));
                setSalaryModalVisible(true);
              }}
            >
              <Ionicons name="cash-outline" size={22} color="#FFF" />
              <Text style={styles.menuItemText}>Definir Salário</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.menuItem, { borderBottomWidth: 0 }]} 
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={22} color="#EF4444" />
              <Text style={[styles.menuItemText, { color: '#EF4444' }]}>Sair do App</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

    </View> 
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },

  header: { paddingHorizontal: 24, paddingTop: 65, paddingBottom: 20, backgroundColor: '#0f172a' },
  monthNav: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  monthTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginHorizontal: 20 },

  headerLabel: { color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  headerValue: { color: '#FFF', fontSize: 32, fontWeight: 'bold' },
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

  payBillButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  payBillText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },

  salaryBox: { marginHorizontal: 20, padding: 16, backgroundColor: '#1e293b', borderRadius: 16, borderWidth: 1, borderColor: '#334155' },
  salaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  salaryTitle: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  salaryValue: { color: '#FFF', fontWeight: 'bold', fontSize: 18 },
  progressBarBg: { height: 8, backgroundColor: '#0f172a', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },

  body: { flex: 1, paddingHorizontal: 20, marginTop: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#FFF', textTransform: 'capitalize' },

  cardItem: { backgroundColor: '#1e293b', padding: 16, borderRadius: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  cardItemPaid: { borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.05)' },
  cardItemOverdue: { borderColor: '#EF4444', backgroundColor: 'rgba(239, 68, 68, 0.05)' },

  iconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(59, 130, 246, 0.1)', justifyContent: 'center', alignItems: 'center' },
  itemTitle: { fontSize: 16, fontWeight: '600', color: '#f1f5f9' },
  itemSubtitle: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  itemAmount: { fontSize: 16, fontWeight: '700', color: '#FFF' },

  paidLabel: { color: '#10B981', fontSize: 10, fontWeight: 'bold', marginTop: 4 },
  overdueLabel: { color: '#EF4444', fontSize: 10, fontWeight: 'bold', marginTop: 4 },

  personBadge: { backgroundColor: 'rgba(255, 255, 255, 0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
  personBadgeText: { color: '#3B82F6', fontSize: 10, fontWeight: 'bold' },

  actionButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionButton: { padding: 6 },

  fab: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 30,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
  },

  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 20, paddingTop: 16 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFF' },

  inputGroup: { marginBottom: 15, paddingHorizontal: 20 },
  label: { fontSize: 12, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase' },
  input: { backgroundColor: '#0f172a', borderRadius: 12, padding: 16, fontSize: 16, color: '#FFF', borderWidth: 1, borderColor: '#334155' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, paddingHorizontal: 20 },

  switchContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15, backgroundColor: '#0f172a', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#334155', marginHorizontal: 20 },
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
  androidPicker: { color: '#f1f5f9', width: '100%' },

  iosModalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  iosModalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    borderTopWidth: 1,
    borderColor: '#334155',
  },
  iosHeader: {
    padding: 15,
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  iosDoneText: { color: '#3B82F6', fontSize: 17, fontWeight: 'bold' },

  alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  alertBox: { backgroundColor: '#1e293b', borderRadius: 20, padding: 25, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  alertTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFF', marginBottom: 15 },
  alertText: { fontSize: 16, color: '#cbd5e1', marginBottom: 15, textAlign: 'center' }, // Adicionado
  alertButton: { backgroundColor: '#EF4444', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 10, width: '100%', alignItems: 'center' }, // Adicionado
  alertButtonText: { color: '#FFF', fontWeight: 'bold' }, // Adicionado
  salaryInput: { backgroundColor: '#0f172a', color: '#FFF', fontSize: 24, padding: 15, width: '100%', textAlign: 'center', borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#334155' },

  menuOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.7)', 
    justifyContent: 'flex-start', 
    alignItems: 'flex-end', 
    paddingTop: 80, 
    paddingRight: 20 
  },
  menuContent: { 
    backgroundColor: '#1e293b', 
    borderRadius: 20, 
    width: 220, 
    padding: 15, 
    borderWidth: 1, 
    borderColor: '#334155' 
  },
  menuHeader: { 
    alignItems: 'center', 
    borderBottomWidth: 1, 
    borderBottomColor: '#334155', 
    paddingBottom: 15, 
    marginBottom: 10 
  },
  menuUserEmail: { color: '#94a3b8', fontSize: 12, marginTop: 5 },
  menuItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#334155' 
  },
  menuItemText: { color: '#FFF', marginLeft: 10, fontSize: 16 },
});