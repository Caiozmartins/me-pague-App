import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  TouchableOpacity,
  Platform,
  Share,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { startOfMonth, endOfMonth } from 'date-fns';

import { db } from '../../config/firebaseConfig';
import { AuthContext } from '../../contexts/AuthContext';

type ChartRow = {
  name: string;
  total: number;
  percent: number;
};

type ReportTransaction = {
  id: string;
  dateLabel: string;
  amount?: number;
  personName?: string;
  cardName?: string;
  category?: string;
  paid?: boolean;
  origin?: 'purchase' | 'revolving';
};

export default function ReportsScreen() {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  const [totalSpent, setTotalSpent] = useState(0);
  const [purchaseTotal, setPurchaseTotal] = useState(0);
  const [revolvingTotal, setRevolvingTotal] = useState(0);
  const [byPerson, setByPerson] = useState<ChartRow[]>([]);
  const [byCategory, setByCategory] = useState<ChartRow[]>([]);
  const [monthlyTransactions, setMonthlyTransactions] = useState<ReportTransaction[]>([]);

  const fetchReportData = async () => {
    if (!user) return;

    try {
      const start = Timestamp.fromDate(startOfMonth(currentDate));
      const end = Timestamp.fromDate(endOfMonth(currentDate));

      const q = query(
        collection(db, 'transactions'),
        where('userId', '==', user.uid),
        where('createdAt', '>=', start),
        where('createdAt', '<=', end),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const transactions = querySnapshot.docs.map((docItem) => {
        const data: any = docItem.data();
        const dateObj = data.createdAt?.toDate ? data.createdAt.toDate() : null;
        return {
          id: docItem.id,
          dateLabel: dateObj ? dateObj.toLocaleDateString('pt-BR') : '-',
          amount: Number(data.amount || 0),
          personName: data.personName || 'Desconhecido',
          cardName: data.cardName || '-',
          category: data.category || 'Outros',
          paid: Boolean(data.paid),
          origin: data.origin,
        } as ReportTransaction;
      });
      setMonthlyTransactions(transactions);

      const total = transactions.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
      const purchases = transactions.reduce((acc, curr) => {
        const isPurchase = !curr.origin || curr.origin === 'purchase';
        return isPurchase ? acc + Number(curr.amount || 0) : acc;
      }, 0);
      const revolving = transactions.reduce((acc, curr) => {
        return curr.origin === 'revolving' ? acc + Number(curr.amount || 0) : acc;
      }, 0);

      setTotalSpent(total);
      setPurchaseTotal(purchases);
      setRevolvingTotal(revolving);

      const peopleMap: Record<string, number> = {};
      transactions.forEach((t) => {
        const name = t.personName || 'Desconhecido';
        peopleMap[name] = (peopleMap[name] || 0) + Number(t.amount || 0);
      });

      const peopleArray = Object.keys(peopleMap)
        .map((key) => ({
          name: key,
          total: peopleMap[key],
          percent: total > 0 ? (peopleMap[key] / total) * 100 : 0,
        }))
        .sort((a, b) => b.total - a.total);
      setByPerson(peopleArray);

      // Categorias considerando compras como visão principal de consumo.
      const purchaseTransactions = transactions.filter((t) => !t.origin || t.origin === 'purchase');
      const categoryMap: Record<string, number> = {};
      purchaseTransactions.forEach((t) => {
        const cat = t.category || 'Outros';
        categoryMap[cat] = (categoryMap[cat] || 0) + Number(t.amount || 0);
      });

      const categoryArray = Object.keys(categoryMap)
        .map((key) => ({
          name: key,
          total: categoryMap[key],
          percent: purchases > 0 ? (categoryMap[key] / purchases) * 100 : 0,
        }))
        .sort((a, b) => b.total - a.total);
      setByCategory(categoryArray);
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [user, currentDate]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchReportData();
  };

  const changeMonth = (direction: number) => {
    const next = new Date(currentDate);
    next.setMonth(next.getMonth() + direction);
    setCurrentDate(next);
  };

  const buildCsv = () => {
    const headers = ['Data', 'Descricao', 'Cartao', 'Pessoa', 'Categoria', 'Origem', 'Pago', 'Valor'];
    const escapeCsv = (value: string) => `"${String(value).replace(/"/g, '""')}"`;
    const lines = monthlyTransactions.map((item) =>
      [
        item.dateLabel,
        '-',
        item.cardName || '-',
        item.personName || 'Desconhecido',
        item.category || 'Outros',
        item.origin || 'purchase',
        item.paid ? 'sim' : 'nao',
        Number(item.amount || 0).toFixed(2),
      ]
        .map(escapeCsv)
        .join(',')
    );
    return [headers.join(','), ...lines].join('\n');
  };

  const handleExportCsv = async () => {
    if (monthlyTransactions.length === 0) {
      Alert.alert('Exportação', 'Não há dados para exportar neste mês.');
      return;
    }

    const csv = buildCsv();
    const monthTag = currentDate.toISOString().slice(0, 7);

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio-${monthTag}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return;
    }

    await Share.share({
      message: csv,
      title: `Relatorio ${monthTag}`,
    });
  };

  const buildPrintableHtml = () => {
    const monthTitle = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
    const rows = monthlyTransactions
      .map(
        (item) =>
          `<tr>
            <td>${item.dateLabel}</td>
            <td>${item.cardName || '-'}</td>
            <td>${item.personName || 'Desconhecido'}</td>
            <td>${item.category || 'Outros'}</td>
            <td>${item.origin || 'purchase'}</td>
            <td>${item.paid ? 'Sim' : 'Não'}</td>
            <td>R$ ${Number(item.amount || 0).toFixed(2)}</td>
          </tr>`
      )
      .join('');

    return `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Relatorio ${monthTitle}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h1 { margin-bottom: 4px; }
            p { margin-top: 0; color: #555; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; text-align: left; }
            th { background: #f5f5f5; }
          </style>
        </head>
        <body>
          <h1>Relatório Mensal</h1>
          <p>${monthTitle}</p>
          <p>Total: R$ ${totalSpent.toFixed(2)} | Compras: R$ ${purchaseTotal.toFixed(2)} | Rotativo: R$ ${revolvingTotal.toFixed(2)}</p>
          <table>
            <thead>
              <tr>
                <th>Data</th><th>Cartão</th><th>Pessoa</th><th>Categoria</th><th>Origem</th><th>Pago</th><th>Valor</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `;
  };

  const handleExportPdf = async () => {
    if (monthlyTransactions.length === 0) {
      Alert.alert('Exportação', 'Não há dados para exportar neste mês.');
      return;
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        Alert.alert('Exportação', 'Não foi possível abrir a janela de impressão.');
        return;
      }
      printWindow.document.write(buildPrintableHtml());
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      return;
    }

    await Share.share({
      message:
        `Relatório ${currentDate.toISOString().slice(0, 7)}\n` +
        `Total: R$ ${totalSpent.toFixed(2)}\nCompras: R$ ${purchaseTotal.toFixed(2)}\nRotativo: R$ ${revolvingTotal.toFixed(2)}\n\n` +
        'No mobile, use a opção de impressão do compartilhamento para salvar em PDF.',
    });
  };

  const ChartBar = ({ label, value, percent, color }: { label: string; value: number; percent: number; color: string }) => (
    <View style={styles.chartItem}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartLabel}>{label}</Text>
        <Text style={styles.chartValue}>R$ {value.toFixed(2)}</Text>
      </View>
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${Math.min(percent, 100)}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.percentText}>{percent.toFixed(1)}%</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => changeMonth(-1)}>
            <Ionicons name="chevron-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>
            {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}
          </Text>
          <TouchableOpacity onPress={() => changeMonth(1)}>
            <Ionicons name="chevron-forward" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>

        <Text style={styles.headerTitle}>Relatório Mensal</Text>
        <Text style={styles.totalValue}>{totalSpent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Text>
        <Text style={styles.totalLabel}>TOTAL NO MÊS</Text>
        <View style={styles.exportRow}>
          <TouchableOpacity style={styles.exportButton} onPress={handleExportCsv}>
            <Ionicons name="download-outline" size={15} color="#FFF" />
            <Text style={styles.exportButtonText}>CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.exportButton} onPress={handleExportPdf}>
            <Ionicons name="print-outline" size={15} color="#FFF" />
            <Text style={styles.exportButtonText}>PDF</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 50 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFF" />}
        >
          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, { borderColor: '#3B82F6' }]}>
              <Text style={styles.kpiLabel}>Compras</Text>
              <Text style={styles.kpiValue}>R$ {purchaseTotal.toFixed(2)}</Text>
            </View>
            <View style={[styles.kpiCard, { borderColor: '#F59E0B' }]}>
              <Text style={styles.kpiLabel}>Rotativo</Text>
              <Text style={styles.kpiValue}>R$ {revolvingTotal.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                <Ionicons name="people" size={20} color="#3B82F6" />
              </View>
              <Text style={styles.sectionTitle}>Quem gastou mais?</Text>
            </View>

            {byPerson.length === 0 ? (
              <Text style={styles.emptyText}>Sem dados para este mês.</Text>
            ) : (
              byPerson.map((item, index) => (
                <ChartBar key={`${item.name}-${index}`} label={item.name} value={item.total} percent={item.percent} color="#3B82F6" />
              ))
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                <Ionicons name="pie-chart" size={20} color="#F59E0B" />
              </View>
              <Text style={styles.sectionTitle}>Compras por Categoria</Text>
            </View>

            {byCategory.length === 0 ? (
              <Text style={styles.emptyText}>Sem compras para este mês.</Text>
            ) : (
              byCategory.map((item, index) => (
                <ChartBar
                  key={`${item.name}-${index}`}
                  label={item.name}
                  value={item.total}
                  percent={item.percent}
                  color={index === 0 ? '#EF4444' : '#F59E0B'}
                />
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    backgroundColor: '#0f172a',
    paddingVertical: 16,
    paddingHorizontal: 20,
    paddingTop: 60,
    alignItems: 'center',
    marginBottom: 8,
  },
  monthNav: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  monthTitle: { color: '#cbd5e1', fontSize: 14, fontWeight: '700', marginHorizontal: 16 },
  headerTitle: { color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  totalValue: { color: '#FFF', fontSize: 34, fontWeight: '800' },
  totalLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  exportRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#334155',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  exportButtonText: { color: '#FFF', fontWeight: '600', fontSize: 12 },
  kpiRow: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 16, gap: 10 },
  kpiCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  kpiLabel: { color: '#94a3b8', fontSize: 12, marginBottom: 4 },
  kpiValue: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  section: {
    backgroundColor: '#1e293b',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#FFF', marginLeft: 12 },
  iconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  chartItem: { marginBottom: 16 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  chartLabel: { fontSize: 15, fontWeight: '600', color: '#cbd5e1' },
  chartValue: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  progressBarBg: {
    height: 8,
    backgroundColor: '#0f172a',
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  progressBarFill: { height: '100%', borderRadius: 4 },
  percentText: { fontSize: 11, color: '#94a3b8', marginTop: 4, textAlign: 'right' },
  emptyText: { textAlign: 'center', color: '#64748b', padding: 10 },
});
