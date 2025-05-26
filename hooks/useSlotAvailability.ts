import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Alert } from 'react-native';

interface AppointmentSlot {
  id: string | null; // Null olabilir (henüz DB'de olmayan, dinamik üretilmiş slotlar için)
  slot_name: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  max_concurrent_appointments?: number; // appointment_time_slots'dan gelir
  is_new_template?: boolean; // Bu slot dinamik olarak mı üretildi ve DB'de yok mu?
}

export interface DisplaySlot extends AppointmentSlot {
  is_available: boolean;
  daily_slot_availability_id?: string; 
  max_appointments?: number | null; 
  current_appointments?: number;  
}

interface UseSlotAvailabilityProps {
  businessId: string | null;
  selectedDate: Date | null;
}

interface UseSlotAvailabilityReturn {
  displaySlots: DisplaySlot[];
  loadingSlots: boolean;
  errorSlots: string | null;
  toggleSlotAvailability: (slotNameToToggle: string) => void;
  saveSlotAvailabilities: () => Promise<void>;
  fetchSlotsForDate: (date: Date) => void; // Belirli bir tarihi yeniden yüklemek için
}

// Tarihi YYYY-MM-DD formatına çeviren yardımcı fonksiyon
const formatDateToYYYYMMDD = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Saati HH:MM:SS formatına çeviren yardımcı fonksiyon (Date objesinden)
const formatTimeToHHMMSS = (date: Date): string => {
  return date.toTimeString().split(' ')[0];
};

export const useSlotAvailability = ({
  businessId,
  selectedDate,
}: UseSlotAvailabilityProps): UseSlotAvailabilityReturn => {
  const [displaySlots, setDisplaySlots] = useState<DisplaySlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [errorSlots, setErrorSlots] = useState<string | null>(null);
  // const [initialSlotStates, setInitialSlotStates] = useState<Map<string, boolean>>(new Map()); // ID null olabileceği için bu map şimdilik kaldırıldı/değiştirilecek

  const fetchSlotsForDate = useCallback(async (date: Date) => {
    if (!businessId) {
      setDisplaySlots([]);
      return;
    }
    setLoadingSlots(true);
    setErrorSlots(null);
    const formattedDate = formatDateToYYYYMMDD(date);

    try {
      let baseSlots: AppointmentSlot[] = [];

      const { data: existingDbSlots, error: slotsError } = await supabase
        .from('appointment_time_slots')
        .select('id, slot_name, start_time, end_time, duration_minutes, max_concurrent_appointments')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('start_time', { ascending: true });

      if (slotsError) throw slotsError;

      if (existingDbSlots && existingDbSlots.length > 0) {
        baseSlots = existingDbSlots.map(s => ({...s, is_new_template: false}));
      } else {
        const dayOfWeek = date.getDay();
        const { data: opHours, error: opHoursError } = await supabase
          .from('business_operating_hours')
          .select('day_of_week, open_time, close_time, is_closed')
          .eq('business_id', businessId)
          .eq('day_of_week', dayOfWeek)
          .single();

        if (opHoursError && opHoursError.code !== 'PGRST116') {
          console.error('Error fetching operating hours:', opHoursError);
        }

        if (opHours && !opHours.is_closed && opHours.open_time && opHours.close_time) {
          const slotDurationMinutes = 60;
          let currentTime = new Date(`${formattedDate}T${opHours.open_time}`);
          const closeDateTime = new Date(`${formattedDate}T${opHours.close_time}`);
          
          while (currentTime < closeDateTime) {
            const slotStart = new Date(currentTime);
            const slotEnd = new Date(currentTime.getTime() + slotDurationMinutes * 60000);

            if (slotEnd > closeDateTime) break; 

            const startTimeStr = formatTimeToHHMMSS(slotStart);
            const endTimeStr = formatTimeToHHMMSS(slotEnd);

            baseSlots.push({
              id: null, 
              slot_name: `${startTimeStr.substring(0,5)} - ${endTimeStr.substring(0,5)}`,
              start_time: startTimeStr,
              end_time: endTimeStr,
              duration_minutes: slotDurationMinutes,
              max_concurrent_appointments: 1, 
              is_new_template: true,
            });
            currentTime = slotEnd;
          }
        }
        
        if (baseSlots.length === 0) { 
            if (opHoursError && opHoursError.code !== 'PGRST116') {
                setErrorSlots(`Çalışma saatleri alınırken hata: ${opHoursError.message}`);
            } else if (!opHours) { 
                setErrorSlots('Bu gün için çalışma saati ayarı bulunamadı.');
            } else if (opHours.is_closed) { 
                setErrorSlots('İşletmeniz bu gün kapalı olarak işaretlenmiş.');
            } else if (!opHours.open_time || !opHours.close_time) { 
                setErrorSlots('Bu gün için çalışma saatleri eksik (açılış/kapanış saati tanımlanmamış).');
            } else { 
                setErrorSlots('Çalışma saatlerinize uygun zaman aralığı oluşturulamadı (örn: açılış saati kapanıştan sonra). Bölümünden kontrol ediniz.');
            }
        }
      }
      
      const slotIdsFromDbSlots = baseSlots.filter(s => s.id !== null).map(s => s.id as string);
      let dailyAvailabilities: any[] = [];
      if (slotIdsFromDbSlots.length > 0) {
        const { data, error: dailyError } = await supabase
            .from('daily_slot_availability')
            .select('id, slot_id, is_available, max_appointments_in_slot, current_appointments_in_slot')
            .eq('business_id', businessId)
            .eq('date', formattedDate)
            .in('slot_id', slotIdsFromDbSlots);
        if (dailyError) throw dailyError;
        dailyAvailabilities = data || [];
      }

      // 3. İki listeyi birleştirerek DisplaySlot listesini oluştur
      const combinedSlots: DisplaySlot[] = baseSlots.map(slot => {
        const dailyInfo = slot.id ? dailyAvailabilities.find(da => da.slot_id === slot.id) : null;
        // Şimdilik, yeni şablonlar ve günlük kaydı olmayan mevcut şablonlar için varsayılan `true` kullanalım.
        const isAvailableByDefault = true; 
        // opHours bilgisini burada da kullanarak, eğer gün genelde kapalıysa yeni üretilen slotları da kapalı başlatabiliriz.
        // Ancak bu opHours bilgisini buraya taşımak fetchSlotsForDate'i biraz daha karmaşıklaştırır.
        // Şimdilik, sadece is_new_template ve dailyInfo durumuna bakıyoruz.
        const isAvailable = dailyInfo ? dailyInfo.is_available : isAvailableByDefault; 

        return {
          ...slot,
          is_available: isAvailable,
          daily_slot_availability_id: dailyInfo?.id,
          max_appointments: dailyInfo?.max_appointments_in_slot ?? slot.max_concurrent_appointments ?? 1,
          current_appointments: dailyInfo?.current_appointments_in_slot ?? 0,
        };
      });

      setDisplaySlots(combinedSlots);
    } catch (err) {
      console.error('Error fetching slot availabilities:', err);
      setErrorSlots(err instanceof Error ? err.message : 'Slotlar getirilirken bir hata oluştu.');
      setDisplaySlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [businessId]);

  useEffect(() => {
    if (selectedDate && businessId) {
      fetchSlotsForDate(selectedDate);
    } else {
      setDisplaySlots([]); // Tarih veya işletme ID'si yoksa slotları temizle
    }
  }, [selectedDate, businessId, fetchSlotsForDate]);

  const toggleSlotAvailability = (slotNameToToggle: string) => {
    setDisplaySlots(prevSlots =>
      prevSlots.map(slot =>
        slot.slot_name === slotNameToToggle
          ? { ...slot, is_available: !slot.is_available }
          : slot
      )
    );
  };

  const saveSlotAvailabilities = async () => {
    if (!businessId || !selectedDate) {
      Alert.alert('Hata', 'İşletme veya tarih seçilmemiş.');
      return;
    }
    setLoadingSlots(true);
    const formattedDate = formatDateToYYYYMMDD(selectedDate);

    try {
      // slotsToCreateInTemplates objelerinden clientKey çıkarıldı
      const slotsToCreateInTemplates: Omit<AppointmentSlot, 'id' | 'is_new_template' | 'clientKey'>[] = [];
      const dailyAvailabilityUpserts: any[] = [];
      const tempClientKeyToDbIdMap = new Map<string, string>(); 

      for (const slot of displaySlots) {
        if (slot.is_new_template && !slot.id) { 
          slotsToCreateInTemplates.push({
            slot_name: slot.slot_name,
            start_time: slot.start_time,
            end_time: slot.end_time,
            duration_minutes: slot.duration_minutes,
            max_concurrent_appointments: slot.max_appointments || 1,
            // business_id ve is_active insert sırasında eklenecek
          });
        }
      }

      if (slotsToCreateInTemplates.length > 0) {
        const payloadForTemplateCreation = slotsToCreateInTemplates.map(s => ({
          ...s, 
          business_id: businessId, 
          is_active: true
        }));
        
        console.log('Creating new slot templates:', JSON.stringify(payloadForTemplateCreation, null, 2));

        const { data: createdTemplateSlots, error: templateCreateError } = await supabase
          .from('appointment_time_slots')
          .insert(payloadForTemplateCreation)
          .select('id, slot_name, start_time'); // Eşleştirme için slot_name ve start_time geri alınıyor

        if (templateCreateError) throw templateCreateError;

        createdTemplateSlots?.forEach(createdSlot => {
          // Eşleştirme anahtarı: slot_name ve start_time'ın birleşimi
          const mappingKey = `${createdSlot.slot_name}_${createdSlot.start_time}`;
          tempClientKeyToDbIdMap.set(mappingKey, createdSlot.id);
        });
      }

      for (const slot of displaySlots) {
        let finalSlotId = slot.id;
        if (slot.is_new_template && !slot.id) {
          const mappingKey = `${slot.slot_name}_${slot.start_time}`;
          finalSlotId = tempClientKeyToDbIdMap.get(mappingKey) || null;
          if (!finalSlotId) {
            console.warn('Could not find DB ID for newly created template slot (after insert):', slot);
            continue; 
          }
        }

        if (!finalSlotId) {
            console.warn('Skipping daily availability for slot with no ID:', slot);
            continue;
        }

        dailyAvailabilityUpserts.push({
          business_id: businessId,
          slot_id: finalSlotId,
          date: formattedDate,
          is_available: slot.is_available,
          max_appointments_in_slot: slot.max_appointments,
        });
      }
      
      if (dailyAvailabilityUpserts.length > 0) {
        console.log('Upserting daily availabilities:', JSON.stringify(dailyAvailabilityUpserts, null, 2));
        const { error: upsertError } = await supabase
          .from('daily_slot_availability')
          .upsert(dailyAvailabilityUpserts, { 
              onConflict: 'business_id, slot_id, date',
          });
        if (upsertError) throw upsertError;
      }

      Alert.alert('Başarılı', 'Müsaitlik durumları kaydedildi.');
      if (selectedDate) fetchSlotsForDate(selectedDate); // State'i tazelemek için

    } catch (err) {
      console.error('Error saving slot availabilities:', err);
      Alert.alert('Kaydetme Hatası', err instanceof Error ? err.message : 'Müsaitlik kaydedilemedi.');
    } finally {
      setLoadingSlots(false);
    }
  };

  return {
    displaySlots,
    loadingSlots,
    errorSlots,
    toggleSlotAvailability,
    saveSlotAvailabilities,
    fetchSlotsForDate,
  };
}; 