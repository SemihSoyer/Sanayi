import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Linking } from 'react-native';
import { Icon } from '@rneui/themed';

const ContactUsScreen = () => {
  const handleEmailPress = () => {
    Linking.openURL('mailto:destek@example.com?subject=Destek Talebi');
  };

  const handlePhonePress = () => {
    Linking.openURL('tel:+900000000000');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Bize Ulaşın</Text>
        <Text style={styles.infoText}>
          Soru, öneri veya geri bildirimleriniz için aşağıdaki kanallardan bize ulaşabilirsiniz.
        </Text>
        
        <TouchableOpacity style={styles.contactItem} onPress={handleEmailPress}>
          <Icon name="email" type="material-community" size={24} color="#007AFF" />
          <Text style={styles.contactText}>destek@example.com</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.contactItem} onPress={handlePhonePress}>
          <Icon name="phone" type="material-community" size={24} color="#007AFF" />
          <Text style={styles.contactText}>+90 (000) 000 00 00</Text>
        </TouchableOpacity>

        {/* Sosyal medya veya diğer iletişim kanalları eklenebilir */}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F4F8',
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
  infoText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginBottom: 15,
    width: '90%',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.20,
    shadowRadius: 1.41,
    elevation: 2,
  },
  contactText: {
    fontSize: 16,
    color: '#007AFF',
    marginLeft: 15,
  },
});

export default ContactUsScreen; 