import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Platform, 
  Modal, 
  Image,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function PWAInstallPrompt() {
  const [showToast, setShowToast] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Só roda na Web
    if (Platform.OS !== 'web') return;

    // 1. Detetar se é iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) || 
                       (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(isIosDevice);

    // 2. Detetar se já está instalado (Standalone)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) return; // Não mostra nada se já tiver o app instalado

    // 3. Lógica Android/Chrome (Captura o evento nativo)
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowToast(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 4. Lógica iOS (Mostra após 3 segundos)
    if (isIosDevice) {
      setTimeout(() => setShowToast(true), 3000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      // No iOS, abrimos o modal de instruções
      setShowIOSModal(true);
      setShowToast(false);
    } else {
      // No Android/PC, chamamos o prompt nativo
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setDeferredPrompt(null);
          setShowToast(false);
        }
      } else {
        alert("Para instalar, procure a opção 'Adicionar à Tela Inicial' no menu do seu navegador.");
      }
    }
  };

  if (!showToast && !showIOSModal) return null;

  return (
    <>
      {/* --- TOAST FLUTUANTE --- */}
      {showToast && (
        <View style={styles.toastContainer}>
          <View style={styles.toastContent}>
            <View style={styles.iconContainer}>
              {/* Ícone do App (substitua pelo seu require se quiser) */}
              <Ionicons name="cube-outline" size={24} color="#475569" />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.toastTitle}>Instalar App</Text>
              <Text style={styles.toastSubtitle}>Acesso rápido e offline</Text>
            </View>
          </View>
          
          <View style={styles.actionsContainer}>
            <TouchableOpacity style={styles.installButton} onPress={handleInstallClick}>
              <Text style={styles.installButtonText}>Instalar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => setShowToast(false)} style={styles.closeButton}>
              <Ionicons name="close" size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* --- MODAL IOS --- */}
      <Modal
        visible={showIOSModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowIOSModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity 
              style={styles.modalCloseIcon} 
              onPress={() => setShowIOSModal(false)}
            >
              <Ionicons name="close" size={24} color="#94a3b8" />
            </TouchableOpacity>

            <View style={styles.modalHeaderIcon}>
              <Ionicons name="logo-apple" size={32} color="#475569" />
            </View>
            
            <Text style={styles.modalTitle}>Instalar no iPhone</Text>
            <Text style={styles.modalSubtitle}>Siga os passos para adicionar à tela de início:</Text>

            <View style={styles.stepContainer}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
              <Text style={styles.stepText}>
                Toque em <Text style={{fontWeight: 'bold', color: '#3B82F6'}}>Compartilhar</Text> <Ionicons name="share-outline" size={16} />
              </Text>
            </View>

            <View style={styles.stepContainer}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
              <Text style={styles.stepText}>
                Selecione <Text style={{fontWeight: 'bold'}}>Adicionar à Tela de Início</Text>
              </Text>
            </View>

            {/* Seta indicativa para baixo (simulação visual) */}
            <View style={styles.arrowPointer} />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Toast Styles
  toastContainer: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5, // Android shadow
    maxWidth: 500,
    alignSelf: 'center', // Centralizar em telas grandes
    zIndex: 9999,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  textContainer: {
    justifyContent: 'center',
  },
  toastTitle: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#0f172a',
  },
  toastSubtitle: {
    fontSize: 12,
    color: '#64748b',
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  installButton: {
    backgroundColor: '#007bffff',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  installButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  closeButton: {
    padding: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 50,
  },

  // Modal iOS Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'flex-end', // Fica embaixo no mobile
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    position: 'relative',
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  modalCloseIcon: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  modalHeaderIcon: {
    width: 64,
    height: 64,
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 24,
    textAlign: 'center',
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    width: '100%',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  stepNumber: {
    width: 32,
    height: 32,
    backgroundColor: 'white',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  stepNumberText: {
    fontWeight: 'bold',
    color: '#334155',
  },
  stepText: {
    fontSize: 14,
    color: '#334155',
    flex: 1,
  },
  arrowPointer: {
    position: 'absolute',
    bottom: -10,
    width: 20,
    height: 20,
    backgroundColor: 'white',
    transform: [{ rotate: '45deg' }],
  },
});