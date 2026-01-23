import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// O segredo está aqui: "export default"
export default function PeopleListScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Pessoas 👥</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  text: { fontSize: 20, fontWeight: 'bold' }
});