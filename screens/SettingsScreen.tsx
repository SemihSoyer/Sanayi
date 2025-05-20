import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';

const SettingsScreen = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Ayarlar</Text>
        <Text style={styles.placeholderText}>
          Uygulama ayarları (bildirimler, tema vb.) burada yer alacaktır.
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F4F8', // Genel bir arka plan rengi
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  placeholderText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

export default SettingsScreen; 