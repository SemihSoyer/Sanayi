import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
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

export default function BusinessAvailabilityScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [availability, setAvailability] = useState<BusinessAvailability[]>([]);
  const [markedDates, setMarkedDates] = useState<MarkedDates>({});
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [maxAppointments, setMaxAppointments] = useState<string>('5');
  const [showDateSettings, setShowDateSettings] = useState(false);

  useEffect(() => {
    fetchBusinessAndAvailability();
  }, []);

  const fetchBusinessAndAvailability = async () => {
    console.log('[BusinessAvailability] fetchBusinessAndAvailability başladı');
    
    setLoading(true);
    try {
      // Session kontrolü
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        console.log('[BusinessAvailability] Session bulunamadı');
        Alert.alert('Hata', 'Kullanıcı oturumu bulunamadı. Lütfen tekrar giriş yapın.');
        setLoading(false);
        return;
      }

      const currentUserId = session.user.id;
      console.log('[BusinessAvailability] İşletme aranıyor, owner_id:', currentUserId);
      
      // Kullanıcının işletmesini bul (yayınlanmış olma şartı kaldırıldı)
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('id, name, is_published')
        .eq('owner_id', currentUserId)
        .single();

      console.log('[BusinessAvailability] İşletme sorgu sonucu:', { business, businessError });

      if (businessError) {
        console.log('[BusinessAvailability] İşletme sorgu hatası:', businessError);
        Alert.alert('Hata', `İşletme sorgulanırken hata: ${businessError.message}`);
        navigation.goBack();
        return;
      }

      if (!business) {
        console.log('[BusinessAvailability] İşletme bulunamadı');
        Alert.alert('Uyarı', 'Henüz bir işletmeniz yok. Önce İşyerim sekmesinden işletmenizi oluşturun.');
        navigation.goBack();
        return;
      }

      if (!business.is_published) {
        Alert.alert('Uyarı', 'İşletmenizi önce yayınlamanız gerekiyor. İşyerim sekmesinden "Yayınla" butonuna basın.');
        navigation.goBack();
        return;
      }

      setBusinessId(business.id);

      // Mevcut müsaitlik verilerini çek
      const { data: availabilityData, error: availabilityError } = await supabase
        .from('business_availability')
        .select('*')
        .eq('business_id', business.id)
        .gte('date', new Date().toISOString().split('T')[0]); // Bugünden itibaren

      if (availabilityError) throw availabilityError;

      setAvailability(availabilityData || []);
      updateMarkedDates(availabilityData || []);
    } catch (error) {
      console.error('[BusinessAvailability] Hata oluştu:', error);
      Alert.alert('Hata', 'Müsaitlik verileri alınamadı: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'));
    } finally {
      setLoading(false);
    }
  };

  const updateMarkedDates = (availabilityData: BusinessAvailability[]) => {
    const marked: MarkedDates = {};
    
    availabilityData.forEach((item) => {
      marked[item.date] = {
        marked: true,
        dotColor: item.is_open ? '#4CAF50' : '#F44336',
        selectedColor: item.is_open ? '#4CAF50' : '#F44336',
      };
    });

    setMarkedDates(marked);
  };

  const onDayPress = (day: any) => {
    setSelectedDate(day.dateString);
    
    // Seçilen günün mevcut ayarlarını bul
    const existingAvailability = availability.find(item => item.date === day.dateString);
    if (existingAvailability) {
      setMaxAppointments(existingAvailability.max_appointments_per_day.toString());
    } else {
      setMaxAppointments('5'); // Varsayılan değer
    }
    
    setShowDateSettings(true);
  };

  const saveAvailability = async (isOpen: boolean) => {
    if (!businessId || !selectedDate) {
      console.log('[BusinessAvailability] Eksik veri:', { businessId, selectedDate });
      Alert.alert('Hata', 'İşletme ID veya tarih eksik');
      return;
    }

    console.log('[BusinessAvailability] Müsaitlik kaydediliyor:', {
      businessId,
      selectedDate,
      isOpen,
      maxAppointments
    });

    setSaving(true);
    try {
      const maxApps = parseInt(maxAppointments) || 5;
      
      // Mevcut kaydı kontrol et
      console.log('[BusinessAvailability] Mevcut kayıt kontrol ediliyor...');
      const { data: existing, error: selectError } = await supabase
        .from('business_availability')
        .select('*')
        .eq('business_id', businessId)
        .eq('date', selectedDate)
        .single();

      console.log('[BusinessAvailability] Mevcut kayıt sonucu:', { existing, selectError });

      if (selectError && selectError.code !== 'PGRST116') {
        throw selectError;
      }

      if (existing) {
        // Güncelle
        console.log('[BusinessAvailability] Kayıt güncelleniyor...');
        const { error } = await supabase
          .from('business_availability')
          .update({
            is_open: isOpen,
            max_appointments_per_day: maxApps,
            updated_at: new Date().toISOString(),
          })
          .eq('business_id', businessId)
          .eq('date', selectedDate);

        if (error) throw error;
        console.log('[BusinessAvailability] Kayıt başarıyla güncellendi');
      } else {
        // Yeni kayıt oluştur
        console.log('[BusinessAvailability] Yeni kayıt oluşturuluyor...');
        const { error } = await supabase
          .from('business_availability')
          .insert({
            business_id: businessId,
            date: selectedDate,
            is_open: isOpen,
            max_appointments_per_day: maxApps,
            current_appointments_count: 0,
          });

        if (error) throw error;
        console.log('[BusinessAvailability] Yeni kayıt başarıyla oluşturuldu');
      }

      // Veriyi yenile
      console.log('[BusinessAvailability] Veriler yenileniyor...');
      await fetchBusinessAndAvailability();
      setShowDateSettings(false);
      
      Alert.alert(
        'Başarılı',
        isOpen ? 'Gün müsait olarak işaretlendi' : 'Gün kapalı olarak işaretlendi'
      );
    } catch (error) {
      console.error('[BusinessAvailability] Müsaitlik kaydedilemedi:', error);
      Alert.alert('Hata', 'Müsaitlik ayarı kaydedilemedi: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'));
    } finally {
      setSaving(false);
    }
  };

  const getMinDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  if (loading) {
    return (
      <View style={styles.container}>
        {/* Backup Header for loading state */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← Geri</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Müsaitlik Takvimi</Text>
          <View style={styles.placeholder} />
        </View>
        
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0066CC" />
          <Text style={styles.loadingText}>Müsaitlik takvimi yükleniyor...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← Geri</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Müsaitlik Takvimi</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Açıklama */}
        <View style={styles.infoSection}>
          <Ionicons name="information-circle" size={24} color="#0066CC" />
          <Text style={styles.infoText}>
            Müşterilerin randevu alabileceği günleri belirleyin. Yeşil noktalar müsait günleri, kırmızı noktalar kapalı günleri gösterir.
          </Text>
        </View>

        {/* Takvim */}
        <View style={styles.calendarContainer}>
          <Calendar
            current={new Date().toISOString().split('T')[0]}
            minDate={getMinDate()}
            maxDate={'2025-12-31'}
            onDayPress={onDayPress}
            markedDates={{
              ...markedDates,
              [selectedDate]: {
                ...markedDates[selectedDate],
                selected: true,
                selectedColor: '#0066CC',
              },
            }}
            theme={{
              backgroundColor: '#ffffff',
              calendarBackground: '#ffffff',
              textSectionTitleColor: '#b6c1cd',
              selectedDayBackgroundColor: '#0066CC',
              selectedDayTextColor: '#ffffff',
              todayTextColor: '#0066CC',
              dayTextColor: '#2d4150',
              textDisabledColor: '#d9e1e8',
              dotColor: '#00adf5',
              selectedDotColor: '#ffffff',
              arrowColor: '#0066CC',
              disabledArrowColor: '#d9e1e8',
              monthTextColor: '#0066CC',
              indicatorColor: '#0066CC',
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

        {/* Renk Açıklamaları */}
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

        {/* Seçilen Gün Ayarları */}
        {showDateSettings && (
          <View style={styles.settingsContainer}>
            <Text style={styles.settingsTitle}>
              {new Date(selectedDate).toLocaleDateString('tr-TR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })} - Ayarlar
            </Text>

            <View style={styles.maxAppointmentsContainer}>
              <Text style={styles.inputLabel}>Maksimum Randevu Sayısı:</Text>
              <TextInput
                style={styles.numberInput}
                value={maxAppointments}
                onChangeText={setMaxAppointments}
                keyboardType="numeric"
                placeholder="5"
              />
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.actionButton, styles.openButton]}
                onPress={() => saveAvailability(true)}
                disabled={saving}
              >
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                <Text style={styles.buttonText}>Müsait</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.closeButton]}
                onPress={() => saveAvailability(false)}
                disabled={saving}
              >
                <Ionicons name="close" size={20} color="#FFFFFF" />
                <Text style={styles.buttonText}>Kapalı</Text>
              </TouchableOpacity>
            </View>

            {saving && (
              <View style={styles.savingContainer}>
                <ActivityIndicator size="small" color="#0066CC" />
                <Text style={styles.savingText}>Kaydediliyor...</Text>
              </View>
            )}
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#555',
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
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'white',
    margin: 20,
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#0066CC',
  },
  infoText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  calendarContainer: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    borderRadius: 10,
    padding: 10,
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
    marginHorizontal: 20,
    marginTop: 15,
    padding: 15,
    borderRadius: 10,
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
  settingsContainer: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  maxAppointmentsContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
    fontWeight: '500',
  },
  numberInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 0.45,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  openButton: {
    backgroundColor: '#4CAF50',
  },
  closeButton: {
    backgroundColor: '#F44336',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  savingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
  },
  savingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
}); 