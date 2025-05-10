import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image, Dimensions } from 'react-native';
import { Card, Icon } from '@rneui/themed';
import { supabase } from '../lib/supabase';
import { RouteProp, useRoute } from '@react-navigation/native';

// App.tsx'deki RootStackParamList'e göre güncellenecek
type RootStackParamList = {
  BusinessDetail: { businessOwnerId: string };
  // Diğer ekranlarınız...
};

type BusinessDetailScreenRouteProp = RouteProp<RootStackParamList, 'BusinessDetail'>;

interface BusinessFullDetails {
  owner_id: string;
  name: string;
  description: string | null;
  address: string | null;
  photos: string[] | null;
  is_published?: boolean; // RLS bunu filtreleyeceği için bu ekranda her zaman true olmalı
}

const screenWidth = Dimensions.get('window').width;

const BusinessDetailScreen = () => {
  const route = useRoute<BusinessDetailScreenRouteProp>();
  const { businessOwnerId } = route.params;

  const [business, setBusiness] = useState<BusinessFullDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBusinessDetails = useCallback(async () => {
    if (!businessOwnerId) {
      setError('İşletme kimliği bulunamadı.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('businesses')
        .select('owner_id, name, description, address, photos, is_published')
        .eq('owner_id', businessOwnerId)
        .eq('is_published', true) // Sadece yayınlanmış ve ID'si eşleşen işletmeyi çek
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') { // PostgREST code for " exactamente uma linha esperada, mas 0 linhas encontradas"
          setError('İşletme bulunamadı veya yayında değil.');
        } else {
          throw fetchError;
        }
      }
      setBusiness(data);
    } catch (err) {
      if (err instanceof Error) {
        setError('İşletme detayları yüklenirken bir hata oluştu: ' + err.message);
        console.error(err);
      } else {
        setError('Bilinmeyen bir hata oluştu.');
        console.error(err);
      }
      setBusiness(null);
    } finally {
      setLoading(false);
    }
  }, [businessOwnerId]);

  useEffect(() => {
    fetchBusinessDetails();
  }, [fetchBusinessDetails]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text>İşletme detayları yükleniyor...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Icon name="alert-circle-outline" type="ionicon" size={50} color="red" />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!business) {
    return (
      <View style={styles.centered}>
        <Icon name="store-remove-outline" type="material-community" size={50} color="#888" />
        <Text style={styles.emptyText}>İşletme bulunamadı.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Card containerStyle={styles.card}>
        <Card.Title style={styles.title}>{business.name}</Card.Title>
        <Card.Divider />

        {business.photos && business.photos.length > 0 && (
          <View style={styles.photosSection}>
            <Text style={styles.sectionTitle}>Fotoğraflar</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScrollView}>
              {business.photos.map((url, index) => (
                <Image key={index} source={{ uri: url }} style={styles.photo} resizeMode="cover" />
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.detailsSection}>
          <Text style={styles.sectionTitle}>Açıklama</Text>
          <Text style={styles.text}>{business.description || 'Açıklama bulunmuyor.'}</Text>
        </View>

        {business.address && (
          <View style={styles.detailsSection}>
            <Text style={styles.sectionTitle}>Adres</Text>
            <Text style={styles.text}>
              <Icon name="location-pin" type="material" size={16} color="#555" /> {business.address}
            </Text>
          </View>
        )}
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
  card: {
    borderRadius: 0, // Kenarlara tam yaslanması için
    margin: 0,
    padding: 0,
    borderWidth: 0,
    shadowColor: 'transparent', // Gölgeyi kaldır
    backgroundColor: 'transparent', // Arka planı şeffaf yap
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#333',
    paddingHorizontal: 15,
    paddingTop: 20,
    paddingBottom: 10,
    backgroundColor: '#fff',
  },
  photosSection: {
    marginBottom: 15,
    backgroundColor: '#fff',
    paddingVertical: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#444',
    marginBottom: 10,
    paddingHorizontal: 15,
  },
  photosScrollView: {
    paddingLeft: 15,
  },
  photo: {
    width: screenWidth * 0.7, // Ekran genişliğinin %70'i
    height: screenWidth * 0.5, // Genişliğe oranlı yükseklik
    borderRadius: 10,
    marginRight: 10,
    backgroundColor: '#e9ecef',
  },
  detailsSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 15,
    marginBottom: 10, // Bölümler arası boşluk
  },
  text: {
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
  },
});

export default BusinessDetailScreen;
