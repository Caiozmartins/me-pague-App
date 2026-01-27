import 'react-native-gesture-handler';
import 'react-native-get-random-values';

import React, { useContext, useEffect, useState, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen'; // Importando a Splash Screen

// Seus imports originais que funcionam
import { AuthProvider, AuthContext } from './src/contexts/AuthContext';
import LoginScreen from './src/screens/Auth/LoginScreen';
import AppStack from './src/navigation/AppStack';

// 1. Impede que a tela de abertura suma sozinha antes da hora
SplashScreen.preventAutoHideAsync();

function Root() {
  const { user, loading } = useContext(AuthContext);

  // Loading da Autenticação (Verificando se está logado no Firebase)
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  // Se tem usuário, vai pro App (Dashboard), se não, vai pro Login
  return user ? <AppStack /> : <LoginScreen />;
}

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);

  // 2. Preparar o App (Carregar fontes, assets, ou só segurar a tela)
  useEffect(() => {
    async function prepare() {
      try {
        // Aqui você pode carregar fontes se precisar no futuro
        // await Font.loadAsync(Entypo.font);
        
        // Simulação rápida para garantir que a Splash apareça (opcional)
        await new Promise(resolve => setTimeout(resolve, 2000)); 
      } catch (e) {
        console.warn(e);
      } finally {
        // Diz para o app que está tudo pronto para renderizar
// --- INÍCIO DO BLOQUEIO BIOMÉTRICO ---
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        if (hasHardware && isEnrolled) {
          const auth = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Autenticação Biométrica',
            fallbackLabel: 'Usar senha padrão',
          });

          if (!auth.success) {
            return Alert.alert("Acesso Negado", "Você precisa se autenticar para entrar.");
          }
        }
        // --- FIM DO BLOQUEIO ---

        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  // 3. Quando a View principal carregar, esconde a Splash Screen
  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null; // Mantém a imagem nativa visível
  }

  return (
    // Essa View embrulha tudo para podermos usar o onLayout
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
        <AuthProvider>
          <NavigationContainer>
            <Root />
          </NavigationContainer>
        </AuthProvider>
      </SafeAreaProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#0f172a' // Mantém o fundo dark enquanto carrega o Auth
  }
});