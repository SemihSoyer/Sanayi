import React, { useState, useEffect, useRef } from 'react';
import { Alert, StyleSheet, View, AppState, Text, TouchableOpacity, Animated, Easing, Image, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { Button, Input, Icon } from '@rneui/themed';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

// AppState listener (Global olduğu için App.tsx'e taşınabilir, şimdilik burada bırakıyorum.)
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

const screenHeight = Dimensions.get('window').height;

type AuthStackParamList = {
  CustomerAuth: undefined;
  BusinessAuth: undefined;
  App: undefined;
};

export default function CustomerAuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<StackNavigationProp<AuthStackParamList>>();
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    ).start();
  }, [spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  async function signInWithEmail() {
    setLoading(true);
    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });
    setLoading(false);
    if (error) Alert.alert('Giriş Hatası', error.message);
    // Yönlendirme App.tsx'deki onAuthStateChange ile yönetiliyor
    // Rol kontrolü de App.tsx'de yapılabilir veya burada bırakılabilir.
    // Şimdilik App.tsx'e güveniyoruz.
  }

  async function handleSignUp() {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: { role: 'customer' },
      },
    });
    setLoading(false);
    if (error) Alert.alert('Kayıt Hatası', error.message);
    else if (data.user && !data.session) {
      Alert.alert('Kayıt Başarılı', 'Lütfen e-postanızı kontrol ederek hesabınızı doğrulayın!');
    }
    // Başarılı kayıt ve giriş sonrası yönlendirme App.tsx'de onAuthStateChange ile hallolur.
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.keyboardAvoidingContainer}
    >
      <View style={styles.container}>
        <Animated.Image
          source={require('../assets/anahtar.png')} // Anahtar ikonu
          style={[styles.wrenchIcon, { transform: [{ rotate: spin }] }]}
        />
        <Text style={styles.title}>Müşteri Platformu</Text>
        <Text style={styles.subtitle}>Hesabınıza giriş yapın veya yeni hesap oluşturun.</Text>

        <Input
          placeholder="ornek@adres.com"
          leftIcon={<Icon name="envelope" type="font-awesome" color="#888" size={20} />}
          onChangeText={setEmail}
          value={email}
          autoCapitalize="none"
          inputContainerStyle={styles.inputContainer}
          inputStyle={styles.inputText}
          keyboardType="email-address"
        />
        <Input
          placeholder="Şifre"
          leftIcon={<Icon name="lock" type="font-awesome" color="#888" size={24} />}
          onChangeText={setPassword}
          value={password}
          secureTextEntry
          autoCapitalize="none"
          inputContainerStyle={styles.inputContainer}
          inputStyle={styles.inputText}
        />

        <Button
          title={loading ? "İşlem Sürüyor..." : "Giriş Yap"}
          disabled={loading}
          onPress={signInWithEmail}
          buttonStyle={styles.mainButton}
          titleStyle={styles.buttonTitle}
          containerStyle={styles.buttonContainer}
        />
        <Button
          title={loading ? "..." : "Yeni Müşteri Hesabı Oluştur"}
          disabled={loading}
          onPress={handleSignUp}
          type="outline"
          buttonStyle={styles.outlineButton}
          titleStyle={styles.outlineButtonTitle}
          containerStyle={styles.buttonContainer}
        />

        <TouchableOpacity onPress={() => navigation.navigate('BusinessAuth')} style={styles.switchButton}>
          <Text style={styles.switchButtonText}>İş Yeri Sahibi misiniz? Buradan Giriş Yapın</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 25,
    backgroundColor: '#F0F2F5', // Açık gri arka plan
  },
  wrenchIcon: {
    width: 80,
    height: 80,
    marginBottom: 30,
    resizeMode: 'contain',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 35,
    textAlign: 'center',
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderBottomWidth: 0, // Alt çizgiyi kaldır
    paddingHorizontal: 10,
    marginVertical: 8, // Inputlar arası boşluk
    elevation: 2, // Hafif gölge (Android)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2, // Hafif gölge (iOS)
  },
  inputText: {
    fontSize: 16,
    color: '#333',
  },
  buttonContainer: {
    width: '100%',
    marginTop: 12,
  },
  mainButton: {
    backgroundColor: '#0066CC', // Ana mavi renk
    paddingVertical: 14,
    borderRadius: 10,
  },
  outlineButton: {
    borderColor: '#0066CC',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5, 
  },
  buttonTitle: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  outlineButtonTitle: {
    color: '#0066CC',
    fontWeight: 'bold',
    fontSize: 16,
  },
  switchButton: {
    marginTop: 30,
    padding: 10,
  },
  switchButtonText: {
    color: '#0066CC',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});
