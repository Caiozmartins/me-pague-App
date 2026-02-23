import React, { useState, useEffect, useContext } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  FlatList, Modal, TextInput, Alert, ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, getDocs, limit } from 'firebase/firestore';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { db } from '../../config/firebaseConfig';
import { AuthContext } from '../../contexts/AuthContext';
import { Person } from '../../types';
import { PeopleStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<PeopleStackParamList, 'PeopleList'>;

export default function PeopleListScreen({ navigation }: Props) {
  const { user } = useContext(AuthContext);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "people"), where("userId", "==", user.uid));
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Person[];
        // Ordena por nome
        setPeople(list.sort((a, b) => a.name.localeCompare(b.name)));
        setLoading(false);
      },
      (error) => {
        console.error('PeopleList snapshot error:', error);
        setLoading(false);
        Alert.alert("Permissão", "Sem permissão para listar pessoas. Verifique as regras do Firestore.");
      }
    );
    return () => unsubscribe();
  }, [user]);

  async function handleSavePerson() {
    if (!name.trim()) return Alert.alert("Erro", "Digite o nome.");
    
    try {
      if (editingId) {
        await updateDoc(doc(db, "people", editingId), { name: name.trim() });
      } else {
        await addDoc(collection(db, "people"), {
          userId: user?.uid,
          name: name.trim(),
          currentBalance: 0,
          createdAt: new Date().toISOString()
        });
      }
      closeModal();
    } catch {
      Alert.alert("Erro", "Não foi possível salvar.");
    }
  }

  function handleEdit(person: Person) {
    setEditingId(person.id);
    setName(person.name);
    setModalVisible(true);
  }

  async function handleDelete(id: string) {
    Alert.alert("Excluir", "Deseja remover essa pessoa da lista?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            const hasTransactionsQuery = query(
              collection(db, "transactions"),
              where("userId", "==", user?.uid),
              where("personId", "==", id),
              limit(1)
            );
            const hasTransactionsSnap = await getDocs(hasTransactionsQuery);
            if (!hasTransactionsSnap.empty) {
              Alert.alert("Bloqueado", "Não é possível excluir: essa pessoa possui transações vinculadas.");
              return;
            }

            await deleteDoc(doc(db, "people", id));
          } catch {
            Alert.alert("Erro", "Não foi possível excluir essa pessoa.");
          }
        },
      }
    ]);
  }

  const closeModal = () => {
    setModalVisible(false);
    setEditingId(null);
    setName('');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>Pessoas</Text>
          <Text style={styles.headerCount}>{people.length} contatos</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
          <Ionicons name="person-add" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#3B82F6" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={people}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 20 }}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.personCard}
              onPress={() => navigation.navigate('PersonDetail', { personId: item.id, personName: item.name })}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
              </View>
              
              <View style={{ flex: 1 }}>
                <Text style={styles.personName}>{item.name}</Text>
                <Text style={styles.balanceLabel}>Saldo atual</Text>
                <Text style={[styles.balanceValue, { color: item.currentBalance > 0 ? '#EF4444' : '#10B981' }]}>
                  R$ {item.currentBalance?.toFixed(2) || "0.00"}
                </Text>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity onPress={() => handleEdit(item)} style={styles.actionBtn}>
                  <Ionicons name="pencil" size={18} color="#3B82F6" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.actionBtn}>
                  <Ionicons name="trash" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Modal Cadastro/Edição */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingId ? 'Editar Nome' : 'Nova Pessoa'}</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Nome" 
              placeholderTextColor="#64748b"
              value={name}
              onChangeText={setName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={closeModal}>
                <Text style={styles.btnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnSave]} onPress={handleSavePerson}>
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
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20 },
  headerLabel: { color: '#FFF', fontSize: 28, fontWeight: 'bold' },
  headerCount: { color: '#94a3b8', fontSize: 14 },
  addButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center' },
  personCard: { 
    backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#334155'
  },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  personName: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  balanceLabel: { color: '#94a3b8', fontSize: 12 },
  balanceValue: { fontSize: 16, fontWeight: 'bold' },
  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: { padding: 8, backgroundColor: '#0f172a', borderRadius: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: '#1e293b', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: '#334155' },
  modalTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { backgroundColor: '#0f172a', color: '#FFF', borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  btnCancel: { backgroundColor: '#334155' },
  btnSave: { backgroundColor: '#3B82F6' },
  btnText: { color: '#FFF', fontWeight: 'bold' }
});
