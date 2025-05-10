import { useState, useEffect } from 'react';
import 'react-native-url-polyfill/auto';
import { supabase } from './lib/supabase';
import Auth from './components/Auth';
import HomeScreen from './screens/HomeScreen';
import ProfileScreen from './screens/ProfileScreen';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Session } from '@supabase/supabase-js';
import { View } from 'react-native'; // Keep this for the root view if needed, or remove if NavigationContainer handles it all

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function AppTabs({ session }: { session: Session }) {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Ana Sayfa" component={HomeScreen} />
      <Tab.Screen name="Profil">
        {(props) => <ProfileScreen {...props} session={session} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setLoading(false);
    };

    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  if (loading) {
    return null; // Or a loading spinner
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session && session.user ? (
          <Stack.Screen name="App">
            {(props) => <AppTabs {...props} session={session} />}
          </Stack.Screen>
        ) : (
          <Stack.Screen name="Auth" component={Auth} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
