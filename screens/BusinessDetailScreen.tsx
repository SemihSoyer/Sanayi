import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image, Dimensions, Linking, TouchableOpacity, Platform } from 'react-native';
import { Card, Icon } from '@rneui/themed';
import MapView, { Marker } from 'react-native-maps';
import { supabase } from '../lib/supabase';
import { RouteProp, useRoute } from '@react-navigation/native';

// App.tsx'deki RootStackParamList'e göre güncellenecek
type RootStackParamList = {
  BusinessDetail: { businessOwnerId: string };
  // Diğer ekranlarınız...
};

type BusinessDetailScreenRouteProp = RouteProp<RootStackParamList, 'BusinessDetail'>;

interface BusinessFullDetails {
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
  const { businessOwnerId } = route.params;

  const [business, setBusiness] = useState<BusinessFullDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBusinessDetails = useCallback(async () => {
    if (!businessOwnerId) {
      setError('İşletme kimliği bulunamadı.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('businesses')
        .select('owner_id, name, description, address, photos, latitude, longitude, is_published') // category, phone, website kaldırıldı
        .eq('owner_id', businessOwnerId)
        .eq('is_published', true)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          setError('İşletme bulunamadı veya yayında değil.');
        } else {
          throw fetchError;
        }
      }
      setBusiness(data);
    } catch (err) {
      if (err instanceof Error) {
        setError('İşletme detayları yüklenirken bir hata oluştu: ' + err.message);
        console.error(err);
      } else {
        setError('Bilinmeyen bir hata oluştu.');
        console.error(err);
      }
      setBusiness(null);
    } finally {
      setLoading(false);
    }
  }, [businessOwnerId]);

  useEffect(() => {
    fetchBusinessDetails();
  }, [fetchBusinessDetails]);

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
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
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
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5', // Airbnb benzeri açık gri arka plan
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f0f2f5',
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
});

export default BusinessDetailScreen;
