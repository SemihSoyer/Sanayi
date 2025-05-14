import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, Dimensions, Modal, ScrollView, Platform } from 'react-native'; // Modal, ScrollView, Platform eklendi
import { Button, CheckBox, Icon } from '@rneui/themed'; // CheckBox, Icon eklendi (Button zaten vardı)
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
// Icon zaten import edilmişti, tekrar eklemeye gerek yok.

// App.tsx'deki RootStackParamList'e göre güncellenecek
// BusinessDetailScreen'e yönlendirme için tip tanımı
type RootStackParamList = {
  BusinessDetail: { businessId: string }; // businessOwnerId -> businessId olarak değiştirildi
  // Diğer ekranlarınız...
};
type MapScreenNavigationProp = StackNavigationProp<RootStackParamList, 'BusinessDetail'>;

interface MapBusiness {
  id: string; // İşletmenin benzersiz ID'si eklendi
  owner_id: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface ServiceType { // HomeScreen'deki ile aynı
  id: string;
  name: string;
  icon_url?: string;
}

const MapScreen = () => {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [allMapBusinesses, setAllMapBusinesses] = useState<MapBusiness[]>([]);
  const [filteredMapBusinesses, setFilteredMapBusinesses] = useState<MapBusiness[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [selectedServiceTypeIds, setSelectedServiceTypeIds] = useState<string[]>([]);

  const [loadingLocation, setLoadingLocation] = useState(true);
  const [loadingData, setLoadingData] = useState(true); // Genel veri yükleme (işletme ve hizmet türleri)
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const navigation = useNavigation<MapScreenNavigationProp>();

  const fetchData = useCallback(async () => {
    setLoadingLocation(true);
    setLoadingData(true);
    setErrorMsg(null);

    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Konum izni reddedildi. Harita özelliği kullanılamıyor.');
        setLoadingLocation(false);
        setLoadingData(false);
        return;
      }
      let currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
      setLoadingLocation(false);

      // Hizmet türlerini çek
      const { data: serviceTypesData, error: serviceTypesError } = await supabase
        .from('ServiceTypes')
        .select('id, name, icon_url');
      if (serviceTypesError) throw serviceTypesError;
      setServiceTypes(serviceTypesData || []);

      // Yayınlanmış ve konumu olan tüm işletmeleri çek
      // RPC kullanacağız, bu yüzden başlangıçta tümünü çekmeye gerek yok, RPC'den gelecek.
      // Ancak RPC yoksa veya ilk yüklemede tümünü göstermek için bu kalabilir.
      // Şimdilik RPC'ye güvenerek bu kısmı RPC çağrısına bırakalım ve applyFilters ile ilk yüklemeyi yapalım.
      // Ya da başlangıçta RPC'yi boş filtre ile çağırabiliriz.
      await applyMapFilters(true); // true: initial load

    } catch (err) {
      if (err instanceof Error) {
        setErrorMsg('Veriler yüklenirken bir hata oluştu: ' + err.message);
        console.error("FetchData Error:", err);
      } else {
        setErrorMsg('Bilinmeyen bir hata oluştu.');
        console.error("FetchData Error (unknown):", err);
      }
      setLocation(null);
      setAllMapBusinesses([]);
      setFilteredMapBusinesses([]);
      setServiceTypes([]);
    } finally {
      setLoadingLocation(false); // Bu zaten yukarıda yapılıyor
      setLoadingData(false);
    }
  }, []); // applyMapFilters'ı bağımlılıklara ekleyeceğiz

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );
  
  const applyMapFilters = useCallback(async (isInitialLoad = false) => {
    if (!isInitialLoad) {
      setFilterModalVisible(false);
    }
    setLoadingData(true); // İşletmeler yükleniyor
    setErrorMsg(null);

    try {
      const rpcParams = { 
        p_service_type_ids: selectedServiceTypeIds.length > 0 ? selectedServiceTypeIds : null 
      };
      // RPC fonksiyon adını 'get_businesses_by_service_types' olarak değiştiriyoruz.
      console.log("[MapScreen] Calling RPC 'get_businesses_by_service_types' with params:", rpcParams);
      const { data, error } = await supabase.rpc('get_businesses_by_service_types', rpcParams);

      if (error) {
        console.error("[MapScreen] RPC Error:", error);
        throw error;
      }
      console.log("[MapScreen] RPC Data:", data);
      const businessesWithLocation = (data || []).filter((b: any) => b.latitude != null && b.longitude != null) as MapBusiness[]; // 'b' parametresine any tipi eklendi (veya daha spesifik bir tip)
      
      if (isInitialLoad) {
        setAllMapBusinesses(businessesWithLocation);
      }
      setFilteredMapBusinesses(businessesWithLocation);

    } catch (err) {
      if (err instanceof Error) {
        setErrorMsg('Filtreleme sırasında bir hata oluştu: ' + err.message);
        console.error("[MapScreen] ApplyFilters Error:", err);
      } else {
        setErrorMsg('Filtreleme sırasında bilinmeyen bir hata oluştu.');
        console.error("[MapScreen] ApplyFilters Error (unknown):", err);
      }
      setFilteredMapBusinesses([]);
    } finally {
      setLoadingData(false);
    }
  }, [selectedServiceTypeIds]); // allMapBusinesses'a gerek yok çünkü RPC'den çekiyoruz

  useEffect(() => {
    // fetchData'dan sonra applyMapFilters çağrıldığı için bu useEffect'e gerek kalmayabilir,
    // ya da sadece selectedServiceTypeIds değiştiğinde çağrılabilir.
    // Şimdilik fetchData içinde ilk yükleme yapılıyor.
    // Eğer filtreler modal dışından da değişebilirse (örn. global state), o zaman bu useEffect anlamlı olur.
    // Mevcut yapıda, modal kapandığında applyMapFilters çağrılıyor.
  }, [selectedServiceTypeIds, allMapBusinesses, applyMapFilters]);


  const clearMapFilters = () => {
    setSelectedServiceTypeIds([]);
    // setFilteredMapBusinesses(allMapBusinesses); // RPC kullandığımız için tekrar RPC çağıracağız
    applyMapFilters(); // Boş filtrelerle RPC'yi çağır
    setFilterModalVisible(false);
  };

  const handleServiceTypeToggle = (serviceTypeId: string) => {
    setSelectedServiceTypeIds(prev => 
      prev.includes(serviceTypeId) 
        ? prev.filter(id => id !== serviceTypeId) 
        : [...prev, serviceTypeId]
    );
  };

  if (loadingLocation || (loadingData && !location)) { // Konum yüklenene kadar veya konum yokken veri yükleniyorsa
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0066CC" />
        <Text>{loadingLocation ? "Konumunuz alınıyor..." : "Veriler yükleniyor..."}</Text>
      </View>
    );
  }

  if (errorMsg) {
    return (
      <View style={styles.centered}>
        <Icon name="alert-circle-outline" type="ionicon" size={50} color="orange" />
        <Text style={styles.errorText}>{errorMsg}</Text>
        {errorMsg !== 'Konum izni reddedildi. Harita özelliği kullanılamıyor.' && (
           <Button title="Tekrar Dene" onPress={fetchData} />
        )}
      </View>
    );
  }

  if (!location) {
     return (
      <View style={styles.centered}>
        <Text>Konum bilgisi alınamadı. Lütfen konum servislerinizi kontrol edin.</Text>
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
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
        showsUserLocation={true}
        // key prop'u MapView'ın yeniden render olmasını tetikleyebilir, dikkatli kullanılmalı.
        // key={filteredMapBusinesses.map(b => b.id).join('-')} 
      >
        {filteredMapBusinesses.map((business) => (
          <Marker
            key={business.id}
            coordinate={{
              latitude: business.latitude,
              longitude: business.longitude,
            }}
            title={business.name}
            onCalloutPress={() => navigation.navigate('BusinessDetail', { businessId: business.id })}
            pinColor="red"
          />
        ))}
      </MapView>

      <View style={styles.filterButtonContainer}>
        <Button 
          icon={<Icon name="filter" type="ionicon" color="#FFFFFF" size={20} />} 
          title="Filtrele" 
          onPress={() => setFilterModalVisible(true)} 
          buttonStyle={styles.filterButton}
          titleStyle={styles.filterButtonTitle}
        />
      </View>
      
      {loadingData && !loadingLocation && ( // Sadece işletmeler yükleniyorsa ve konum alındıysa
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.loadingText}>İşletmeler yükleniyor...</Text>
        </View>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={filterModalVisible}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Hizmet Türüne Göre Filtrele</Text>
            <ScrollView style={styles.modalScrollView}>
              {serviceTypes.length === 0 && !loadingData ? (
                <Text style={styles.centeredText}>Filtrelenecek hizmet türü bulunamadı.</Text>
              ) : (
                serviceTypes.map((service) => (
                  <CheckBox
                    key={service.id}
                    title={service.name}
                    checked={selectedServiceTypeIds.includes(service.id)}
                    onPress={() => handleServiceTypeToggle(service.id)}
                    containerStyle={styles.checkboxContainerModal}
                    textStyle={styles.checkboxTextModal}
                    checkedColor="#007bff"
                  />
                ))
              )}
            </ScrollView>
            <View style={styles.modalButtonContainer}>
              <Button title="Temizle" onPress={clearMapFilters} type="outline" buttonStyle={styles.modalButton} titleStyle={styles.modalButtonTextClear} />
              <Button title="Uygula" onPress={() => applyMapFilters()} buttonStyle={[styles.modalButton, styles.modalButtonApply]} titleStyle={styles.modalButtonTextApply} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  // HomeScreen'den kopyalanan ve MapScreen'e uyarlanan stiller
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
    backgroundColor: '#f8f9fa', // Arka plan rengi eklendi
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
    top: 70, // Filtre butonunun altına gelecek şekilde ayarlandı
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10, // Haritanın üzerinde olması için
  },
  loadingText: {
    color: '#fff',
    marginLeft: 10,
    fontSize: 14,
  },
  filterButtonContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 20,
    right: 15,
    zIndex: 10,
  },
  filterButton: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderColor: '#0066CC',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterButtonTitle: {
    color: '#0066CC',
    marginLeft: 5,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalScrollView: {
    maxHeight: Dimensions.get('window').height * 0.5,
    marginBottom: 15,
  },
  checkboxContainerModal: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingVertical: 8,
    marginLeft: 0,
  },
  checkboxTextModal: {
    fontWeight: 'normal',
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 120,
  },
  modalButtonTextClear: {
    color: '#007bff',
  },
  modalButtonApply: {
    backgroundColor: '#007bff',
  },
  modalButtonTextApply: {
    color: 'white',
  },
  centeredText: {
    textAlign: 'center',
    marginVertical: 20,
    fontSize: 16,
    color: '#666',
  }
});

export default MapScreen;
