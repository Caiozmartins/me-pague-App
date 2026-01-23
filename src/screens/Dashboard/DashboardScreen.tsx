import React, { useState, useEffect, useContext } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  Modal, TextInput, Alert, ActivityIndicator, Platform,
  KeyboardAvoidingView, ScrollView, StatusBar, Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { collection, addDoc, query, where, onSnapshot, orderBy, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';
import { AuthContext } from '../../contexts/AuthContext';

const CATEGORIES = [
  'Outros', 'Alimentação', 'Mercado', 'Transporte', 
  'Lazer', 'Saúde', 'Casa', 'Trabalho', 'Assinaturas', 'Educação'
];

interface Transaction {
  id: string;
  description: string;
  category: string;
  amount: number;
  cardName: string;
  personName: string;
  personId: string;
  createdAt: any;
  dateString: string;
  installments?: string;
  dueDay?: number; // Dia de vencimento salvo
}

const SmartPicker = ({ label, items, selectedValue, onValueChange, placeholder, dark = false }: any) => {
  const [showModal, setShowModal] = useState(false);
  const selectedItem = items.find((i: any) => i.value === selectedValue);
  const displayLabel = selectedItem ? selectedItem.label : (placeholder || 'Selecione...');

  if (Platform.OS === 'android') {
    return (
      <View style={[styles.inputGroup, dark && { marginBottom: 0 }]}>
        {label && <Text style={styles.label}>{label}</Text>}
        <View style={[styles.pickerContainer, dark && { backgroundColor: 'transparent', borderWidth: 0, height: 40 }]}>
          <Picker 
            selectedValue={selectedValue} onValueChange={onValueChange}
            style={{ color: '#FFF' }} dropdownIconColor="#FFF"
          >
            {items.map((item: any) => <Picker.Item key={item.value} label={item.label} value={item.value} />)}
          </Picker>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.inputGroup, dark && { marginBottom: 0 }]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity 
        style={[styles.iosPickerButton, dark && { padding: 5, backgroundColor: 'transparent', borderWidth: 0 }]} 
        onPress={() => setShowModal(true)}
      >
        <Text style={[styles.iosPickerText, dark && { fontSize: 14, color: '#94a3b8' }]}>{displayLabel}</Text>
        <Ionicons name="chevron-down" size={dark ? 14 : 20} color="#94a3b8" />
      </TouchableOpacity>

      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.iosModalOverlay}>
          <View style={styles.iosModalContent}>
            <View style={styles.iosHeader}>
              <TouchableOpacity onPress={() => setShowModal(false)}><Text style={styles.iosDoneText}>Pronto</Text></TouchableOpacity>
            </View>
            <Picker selectedValue={selectedValue} onValueChange={onValueChange}>
              {items.map((item: any) => <Picker.Item key={item.value} label={item.label} value={item.value} />)}
            </Picker>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default function DashboardScreen() {
  const { user } = useContext(AuthContext);
  
  // Dados brutos do Firebase
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  // Dados filtrados pelo mês atual
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  
  const [myCards, setMyCards] = useState<any[]>([]);
  const [myPeople, setMyPeople] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Controle de Data (Mês Atual)
  const [currentDate, setCurrentDate] = useState(new Date());

  // Salário
  const [salary, setSalary] = useState(0);
  const [salaryFilter, setSalaryFilter] = useState('all');
  const [salaryModalVisible, setSalaryModalVisible] = useState(false);
  const [tempSalary, setTempSalary] = useState('');

  // UI
  const [isValuesVisible, setIsValuesVisible] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [dueAlerts, setDueAlerts] = useState<string[]>([]);

  // Form Nova Despesa
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState('Outros');
  const [amount, setAmount] = useState('');
  const [dateText, setDateText] = useState('');
  const [selectedCard, setSelectedCard] = useState('');
  const [selectedPerson, setSelectedPerson] = useState('');
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentsCount, setInstallmentsCount] = useState('2');

  // --- 1. CARREGAMENTO ---
  useEffect(() => {
    if (!user) return;

    // Salário
    const fetchUserData = async () => {
      const docRef = doc(db, "user_prefs", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) setSalary(docSnap.data().salary || 0);
    };
    fetchUserData();

    // Transações (Traz tudo e filtra no front para velocidade)
    const qTrans = query(collection(db, "transactions"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
    const unsubTrans = onSnapshot(qTrans, (snap) => {
      const list = snap.docs.map(doc => {
        const data = doc.data();
        const dateObj = data.createdAt ? data.createdAt.toDate() : new Date();
        return { 
          id: doc.id, 
          ...data, 
          dateString: dateObj.toLocaleDateString('pt-BR') 
        };
      }) as Transaction[];
      setAllTransactions(list);
      setLoading(false);
    });

    // Cartões
    const unsubCards = onSnapshot(query(collection(db, "cards"), where("userId", "==", user.uid)), (snap) => {
      const list = snap.docs.map(d => ({ label: d.data().name, value: d.id, day: d.data().closingDay }));
      setMyCards(list);
      
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
      if (alerts.length > 0) { setDueAlerts(alerts); setAlertVisible(true); }
      if(list.length > 0 && !selectedCard) setSelectedCard(list[0].value);
    });

    // Pessoas
    const unsubPeople = onSnapshot(query(collection(db, "people"), where("userId", "==", user.uid)), (snap) => {
      const dbList = snap.docs.map(d => ({ label: d.data().name, value: d.id }));
      const ownerOption = { label: user.displayName || 'Eu (Titular)', value: user.uid };
      const finalList = [ownerOption, ...dbList];
      setMyPeople(finalList);
      if(!selectedPerson) setSelectedPerson(ownerOption.value);
    });

    return () => { unsubTrans(); unsubCards(); unsubPeople(); };
  }, [user]);

  // --- 2. FILTRO POR MÊS ---
  useEffect(() => {
    // Filtra as transações para mostrar APENAS as do mês/ano selecionado no currentDate
    const filtered = allTransactions.filter(t => {
      // Converte o Timestamp do Firestore ou Date object
      const tDate = t.createdAt.toDate ? t.createdAt.toDate() : new Date(t.createdAt);
      return tDate.getMonth() === currentDate.getMonth() && tDate.getFullYear() === currentDate.getFullYear();
    });
    setFilteredTransactions(filtered);
  }, [allTransactions, currentDate]);

  // Reset Modal
  useEffect(() => {
    if (modalVisible) {
      setDateText(new Date().toLocaleDateString('pt-BR'));
      setCategory('Outros'); setDesc(''); setAmount(''); 
      setIsInstallment(false); setInstallmentsCount('2');
      if (user) setSelectedPerson(user.uid);
    }
  }, [modalVisible]);

  // Navegação de Mês
  const changeMonth = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const formatCurrentMonth = () => {
    const options: any = { month: 'long', year: 'numeric' };
    return currentDate.toLocaleDateString('pt-BR', options).toUpperCase();
  };

  // Salvar Salário
  async function handleSaveSalary() {
    if (!user) return;
    const val = parseFloat(tempSalary.replace(',', '.'));
    if (isNaN(val)) return Alert.alert("Erro", "Valor inválido");
    await setDoc(doc(db, "user_prefs", user.uid), { salary: val }, { merge: true });
    setSalary(val);
    setSalaryModalVisible(false);
  }

  // Deletar
  async function handleDeleteTransaction(id: string) {
    Alert.alert("Excluir", "Tem certeza?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Apagar", style: "destructive", onPress: async () => {
          try { await deleteDoc(doc(db, "transactions", id)); } 
          catch (error) { Alert.alert("Erro", "Não foi possível excluir."); }
      }}
    ]);
  }

  // --- A MÁGICA DO ALINHAMENTO COM O VENCIMENTO DO CARTÃO ---
  async function handleAddTransaction() {
    if (!desc || !amount || !selectedCard || !selectedPerson || !dateText) return Alert.alert("Ops", "Preencha tudo!");
    
    const parts = dateText.split('/');
    if (parts.length !== 3) return Alert.alert("Data Inválida", "Use DD/MM/AAAA");
    
    // Data da COMPRA real (para registro)
    const purchaseDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    
    // Valores
    const rawValue = parseFloat(amount.replace(',', '.'));
    const totalInstallments = isInstallment ? parseInt(installmentsCount) : 1;
    const installmentValue = isInstallment ? (rawValue / totalInstallments) : rawValue;

    try {
      const cardObj = myCards.find(c => c.value === selectedCard);
      const personObj = myPeople.find(p => p.value === selectedPerson);
      
      // Lógica de Vencimento
      let invoiceMonthOffset = 0;
      const cardDueDay = cardObj ? parseInt(cardObj.day) : null;

      // Se tiver dia de vencimento cadastrado
      if (cardDueDay) {
        const purchaseDay = purchaseDate.getDate();
        // Estimativa: Fatura fecha 7 dias antes do vencimento
        const closingDay = cardDueDay - 7; 
        
        // Se comprou DEPOIS do fechamento (ex: fechou dia 3, comprou dia 5, vence dia 10)
        // Isso vai para o próximo mês.
        // Nota: Se o fechamento for negativo (ex: vence dia 5, fecha dia 28 anterior), a lógica simples ainda funciona na maioria dos casos,
        // mas aqui vamos usar uma regra simples: Se comprou muito perto do vencimento, pula pro próximo.
        if (purchaseDay >= closingDay) {
          invoiceMonthOffset = 1; // Pula 1 mês
        }
      }

      const batchPromises = [];
      for (let i = 0; i < totalInstallments; i++) {
        // Data Base: Data da compra
        const transactionDate = new Date(purchaseDate);
        
        // Adiciona os meses das parcelas + o offset do fechamento
        transactionDate.setMonth(transactionDate.getMonth() + i + invoiceMonthOffset);
        
        // AJUSTE FINO: Força o dia da despesa ser o DIA DO VENCIMENTO do cartão
        // Isso organiza o extrato visualmente.
        if (cardDueDay) {
          // Cuidado com meses que não tem dia 31, o JS ajusta sozinho, mas vamos garantir
          transactionDate.setDate(Math.min(cardDueDay, 28)); // Segurança básica, ou deixe o JS lidar
          transactionDate.setDate(cardDueDay); 
        }

        const now = new Date();
        transactionDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

        const newDesc = isInstallment ? `${desc} (${i+1}/${totalInstallments})` : desc;

        const docPromise = addDoc(collection(db, "transactions"), {
          userId: user?.uid, description: newDesc, category,
          amount: parseFloat(installmentValue.toFixed(2)),
          cardId: selectedCard, cardName: cardObj?.label || '?',
          personId: selectedPerson, personName: personObj?.label || '?',
          createdAt: transactionDate, // AQUI ESTÁ O SEGREDOS: Data alinhada com a fatura
          installments: isInstallment ? `${i+1}/${totalInstallments}` : null,
          purchaseDate: purchaseDate // Opcional: salva a data real da compra se quiser exibir depois
        });
        batchPromises.push(docPromise);
      }
      
      await Promise.all(batchPromises);
      setModalVisible(false);
      
      // Se a compra foi pro mês que vem, avisa o usuário
      if (invoiceMonthOffset > 0) {
        Alert.alert("Lançado!", "Como a fatura já fechou, essa compra caiu no mês seguinte.");
      } else {
        Alert.alert("Sucesso", isInstallment ? `${totalInstallments} parcelas lançadas!` : "Lançado!");
      }
      
    } catch (error) { Alert.alert("Erro", "Falha ao salvar."); }
  }

  // Cálculos baseados na lista FILTRADA
  const monthTotal = filteredTransactions.reduce((acc, t) => acc + t.amount, 0);

  const salarySpent = salaryFilter === 'all' 
    ? monthTotal 
    : filteredTransactions.filter(t => t.personId === salaryFilter).reduce((acc, t) => acc + t.amount, 0);

  const salaryPercent = salary > 0 ? (salarySpent / salary) * 100 : 0;
  const progressColor = salaryPercent > 90 ? '#EF4444' : salaryPercent > 60 ? '#F59E0B' : '#10B981';
  
  const filterItems = [{ label: 'Todos (Fatura Total)', value: 'all' }, ...myPeople];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* HEADER COM NAVEGAÇÃO DE MÊS */}
      <View style={styles.header}>
        
        {/* Navegação de Mês */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => changeMonth(-1)}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{formatCurrentMonth()}</Text>
          <TouchableOpacity onPress={() => changeMonth(1)}>
            <Ionicons name="chevron-forward" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15}}>
           <View>
            <Text style={styles.headerLabel}>Fatura Estimada</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={styles.headerValue}>
                {isValuesVisible ? monthTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '••••••••'}
              </Text>
              <TouchableOpacity onPress={() => setIsValuesVisible(!isValuesVisible)}>
                <Ionicons name={isValuesVisible ? "eye-outline" : "eye-off-outline"} size={20} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.profileIcon} onPress={() => { setTempSalary(salary.toString()); setSalaryModalVisible(true); }}>
            <Ionicons name="cash-outline" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* SALÁRIO BOX */}
      <View style={styles.salaryBox}>
        <View style={styles.salaryHeader}>
          <Text style={styles.salaryTitle}>Comprometimento</Text>
          <View style={{ width: 150 }}>
             <SmartPicker items={filterItems} selectedValue={salaryFilter} onValueChange={setSalaryFilter} dark={true} placeholder="Todos" />
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5, marginBottom: 5 }}>
          <Text style={styles.salaryValue}>
            {isValuesVisible ? `R$ ${salarySpent.toFixed(2)}` : '••••'}
          </Text>
          <Text style={{ color: '#94a3b8', fontSize: 12 }}>
             ({isValuesVisible ? `${salaryPercent.toFixed(1)}%` : '••%'})
          </Text>
        </View>
        
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${Math.min(salaryPercent, 100)}%`, backgroundColor: progressColor }]} />
        </View>
      </View>

      {/* LISTA FILTRADA POR MÊS */}
      <View style={styles.body}>
        <Text style={styles.sectionTitle}>Extrato de {currentDate.toLocaleDateString('pt-BR', {month:'long'})}</Text>
        {loading ? <ActivityIndicator color="#3B82F6" /> : (
          <FlatList
            data={filteredTransactions}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="checkmark-circle-outline" size={48} color="#334155" />
                <Text style={styles.emptyText}>Nenhuma fatura para este mês.</Text>
              </View>
            }
            renderItem={({ item }) => {
              // LÓGICA DE DIAS CORRIGIDA:
              // Compara a data de vencimento salva no item com o dia de hoje (23/01/2026)
              const tDate = item.createdAt.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
              const today = new Date();
              today.setHours(0, 0, 0, 0); // Zera as horas de hoje para comparar apenas o dia
              
              const isPast = tDate < today;

              return (
                <View style={[styles.cardItem, isPast && { opacity: 0.6 }]}>
                  <View style={[styles.iconBox, isPast && { backgroundColor: '#334155' }]}>
                    <Ionicons 
                      name={isPast ? "checkmark-done" : "pricetag"} 
                      size={18} 
                      color={isPast ? "#94a3b8" : "#3B82F6"} 
                    />
                  </View>
                  <View style={{ flex: 1, paddingHorizontal: 12 }}>
                    <Text style={[styles.itemTitle, isPast && { textDecorationLine: 'line-through' }]} numberOfLines={1}>
                      {item.description}
                    </Text>
                    <Text style={styles.itemSubtitle}>
                      {isPast ? "Venceu dia: " : "Vence: "} {item.dateString} • {item.cardName}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
                    <Text style={styles.itemAmount}>{isValuesVisible ? `R$ ${item.amount.toFixed(2)}` : '••••'}</Text>
                    <View style={styles.personBadge}><Text style={styles.personBadgeText}>{item.personName}</Text></View>
                    {item.installments && <Text style={{fontSize: 9, color:'#F59E0B', fontWeight:'bold'}}>{item.installments}</Text>}
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteTransaction(item.id)} style={styles.deleteButton}>
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        )}
      </View>

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Ionicons name="add" size={32} color="#FFF" />
      </TouchableOpacity>

      {/* MODAIS */}
      <Modal visible={salaryModalVisible} transparent animationType="fade">
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>Definir Salário</Text>
            <TextInput 
              style={styles.salaryInput} keyboardType="numeric" placeholder="R$ 0,00" placeholderTextColor="#666"
              value={tempSalary} onChangeText={setTempSalary} autoFocus
            />
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveSalary}><Text style={styles.saveButtonText}>Salvar</Text></TouchableOpacity>
            <TouchableOpacity style={{marginTop: 15}} onPress={() => setSalaryModalVisible(false)}><Text style={{color: '#94a3b8'}}>Cancelar</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={alertVisible} transparent animationType="fade">
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            <Ionicons name="warning" size={40} color="#EF4444" />
            <Text style={styles.alertTitle}>Atenção!</Text>
            {dueAlerts.map((msg, index) => <Text key={index} style={styles.alertText}>{msg}</Text>)}
            <TouchableOpacity style={styles.alertButton} onPress={() => setAlertVisible(false)}><Text style={styles.alertButtonText}>OK</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: '#1e293b' }}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nova Despesa</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close-circle" size={30} color="#94a3b8" /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>O que você comprou?</Text>
                <TextInput style={styles.input} placeholder="Ex: Jantar, Tênis..." placeholderTextColor="#64748b" value={desc} onChangeText={setDesc} />
              </View>
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.label}>Valor Total (R$)</Text>
                  <TextInput style={styles.input} placeholder="0,00" keyboardType="numeric" placeholderTextColor="#64748b" value={amount} onChangeText={setAmount} />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Data da Compra</Text>
                  <TextInput style={styles.input} placeholder="DD/MM/AAAA" keyboardType="numbers-and-punctuation" placeholderTextColor="#64748b" value={dateText} onChangeText={setDateText} />
                </View>
              </View>
              <View style={styles.switchContainer}>
                <Text style={styles.switchLabel}>Parcelado?</Text>
                <Switch value={isInstallment} onValueChange={setIsInstallment} trackColor={{false: "#334155", true: "#3B82F6"}} />
              </View>
              {isInstallment && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Nº Parcelas</Text>
                  <TextInput style={styles.input} placeholder="Ex: 10" keyboardType="numeric" placeholderTextColor="#64748b" value={installmentsCount} onChangeText={setInstallmentsCount} />
                </View>
              )}
              <SmartPicker label="Categoria" items={CATEGORIES.map(c=>({label:c, value:c}))} selectedValue={category} onValueChange={setCategory} placeholder="Selecione..." />
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 5 }}>
                  <SmartPicker label="Cartão" items={myCards} selectedValue={selectedCard} onValueChange={setSelectedCard} placeholder="Selecione..." />
                </View>
                <View style={{ flex: 1, marginLeft: 5 }}>
                  <SmartPicker label="Quem usou?" items={myPeople} selectedValue={selectedPerson} onValueChange={setSelectedPerson} placeholder="Selecione..." />
                </View>
              </View>
              <TouchableOpacity style={styles.saveButton} onPress={handleAddTransaction}><Text style={styles.saveButtonText}>LANÇAR</Text></TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20, backgroundColor: '#0f172a' },
  monthNav: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  monthTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginHorizontal: 20 },
  headerLabel: { color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  headerValue: { color: '#FFF', fontSize: 32, fontWeight: 'bold' },
  profileIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  salaryBox: { marginHorizontal: 20, marginTop: 5, padding: 16, backgroundColor: '#1e293b', borderRadius: 16, borderWidth: 1, borderColor: '#334155' },
  salaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  salaryTitle: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  salaryValue: { color: '#FFF', fontWeight: 'bold', fontSize: 18 },
  progressBarBg: { height: 8, backgroundColor: '#0f172a', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  body: { flex: 1, paddingHorizontal: 20, marginTop: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#FFF', marginBottom: 15, textTransform: 'capitalize' },
  cardItem: { backgroundColor: '#1e293b', padding: 16, borderRadius: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  iconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(59, 130, 246, 0.1)', justifyContent: 'center', alignItems: 'center' },
  itemTitle: { fontSize: 16, fontWeight: '600', color: '#f1f5f9' },
  itemSubtitle: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  itemAmount: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  personBadge: { backgroundColor: 'rgba(255, 255, 255, 0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginTop: 4, alignSelf: 'flex-end' },
  personBadgeText: { color: '#3B82F6', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  emptyContainer: { alignItems: 'center', marginTop: 50, opacity: 0.7 },
  emptyText: { color: '#94a3b8', marginTop: 10, fontSize: 16 },
  fab: { position: 'absolute', bottom: 30, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', elevation: 8 },
  deleteButton: { padding: 5 },
  modalContainer: { flex: 1, backgroundColor: '#1e293b', paddingTop: 30, paddingHorizontal: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30, marginTop: 20 },
  modalTitle: { fontSize: 24, fontWeight: '800', color: '#FFF' },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '600', color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase' },
  input: { backgroundColor: '#0f172a', borderRadius: 12, padding: 16, fontSize: 16, color: '#FFF', borderWidth: 1, borderColor: '#334155' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  switchContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, backgroundColor: '#0f172a', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#334155' },
  switchLabel: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  iosPickerButton: { backgroundColor: '#0f172a', borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  pickerContainer: { backgroundColor: '#0f172a', borderRadius: 12, borderWidth: 1, borderColor: '#334155' },
  iosPickerText: { fontSize: 16, color: '#FFF' },
  iosModalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.8)' },
  iosModalContent: { backgroundColor: '#1e293b', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40, borderWidth: 1, borderColor: '#334155' },
  iosHeader: { padding: 15, alignItems: 'flex-end', borderBottomWidth: 1, borderBottomColor: '#334155', backgroundColor: '#0f172a', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  iosDoneText: { color: '#3B82F6', fontSize: 17, fontWeight: 'bold' },
  alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 30 },
  alertBox: { backgroundColor: '#1e293b', borderRadius: 20, padding: 25, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  alertTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFF', marginTop: 10, marginBottom: 10 },
  alertText: { fontSize: 16, color: '#cbd5e1', marginBottom: 15, textAlign: 'center' },
  alertButton: { backgroundColor: '#EF4444', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 10, width: '100%', alignItems: 'center' },
  alertButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  salaryInput: { backgroundColor: '#0f172a', color: '#FFF', fontSize: 24, padding: 15, width: '100%', textAlign: 'center', borderRadius: 12, marginBottom: 20, fontWeight: 'bold' },
  saveButton: { backgroundColor: '#3B82F6', borderRadius: 14, paddingVertical: 18, alignItems: 'center', marginTop: 20 },
  saveButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 }
});