import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  Image,
  Linking,
  Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Icon } from '@rneui/themed';

interface AppointmentDetail {
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

export default function AppointmentDetailScreen({ route, navigation }: any) {
  const { appointmentId } = route.params;
  const { profile } = useAuth();
  const [appointment, setAppointment] = useState<AppointmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Randevu Detayı' });
  }, [navigation]);

  useEffect(() => {
    fetchAppointment();
  }, [appointmentId]);

  const fetchAppointment = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
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
        .eq('id', appointmentId)
        .single();

      if (error) throw error;
      
      // Supabase join sonucunu düzelt
      const processedData: AppointmentDetail = {
        ...data,
        business: Array.isArray(data.business) ? data.business[0] || null : data.business,
        customer: Array.isArray(data.customer) ? data.customer[0] || null : data.customer,
      };
      
      setAppointment(processedData);
    } catch (error) {
      console.error('Randevu getirilemedi:', error);
      Alert.alert('Hata', 'Randevu bilgileri getirilemedi');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const updateAppointmentStatus = async (newStatus: string) => {
    if (!appointment) return;

    setUpdating(true);
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', appointment.id);

      if (error) throw error;

      setAppointment({ ...appointment, status: newStatus as any });
      
      const statusText = getStatusText(newStatus);
      Alert.alert('Başarılı', `Randevu durumu "${statusText}" olarak güncellendi`);
    } catch (error) {
      console.error('Durum güncellenemedi:', error);
      Alert.alert('Hata', 'Randevu durumu güncellenirken hata oluştu');
    } finally {
      setUpdating(false);
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
    return date.toLocaleDateString('tr-TR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleOpenMaps = (address?: string, businessName?: string) => {
    if (!address) {
      Alert.alert('Hata', 'İşletme adresi bulunamadı.');
      return;
    }

    let mapUrl = '';
    const encodedAddress = encodeURIComponent(address);

    if (Platform.OS === 'ios') {
      mapUrl = `maps://?q=${encodedAddress}`;
    } else {
      mapUrl = `https://maps.google.com/?q=${encodedAddress}`;
    }

    Linking.canOpenURL(mapUrl).then(supported => {
      if (supported) {
        Linking.openURL(mapUrl);
      } else {
        const fallbackMapUrl = `https://maps.google.com/?q=${encodedAddress}`;
        if (mapUrl !== fallbackMapUrl && Platform.OS === 'ios') {
            Linking.canOpenURL(fallbackMapUrl).then(fallbackSupported => {
                if(fallbackSupported) Linking.openURL(fallbackMapUrl);
                else Alert.alert('Hata', 'Harita uygulaması açılamıyor.');
            }).catch(() => Alert.alert('Hata', 'Harita uygulaması açılamadı.'));
        } else {
            Alert.alert('Hata', 'Harita uygulaması açılamıyor.');
        }
      }
    }).catch(err => {
      console.error("Harita açma hatası:", err);
      Alert.alert('Hata', 'Harita açılırken bir sorun oluştu.');
    });
  };

  const getAvailableActions = () => {
    if (!appointment || !profile) return [];

    const actions = [];
    const isCustomer = profile.role === 'customer';
    const isBusinessOwner = profile.role === 'business_owner';

    if (isBusinessOwner && appointment.status === 'pending') {
      actions.push(
        { label: '✅ Randevuyu Onayla', status: 'approved', color: '#4CAF50' },
        { label: '❌ Reddet', status: 'cancelled', color: '#F44336' }
      );
    }

    if (isBusinessOwner && appointment.status === 'approved') {
      actions.push(
        { label: '🎉 Tamamlandı Olarak İşaretle', status: 'completed', color: '#2196F3' },
        { label: '❌ İptal Et', status: 'cancelled', color: '#F44336' }
      );
    }

    if (isCustomer && ['pending', 'approved'].includes(appointment.status)) {
      actions.push(
        { label: '❌ Randevuyu İptal Et', status: 'cancelled', color: '#F44336' }
      );
    }

    return actions;
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Randevu yükleniyor...</Text>
      </View>
    );
  }

  if (!appointment) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Randevu bulunamadı</Text>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Geri Dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const availableActions = getAvailableActions();
  const businessPhoto = appointment.business?.photos && appointment.business.photos.length > 0 
    ? appointment.business.photos[0] 
    : null;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.statusSection}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(appointment.status) }]}>
            <Icon 
                name={appointment.status === 'approved' ? 'checkmark-circle' : appointment.status === 'cancelled' ? 'close-circle' : appointment.status === 'completed' ? 'check-circle-outline' : 'time-outline'} 
                type='ionicon' 
                color='white' 
                size={18} 
                style={{marginRight: 8}}
            />
            <Text style={styles.statusText}>{getStatusText(appointment.status)}</Text>
          </View>
        </View>

        {profile?.role === 'customer' && appointment.business && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>İşletme Bilgileri</Text>
            {businessPhoto && (
              <Image source={{ uri: businessPhoto }} style={styles.businessImage} resizeMode="cover" />
            )}
            <Text style={styles.businessName}>{appointment.business.name}</Text>
            {appointment.business.description && (
              <Text style={styles.businessDescription}>🏪 {appointment.business.description}</Text>
            )}
            {appointment.business.address && (
              <View style={styles.addressContainer}>
                <Icon name="location-pin" type="material" color="#555" size={20} style={{marginRight: 5}}/>
                <Text style={styles.addressText}>{appointment.business.address}</Text>
              </View>
            )}
            {appointment.business.address && (
              <TouchableOpacity 
                style={styles.mapButton}
                onPress={() => handleOpenMaps(appointment.business?.address, appointment.business?.name)}
              >
                <Icon name="map" type="material-community" color="white" size={18} style={{marginRight: 8}}/>
                <Text style={styles.mapButtonText}>Haritada Göster</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {profile?.role === 'business_owner' && appointment.customer && (
             <View style={styles.card}>
                <Text style={styles.cardTitle}>Müşteri Bilgisi</Text>
                <View style={styles.infoRow}>
                    <Icon name="person-outline" type="material" color="#555" size={20} style={{marginRight: 10}}/>
                    <Text style={styles.infoValueBold}>{appointment.customer.full_name}</Text>
                </View>
            </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Randevu Bilgileri</Text>
          
          <View style={styles.infoRow}>
            <Icon name="calendar-today" type="material" color="#555" size={20} style={{marginRight: 10}}/>
            <View>
              <Text style={styles.infoLabel}>Tarih</Text>
              <Text style={styles.infoValueBold}>{formatDate(appointment.appointment_date)}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Icon name="access-time" type="material" color="#555" size={20} style={{marginRight: 10}}/>
            <View>
              <Text style={styles.infoLabel}>Saat</Text>
              <Text style={styles.infoValueBold}>{appointment.appointment_time}</Text>
            </View>
          </View>

          {appointment.notes && (
            <View style={styles.infoRow}>
              <Icon name="chat-bubble-outline" type="material" color="#555" size={20} style={{marginRight: 10}}/>
              <View>
                <Text style={styles.infoLabel}>
                  {profile?.role === 'customer' ? 'Notlarım' : 'Müşteri Notları'}
                </Text>
                <Text style={styles.infoValue}>{appointment.notes}</Text>
              </View>
            </View>
          )}
          {!appointment.notes && profile?.role === 'business_owner' && (
            <View style={styles.infoRow}>
              <Icon name="chat-bubble-outline" type="material" color="#555" size={20} style={{marginRight: 10}}/>
                <View>
                    <Text style={styles.infoLabel}>Müşteri Notları</Text>
                    <Text style={[styles.infoValue, styles.italicText]}>Not eklenmemiş</Text>
                </View>
            </View>
          )}
        </View>

        {availableActions.length > 0 && (
          <View style={[styles.card, styles.actionsCardContainer]}>
            <Text style={styles.cardTitle}>
              {profile?.role === 'customer' ? 'Randevu İşlemleri' : 'Randevu Yönetimi'}
            </Text>
            {availableActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.actionButton, { backgroundColor: action.color }]}
                onPress={() => {
                  Alert.alert(
                    'Onay',
                    `Randevuyu "${action.label.replace(/✅ |❌ |🎉 /g, '')}" olarak işaretlemek istediğinizden emin misiniz?`,
                    [
                      { text: 'Vazgeç', style: 'cancel' },
                      {
                        text: 'Evet, Eminim',
                        onPress: () => updateAppointmentStatus(action.status),
                        style: 'destructive'
                      },
                    ]
                  );
                }}
                disabled={updating}
              >
                <Text style={styles.actionButtonText}>
                  {updating ? 'İşleniyor...' : action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7FC',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 15,
  },
  statusSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 25,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  statusText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    paddingBottom: 10,
  },
  businessImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginBottom: 15,
  },
  businessName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  businessDescription: {
    fontSize: 15,
    color: '#555',
    marginBottom: 15,
    lineHeight: 22, 
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  addressText: {
    fontSize: 15,
    color: '#444',
    flex: 1,
  },
  mapButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
  },
  mapButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  infoValueBold: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    lineHeight: 22,
  },
  italicText: {
    fontStyle: 'italic',
    color: '#777',
  },
  actionsCardContainer: {
  },
  actionButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F4F7FC',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 18,
    color: '#D32F2F',
    textAlign: 'center',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
}); 