import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Image as RNImage } from 'react-native';
import { Card, Icon } from '@rneui/themed';
import { supabase } from '../lib/supabase';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

// BusinessDetailScreen'e yönlendirme için tip tanımı (App.tsx'deki RootStackParamList'e göre güncellenecek)
// Şimdilik owner_id veya business_id (hangisi kullanılacaksa) parametresini kabul edecek şekilde genel tutalım.
// owner_id, businesses tablosunun PK'sı olduğu için onu kullanalım.
type RootStackParamList = {
  BusinessDetail: { businessOwnerId: string }; 
  // Diğer ekranlarınız...
};
type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'BusinessDetail'>;


interface ListedBusiness {
  owner_id: string; // businesses tablosunun PK'sı
  name: string;
  description: string | null;
  address: string | null;
  photos: string[] | null; // Sadece ilk fotoğrafı kullanacağız
  // is_published alanı RLS ile filtrelendiği için burada zorunlu değil ama veri modelinde olabilir.
}

const HomeScreen = () => {
  const [businesses, setBusinesses] = useState<ListedBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigation = useNavigation<HomeScreenNavigationProp>();

  const fetchPublishedBusinesses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // RLS policy zaten sadece is_published = TRUE olanları getirecek,
      // ama yine de sorguda belirtmek iyi bir pratik olabilir.
      const { data, error: fetchError } = await supabase
        .from('businesses')
        .select('owner_id, name, description, address, photos')
        .eq('is_published', true); // Sadece yayınlanmış olanları çek

      if (fetchError) throw fetchError;

      setBusinesses(data || []);
    } catch (err) {
      if (err instanceof Error) {
        setError('İşletmeler yüklenirken bir hata oluştu: ' + err.message);
        console.error(err);
      } else {
        setError('Bilinmeyen bir hata oluştu.');
        console.error(err);
      }
      setBusinesses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPublishedBusinesses();
    }, [fetchPublishedBusinesses])
  );

  const renderBusinessItem = ({ item }: { item: ListedBusiness }) => (
    <TouchableOpacity onPress={() => navigation.navigate('BusinessDetail', { businessOwnerId: item.owner_id })}>
      <Card containerStyle={styles.card}>
        {item.photos && item.photos.length > 0 && item.photos[0] ? (
          <Card.Image source={{ uri: item.photos[0] }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={styles.noImageContainer}>
            <Icon name="image-off-outline" type="material-community" size={50} color="#ccc" />
          </View>
        )}
        <Card.Title style={styles.cardTitle}>{item.name}</Card.Title>
        <Card.Divider />
        <Text style={styles.cardDescription} numberOfLines={2}>
          {item.description || 'Açıklama bulunmuyor.'}
        </Text>
        {item.address && (
          <Text style={styles.cardAddress} numberOfLines={1}>
            <Icon name="location-pin" type="material" size={14} color="#555" /> {item.address}
          </Text>
        )}
      </Card>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0066CC" />
        <Text>İşletmeler yükleniyor...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Icon name="alert-circle-outline" type="ionicon" size={50} color="red" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={fetchPublishedBusinesses} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Tekrar Dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (businesses.length === 0) {
    return (
      <View style={styles.centered}>
        <Icon name="storefront-outline" type="material-community" size={50} color="#888" />
        <Text style={styles.emptyText}>Henüz yayınlanmış bir işletme bulunmuyor.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={businesses}
      renderItem={renderBusinessItem}
      keyExtractor={(item) => item.owner_id}
      contentContainerStyle={styles.listContainer}
      ListHeaderComponent={<Text style={styles.headerTitle}>Keşfet</Text>}
    />
  );
};

const styles = StyleSheet.create({
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
    backgroundColor: '#f8f9fa',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginVertical: 20,
    marginLeft: 12,
    color: '#333',
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
  cardAddress: {
    fontSize: 12,
    color: '#777',
    marginBottom: 12,
    marginHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
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
  }
});

export default HomeScreen;
