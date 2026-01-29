import PWAInstallPrompt from './src/components/PWAInstallPrompt';
import 'react-native-gesture-handler';
import 'react-native-get-random-values';

import React, { useContext, useEffect, useState, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
// Removemos o import do LocalAuthentication
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';

import { AuthProvider, AuthContext } from './src/contexts/AuthContext';
import LoginScreen from './src/screens/Auth/LoginScreen';
import AppStack from './src/navigation/AppStack';

// Mantemos a Splash Screen para não dar "flash" branco enquanto carrega
SplashScreen.preventAutoHideAsync();

function Root() {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  // Se tem utilizador logado no Firebase, vai para o App, senão para o Login
  return user ? <AppStack /> : <LoginScreen />;
}

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Carregamento simulado ou de fontes/assets
        // Isso dá um tempo para o Firebase verificar a sessão antes de mostrar o ecrã
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (e) {
        console.warn(e);
      } finally {
        // Removemos toda a lógica de Biometria aqui.
        // Assim que terminar de carregar, o app está pronto.
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
        <AuthProvider>
          <NavigationContainer>
            <Root />
          </NavigationContainer>
          
          {/* ✅ AQUI ESTÁ: O componente de instalação PWA */}
          <PWAInstallPrompt />
          
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
    backgroundColor: '#0f172a',
  },
});