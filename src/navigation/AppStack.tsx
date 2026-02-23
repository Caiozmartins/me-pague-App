import React from 'react';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PeopleStackParamList } from './types';

// ✅ ajuste os caminhos conforme seu projeto:
import DashboardScreen from '../screens/Dashboard/DashboardScreen';
import PeopleListScreen from '../screens/People/PeopleListScreen';
import PersonDetailScreen from '../screens/People/PersonDetailScreen';
import CardsScreen from '../screens/Cards/CardsScreen';
import ReportsScreen from '../screens/Reports/ReportsScreen';

const Tab = createBottomTabNavigator();
const PeopleStack = createNativeStackNavigator<PeopleStackParamList>();

function PeopleStackNavigator() {
  return (
    <PeopleStack.Navigator screenOptions={{ headerShown: false }}>
      <PeopleStack.Screen name="PeopleList" component={PeopleListScreen} />
      <PeopleStack.Screen name="PersonDetail" component={PersonDetailScreen} />
    </PeopleStack.Navigator>
  );
}

export default function AppStack() {
  const insets = useSafeAreaInsets();
  const BASE_TAB_HEIGHT = Platform.OS === 'ios' ? 56 : 60;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          backgroundColor: '#0f172a',
          borderTopColor: '#334155',
          borderTopWidth: 1,
          height: BASE_TAB_HEIGHT + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 12 },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'alert';

          switch (route.name) {
            case 'Dashboard':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Pessoas':
              iconName = focused ? 'people' : 'people-outline';
              break;
            case 'Cartões':
              iconName = focused ? 'card' : 'card-outline';
              break;
            case 'Relatórios':
              iconName = focused ? 'bar-chart' : 'bar-chart-outline';
              break;
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Pessoas" component={PeopleStackNavigator} />
      <Tab.Screen name="Cartões" component={CardsScreen} />
      <Tab.Screen name="Relatórios" component={ReportsScreen} />
    </Tab.Navigator>
  );
}
