import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
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
  Animated,
  Easing,
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

type DistributionRow = {
  name: string;
  total: number;
  percent: number;
  color: string;
};

const PIE_COLORS = ['#3B82F6', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

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
  const chartIntro = useRef(new Animated.Value(0)).current;

  const buildDistribution = (rows: ChartRow[]): DistributionRow[] => {
    if (rows.length === 0) return [];

    const top = rows.slice(0, 5);
    const othersTotal = rows.slice(5).reduce((acc, row) => acc + row.total, 0);
    const total = rows.reduce((acc, row) => acc + row.total, 0);

    const grouped = othersTotal > 0 ? [...top, { name: 'Outros', total: othersTotal, percent: total > 0 ? (othersTotal / total) * 100 : 0 }] : top;
    return grouped.map((row, idx) => ({
      ...row,
      color: PIE_COLORS[idx % PIE_COLORS.length],
    }));
  };

  const personDistribution = useMemo(() => buildDistribution(byPerson), [byPerson]);
  const categoryDistribution = useMemo(() => buildDistribution(byCategory), [byCategory]);

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

  useEffect(() => {
    if (loading) return;
    chartIntro.setValue(0);
    Animated.timing(chartIntro, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [loading, byPerson.length, byCategory.length, currentDate, chartIntro]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchReportData();
  };

  const changeMonth = (direction: number) => {
    const next = new Date(currentDate);
    next.setMonth(next.getMonth() + direction);
    setCurrentDate(next);
  };

  const escapeHtml = (value: string) =>
    String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const buildPrintableHtml = () => {
    const monthTitle = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
    const monthTag = currentDate.toISOString().slice(0, 7);
    const fmt = (value: number) =>
      Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const rows = monthlyTransactions
      .map(
        (item) =>
          `<tr>
            <td>${escapeHtml(item.dateLabel || '-')}</td>
            <td>${escapeHtml(item.cardName || '-')}</td>
            <td>${escapeHtml(item.personName || 'Desconhecido')}</td>
            <td>${escapeHtml(item.category || 'Outros')}</td>
            <td>${item.origin === 'revolving' ? 'Rotativo' : 'Compra'}</td>
            <td><span class="badge ${item.paid ? 'ok' : 'warn'}">${item.paid ? 'Pago' : 'Pendente'}</span></td>
            <td class="money">${fmt(Number(item.amount || 0))}</td>
          </tr>`
      )
      .join('');
    const topPeople = byPerson
      .slice(0, 5)
      .map(
        (item, idx) =>
          `<li><span>${idx + 1}. ${escapeHtml(item.name)}</span><strong>${fmt(item.total)} (${item.percent.toFixed(1)}%)</strong></li>`
      )
      .join('');
    const topCategories = byCategory
      .slice(0, 5)
      .map(
        (item, idx) =>
          `<li><span>${idx + 1}. ${escapeHtml(item.name)}</span><strong>${fmt(item.total)} (${item.percent.toFixed(1)}%)</strong></li>`
      )
      .join('');

    return `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Relatório ${monthTitle}</title>
          <style>
            :root { --bg:#f8fafc; --ink:#0f172a; --muted:#475569; --line:#cbd5e1; --accent:#1d4ed8; --card:#ffffff; --ok:#047857; --warn:#b45309; }
            * { box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: var(--bg); color: var(--ink); padding: 28px; }
            .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 18px; }
            h1 { margin:0; font-size: 26px; letter-spacing: -0.5px; }
            .sub { margin-top:6px; color: var(--muted); font-size: 13px; }
            .tag { font-size: 12px; background:#dbeafe; color:#1e3a8a; padding:6px 10px; border-radius:999px; font-weight:600; }
            .grid { display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
            .kpi { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 12px; }
            .kpi b { display:block; font-size: 20px; margin-top: 6px; }
            .kpi span { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.7px; }
            .cards { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
            .card { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 12px; }
            .card h3 { margin:0 0 8px 0; font-size: 14px; }
            .rank { list-style:none; margin:0; padding:0; }
            .rank li { display:flex; justify-content:space-between; font-size:12px; padding:6px 0; border-top:1px solid #e2e8f0; }
            .rank li:first-child { border-top:none; }
            .section-title { margin: 16px 0 8px; font-size: 14px; font-weight: 700; text-transform: uppercase; color: #334155; letter-spacing: 0.6px; }
            table { width: 100%; border-collapse: collapse; background: var(--card); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
            th, td { padding: 9px 10px; font-size: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
            th { background: #eff6ff; color:#1e3a8a; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
            tr:nth-child(even) td { background: #f8fafc; }
            .money { text-align:right; font-weight:700; font-variant-numeric: tabular-nums; }
            .badge { display:inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; }
            .badge.ok { color: var(--ok); background: #dcfce7; }
            .badge.warn { color: var(--warn); background: #fef3c7; }
            .footer { margin-top: 10px; color: var(--muted); font-size: 11px; text-align: right; }
            @page { size: A4; margin: 12mm; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>Relatório Mensal</h1>
              <div class="sub">Período: ${monthTitle}</div>
            </div>
            <div class="tag">${monthTag}</div>
          </div>

          <div class="grid">
            <div class="kpi"><span>Total no mês</span><b>${fmt(totalSpent)}</b></div>
            <div class="kpi"><span>Compras</span><b>${fmt(purchaseTotal)}</b></div>
            <div class="kpi"><span>Rotativo</span><b>${fmt(revolvingTotal)}</b></div>
          </div>

          <div class="cards">
            <div class="card">
              <h3>Top pessoas</h3>
              <ul class="rank">${topPeople || '<li><span>Sem dados</span><strong>-</strong></li>'}</ul>
            </div>
            <div class="card">
              <h3>Top categorias</h3>
              <ul class="rank">${topCategories || '<li><span>Sem dados</span><strong>-</strong></li>'}</ul>
            </div>
          </div>

          <div class="section-title">Lançamentos do mês</div>
          <table>
            <thead>
              <tr>
                <th>Data</th><th>Cartão</th><th>Pessoa</th><th>Categoria</th><th>Origem</th><th>Pago</th><th>Valor</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="footer">Gerado em ${new Date().toLocaleString('pt-BR')}</div>
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

  const DistributionStrip = ({ data }: { data: DistributionRow[] }) => (
    <View style={styles.stripWrapper}>
      <View style={styles.stripTrack}>
        {data.map((item, index) => (
          <View
            key={`${item.name}-${index}`}
            style={[
              styles.stripSegment,
              {
                width: `${Math.max(item.percent, 4)}%`,
                backgroundColor: item.color,
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.stripLegend}>
        {data.map((item, index) => (
          <View key={`${item.name}-legend-${index}`} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
            <Text style={styles.legendText} numberOfLines={1}>
              {item.name} ({item.percent.toFixed(1)}%)
            </Text>
          </View>
        ))}
      </View>
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
              <>
                <Animated.View
                  style={[
                    styles.chartEntrance,
                    {
                      opacity: chartIntro,
                      transform: [
                        {
                          translateY: chartIntro.interpolate({
                            inputRange: [0, 1],
                            outputRange: [14, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <DistributionStrip data={personDistribution} />
                </Animated.View>
                {personDistribution.map((item, index) => (
                  <ChartBar key={`${item.name}-${index}`} label={item.name} value={item.total} percent={item.percent} color={item.color} />
                ))}
              </>
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
              <>
                <Animated.View
                  style={[
                    styles.chartEntrance,
                    {
                      opacity: chartIntro,
                      transform: [
                        {
                          translateY: chartIntro.interpolate({
                            inputRange: [0, 1],
                            outputRange: [14, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <DistributionStrip data={categoryDistribution} />
                </Animated.View>
                {categoryDistribution.map((item, index) => (
                  <ChartBar key={`${item.name}-${index}`} label={item.name} value={item.total} percent={item.percent} color={item.color} />
                ))}
              </>
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
  totalValue: { color: '#FFF', fontSize: 34, fontWeight: '800', fontVariant: ['tabular-nums'] },
  totalLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  exportRow: { flexDirection: 'row', gap: 8, marginTop: 12, width: '100%', justifyContent: 'center' },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#1d4ed8',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 150,
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
  kpiValue: { color: '#FFF', fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
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
  chartEntrance: { alignItems: 'center', marginBottom: 12 },
  stripWrapper: { width: '100%' },
  stripTrack: {
    width: '100%',
    height: 18,
    borderRadius: 9,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
    flexDirection: 'row',
  },
  stripSegment: {
    height: '100%',
  },
  stripLegend: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.65)',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
  },
  chartItem: { marginBottom: 16 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  chartLabel: { fontSize: 15, fontWeight: '600', color: '#cbd5e1' },
  chartValue: { fontSize: 15, fontWeight: '700', color: '#FFF', fontVariant: ['tabular-nums'] },
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
