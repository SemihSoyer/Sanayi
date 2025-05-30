import { useState, useEffect } from 'react';
import 'react-native-url-polyfill/auto';
import { supabase } from './lib/supabase';
import CustomerAuthScreen from './components/Auth'; // Auth -> CustomerAuthScreen olarak yeniden adlandırıldı (import'ta)
import BusinessAuthScreen from './components/BusinessAuthScreen'; // Yeni BusinessAuthScreen import edildi
import HomeScreen from './screens/HomeScreen';
import MapScreen from './screens/MapScreen'; // MapScreen import edildi
import ProfileScreen from './screens/ProfileScreen';
import BusinessDashboardScreen from './screens/BusinessDashboardScreen';
import MyBusinessScreen from './screens/MyBusinessScreen'; // İşyerim ekranını import et
import BusinessDetailScreen from './screens/BusinessDetailScreen'; // Yeni eklendi
import SettingsScreen from './screens/SettingsScreen'; // Yeni eklendi
import ContactUsScreen from './screens/ContactUsScreen'; // Yeni eklendi
import PrivacyPolicyScreen from './screens/PrivacyPolicyScreen'; // Yeni eklendi
import TermsOfServiceScreen from './screens/TermsOfServiceScreen'; // Yeni eklendi
import AppointmentListScreen from './screens/AppointmentListScreen'; // Randevu Listesi
import CreateAppointmentScreen from './screens/CreateAppointmentScreen'; // Randevu Oluştur
import AppointmentDetailScreen from './screens/AppointmentDetailScreen'; // Randevu Detay
import BusinessAvailabilityScreen from './screens/BusinessAvailabilityScreen'; // İşletme Müsaitlik Takvimi
import { GestureHandlerRootView } from 'react-native-gesture-handler'; // Yeni eklendi
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Icon } from '@rneui/themed'; // Icon import edildi
import { createStackNavigator } from '@react-navigation/stack';
import { Session } from '@supabase/supabase-js';
import { View, ActivityIndicator, StyleSheet } from 'react-native'; // ActivityIndicator ve StyleSheet eklendi

// Stack Navigator için Param Listesi (Auth ekranları ve Ana Uygulama)
export type RootStackParamList = {
  CustomerAuth: undefined;
  BusinessAuth: undefined;
  App: { session: Session; userProfile: UserProfile | null }; // App ekranına parametreler
  BusinessDetail: { businessId: string }; // businessOwnerId -> businessId olarak değiştirildi
  Settings: undefined; // Yeni eklendi
  ContactUs: undefined; // Yeni eklendi
  PrivacyPolicy: undefined; // Yeni eklendi
  TermsOfService: undefined; // Yeni eklendi
  AppointmentList: undefined; // Randevu Listesi
  CreateAppointment: { preSelectedBusinessId?: string }; // Randevu Oluştur - önceden seçili işletme ID'si
  AppointmentDetail: { appointmentId: string }; // Randevu Detay
  BusinessAvailability: undefined; // İşletme Müsaitlik Takvimi
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

// Yeni screenOptions
const commonScreenOptions = {
  tabBarActiveTintColor: '#007AFF', // Canlı mavi
  tabBarInactiveTintColor: '#8E8E93', // Soluk gri
  tabBarStyle: {
    backgroundColor: '#FFFFFF', // Beyaz arka plan
    borderTopColor: '#E0E0E0', // Hafif bir üst çizgi
    borderTopWidth: 0.5,
    // height: 60, // Gerekirse yükseklik ayarlanabilir
    // paddingBottom: 5, // iOS'ta safe area için gerekirse
  },
  tabBarShowLabel: true, // Etiketler görünsün
  tabBarLabelStyle: {
    fontSize: 10,
    fontWeight: '500' as '500', // fontWeight için tip zorlaması
  },
  headerShown: false,
};

function AppTabs({ route }: { route: { params: { session: Session; userProfile: UserProfile | null } } }) {
  const { session, userProfile } = route.params;

  // İkonlar için ortak stil ve animasyon mantığı
  const getTabBarIcon = (routeName: string, focused: boolean, color: string, size: number) => {
    let iconName = '';
    const iconSize = focused ? size * 1.15 : size; // Aktif ikon biraz daha büyük
    const iconColor = focused ? commonScreenOptions.tabBarActiveTintColor : commonScreenOptions.tabBarInactiveTintColor;

    if (routeName === 'İşletme Paneli') {
      iconName = 'view-dashboard';
    } else if (routeName === 'İşyerim') {
      iconName = 'store';
    } else if (routeName === 'Profil') {
      iconName = 'account-circle'; // Daha dolgun bir profil ikonu
    } else if (routeName === 'Ana Sayfa') {
      iconName = 'home-variant'; // Farklı bir ana sayfa ikonu
    } else if (routeName === 'Harita') {
      iconName = 'map-marker-radius'; // Farklı bir harita ikonu
    } else if (routeName === 'Randevularım' || routeName === 'Randevular') {
      iconName = 'calendar-clock'; // Randevu ikonu
    }

          return <Icon name={iconName} type="material-community" color={iconColor} size={iconSize} />;
  };

  if (userProfile?.role === 'business_owner') {
    return (
      <Tab.Navigator screenOptions={commonScreenOptions}>
        <Tab.Screen 
          name="İşletme Paneli" 
          component={BusinessDashboardScreen} 
          options={{
            tabBarIcon: ({ focused, color, size }) => getTabBarIcon("İşletme Paneli", focused, color, size),
          }}
        />
        <Tab.Screen 
          name="Randevular" 
          component={AppointmentListScreen} 
          options={{
            tabBarIcon: ({ focused, color, size }) => getTabBarIcon("Randevular", focused, color, size),
          }}
        />
        <Tab.Screen 
          name="İşyerim" 
          component={MyBusinessScreen} 
          options={{
            tabBarIcon: ({ focused, color, size }) => getTabBarIcon("İşyerim", focused, color, size),
          }}
        />
        <Tab.Screen 
          name="Profil"
          options={{
            tabBarIcon: ({ focused, color, size }) => getTabBarIcon("Profil", focused, color, size),
          }}
        >
          {(props) => <ProfileScreen {...props} session={session} key={session.user.id} />}
        </Tab.Screen>
      </Tab.Navigator>
    );
  }

  return (
    <Tab.Navigator screenOptions={commonScreenOptions}>
      <Tab.Screen 
        name="Ana Sayfa" 
        component={HomeScreen} 
        options={{
            tabBarIcon: ({ focused, color, size }) => getTabBarIcon("Ana Sayfa", focused, color, size),
        }}
      />
      <Tab.Screen 
        name="Harita" 
        component={MapScreen} 
        options={{
            tabBarIcon: ({ focused, color, size }) => getTabBarIcon("Harita", focused, color, size),
        }}
      />
      <Tab.Screen 
        name="Randevularım" 
        component={AppointmentListScreen} 
        options={{
            tabBarIcon: ({ focused, color, size }) => getTabBarIcon("Randevularım", focused, color, size),
        }}
      />
      <Tab.Screen 
        name="Profil" 
        options={{
            tabBarIcon: ({ focused, color, size }) => getTabBarIcon("Profil", focused, color, size),
        }}
      >
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
        <ActivityIndicator size="large" color="#0066CC" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {session && session.user && userProfile ? (
          <>
            <Stack.Screen 
              name="App" 
              component={AppTabs} 
              initialParams={{ session: session, userProfile: userProfile }} 
            />
            <Stack.Screen 
              name="BusinessDetail" 
              component={BusinessDetailScreen} 
              options={{ headerShown: true, title: 'İşletme Detayları' }} // Başlık eklendi
            />
            <Stack.Screen
                name="Settings"
                component={SettingsScreen}
                options={{ headerShown: true, title: 'Ayarlar' }}
            />
            <Stack.Screen
                name="ContactUs"
                component={ContactUsScreen}
                options={{ headerShown: true, title: 'Bize Ulaşın' }}
            />
            <Stack.Screen
                name="PrivacyPolicy"
                component={PrivacyPolicyScreen}
                options={{ headerShown: true, title: 'Gizlilik Politikası' }}
            />
            <Stack.Screen
                name="TermsOfService"
                component={TermsOfServiceScreen}
                options={{ headerShown: true, title: 'Hizmet Koşulları' }}
            />
            <Stack.Screen
                name="AppointmentList"
                component={AppointmentListScreen}
                options={{ headerShown: true, title: 'Randevular' }}
            />
            <Stack.Screen
                name="CreateAppointment"
                component={CreateAppointmentScreen}
                options={{ headerShown: true, title: 'Yeni Randevu' }}
            />
            <Stack.Screen
                name="AppointmentDetail"
                component={AppointmentDetailScreen}
                options={{ headerShown: true, title: 'Randevu Detayı' }}
            />
            <Stack.Screen
                name="BusinessAvailability"
                component={BusinessAvailabilityScreen}
                options={{ headerShown: true, title: 'Müsaitlik Takvimi' }}
            />
          </>
        ) : (
          // Giriş yapılmamışsa Auth ekranlarını göster
          <>
            <Stack.Screen name="CustomerAuth" component={CustomerAuthScreen} />
            <Stack.Screen name="BusinessAuth" component={BusinessAuthScreen} />
          </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f2f5', // Daha nötr bir açık gri
  },
});
