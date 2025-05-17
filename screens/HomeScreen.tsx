import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Image, Modal, ScrollView, Dimensions, StatusBar, SafeAreaView, Platform } from 'react-native'; // Image olarak değiştirildi, StatusBar ve SafeAreaView eklendi
import { Card, Icon, Button, CheckBox } from '@rneui/themed'; // Button, CheckBox eklendi
import { supabase } from '../lib/supabase';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

// BusinessDetailScreen'e yönlendirme için tip tanımı (App.tsx'deki RootStackParamList'e göre güncellenecek)
// Şimdilik owner_id veya business_id (hangisi kullanılacaksa) parametresini kabul edecek şekilde genel tutalım.
// owner_id, businesses tablosunun PK'sı olduğu için onu kullanalım.
type RootStackParamList = {
  BusinessDetail: { businessId: string }; // businessOwnerId -> businessId olarak değiştirildi
  // Diğer ekranlarınız...
};
type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'BusinessDetail'>;

interface ListedBusiness {
  id: string; // businesses tablosunun PK'sı (owner_id yerine id kullanacağız)
  owner_id: string; 
  name: string;
  description: string | null;
  address: string | null;
  photos: string[] | null;
}

interface ServiceType {
  id: string;
  name: string;
  icon_url?: string;
}

const HomeScreen = () => {
  const [allBusinesses, setAllBusinesses] = useState<ListedBusiness[]>([]);
  const [filteredBusinesses, setFilteredBusinesses] = useState<ListedBusiness[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [selectedServiceTypeIds, setSelectedServiceTypeIds] = useState<string[]>([]);
  
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);
  const [loadingServiceTypes, setLoadingServiceTypes] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const navigation = useNavigation<HomeScreenNavigationProp>();

  const fetchData = useCallback(async () => {
    setLoadingBusinesses(true);
    setLoadingServiceTypes(true);
    setError(null);
    try {
      // Hizmet türlerini çek
      const { data: serviceTypesData, error: serviceTypesError } = await supabase
        .from('ServiceTypes')
        .select('id, name, icon_url');
      if (serviceTypesError) throw serviceTypesError;
      setServiceTypes(serviceTypesData || []);

      // Yayınlanmış işletmeleri çek (RPC kullanmadan önce basit filtreleme)
      // owner_id yerine id'yi PK olarak kullanıyoruz, bu yüzden select'te id olmalı.
      const { data: businessesData, error: businessesError } = await supabase
        .from('businesses')
        .select('id, owner_id, name, description, address, photos')
        .eq('is_published', true);

      if (businessesError) throw businessesError;
      
      setAllBusinesses(businessesData || []);
      setFilteredBusinesses(businessesData || []); // Başlangıçta tümü filtrelenmiş

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
    } finally {
      setLoadingBusinesses(false);
      setLoadingServiceTypes(false);
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

    // selectedServiceTypeIds boş olsa bile RPC'ye gönderebiliriz,
    // RPC fonksiyonu bu durumu ele alacak şekilde güncellendi (SQL tanımında array_length kontrolü var).
    // if (selectedServiceTypeIds.length === 0) {
    //   setFilteredBusinesses(allBusinesses);
    //   setLoadingBusinesses(false);
    //   return;
    // }

    try {
      // Önerilen RPC fonksiyonunu kullanma
      const { data, error } = await supabase.rpc('get_businesses_by_service_types', { 
        p_service_type_ids: selectedServiceTypeIds // RPC'ye parametre olarak gönder
      });

      if (error) {
        console.error("RPC Error:", error);
        throw error;
      }
      setFilteredBusinesses(data || []); // RPC'den dönen veri ile state'i güncelle

      /* 
      // RPC yoksa istemci tarafı filtreleme (BU KISIM YORUM SATIRI YAPILDI)
      const { data: businessServiceEntries, error: bsError } = await supabase
        .from('BusinessServices')
        .select('business_id')
        .in('service_type_id', selectedServiceTypeIds);
      
      if (bsError) throw bsError;
      
      const businessIdsWithSelectedServices = businessServiceEntries.map(entry => entry.business_id);
      const uniqueBusinessIds = [...new Set(businessIdsWithSelectedServices)];

      const filtered = allBusinesses.filter(business => uniqueBusinessIds.includes(business.id));
      setFilteredBusinesses(filtered);
      */

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


  const renderBusinessItem = ({ item }: { item: ListedBusiness }) => (
    <TouchableOpacity onPress={() => navigation.navigate('BusinessDetail', { businessId: item.id })}> 
      <Card containerStyle={styles.card}>
        {item.photos && item.photos.length > 0 && item.photos[0] ? (
          <Card.Image source={{ uri: item.photos[0] }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={styles.noImageContainer}>
            <Icon name="storefront-outline" type="material-community" size={60} color="#A0D2FA" />
            <Text style={styles.noImageText}>Harika Bir Yer</Text>
          </View>
        )}
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.name || ''}</Text>
          <Card.Divider style={styles.cardDivider} />
          <Text style={styles.cardDescription} numberOfLines={2}>
            {item.description || 'Açıklama yakında eklenecek.'}
          </Text>
          {item.address && (
            <View style={styles.addressContainer}>
              <Icon name="location-pin" type="material" size={16} color="#0066CC" style={styles.addressIcon} />
              <Text style={styles.addressTextContent} numberOfLines={1}>{item.address}</Text>
            </View>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );

  if (loadingBusinesses || loadingServiceTypes) {
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
            <Text style={styles.modalTitle}>Hizmet Türüne Göre Filtrele</Text>
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
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContainer, {paddingTop: 10}]}
        ListHeaderComponent={
          <View style={styles.headerOuterContainer}>
            <View style={styles.gradientHeader}>
              <View style={styles.headerContainer}>
                <Text style={styles.headerTitle}>Merhaba!</Text>
                <Button 
                  icon={<Icon name="filter-variant" type="material-community" color="#0066CC" size={22} />} 
                  title="Filtrele"
                  type="outline" 
                  onPress={() => setFilterModalVisible(true)} 
                  buttonStyle={styles.filterButton}
                  titleStyle={styles.filterButtonTitle}
                />
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Icon name="compass-outline" type="material-community" size={60} color="#77AADD" />
            <Text style={styles.emptyText}>
              {selectedServiceTypeIds.length > 0 ? "Aradığın kriterlere uygun bir yer bulamadık. Farklı filtreler denemeye ne dersin? 😊" : "Civarda keşfedilecek yeni yerler yakında eklenecek! 🚀"}
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
    backgroundColor: '#F4F7FC',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F4F7FC',
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
    paddingHorizontal: 0,
    paddingBottom: 20,
  },
  headerOuterContainer: { 
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 10 : 15, 
    paddingBottom: 8,
    backgroundColor: '#F4F7FC',
  },
  gradientHeader: {
    backgroundColor: '#F4F7FC',
    borderBottomWidth: 1,
    borderBottomColor: '#E3E9F3',
    marginBottom: 5,
    paddingBottom: 5,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 5,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2C3E50',
    lineHeight: 28,
  },
  filterButton: {
    borderColor: '#4E7AC7',
    backgroundColor: '#EBF5FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 25,
    borderWidth: 1.5,
  },
  filterButtonTitle: {
    color: '#4E7AC7',
    marginLeft: 8,
    fontWeight: '600',
    fontSize: 15,
  },
  card: {
    borderRadius: 18,
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 0, 
    elevation: 4,
    shadowColor: '#B0C4DE',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 4,
    borderLeftColor: '#55A6F7',
  },
  cardImageContainer: {
    width: '100%',
    height: 200,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  cardImage: {
    width: '100%',
    height: 200,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  noImageContainer: {
    width: '100%',
    height: 200,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: '#E9F5FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageText: {
    marginTop: 8,
    fontSize: 14,
    color: '#55A6F7',
  },
  cardContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
    color: '#34495E',
  },
  cardDivider: {
    marginVertical: 4,
    backgroundColor: '#E5EEF7',
    height: 1,
  },
  cardDescription: {
    fontSize: 14,
    color: '#7F8C8D',
    marginBottom: 10,
    lineHeight: 20,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#F4FAFF',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  addressIcon: {
    marginRight: 6,
  },
  addressTextContent: {
    fontSize: 12,
    color: '#4E7AC7',
    flexShrink: 1,
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
  }
});

export default HomeScreen;
