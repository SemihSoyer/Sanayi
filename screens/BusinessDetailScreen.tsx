import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react'; // useLayoutEffect eklendi
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image, Dimensions, Linking, TouchableOpacity, Platform, Alert } from 'react-native'; // Alert eklendi
import { Card, Icon } from '@rneui/themed';
import MapView, { Marker } from 'react-native-maps';
import { supabase } from '../lib/supabase';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native'; // useNavigation eklendi
import { Session } from '@supabase/supabase-js'; // Session import edildi
import { StackNavigationProp } from '@react-navigation/stack'; // StackNavigationProp eklendi

// App.tsx'deki RootStackParamList'e göre güncellenecek
type RootStackParamList = {
  BusinessDetail: { businessId: string }; // businessOwnerId -> businessId olarak değiştirildi
  CreateAppointment: { preSelectedBusinessId?: string }; // Randevu Oluştur - önceden seçili işletme ID'si
  // Diğer ekranlarınız...
};

type BusinessDetailScreenRouteProp = RouteProp<RootStackParamList, 'BusinessDetail'>;
type BusinessDetailScreenNavigationProp = StackNavigationProp<RootStackParamList, 'BusinessDetail'>;

interface ServiceType {
  id: string;
  name: string;
  icon_url?: string;
}

interface OperatingHourData {
  day_of_week: number; 
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

interface Business {
  id: string;
  name: string;
  description?: string;
  address?: string;
  photos?: string[];
  is_published: boolean;
  latitude?: number | null;
  longitude?: number | null;
  city?: { name: string } | null;
  services?: Array<{ id: string; name: string; icon_url?: string; }>;
  operating_hours?: OperatingHourData[]; // YENİ EKLENDİ
  // Eğer `service_types` veya `cities` gibi alanlar varsa ve Business interface'inde farklı bir isimle tutuluyorsa
  // (örn: `business_services` yerine `services`), yukarıdaki select sorgusundaki alias'larla eşleştiğinden emin olun.
}

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

const BusinessDetailScreen = () => {
  const route = useRoute<BusinessDetailScreenRouteProp>();
  const navigation = useNavigation<BusinessDetailScreenNavigationProp>();
  const { businessId } = route.params; // businessOwnerId -> businessId

  const [business, setBusiness] = useState<Business | null>(null);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const hasLoggedForCurrentBusinessIdRef = useRef(false); // Tıklamanın bu businessId için loglanıp loglanmadığını takip eder

  // Header'ı güzelleştir
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: 'İşletme Detayları',
      headerTitleAlign: 'center',
      headerStyle: {
        backgroundColor: '#0066CC',
        elevation: 4,
        shadowOpacity: 0.3,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
      },
      headerTitleStyle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
      },
      headerTintColor: '#FFFFFF',
      headerBackTitle: '',
    });
  }, [navigation]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => { 
        setSession(currentSession);
      }
    );

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const logBusinessClick = async (currentBusinessId: string, currentUserId: string | undefined, businessOwnerId: string | undefined) => {
    console.log('[BusinessDetailScreen] logBusinessClick called. BusinessID:', currentBusinessId);
    console.log('[BusinessDetailScreen] currentUserId:', currentUserId);
    console.log('[BusinessDetailScreen] businessOwnerId (from business data):', businessOwnerId);
    console.log('[BusinessDetailScreen] hasLoggedForCurrentBusinessIdRef.current (at start):', hasLoggedForCurrentBusinessIdRef.current);

    if (hasLoggedForCurrentBusinessIdRef.current) {
      console.log('[BusinessDetailScreen] Click event already processed for this businessId instance (ref was true).');
      return;
    }

    // Bu businessId için loglama işlemini başlatıyoruz, ref'i hemen true yapalım.
    // Böylece bu fonksiyon asenkron işlemler sırasında tekrar çağrılırsa, mükerrer işlem yapılmaz.
    hasLoggedForCurrentBusinessIdRef.current = true;
    console.log('[BusinessDetailScreen] hasLoggedForCurrentBusinessIdRef.current set to true.');

    if (currentUserId && businessOwnerId && currentUserId === businessOwnerId) {
      console.log('[BusinessDetailScreen] Business owner viewed their own page. Click not logged.');
      // Ref zaten true yapıldı, işlem tamamlandı.
      return;
    }

    try {
      const clickData: { business_id: string; user_id?: string } = {
        business_id: currentBusinessId,
      };
      if (currentUserId) {
        clickData.user_id = currentUserId;
      }
      console.log('[BusinessDetailScreen] Attempting to insert click log:', clickData);
      const { error: clickError } = await supabase.from('businessclicks').insert(clickData);
      
      if (clickError) {
        console.warn('[BusinessDetailScreen] Error logging business click - Details:', JSON.stringify(clickError, null, 2));
        // Hata durumunda ref'i false yapmıyoruz ki sürekli denemesin.
        // businessId değiştiğinde zaten sıfırlanacak.
      } else {
        console.log('[BusinessDetailScreen] Business click logged successfully for business_id:', currentBusinessId);
      }
    } catch (e: any) {
      console.warn('[BusinessDetailScreen] Exception logging business click:', e);
    }
  };
  
  const fetchBusinessDetails = useCallback(async () => {
    if (!businessId) { 
      setError('İşletme kimliği bulunamadı.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select(`
          id,
          name,
          description,
          address,
          photos,
          is_published,
          latitude,
          longitude,
          city:cities(name),
          operating_hours:business_operating_hours(
            day_of_week,
            open_time,
            close_time,
            is_closed
          ),
          business_services:BusinessServices( 
            service_type:ServiceTypes(id, name, icon_url) 
          )
        `)
        .eq('id', businessId)
        .eq('is_published', true)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const processedData = {
          ...data,
          city: Array.isArray(data.city) ? data.city[0] || null : data.city,
          services: data.business_services 
            ? data.business_services.map((bs: any) => bs.service_type).filter(Boolean) 
            : [],
        };
        delete (processedData as any).business_services; 
        setBusiness(processedData as Business);
      } else {
        setBusiness(null);
        Alert.alert('Hata', 'İşletme bulunamadı veya henüz yayınlanmamış.');
        navigation.goBack();
      }
    } catch (err) {
      console.error('İşletme detayları getirilirken hata:', err);
      // Hata mesajını kullanıcıya göstermek için daha spesifik bir mesaj veya err objesini inceleyebilirsiniz.
      const  errorMessage = err instanceof Error ? err.message : 'Bilinmeyen bir hata oluştu.';
      Alert.alert('Veri Çekme Hatası', `İşletme detayları getirilemedi: ${errorMessage}`);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [businessId, navigation]);

  // businessId her değiştiğinde, bu ID için tıklama logunu sıfırla
  useEffect(() => {
    console.log(`[BusinessDetailScreen] businessId changed to: ${businessId}. Resetting hasLoggedRef.`);
    hasLoggedForCurrentBusinessIdRef.current = false;
  }, [businessId]);

  // fetchBusinessDetails'ı çağıran useEffect
  useEffect(() => {
    fetchBusinessDetails();
  }, [fetchBusinessDetails]); // fetchBusinessDetails'ın bağımlılıkları [businessId, session]


  const openMapNavigation = () => {
    if (business && business.latitude && business.longitude) {
      const scheme = Platform.select({ ios: 'maps://0,0?q=', android: 'geo:0,0?q=' });
      const latLng = `${business.latitude},${business.longitude}`;
      const label = business.name;
      const url = Platform.select({
        ios: `${scheme}${label}@${latLng}`,
        android: `${scheme}${latLng}(${label})`
      });
      if (url) Linking.openURL(url);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>İşletme Detayları Yükleniyor...</Text>
      </View>
    );
  }

  if (error || !business) {
    return (
      <View style={styles.centered}>
        <Icon name="alert-circle-outline" type="ionicon" size={50} color="#D32F2F" />
        <Text style={styles.errorText}>{error || 'İşletme bulunamadı.'}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Geri Dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const formattedHours = formatOperatingHours(business.operating_hours);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContentContainer}>
      {/* Hero Section with Image and Name */}
      <View style={styles.heroContainer}>
        {business.photos && business.photos.length > 0 ? (
          <Image source={{ uri: business.photos[0] }} style={styles.heroImage} resizeMode="cover" />
        ) : (
          <View style={[styles.heroImage, styles.placeholderImageContainer]}>
            <Icon name="storefront-outline" type="ionicon" size={80} color="#A0A0A0" />
          </View>
        )}
        <View style={styles.heroOverlay} />
        <Text style={styles.businessNameOnImage}>{business.name}</Text>
      </View>

      {/* Genel Bilgiler Kartı */}
      <View style={styles.cardContainer}>
        {business.description && (
          <View style={styles.cardSection}>
            <Text style={styles.cardSectionTitle}>Hakkında</Text>
            <Text style={styles.descriptionText}>{business.description}</Text>
          </View>
        )}

        {business.address && (
          <View style={styles.cardSection}>
            <Text style={styles.cardSectionTitle}>Adres</Text>
            <TouchableOpacity style={styles.infoRowLink} onPress={() => handleOpenMaps(business.address, business.name)}>
              <Icon name="location-outline" type="ionicon" size={20} color="#007AFF" style={styles.infoIcon} />
              <Text style={styles.addressText}>{business.address}</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {business.city && business.city.name && (
             <View style={styles.cardSection}>
                <Text style={styles.cardSectionTitle}>Şehir</Text>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <Icon name="map-marker-outline" type="material-community" color="#555" size={20} style={styles.infoIcon}/>
                    <Text style={styles.defaultText}>{business.city.name}</Text>
                </View>
            </View>
        )}
      </View>

      {/* Hizmet Türleri Kartı */}
      {business.services && business.services.length > 0 && (
        <View style={styles.cardContainer}>
          <Text style={styles.cardSectionTitle}>Sunulan Hizmetler</Text>
          <View style={styles.servicesFlexContainer}>
            {business.services.map(service => (
              <View key={service.id} style={styles.serviceChip}>
                {service.icon_url ? 
                  <Image source={{uri: service.icon_url}} style={styles.serviceChipIcon} /> : 
                  <Icon name="cog-outline" type="ionicon" size={16} color="#4A5568" style={styles.serviceChipIcon}/>
                }
                <Text style={styles.serviceChipText}>{service.name}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
      
      {/* Çalışma Saatleri Kartı */}
      <View style={styles.cardContainer}>
        <Text style={styles.cardSectionTitle}>Çalışma Saatleri</Text>
        {formattedHours.map((line, index) => (
          <View key={index} style={[styles.operatingHoursRow, index === formattedHours.length - 1 && styles.noBorderBottom]}>
            <Icon 
              name={line.isClosed ? "close-circle" : "time-outline"} 
              type="ionicon" 
              color={line.isClosed ? styles.closedColor.color : styles.openColor.color} 
              size={20} 
              style={styles.operatingHoursIcon}
            />
            <Text style={[styles.operatingHoursDayText, line.isClosed && styles.closedText]}>{line.day}:</Text>
            <Text style={[styles.operatingHoursTimeText, line.isClosed ? styles.closedText : styles.openText]}>
              {line.hours}
            </Text>
          </View>
        ))}
      </View>

      {/* Randevu Al Butonu (Floating veya sabit) */}
      <View style={styles.fabContainer}>
         <TouchableOpacity 
            style={styles.primaryButton} 
            onPress={() => navigation.navigate('CreateAppointment', { preSelectedBusinessId: businessId })}
          >
            <Icon name="calendar-plus-o" type="font-awesome" color="white" size={20} style={{marginRight:10}}/>
            <Text style={styles.primaryButtonText}>Randevu Al</Text>
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
};

// Component dışında veya bir utils dosyasında
const daysOfWeekMap = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

const formatOperatingHours = (hours: OperatingHourData[] | undefined): Array<{ day: string; hours: string; isClosed: boolean }> => {
  if (!hours || hours.length === 0) {
      // Pazartesi'den Pazar'a sıralı günler için varsayılan oluştur
      const defaultDisplayOrder = [1, 2, 3, 4, 5, 6, 0];
      return defaultDisplayOrder.map(dayIndex => ({
          day: daysOfWeekMap[dayIndex],
          hours: 'Belirtilmemiş',
          isClosed: true 
      }));
  }

  const displayHours: Array<{ day: string; hours: string; isClosed: boolean }> = [];
  const hoursByDay: { [key: number]: OperatingHourData } = {};
  hours.forEach(h => {
      hoursByDay[h.day_of_week] = h;
  });

  const displayOrder = [1, 2, 3, 4, 5, 6, 0]; // Pazartesi (1) ... Pazar (0)

  displayOrder.forEach(dayIndex => {
    const dayName = daysOfWeekMap[dayIndex];
    const hourInfo = hoursByDay[dayIndex];

    if (hourInfo) {
      if (hourInfo.is_closed || (!hourInfo.open_time && !hourInfo.close_time)) {
        displayHours.push({ day: dayName, hours: 'Kapalı', isClosed: true });
      } else {
        const open = hourInfo.open_time ? hourInfo.open_time.substring(0, 5) : 'N/A';
        const close = hourInfo.close_time ? hourInfo.close_time.substring(0, 5) : 'N/A';
        displayHours.push({ day: dayName, hours: `${open} - ${close}`, isClosed: false });
      }
    } else {
      displayHours.push({ day: dayName, hours: 'Belirtilmemiş', isClosed: true });
    }
  });

  return displayHours;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7FC', // Genel arka plan rengi
  },
  scrollContentContainer: {
    paddingBottom: 80, // FAB için boşluk
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F4F7FC',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#555',
  },
  errorText: {
    fontSize: 17,
    color: '#D32F2F',
    textAlign: 'center',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  heroContainer: {
    height: 250, // Yükseklik ayarlanabilir
    backgroundColor: '#DDEEFF', // Placeholder rengi
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EAEAEA',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)', // Hafif karartma
  },
  businessNameOnImage: {
    position: 'absolute',
    bottom: 15,
    left: 15,
    right: 15,
    color: 'white',
    fontSize: 26,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 15,
    marginTop: -40, // Hero image üzerine taşması için (sadece ilk kart için geçerli olabilir)
    marginBottom: 20,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 3,
  },
  cardSection: {
    marginBottom: 18, // Bölümler arası boşluk
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  cardSectionTitle: {
    fontSize: 18, // Daha belirgin başlık
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 10,
  },
  descriptionText: {
    fontSize: 15,
    color: '#4A5568',
    lineHeight: 22,
  },
  addressText: {
    fontSize: 15,
    color: '#007AFF', // Adres tıklanabilir gibi görünsün
    flexShrink: 1, // Uzun adresler için
  },
  defaultText:{
      fontSize: 15,
      color: '#4A5568',
  },
  infoRowLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIcon: {
    marginRight: 8,
  },
  servicesFlexContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
  },
  serviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E9F5FF',
    borderRadius: 20, // Daha yuvarlak
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#BCE0FD',
  },
  serviceChipIcon: {
    marginRight: 7,
    width: 16, // İkon boyutunu sabitle
    height: 16, // İkon boyutunu sabitle
  },
  serviceChipText: {
    fontSize: 14,
    color: '#005A9E',
    fontWeight: '500',
  },
  operatingHoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F4F4F4',
  },
  noBorderBottom: {
    borderBottomWidth: 0,
  },
  operatingHoursIcon: {
    marginRight: 12, // İkon ve metin arası boşluk
  },
  operatingHoursDayText: {
    fontSize: 15,
    color: '#333333',
    fontWeight: '500',
    width: 100, // Gün isimlerinin hizalı durması için yeterli genişlik
  },
  operatingHoursTimeText: {
    fontSize: 15,
    flexShrink: 1, 
  },
  openText: {
    color: '#28A745', 
    fontWeight: '500',
  },
  closedText: {
    color: '#DC3545',
  },
  openColor: { color: '#28A745' }, // Sadece renk için (ikon)
  closedColor: { color: '#DC3545' }, // Sadece renk için (ikon)

  fabContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 30, // Daha yuvarlak buton
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    minWidth: '80%',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  // handleOpenMaps fonksiyonu burada veya component içinde tanımlı olmalı
});

// handleOpenMaps (Eğer component içinde değilse, buraya taşıyın veya import edin)
const handleOpenMaps = (address?: string, businessName?: string) => {
  if (!address) {
    Alert.alert('Hata', 'İşletme adresi bulunamadı.');
    return;
  }
  const scheme = Platform.OS === 'ios' ? 'maps://0,0?q=' : 'geo:0,0?q=';
  const latLng = ''; // Enlem boylam varsa eklenebilir, şimdilik sadece adres
  const label = businessName || 'İşletme Konumu';
  const url = Platform.OS === 'ios' 
    ? `${scheme}${label}@${latLng}${encodeURIComponent(address)}` 
    : `${scheme}${latLng}(${encodeURIComponent(label)})?q=${encodeURIComponent(address)}`;

  Linking.canOpenURL(url)
    .then(supported => {
      if (supported) {
        return Linking.openURL(url);
      } else {
        // Fallback to Google Maps website if app not available
        const browserUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
        return Linking.openURL(browserUrl);
      }
    })
    .catch(err => {
        console.error('Harita açma hatası:', err);
        Alert.alert('Hata', 'Harita uygulaması açılamadı.');
    });
};

export default BusinessDetailScreen;
