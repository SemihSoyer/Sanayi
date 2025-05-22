import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Calendar } from 'react-native-calendars';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface Business {
  id: string;
  name: string;
  description: string;
}

interface TimeSlot {
  id: string;
  slot_name: string;
  start_time: string;
  end_time: string;
}

interface BusinessAvailability {
  date: string;
  is_open: boolean;
  max_appointments_per_day: number;
  current_appointments_count: number;
}

interface MarkedDate {
  selected?: boolean;
  marked?: boolean;
  selectedColor?: string;
  dotColor?: string;
  disabled?: boolean;
  disableTouchEvent?: boolean;
}

interface MarkedDates {
  [key: string]: MarkedDate;
}

export default function CreateAppointmentScreen({ navigation }: any) {
  const route = useRoute();
  const { preSelectedBusinessId } = route.params as { preSelectedBusinessId?: string } || {};
  const { profile } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<string | null>(preSelectedBusinessId || null);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [businessAvailability, setBusinessAvailability] = useState<BusinessAvailability[]>([]);
  const [markedDates, setMarkedDates] = useState<MarkedDates>({});

  useEffect(() => {
    fetchBusinesses();
  }, []);

  useEffect(() => {
    if (selectedBusiness) {
      fetchTimeSlots();
      fetchBusinessAvailability();
    }
  }, [selectedBusiness]);

  const fetchBusinesses = async () => {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('id, name, description')
        .eq('is_published', true)
        .order('name');

      if (error) throw error;
      setBusinesses(data || []);
    } catch (error) {
      console.error('İşletmeler getirilemedi:', error);
      Alert.alert('Hata', 'İşletmeler getirilemedi');
    }
  };

  const fetchTimeSlots = async () => {
    if (!selectedBusiness) return;

    console.log('[CreateAppointment] fetchTimeSlots başladı, businessId:', selectedBusiness);
    try {
      const { data, error } = await supabase
        .from('appointment_time_slots')
        .select('id, slot_name, start_time, end_time')
        .eq('business_id', selectedBusiness)
        .eq('is_active', true)
        .order('start_time');

      console.log('[CreateAppointment] TimeSlots sorgu sonucu:', { data, error });
      if (error) throw error;
      
      const slotsData = data || [];
      console.log('[CreateAppointment] İşlenen timeSlots verisi:', slotsData);
      setTimeSlots(slotsData);
      
      if (slotsData.length === 0) {
        console.log('[CreateAppointment] UYARI: Bu işletme için hiç time slot bulunamadı!');
      }
    } catch (error) {
      console.error('[CreateAppointment] Zaman dilimleri getirilemedi:', error);
      Alert.alert('Hata', 'Saat dilimleri alınamadı: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'));
    }
  };

  const fetchBusinessAvailability = async () => {
    if (!selectedBusiness) return;

    console.log('[CreateAppointment] fetchBusinessAvailability başladı, businessId:', selectedBusiness);
    setLoadingAvailability(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      console.log('[CreateAppointment] Bugünün tarihi:', today);
      
      const { data, error } = await supabase
        .from('business_availability')
        .select('*')
        .eq('business_id', selectedBusiness)
        .gte('date', today)
        .order('date');

      console.log('[CreateAppointment] Availability sorgu sonucu:', { data, error });
      if (error) throw error;
      
      const availabilityData = data || [];
      console.log('[CreateAppointment] İşlenen availability verisi:', availabilityData);
      setBusinessAvailability(availabilityData);
      updateMarkedDates(availabilityData);
    } catch (error) {
      console.error('[CreateAppointment] İşletme müsaitliği getirilemedi:', error);
      Alert.alert('Hata', 'İşletme müsaitlik bilgileri alınamadı: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'));
    } finally {
      setLoadingAvailability(false);
    }
  };

  const updateMarkedDates = (availabilityData: BusinessAvailability[]) => {
    console.log('[CreateAppointment] updateMarkedDates çağrıldı, veri:', availabilityData);
    const marked: MarkedDates = {};
    
    availabilityData.forEach((item) => {
      console.log('[CreateAppointment] İşleniyor:', item.date, 'is_open:', item.is_open);
      if (item.is_open) {
        // Sadece açık günleri işaretle
        marked[item.date] = {
          marked: true,
          dotColor: '#4CAF50',
          disabled: false,
        };
      } else {
        // Kapalı günleri disabled yap
        marked[item.date] = {
          marked: true,
          dotColor: '#F44336',
          disabled: true,
          disableTouchEvent: true,
        };
      }
    });

    console.log('[CreateAppointment] Oluşturulan markedDates:', marked);
    setMarkedDates(marked);
  };

  const onDayPress = (day: any) => {
    console.log('[CreateAppointment] onDayPress çağrıldı, seçilen tarih:', day.dateString);
    console.log('[CreateAppointment] Mevcut businessAvailability verisi:', businessAvailability);
    
    // Sadece müsait günler seçilebilir
    const dayAvailability = businessAvailability.find(item => item.date === day.dateString);
    console.log('[CreateAppointment] Bu gün için bulunan availability:', dayAvailability);
    
    if (!dayAvailability) {
      console.log('[CreateAppointment] Gün için availability verisi bulunamadı');
      Alert.alert('Uyarı', 'Bu gün için müsaitlik bilgisi bulunamadı.');
      return;
    }

    if (!dayAvailability.is_open) {
      console.log('[CreateAppointment] Gün kapalı olarak işaretlenmiş');
      Alert.alert('Uyarı', 'Bu gün kapalı olarak işaretlenmiş.');
      return;
    }

    // Maksimum randevu kontrolü
    if (dayAvailability.current_appointments_count >= dayAvailability.max_appointments_per_day) {
      console.log('[CreateAppointment] Maksimum randevu sayısına ulaşılmış:', 
        dayAvailability.current_appointments_count, '>=', dayAvailability.max_appointments_per_day);
      Alert.alert('Uyarı', 'Bu gün için maksimum randevu sayısına ulaşılmış.');
      return;
    }

    console.log('[CreateAppointment] Gün başarıyla seçildi:', day.dateString);
    setSelectedDate(day.dateString);
  };

  const createAppointment = async () => {
    if (!selectedBusiness || !selectedDate) {
      Alert.alert('Eksik Bilgi', 'Lütfen işletme ve tarih seçiniz');
      return;
    }

    // Session kontrolü
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      Alert.alert('Hata', 'Kullanıcı oturumu bulunamadı');
      return;
    }

    setLoading(true);

    try {
      // Time slot seçildiyse kullan, yoksa varsayılan saat
      let appointmentTime = '09:00:00'; // Varsayılan saat
      if (selectedTimeSlot && timeSlots.length > 0) {
        const selectedSlot = timeSlots.find(slot => slot.id === selectedTimeSlot);
        appointmentTime = selectedSlot?.start_time || '09:00:00';
      }
      
      console.log('[CreateAppointment] Randevu oluşturuluyor:', {
        business_id: selectedBusiness,
        appointment_date: selectedDate,
        appointment_time: appointmentTime,
        selectedTimeSlot
      });
      
      const appointmentData = {
        business_id: selectedBusiness,
        customer_id: session?.user?.id,
        appointment_date: selectedDate,
        appointment_time: appointmentTime, // Her zaman bir saat değeri gönder
        status: 'pending',
        notes: notes.trim() || null,
      };
      
      const { data, error } = await supabase
        .from('appointments')
        .insert(appointmentData);

      if (error) throw error;

      Alert.alert(
        'Başarılı',
        'Randevunuz oluşturuldu. İşletme onayladıktan sonra bilgilendirileceksiniz.',
        [
          {
            text: 'Tamam',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Randevu oluşturulamadı:', error);
      Alert.alert('Hata', 'Randevu oluşturulurken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };



  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Yeni Randevu</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* İşletme Bilgisi */}
        {selectedBusiness && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>İşletme</Text>
            {businesses.find(b => b.id === selectedBusiness) && (
              <View style={styles.businessInfoCard}>
                <Text style={styles.businessInfoTitle}>
                  {businesses.find(b => b.id === selectedBusiness)?.name}
                </Text>
                <Text style={styles.businessInfoSubtitle}>
                  {businesses.find(b => b.id === selectedBusiness)?.description || '🏢 İşletme'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Tarih Seçimi */}
        {selectedBusiness && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Müsait Günler</Text>
            
            {loadingAvailability ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.loadingText}>Müsait günler yükleniyor...</Text>
              </View>
            ) : (
              <>
                <View style={styles.calendarContainer}>
                  <Calendar
                    current={new Date().toISOString().split('T')[0]}
                    minDate={new Date().toISOString().split('T')[0]}
                    maxDate={'2025-12-31'}
                    onDayPress={onDayPress}
                    markedDates={{
                      ...markedDates,
                      [selectedDate]: {
                        ...markedDates[selectedDate],
                        selected: true,
                        selectedColor: '#007AFF',
                      },
                    }}
                    theme={{
                      backgroundColor: '#ffffff',
                      calendarBackground: '#ffffff',
                      textSectionTitleColor: '#b6c1cd',
                      selectedDayBackgroundColor: '#007AFF',
                      selectedDayTextColor: '#ffffff',
                      todayTextColor: '#007AFF',
                      dayTextColor: '#2d4150',
                      textDisabledColor: '#d9e1e8',
                      dotColor: '#00adf5',
                      selectedDotColor: '#ffffff',
                      arrowColor: '#007AFF',
                      disabledArrowColor: '#d9e1e8',
                      monthTextColor: '#007AFF',
                      indicatorColor: '#007AFF',
                      textDayFontFamily: 'System',
                      textMonthFontFamily: 'System',
                      textDayHeaderFontFamily: 'System',
                      textDayFontWeight: '300',
                      textMonthFontWeight: 'bold',
                      textDayHeaderFontWeight: '300',
                      textDayFontSize: 16,
                      textMonthFontSize: 16,
                      textDayHeaderFontSize: 13,
                    }}
                  />
                </View>

                {/* Açıklama */}
                <View style={styles.legendContainer}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
                    <Text style={styles.legendText}>Müsait Günler</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#F44336' }]} />
                    <Text style={styles.legendText}>Kapalı Günler</Text>
                  </View>
                </View>

                {selectedDate && (
                  <View style={styles.selectedDateInfo}>
                    <Text style={styles.selectedDateText}>
                      Seçilen Tarih: {new Date(selectedDate).toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* Saat Seçimi */}
        {selectedBusiness && timeSlots.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Saat Seçin</Text>
            {timeSlots.map((slot) => (
              <TouchableOpacity
                key={slot.id}
                style={[
                  styles.optionCard,
                  selectedTimeSlot === slot.id && styles.selectedCard,
                ]}
                onPress={() => setSelectedTimeSlot(slot.id)}
              >
                <Text style={[
                  styles.optionTitle,
                  selectedTimeSlot === slot.id && styles.selectedText,
                ]}>
                  {slot.slot_name}
                </Text>
                <Text style={[
                  styles.optionSubtitle,
                  selectedTimeSlot === slot.id && styles.selectedSubtext,
                ]}>
                  {slot.start_time} - {slot.end_time}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Notlar */}
        {selectedBusiness && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notlar (İsteğe Bağlı)</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Randevunuzla ilgili notlarınızı yazın..."
              value={notes}
              onChangeText={setNotes}
              multiline
              textAlignVertical="top"
              placeholderTextColor="#999"
            />
          </View>
        )}
      </ScrollView>

      {/* Oluştur Butonu */}
      {selectedBusiness && selectedDate && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.createButton, loading && styles.disabledButton]}
            onPress={createAppointment}
            disabled={loading}
          >
            <Text style={styles.createButtonText}>
              {loading ? 'Oluşturuluyor...' : 'Randevu Oluştur'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
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
  backButton: {
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
  section: {
    marginVertical: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  optionCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedCard: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  selectedText: {
    color: '#007AFF',
  },
  optionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  selectedSubtext: {
    color: '#0066CC',
  },
  businessInfoCard: {
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  businessInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  businessInfoSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  dateInput: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
    color: '#333',
    marginBottom: 10,
  },
  quickDateButton: {
    backgroundColor: '#E3F2FD',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickDateText: {
    color: '#1976D2',
    fontSize: 14,
    fontWeight: '500',
  },
  notesInput: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
    color: '#333',
    height: 100,
  },
  footer: {
    padding: 20,
    backgroundColor: 'white',
  },
  createButton: {
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
  },
  createButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#666',
  },
  calendarContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 10,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    fontSize: 14,
    color: '#666',
  },
  selectedDateInfo: {
    backgroundColor: '#E3F2FD',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  selectedDateText: {
    fontSize: 16,
    color: '#1976D2',
    fontWeight: '600',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    fontStyle: 'italic',
  },
}); 