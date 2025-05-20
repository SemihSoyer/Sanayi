import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { Icon } from '@rneui/themed';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { ListedBusiness } from './BusinessListItem'; // ListedBusiness arayüzünü yeniden kullan

// Navigation types (BusinessListItem'dan benzer)
type RootStackParamList = {
  BusinessDetail: { businessId: string };
};
type NavigationProp = StackNavigationProp<RootStackParamList, 'BusinessDetail'>;

interface BusinessGridItemProps {
  item: ListedBusiness;
  itemWidth: number;
  // İki kart arasına boşluk eklemek için margin bilgisi
  isLastInRow?: boolean; 
}

const BusinessGridItem: React.FC<BusinessGridItemProps> = ({ item, itemWidth, isLastInRow }) => {
  const navigation = useNavigation<NavigationProp>();

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { width: itemWidth },
        // Sağdaki eleman için sağ marjı kaldır
        isLastInRow ? {} : { marginRight: styles.container.marginRight } 
      ]}
      onPress={() => navigation.navigate('BusinessDetail', { businessId: item.id })}
    >
      <View style={styles.imageContainer}>
        {item.photos && item.photos.length > 0 && item.photos[0] ? (
          <Image source={{ uri: item.photos[0] }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.noImagePlaceholder]}>
            <Icon name="storefront-outline" type="material-community" size={40} color="#B0BEC5" />
          </View>
        )}
        {/* Favori ikonu sağ üst köşede kalacak */}
        <TouchableOpacity style={styles.favoriteIconContainer} onPress={() => console.log('Favorilere eklendi:', item.id)}>
          <Icon name="heart-outline" type="ionicon" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.name} numberOfLines={2}>{item.name || 'İşletme Adı'}</Text>

        {/* İşletme Hizmetleri */}
        {item.services && item.services.length > 0 && (
          <View style={styles.servicesContainer}>
            {item.services.slice(0, 2).map((service, index) => ( // İlk 2 hizmeti göster
              <View key={index} style={styles.serviceTag}>
                <Icon name="checkmark-circle-outline" type="ionicon" size={13} color="#4CAF50" />
                <Text style={styles.serviceTagText} numberOfLines={1}>{service.name}</Text>
              </View>
            ))}
            {item.services.length > 2 && (
              <Text style={styles.moreServicesText}>+ {item.services.length - 2} daha</Text>
            )}
          </View>
        )}

        {item.city_name && <Text style={styles.location} numberOfLines={1}>{item.address ? `${item.address}, ${item.city_name}` : item.city_name}</Text>}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16, // Köşe yuvarlaklığı artırıldı
    overflow: 'hidden',
    elevation: 4, // Gölge biraz artırıldı
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, // Gölge ayarlandı
    shadowOpacity: 0.15, // Gölge ayarlandı
    shadowRadius: 3.5, // Gölge ayarlandı
    marginRight: 12, // Boşluk ayarlandı
    // itemWidth HomeScreen'den geliyor, padding/margin ile genel genişliği etkileyecek
    // Kartı biraz büyütmek için infoContainer padding'ini ve resim yüksekliğini ayarlayacağız
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 16 / 10, // Oran biraz daha genişletildi, bu yüksekliği artıracak
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  noImagePlaceholder: {
    backgroundColor: '#ECEFF1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteIconContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    padding: 12, // Padding biraz artırıldı
  },
  name: {
    fontSize: 16, // Boyut biraz daha artırıldı
    fontWeight: 'bold', // Daha belirgin
    color: '#333',
    marginBottom: 6,
    lineHeight: 22,
  },
  servicesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9', // Açık yeşil arka plan
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 6,
  },
  serviceTagText: {
    fontSize: 11,
    color: '#388E3C', // Koyu yeşil yazı
    marginLeft: 5,
    fontWeight: '500',
  },
  moreServicesText: {
    fontSize: 11,
    color: '#007AFF',
    marginLeft: 4,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  location: {
    fontSize: 13, // Boyut artırıldı
    color: '#666',
    marginTop: 4,
  },
});

export default BusinessGridItem; 