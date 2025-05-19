import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Dimensions, Image, TouchableOpacity } from 'react-native';
import { Card, Icon, Button } from '@rneui/themed';
import { supabase } from '../lib/supabase';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App'; // App.tsx'den RootStackParamList'i import et

// MyBusinessScreen'den BusinessDetails arayüzünü alabiliriz veya benzerini tanımlayabiliriz.
interface BusinessDetails {
  id: string; // İşletme ID'si
  owner_id: string;
  name: string;
  description: string | null;
  address: string | null;
  photos: string[] | null;
  latitude: number | null;
  longitude: number | null;
  is_published: boolean;
}

const screenWidth = Dimensions.get('window').width;

type BusinessDashboardNavigationProp = StackNavigationProp<RootStackParamList, 'App'>;


const BusinessDashboardScreen = () => {
  const navigation = useNavigation<BusinessDashboardNavigationProp>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [business, setBusiness] = useState<BusinessDetails | null>(null);
  const [dailyClickCount, setDailyClickCount] = useState<number | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async (currentOwnerIdParam?: string) => {
    let effectiveOwnerId = currentOwnerIdParam;
    console.log('[Dashboard] fetchDashboardData called. Param ownerId:', currentOwnerIdParam);

    if (!effectiveOwnerId) {
      console.log('[Dashboard] currentOwnerIdParam is null or undefined, attempting to fetch session.');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        setError("Oturum bilgisi alınırken hata: " + sessionError.message);
        setLoading(false); setRefreshing(false); return;
      }
      if (!session?.user?.id) {
        setError("Kullanıcı oturumu bulunamadı. Lütfen tekrar giriş yapın.");
        setLoading(false); setRefreshing(false);
        console.log('[Dashboard] Session or user ID not found.');
        return;
      }
      effectiveOwnerId = session.user.id;
      setOwnerId(effectiveOwnerId); // State'i güncelle
      console.log('[Dashboard] Owner ID fetched from session:', effectiveOwnerId);
    } else {
      console.log('[Dashboard] Owner ID provided from param:', effectiveOwnerId);
    }
    
    // setLoading ve setError çağrıları effectiveOwnerId kesinleştikten sonra
    setLoading(true);
    setError(null);
    console.log(`[Dashboard] Attempting to fetch data for owner_id: ${effectiveOwnerId}`);

    try {
      // 1. İşletme bilgilerini çek
      console.log(`[Dashboard] Querying businesses table for owner_id: ${effectiveOwnerId}`);
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('id, owner_id, name, description, address, photos, latitude, longitude, is_published')
        .eq('owner_id', effectiveOwnerId) // effectiveOwnerId kullan
        .order('created_at', { ascending: true }) // En eski işletmeyi almak için (opsiyonel, created_at sütunu varsa)
        .limit(1) // Sadece bir kayıt al
        .maybeSingle();

      console.log('[Dashboard] Supabase businesses query response - Data:', JSON.stringify(businessData, null, 2));
      console.log('[Dashboard] Supabase businesses query response - Error:', JSON.stringify(businessError, null, 2));

      if (businessError && businessError.code !== 'PGRST116') { // PGRST116: Kayıt bulunamadı hatası değilse
        console.error('[Dashboard] Error fetching business details (not PGRST116):', businessError);
        throw businessError;
      }

      if (!businessData) {
        console.log('[Dashboard] No business data found for owner_id:', effectiveOwnerId);
        setError('Henüz bir işletmeniz bulunmuyor veya yayınlanmamış. Lütfen "İşyerim" sekmesinden ekleyin/yayınlayın.');
        setBusiness(null);
        setDailyClickCount(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      console.log('[Dashboard] Business data found:', businessData.name);
      setBusiness(businessData as BusinessDetails);

      // 2. Günlük tıklama sayısını çek
      const today = new Date();
      const todayStart = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const todayEnd = new Date(today.setHours(23, 59, 59, 999)).toISOString();

      const { count, error: clickError } = await supabase
        .from('businessclicks') // Tablo adı küçük harfe çevrildi
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessData.id)
        .gte('clicked_at', todayStart)
        .lte('clicked_at', todayEnd);

      if (clickError) {
        console.warn("Error fetching daily clicks:", clickError.message);
        // Hata olsa bile paneli göstermeye devam et, tıklama sayısı null olur.
      }
      setDailyClickCount(count ?? 0);
      console.log('[Dashboard] Daily click count fetched:', count ?? 0);
      console.log('[Dashboard] Daily click fetch error:', JSON.stringify(clickError, null, 2));

    } catch (err) {
      if (err instanceof Error) {
        setError('Panel verileri yüklenirken bir hata oluştu: ' + err.message);
        console.error("Dashboard fetch error:", err);
      } else {
        setError('Bilinmeyen bir hata oluştu.');
        console.error("Dashboard unknown fetch error:", err);
      }
      setBusiness(null);
      setDailyClickCount(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // ownerId state'i üzerinden veri çek, ilk yüklemede ownerId null olabilir.
      // fetchDashboardData fonksiyonu kendi içinde ownerId'yi setSession ile alacak.
      fetchDashboardData(ownerId ?? undefined);
    }, [fetchDashboardData, ownerId])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboardData(ownerId ?? undefined);
  }, [fetchDashboardData, ownerId]);

  const navigateToBusinessDetail = () => {
    if (business?.id) {
      navigation.navigate('BusinessDetail', { businessId: business.id });
    }
  };
  
  const navigateToMyBusiness = () => {
    // MyBusinessScreen'e gitmek için Tab Navigator'daki ismi kullanmalıyız.
    // App.tsx'de 'İşyerim' olarak tanımlanmış.
    // Bu direkt bir stack navigasyonu değil, tab navigasyonu olduğu için farklı bir yaklaşım gerekebilir.
    // Şimdilik bu butonu yorumda bırakalım veya App.tsx'deki tab navigator'a erişim şeklini kontrol edelim.
    // navigation.navigate('MyBusiness'); // Bu muhtemelen çalışmayacak
    // Doğrusu: (navigation as any).navigate('İşyerim');
    (navigation as any).navigate('İşyerim');
  };


  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0066CC" />
        <Text style={styles.infoText}>Panel yükleniyor...</Text>
      </View>
    );
  }

  if (error && !business) { // Sadece işletme yoksa ve hata varsa bu ekranı göster
    return (
      <ScrollView
        contentContainerStyle={styles.centered}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Icon name="alert-circle-outline" type="ionicon" size={50} color="#ff6347" />
        <Text style={styles.errorText}>{error}</Text>
        {error.includes("işletmeniz bulunmuyor") && (
           <Button title="İşyeri Ekle/Yayınla" onPress={navigateToMyBusiness} buttonStyle={{marginTop: 20}}/>
        )}
      </ScrollView>
    );
  }
  
  if (!business) { // İşletme yoksa ama hata da yoksa (ilk yükleme veya veri yok durumu)
     return (
      <ScrollView
        contentContainerStyle={styles.centered}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Icon name="store-search-outline" type="material-community" size={50} color="#888" />
        <Text style={styles.infoText}>İşletme bilgisi bulunamadı. "İşyerim" sekmesinden ekleyebilir veya yayınlayabilirsiniz.</Text>
        <Button title="İşyerim Sayfasına Git" onPress={navigateToMyBusiness} buttonStyle={{marginTop: 20}}/>
      </ScrollView>
    );
  }


  // Anasayfa Kartı Önizlemesi (Basit versiyon)
  const renderHomeScreenPreview = () => (
    <Card containerStyle={styles.previewCard}>
      <Card.Title>Anasayfa Görünümü</Card.Title>
      <Card.Divider />
      {business.photos && business.photos.length > 0 && (
        <Image source={{ uri: business.photos[0] }} style={styles.homePreviewImage} resizeMode="cover" />
      )}
      <Text style={styles.homePreviewName}>{business.name}</Text>
      <Text style={styles.homePreviewAddress} numberOfLines={1}>{business.address || "Adres belirtilmemiş"}</Text>
    </Card>
  );

  // Detay Ekranı Önizlemesi (Basit versiyon)
  const renderDetailScreenPreview = () => (
    <Card containerStyle={styles.previewCard}>
      <Card.Title>Detay Ekranı Önizlemesi</Card.Title>
      <Card.Divider />
      <Text style={styles.detailPreviewName}>{business.name}</Text>
      {business.photos && business.photos.length > 0 && (
        <Image source={{ uri: business.photos[0] }} style={styles.detailPreviewImage} resizeMode="cover" />
      )}
      <Text style={styles.detailPreviewDescription} numberOfLines={3}>
        {business.description || "Açıklama bulunmuyor."}
      </Text>
      <Button
        title="Tam Detayları Gör (Önizleme)"
        type="outline"
        onPress={navigateToBusinessDetail}
        containerStyle={{ marginTop: 10 }}
      />
    </Card>
  );

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#0066CC"]} tintColor={"#0066CC"}/>}
    >
      <Text style={styles.headerTitle}>İşletme Paneli</Text>

      {error && <Text style={[styles.errorText, {marginHorizontal: 20, marginBottom: 10}]}>{error}</Text>}

      <Card containerStyle={styles.statsCard}>
        <Card.Title>Günlük İstatistikler</Card.Title>
        <Card.Divider />
        <View style={styles.statItem}>
          <Icon name="eye-outline" type="ionicon" size={24} color="#0066CC" />
          <Text style={styles.statText}>Bugünkü Görüntülenme Sayısı:</Text>
          <Text style={styles.statValue}>{dailyClickCount !== null ? dailyClickCount : <ActivityIndicator size="small" />}</Text>
        </View>
        {!business.is_published && (
          <View style={styles.warningContainer}>
            <Icon name="warning-outline" type="ionicon" color="#ffa000" size={20} />
            <Text style={styles.warningText}>İşletmeniz şu anda yayında değil. İstatistikler ve önizlemeler güncel olmayabilir.</Text>
          </View>
        )}
      </Card>

      {renderHomeScreenPreview()}
      {renderDetailScreenPreview()}
      
      <View style={{height: 30}} /> 
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E0F7FA',
  },
  centered: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#E0F7FA',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginVertical: 20,
  },
  infoText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 15,
  },
  errorText: {
    fontSize: 15,
    color: '#d9534f',
    textAlign: 'center',
    marginBottom: 10,
  },
  statsCard: {
    borderRadius: 10,
    marginBottom: 20,
    padding: 15,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  statText: {
    fontSize: 16,
    marginLeft: 10,
    color: '#454545',
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0066CC',
  },
  previewCard: {
    borderRadius: 10,
    marginBottom: 20,
    padding: 15,
  },
  homePreviewImage: {
    width: '100%',
    height: 150,
    borderRadius: 6,
    marginBottom: 10,
    backgroundColor: '#e9ecef',
  },
  homePreviewName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  homePreviewAddress: {
    fontSize: 14,
    color: '#777',
    marginTop: 4,
  },
  detailPreviewName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  detailPreviewImage: {
    width: '100%',
    height: 180,
    borderRadius: 6,
    marginBottom: 10,
    backgroundColor: '#e9ecef',
  },
  detailPreviewDescription: {
    fontSize: 15,
    color: '#555',
    lineHeight: 22,
    marginTop: 5,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    padding: 10,
    borderRadius: 6,
    marginTop: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#ffa000',
  },
  warningText: {
    marginLeft: 10,
    color: '#856404',
    fontSize: 14,
    flexShrink: 1,
  }
});

export default BusinessDashboardScreen;
