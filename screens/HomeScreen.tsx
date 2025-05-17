import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Image, Modal, ScrollView, Dimensions, StatusBar, SafeAreaView } from 'react-native'; // Image olarak değiştirildi, StatusBar ve SafeAreaView eklendi
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
            <Icon name="image-off-outline" type="material-community" size={50} color="#ccc" />
          </View>
        )}
        <View style={{paddingHorizontal: 12, paddingVertical: 10}}>
          <Text style={styles.cardTitle}>{item.name || ''}</Text>
          <Card.Divider />
          <Text style={styles.cardDescription} numberOfLines={2}>
            {item.description || 'Açıklama bulunmuyor.'}
          </Text>
          {item.address && (
            <View style={styles.addressContainer}>
              <Icon name="location-pin" type="material" size={14} color="#555" style={styles.addressIcon} />
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
        <Icon name="alert-circle-outline" type="ionicon" size={50} color="red" />
        <Text style={styles.errorText}>{error}</Text>
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
                  checkedColor="#007bff"
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
        keyExtractor={(item) => item.id} // PK olarak id kullanılıyor
        contentContainerStyle={[styles.listContainer, {paddingTop: 10}]}
        ListHeaderComponent={
          <View style={[styles.headerContainer, {marginTop: 40}]}>
            <Text style={styles.headerTitle}>Keşfet</Text>
            <Button 
              icon={<Icon name="filter" type="ionicon" color="#0066CC" size={20} />} 
              title="Filtrele"
              type="outline" 
              onPress={() => setFilterModalVisible(true)} 
              buttonStyle={styles.filterButton}
              titleStyle={styles.filterButtonTitle}
            />
          </View>
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Icon name="store-search-outline" type="material-community" size={50} color="#888" />
            <Text style={styles.emptyText}>
              {selectedServiceTypeIds.length > 0 ? "Seçili filtrelere uygun işletme bulunamadı." : "Henüz yayınlanmış bir işletme bulunmuyor."}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { // FlatList'i sarmalamak için
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingTop: 10, // Üst tarafta boşluk eklendi
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
  },
  listContainer: {
    paddingHorizontal: 8,
    paddingBottom: 20,
    // backgroundColor: '#f8f9fa', // container'a taşındı
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 20,
    paddingHorizontal: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  filterButton: {
    borderColor: '#0066CC',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterButtonTitle: {
    color: '#0066CC',
    marginLeft: 5,
  },
  card: {
    borderRadius: 12,
    marginHorizontal: 8,
    marginBottom: 16,
    padding: 0, // Card içindeki padding'i sıfırlayıp kendimiz yöneteceğiz
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  cardImageContainer: {
    width: '100%',
    height: 180,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  cardImage: {
    width: '100%',
    height: 180,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  noImageContainer: {
    width: '100%',
    height: 180,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 6,
    marginHorizontal: 12,
    color: '#333',
  },
  cardDescription: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
    marginHorizontal: 12,
    lineHeight: 20,
  },
  addressContainer: { // Yeni stil
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 12,
  },
  addressIcon: { // Yeni stil
    marginRight: 4,
  },
  addressTextContent: { // Yeni stil (eski cardAddress'in metin kısmı için)
    fontSize: 12,
    color: '#777',
    flexShrink: 1, // Uzun adreslerin taşmasını engellemek için
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#0066CC', // Yeni birincil mavi
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
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
    maxHeight: Dimensions.get('window').height * 0.5, // Ekran yüksekliğinin %50'si
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
  }
});

export default HomeScreen;
