import React, { useState, useEffect, useContext } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, ActivityIndicator, 
  RefreshControl, StatusBar 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';
import { AuthContext } from '../../contexts/AuthContext';

export default function ReportsScreen() {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Dados processados
  const [totalSpent, setTotalSpent] = useState(0);
  const [byPerson, setByPerson] = useState<any[]>([]);
  const [byCategory, setByCategory] = useState<any[]>([]);

  // Buscar e Processar Dados
  const fetchReportData = async () => {
    if (!user) return;
    
    try {
      const q = query(collection(db, "transactions"), where("userId", "==", user.uid));
      const querySnapshot = await getDocs(q);
      const transactions = querySnapshot.docs.map(doc => doc.data());

      // 1. Calcular Total Geral
      const total = transactions.reduce((acc, curr) => acc + curr.amount, 0);
      setTotalSpent(total);

      // 2. Agrupar por PESSOA
      const peopleMap: any = {};
      transactions.forEach((t: any) => {
        const name = t.personName || 'Desconhecido';
        if (!peopleMap[name]) peopleMap[name] = 0;
        peopleMap[name] += t.amount;
      });
      
      const peopleArray = Object.keys(peopleMap).map(key => ({
        name: key,
        total: peopleMap[key],
        percent: total > 0 ? (peopleMap[key] / total) * 100 : 0
      })).sort((a, b) => b.total - a.total);
      
      setByPerson(peopleArray);

      // 3. Agrupar por CATEGORIA
      const categoryMap: any = {};
      transactions.forEach((t: any) => {
        const cat = t.category || 'Outros';
        if (!categoryMap[cat]) categoryMap[cat] = 0;
        categoryMap[cat] += t.amount;
      });

      const categoryArray = Object.keys(categoryMap).map(key => ({
        name: key,
        total: categoryMap[key],
        percent: total > 0 ? (categoryMap[key] / total) * 100 : 0
      })).sort((a, b) => b.total - a.total);

      setByCategory(categoryArray);

    } catch (error) {
      console.log("Erro ao gerar relatório:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchReportData();
  };

  // Componente de Barra de Progresso (Dark Mode)
  const ChartBar = ({ label, value, percent, color }: any) => (
    <View style={styles.chartItem}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartLabel}>{label}</Text>
        <Text style={styles.chartValue}>R$ {value.toFixed(2)}</Text>
      </View>
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${percent}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.percentText}>{percent.toFixed(1)}%</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header Limpo (Sem Box) */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Relatório Geral 📊</Text>
        <Text style={styles.totalValue}>
          {totalSpent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </Text>
        <Text style={styles.totalLabel}>gasto total acumulado</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 50 }} />
      ) : (
        <ScrollView 
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFF" />}
        >
          
          {/* SEÇÃO 1: PESSOAS */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                <Ionicons name="people" size={20} color="#3B82F6" />
              </View>
              <Text style={styles.sectionTitle}>Quem gastou mais?</Text>
            </View>
            
            {byPerson.length === 0 ? (
              <Text style={styles.emptyText}>Sem dados ainda.</Text>
            ) : (
              byPerson.map((item, index) => (
                <ChartBar 
                  key={index} 
                  label={item.name} 
                  value={item.total} 
                  percent={item.percent} 
                  color="#3B82F6" 
                />
              ))
            )}
          </View>

          {/* SEÇÃO 2: CATEGORIAS */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                <Ionicons name="pie-chart" size={20} color="#F59E0B" />
              </View>
              <Text style={styles.sectionTitle}>Por Categoria</Text>
            </View>

            {byCategory.length === 0 ? (
              <Text style={styles.emptyText}>Sem dados ainda.</Text>
            ) : (
              byCategory.map((item, index) => (
                <ChartBar 
                  key={index} 
                  label={item.name} 
                  value={item.total} 
                  percent={item.percent} 
                  color={index === 0 ? "#EF4444" : "#F59E0B"} // Maior gasto em Vermelho
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
  
  // Header Limpo (Seamless)
  header: { 
    backgroundColor: '#0f172a', // Mesma cor do fundo
    paddingVertical: 20, paddingHorizontal: 20, paddingTop: 70,
    alignItems: 'center',
    marginBottom: 10
  },
  headerTitle: { color: 'rgba(255,255,255,0.8)', fontSize: 16, fontWeight: '600', marginBottom: 5 },
  totalValue: { color: '#FFF', fontSize: 36, fontWeight: '800' },
  totalLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },

  // Seções (Cards Dark)
  section: { 
    backgroundColor: '#1e293b', 
    marginHorizontal: 20, marginBottom: 20, padding: 20, 
    borderRadius: 20,
    borderWidth: 1, borderColor: '#334155'
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#FFF', marginLeft: 12 },
  
  iconBox: {
    width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center'
  },

  // Estilos do Gráfico
  chartItem: { marginBottom: 16 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  chartLabel: { fontSize: 15, fontWeight: '600', color: '#cbd5e1' },
  chartValue: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  
  progressBarBg: { height: 8, backgroundColor: '#0f172a', borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: '#334155' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  
  percentText: { fontSize: 11, color: '#94a3b8', marginTop: 4, textAlign: 'right' },
  emptyText: { textAlign: 'center', color: '#64748b', padding: 10 }
});