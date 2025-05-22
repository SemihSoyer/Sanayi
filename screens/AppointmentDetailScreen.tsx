import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface AppointmentDetail {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: 'pending' | 'approved' | 'completed' | 'cancelled';
  notes?: string;
  business: {
    name: string;
    description: string;
  };
  customer: {
    full_name: string;
  };
}

export default function AppointmentDetailScreen({ route, navigation }: any) {
  const { appointmentId } = route.params;
  const { profile } = useAuth();
  const [appointment, setAppointment] = useState<AppointmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchAppointment();
  }, [appointmentId]);

  const fetchAppointment = async () => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          appointment_time,
          status,
          notes,
          business:businesses(name, description),
          customer:profiles!customer_id(full_name)
        `)
        .eq('id', appointmentId)
        .single();

      if (error) throw error;
      setAppointment(data as AppointmentDetail);
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.headerBackButton}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Randevu Detayı</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Durum Badge */}
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(appointment.status) }]}>
            <Text style={styles.statusText}>{getStatusText(appointment.status)}</Text>
          </View>
        </View>

        {/* Ana Bilgiler */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>
            {profile?.role === 'customer' ? appointment.business?.name || 'İşletme' : appointment.customer?.full_name || 'Müşteri'}
          </Text>
          {profile?.role === 'customer' && appointment.business?.description && (
            <Text style={styles.infoSubtitle}>🏪 {appointment.business.description}</Text>
          )}
          {profile?.role === 'business_owner' && (
            <Text style={styles.infoSubtitle}>👤 Müşteri Randevu Talebi</Text>
          )}
          
          <View style={styles.infoSection}>
            <Text style={styles.infoLabel}>📅 Tarih</Text>
            <Text style={styles.infoValue}>{formatDate(appointment.appointment_date)}</Text>
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.infoLabel}>⏰ Saat</Text>
            <Text style={styles.infoValue}>{appointment.appointment_time}</Text>
          </View>

          {appointment.notes && (
            <View style={styles.infoSection}>
              <Text style={styles.infoLabel}>
                {profile?.role === 'customer' ? '💬 Notlarım' : '💬 Müşteri Notları'}
              </Text>
              <Text style={styles.infoValue}>{appointment.notes}</Text>
            </View>
          )}

          {!appointment.notes && profile?.role === 'business_owner' && (
            <View style={styles.infoSection}>
              <Text style={styles.infoLabel}>💬 Müşteri Notları</Text>
              <Text style={[styles.infoValue, styles.noNotes]}>Not eklenmemiş</Text>
            </View>
          )}
        </View>

        {/* Eylemler */}
        {availableActions.length > 0 && (
          <View style={styles.actionsCard}>
            <Text style={styles.actionsTitle}>
              {profile?.role === 'customer' ? 'Randevu İşlemleri' : 'Randevu Yönetimi'}
            </Text>
            {availableActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.actionButton, { backgroundColor: action.color }]}
                onPress={() => {
                  Alert.alert(
                    'Onay',
                    `Randevu durumunu "${action.label}" olarak değiştirmek istediğinizden emin misiniz?`,
                    [
                      { text: 'İptal', style: 'cancel' },
                      {
                        text: 'Evet',
                        onPress: () => updateAppointmentStatus(action.status),
                      },
                    ]
                  );
                }}
                disabled={updating}
              >
                <Text style={styles.actionButtonText}>
                  {updating ? 'Güncelleniyor...' : action.label}
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
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: 'white',
  },
  headerBackButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 50,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  statusContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  statusBadge: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  statusText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  infoSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  infoSection: {
    marginBottom: 15,
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 5,
  },
  infoValue: {
    fontSize: 18,
    color: '#333',
  },
  noNotes: {
    fontStyle: 'italic',
    color: '#999',
  },
  actionsCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  actionsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  actionButton: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
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
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 18,
    color: '#F44336',
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