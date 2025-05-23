import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  Image,
  Linking,
  Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface Appointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: 'pending' | 'approved' | 'completed' | 'cancelled';
  notes?: string;
  business: {
    name: string;
    description: string;
    photos?: string[];
    address?: string;
  } | null;
  customer: {
    full_name: string;
  } | null;
}

export default function AppointmentListScreen({ navigation }: any) {
  const { session, profile } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (profile) {
      fetchAppointments();
    }
  }, [profile]);

  const fetchAppointments = async () => {
    try {
      let query = supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          appointment_time,
          status,
          notes,
          business:businesses(name, description, photos, address),
          customer:profiles!customer_id(full_name)
        `)
        .order('appointment_date', { ascending: false });

      // Kullanıcı rolüne göre filtreleme
      if (profile?.role === 'customer') {
        query = query.eq('customer_id', profile.id);
      } else if (profile?.role === 'business_owner') {
        // İşletme sahibinin işletmelerini bul
        const { data: businesses } = await supabase
          .from('businesses')
          .select('id')
          .eq('owner_id', profile.id);
        
        if (businesses && businesses.length > 0) {
          const businessIds = businesses.map(b => b.id);
          query = query.in('business_id', businessIds);
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Supabase join sonucunu düzelt
      const processedData: Appointment[] = (data || []).map((item: any) => ({
        ...item,
        business: Array.isArray(item.business) ? item.business[0] || null : item.business,
        customer: Array.isArray(item.customer) ? item.customer[0] || null : item.customer,
      }));
      
      setAppointments(processedData);
    } catch (error) {
      console.error('Randevular getirilemedi:', error);
      Alert.alert('Hata', 'Randevular getirilemedi');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#FFA500';
      case 'approved': return '#4CAF50';
      case 'completed': return '#2196F3';
      case 'cancelled': return '#F44336';
      default: return '#757575';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Beklemede';
      case 'approved': return 'Onaylandı';
      case 'completed': return 'Tamamlandı';
      case 'cancelled': return 'İptal Edildi';
      default: return status;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR');
  };

  const handleOpenMaps = (address?: string, businessName?: string) => {
    if (!address) {
      Alert.alert('Hata', 'İşletme adresi bulunamadı.');
      return;
    }

    let mapUrl = '';
    const encodedAddress = encodeURIComponent(address);

    if (Platform.OS === 'ios') {
      // Apple Haritalar için: Belirli bir konumu gösterme
      mapUrl = `maps://?q=${encodedAddress}`;
      // Alternatif olarak doğrudan yol tarifi için:
      // mapUrl = `maps://?daddr=${encodedAddress}`;
    } else { // Android ve diğer platformlar
      // Google Haritalar için: Belirli bir konumu işaretleyici ve etiket ile gösterme
      // mapUrl = `geo:0,0?q=${encodedAddress}(${encodeURIComponent(businessName || 'İşletme')})`;
      // Veya daha önce kullandığımız genel web URL'si (genellikle Google Haritalar'ı açar):
      mapUrl = `https://maps.google.com/?q=${encodedAddress}`;
      // Doğrudan navigasyon başlatmak için (Android):
      // mapUrl = `google.navigation:q=${encodedAddress}`;
    }

    Linking.canOpenURL(mapUrl).then(supported => {
      if (supported) {
        Linking.openURL(mapUrl);
      } else {
        // Belki bir web fallback'i veya daha açıklayıcı bir hata mesajı
        const fallbackMapUrl = `https://maps.google.com/?q=${encodedAddress}`;
        if (mapUrl !== fallbackMapUrl && Platform.OS === 'ios') { // Eğer Apple Maps URL'i başarısız olduysa Google Maps'i dene
            Linking.canOpenURL(fallbackMapUrl).then(fallbackSupported => {
                if(fallbackSupported) Linking.openURL(fallbackMapUrl);
                else Alert.alert('Hata', 'Harita uygulaması açılamıyor.');
            });
        } else {
            Alert.alert('Hata', 'Harita uygulaması açılamıyor.');
        }
      }
    }).catch(err => {
      console.error("Harita açma hatası:", err);
      Alert.alert('Hata', 'Harita açılırken bir sorun oluştu.');
    });
  };

  const renderAppointmentItem = ({ item }: { item: Appointment }) => {
    if (profile?.role === 'customer') {
      // Müşteri arayüzü için yeni kart tasarımı
      const coverPhoto = item.business?.photos && item.business.photos.length > 0 
        ? item.business.photos[0] 
        : null;

      return (
        <TouchableOpacity
          style={styles.customerAppointmentCard}
          onPress={() => navigation.navigate('AppointmentDetail', { appointmentId: item.id })}
        >
          {coverPhoto ? (
            <Image 
              source={{ uri: coverPhoto }} 
              style={styles.businessImage} 
              resizeMode="cover" 
            />
          ) : (
            <View style={[styles.businessImage, styles.placeholderImage]}>
              <Text style={styles.placeholderText}>İşletme Fotoğrafı Yok</Text>
            </View>
          )}
          <View style={styles.cardHeader}>
            <Text style={styles.customerBusinessName} numberOfLines={1}>
              {item.business?.name || 'İşletme Adı Yok'}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
              <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
            </View>
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.appointmentDateTime}>
              📅 {formatDate(item.appointment_date)} - ⏰ {item.appointment_time}
            </Text>
            {item.business?.description && (
              <Text style={styles.businessCategory} numberOfLines={1}>
                🏷️ {item.business.description}
              </Text>
            )}
          </View>
          {item.business?.address && (
            <TouchableOpacity 
              style={styles.mapButton}
              onPress={() => handleOpenMaps(item.business?.address, item.business?.name)}
            >
              <Text style={styles.mapButtonText}>📍 Haritada Göster</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      );
    } else {
      // İşletme sahibi veya diğer roller için mevcut (veya farklı) kart tasarımı
      // Bu kısım şimdilik aynı kalabilir veya isteğe göre güncellenebilir.
      return (
        <TouchableOpacity
          style={styles.appointmentCard} // Mevcut stil kullanılıyor
          onPress={() => navigation.navigate('AppointmentDetail', { appointmentId: item.id })}
        >
          <View style={styles.appointmentHeader}>
            <Text style={styles.businessName}>
              {/* İşletme sahibi için müşteri adı gösterilir */}
              {item.customer?.full_name || 'Müşteri'}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
              <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
            </View>
          </View>
          
          <View style={styles.appointmentInfo}>
            <Text style={styles.dateTime}>
              📅 {formatDate(item.appointment_date)} - ⏰ {item.appointment_time}
            </Text>
            {/* İşletme sahibi için notlar veya başka bilgiler gösterilebilir */}
            {item.notes && (
              <Text style={styles.notes} numberOfLines={2}>💬 {item.notes}</Text>
            )}
          </View>
        </TouchableOpacity>
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text>Randevular yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {profile?.role === 'customer' ? 'Randevularım' : 'Gelen Randevu Talepleri'}
        </Text>
        {profile?.role === 'customer' && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('CreateAppointment')}
          >
            <Text style={styles.addButtonText}>+ Randevu Al</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={appointments}
        renderItem={renderAppointmentItem}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true);
            fetchAppointments();
          }} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {profile?.role === 'customer' 
                ? 'Henüz randevunuz bulunmuyor' 
                : 'Henüz randevu talebi almadınız'
              }
            </Text>
            {profile?.role === 'customer' && (
              <Text style={styles.emptySubtext}>
                Yukarıdaki "Randevu Al" butonuna tıklayarak{'\n'}ilk randevunuzu oluşturabilirsiniz
              </Text>
            )}
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'white',
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  appointmentCard: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginVertical: 5,
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  businessName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  appointmentInfo: {
    gap: 5,
  },
  dateTime: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  category: {
    fontSize: 14,
    color: '#888',
  },
  notes: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#AAA',
    textAlign: 'center',
    marginTop: 10,
  },
  customerAppointmentCard: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginVertical: 10,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 4,
    overflow: 'hidden',
  },
  businessImage: {
    width: '100%',
    height: 150,
  },
  placeholderImage: {
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#757575',
    fontSize: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 5,
  },
  customerBusinessName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  cardBody: {
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  appointmentDateTime: {
    fontSize: 15,
    color: '#555',
    marginBottom: 5,
  },
  businessCategory: {
    fontSize: 13,
    color: '#777',
    fontStyle: 'italic',
  },
  mapButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    marginTop: 10,
  },
  mapButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
}); 