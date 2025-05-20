import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, Icon } from '@rneui/themed';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

// HomeScreen'den kopyalanan tipler
type RootStackParamList = {
  BusinessDetail: { businessId: string };
  // Diğer ekranlarınız...
};
type NavigationProp = StackNavigationProp<RootStackParamList, 'BusinessDetail'>;

export interface ListedBusiness {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  address: string | null;
  photos: string[] | null;
  city_id?: string | null;
  city_name?: string | null;
  services?: { name: string }[];
}

interface BusinessListItemProps {
  item: ListedBusiness;
}

const BusinessListItem: React.FC<BusinessListItemProps> = ({ item }) => {
  const navigation = useNavigation<NavigationProp>();

  return (
    <TouchableOpacity onPress={() => navigation.navigate('BusinessDetail', { businessId: item.id })} style={styles.touchableWrapper}>
      <Card containerStyle={styles.card}>
        {item.photos && item.photos.length > 0 && item.photos[0] ? (
          <Card.Image source={{ uri: item.photos[0] }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={styles.noImageContainer}>
            <Icon name="storefront-outline" type="material-community" size={70} color="#A0D2FA" />
            <Text style={styles.noImageText}>Harika Bir Yer</Text>
          </View>
        )}
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.name || 'İşletme Adı Yok'}</Text>
          <Card.Divider style={styles.cardDivider} />
          <Text style={styles.cardDescription} numberOfLines={2}>
            {item.description || 'Açıklama yakında eklenecek.'}
          </Text>
          
          {/* İşletme Hizmetleri */}
          {item.services && item.services.length > 0 && (
            <View style={styles.servicesContainerList}>
              {item.services.slice(0, 3).map((service, index) => ( // İlk 3 hizmeti göster
                <View key={index} style={styles.serviceTagList}>
                  <Icon name="ellipse" type="ionicon" size={8} color="#55A6F7" style={{marginRight: 6}} />
                  <Text style={styles.serviceTagTextList} numberOfLines={1}>{service.name}</Text>
                </View>
              ))}
            </View>
          )}

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
};

// HomeScreen'den kopyalanan ve uyarlanan stiller
const styles = StyleSheet.create({
  touchableWrapper: {
    marginHorizontal: 16, // Kartın dışındaki tıklanabilir alan için yatay marj
    marginBottom: 20, // Kartlar arası dikey boşluk
  },
  card: {
    borderRadius: 20,
    marginHorizontal: 0,
    marginVertical: 0,
    padding: 0,
    elevation: 5,
    shadowColor: '#A8BBDC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 5,
    borderLeftColor: '#4A90E2',
  },
  cardImage: {
    width: '100%',
    height: 220,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  noImageContainer: {
    width: '100%',
    height: 220,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#2C3E50',
  },
  cardDivider: {
    marginVertical: 6,
    backgroundColor: '#DCE4F2',
    height: 1.5,
  },
  cardDescription: {
    fontSize: 15,
    color: '#5A6A78',
    marginBottom: 12,
    lineHeight: 22,
  },
  servicesContainerList: {
    marginBottom: 10,
  },
  serviceTagList: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  serviceTagTextList: {
    fontSize: 13,
    color: '#34495E',
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
});

export default BusinessListItem; 