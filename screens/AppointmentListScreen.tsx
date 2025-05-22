import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
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
          business:businesses(name, description),
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
      setAppointments((data as Appointment[]) || []);
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

  const renderAppointmentItem = ({ item }: { item: Appointment }) => (
    <TouchableOpacity
      style={styles.appointmentCard}
      onPress={() => navigation.navigate('AppointmentDetail', { appointmentId: item.id })}
    >
      <View style={styles.appointmentHeader}>
        <Text style={styles.businessName}>
          {profile?.role === 'customer' 
            ? item.business?.name || 'İşletme' 
            : item.customer?.full_name || 'Müşteri'}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
        </View>
      </View>
      
      <View style={styles.appointmentInfo}>
        <Text style={styles.dateTime}>
          📅 {formatDate(item.appointment_date)} - ⏰ {item.appointment_time}
        </Text>
        {profile?.role === 'customer' && item.business?.description && (
          <Text style={styles.category}>🏪 {item.business.description}</Text>
        )}
        {item.notes && (
          <Text style={styles.notes} numberOfLines={2}>💬 {item.notes}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

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
}); 