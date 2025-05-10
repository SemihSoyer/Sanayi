import { useState, useEffect } from 'react';
import 'react-native-url-polyfill/auto';
import { supabase } from './lib/supabase';
import CustomerAuthScreen from './components/Auth'; // Auth -> CustomerAuthScreen olarak yeniden adlandırıldı (import'ta)
import BusinessAuthScreen from './components/BusinessAuthScreen'; // Yeni BusinessAuthScreen import edildi
import HomeScreen from './screens/HomeScreen';
import ProfileScreen from './screens/ProfileScreen';
import BusinessDashboardScreen from './screens/BusinessDashboardScreen';
import MyBusinessScreen from './screens/MyBusinessScreen'; // İşyerim ekranını import et
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Session } from '@supabase/supabase-js';
import { View, ActivityIndicator, StyleSheet } from 'react-native'; // ActivityIndicator ve StyleSheet eklendi

// Stack Navigator için Param Listesi (Auth ekranları ve Ana Uygulama)
export type RootStackParamList = {
  CustomerAuth: undefined;
  BusinessAuth: undefined;
  App: { session: Session; userProfile: UserProfile | null }; // App ekranına parametreler
};

// Kullanıcı profili için bir arayüz tanımlayalım
interface UserProfile {
  id: string;
  username?: string;
  website?: string;
  avatar_url?: string;
  role?: 'customer' | 'business_owner' | null;
}

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator<RootStackParamList>(); // Stack navigator'ı tiple

// AppTabs şimdi userProfile bilgisini de alabilir
function AppTabs({ route }: { route: { params: { session: Session; userProfile: UserProfile | null } } }) {
  const { session, userProfile } = route.params;
  if (userProfile?.role === 'business_owner') {
    return (
      <Tab.Navigator>
        <Tab.Screen name="İşletme Paneli" component={BusinessDashboardScreen} />
        <Tab.Screen name="İşyerim" component={MyBusinessScreen} />
        <Tab.Screen name="Profil">
          {(props) => <ProfileScreen {...props} session={session} key={session.user.id} />}
        </Tab.Screen>
      </Tab.Navigator>
    );
  }

  // Varsayılan olarak veya rol 'customer' ise müşteri sekmelerini göster (değişiklik yok)
  return (
    <Tab.Navigator>
      <Tab.Screen name="Ana Sayfa" component={HomeScreen} />
      <Tab.Screen name="Profil">
        {(props) => <ProfileScreen {...props} session={session} key={session.user.id} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false); // Profil yüklemesi session yüklendikten sonra başlar

  useEffect(() => {
    const fetchInitialSession = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      setLoadingSession(false);
      if (currentSession) {
        fetchUserProfile(currentSession.user.id);
      }
    };

    fetchInitialSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      setSession(currentSession);
      if (currentSession) {
        fetchUserProfile(currentSession.user.id);
      } else {
        setUserProfile(null); // Session yoksa profili de temizle
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const fetchUserProfile = async (userId: string) => {
    setLoadingProfile(true);
    try {
      const { data, error, status } = await supabase
        .from('profiles')
        .select(`id, username, website, avatar_url, role`)
        .eq('id', userId)
        .single();

      if (error && status !== 406) {
        throw error;
      }

      if (data) {
        setUserProfile(data as UserProfile);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      // Alert.alert('Error', 'Could not fetch user profile.'); // Kullanıcıya hata gösterilebilir
    } finally {
      setLoadingProfile(false);
    }
  };

  if (loadingSession || (session && loadingProfile)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session && session.user && userProfile ? (
          <Stack.Screen 
            name="App" 
            component={AppTabs} 
            initialParams={{ session: session, userProfile: userProfile }} 
          />
        ) : (
          // Giriş yapılmamışsa Auth ekranlarını göster
          <>
            <Stack.Screen name="CustomerAuth" component={CustomerAuthScreen} />
            <Stack.Screen name="BusinessAuth" component={BusinessAuthScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f4f7', // Auth ekranlarıyla uyumlu arka plan
  },
});
