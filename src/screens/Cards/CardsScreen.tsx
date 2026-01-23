import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function CardsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Cartões 💳</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  text: { fontSize: 20, fontWeight: 'bold' }
});