// src/screens/Auth/LoginScreen.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../config/firebaseConfig';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false); // Alternar entre Login e Cadastro

  async function handleAuth() {
    if (!email || !password) return Alert.alert('Erro', 'Preencha todos os campos');
    setLoading(true);

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
        Alert.alert('Sucesso', 'Conta criada! Bem-vindo.');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        // O AuthContext vai detectar o login automaticamente
      }
    } catch (error: any) {
      console.log(error);
      let msg = 'Ocorreu um erro.';
      if (error.code === 'auth/invalid-email') msg = 'E-mail inválido.';
      if (error.code === 'auth/user-not-found') msg = 'Usuário não encontrado.';
      if (error.code === 'auth/wrong-password') msg = 'Senha incorreta.';
      if (error.code === 'auth/email-already-in-use') msg = 'E-mail já cadastrado.';
      Alert.alert('Atenção', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isSignUp ? 'Criar Conta' : 'Controle Financeiro'}</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Seu e-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      
      <TextInput
        style={styles.input}
        placeholder="Sua senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleAuth}>
        {loading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.buttonText}>{isSignUp ? 'Cadastrar' : 'Entrar'}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)} style={styles.linkButton}>
        <Text style={styles.linkText}>
          {isSignUp ? 'Já tem conta? Faça login' : 'Não tem conta? Crie uma'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 30, textAlign: 'center', color: '#333' },
  input: { backgroundColor: '#FFF', padding: 15, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#ddd' },
  button: { backgroundColor: '#007AFF', padding: 15, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  linkButton: { marginTop: 20, alignItems: 'center' },
  linkText: { color: '#007AFF' },
});