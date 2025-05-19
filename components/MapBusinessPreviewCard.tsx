import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { Card, Icon } from '@rneui/themed';

const screenWidth = Dimensions.get('window').width;

export interface PreviewBusiness {
  id: string;
  name: string;
  address: string | null;
  photos: string[] | null;
  // Gelecekte eklenebilecek diğer alanlar: description, rating vb.
}

interface MapBusinessPreviewCardProps {
  business: PreviewBusiness;
  onPress: () => void;
  onClose?: () => void; // Opsiyonel kapatma butonu için
}

const MapBusinessPreviewCard: React.FC<MapBusinessPreviewCardProps> = ({ business, onPress, onClose }) => {
  const firstPhoto = business.photos && business.photos.length > 0 ? business.photos[0] : null;

  return (
    <TouchableOpacity onPress={onPress} style={styles.touchableWrapper}>
      <Card containerStyle={styles.cardContainer}>
        <View style={styles.cardContent}>
          {firstPhoto ? (
            <Image source={{ uri: firstPhoto }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Icon name="store" type="material-community" size={40} color="#888" />
            </View>
          )}
          <View style={styles.textContainer}>
            <Text style={styles.businessName} numberOfLines={1}>
              {business.name}
            </Text>
            {business.address && (
              <Text style={styles.businessAddress} numberOfLines={1}>
                {business.address}
              </Text>
            )}
          </View>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" type="material-community" size={24} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  touchableWrapper: {
    // Kartın gölgesinin görünmesi için bir miktar boşluk bırakabiliriz.
    // Genişlik ve pozisyonlama MapScreen'de ayarlanacak.
  },
  cardContainer: {
    width: screenWidth * 0.9, // Genişlik artırıldı
    padding: 0, // Card'ın kendi padding'ini sıfırla
    borderRadius: 12, // Biraz daha yuvarlak köşeler
    margin: 0, // TouchableOpacity'den gelecek
    elevation: 4, // Gölge biraz daha belirgin
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  image: {
    width: 100, // Resim boyutu artırıldı
    height: 100, // Resim boyutu artırıldı
    borderTopLeftRadius: 12, // Köşeler güncellendi
    borderBottomLeftRadius: 12, // Köşeler güncellendi
  },
  imagePlaceholder: {
    width: 100, // Resim boyutu artırıldı
    height: 100, // Resim boyuto artırıldı
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 12, // Köşeler güncellendi
    borderBottomLeftRadius: 12, // Köşeler güncellendi
  },
  textContainer: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  businessName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  businessAddress: {
    fontSize: 13,
    color: '#666',
  },
  closeButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    padding: 5,
  }
});

export default MapBusinessPreviewCard; 