import React, { useState, useEffect, useRef } from 'react';
import { Alert, StyleSheet, View, AppState, TouchableOpacity, Text, Animated, Easing, Image, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { Button, Input, Icon } from '@rneui/themed';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

// AuthStackParamList'i CustomerAuthScreen (önceki Auth.tsx) ile aynı tutuyoruz
// Bu sayede CustomerAuth ve BusinessAuth arasında geçiş yapabiliriz.
type AuthStackParamList = {
  CustomerAuth: undefined;
  BusinessAuth: undefined;
  App: undefined; 
};

// AppState listener (Auth.tsx'deki ile aynı, tekrar eklendi)
// Farklı dosyalarda olsa da, uygulama genelinde bir kez eklenmesi yeterlidir.
// Ancak component bazlı tutmak da bir yaklaşımdır.
// Eğer App.tsx gibi merkezi bir yerde yönetiliyorsa burada tekrarına gerek olmayabilir.
// Şimdilik burada bırakıyorum, çünkü bu component kendi başına da çalışabilir olmalı.
if (AppState.isAvailable) { // AppState bazen test ortamlarında kullanılamıyor
    AppState.addEventListener('change', (state) => {
        if (state === 'active') {
            supabase.auth.startAutoRefresh();
        } else {
            supabase.auth.stopAutoRefresh();
        }
    });
}

const screenHeight = Dimensions.get('window').height;

export default function BusinessAuthScreen() {
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
    // Yönlendirme ve rol kontrolü App.tsx'de
  }

  async function handleSignUpBusiness() {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: { role: 'business_owner' },
      },
    });
    setLoading(false);
    if (error) Alert.alert('Kayıt Hatası', error.message);
    else if (data.user && !data.session) {
      Alert.alert('Kayıt Başarılı', 'Lütfen e-postanızı kontrol ederek hesabınızı doğrulayın!');
    }
    // Yönlendirme App.tsx'de
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
        <Text style={styles.title}>İş Yeri Platformu</Text>
        <Text style={styles.subtitle}>İşletme hesabınıza giriş yapın veya yeni hesap oluşturun.</Text>

        <Input
          placeholder="isletme@adres.com"
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
          title={loading ? "İşlem Sürüyor..." : "İş Yeri Giriş Yap"}
          disabled={loading}
          onPress={signInWithEmail}
          buttonStyle={styles.mainButton}
          titleStyle={styles.buttonTitle}
          containerStyle={styles.buttonContainer}
        />
        <Button
          title={loading ? "..." : "Yeni İş Yeri Hesabı Oluştur"}
          disabled={loading}
          onPress={handleSignUpBusiness}
          type="outline"
          buttonStyle={styles.outlineButton}
          titleStyle={styles.outlineButtonTitle}
          containerStyle={styles.buttonContainer}
        />

        <TouchableOpacity onPress={() => navigation.navigate('CustomerAuth')} style={styles.switchButton}>
          <Text style={styles.switchButtonText}>Müşteri misiniz? Buradan Giriş Yapın</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// Stiller Auth.tsx (CustomerAuthScreen) ile büyük ölçüde aynı,
// Sadece başlık ve bazı metinler farklı.
const styles = StyleSheet.create({
  keyboardAvoidingContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 25,
    backgroundColor: '#F0F2F5',
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
    borderBottomWidth: 0,
    paddingHorizontal: 10,
    marginVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
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
    backgroundColor: '#0066CC',
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
