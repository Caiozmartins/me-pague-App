import React, { useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { db } from '../../config/firebaseConfig';
import { AuthContext } from '../../contexts/AuthContext';
import { PeopleStackParamList } from '../../navigation/types';

interface PersonTransaction {
  id: string;
  description: string;
  amount: number;
  paid?: boolean;
  dateLabel: string;
}

type Props = NativeStackScreenProps<PeopleStackParamList, 'PersonDetail'>;

export default function PersonDetailScreen({ navigation, route }: Props) {
  const { user } = useContext(AuthContext);
  const { personId, personName } = route.params;

  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<PersonTransaction[]>([]);

  useEffect(() => {
    if (!user || !personId) return;

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid),
      where('personId', '==', personId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((docItem) => {
          const data: any = docItem.data();
          const dateObj = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
          return {
            id: docItem.id,
            description: data.description || 'Sem descrição',
            amount: Number(data.amount || 0),
            paid: Boolean(data.paid),
            dateLabel: dateObj.toLocaleDateString('pt-BR'),
          };
        });

        setTransactions(list);
        setLoading(false);
      },
      (error) => {
        console.error('PersonDetail snapshot error:', error);
        setLoading(false);
        Alert.alert('Permissão', 'Sem permissão para ler transações dessa pessoa. Verifique as regras do Firestore.');
      }
    );

    return () => unsubscribe();
  }, [user, personId]);

  const totalPending = transactions.filter((item) => !item.paid).reduce((acc, item) => acc + item.amount, 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{personName || 'Detalhes'}</Text>
          <Text style={styles.subtitle}>Pendente: R$ {totalPending.toFixed(2)}</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color="#3B82F6" style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          ListEmptyComponent={<Text style={styles.emptyText}>Nenhuma transação para esta pessoa.</Text>}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{item.description}</Text>
                <Text style={styles.itemDate}>{item.dateLabel}</Text>
              </View>
              <Text style={[styles.itemAmount, { color: item.paid ? '#10B981' : '#EF4444' }]}>
                R$ {item.amount.toFixed(2)}
              </Text>
            </View>
          )}
        />
      )}
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
  subtitle: { color: '#94a3b8', fontSize: 13, marginTop: 2 },
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
  itemAmount: { fontSize: 15, fontWeight: '700' },
});
