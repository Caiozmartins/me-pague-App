import React, { useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, Modal, TextInput, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, doc, onSnapshot, orderBy, query, runTransaction, Timestamp, where } from 'firebase/firestore';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';

import { db } from '../../config/firebaseConfig';
import { AuthContext } from '../../contexts/AuthContext';
import { PeopleStackParamList } from '../../navigation/types';

interface PersonTransaction {
  id: string;
  description: string;
  amount: number;
  cardName?: string;
  paid?: boolean;
  dateLabel: string;
}

interface PersonPayment {
  id: string;
  amount: number;
  dateLabel: string;
  note?: string;
}

type Props = NativeStackScreenProps<PeopleStackParamList, 'PersonDetail'>;

export default function PersonDetailScreen({ navigation, route }: Props) {
  const { user } = useContext(AuthContext);
  const { personId, personName } = route.params;

  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<PersonTransaction[]>([]);
  const [payments, setPayments] = useState<PersonPayment[]>([]);
  const [paymentsReadBlocked, setPaymentsReadBlocked] = useState(false);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [personPhone, setPersonPhone] = useState('');
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [paymentsWriteBlocked, setPaymentsWriteBlocked] = useState(false);

  useEffect(() => {
    if (!user || !personId) return;

    const personRef = doc(db, 'people', personId);
    const unsubPerson = onSnapshot(personRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const data: any = snapshot.data();
      setCurrentBalance(Number(data.currentBalance || 0));
      setPersonPhone(String(data.phone || ''));
    });

    // Evita dependência de índice composto (userId + personId + orderBy)
    // e mantém compatível com regras baseadas em userId.
    const q = query(collection(db, 'transactions'), where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs
          .filter((docItem) => {
            const data: any = docItem.data();
            return String(data.personId || '') === personId;
          })
          .map((docItem) => {
            const data: any = docItem.data();
            const dateObj = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
            return {
              id: docItem.id,
              description: data.description || 'Sem descrição',
              amount: Number(data.amount || 0),
              cardName: data.cardName || 'Cartão',
              paid: Boolean(data.paid),
              dateLabel: dateObj.toLocaleDateString('pt-BR'),
              _sortDate: dateObj.getTime(),
            };
          })
          .sort((a, b) => b._sortDate - a._sortDate)
          .map(({ _sortDate, ...item }) => item);

        setTransactions(list);
        setLoading(false);
      },
      (error) => {
        const code = (error as any)?.code;
        if (code === 'permission-denied') {
          console.warn('PersonDetail transactions permission denied');
          Alert.alert('Permissão', 'Sem permissão para ler transações dessa pessoa. Verifique as regras do Firestore.');
        } else if (code === 'failed-precondition') {
          console.warn('PersonDetail transactions index missing');
          Alert.alert('Índice', 'A consulta precisa de índice no Firestore. Crie o índice sugerido no log do Firebase Console.');
        } else {
          console.warn('PersonDetail snapshot warning:', error);
          Alert.alert('Erro', 'Não foi possível carregar as transações desta pessoa.');
        }
        setLoading(false);
      }
    );

    const qPayments = query(collection(db, 'payments'), where('userId', '==', user.uid));

    const unsubPayments = onSnapshot(
      qPayments,
      (snapshot) => {
        setPaymentsReadBlocked(false);
        const list = snapshot.docs
          .filter((docItem) => {
            const data: any = docItem.data();
            return String(data.personId || '') === personId;
          })
          .map((docItem) => {
            const data: any = docItem.data();
            const dateObj = data.createdAt?.toDate
              ? data.createdAt.toDate()
              : data.date
                ? new Date(data.date)
                : new Date();
            return {
              id: docItem.id,
              amount: Number(data.amount || 0),
              dateLabel: dateObj.toLocaleDateString('pt-BR'),
              note: data.note || 'Pagamento recebido',
              _sortDate: dateObj.getTime(),
            };
          })
          .sort((a, b) => b._sortDate - a._sortDate)
          .map(({ _sortDate, ...item }) => item as PersonPayment);
        setPayments(list);
      },
      (error) => {
        const code = (error as any)?.code;
        if (code === 'permission-denied') {
          setPaymentsReadBlocked(true);
          setPayments([]);
          console.warn('PersonDetail payments permission denied');
          return;
        }
        console.warn('PersonDetail payments snapshot warning:', error);
      }
    );

    return () => {
      unsubscribe();
      unsubPerson();
      unsubPayments();
    };
  }, [user, personId]);

  async function handleRegisterPayment() {
    if (!user || !personId) return;

    const normalized = Number(String(paymentAmount).replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(normalized) || normalized <= 0) {
      Alert.alert('Erro', 'Informe um valor válido.');
      return;
    }

    const effectiveAmount = Math.min(normalized, currentBalance);
    if (effectiveAmount <= 0) {
      Alert.alert('Aviso', 'Essa pessoa não possui dívida pendente.');
      return;
    }

    setIsSavingPayment(true);
    try {
      await runTransaction(db, async (tx) => {
        const personRef = doc(db, 'people', personId);
        const paymentRef = doc(collection(db, 'payments'));
        const personSnap = await tx.get(personRef);
        if (!personSnap.exists()) throw new Error('Pessoa não encontrada.');
        const latestBalance = Number(personSnap.data().currentBalance || 0);
        const amountToApply = Math.min(effectiveAmount, latestBalance);
        const nextBalance = Math.max(0, latestBalance - amountToApply);
        tx.update(personRef, { currentBalance: nextBalance });
        tx.set(paymentRef, {
          userId: user.uid,
          personId,
          personName,
          amount: amountToApply,
          date: new Date().toISOString(),
          note: 'Baixa manual de pagamento',
          createdAt: Timestamp.now(),
        });
      });

      setPaymentsWriteBlocked(false);

      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setPaymentModalVisible(false);
      setPaymentAmount('');
      Alert.alert('Sucesso', 'Pagamento registrado e dívida atualizada.');
    } catch (error) {
      const code = (error as any)?.code;
      if (code === 'permission-denied') {
        setPaymentsWriteBlocked(true);
        console.warn('Register payment permission denied');
        Alert.alert('Permissão', 'Sem permissão para registrar pagamentos. Verifique as regras do Firestore para a coleção payments.');
      } else {
        console.warn('Register payment warning:', error);
        Alert.alert('Erro', 'Não foi possível registrar o pagamento.');
      }
    } finally {
      setIsSavingPayment(false);
    }
  }

  const normalizePhoneForWhatsApp = (value?: string) => {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('00')) return digits.slice(2);
    if (digits.length === 10 || digits.length === 11) return `55${digits}`;
    return digits;
  };

  async function handleSendDebtToWhatsApp() {
    try {
      const phoneDigits = normalizePhoneForWhatsApp(personPhone);
      if (!phoneDigits) {
        Alert.alert('WhatsApp', 'Cadastre o número dessa pessoa na tela de Pessoas.');
        return;
      }

      const debtItems = transactions.filter((item) => !item.paid);
      const sourceItems = debtItems.length > 0 ? debtItems : transactions;
      const previewItems = sourceItems.slice(0, 10);
      const itemsText =
        previewItems.length > 0
          ? previewItems
              .map((item) => `- ${item.description} (${item.dateLabel})`)
              .join('\n')
          : '- Sem itens detalhados';
      const moreCount = sourceItems.length - previewItems.length;

      const message =
        `Olá, ${personName}! Tudo bem?\n` +
        `Sua conta atual no cartão está em R$ ${Number(currentBalance || 0).toFixed(2)}.\n` +
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

  const totalReceived = payments.reduce((acc, item) => acc + item.amount, 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{personName || 'Detalhes'}</Text>
          <Text style={styles.subtitle}>Dívida atual: R$ {currentBalance.toFixed(2)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.whatsappButton, !personPhone && styles.whatsappButtonDisabled]}
          onPress={handleSendDebtToWhatsApp}
        >
          <Ionicons name="logo-whatsapp" size={16} color={!personPhone ? '#64748b' : '#0b2515'} />
          <Text style={[styles.whatsappButtonText, !personPhone && { color: '#64748b' }]}>Cobrar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.receiveButton}
          onPress={() => setPaymentModalVisible(true)}
          disabled={currentBalance <= 0}
        >
          <Ionicons name="cash-outline" size={16} color={currentBalance <= 0 ? '#64748b' : '#0f172a'} />
          <Text style={[styles.receiveButtonText, currentBalance <= 0 && { color: '#64748b' }]}>Dar baixa</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#3B82F6" style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          ListHeaderComponent={<Text style={styles.sectionTitle}>Transações</Text>}
          ListEmptyComponent={<Text style={styles.emptyText}>Nenhuma transação para esta pessoa.</Text>}
          ListFooterComponent={
            <View style={styles.paymentSection}>
              <View style={styles.paymentHeader}>
                <Text style={styles.paymentTitle}>Pagamentos recebidos</Text>
                <Text style={styles.paymentTotal}>R$ {totalReceived.toFixed(2)}</Text>
              </View>

              {payments.length === 0 ? (
                <Text style={styles.paymentEmpty}>
                  {paymentsReadBlocked ? 'Sem permissão para listar pagamentos.' : 'Nenhum pagamento registrado.'}
                </Text>
              ) : (
                payments.map((item) => (
                  <View key={item.id} style={styles.paymentItem}>
                    <View>
                      <Text style={styles.paymentItemNote}>{item.note || 'Pagamento recebido'}</Text>
                      <Text style={styles.paymentItemDate}>{item.dateLabel}</Text>
                    </View>
                    <Text style={styles.paymentItemAmount}>+ R$ {item.amount.toFixed(2)}</Text>
                  </View>
                ))
              )}
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.item}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{item.description}</Text>
                <Text style={styles.itemDate}>
                  {item.dateLabel} • {item.cardName || 'Cartão'}
                </Text>
              </View>
              <Text style={[styles.itemAmount, { color: item.paid ? '#10B981' : '#EF4444' }]}>
                R$ {item.amount.toFixed(2)}
              </Text>
            </View>
          )}
        />
      )}

      <Modal visible={paymentModalVisible} transparent animationType="fade" onRequestClose={() => setPaymentModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Dar Baixa em Pagamento</Text>
            <Text style={styles.modalHint}>Dívida atual: R$ {currentBalance.toFixed(2)}</Text>
            {paymentsWriteBlocked && (
              <Text style={styles.modalWarning}>Sem permissão de escrita em payments.</Text>
            )}
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              placeholder="Valor recebido"
              placeholderTextColor="#64748b"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnGhost]} onPress={() => setPaymentModalVisible(false)}>
                <Text style={styles.modalBtnGhostText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary, isSavingPayment && { opacity: 0.65 }]}
                onPress={handleRegisterPayment}
                disabled={isSavingPayment}
              >
                <Text style={styles.modalBtnPrimaryText}>{isSavingPayment ? 'Salvando...' : 'Confirmar'}</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  title: { color: '#FFF', fontSize: 22, fontWeight: '700' },
  subtitle: { color: '#94a3b8', fontSize: 13, marginTop: 2, fontVariant: ['tabular-nums'] },
  receiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#93c5fd',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginLeft: 10,
  },
  whatsappButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#4ade80',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginLeft: 10,
  },
  whatsappButtonDisabled: { backgroundColor: '#1e293b' },
  whatsappButtonText: { color: '#0b2515', fontWeight: '700', fontSize: 12 },
  receiveButtonText: { color: '#0f172a', fontWeight: '700', fontSize: 12 },
  sectionTitle: { color: '#e2e8f0', fontWeight: '700', fontSize: 14, marginBottom: 12, textTransform: 'uppercase' },
  emptyText: { color: '#94a3b8', textAlign: 'center', marginTop: 20 },
  item: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  itemTitle: { color: '#f8fafc', fontWeight: '600', fontSize: 15 },
  itemDate: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  itemAmount: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  paymentSection: {
    marginTop: 22,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 14,
    padding: 14,
  },
  paymentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  paymentTitle: { color: '#cbd5e1', fontWeight: '700', fontSize: 13, textTransform: 'uppercase' },
  paymentTotal: { color: '#22c55e', fontWeight: '700', fontVariant: ['tabular-nums'] },
  paymentEmpty: { color: '#6b7280', fontSize: 13 },
  paymentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  paymentItemNote: { color: '#e5e7eb', fontSize: 14, fontWeight: '600' },
  paymentItemDate: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  paymentItemAmount: { color: '#22c55e', fontWeight: '700', fontVariant: ['tabular-nums'] },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 22,
  },
  modalCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 18,
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 6 },
  modalHint: { color: '#94a3b8', marginBottom: 12, fontVariant: ['tabular-nums'] },
  modalWarning: { color: '#f59e0b', fontSize: 12, marginBottom: 10, fontWeight: '600' },
  modalInput: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#fff',
    fontSize: 16,
    padding: 14,
    marginBottom: 14,
    fontVariant: ['tabular-nums'],
  },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalBtnGhost: { backgroundColor: '#334155' },
  modalBtnPrimary: { backgroundColor: '#3B82F6' },
  modalBtnGhostText: { color: '#cbd5e1', fontWeight: '600' },
  modalBtnPrimaryText: { color: '#fff', fontWeight: '700' },
});
