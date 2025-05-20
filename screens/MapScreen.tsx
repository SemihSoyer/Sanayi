import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, Dimensions, Modal, ScrollView, Platform, TouchableOpacity } from 'react-native';
import { Button, CheckBox, Icon } from '@rneui/themed';
import MapView, { Marker, MapStyleElement } from 'react-native-maps';
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

// Özel harita stili
const customMapStyle: MapStyleElement[] = [
  {
    "featureType": "poi.business",
    "stylers": [
      { "visibility": "off" }
    ]
  },
  {
    "featureType": "poi.attraction",
    "stylers": [
      { "visibility": "off" }
    ]
  },
  {
    "featureType": "poi.medical",
    "stylers": [
      { "visibility": "off" }
    ]
  },
  {
    "featureType": "poi.school",
    "stylers": [
      { "visibility": "off" }
    ]
  },
  {
    "featureType": "poi.government",
    "stylers": [
      { "visibility": "off" }
    ]
  },
  {
    "featureType": "poi.place_of_worship",
    "stylers": [
      { "visibility": "off" }
    ]
  },
  {
    "featureType": "poi.sports_complex",
    "stylers": [
      { "visibility": "off" }
    ]
  }
  // Diğer stil kuralları buraya eklenebilir
];

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
      return () => {
        setSelectedBusiness(null);
      };
    }, [fetchData])
  );

  const handleMarkerPress = (business: MapBusiness) => {
    setSelectedBusiness(business);
  };

  const handlePreviewCardPress = (businessId: string) => {
    setSelectedBusiness(null); 
    navigation.navigate('BusinessDetail', { businessId });
  };

  const handleClosePreview = () => {
    setSelectedBusiness(null);
  };
  
  const handleMapPress = () => {
    if (selectedBusiness) {
      setSelectedBusiness(null);
    }
  };

  if (loadingLocation) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0066CC" />
        <Text style={styles.informativeText}>Konumunuz alınıyor...</Text>
      </View>
    );
  }

  if (errorMsg) { 
    return (
      <View style={styles.centered}>
        <Icon name="alert-circle-outline" type="ionicon" size={50} color="orange" />
        <Text style={styles.errorText}>{errorMsg}</Text>
        {errorMsg !== 'Konum izni reddedildi. Harita özelliği kullanılamıyor.' && (
           <Button title="Tekrar Dene" onPress={fetchData} buttonStyle={styles.retryButton} titleStyle={styles.retryButtonText}/>
        )}
      </View>
    );
  }

  if (!location) { 
     return (
      <View style={styles.centered}>
        <Icon name="compass-off-outline" type="material-community" size={50} color="#777" />
        <Text style={styles.informativeText}>Konum bilgisi alınamadı. Lütfen konum servislerinizi kontrol edin veya tekrar deneyin.</Text>
        <Button title="Tekrar Dene" onPress={fetchData} buttonStyle={styles.retryButton} titleStyle={styles.retryButtonText}/>
      </View>
    );
  }

  if (loadingData) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0066CC" />
        <Text style={styles.informativeText}>İşletmeler yükleniyor...</Text>
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
        onPress={handleMapPress}
        showsPointsOfInterest={Platform.OS === 'ios' ? false : true}
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
          disabled={loadingData || loadingLocation}
        />
      </View>
      
      <Modal
        animationType="slide"
        transparent={true}
        visible={filterModalVisible}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPressOut={() => setFilterModalVisible(false)}
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
    backgroundColor: '#E0F7FA',
  },
  informativeText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#333',
    marginTop: 15,
  },
  errorText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#D32F2F',
    marginTop: 10,
    marginBottom: 15,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#0066CC',
    paddingVertical: 10,
    paddingHorizontal: 25,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  filterButtonContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 20,
    right: 15,
    zIndex: 10,
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 22,
    borderTopRightRadius: 17,
    borderTopLeftRadius: 17,
    maxHeight: Dimensions.get('window').height * 0.6,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#333',
  },
  modalScrollView: {
  },
  checkboxContainer: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
    marginLeft: 0,
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
  previewContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 15,
  },
});

export default MapScreen;
