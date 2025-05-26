import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Switch } from 'react-native';
import { Icon } from '@rneui/themed';
import { useSlotAvailability, DisplaySlot } from '../hooks/useSlotAvailability'; // Hook'u import et

interface SlotAvailabilityEditorProps {
  businessId: string | null;
  selectedDate: Date | null;
  // Gerekirse stil veya başka proplar eklenebilir
}

const SlotAvailabilityEditor: React.FC<SlotAvailabilityEditorProps> = ({ 
  businessId, 
  selectedDate 
}) => {
  const {
    displaySlots,
    loadingSlots,
    errorSlots,
    toggleSlotAvailability,
    saveSlotAvailabilities,
    fetchSlotsForDate, // Belki manuel yenileme için kullanılabilir
  } = useSlotAvailability({ businessId, selectedDate });

  if (!selectedDate) {
    return (
      <View style={styles.centeredMessageContainer}>
        <Icon name="calendar-remove-outline" type="ionicon" size={40} color="#888" />
        <Text style={styles.messageText}>Lütfen takvimden bir tarih seçin.</Text>
      </View>
    );
  }

  if (loadingSlots) {
    return (
      <View style={styles.centeredMessageContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={[styles.messageText, {marginTop: 10}]}>Saat aralıkları yükleniyor...</Text>
      </View>
    );
  }

  if (errorSlots) {
    return (
      <View style={styles.centeredMessageContainer}>
        <Icon name="alert-circle-outline" type="ionicon" size={40} color="#D32F2F" />
        <Text style={[styles.messageText, styles.errorText]}>{errorSlots}</Text>
        {selectedDate && (
            <TouchableOpacity onPress={() => fetchSlotsForDate(selectedDate)} style={styles.retryButton}>
                <Icon name="refresh-outline" type="ionicon" color="white" size={18} style={{marginRight: 8}}/>
                <Text style={styles.retryButtonText}>Tekrar Dene</Text>
            </TouchableOpacity>
        )}
      </View>
    );
  }

  if (displaySlots.length === 0) {
    return (
      <View style={styles.centeredMessageContainer}>
        <Icon name="hourglass-outline" type="ionicon" size={40} color="#888" />
        <Text style={styles.messageText}>
          Seçili tarih için tanımlı aktif saat aralığı bulunamadı.
        </Text>
        <Text style={styles.subMessageText}>
          Lütfen işletmenizin 'Saat Aralıkları Yönetimi' bölümünden zaman aralıkları tanımladığınızdan emin olun.
        </Text>
      </View>
    );
  }

  const handleSave = async () => {
    await saveSlotAvailabilities();
    // Kaydetme sonrası ek bir işlem gerekirse burada yapılabilir.
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {displaySlots.map((slot, index) => (
          <View key={slot.id || slot.slot_name || `slot-${index}`} style={styles.slotRow}>
            <View style={styles.slotInfo}>
              <Text style={styles.slotName}>{slot.slot_name}</Text>
              <Text style={styles.slotTime}>{`${slot.start_time.substring(0,5)} - ${slot.end_time.substring(0,5)}`}</Text>
            </View>
            <View style={styles.slotActions}>
                <Text style={[styles.availabilityText, slot.is_available ? styles.availableText : styles.unavailableText]}>
                    {slot.is_available ? 'Müsait' : 'Müsait Değil'}
                </Text>
                <Switch
                    trackColor={{ false: '#D3D3D3', true: '#81b0ff' }}
                    thumbColor={slot.is_available ? '#007AFF' : '#f4f3f4'}
                    ios_backgroundColor="#D1D1D6"
                    onValueChange={() => toggleSlotAvailability(slot.slot_name)}
                    value={slot.is_available}
                    style={styles.switchControl}
                />
            </View>
          </View>
        ))}
      </ScrollView>
      <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={loadingSlots}> 
        {loadingSlots && displaySlots.length > 0 ? (
            <ActivityIndicator color="white" size="small" /> 
        ) : (
            <>
                <Icon name="save-outline" type="ionicon" color="white" size={22} style={{marginRight: 10}}/>
                <Text style={styles.saveButtonText}>Müsaitlik Durumlarını Kaydet</Text>
            </>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFC',
    paddingHorizontal: 10,
    paddingTop: 10, // Takvim ve bu bileşen arasına boşluk için BusinessAvailabilityScreen'de ayarlanabilir.
  },
  scrollView: {
    flex: 1,
    marginBottom: 75, // Kaydet butonu için boşluk
  },
  centeredMessageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  messageText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginTop: 10,
  },
  subMessageText: {
    fontSize: 13,
    color: '#777',
    textAlign: 'center',
    marginTop: 8,
  },
  errorText: {
    color: '#D32F2F',
    fontWeight: '500',
  },
  retryButton: {
    flexDirection: 'row',
    marginTop: 20,
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  slotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  slotInfo: {
    flex: 1, // İsim ve saat için daha fazla alan
  },
  slotName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  slotTime: {
    fontSize: 13,
    color: '#666',
    marginTop: 3,
  },
  slotActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  availabilityText: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 10,
  },
  availableText: {
    color: '#28A745', // Yeşil
  },
  unavailableText: {
    color: '#DC3545', // Kırmızı
  },
  switchControl: {
    transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }], // Biraz daha küçük Switch
  },
  saveButton: {
    position: 'absolute',
    bottom: 15,
    left: 15,
    right: 15,
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold',
  },
});

export default SlotAvailabilityEditor; 