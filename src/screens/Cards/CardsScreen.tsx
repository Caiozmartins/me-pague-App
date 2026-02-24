import React, { useState, useEffect, useContext } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  Dimensions, Modal, TextInput, Alert, Platform, UIManager, LayoutAnimation, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { 
  collection, query, where, onSnapshot, addDoc, 
  deleteDoc, doc, updateDoc, getDoc, getDocs, limit
} from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';
import { AuthContext } from '../../contexts/AuthContext';
import { Card } from '../../types';
import VirtualCard, { VIRTUAL_CARD_HEIGHT, VIRTUAL_CARD_WIDTH } from '../../components/VirtualCard';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');
const CARD_STACK_OFFSET = 90;

export default function CardsScreen() {
  const { user } = useContext(AuthContext);
  
  const [cards, setCards] = useState<Card[]>([]);
  const [activeCardIndex, setActiveCardIndex] = useState<number | null>(null);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [newClosingDay, setNewClosingDay] = useState('');
  const [newDueDay, setNewDueDay] = useState('');
  const [newBank, setNewBank] = useState('');
  const [newLast4, setNewLast4] = useState('');

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "cards"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Card[];
        setCards(list);
      },
      (error) => {
        console.error('Cards snapshot error:', error);
        Alert.alert("Permissão", "Sem permissão para listar cartões. Verifique as regras do Firestore.");
      }
    );
    return () => unsubscribe();
  }, [user]);

  const handleEditPress = (card: Card) => {
    setEditingId(card.id);
    setNewName(card.name);
    setNewLimit(String(card.totalLimit));
    setNewClosingDay(String(card.closingDay));
    setNewDueDay(String(card.dueDay ?? ''));
    setNewBank(String(card.bank ?? ''));
    setNewLast4(card.last4);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingId(null);
    setNewName(''); setNewLimit(''); setNewClosingDay(''); setNewDueDay(''); setNewBank(''); setNewLast4('');
  };

  async function handleSaveCard() {
    if (!newName || !newLimit || !newClosingDay || !newDueDay || !newLast4) {
      return Alert.alert("Erro", "Preencha todos os campos!");
    }
    
    try {
      const limitValue = Number(newLimit.replace(',', '.'));

      if (editingId) {
        const cardRef = doc(db, "cards", editingId);
        const cardSnap = await getDoc(cardRef);
        
        if (cardSnap.exists()) {
          const oldTotalLimit = cardSnap.data().totalLimit || 0;
          const oldAvailable = cardSnap.data().availableLimit || 0;
          
          // Calcula a diferença para ajustar o disponível
          const difference = limitValue - oldTotalLimit;
          
          await updateDoc(cardRef, {
            name: newName,
              totalLimit: limitValue,
              availableLimit: oldAvailable + difference, 
              closingDay: Number(newClosingDay), 
              dueDay: Number(newDueDay),
              bank: newBank.trim() || null,
              last4: newLast4,
            });
          Alert.alert("Sucesso", "Cartão e limites atualizados! 💳");
        }
      } else {
        await addDoc(collection(db, "cards"), {
          userId: user?.uid, 
          name: newName,
          totalLimit: limitValue,
          availableLimit: limitValue,
          closingDay: Number(newClosingDay), 
          dueDay: Number(newDueDay),
          bank: newBank.trim() || null,
          last4: newLast4,
          createdAt: new Date().toISOString()
        });
        Alert.alert("Sucesso", "Cartão adicionado! 💳");
      }
      
      closeModal();
    } catch (error) {
      console.log(error);
      Alert.alert("Erro", "Falha ao salvar o cartão.");
    }
  }

  async function handleDelete(id: string) {
    Alert.alert("Excluir", "Deseja remover este cartão?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            const hasTransactionsQuery = query(
              collection(db, "transactions"),
              where("userId", "==", user?.uid),
              where("cardId", "==", id),
              limit(1)
            );
            const hasTransactionsSnap = await getDocs(hasTransactionsQuery);
            if (!hasTransactionsSnap.empty) {
              Alert.alert("Bloqueado", "Não é possível excluir: este cartão possui transações vinculadas.");
              return;
            }

            await deleteDoc(doc(db, "cards", id));
            setActiveCardIndex(null);
          } catch {
            Alert.alert("Erro", "Não foi possível excluir este cartão.");
          }
        }
      }
    ]);
  }

  const handleCardPress = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveCardIndex(activeCardIndex === index ? null : index);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>Meus Cartões</Text>
          <Text style={styles.headerCount}>{cards.length} {cards.length === 1 ? 'cartão' : 'cartões'} cadastrados</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={30} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollStack} showsVerticalScrollIndicator={false}>
        <View style={[styles.stackContainer, { height: cards.length * CARD_STACK_OFFSET + VIRTUAL_CARD_HEIGHT + 40 }]}> 
          {cards.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyCardBadge}>
                <Ionicons name="card-outline" size={42} color="#93c5fd" />
                <View style={styles.emptyCardBadgeDot}>
                  <Ionicons name="sparkles" size={11} color="#0f172a" />
                </View>
              </View>
              <Text style={styles.emptyTitle}>Ainda não adicionaste nenhum cartão</Text>
              <Text style={styles.emptySubtitle}>
                Adiciona o primeiro cartão para começar a lançar despesas e acompanhar limites em tempo real.
              </Text>
              <TouchableOpacity style={styles.emptyAction} onPress={() => setModalVisible(true)}>
                <Ionicons name="add" size={16} color="#0f172a" />
                <Text style={styles.emptyActionText}>Vamos começar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            cards.map((card, index) => {
              const isActive = index === activeCardIndex;
              return (
                <TouchableOpacity
                  key={card.id}
                  activeOpacity={0.9}
                  onPress={() => handleCardPress(index)}
                  style={[
                    styles.cardWrapper,
                    {
                      top: index * CARD_STACK_OFFSET,
                      left: (width - VIRTUAL_CARD_WIDTH) / 2,
                      zIndex: isActive ? 100 : index,
                      transform: [{ scale: isActive ? 1.01 : 1 }],
                    },
                  ]}
                >
                  <VirtualCard
                    card={card}
                    variant={(((index % 4) + 1) as 1 | 2 | 3 | 4)}
                    isFrozen={card.availableLimit <= 0}
                  />
                  {isActive && (
                    <View style={styles.cardActions}>
                      <TouchableOpacity onPress={() => handleEditPress(card)} style={styles.actionBtn}>
                        <Ionicons name="create-outline" size={22} color="#3B82F6" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDelete(card.id)} style={styles.actionBtn}>
                        <Ionicons name="trash-outline" size={22} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  )}
	                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingId ? 'Editar Cartão' : 'Novo Cartão'}</Text>
            
            <Text style={styles.inputLabel}>Nome (Apelido)</Text>
            <TextInput style={styles.input} value={newName} onChangeText={setNewName} placeholder="Ex: Nubank" placeholderTextColor="#64748b" />

            <Text style={styles.inputLabel}>Limite Total (R$)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={newLimit} onChangeText={setNewLimit} placeholder="0.00" placeholderTextColor="#64748b" />

            <Text style={styles.inputLabel}>Banco/Bandeira (opcional)</Text>
            <TextInput style={styles.input} value={newBank} onChangeText={setNewBank} placeholder="Ex: Nubank, Visa, Mastercard" placeholderTextColor="#64748b" />

            <View style={styles.row}>
              <View style={{flex: 1, marginRight: 10}}>
                <Text style={styles.inputLabel}>Final (4 dig.)</Text>
                <TextInput style={styles.input} keyboardType="numeric" maxLength={4} value={newLast4} onChangeText={setNewLast4} placeholder="0000" placeholderTextColor="#64748b" />
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.inputLabel}>Dia Fech.</Text>
                <TextInput style={styles.input} keyboardType="numeric" maxLength={2} value={newClosingDay} onChangeText={setNewClosingDay} placeholder="Dia" placeholderTextColor="#64748b" />
              </View>
            </View>

            <Text style={styles.inputLabel}>Dia Venc.</Text>
            <TextInput style={styles.input} keyboardType="numeric" maxLength={2} value={newDueDay} onChangeText={setNewDueDay} placeholder="Dia" placeholderTextColor="#64748b" />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={closeModal}>
                <Text style={styles.btnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnSave]} onPress={handleSaveCard}>
                <Text style={styles.btnText}>{editingId ? 'Atualizar' : 'Salvar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 70, paddingBottom: 20 },
  headerLabel: { color: '#FFF', fontSize: 28, fontWeight: 'bold' },
  headerCount: { color: '#94a3b8', fontSize: 14 },
  addButton: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center' },
  scrollStack: { paddingBottom: 100, paddingTop: 20 },
  stackContainer: { alignItems: 'center', width: '100%', position: 'relative' },
  cardWrapper: { position: 'absolute', width: VIRTUAL_CARD_WIDTH, height: VIRTUAL_CARD_HEIGHT },
  cardActions: { position: 'absolute', right: 12, top: 12, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 5 },
  actionBtn: { backgroundColor: 'rgba(0,0,0,0.45)', padding: 8, borderRadius: 50 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 70, paddingHorizontal: 28 },
  emptyCardBadge: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: 'rgba(59,130,246,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyCardBadgeDot: {
    position: 'absolute',
    right: 8,
    top: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#93c5fd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { color: '#f8fafc', fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 10 },
  emptySubtitle: { color: '#94a3b8', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 20, maxWidth: 320 },
  emptyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#93c5fd',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyActionText: { color: '#0f172a', fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#1e293b', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#334155' },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFF', marginBottom: 20, textAlign: 'center' },
  inputLabel: { color: '#94a3b8', fontSize: 12, marginBottom: 8 },
  input: { backgroundColor: '#0f172a', color: '#FFF', borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#334155' },
  row: { flexDirection: 'row' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  btn: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  btnCancel: { backgroundColor: '#ef4444', marginRight: 10 },
  btnSave: { backgroundColor: '#3B82F6', marginLeft: 10 },
  btnText: { color: '#FFF', fontWeight: 'bold' }
});
