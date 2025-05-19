import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, Dimensions, Modal, ScrollView, Platform, TouchableOpacity } from 'react-native';
import { Button, CheckBox, Icon } from '@rneui/themed';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useMapScreenData, MapBusiness } from '../hooks/useMapScreenData';
import MapBusinessPreviewCard, { PreviewBusiness } from '../components/MapBusinessPreviewCard';

// App.tsx'deki RootStackParamList'e göre güncellenecek
type RootStackParamList = {
  BusinessDetail: { businessId: string };
};
type MapScreenNavigationProp = StackNavigationProp<RootStackParamList, 'BusinessDetail'>;

interface ServiceType {
  id: string;
  name: string;
  icon_url?: string;
}

const MapScreen = () => {
  const navigation = useNavigation<MapScreenNavigationProp>();
  const {
    location,
    filteredMapBusinesses,
    serviceTypes,
    selectedServiceTypeIds,
    loadingLocation,
    loadingData,
    errorMsg,
    filterModalVisible,
    fetchData,
    setFilterModalVisible,
    handleServiceTypeToggle,
    triggerApplyFilters,
    clearMapFilters,
  } = useMapScreenData();

  const [selectedBusiness, setSelectedBusiness] = useState<MapBusiness | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchData();
      // Ekran odağını kaybettiğinde önizlemeyi kapat
      return () => {
        setSelectedBusiness(null);
      };
    }, [fetchData])
  );

  const handleMarkerPress = (business: MapBusiness) => {
    setSelectedBusiness(business);
  };

  const handlePreviewCardPress = (businessId: string) => {
    setSelectedBusiness(null); // Detay sayfasına gitmeden önce önizlemeyi kapat
    navigation.navigate('BusinessDetail', { businessId });
  };

  const handleClosePreview = () => {
    setSelectedBusiness(null);
  };
  
  const handleMapPress = () => {
    // Eğer kullanıcı haritanın herhangi bir yerine tıklarsa ve bir marker değilse,
    // açık olan önizleme kartını kapat.
    if (selectedBusiness) {
      setSelectedBusiness(null);
    }
  };

  if (loadingLocation || (loadingData && !location && !errorMsg)) {
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
        <Button title="Tekrar Dene" onPress={fetchData} />
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
        onPress={handleMapPress} // Haritaya tıklanınca önizlemeyi kapat
      >
        {filteredMapBusinesses.map((business) => (
          <Marker
            key={business.id}
            coordinate={{
              latitude: business.latitude,
              longitude: business.longitude,
            }}
            onPress={() => handleMarkerPress(business)} 
            pinColor={selectedBusiness?.id === business.id ? "#0066CC" : "red"} 
          />
        ))}
      </MapView>

      {selectedBusiness && (
        <View style={styles.previewContainer}>
          <MapBusinessPreviewCard
            business={{
              id: selectedBusiness.id,
              name: selectedBusiness.name,
              address: selectedBusiness.address,
              photos: selectedBusiness.photos,
            }}
            onPress={() => handlePreviewCardPress(selectedBusiness.id)}
            onClose={handleClosePreview}
          />
        </View>
      )}

      <View style={styles.filterButtonContainer}>
        <Button 
          icon={<Icon name="filter" type="ionicon" color="#FFFFFF" size={20} />} 
          title="Filtrele" 
          onPress={() => setFilterModalVisible(true)} 
          buttonStyle={styles.filterButton}
          titleStyle={styles.filterButtonTitle}
          disabled={loadingData} // Veri yüklenirken butonu devre dışı bırak
        />
      </View>
      
      {(loadingData && !loadingLocation) && (
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
        <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPressOut={() => setFilterModalVisible(false)} // Dışına tıklayınca kapat
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent} onPress={() => {}}> 
            <Text style={styles.modalTitle}>Hizmet Türüne Göre Filtrele</Text>
            <ScrollView style={styles.modalScrollView}>
              {serviceTypes.length === 0 && !loadingData && (
                <Text style={styles.noServiceText}>Filtrelenecek hizmet türü bulunamadı.</Text>
              )}
              {serviceTypes.map((type) => (
                <CheckBox
                  key={type.id}
                  title={type.name}
                  checked={selectedServiceTypeIds.includes(type.id)}
                  onPress={() => handleServiceTypeToggle(type.id)}
                  containerStyle={styles.checkboxContainer}
                  textStyle={styles.checkboxText}
                  checkedColor="#0066CC"
                />
              ))}
            </ScrollView>
            <View style={styles.modalButtonContainer}>
              <Button title="Temizle" onPress={clearMapFilters} type="outline" buttonStyle={styles.modalClearButton} titleStyle={styles.modalClearButtonTitle}/>
              <Button title="Uygula" onPress={triggerApplyFilters} buttonStyle={styles.modalApplyButton} />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  errorText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#D32F2F',
    marginTop: 10,
    marginBottom: 15,
  },
  filterButtonContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 20,
    right: 15,
    zIndex: 10, // Diğer elemanların üzerinde olması için
  },
  filterButton: {
    backgroundColor: '#0066CC',
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  filterButtonTitle: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  loadingOverlay: {
    position: 'absolute',
    bottom: 20,
    left: Dimensions.get('window').width / 2 - 100, // Ortalamak için
    width: 200,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20, // Önizleme kartının da üzerinde olabilir
  },
  loadingText: {
    color: '#fff',
    marginLeft: 10,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end', // Modalı alta al
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 22,
    borderTopRightRadius: 17,
    borderTopLeftRadius: 17,
    maxHeight: Dimensions.get('window').height * 0.6, // Ekranın %60'ı kadar
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#333',
  },
  modalScrollView: {
    // maxHeight: Dimensions.get('window').height * 0.4, // İçeriğe göre ayarlanabilir
  },
  checkboxContainer: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
    marginLeft: 0, // CheckBox'ın kendi sol padding'ini sıfırla
    marginRight:0,
    marginVertical: 8,
  },
  checkboxText: {
    fontWeight: 'normal',
    color: '#444',
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee'
  },
  modalApplyButton: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  modalClearButton: {
    borderColor: '#0066CC',
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  modalClearButtonTitle: {
    color: '#0066CC',
  },
  noServiceText: {
    textAlign: 'center',
    color: '#777',
    marginVertical: 20,
  },
  // Preview Card Styles
  previewContainer: {
    position: 'absolute',
    bottom: 20, // Ekranın altından biraz yukarıda
    left: 0,
    right: 0,
    alignItems: 'center', // Kartı yatayda ortala
    zIndex: 15, // Filtre butonundan altta, yükleme overlay'inden üstte olabilir
  },
});

export default MapScreen;
