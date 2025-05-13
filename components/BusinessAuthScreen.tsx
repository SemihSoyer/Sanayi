import React, { useState } from 'react';
import { Alert, StyleSheet, View, AppState, TouchableOpacity, Text } from 'react-native';
import { supabase } from '../lib/supabase';
import { Button, Input } from '@rneui/themed';
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
if (!AppState.isAvailable) { // Test ortamlarında AppState olmayabilir, kontrol ekleyelim.
    AppState.addEventListener('change', (state) => {
        if (state === 'active') {
        supabase.auth.startAutoRefresh();
        } else {
        supabase.auth.stopAutoRefresh();
        }
    });
}


export default function BusinessAuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<StackNavigationProp<AuthStackParamList>>();

  async function signInWithEmail() {
    setLoading(true);
    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      Alert.alert('Giriş Hatası', error.message);
      setLoading(false);
      return;
    }

    if (signInData && signInData.user) {
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', signInData.user.id)
          .single();

        if (profileError || !profileData) {
          Alert.alert('Giriş Hatası', 'Kullanıcı profili bulunamadı veya bir hata oluştu.');
          await supabase.auth.signOut(); 
        } else if (profileData.role !== 'business_owner') {
          Alert.alert('Giriş İzni Yok', 'Bu hesap bir işyeri sahibi hesabı değildir. Lütfen müşteri girişini kullanın.');
          await supabase.auth.signOut(); 
        }
        // Rol 'business_owner' ise, App.tsx'deki onAuthStateChange yönlendirmeyi yapar.
      } catch (e) {
        Alert.alert('Profil Kontrol Hatası', e instanceof Error ? e.message : 'Bilinmeyen bir hata oluştu.');
        await supabase.auth.signOut();
      }
    }
    setLoading(false);
  }

  async function handleSignUpBusiness() {
    setLoading(true);
    if (!email || !password) {
      Alert.alert('Hata', 'E-posta ve şifre boş bırakılamaz.');
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          role: 'business_owner',
        }
      }
    });

    setLoading(false);
    if (error) {
      Alert.alert('Kayıt Hatası', error.message);
    } else if (data.user && !data.session) {
      Alert.alert('Kayıt Başarılı', 'Lütfen e-posta adresinize gelen doğrulama linkine tıklayın!');
    } else if (data.user && data.session) {
      // Başarılı kayıt ve giriş App.tsx'deki onAuthStateChange ile yönetilecek
      // Alert.alert('Kayıt Başarılı', 'Başarıyla kaydoldunuz ve giriş yaptınız!');
    } else {
      Alert.alert('Bilgi', 'Kayıt işlemi başlatıldı. Gerekirse e-posta doğrulaması yapın.');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>İşyeri Sahibi Girişi</Text>
      <View style={styles.inputGroup}>
        <Input
          label="E-posta Adresiniz"
          leftIcon={{ type: 'font-awesome', name: 'envelope', color: '#888' }}
          onChangeText={(text) => setEmail(text)}
          value={email}
          placeholder="isyeri@adres.com"
          autoCapitalize={'none'}
          inputContainerStyle={styles.inputContainer}
          labelStyle={styles.label}
        />
      </View>
      <View style={styles.inputGroup}>
        <Input
          label="Şifreniz"
          leftIcon={{ type: 'font-awesome', name: 'lock', color: '#888' }}
          onChangeText={(text) => setPassword(text)}
          value={password}
          secureTextEntry={true}
          placeholder="Şifre"
          autoCapitalize={'none'}
          inputContainerStyle={styles.inputContainer}
          labelStyle={styles.label}
        />
      </View>
      <Button
        title="İşyeri Giriş Yap"
        disabled={loading}
        onPress={signInWithEmail}
        buttonStyle={[styles.button, styles.signInButton]}
        containerStyle={styles.buttonContainer}
        titleStyle={styles.buttonTitle}
      />
      <Button
        title="İşyeri Olarak Kaydol"
        disabled={loading}
        onPress={handleSignUpBusiness}
        buttonStyle={[styles.button, styles.signUpButton]}
        containerStyle={styles.buttonContainer}
        titleStyle={styles.buttonTitle}
      />
      <TouchableOpacity style={styles.switchAuthContainer} onPress={() => navigation.navigate('CustomerAuth')}>
        <Text style={styles.switchAuthText}>Müşteri misiniz? Müşteri Giriş Ekranı</Text>
      </TouchableOpacity>
    </View>
  );
}

// Stiller Auth.tsx (CustomerAuthScreen) ile büyük ölçüde aynı olabilir,
// Gerekirse özelleştirilebilir.
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 25,
    backgroundColor: '#f0f2f5', // App.tsx ve Auth.tsx ile uyumlu açık gri
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 30,
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    color: '#555',
    marginBottom: 5,
  },
  inputContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderBottomWidth: 0,
    paddingHorizontal: 10,
  },
  buttonContainer: {
    marginTop: 15,
    borderRadius: 10,
  },
  button: {
    paddingVertical: 12,
    borderRadius: 10,
  },
  signInButton: {
    backgroundColor: '#0066CC', // Yeni birincil mavi
  },
  signUpButton: {
    backgroundColor: '#0066CC', // Yeni birincil mavi (Ana CTA)
  },
  buttonTitle: {
    fontWeight: 'bold',
  },
  switchAuthContainer: {
    marginTop: 30,
    alignItems: 'center',
  },
  switchAuthText: {
    color: '#0066CC', // Yeni birincil mavi
    fontSize: 15,
    fontWeight: '600',
  }
});
