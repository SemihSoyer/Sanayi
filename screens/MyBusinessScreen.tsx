import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const MyBusinessScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>İşyerim</Text>
      <Text>İşyerinize ait bilgiler ve yönetim araçları burada yer alacak.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
});

export default MyBusinessScreen;
