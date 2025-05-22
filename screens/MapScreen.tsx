import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, Dimensions, Modal, ScrollView, Platform, TouchableOpacity, SafeAreaView } from 'react-native';
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
  const mapRef = useRef<MapView>(null);
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
  const [currentRegion, setCurrentRegion] = useState<any>(null);

  // Initial region'ı currentRegion olarak set et
  React.useEffect(() => {
    if (location && !currentRegion) {
      setCurrentRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
    }
  }, [location, currentRegion]);

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

  const handleChipPress = (serviceTypeId: string) => {
    handleServiceTypeToggle(serviceTypeId);
    // Direkt filtrelemeyi tetikle
    setTimeout(() => {
      triggerApplyFilters();
    }, 100);
  };

  const handleZoomIn = () => {
    if (mapRef.current && currentRegion) {
      const newRegion = {
        ...currentRegion,
        latitudeDelta: currentRegion.latitudeDelta * 0.5,
        longitudeDelta: currentRegion.longitudeDelta * 0.5,
      };
      mapRef.current.animateToRegion(newRegion, 300);
      setCurrentRegion(newRegion);
    }
  };

  const handleZoomOut = () => {
    if (mapRef.current && currentRegion) {
      const newRegion = {
        ...currentRegion,
        latitudeDelta: Math.min(currentRegion.latitudeDelta * 2, 10),
        longitudeDelta: Math.min(currentRegion.longitudeDelta * 2, 10),
      };
      mapRef.current.animateToRegion(newRegion, 300);
      setCurrentRegion(newRegion);
    }
  };

  const handleCenterToUser = () => {
    if (location && mapRef.current) {
      const newRegion = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      mapRef.current.animateToRegion(newRegion, 500);
      setCurrentRegion(newRegion);
    }
  };

  const handleRegionChangeComplete = (region: any) => {
    setCurrentRegion(region);
  };

  const renderServiceTypeChips = () => {
    if (serviceTypes.length === 0) return null;

    return (
      <View style={styles.chipsContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScrollContent}
        >
          {serviceTypes.map((serviceType) => {
            const isSelected = selectedServiceTypeIds.includes(serviceType.id);
            return (
              <TouchableOpacity
                key={serviceType.id}
                style={[
                  styles.chip,
                  isSelected && styles.chipSelected
                ]}
                onPress={() => handleChipPress(serviceType.id)}
                disabled={loadingData || loadingLocation}
              >
                <Text style={[
                  styles.chipText,
                  isSelected && styles.chipTextSelected
                ]}>
                  {serviceType.name}
                </Text>
                {isSelected && (
                  <Icon 
                    name="checkmark" 
                    type="ionicon" 
                    size={16} 
                    color="#FFFFFF" 
                    style={styles.chipIcon}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderMapControls = () => (
    <View style={styles.mapControlsContainer}>
      {/* Kullanıcı konumuna odaklan */}
      <TouchableOpacity
        style={[styles.controlButton, styles.locationButton]}
        onPress={handleCenterToUser}
        disabled={!location}
      >
        <Icon name="locate" type="ionicon" size={20} color="#FFFFFF" />
      </TouchableOpacity>
      
      {/* Zoom In */}
      <TouchableOpacity
        style={styles.controlButton}
        onPress={handleZoomIn}
        disabled={!currentRegion}
      >
        <Icon name="add" type="ionicon" size={24} color="#0066CC" />
      </TouchableOpacity>
      
      {/* Zoom Out */}
      <TouchableOpacity
        style={styles.controlButton}
        onPress={handleZoomOut}
        disabled={!currentRegion}
      >
        <Icon name="remove" type="ionicon" size={24} color="#0066CC" />
      </TouchableOpacity>
    </View>
  );

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
      {/* Service Type Chips */}
      <SafeAreaView style={styles.topSafeArea}>
        {renderServiceTypeChips()}
      </SafeAreaView>

      <MapView
        ref={mapRef}
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
        onRegionChangeComplete={handleRegionChangeComplete}
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

      {/* Map Controls */}
      {renderMapControls()}

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
    top: Platform.OS === 'ios' ? 120 : 80,
    right: 15,
    zIndex: 20,
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
  topSafeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 15,
    paddingTop: Platform.OS === 'ios' ? 44 : 24,
  },
  chipsContainer: {
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  chipsScrollContent: {
    paddingHorizontal: 5,
  },
  chip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  chipSelected: {
    backgroundColor: '#0066CC',
    borderColor: '#0066CC',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  chipIcon: {
    marginLeft: 6,
  },
  mapControlsContainer: {
    position: 'absolute',
    bottom: 50,
    right: 15,
    zIndex: 20,
    flexDirection: 'column',
    alignItems: 'center',
  },
  controlButton: {
    backgroundColor: '#FFFFFF',
    width: 44,
    height: 44,
    borderRadius: 22,
    marginVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  locationButton: {
    backgroundColor: '#0066CC',
    marginBottom: 8,
  },
});

export default MapScreen;
