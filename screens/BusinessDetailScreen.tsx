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

interface BusinessFullDetails {
  id: string; // id alanı eklendi
  owner_id: string;
  name: string;
  description: string | null;
  address: string | null;
  photos: string[] | null;
  latitude: number | null;
  longitude: number | null;
  category?: string | null; // Opsiyonel kategori alanı
  phone?: string | null; // Opsiyonel telefon alanı
  website?: string | null; // Opsiyonel web sitesi alanı
  is_published?: boolean;
}

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

const BusinessDetailScreen = () => {
  const route = useRoute<BusinessDetailScreenRouteProp>();
  const navigation = useNavigation<BusinessDetailScreenNavigationProp>();
  const { businessId } = route.params; // businessOwnerId -> businessId

  const [business, setBusiness] = useState<BusinessFullDetails | null>(null);
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
      // İşletme detaylarını çek
      const { data, error: fetchError } = await supabase
        .from('businesses')
        .select('owner_id, name, description, address, photos, latitude, longitude, is_published') // category, phone, website kaldırıldı
        .eq('id', businessId) // owner_id -> id
        .eq('is_published', true)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          setError('İşletme bulunamadı veya yayında değil.');
        } else {
          throw fetchError;
        }
      }

      // İşletmenin hizmet türlerini çek
      if (data) {
        const { data: serviceData, error: serviceError } = await supabase
          .from('BusinessServices')
          .select(`
            ServiceTypes (
              id,
              name,
              icon_url
            )
          `)
          .eq('business_id', businessId);

        if (serviceError) {
          console.warn('Service types çekilirken hata:', serviceError);
        } else {
          // Service types'ları düzenle
          const services: ServiceType[] = [];
          if (serviceData) {
            serviceData.forEach((item: any) => {
              if (item.ServiceTypes) {
                services.push({
                  id: item.ServiceTypes.id,
                  name: item.ServiceTypes.name,
                  icon_url: item.ServiceTypes.icon_url
                });
              }
            });
          }
          setServiceTypes(services);
        }
      }

      setBusiness(data as BusinessFullDetails); 
      if (data && !fetchError) {
        logBusinessClick(businessId, session?.user?.id, data.owner_id);
      }
    } catch (err) {
      if (err instanceof Error) {
        setError('İşletme detayları yüklenirken bir hata oluştu: ' + err.message);
        console.error("Error in fetchBusinessDetails:", err);
      } else {
        setError('Bilinmeyen bir hata oluştu.');
        console.error("Unknown error in fetchBusinessDetails:", err);
      }
      setBusiness(null);
      setServiceTypes([]);
    } finally {
      setLoading(false);
    }
  }, [businessId, session]); // session bağımlılık olarak eklendi

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
        <ActivityIndicator size="large" color="#0066CC" />
        <Text style={styles.loadingText}>İşletme detayları yükleniyor...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Icon name="alert-circle-outline" type="ionicon" size={60} color="#ff6347" />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!business) {
    return (
      <View style={styles.centered}>
        <Icon name="store-remove-outline" type="material-community" size={60} color="#888" />
        <Text style={styles.emptyText}>İşletme bilgisi bulunamadı.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Fotoğraf Galerisi */}
        {business.photos && business.photos.length > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.photoGallery}
          >
            {business.photos.map((url, index) => (
              <Image key={index} source={{ uri: url }} style={styles.galleryImage} resizeMode="cover" />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.noPhotoContainer}>
            <Icon name="image-off-outline" type="material-community" size={80} color="#ccc" />
            <Text style={styles.noPhotoText}>İşletmeye ait fotoğraf bulunmuyor.</Text>
          </View>
        )}

        <View style={styles.contentContainer}>
          <Text style={styles.businessName}>{business.name}</Text>

          {business.category && (
            <View style={styles.infoRow}>
              <Icon name="tag-outline" type="material-community" size={20} color="#555" style={styles.infoIcon} />
              <Text style={styles.categoryText}>{business.category}</Text>
            </View>
          )}

          {business.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Hakkında</Text>
              <Text style={styles.descriptionText}>{business.description}</Text>
            </View>
          )}

          {/* Hizmet Türleri */}
          {serviceTypes.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Hizmet Türleri</Text>
              <View style={styles.servicesContainer}>
                {serviceTypes.map((service) => (
                  <View key={service.id} style={styles.serviceTag}>
                    <Icon name="checkmark-circle" type="ionicon" size={16} color="#4CAF50" />
                    <Text style={styles.serviceTagText}>{service.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {business.address && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Adres</Text>
              <TouchableOpacity onPress={openMapNavigation}>
                <View style={styles.infoRow}>
                  <Icon name="location-outline" type="ionicon" size={20} color="#0066CC" style={styles.infoIcon} />
                  <Text style={styles.addressText}>{business.address}</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
          
          {business.phone && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Telefon</Text>
              <TouchableOpacity onPress={() => Linking.openURL(`tel:${business.phone}`)}>
                <View style={styles.infoRow}>
                  <Icon name="call-outline" type="ionicon" size={20} color="#0066CC" style={styles.infoIcon} />
                  <Text style={styles.linkText}>{business.phone}</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {business.website && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Web Sitesi</Text>
              <TouchableOpacity onPress={() => Linking.openURL(business.website!)}>
                <View style={styles.infoRow}>
                  <Icon name="globe-outline" type="ionicon" size={20} color="#0066CC" style={styles.infoIcon} />
                  <Text style={styles.linkText}>{business.website}</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Harita Bölümü */}
          {business.latitude && business.longitude && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Konum</Text>
              <View style={styles.mapContainer}>
                <MapView
                  style={styles.map}
                  initialRegion={{
                    latitude: business.latitude,
                    longitude: business.longitude,
                    latitudeDelta: 0.01, // Daha yakın bir zoom
                    longitudeDelta: 0.01,
                  }}
                  scrollEnabled={false} // İsteğe bağlı: Kaydırmayı engelle
                  zoomEnabled={false}   // İsteğe bağlı: Zoom'u engelle
                >
                  <Marker
                    coordinate={{ latitude: business.latitude, longitude: business.longitude }}
                    title={business.name}
                  />
                </MapView>
                <TouchableOpacity style={styles.openMapButton} onPress={openMapNavigation}>
                  <Text style={styles.openMapButtonText}>Haritada Aç</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          {/* Bottom padding for floating button */}
          <View style={styles.bottomSpacer} />
        </View>
      </ScrollView>

      {/* Floating Randevu Butonu */}
      <View style={styles.floatingButtonContainer}>
        <TouchableOpacity 
          style={styles.appointmentButton}
          onPress={() => navigation.navigate('CreateAppointment', { preSelectedBusinessId: businessId })}
          activeOpacity={0.8}
        >
          <Icon name="calendar" type="ionicon" size={24} color="#FFFFFF" style={styles.appointmentIcon} />
          <Text style={styles.appointmentButtonText}>Randevu Al</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E0F7FA', // Açık mavi arka plan
  },
  scrollContainer: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#E0F7FA', // Açık mavi arka plan
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#555',
  },
  errorText: {
    marginTop: 15,
    fontSize: 17,
    color: '#d9534f',
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 15,
    fontSize: 17,
    color: '#777',
    textAlign: 'center',
  },
  photoGallery: {
    height: screenHeight * 0.35, // Ekran yüksekliğinin %35'i
    backgroundColor: '#000',
  },
  galleryImage: {
    width: screenWidth,
    height: screenHeight * 0.35,
  },
  noPhotoContainer: {
    height: screenHeight * 0.3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e9ecef',
  },
  noPhotoText: {
    marginTop: 10,
    color: '#888',
    fontSize: 16,
  },
  contentContainer: {
    padding: 20,
    backgroundColor: '#fff', // İçerik alanı için beyaz arka plan
    borderTopLeftRadius: 20, // Üst köşeleri yuvarlat
    borderTopRightRadius: 20,
    marginTop: -20, // Fotoğraf galerisinin üzerine hafifçe binsin
    zIndex: 1,
  },
  businessName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 16,
    color: '#777',
    marginBottom: 15,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#444',
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoIcon: {
    marginRight: 10,
  },
  addressText: {
    fontSize: 16,
    color: '#0066CC', // Yeni birincil mavi
    flexShrink: 1, // Uzun adreslerin taşmasını engelle
    textDecorationLine: 'underline',
  },
  linkText: {
    fontSize: 16,
    color: '#0066CC', // Yeni birincil mavi
    textDecorationLine: 'underline',
  },
  mapContainer: {
    height: 200, // Harita yüksekliği
    borderRadius: 12,
    overflow: 'hidden', // Haritanın köşelerini yuvarlatmak için
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  openMapButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0, 102, 204, 0.9)', // #0066CC'nin alpha kanallı hali
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  openMapButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  servicesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  serviceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  serviceTagText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#388E3C',
    marginLeft: 6,
  },
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 20,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
  },
  appointmentButton: {
    backgroundColor: '#0066CC',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  appointmentIcon: {
    marginRight: 10,
  },
  appointmentButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bottomSpacer: {
    height: 120, // Floating button için yer bırak
  },
});

export default BusinessDetailScreen;
