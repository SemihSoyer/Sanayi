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
  const screenWidth = Dimensions.get('window').width;
  const isSmallScreen = screenWidth < 380;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { width: itemWidth },
        // Sağdaki eleman için sağ marjı kaldır
        isLastInRow ? {} : { marginRight: 12 } 
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

      <View style={[styles.infoContainer, isSmallScreen && styles.infoContainerSmall]}>
        <Text style={[styles.name, isSmallScreen && styles.nameSmall]} numberOfLines={2}>{item.name || 'İşletme Adı'}</Text>

        {/* İşletme Hizmetleri */}
        {item.services && item.services.length > 0 && (
          <View style={styles.servicesContainer}>
            {item.services.slice(0, isSmallScreen ? 1 : 2).map((service, index) => ( // Küçük ekranda sadece 1, normal ekranda 2 hizmet
              <View key={index} style={[styles.serviceTag, isSmallScreen && styles.serviceTagSmall]}>
                <Icon name="checkmark-circle-outline" type="ionicon" size={isSmallScreen ? 11 : 13} color="#4CAF50" />
                <Text style={[styles.serviceTagText, isSmallScreen && styles.serviceTagTextSmall]} numberOfLines={1}>{service.name}</Text>
              </View>
            ))}
            {item.services.length > (isSmallScreen ? 1 : 2) && (
              <Text style={[styles.moreServicesText, isSmallScreen && styles.moreServicesTextSmall]}>
                + {item.services.length - (isSmallScreen ? 1 : 2)} daha
              </Text>
            )}
          </View>
        )}

        {item.city_name && (
          <Text style={[styles.location, isSmallScreen && styles.locationSmall]} numberOfLines={1}>
            {item.address ? `${item.address}, ${item.city_name}` : item.city_name}
          </Text>
        )}
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
    marginBottom: 12, // Alt boşluk eklendi
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
  infoContainerSmall: {
    padding: 8, // Küçük ekranda daha az padding
  },
  name: {
    fontSize: 16, // Boyut biraz daha artırıldı
    fontWeight: 'bold', // Daha belirgin
    color: '#333',
    marginBottom: 6,
    lineHeight: 22,
  },
  nameSmall: {
    fontSize: 14,
    marginBottom: 4,
    lineHeight: 18,
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
  serviceTagSmall: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginRight: 4,
    marginBottom: 4,
    borderRadius: 8,
  },
  serviceTagText: {
    fontSize: 11,
    color: '#388E3C', // Koyu yeşil yazı
    marginLeft: 5,
    fontWeight: '500',
  },
  serviceTagTextSmall: {
    fontSize: 10,
    marginLeft: 3,
  },
  moreServicesText: {
    fontSize: 11,
    color: '#007AFF',
    marginLeft: 4,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  moreServicesTextSmall: {
    fontSize: 10,
    marginLeft: 2,
  },
  location: {
    fontSize: 13, // Boyut artırıldı
    color: '#666',
    marginTop: 4,
  },
  locationSmall: {
    fontSize: 11,
    marginTop: 2,
  },
});

export default BusinessGridItem; 