import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform 
} from 'react-native';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail 
} from 'firebase/auth';
import { auth } from '../../config/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  // --- Função de Autenticação (Entrar / Cadastrar) ---
  async function handleAuth() {
    if (!email || !password) return Alert.alert('Erro', 'Preencha todos os campos');
    setLoading(true);

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
        Alert.alert('Sucesso', 'Conta criada! Bem-vindo ao Me Pague.');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      let msg = 'Ocorreu um erro ao tentar entrar.';
      if (error.code === 'auth/invalid-email') msg = 'E-mail inválido.';
      if (error.code === 'auth/user-not-found') msg = 'Usuário não encontrado.';
      if (error.code === 'auth/wrong-password') msg = 'Senha incorreta.';
      if (error.code === 'auth/email-already-in-use') msg = 'E-mail já cadastrado.';
      Alert.alert('Atenção', msg);
    } finally {
      setLoading(false);
    }
  }

  // --- Função de Recuperação de Senha ---
  async function handleForgotPassword() {
    if (!email) {
      return Alert.alert('Atenção', 'Digite seu e-mail no campo acima para receber as instruções.');
    }

    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert('E-mail enviado', 'Verifique sua caixa de entrada para redefinir sua senha.');
    } catch (error: any) {
      Alert.alert('Erro', 'Não foi possível enviar o e-mail de recuperação.');
    }
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <View style={styles.iconContainer}>
        <Ionicons name="card" size={80} color="#3B82F6" />
      </View>

      <Text style={styles.title}>Me Pague</Text>
      <Text style={styles.subtitle}>{isSignUp ? 'Crie sua conta e comece a controlar' : 'Seu controle financeiro inteligente'}</Text>
      
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Seu e-mail"
          placeholderTextColor="#64748b"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        
        <TextInput
          style={styles.input}
          placeholder="Sua senha"
          placeholderTextColor="#64748b"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {!isSignUp && (
          <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotButton}>
            <Text style={styles.forgotText}>Esqueceu sua senha?</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.button} onPress={handleAuth} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>{isSignUp ? 'CRIAR CONTA' : 'ENTRAR'}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)} style={styles.linkButton}>
          <Text style={styles.linkText}>
            {isSignUp ? 'Já tem uma conta? Entre agora' : 'Ainda não tem conta? Clique aqui'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', padding: 30 },
  iconContainer: { alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', color: '#FFF' },
  subtitle: { fontSize: 14, color: '#94a3b8', textAlign: 'center', marginBottom: 40 },
  form: { width: '100%' },
  input: { 
    backgroundColor: '#1e293b', 
    padding: 18, 
    borderRadius: 12, 
    marginBottom: 15, 
    borderWidth: 1, 
    borderColor: '#334155',
    color: '#FFF'
  },
  forgotButton: { alignSelf: 'flex-end', marginBottom: 20 },
  forgotText: { color: '#3B82F6', fontSize: 13 },
  button: { 
    backgroundColor: '#3B82F6', 
    padding: 18, 
    borderRadius: 12, 
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8
  },
  buttonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16, letterSpacing: 1 },
  linkButton: { marginTop: 25, alignItems: 'center' },
  linkText: { color: '#94a3b8', fontSize: 14 },
});