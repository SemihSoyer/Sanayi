import React, { useState } from 'react'
import { Alert, StyleSheet, View, AppState } from 'react-native'
import { supabase } from '../lib/supabase'
import { Button, Input } from '@rneui/themed'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'

import { Text, TouchableOpacity } from 'react-native'; // TouchableOpacity eklendi

// Define the type for the navigation stack
type AuthStackParamList = {
  CustomerAuth: undefined; // Bu ekran (önceden Auth idi)
  BusinessAuth: undefined; // İşyeri kimlik doğrulama ekranı
  App: undefined; // Ana uygulama (tablar)
};

// Tells Supabase Auth to continuously refresh the session automatically if
// the app is in the foreground. When this is added, you will continue to receive
// `onAuthStateChange` events with the `TOKEN_REFRESHED` or `SIGNED_OUT` event
// if the user's session is terminated. This should only be registered once.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh()
  } else {
    supabase.auth.stopAutoRefresh()
  }
})

export default function Auth() { // Bu component artık CustomerAuthScreen gibi davranacak
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
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
          await supabase.auth.signOut(); // Profili olmayan veya hata olan kullanıcıyı çıkar
        } else if (profileData.role !== 'customer') {
          Alert.alert('Giriş İzni Yok', 'Bu hesap bir müşteri hesabı değildir. Lütfen işyeri sahibi girişini kullanın.');
          await supabase.auth.signOut(); // Rolü uymayan kullanıcıyı çıkar
        }
        // Rol 'customer' ise veya bir sorun yoksa, App.tsx'deki onAuthStateChange yönlendirmeyi yapar.
      } catch (e) {
        Alert.alert('Profil Kontrol Hatası', e instanceof Error ? e.message : 'Bilinmeyen bir hata oluştu.');
        await supabase.auth.signOut();
      }
    }
    setLoading(false);
  }

  async function handleSignUp(role: 'customer' | 'business_owner') {
    setLoading(true)
    if (!email || !password) {
      Alert.alert('Error', 'Email and password cannot be empty.');
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          role: role,
          // full_name: Eğer kayıt sırasında tam ad alıyorsanız buraya ekleyin
        }
      }
    })

    setLoading(false);

    if (error) {
      Alert.alert('Sign Up Error', error.message);
    } else if (data.user && !data.session) {
      // This case means email confirmation is likely required
      Alert.alert('Registration Successful', 'Please check your inbox for email verification!');
    } else if (data.user && data.session) {
      // User is signed up and a session is active (email confirmation might be off or auto-confirmed)
      // Navigation is handled by onAuthStateChange in App.tsx
      // Alert.alert('Registration Successful', 'You are now signed up and logged in!');
    } else {
      // Fallback for unexpected response structure though Supabase types should prevent this
      Alert.alert('Sign Up Info', 'Sign up process initiated. Please check for a verification email if required.');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Müşteri Girişi</Text>
      <View style={styles.inputGroup}>
        <Input
          label="E-posta Adresiniz"
          leftIcon={{ type: 'font-awesome', name: 'envelope', color: '#888' }}
          onChangeText={(text) => setEmail(text)}
          value={email}
          placeholder="ornek@adres.com"
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
        title="Müşteri Giriş Yap"
        disabled={loading}
        onPress={() => signInWithEmail()}
        buttonStyle={[styles.button, styles.signInButton]}
        containerStyle={styles.buttonContainer}
        titleStyle={styles.buttonTitle}
      />
      <Button
        title="Müşteri Olarak Kaydol"
        disabled={loading}
        onPress={() => handleSignUp('customer')}
        buttonStyle={[styles.button, styles.signUpButton]}
        containerStyle={styles.buttonContainer}
        titleStyle={styles.buttonTitle}
      />
      <TouchableOpacity style={styles.switchAuthContainer} onPress={() => navigation.navigate('BusinessAuth')}>
        <Text style={styles.switchAuthText}>İşyeri Sahibi misiniz? Giriş Yapın veya Kaydolun</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 25,
    backgroundColor: '#f0f2f5', // App.tsx ile uyumlu açık gri
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
    backgroundColor: '#28a745', // Yeşil renk
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
})
