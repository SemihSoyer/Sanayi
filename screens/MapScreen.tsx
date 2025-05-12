import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, Dimensions, Button } from 'react-native'; // Button eklendi
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Icon } from '@rneui/themed'; // Icon eklendi

// App.tsx'deki RootStackParamList'e göre güncellenecek
// BusinessDetailScreen'e yönlendirme için tip tanımı
type RootStackParamList = {
  BusinessDetail: { businessOwnerId: string };
  // Diğer ekranlarınız...
};
type MapScreenNavigationProp = StackNavigationProp<RootStackParamList, 'BusinessDetail'>;

interface MapBusiness {
  owner_id: string;
  name: string;
  latitude: number;
  longitude: number;
}

const MapScreen = () => {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [businesses, setBusinesses] = useState<MapBusiness[]>([]);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [loadingBusinesses, setLoadingBusinesses] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const navigation = useNavigation<MapScreenNavigationProp>();

  const getLocationAndBusinesses = useCallback(async () => {
    setLoadingLocation(true);
    setLoadingBusinesses(true);
    setErrorMsg(null);

    // 1. Konum İzni İste ve Konumu Al
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Konum izni reddedildi. Harita özelliği kullanılamıyor.');
        setLoadingLocation(false);
        setLoadingBusinesses(false);
        return;
      }

      let currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
      setLoadingLocation(false);

      // 2. Konum Alındıktan Sonra İşletmeleri Çek
      // Not: Şu an tüm işletmeleri çekiyoruz. Daha sonra yakınlık filtresi eklenebilir.
      const { data, error: fetchError } = await supabase
        .from('businesses')
        .select('owner_id, name, latitude, longitude')
        .eq('is_published', true)
        .not('latitude', 'is', null) // Konumu olanları çek
        .not('longitude', 'is', null);

      if (fetchError) throw fetchError;

      setBusinesses(data || []);

    } catch (err) {
      if (err instanceof Error) {
        setErrorMsg('Bir hata oluştu: ' + err.message);
        console.error(err);
      } else {
        setErrorMsg('Bilinmeyen bir hata oluştu.');
        console.error(err);
      }
      // Hata durumunda state'leri sıfırla
      setLocation(null);
      setBusinesses([]);
    } finally {
      // Her iki yükleme de bittiğinde genel yüklemeyi bitir
      setLoadingLocation(false);
      setLoadingBusinesses(false);
    }
  }, []);

  // Ekran odaklandığında verileri yeniden çek
  useFocusEffect(
    useCallback(() => {
      getLocationAndBusinesses();
    }, [getLocationAndBusinesses])
  );

  if (loadingLocation) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text>Konumunuz alınıyor...</Text>
      </View>
    );
  }

  if (errorMsg) {
    return (
      <View style={styles.centered}>
        <Icon name="alert-circle-outline" type="ionicon" size={50} color="orange" />
        <Text style={styles.errorText}>{errorMsg}</Text>
        {/* İzin reddedildiyse tekrar deneme butonu göstermeyebiliriz veya farklı bir mesaj verebiliriz */}
        {errorMsg !== 'Konum izni reddedildi. Harita özelliği kullanılamıyor.' && (
           <Button title="Tekrar Dene" onPress={getLocationAndBusinesses} />
        )}
      </View>
    );
  }

  if (!location) {
     // Bu durum normalde errorMsg ile yakalanmalı ama yine de bir fallback
     return (
      <View style={styles.centered}>
        <Text>Konum bilgisi alınamadı.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.0922, // Yakın bir başlangıç zoom seviyesi
          longitudeDelta: 0.0421,
        }}
        showsUserLocation={true} // Kullanıcının mevcut konumunu mavi nokta ile göster
        followsUserLocation={true} // Harita kullanıcıyı takip etsin (isteğe bağlı)
      >
        {businesses.map((business) => (
          <Marker
            key={business.owner_id}
            coordinate={{
              latitude: business.latitude,
              longitude: business.longitude,
            }}
            title={business.name}
            // description="Detaylar için dokunun" // İsteğe bağlı
            onCalloutPress={() => navigation.navigate('BusinessDetail', { businessOwnerId: business.owner_id })}
            pinColor="red" // İşletme pin rengi
          />
        ))}
      </MapView>
      {loadingBusinesses && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.loadingText}>İşletmeler yükleniyor...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
    marginBottom: 15,
  },
  loadingOverlay: {
    position: 'absolute',
    bottom: 20,
    left: Dimensions.get('window').width / 2 - 75, // Ortalamak için
    width: 150,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 10,
    borderRadius: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginLeft: 10,
  }
});

export default MapScreen;
