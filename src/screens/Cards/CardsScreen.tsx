import React, { useState, useEffect, useContext } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  Dimensions, Modal, TextInput, Alert, Platform, UIManager, LayoutAnimation, ScrollView
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';
import { AuthContext } from '../../contexts/AuthContext';

// Ativa animações no Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');

// TEMA ÚNICO: PRETO BRILHANTE (Black Premium)
const SHINY_BLACK_THEME = ['#4b5563', '#1f2937', '#000000']; 

export default function CardsScreen() {
  const { user } = useContext(AuthContext);
  
  // Estados
  const [cards, setCards] = useState<any[]>([]);
  const [activeCardIndex, setActiveCardIndex] = useState<number | null>(null);
  
  // Estados do Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [newClosingDay, setNewClosingDay] = useState('');
  const [newLast4, setNewLast4] = useState(''); // NOVO ESTADO: Últimos 4 dígitos

  // 1. Buscar Cartões
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "cards"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCards(list);
    });
    return () => unsubscribe();
  }, [user]);

  // 2. Adicionar Cartão
  async function handleAddCard() {
    if (!newName || !newLimit || !newClosingDay || !newLast4) {
      return Alert.alert("Erro", "Preencha todos os campos!");
    }
    
    if (newLast4.length !== 4) {
      return Alert.alert("Erro", "Digite exatamente os 4 últimos dígitos.");
    }

    try {
      await addDoc(collection(db, "cards"), {
        userId: user?.uid, 
        name: newName,
        limit: parseFloat(newLimit.replace(',', '.')), 
        closingDay: newClosingDay, 
        last4: newLast4, // Salvando os 4 dígitos
        createdAt: new Date()
      });
      setModalVisible(false);
      // Limpar campos
      setNewName(''); setNewLimit(''); setNewClosingDay(''); setNewLast4('');
      Alert.alert("Sucesso", "Cartão adicionado! 💳");
    } catch (error) {
      Alert.alert("Erro", "Falha ao salvar.");
    }
  }

  // 3. Excluir Cartão
  async function handleDelete(id: string) {
    Alert.alert("Excluir", "Deseja remover este cartão?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: async () => {
        await deleteDoc(doc(db, "cards", id));
        setActiveCardIndex(null);
      }}
    ]);
  }

  // Animação de Seleção
  const handleCardPress = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveCardIndex(activeCardIndex === index ? null : index);
  };

  return (
    <View style={styles.container}>
      
      {/* HEADER LIMPO (SEM BOX) */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>Meus Cartões</Text>
          <Text style={styles.headerCount}>
            {cards.length} {cards.length === 1 ? 'cartão' : 'cartões'} cadastrados
          </Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={30} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* ÁREA DOS CARTÕES (CASCATA/WALLET) */}
      <ScrollView contentContainerStyle={styles.scrollStack} showsVerticalScrollIndicator={false}>
        <View style={[styles.stackContainer, { height: cards.length * 70 + 220 }]}> 
          {cards.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="card-outline" size={60} color="#55334dff" />
              <Text style={styles.emptyText}>Carteira vazia.</Text>
              <Text style={styles.emptySubText}>Adicione seu primeiro cartão.</Text>
            </View>
          ) : (
            cards.map((card, index) => {
              const isActive = index === activeCardIndex;
              const topOffset = index * 65; 
              const scale = isActive ? 1.05 : 1;
              const zIndex = isActive ? 100 : index; 

              return (
                <TouchableOpacity
                  key={card.id}
                  activeOpacity={0.9}
                  onPress={() => handleCardPress(index)}
                  style={[
                    styles.cardWrapper,
                    { 
                      top: topOffset, 
                      zIndex, 
                      transform: [{ scale }]
                    }
                  ]}
                >
                  <LinearGradient
                    colors={SHINY_BLACK_THEME as any}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cardFace}
                  >
                    <View style={styles.shineEffect} />

                    <View style={styles.cardHeader}>
                      <View style={styles.chip} />
                      {isActive && (
                        <TouchableOpacity onPress={() => handleDelete(card.id)} style={styles.trashBtn}>
                          <Ionicons name="trash-outline" size={22} color="#EF4444" />
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* MOSTRA OS 4 DÍGITOS REAIS AGORA */}
                    <Text style={styles.cardNumber}>
                      •••• •••• •••• {card.last4 || '****'}
                    </Text>

                    <View style={styles.cardFooter}>
                      <View>
                        <Text style={styles.cardLabel}>LIMIT</Text>
                        <Text style={styles.cardValue}>R$ {card.limit?.toFixed(2)}</Text>
                      </View>
                      <View>
                        <Text style={styles.cardLabel}>VENCIMENTO</Text>
                        <Text style={styles.cardValue}>DIA {card.closingDay}</Text>
                      </View>
                      <FontAwesome5 name={index % 2 === 0 ? "cc-mastercard" : "cc-visa"} size={32} color="rgba(255,255,255,0.8)" />
                    </View>

                    <Text style={styles.cardName}>{card.name}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* MODAL DE CADASTRO */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Novo Cartão</Text>
            
            <Text style={styles.inputLabel}>Nome (Apelido)</Text>
            <TextInput 
              style={styles.input} placeholder="Ex: Black, Infinite..." placeholderTextColor="#64748b"
              value={newName} onChangeText={setNewName}
            />

            <Text style={styles.inputLabel}>Limite (R$)</Text>
            <TextInput 
              style={styles.input} placeholder="0,00" keyboardType="numeric" placeholderTextColor="#64748b"
              value={newLimit} onChangeText={setNewLimit}
            />

            <View style={styles.row}>
              {/* NOVO CAMPO: ÚLTIMOS 4 DÍGITOS */}
              <View style={{flex: 1, marginRight: 10}}>
                <Text style={styles.inputLabel}>Final (4 dig.)</Text>
                <TextInput 
                  style={styles.input} placeholder="Ex: 9876" keyboardType="numeric" maxLength={4} placeholderTextColor="#64748b"
                  value={newLast4} onChangeText={setNewLast4}
                />
              </View>

              <View style={{flex: 1}}>
                <Text style={styles.inputLabel}>Dia Venc.</Text>
                <TextInput 
                  style={styles.input} placeholder="Dia" keyboardType="numeric" maxLength={2} placeholderTextColor="#64748b"
                  value={newClosingDay} onChangeText={setNewClosingDay}
                />
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={() => setModalVisible(false)}>
                <Text style={styles.btnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnSave]} onPress={handleAddCard}>
                <Text style={styles.btnText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' }, // Fundo Dark

  // HEADER LIMPO (SEAMLESS)
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 70, paddingBottom: 20,
    backgroundColor: '#0f172a',
  },
  headerLabel: { color: '#FFF', fontSize: 28, fontWeight: 'bold' },
  headerCount: { color: '#94a3b8', fontSize: 14, marginTop: 5 },
  
  addButton: { 
    width: 50, height: 50, borderRadius: 25, backgroundColor: '#3B82F6',
    justifyContent: 'center', alignItems: 'center', shadowColor: "#3B82F6", shadowOpacity: 0.4, shadowRadius: 10,
  },

  // STACK
  scrollStack: { paddingBottom: 100, paddingTop: 20 },
  stackContainer: { alignItems: 'center', width: '100%', position: 'relative' },
  
  cardWrapper: {
    position: 'absolute', 
    width: width * 0.90,
    height: 200,
    shadowColor: "#000", 
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.8,
    shadowRadius: 15, 
    elevation: 10
  },
  cardFace: {
    flex: 1, borderRadius: 20, padding: 24, justifyContent: 'space-between',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden'
  },
  shineEffect: {
    position: 'absolute', top: -50, left: -50, width: 200, height: 200,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 100, transform: [{ scaleX: 2 }]
  },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chip: { 
    width: 45, height: 32, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)'
  },
  trashBtn: { backgroundColor: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 50 },
  
  cardNumber: { 
    color: '#e2e8f0', fontSize: 22, letterSpacing: 4, 
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: 'bold'
  },
  
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  cardLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10, letterSpacing: 1, marginBottom: 2, fontWeight: 'bold' },
  cardValue: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  cardName: { 
    position: 'absolute', top: 24, left: 80, 
    color: 'rgba(255,255,255,0.9)', fontWeight: 'bold', fontSize: 18, letterSpacing: 1, textTransform: 'uppercase'
  },

  emptyContainer: { alignItems: 'center', marginTop: 100, opacity: 0.7 },
  emptyText: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginTop: 20 },
  emptySubText: { color: '#94a3b8', fontSize: 14, marginTop: 5 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#1e293b', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#334155' },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFF', marginBottom: 20, textAlign: 'center' },
  
  inputLabel: { color: '#94a3b8', fontSize: 12, marginBottom: 8, textTransform: 'uppercase' },
  input: { 
    backgroundColor: '#0f172a', color: '#FFF', borderRadius: 12, padding: 16, 
    fontSize: 16, marginBottom: 20, borderWidth: 1, borderColor: '#334155' 
  },
  row: { flexDirection: 'row' },
  
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  btn: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  btnCancel: { backgroundColor: '#ef4444', marginRight: 10 },
  btnSave: { backgroundColor: '#3B82F6', marginLeft: 10 },
  btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});