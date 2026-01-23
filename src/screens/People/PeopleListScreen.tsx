import React, { useState, useEffect, useContext } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  TextInput, Modal, Alert, ActivityIndicator, KeyboardAvoidingView, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';
import { AuthContext } from '../../contexts/AuthContext';

interface Person {
  id: string;
  name: string;
}

const AVATAR_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899'];

export default function PeopleListScreen() {
  const { user } = useContext(AuthContext);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "people"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Person[];
      setPeople(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  async function handleAddPerson() {
    if (!newName.trim()) return Alert.alert("Erro", "Digite um nome!");
    try {
      await addDoc(collection(db, "people"), {
        userId: user?.uid, name: newName.trim(), createdAt: new Date()
      });
      setModalVisible(false);
      setNewName('');
      Alert.alert("Sucesso", "Pessoa adicionada! 👥");
    } catch (error) {
      Alert.alert("Erro", "Não foi possível salvar.");
    }
  }

  async function handleDelete(id: string) {
    Alert.alert("Remover Pessoa", "Isso não apaga o histórico de compras dela, apenas o nome da lista.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: async () => {
        await deleteDoc(doc(db, "people", id));
      }}
    ]);
  }

  const getInitials = (name: string) => name.charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      
      {/* HEADER LIMPO (SEM BOX) */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Pessoas</Text>
          <Text style={styles.headerSubtitle}>Quem usa seus cartões?</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
          <LinearGradient
            colors={['#3B82F6', '#2563EB']}
            style={styles.addButtonGradient}
          >
            <Ionicons name="add" size={28} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* LISTA */}
      {loading ? (
        <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={people}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 20, paddingTop: 10 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={60} color="#334155" />
              <Text style={styles.emptyText}>Ninguém cadastrado.</Text>
              <Text style={styles.emptySubText}>Toque no + para adicionar familiares.</Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <View style={styles.cardItem}>
              <View style={styles.personInfo}>
                <View style={[styles.avatar, { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }]}>
                  <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
                </View>
                <Text style={styles.personName}>{item.name}</Text>
              </View>
              
              <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item.id)}>
                 <Ionicons name="trash-outline" size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* MODAL DARK */}
      <Modal visible={modalVisible} animationType="fade" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nova Pessoa</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.inputLabel}>Nome ou Apelido</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Ex: Esposa, Marido, Filho..." 
              placeholderTextColor="#64748b"
              value={newName} 
              onChangeText={setNewName} 
              autoFocus
            />

            <TouchableOpacity style={styles.saveButton} onPress={handleAddPerson}>
              <Text style={styles.saveButtonText}>Salvar</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  
  // HEADER LIMPO (Seamless)
  header: { 
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 70, paddingBottom: 20,
    alignItems: 'center',
    backgroundColor: '#0f172a' // Mesma cor do container
  },
  headerTitle: { fontSize: 32, fontWeight: 'bold', color: '#FFF' },
  headerSubtitle: { fontSize: 14, color: '#94a3b8', marginTop: 5 },
  
  addButton: { shadowColor: "#3B82F6", shadowOpacity: 0.4, shadowOffset: {width: 0, height: 4}, shadowRadius: 8 },
  addButtonGradient: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },

  // CARD ITEM
  cardItem: { 
    backgroundColor: '#1e293b', padding: 16, borderRadius: 16, marginBottom: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: '#334155'
  },
  personInfo: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  avatar: { 
    width: 45, height: 45, borderRadius: 23, justifyContent: 'center', alignItems: 'center',
    shadowColor: "#000", shadowOpacity: 0.3, shadowOffset: {width: 0, height: 2}
  },
  avatarText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  personName: { fontSize: 18, fontWeight: '600', color: '#f1f5f9' },
  deleteButton: { padding: 8, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 8 },

  // EMPTY STATE
  emptyContainer: { alignItems: 'center', marginTop: 100, opacity: 0.7 },
  emptyText: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginTop: 20 },
  emptySubText: { color: '#94a3b8', fontSize: 14, marginTop: 5 },

  // MODAL STYLE
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modalContent: { 
    backgroundColor: '#1e293b', borderRadius: 24, padding: 24, 
    borderWidth: 1, borderColor: '#334155', width: '100%', maxWidth: 400, alignSelf: 'center'
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFF' },
  
  inputLabel: { color: '#94a3b8', fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  input: { 
    backgroundColor: '#0f172a', color: '#FFF', borderRadius: 12, padding: 16, 
    fontSize: 16, borderWidth: 1, borderColor: '#334155', marginBottom: 20
  },
  
  saveButton: { backgroundColor: '#3B82F6', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  saveButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});