import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// useSlotAvailability.ts dosyasındaki AppointmentSlot ve DisplaySlot benzer yapıda olacak,
// ancak DisplaySlot'a 'is_bookable' gibi bir alan eklenebilir.
interface BaseSlotInfo {
  id: string; // appointment_time_slots.id
  slot_name: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
}

export interface CustomerDisplaySlot extends BaseSlotInfo {
  is_bookable: boolean;
  reason_not_bookable?: string | null;
  // İleride belki max_appointments, current_appointments gibi bilgiler de gösterilebilir.
}

interface UseCustomerAvailableSlotsProps {
  businessId: string | null;
  selectedDate: Date | null;
}

interface UseCustomerAvailableSlotsReturn {
  bookableSlots: CustomerDisplaySlot[];
  loadingCustomerSlots: boolean;
  errorCustomerSlots: string | null;
  fetchCustomerSlotsForDate: (date: Date) => void;
}

const formatDateToYYYYMMDD = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const useCustomerAvailableSlots = ({
  businessId,
  selectedDate,
}: UseCustomerAvailableSlotsProps): UseCustomerAvailableSlotsReturn => {
  const [bookableSlots, setBookableSlots] = useState<CustomerDisplaySlot[]>([]);
  const [loadingCustomerSlots, setLoadingCustomerSlots] = useState<boolean>(false);
  const [errorCustomerSlots, setErrorCustomerSlots] = useState<string | null>(null);

  const fetchCustomerSlotsForDate = useCallback(async (date: Date) => {
    if (!businessId) {
      setBookableSlots([]);
      return;
    }
    setLoadingCustomerSlots(true);
    setErrorCustomerSlots(null);
    const formattedDate = formatDateToYYYYMMDD(date);

    try {
      // 1. İşletmeye ait tüm aktif 'appointment_time_slots'ları çek
      const { data: allActiveSlots, error: slotsError } = await supabase
        .from('appointment_time_slots')
        .select('id, slot_name, start_time, end_time, duration_minutes')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('start_time', { ascending: true });

      if (slotsError) throw slotsError;

      if (!allActiveSlots || allActiveSlots.length === 0) {
        setErrorCustomerSlots('Bu işletme için tanımlı aktif saat aralığı bulunmuyor.');
        setBookableSlots([]);
        setLoadingCustomerSlots(false);
        return;
      }

      // 2. Seçilen tarih için 'daily_slot_availability' kayıtlarını çek
      const slotIds = allActiveSlots.map(s => s.id);
      const { data: dailyAvailabilities, error: dailyError } = await supabase
        .from('daily_slot_availability')
        .select('slot_id, is_available, max_appointments_in_slot, current_appointments_in_slot')
        .eq('business_id', businessId)
        .eq('date', formattedDate)
        .in('slot_id', slotIds);

      if (dailyError) throw dailyError;

      // 3. İki listeyi birleştirerek CustomerDisplaySlot listesini oluştur
      const combinedSlots: CustomerDisplaySlot[] = allActiveSlots.map(activeSlot => {
        const dailyInfo = dailyAvailabilities?.find(da => da.slot_id === activeSlot.id);
        let isBookable = false;
        let reasonNotBookable: string | null = 'İşletme bu saat için müsaitlik belirtmemiş.';

        if (dailyInfo) {
          if (dailyInfo.is_available) {
            if (dailyInfo.current_appointments_in_slot < dailyInfo.max_appointments_in_slot) {
              isBookable = true;
              reasonNotBookable = null;
            } else {
              reasonNotBookable = 'Bu saat aralığı dolu.';
            }
          } else {
            reasonNotBookable = 'İşletme bu saati kapalı olarak işaretlemiş.';
          }
        } 
        // Eğer dailyInfo yoksa, slot müşteri için müsait değildir.
        // İşletme sahibi o gün için o slotu açmamış/kaydetmemiş demektir.

        return {
          ...activeSlot,
          is_bookable: isBookable,
          reason_not_bookable: reasonNotBookable,
        };
      });
      
      // İsteğe bağlı: Sadece bookable olanları veya hepsini gösterip UI'da disable edilebilir.
      // Şimdilik hepsini dönelim, UI karar versin.
      setBookableSlots(combinedSlots);

    } catch (err) {
      console.error('Error fetching customer available slots:', err);
      setErrorCustomerSlots(err instanceof Error ? err.message : 'Müsait saatler getirilirken bir hata oluştu.');
      setBookableSlots([]);
    } finally {
      setLoadingCustomerSlots(false);
    }
  }, [businessId]);

  useEffect(() => {
    if (selectedDate && businessId) {
      fetchCustomerSlotsForDate(selectedDate);
    } else {
      setBookableSlots([]);
    }
  }, [businessId, selectedDate?.toISOString()]);

  return {
    bookableSlots,
    loadingCustomerSlots,
    errorCustomerSlots,
    fetchCustomerSlotsForDate,
  };
}; 