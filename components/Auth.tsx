import React, { useState } from 'react'
import { Alert, StyleSheet, View, AppState } from 'react-native'
import { supabase } from '../lib/supabase'
import { Button, Input } from '@rneui/themed'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'

// Define the type for the navigation stack
type RootStackParamList = {
  Auth: undefined; // No params for Auth screen
  App: undefined;  // No params for App (which contains tabs)
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

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  async function signInWithEmail() {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    })

    if (error) {
      Alert.alert(error.message)
    } else {
      // Navigate to App navigator which contains HomeScreen
      // navigation.replace('App'); // This will be handled by onAuthStateChange in App.tsx
    }
    setLoading(false)
  }

  async function signUpWithEmail() {
    setLoading(true)
    if (!email || !password) {
      Alert.alert('Error', 'Email and password cannot be empty.');
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
    })

    setLoading(false); // Set loading to false immediately after the call

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
      <View style={[styles.verticallySpaced, styles.mt20]}>
        <Input
          label="Email"
          leftIcon={{ type: 'font-awesome', name: 'envelope' }}
          onChangeText={(text) => setEmail(text)}
          value={email}
          placeholder="email@address.com"
          autoCapitalize={'none'}
        />
      </View>
      <View style={styles.verticallySpaced}>
        <Input
          label="Password"
          leftIcon={{ type: 'font-awesome', name: 'lock' }}
          onChangeText={(text) => setPassword(text)}
          value={password}
          secureTextEntry={true}
          placeholder="Password"
          autoCapitalize={'none'}
        />
      </View>
      <View style={[styles.verticallySpaced, styles.mt20]}>
        <Button title="Sign in" disabled={loading} onPress={() => signInWithEmail()} />
      </View>
      <View style={styles.verticallySpaced}>
        <Button title="Sign up" disabled={loading} onPress={() => signUpWithEmail()} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginTop: 40,
    padding: 12,
  },
  verticallySpaced: {
    paddingTop: 4,
    paddingBottom: 4,
    alignSelf: 'stretch',
  },
  mt20: {
    marginTop: 20,
  },
})
