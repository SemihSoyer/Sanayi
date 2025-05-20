import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Image, Modal, ScrollView, Dimensions, StatusBar, SafeAreaView, Platform } from 'react-native'; // Image olarak değiştirildi, StatusBar ve SafeAreaView eklendi
import { Card, Icon, Button, CheckBox } from '@rneui/themed'; // Button, CheckBox eklendi
import { supabase } from '../lib/supabase';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import BusinessListItem, { ListedBusiness } from '../components/BusinessListItem'; // BusinessListItem import edildi ve ListedBusiness buradan alındı
import BusinessGridItem from '../components/BusinessGridItem'; // BusinessGridItem import edildi

// BusinessDetailScreen'e yönlendirme için tip tanımı (App.tsx'deki RootStackParamList'e göre güncellenecek)
// Şimdilik owner_id veya business_id (hangisi kullanılacaksa) parametresini kabul edecek şekilde genel tutalım.
// owner_id, businesses tablosunun PK'sı olduğu için onu kullanalım.
type RootStackParamList = {
  BusinessDetail: { businessId: string }; // businessOwnerId -> businessId olarak değiştirildi
  // Diğer ekranlarınız...
};
type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'BusinessDetail'>;

interface ServiceType {
  id: string;
  name: string;
  icon_url?: string;
}

interface City { // Şehir arayüzü eklendi
  id: string;
  name: string;
}

type Business = {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  address: string;
  photos: string[];
  city_id: string;
  city_name: string;
  services?: { name: string }[]; // İşletmenin sunduğu hizmetler için eklendi
};

const screenWidth = Dimensions.get('window').width;
const numColumns = 2;
const spacing = 10;
const itemWidth = (screenWidth - spacing * (numColumns + 1)) / numColumns;

const HomeScreen = () => {
  const [allBusinesses, setAllBusinesses] = useState<ListedBusiness[]>([]);
  const [filteredBusinesses, setFilteredBusinesses] = useState<ListedBusiness[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [selectedServiceTypeIds, setSelectedServiceTypeIds] = useState<string[]>([]);
  const [cities, setCities] = useState<City[]>([]); // Şehirler state'i eklendi
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null); // Seçilen şehir ID'si
  
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);
  const [loadingServiceTypes, setLoadingServiceTypes] = useState(true);
  const [loadingCities, setLoadingCities] = useState(true); // Şehir yükleme durumu eklendi
  const [error, setError] = useState<string | null>(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [isGridView, setIsGridView] = useState(false); // Görünüm modu için state

  const navigation = useNavigation<HomeScreenNavigationProp>();

  const fetchData = useCallback(async () => {
    setLoadingBusinesses(true);
    setLoadingServiceTypes(true);
    setLoadingCities(true); // Şehir yüklemesini başlat
    setError(null);
    try {
      // Hizmet türlerini çek
      const { data: serviceTypesData, error: serviceTypesError } = await supabase
        .from('ServiceTypes')
        .select('id, name, icon_url');
      if (serviceTypesError) throw serviceTypesError;
      setServiceTypes(serviceTypesData || []);

      // Şehirleri çek
      const { data: citiesData, error: citiesError } = await supabase
        .from('cities')
        .select('id, name')
        .order('name', { ascending: true });
      if (citiesError) throw citiesError;
      setCities(citiesData || []);
      setLoadingCities(false);

      // Yayınlanmış işletmeleri çek
      const { data: businessesData, error: businessesError } = await supabase
        .from('businesses')
        .select(`
          id, 
          owner_id, 
          name, 
          description, 
          address, 
          photos,
          city_id,
          city:cities(name),
          BusinessServices!inner(service_type_id, ServiceTypes!inner(name))
        `)
        .eq('is_published', true);

      if (businessesError) throw businessesError;
      
      const processedBusinesses = businessesData?.map(business => {
        const cityInfo = business.city as { name: string }[] | null; 
        
        // Gelen BusinessServices yapısı: { ServiceTypes: { name: string } }[] şeklinde olmalı
        // Veya { service_type_id: string, ServiceTypes: { name: string } }[] şeklinde
        // Supabase join syntaxına göre bunu ayarlamamız lazım.
        // Şimdilik any[] olarak alıp, map içinde kontrol edelim.
        const rawServices = (business.BusinessServices || []) as any[];
        const services = rawServices
          .map(bs => bs.ServiceTypes?.name)
          .filter(name => typeof name === 'string')
          .map(name => ({ name: name as string }));

        return {
          ...business,
          city_name: cityInfo && cityInfo.length > 0 ? cityInfo[0].name : null,
          city: undefined, 
          services: services,
          BusinessServices: undefined, 
        };
      }) || [];
      
      setAllBusinesses(processedBusinesses as ListedBusiness[]);
      setFilteredBusinesses(processedBusinesses as ListedBusiness[]);

    } catch (err) {
      if (err instanceof Error) {
        setError('Veriler yüklenirken bir hata oluştu: ' + err.message);
        console.error(err);
      } else {
        setError('Bilinmeyen bir hata oluştu.');
        console.error(err);
      }
      setAllBusinesses([]);
      setFilteredBusinesses([]);
      setServiceTypes([]);
      setCities([]);
    } finally {
      setLoadingBusinesses(false);
      setLoadingServiceTypes(false);
      setLoadingCities(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const applyFilters = async () => {
    setFilterModalVisible(false);
    setLoadingBusinesses(true);
    setError(null);

    try {
      let filteredData = [...allBusinesses];
      
      // Şehir filtresini uygula
      if (selectedCityId) {
        filteredData = filteredData.filter(business => business.city_id === selectedCityId);
      }
      
      // Hizmet türü filtresini uygula
      if (selectedServiceTypeIds.length > 0) {
        // Önerilen RPC fonksiyonunu kullanma
        const { data, error } = await supabase.rpc('get_businesses_by_service_types', { 
          p_service_type_ids: selectedServiceTypeIds // RPC'ye parametre olarak gönder
        });

        if (error) {
          console.error("RPC Error:", error);
          throw error;
        }
        
        // Hizmet türlerinden gelen işyerlerini ve şehir filtresinin kesişimini al
        const filteredIds = data?.map((item: any) => item.id) || [];
        filteredData = filteredData.filter(business => filteredIds.includes(business.id));
      }
      
      setFilteredBusinesses(filteredData);
    } catch (err) {
      if (err instanceof Error) {
        setError('Filtreleme sırasında bir hata oluştu: ' + err.message);
        console.error("Filter Error:", err); 
      } else {
        setError('Filtreleme sırasında bilinmeyen bir hata oluştu.');
        console.error("Filter Error (unknown):", err);
      }
      setFilteredBusinesses([]); // Hata durumunda listeyi boşalt
    } finally {
      setLoadingBusinesses(false);
    }
  };

  const clearFilters = () => {
    setSelectedServiceTypeIds([]);
    setSelectedCityId(null); // Şehir filtresini de temizle
    setFilteredBusinesses(allBusinesses);
    setFilterModalVisible(false);
  };

  const handleServiceTypeToggle = (serviceTypeId: string) => {
    setSelectedServiceTypeIds(prev => 
      prev.includes(serviceTypeId) 
        ? prev.filter(id => id !== serviceTypeId) 
        : [...prev, serviceTypeId]
    );
  };

  const renderBusinessItem = ({
    item,
    index,
  }: {
    item: any; 
    index: number;
  }) => {
    if (isGridView) {
      // Izgaradaki son eleman olup olmadığını kontrol et
      const isLastInRow = (index + 1) % numColumns === 0;
      return <BusinessGridItem item={item} itemWidth={itemWidth} isLastInRow={isLastInRow} />;
    }
    return <BusinessListItem item={item} />;
  };

  const toggleViewMode = () => {
    setIsGridView(prev => !prev);
  };

  const renderListHeader = () => (
    <View style={styles.headerOuterContainer}>
      <Text style={styles.headerTitleText}>Yakındaki Tamirciler</Text>
      <View style={styles.headerButtonsContainer}>
        <Button
          type="clear"
          icon={<Icon name={isGridView ? "list-outline" : "apps-outline"} type="ionicon" color="#007AFF" size={24} />}
          onPress={toggleViewMode}
          containerStyle={styles.headerButton}
        />
        <Button
          type="clear"
          icon={<Icon name="filter-outline" type="ionicon" color="#007AFF" size={24} />}
          onPress={() => setFilterModalVisible(true)}
          containerStyle={styles.headerButton}
        />
      </View>
    </View>
  );

  if (loadingBusinesses || loadingServiceTypes || loadingCities) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0066CC" />
        <Text>Veriler yükleniyor...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Icon name="alert-decagram-outline" type="material-community" size={60} color="#FF7675" />
        <Text style={styles.errorText}>Bir şeyler ters gitti ama biz buradayız! Tekrar dener misin? 🙏</Text>
        <TouchableOpacity onPress={fetchData} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Tekrar Dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      <Modal
        animationType="slide"
        transparent={true}
        visible={filterModalVisible}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filtreleme Seçenekleri</Text>
            
            {/* Şehir Filtresi */}
            <Text style={styles.modalSubtitle}>Şehir Seçimi</Text>
            {loadingCities ? (
              <ActivityIndicator size="small" color="#0066CC" style={{ marginVertical: 10 }} />
            ) : (
              <ScrollView style={[styles.modalScrollView, {maxHeight: Dimensions.get('window').height * 0.2}]} horizontal>
                <TouchableOpacity
                  style={[styles.cityChip, !selectedCityId && styles.cityChipSelected]}
                  onPress={() => setSelectedCityId(null)}
                >
                  <Text style={[styles.cityChipText, !selectedCityId && styles.cityChipTextSelected]}>Tümü</Text>
                </TouchableOpacity>
                {cities.map((city) => (
                  <TouchableOpacity
                    key={city.id}
                    style={[styles.cityChip, selectedCityId === city.id && styles.cityChipSelected]}
                    onPress={() => setSelectedCityId(city.id)}
                  >
                    <Text style={[styles.cityChipText, selectedCityId === city.id && styles.cityChipTextSelected]}>{city.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            
            {/* Hizmet Türü Filtresi */}
            <Text style={styles.modalSubtitle}>Hizmet Türü</Text>
            <ScrollView style={styles.modalScrollView}>
              {serviceTypes.map((service) => (
                <CheckBox
                  key={service.id}
                  title={service.name}
                  checked={selectedServiceTypeIds.includes(service.id)}
                  onPress={() => handleServiceTypeToggle(service.id)}
                  containerStyle={styles.checkboxContainerModal}
                  textStyle={styles.checkboxTextModal}
                  checkedColor="#0066CC"
                  uncheckedColor="#34495E"
                />
              ))}
            </ScrollView>
            <View style={styles.modalButtonContainer}>
              <Button 
                title="Temizle"
                onPress={clearFilters}
                type="outline" 
                buttonStyle={styles.modalButton} 
                titleStyle={styles.modalButtonTextClear}
              />
              <Button 
                title="Uygula"
                onPress={applyFilters}
                buttonStyle={[styles.modalButton, styles.modalButtonApply]} 
                titleStyle={styles.modalButtonTextApply}
              />
            </View>
          </View>
        </View>
      </Modal>

      <FlatList
        data={filteredBusinesses}
        renderItem={renderBusinessItem}
        keyExtractor={(item) => isGridView ? `grid-${item.id}` : `list-${item.id}`}
        numColumns={isGridView ? numColumns : 1}
        key={isGridView ? 'GRID' : 'LIST'}
        contentContainerStyle={isGridView ? styles.gridContainer : styles.listContainer}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={
          <View style={styles.centeredEmptyList}>
            <Icon name="compass-outline" type="material-community" size={60} color="#77AADD" />
            <Text style={styles.emptyText}>
              {selectedCityId || selectedServiceTypeIds.length > 0 ? 
                "Aradığın kriterlere uygun bir yer bulamadık. Farklı filtreler denemeye ne dersin? 😊" : 
                (allBusinesses.length === 0 && !loadingBusinesses ? "Henüz hiç işletme eklenmemiş. Keşfedilecek yerler yakında! 🚀" : "Civarda keşfedilecek yeni yerler yakında eklenecek! 🚀")}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E0F7FA', // Açık mavi arka plan
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F4F7FC',
  },
  centeredEmptyList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 50,
  },
  errorText: {
    marginTop: 15,
    fontSize: 17,
    color: '#D32F2F',
    textAlign: 'center',
    lineHeight: 24,
  },
  emptyText: {
    marginTop: 15,
    fontSize: 17,
    color: '#546E7A',
    textAlign: 'center',
    lineHeight: 24,
  },
  listContainer: {
    paddingBottom: 20,
  },
  gridContainer: {
    paddingHorizontal: spacing / 2,
    paddingBottom: 20,
    paddingTop: spacing, // Izgara için üst boşluk
  },
  headerOuterContainer: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 10 : 10,
    paddingBottom: 12,
    backgroundColor: '#E0F7FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  headerButtonsContainer: {
    flexDirection: 'row',
  },
  headerButton: {
    marginLeft: 8,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#55A6F7',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#2C3E50',
  },
  modalScrollView: {
    maxHeight: Dimensions.get('window').height * 0.5,
    marginBottom: 15,
  },
  checkboxContainerModal: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingVertical: 10,
    marginLeft: 0,
  },
  checkboxTextModal: {
    fontWeight: 'normal',
    fontSize: 16,
    color: '#34495E',
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 130,
    borderWidth: 1.5,
  },
  modalButtonTextClear: {
    color: '#4E7AC7',
    fontWeight: '600',
  },
  modalButtonApply: {
    backgroundColor: '#4E7AC7',
    borderColor: '#4E7AC7',
  },
  modalButtonTextApply: {
    color: 'white',
    fontWeight: '600',
  },
  modalSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginTop: 15,
    marginBottom: 10,
  },
  cityChip: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    marginBottom: 10,
    backgroundColor: '#EEF2F7',
    borderWidth: 1,
    borderColor: '#DDE4EB',
  },
  cityChipSelected: {
    backgroundColor: '#0066CC',
    borderColor: '#0066CC',
  },
  cityChipText: {
    fontSize: 14,
    color: '#4A5568',
  },
  cityChipTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
});

export default HomeScreen;
