import React, { useState, useEffect, useContext } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  Dimensions, Modal, TextInput, Alert, Platform, UIManager, LayoutAnimation, ScrollView
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  collection, query, where, onSnapshot, addDoc, 
  deleteDoc, doc, updateDoc, getDoc 
} from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';
import { AuthContext } from '../../contexts/AuthContext';
import { Card } from '../../types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');
const SHINY_BLACK_THEME = ['#4b5563', '#1f2937', '#000000']; 

export default function CardsScreen() {
  const { user } = useContext(AuthContext);
  
  const [cards, setCards] = useState<Card[]>([]);
  const [activeCardIndex, setActiveCardIndex] = useState<number | null>(null);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [newClosingDay, setNewClosingDay] = useState('');
  const [newLast4, setNewLast4] = useState('');

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "cards"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const list = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        })) as Card[];
        setCards(list);
    });
    return () => unsubscribe();
  }, [user]);

  const handleEditPress = (card: Card) => {
    setEditingId(card.id);
    setNewName(card.name);
    setNewLimit(String(card.totalLimit));
    setNewClosingDay(String(card.closingDay));
    setNewLast4(card.last4);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingId(null);
    setNewName(''); setNewLimit(''); setNewClosingDay(''); setNewLast4('');
  };

  async function handleSaveCard() {
    if (!newName || !newLimit || !newClosingDay || !newLast4) {
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
      { text: "Excluir", style: "destructive", onPress: async () => {
        await deleteDoc(doc(db, "cards", id));
        setActiveCardIndex(null);
      }}
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
        <View style={[styles.stackContainer, { height: cards.length * 70 + 220 }]}> 
          {cards.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="card-outline" size={60} color="#334155" />
              <Text style={styles.emptyText}>Carteira vazia.</Text>
            </View>
          ) : (
            cards.map((card, index) => {
              const isActive = index === activeCardIndex;
              return (
                <TouchableOpacity
                  key={card.id}
                  activeOpacity={0.9}
                  onPress={() => handleCardPress(index)}
                  style={[styles.cardWrapper, { top: index * 65, zIndex: isActive ? 100 : index, transform: [{ scale: isActive ? 1.05 : 1 }] }]}
                >
                  <LinearGradient colors={SHINY_BLACK_THEME as any} style={styles.cardFace}>
                    <View style={styles.shineEffect} />
                    <View style={styles.cardHeader}>
                      <View style={styles.chip} />
                      {isActive && (
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          <TouchableOpacity onPress={() => handleEditPress(card)} style={styles.actionBtn}>
                            <Ionicons name="create-outline" size={22} color="#3B82F6" />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleDelete(card.id)} style={styles.actionBtn}>
                            <Ionicons name="trash-outline" size={22} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                    <Text style={styles.cardNumber}>•••• •••• •••• {card.last4 || '****'}</Text>
                    <View style={styles.cardFooter}>
                      <View>
                        <Text style={styles.cardLabel}>DISPONÍVEL / TOTAL</Text>
                        <Text style={styles.cardValue}>R$ {card.availableLimit?.toFixed(2)} / {card.totalLimit?.toFixed(2)}</Text>
                      </View>
                      <View>
                        <Text style={styles.cardLabel}>FECHAMENTO</Text>
                        <Text style={styles.cardValue}>DIA {card.closingDay}</Text>
                      </View>
                    </View>
                    <Text style={styles.cardName}>{card.name}</Text>
                  </LinearGradient>
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
  cardWrapper: { position: 'absolute', width: width * 0.90, height: 200 },
  cardFace: { flex: 1, borderRadius: 20, padding: 24, justifyContent: 'space-between', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
  shineEffect: { position: 'absolute', top: -50, left: -50, width: 200, height: 200, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 100 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chip: { width: 45, height: 32, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 6 },
  actionBtn: { backgroundColor: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 50 },
  cardNumber: { color: '#e2e8f0', fontSize: 20, letterSpacing: 4, fontWeight: 'bold' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  cardLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 'bold' },
  cardValue: { color: '#FFF', fontSize: 13, fontWeight: 'bold' },
  cardName: { position: 'absolute', top: 24, left: 80, color: 'rgba(255,255,255,0.9)', fontWeight: 'bold', fontSize: 18, textTransform: 'uppercase' },
  emptyContainer: { alignItems: 'center', marginTop: 100, opacity: 0.7 },
  emptyText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
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