import React, { useState, useEffect, useContext } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  FlatList, Modal, TextInput, Alert, ActivityIndicator, Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, getDocs, limit } from 'firebase/firestore';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { db } from '../../config/firebaseConfig';
import { AuthContext } from '../../contexts/AuthContext';
import { Person } from '../../types';
import { PeopleStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<PeopleStackParamList, 'PeopleList'>;

const AVATAR_PALETTE = [
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#F59E0B', // amber
  '#10B981', // emerald
  '#06B6D4', // cyan
  '#EF4444', // red
  '#84CC16', // lime
  '#F97316', // orange
  '#6366F1', // indigo
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

export default function PeopleListScreen({ navigation }: Props) {
  const { user } = useContext(AuthContext);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
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
        await updateDoc(doc(db, "people", editingId), { name: name.trim(), phone: phone.trim() || null });
      } else {
        await addDoc(collection(db, "people"), {
          userId: user?.uid,
          name: name.trim(),
          phone: phone.trim() || null,
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
    setPhone(String(person.phone || ''));
    setModalVisible(true);
  }

  const normalizePhoneForWhatsApp = (value?: string) => {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('00')) return digits.slice(2);
    if (digits.length === 10 || digits.length === 11) return `55${digits}`;
    return digits;
  };

  async function handleSendWhatsApp(person: Person) {
    try {
      const phoneDigits = normalizePhoneForWhatsApp(person.phone);
      if (!phoneDigits) {
        Alert.alert('WhatsApp', 'Cadastre o número dessa pessoa para enviar cobrança.');
        return;
      }

      const txSnap = await getDocs(query(collection(db, 'transactions'), where('userId', '==', user?.uid)));
      const personTransactions = txSnap.docs
        .map((docItem) => ({ id: docItem.id, ...(docItem.data() as any) }))
        .filter((t: any) => String(t.personId || '') === person.id);
      const debtItems = personTransactions.filter((t: any) => !Boolean(t.paid));
      const sourceItems = debtItems.length > 0 ? debtItems : personTransactions;
      const previewItems = sourceItems.slice(0, 10);
      const itemsText =
        previewItems.length > 0
          ? previewItems
              .map((t: any) => {
                const dateObj = t.createdAt?.toDate ? t.createdAt.toDate() : new Date();
                const dateLabel = dateObj.toLocaleDateString('pt-BR');
                return `- ${t.description || 'Compra'} (${dateLabel})`;
              })
              .join('\n')
          : '- Sem itens detalhados';
      const moreCount = sourceItems.length - previewItems.length;

      const message =
        `Olá, ${person.name}! Tudo bem?\n` +
        `Sua conta atual está em R$ ${Number(person.currentBalance || 0).toFixed(2)}.\n` +
        `Itens:\n${itemsText}\n` +
        (moreCount > 0 ? `... e mais ${moreCount} item(ns).\n` : '') +
        'Quando puder, me faz o pagamento, por favor.';
      const encodedMessage = encodeURIComponent(message);
      const nativeUrl = `whatsapp://send?phone=${phoneDigits}&text=${encodedMessage}`;
      const fallbackUrl = `https://wa.me/${phoneDigits}?text=${encodedMessage}`;

      const canOpenNative = await Linking.canOpenURL(nativeUrl);
      if (canOpenNative) {
        await Linking.openURL(nativeUrl);
        return;
      }

      await Linking.openURL(fallbackUrl);
    } catch (error) {
      console.warn('WhatsApp open warning:', error);
      Alert.alert('WhatsApp', 'Não foi possível abrir o WhatsApp agora.');
    }
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
    setPhone('');
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
          contentContainerStyle={{ padding: 20, paddingBottom: 40, flexGrow: 1 }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconShell}>
                <Ionicons name="people-outline" size={40} color="#93c5fd" />
                <View style={styles.emptySpark}>
                  <Ionicons name="add" size={12} color="#0f172a" />
                </View>
              </View>
              <Text style={styles.emptyTitle}>Ainda não adicionaste nenhuma pessoa</Text>
              <Text style={styles.emptyDescription}>
                Regista quem participa nas despesas para acompanhar saldos e dividir valores com clareza.
              </Text>
              <TouchableOpacity style={styles.emptyCta} onPress={() => setModalVisible(true)}>
                <Ionicons name="person-add" size={16} color="#0f172a" />
                <Text style={styles.emptyCtaText}>Adicionar agora</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.personCard}>
              <View style={[styles.avatar, { backgroundColor: getAvatarColor(item.name) }]}>
                <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
              </View>
              
              <TouchableOpacity
                style={{ flex: 1 }}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('PersonDetail', { personId: item.id, personName: item.name })}
              >
                <Text style={styles.personName}>{item.name}</Text>
                <Text style={styles.balanceLabel}>Saldo atual</Text>
                <Text style={[styles.balanceValue, { color: item.currentBalance > 0 ? '#EF4444' : '#10B981' }]}>
                  R$ {item.currentBalance?.toFixed(2) || "0.00"}
                </Text>
                {!!item.phone && <Text style={styles.phoneText}>WhatsApp: {item.phone}</Text>}
              </TouchableOpacity>

              <View style={styles.actions}>
                <TouchableOpacity onPress={() => handleSendWhatsApp(item)} style={styles.actionBtn}>
                  <Ionicons name="logo-whatsapp" size={18} color="#22c55e" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleEdit(item)} style={styles.actionBtn}>
                  <Ionicons name="pencil" size={18} color="#3B82F6" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.actionBtn}>
                  <Ionicons name="trash" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
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
            <TextInput
              style={styles.input}
              placeholder="WhatsApp (com DDD)"
              placeholderTextColor="#64748b"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
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
  balanceValue: { fontSize: 16, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  phoneText: { color: '#64748b', fontSize: 11, marginTop: 4 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 20,
  },
  emptyIconShell: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(59,130,246,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptySpark: {
    position: 'absolute',
    right: 4,
    bottom: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#93c5fd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { color: '#f8fafc', fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 10 },
  emptyDescription: { color: '#94a3b8', fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 320, marginBottom: 18 },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#93c5fd',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyCtaText: { color: '#0f172a', fontWeight: '700' },
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
