import React, { useState, useEffect, useLayoutEffect } from 'react';
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
import SlotAvailabilityEditor from '../components/SlotAvailabilityEditor';

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
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [markedDates, setMarkedDates] = useState<MarkedDates>({});
  const [selectedDateObject, setSelectedDateObject] = useState<Date | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: 'Saatlik Müsaitlik Belirle',
    });
  }, [navigation]);

  useEffect(() => {
    fetchBusinessDetails();
  }, []);

  useEffect(() => {
    if (businessId) {
        fetchInitialMarkedDates(businessId);
    }
  }, [businessId]);

  const fetchBusinessDetails = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        Alert.alert('Hata', 'Kullanıcı oturumu bulunamadı.');
        navigation.goBack();
        return;
      }
      const currentUserId = session.user.id;
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('id, name, is_published')
        .eq('owner_id', currentUserId)
        .single();

      if (businessError) {
        Alert.alert('Hata', `İşletme sorgulanırken hata: ${businessError.message}`);
        navigation.goBack();
        return;
      }
      if (!business) {
        Alert.alert('Uyarı', 'Henüz bir işletmeniz yok veya yayınlanmamış.');
        navigation.goBack();
        return;
      }
      if (!business.is_published) {
        Alert.alert('Uyarı', 'İşletmenizi önce yayınlamanız gerekiyor.');
        navigation.goBack();
        return;
      }
      setBusinessId(business.id);
    } catch (error) {
      Alert.alert('Hata', 'İşletme bilgileri alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  const fetchInitialMarkedDates = async (currentBusinessId: string) => {
    try {
        const { data: availabilityData, error: availabilityError } = await supabase
            .from('business_availability')
            .select('date, is_open')
            .eq('business_id', currentBusinessId)
            .gte('date', new Date().toISOString().split('T')[0]);

        if (availabilityError) throw availabilityError;

    const marked: MarkedDates = {};
        (availabilityData || []).forEach((item: any) => {
      marked[item.date] = {
        marked: true,
                dotColor: item.is_open ? 'green' : 'red',
      };
    });
        setMarkedDates(currentMarked => ({...currentMarked, ...marked}));

    } catch (error) {
        console.warn('Error fetching initial marked dates:', error)
    }
  }

  const onDayPress = (day: any) => {
    const dateParts = day.dateString.split('-').map(Number);
    const newSelectedDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
    
    setSelectedDateObject(newSelectedDate);

    setMarkedDates(prevMarked => {
      const newMarked = { ...prevMarked };
      Object.keys(newMarked).forEach(dateKey => {
        if (newMarked[dateKey]?.selected) {
          delete newMarked[dateKey]?.selected;
          if (Object.keys(newMarked[dateKey] || {}).length === 0) {
            delete newMarked[dateKey];
          }
        }
      });
      newMarked[day.dateString] = {
        ...(newMarked[day.dateString] || {}),
        selected: true,
        selectedColor: '#007AFF',
      };
      return newMarked;
    });
  };

  const getMinDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.headerPlaceholder} /> 
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0066CC" />
          <Text style={styles.loadingText}>Müsaitlik takvimi yükleniyor...</Text>
        </View>
      </View>
    );
  }

  if (!businessId) {
    return (
        <View style={styles.container}>
            <View style={styles.headerPlaceholder} /> 
            <View style={styles.centered}>
                <Ionicons name="alert-circle-outline" size={48} color="#D32F2F" />
                <Text style={[styles.loadingText, {marginTop: 15, color: '#D32F2F'}]}>
                    İşletme bilgileri yüklenemedi veya mevcut değil.
                </Text>
                <TouchableOpacity style={styles.goBackButton} onPress={() => navigation.goBack()}>
                    <Text style={styles.goBackButtonText}>Geri Dön</Text>
                </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
          <Calendar
        style={styles.calendar}
        onDayPress={onDayPress}
        markedDates={markedDates}
        minDate={getMinDate()}
            current={new Date().toISOString().split('T')[0]}
            theme={{
          calendarBackground: '#FFFFFF',
          textSectionTitleColor: '#2d4150',
          selectedDayBackgroundColor: '#007AFF',
              selectedDayTextColor: '#ffffff',
          todayTextColor: '#007AFF',
              dayTextColor: '#2d4150',
              textDisabledColor: '#d9e1e8',
          dotColor: '#007AFF',
              selectedDotColor: '#ffffff',
          arrowColor: '#007AFF',
          monthTextColor: '#007AFF',
          indicatorColor: 'blue',
              textDayFontWeight: '300',
              textMonthFontWeight: 'bold',
              textDayHeaderFontWeight: '300',
              textDayFontSize: 16,
          textMonthFontSize: 18,
          textDayHeaderFontSize: 14
            }}
      />
      
      {selectedDateObject && businessId && (
        <View style={styles.slotEditorContainer}>
           <Text style={styles.selectedDateText}>
            Seçilen Tarih: {selectedDateObject.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </Text>
          <SlotAvailabilityEditor 
            businessId={businessId}
            selectedDate={selectedDateObject}
          />
        </View>
      )}
      {!selectedDateObject && (
        <View style={styles.placeholderContainer}>
            <Ionicons name="hand-left-outline" size={30} color="#888" />
            <Text style={styles.placeholderText}>
                Saatlik müsaitlik durumunu ayarlamak için lütfen takvimden bir gün seçin.
            </Text>
          </View>
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F2F5',
  },
  headerPlaceholder: {
    height: 50,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D1D1D1',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#555',
  },
  goBackButton: {
    marginTop: 20,
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 25,
    borderRadius: 8,
  },
  goBackButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  calendar: {
    borderBottomWidth: 1,
    borderColor: '#e0e0e0',
    marginHorizontal: 10,
    marginTop: 10,
    borderRadius: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  slotEditorContainer: {
    flex: 1,
    marginTop: 15,
    marginHorizontal:10,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1},
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  selectedDateText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    textAlign: 'center',
  },
  placeholderContainer: {
    flex:1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginHorizontal: 10,
    marginTop: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  placeholderText: {
    marginTop: 10,
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  }
}); 