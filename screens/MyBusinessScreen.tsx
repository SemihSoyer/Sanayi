import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, Alert, ActivityIndicator, Image, TouchableOpacity, Platform, Dimensions, Modal, SafeAreaView, StatusBar } from 'react-native'; // SafeAreaView ve StatusBar eklendi
import { Text, Input, Button, Icon, Card, CheckBox } from '@rneui/themed'; // CheckBox eklendi
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps'; // PROVIDER_DEFAULT eklendi
import { supabase } from '../lib/supabase';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'; // DateTimePickerEvent eklendi

// BusinessDetails arayüzünden id çıkarıldı, owner_id PK olacak.
interface BusinessDetails {
  owner_id: string;
  name: string;
  description: string;
  address: string;
  city_id?: string | null; // Yeni eklendi: Şehir ID'si
  photos: string[];
  is_published: boolean;
  latitude: number | null; // Yeni eklendi
  longitude: number | null; // Yeni eklendi
}

interface ServiceType {
  id: string;
  name: string;
  icon_url?: string;
}

interface City { // Yeni eklendi: Şehir arayüzü
  id: string;
  name: string;
}

interface OperatingHour {
  id?: string;
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

const MyBusinessScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  
  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [currentBusinessId, setCurrentBusinessId] = useState<string | null>(null); // Eklenen işletmenin ID'sini tutmak için
  const [isPublished, setIsPublished] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [cities, setCities] = useState<City[]>([]); // Yeni eklendi: Şehirler listesi
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null); // Yeni eklendi: Seçilen şehir ID'si
  const [isCityModalVisible, setIsCityModalVisible] = useState(false); // Yeni eklendi: Şehir seçme modalı görünürlüğü
  const [loadingCities, setLoadingCities] = useState(true); // Başlangıçta true olmalı

  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [selectedServiceTypeIds, setSelectedServiceTypeIds] = useState<string[]>([]);
  const [loadingServiceTypes, setLoadingServiceTypes] = useState(false);

  const [hasBusiness, setHasBusiness] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [fullScreenMapVisible, setFullScreenMapVisible] = useState(false); // Tam ekran harita modal durumu
  const [initialModalLatitude, setInitialModalLatitude] = useState<number | null>(null);
  const [initialModalLongitude, setInitialModalLongitude] = useState<number | null>(null);
  
  const mapRef = useRef<MapView>(null); // Küçük harita için ref
  const fullScreenMapRef = useRef<MapView>(null); // Tam ekran harita için ref

  const [operatingHours, setOperatingHours] = useState<OperatingHour[]>([]);
  const [loadingOperatingHours, setLoadingOperatingHours] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerData, setTimePickerData] = useState<{ dayIndex: number; type: 'open' | 'close' } | null>(null);
  const [selectedPickerTime, setSelectedPickerTime] = useState(new Date());

  const [selectedDaysForBatchUpdate, setSelectedDaysForBatchUpdate] = useState<number[]>([]);
  const [batchOpenTime, setBatchOpenTime] = useState<string | null>(null);
  const [batchCloseTime, setBatchCloseTime] = useState<string | null>(null);

  // YENİ: Haftanın günleri için isimler (Türkçe)
  const daysOfWeek = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

  const fetchOwnerIdAndInitialData = useCallback(async () => {
    setLoading(true);
    setLoadingServiceTypes(true);
    setLoadingCities(true);
    setLoadingOperatingHours(true); // YENİ: Çalışma saatleri yüklemesini başlat
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const currentOwnerId = session.user.id;
      setOwnerId(currentOwnerId);

      // Hizmet türlerini çek
      try {
        const { data: serviceTypesData, error: serviceTypesError } = await supabase
          .from('ServiceTypes')
          .select('id, name, icon_url');
        if (serviceTypesError) throw serviceTypesError;
        setServiceTypes(serviceTypesData || []);
      } catch (error) {
        if (error instanceof Error) Alert.alert('Hata', 'Hizmet türleri çekilirken bir sorun oluştu: ' + error.message);
      } finally {
        setLoadingServiceTypes(false);
      }

      // Şehirleri çek
      try {
        console.log('[MyBusinessScreen] Şehir verileri çekiliyor...');
        const { data: citiesData, error: citiesError } = await supabase
          .from('cities')
          .select('id, name')
          .order('name', { ascending: true });
        
        console.log('[MyBusinessScreen] Şehir verileri:', JSON.stringify(citiesData));
        console.log('[MyBusinessScreen] Şehir sorgu hatası:', JSON.stringify(citiesError));
        
        if (citiesError) throw citiesError;
        setCities(citiesData || []);
      } catch (error) {
        console.error('[MyBusinessScreen] Şehir çekme hatası:', error);
        if (error instanceof Error) Alert.alert('Hata', 'Şehirler çekilirken bir sorun oluştu: ' + error.message);
      } finally {
        setLoadingCities(false);
      }
      
      try {
        console.log(`[MyBusinessScreen] Fetching business for owner_id: ${currentOwnerId}`);
        const { data, error: fetchError } = await supabase
          .from('businesses')
          .select('name, description, address, latitude, longitude, photos, is_published, id, city_id') // city_id eklendi
          .eq('owner_id', currentOwnerId)
          .limit(1) // Kullanıcıya ait ilk işletmeyi al
          .maybeSingle(); // 0 veya 1 kayıt döndürür

        console.log('[MyBusinessScreen] Fetched business data (first one):', JSON.stringify(data, null, 2));
        console.log('[MyBusinessScreen] Fetch business error:', JSON.stringify(fetchError, null, 2));

        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116: "No rows found", bu bir hata değil eğer işletme yoksa.
           console.error('[MyBusinessScreen] Supabase fetch error (not PGRST116):', fetchError);
           throw fetchError;
        }
        // if (error) throw error; // Yukarıdaki if fetchError kontrolü ile değiştirildi

        if (data) {
          setBusinessName(data.name || '');
          setDescription(data.description || '');
          setAddress(data.address || '');
          setLatitude(data.latitude);
          setLongitude(data.longitude);
          setPhotos(Array.isArray(data.photos) ? data.photos : []);
          setIsPublished(data.is_published || false);
          setCurrentBusinessId(data.id);
          setSelectedCityId(data.city_id || null); // Seçili şehir ID'sini state'e ata
          setHasBusiness(true);
          setIsEditing(false);

          // İşletmeye ait hizmetleri çek
          const { data: businessServicesData, error: bsError } = await supabase
            .from('BusinessServices')
            .select('service_type_id')
            .eq('business_id', data.id); // İşletme ID'si ile filtrele

          if (bsError) throw bsError;
          setSelectedServiceTypeIds(businessServicesData?.map(bs => bs.service_type_id) || []);

          // YENİ EKLENEN KISIM: Çalışma Saatlerini Çek
          if (data.id) { // İşletme ID'si varsa çalışma saatlerini çek
            console.log(`[MyBusinessScreen] Fetching operating hours for business_id: ${data.id}`);
            const { data: hoursData, error: hoursError } = await supabase
              .from('business_operating_hours')
              .select('id, day_of_week, open_time, close_time, is_closed')
              .eq('business_id', data.id);

            if (hoursError) {
              console.error('[MyBusinessScreen] Error fetching operating hours:', hoursError);
              // Hata olsa bile varsayılan boş saatlerle devam et
              // Alert.alert('Hata', 'Çalışma saatleri çekilirken bir sorun oluştu: ' + hoursError.message);
            }

            const defaultHours: OperatingHour[] = Array(7).fill(null).map((_, index) => ({
              day_of_week: index, // 0 Pazar, 1 Pazartesi ... 6 Cumartesi
              open_time: null, // Veya varsayılan "09:00"
              close_time: null, // Veya varsayılan "18:00"
              is_closed: true, // Varsayılan olarak kapalı
            }));

            if (hoursData && hoursData.length > 0) {
              hoursData.forEach(dbHour => {
                const dayIndex = defaultHours.findIndex(dh => dh.day_of_week === dbHour.day_of_week);
                if (dayIndex !== -1) {
                  defaultHours[dayIndex] = {
                    id: dbHour.id,
                    day_of_week: dbHour.day_of_week,
                    // DB'den gelen saatler "HH:mm:ss" formatında olabilir, "HH:mm"ye çevirelim.
                    open_time: dbHour.open_time ? dbHour.open_time.substring(0, 5) : null,
                    close_time: dbHour.close_time ? dbHour.close_time.substring(0, 5) : null,
                    is_closed: dbHour.is_closed,
                  };
                }
              });
            }
            setOperatingHours(defaultHours);
            console.log('[MyBusinessScreen] Operating hours set:', defaultHours);
          } else {
            // İşletme ID'si yoksa (yeni işletme durumu), varsayılan saatleri ayarla
             const defaultHours: OperatingHour[] = Array(7).fill(null).map((_, index) => ({
              day_of_week: index,
              open_time: null,
              close_time: null,
              is_closed: true,
            }));
            setOperatingHours(defaultHours);
          }
          // YENİ EKLENEN KISIM BİTTİ

        } else {
          // Eğer daha önce bir işletme vardıysa (hasBusiness true ise) ve şimdi veri gelmiyorsa,
          // bu genellikle "Vazgeç" sonrası bir veri çekme hatası olabilir.
          // Kullanıcının gördüğü bilgileri hemen silmek yerine uyarı verip düzenleme modunu kapat.
          if (hasBusiness) {
            Alert.alert('Uyarı', 'İşletme bilgileri güncellenirken bir sorun oluştu. Mevcut bilgiler gösteriliyor.');
            setIsEditing(false); // Düzenleme modundan çık
            // Diğer state'ler (businessName, description vb.) zaten dolu olduğu için sıfırlamıyoruz.
          } else {
            // Gerçekten hiç işletme yoksa veya ilk defa yükleniyorsa state'leri sıfırla.
            setHasBusiness(false);
            setIsEditing(false);
            setCurrentBusinessId(null); // İşletme ID'sini temizle
            setBusinessName('');
            setDescription('');
            setAddress('');
            setLatitude(null);
            setLongitude(null);
            setPhotos([]);
            setIsPublished(false);
            setSelectedCityId(null); // Şehir ID'sini de sıfırla
            setSelectedServiceTypeIds([]);
            // YENİ: İşletme yoksa varsayılan çalışma saatlerini de ayarla
            const defaultHours: OperatingHour[] = Array(7).fill(null).map((_, index) => ({
              day_of_week: index,
              open_time: null,
              close_time: null,
              is_closed: true,
            }));
            setOperatingHours(defaultHours);
          }
        }
      } catch (error) {
        if (error instanceof Error) {
            Alert.alert('Hata', 'İşyeri bilgileri çekilirken bir sorun oluştu: ' + error.message);
            console.error('[MyBusinessScreen] Catch block error while fetching business:', error);
        } else {
            Alert.alert('Hata', 'İşyeri bilgileri çekilirken bilinmeyen bir sorun oluştu.');
            console.error('[MyBusinessScreen] Catch block unknown error while fetching business:', error);
        }
        // Hata durumunda, eğer daha önce bir işletme varsa, UI'ın boşalmaması için
        // hasBusiness'ı false yapmıyoruz, sadece düzenleme modunu kapatıyoruz.
        if (!hasBusiness) { // Sadece gerçekten işletme yoksa veya ilk yüklemede hata olduysa false yap.
          setHasBusiness(false);
        }
        setIsEditing(false); // Her durumda düzenleme modundan çık
      } finally {
        setLoading(false);
        setLoadingOperatingHours(false); // YENİ: Çalışma saatleri yüklemesini bitir
      }
    } else {
      setLoading(false);
      setLoadingServiceTypes(false);
      setLoadingCities(false);
      setLoadingOperatingHours(false); // YENİ: Çalışma saatleri yüklemesini durdur
      Alert.alert("Hata", "Kullanıcı oturumu bulunamadı.");
      setHasBusiness(false);
      setIsEditing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchOwnerIdAndInitialData();
    }, [fetchOwnerIdAndInitialData])
  );

  const handlePickAndUploadImage = async () => {
    if (!ownerId) {
        Alert.alert("Hata", "Fotoğraf yüklemek için kullanıcı kimliği bulunamadı.");
        return;
    }
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert("İzin Gerekli", "Fotoğraf seçmek için galeri izni vermelisiniz.");
        return;
      }
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images', // Tekrar string 'images' olarak düzeltildi
        allowsMultipleSelection: true, 
        quality: 0.6,
        // aspect ve allowsEditing genellikle tekil seçimde kullanılır, çoklu seçimde kaldıralım
      });

      if (pickerResult.canceled) return;

      if (pickerResult.assets && pickerResult.assets.length > 0) {
        setUploadingPhoto(true);
        const uploadedUrls: string[] = [];
        for (const asset of pickerResult.assets) {
          try {
            const uri = asset.uri;
            const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
            const originalFileName = asset.fileName || `photo_${Date.now()}`;
            // Her dosya için benzersiz bir isim oluşturmak önemli
            const fileName = `${Date.now()}_${originalFileName}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
            const filePath = `${ownerId}/${fileName}`;
            
            // Blob oluşturma yerine FormData kullanacağız
            const formData = new FormData();
            formData.append('file', {
              uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
              name: fileName,
              type: asset.mimeType || `image/${fileExt}`, // Geçerli bir MIME türü olduğundan emin olun
            } as any);

            console.log(`[Upload Debug] File: ${originalFileName}, URI: ${uri}`);
            console.log(`[Upload Debug] FormData created for file: ${fileName}, Type: ${asset.mimeType || `image/${fileExt}`}`);
            
            // Blob size kontrolü FormData ile doğrudan yapılamaz, ancak ImagePicker genellikle geçerli assetler döndürür.
            // Sunucu tarafında 0 byte kontrolü veya yükleme sonrası kontrol daha anlamlı olabilir.

            console.log(`[Upload Debug] Attempting to upload to Supabase with FormData. Path: ${filePath}`);
            const { error: uploadError, data: uploadData } = await supabase.storage
              .from('businesses-photos')
              .upload(filePath, formData, { // blob yerine formData
                upsert: true, // ProfileScreen'deki gibi true yapalım
                // contentType FormData ile genellikle belirtilmez, Supabase client halleder.
              });
            
            console.log(`[Upload Debug] Supabase upload response for ${originalFileName} - Error:`, JSON.stringify(uploadError));
            console.log(`[Upload Debug] Supabase upload response for ${originalFileName} - Data:`, JSON.stringify(uploadData));

            if (uploadError) {
              console.error(`[Upload Debug] Supabase upload failed for ${originalFileName}:`, uploadError);
              throw uploadError;
            }
            
            const { data: publicURLData } = supabase.storage.from('businesses-photos').getPublicUrl(filePath);
            console.log(`[Upload Debug] Supabase getPublicUrl for ${originalFileName} - URL Data:`, JSON.stringify(publicURLData));

            if (!publicURLData?.publicUrl) {
              console.error(`[Upload Debug] Failed to get public URL for ${originalFileName}. publicURLData:`, publicURLData);
              throw new Error(`Fotoğraf için public URL alınamadı: ${originalFileName}.`);
            }
            
            console.log(`[Upload Debug] Successfully got public URL for ${originalFileName}: ${publicURLData.publicUrl}`);
            uploadedUrls.push(publicURLData.publicUrl);
          } catch (loopError) {
            console.error(`[Upload Debug] Error in upload loop for ${asset.fileName || 'Bilinmeyen dosya'}:`, loopError);
            if (loopError instanceof Error) Alert.alert('Bir Fotoğraf Yüklenirken Hata Oluştu', `${asset.fileName || 'Bilinmeyen dosya'}: ${loopError.message}`);
            else Alert.alert('Bir Fotoğraf Yüklenirken Hata Oluştu', `${asset.fileName || 'Bilinmeyen dosya'}: Bilinmeyen bir hata.`);
            // Bir fotoğraf başarısız olursa diğerlerine devam etmeyi veya durmayı seçebilirsiniz.
            // Şimdilik devam ediyoruz ama kullanıcıya bilgi veriyoruz.
          }
        }
        if (uploadedUrls.length > 0) {
          setPhotos(prevPhotos => [...prevPhotos, ...uploadedUrls]);
        }
      }
    } catch (error) {
      // Genel try-catch bloğu, picker'ın kendisinden veya beklenmedik bir durumdan kaynaklanan hatalar için.
      if (error instanceof Error) Alert.alert('Fotoğraf Seçme/Yükleme Hatası', error.message);
      else Alert.alert('Fotoğraf Yükleme Hatası', 'Bilinmeyen bir hata oluştu.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = (indexToDelete: number) => {
    setPhotos(prevPhotos => prevPhotos.filter((_, index) => index !== indexToDelete));
  };

  const movePhoto = (fromIndex: number, toIndex: number) => {
    const newPhotos = [...photos];
    const [movedPhoto] = newPhotos.splice(fromIndex, 1);
    newPhotos.splice(toIndex, 0, movedPhoto);
    setPhotos(newPhotos);
  };

  const handleSaveBusinessDetails = async () => {
    if (!ownerId) {
      Alert.alert('Hata', 'Kullanıcı kimliği bulunamadı. Lütfen tekrar giriş yapın.');
      return;
    }
    if (!businessName.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen işletme adını girin.');
      return;
    }
    if (!selectedCityId) {
        Alert.alert('Eksik Bilgi', 'Lütfen işletmenizin bulunduğu şehri seçin.');
        return;
    }
    if (selectedServiceTypeIds.length === 0) {
        Alert.alert('Eksik Bilgi', 'Lütfen en az bir hizmet türü seçin.');
        return;
    }
    // Enlem ve boylam için de kontrol eklenebilir (isteğe bağlı)
    if (latitude === null || longitude === null) {
        Alert.alert('Eksik Bilgi', 'Lütfen haritadan işletmenizin konumunu seçin.');
      return;
    }

    setSaving(true);
    try {
      const businessDataToSave: BusinessDetails = {
        owner_id: ownerId,
        name: businessName.trim(),
        description: description.trim(),
        address: address.trim(),
        city_id: selectedCityId,
        photos: photos,
        is_published: isPublished,
        latitude: latitude,
        longitude: longitude,
      };

      let savedBusinessId = currentBusinessId;

      if (hasBusiness && currentBusinessId) {
        // Var olan işletmeyi güncelle
        console.log('[MyBusinessScreen] Updating existing business, ID:', currentBusinessId);
        const { data, error } = await supabase
        .from('businesses')
          .update(businessDataToSave)
          .eq('id', currentBusinessId)
          .select('id') // Güncellenen kaydın ID'sini geri al
        .single();
        if (error) throw error;
        if (!data) throw new Error("İşletme güncellenirken ID alınamadı.");
        savedBusinessId = data.id;
        console.log('[MyBusinessScreen] Business updated successfully, ID:', savedBusinessId);

      } else {
        // Yeni işletme oluştur
        console.log('[MyBusinessScreen] Creating new business...');
        const { data, error } = await supabase
          .from('businesses')
          .insert(businessDataToSave)
          .select('id') // Eklenen kaydın ID'sini geri al
          .single(); 
        if (error) throw error;
        if (!data) throw new Error("İşletme oluşturulurken ID alınamadı.");
        savedBusinessId = data.id;
        setCurrentBusinessId(savedBusinessId); // Yeni ID'yi state'e kaydet
        setHasBusiness(true); // Artık bir işletmesi var
        console.log('[MyBusinessScreen] Business created successfully, ID:', savedBusinessId);
      }

      // İşletme hizmetlerini güncelle (önce eskileri sil, sonra yenilerini ekle)
      if (savedBusinessId) {
        console.log(`[MyBusinessScreen] Updating business services for business_id: ${savedBusinessId}`);
        // Önce mevcut tüm hizmetleri sil
        const { error: deleteError } = await supabase
          .from('BusinessServices')
          .delete()
          .eq('business_id', savedBusinessId);
        if (deleteError) {
            console.error('[MyBusinessScreen] Error deleting old business services:', deleteError);
            // Bu hatayı fırlatmak yerine loglayıp devam edebiliriz, çünkü ana işlem başarılı olmuş olabilir.
            // throw deleteError;
        }

        // Sonra seçili yeni hizmetleri ekle
        if (selectedServiceTypeIds.length > 0) {
          const servicesToInsert = selectedServiceTypeIds.map(serviceTypeId => ({
            business_id: savedBusinessId!,
            service_type_id: serviceTypeId,
          }));
          const { error: insertError } = await supabase
            .from('BusinessServices')
            .insert(servicesToInsert);
          if (insertError) {
            console.error('[MyBusinessScreen] Error inserting new business services:', insertError);
            // throw insertError;
        }
      }
        console.log('[MyBusinessScreen] Business services updated.');

        // YENİ EKLENEN KISIM: Çalışma Saatlerini Kaydet/Güncelle (UPSERT)
        console.log(`[MyBusinessScreen] Upserting operating hours for business_id: ${savedBusinessId}`);
        
        const operatingHoursToSave = operatingHours.map(hour => {
          // Veritabanına gönderilecek obje için bir tip tanımlayabiliriz (isteğe bağlı ama iyi pratik)
          interface BusinessOperatingHourForDB {
            id?: string;
            business_id: string;
            day_of_week: number;
            open_time: string | null;
            close_time: string | null;
            is_closed: boolean;
          }

          const entry: BusinessOperatingHourForDB = {
            business_id: savedBusinessId!,
            day_of_week: hour.day_of_week,
            open_time: !hour.is_closed && hour.open_time ? hour.open_time : null,
            close_time: !hour.is_closed && hour.close_time ? hour.close_time : null,
            is_closed: hour.is_closed,
            // id başlangıçta eklenmiyor
          };

          if (hour.id) { // Sadece mevcut bir ID varsa (güncellenecek kayıt) ID'yi ekle
            entry.id = hour.id;
          }
          // Eğer hour.id tanımsızsa (yeni kayıt), 'entry' objesinde 'id' alanı hiç olmayacak.
          // Bu, veritabanının varsayılan UUID üreticisini tetiklemesini sağlar.
          return entry;
        });

        // Tarih geçerlilik kontrolü (eğer kapalı değilse ve saatler null ise hata ver)
        for (const oh of operatingHoursToSave) {
            if (!oh.is_closed && (oh.open_time === null || oh.close_time === null)) {
                Alert.alert(
                    'Eksik Saat Bilgisi',
                    `${daysOfWeek[oh.day_of_week]} günü için açık olarak işaretlenmiş ancak açılış veya kapanış saati belirtilmemiş.`
                );
                setSaving(false); // Kaydetmeyi durdur
                return; // Fonksiyondan çık
            }
            if (!oh.is_closed && oh.open_time && oh.close_time && oh.open_time >= oh.close_time) {
                 Alert.alert(
                    'Geçersiz Saat Aralığı',
                    `${daysOfWeek[oh.day_of_week]} günü için açılış saati, kapanış saatinden sonra veya eşit olamaz.`
                );
                setSaving(false);
                return;
            }
        }

        const { error: hoursError } = await supabase
          .from('business_operating_hours')
          .upsert(operatingHoursToSave, { onConflict: 'business_id, day_of_week' }); // business_id ve day_of_week kombinasyonuna göre upsert yap

        if (hoursError) {
          console.error('[MyBusinessScreen] Error upserting operating hours:', hoursError);
          throw hoursError; // Bu hatayı fırlat ki kullanıcı bilgilendirilsin
        }
        console.log('[MyBusinessScreen] Operating hours upserted successfully.');
        // YENİ EKLENEN KISIM BİTTİ
      }

      Alert.alert('Başarılı', 'İşletme bilgileri kaydedildi!');
      setIsEditing(false); // Düzenleme modundan çık
      // Veriyi yenilemek için fetchOwnerIdAndInitialData'yı tekrar çağırabiliriz veya state'leri direkt güncel tuttuğumuz için gerekmeyebilir.
      // fetchOwnerIdAndInitialData(); // Eğer ID değişmişse veya sunucudan gelen son halini görmek istiyorsak.
    } catch (error) {
      console.error('[MyBusinessScreen] Error saving business details:', error);
      if (error instanceof Error) {
        Alert.alert('Kaydetme Hatası', error.message);
      } else {
        Alert.alert('Kaydetme Hatası', 'Bilinmeyen bir hata oluştu.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async () => {
    if (!ownerId || !hasBusiness) {
      Alert.alert('Hata', 'İşyeri bulunamadı veya kullanıcı kimliği eksik.');
      return;
    }
    setPublishing(true);
    try {
      const newPublishStatus = !isPublished;
      const { error } = await supabase
        .from('businesses')
        .update({ is_published: newPublishStatus })
        .eq('owner_id', ownerId);

      if (error) throw error;

      setIsPublished(newPublishStatus);
      Alert.alert('Başarılı', `İşyeri ${newPublishStatus ? 'yayınlandı' : 'yayından kaldırıldı'}.`);
    } catch (error) {
      if (error instanceof Error) Alert.alert('Yayınlama Hatası', error.message);
      else Alert.alert('Yayınlama Hatası', 'Bilinmeyen bir hata oluştu.');
    } finally {
      setPublishing(false);
    }
  };

  // Tam ekran harita için zoom fonksiyonları
  const zoomIn = async () => {
    const camera = await fullScreenMapRef.current?.getCamera();
    if (camera?.zoom !== undefined) {
      const newZoom = camera.zoom + 1;
      // Sadece zoom seviyesini animateCamera'ya geçirelim
      fullScreenMapRef.current?.animateCamera({ zoom: newZoom }, { duration: 300 });
    } else {
      console.warn("Zoom yapmak için mevcut kamera zoom seviyesi alınamadı.");
    }
  };

  const zoomOut = async () => {
    const camera = await fullScreenMapRef.current?.getCamera();
    if (camera?.zoom !== undefined && camera.zoom > 0) {
      const newZoom = camera.zoom - 1;
      // Sadece zoom seviyesini animateCamera'ya geçirelim
      fullScreenMapRef.current?.animateCamera({ zoom: newZoom }, { duration: 300 });
    } else if (camera?.zoom === 0) {
      console.log("Minimum zoom seviyesine ulaşıldı.");
    } else {
      console.warn("Uzaklaştırmak için mevcut kamera zoom seviyesi alınamadı.");
    }
  };

  // Harita üzerindeki marker'ın konumunu güncelleme
  const handleMapInteraction = (e: any) => {
    const { latitude: newLat, longitude: newLng } = e.nativeEvent.coordinate;
    setLatitude(newLat);
    setLongitude(newLng);
  };

  const handleServiceTypeToggle = (serviceTypeId: string) => {
    setSelectedServiceTypeIds(prev => 
      prev.includes(serviceTypeId) 
        ? prev.filter(id => id !== serviceTypeId) 
        : [...prev, serviceTypeId]
    );
  };

  // Şehir Seçme Modalı
  const renderCityPickerModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isCityModalVisible}
      onRequestClose={() => setIsCityModalVisible(false)}
    >
      <TouchableOpacity style={styles.cityModalOverlay} onPress={() => setIsCityModalVisible(false)} activeOpacity={1}>
        <TouchableOpacity style={styles.cityModalContent} activeOpacity={1} onPress={() => { /* Modal içeriğine tıklama yayılmasın */ }}>
          <Text style={styles.cityModalTitle}>Şehir Seçin</Text>
          {loadingCities ? (
            <ActivityIndicator size="large" color="#0066CC" style={{marginVertical: 20}} />
          ) : cities.length === 0 ? (
            <View style={{padding: 20, alignItems: 'center'}}>
              <Icon name="alert-circle-outline" type="ionicon" color="#F44336" size={40} />
              <Text style={[styles.cityOptionText, {textAlign: 'center', marginTop: 10, marginBottom: 5}]}>
                Şehir listesi yüklenemedi
              </Text>
              <Text style={{color: '#666', textAlign: 'center', marginBottom: 10}}>
                Veritabanında şehir verisi bulunamadı veya erişim hatası oluştu.
              </Text>
            </View>
          ) : (
            <ScrollView>
              {cities.map(city => (
                <TouchableOpacity 
                  key={city.id} 
                  style={styles.cityOptionButton}
                  onPress={() => {
                    setSelectedCityId(city.id);
                    setIsCityModalVisible(false);
                  }}
                >
                  <Text style={city.id === selectedCityId ? styles.cityOptionTextSelected : styles.cityOptionText}>{city.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          <Button title="Kapat" onPress={() => setIsCityModalVisible(false)} buttonStyle={styles.modalCloseButton} titleStyle={styles.modalCloseButtonText}/>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );

  // YENİ: Bir günü toplu güncelleme için seç/kaldır
  const toggleDayForBatchUpdate = (dayIndex: number) => {
    setSelectedDaysForBatchUpdate(prev =>
        prev.includes(dayIndex)
            ? prev.filter(d => d !== dayIndex)
            : [...prev, dayIndex]
    );
  };

  // YENİ: Seçili günlere toplu saatleri ve açık durumunu uygula
  const applyBatchTimeToSelectedDays = () => {
    if (selectedDaysForBatchUpdate.length === 0) {
        Alert.alert("Uyarı", "Lütfen önce saat atamak istediğiniz günleri seçin.");
        return;
    }
    if (!batchOpenTime || !batchCloseTime) {
        Alert.alert("Uyarı", "Lütfen geçerli bir açılış ve kapanış saati girin.");
        return;
    }
    if (batchOpenTime >= batchCloseTime) {
        Alert.alert("Geçersiz Saat Aralığı", "Açılış saati, kapanış saatinden önce olmalıdır.");
        return;
    }

    const updatedHours = operatingHours.map(opHour => {
        if (selectedDaysForBatchUpdate.includes(opHour.day_of_week)) {
            return {
                ...opHour,
                open_time: batchOpenTime,
                close_time: batchCloseTime,
                is_closed: false,
            };
        }
        return opHour;
    });
    setOperatingHours(updatedHours);
    setSelectedDaysForBatchUpdate([]); 
    // Batch saatlerini de sıfırlayabiliriz isteğe bağlı olarak
    // setBatchOpenTime(null); 
    // setBatchCloseTime(null);
    Alert.alert("Başarılı", "Seçili günlerin çalışma saatleri güncellendi.");
  };

  // YENİ: Bir günü direkt kapalı/açık yapma (tekil işlem için)
  const toggleSingleDayClosed = (dayOfWeekToToggle: number) => {
    const updatedHours = operatingHours.map(opHour => {
        if (opHour.day_of_week === dayOfWeekToToggle) {
            const newClosedState = !opHour.is_closed;
            return {
                ...opHour,
                is_closed: newClosedState,
                open_time: newClosedState ? null : (opHour.open_time || '09:00'), // Kapalıysa null, açılıyorsa ve saati yoksa varsayılan ata
                close_time: newClosedState ? null : (opHour.close_time || '18:00'),// Kapalıysa null, açılıyorsa ve saati yoksa varsayılan ata
            };
        }
        return opHour;
    });
    setOperatingHours(updatedHours);
  };
  
  // Revize edilmiş openTimePicker:
  const openTimePickerRevised = (
    type: 'batch_open' | 'batch_close' | `single_open_${number}` | `single_close_${number}`
  ) => {
    let initialTime: string | null = null;
    let dateToSet = new Date(); // Her zaman yeni bir Date objesiyle başla

    const today = new Date(); // Sadece saat ve dakika için kullanılacak referans tarih

    if (type === 'batch_open') initialTime = batchOpenTime;
    else if (type === 'batch_close') initialTime = batchCloseTime;
    else if (type.startsWith('single_open_')) {
        const dayIndex = parseInt(type.split('_')[2]);
        initialTime = operatingHours.find(h => h.day_of_week === dayIndex)?.open_time || null;
    } else if (type.startsWith('single_close_')) {
        const dayIndex = parseInt(type.split('_')[2]);
        initialTime = operatingHours.find(h => h.day_of_week === dayIndex)?.close_time || null;
    }

    if (initialTime) {
        const [hours, minutes] = initialTime.split(':').map(Number);
        dateToSet.setHours(hours, minutes, 0, 0); // Saniye ve milisaniyeyi sıfırla
    } else {
        // Eğer initialTime yoksa, varsayılan bir saat ayarla (örn: 09:00)
        // Bu, time picker'ın boş elle açılmamasını sağlar
        if (type.includes('open')) dateToSet.setHours(9,0,0,0);
        else dateToSet.setHours(18,0,0,0);

    }
    
    setSelectedPickerTime(dateToSet);
    setTimePickerData({ dayIndex: -1, type: type as any }); // dayIndex şimdilik önemli değil, type üzerinden yönetiliyor
    setShowTimePicker(true);
  };

  // Revize edilmiş onTimeConfirm
  const onTimeConfirmRevised = (selectedEvent: DateTimePickerEvent, selectedTime?: Date) => {
    // Android'de event type 'set' veya 'dismissed' olabilir, iOS için bu direkt çağrılmaz, modal butonuyla çağrılır.
    // Bu fonksiyon hem Android'den direkt hem de iOS modalinden çağrılacak şekilde ortaklaştırıldı.
    if (Platform.OS === 'android') {
        setShowTimePicker(false); // Android'de picker seçildikten sonra kapanır
        if (selectedEvent.type === 'dismissed') {
             setTimePickerData(null);
             return;
        }
    }
    // iOS için modal kapatma showTimePicker(false) ile ayrı yapılır.

    if (selectedTime && timePickerData) {
        const hours = selectedTime.getHours().toString().padStart(2, '0');
        const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
        const formattedTime = `${hours}:${minutes}`;
        const type = timePickerData.type as string;

        if (type === 'batch_open') {
            setBatchOpenTime(formattedTime);
        } else if (type === 'batch_close') {
            if (batchOpenTime && formattedTime <= batchOpenTime) {
                 Alert.alert("Geçersiz Saat", "Kapanış saati, toplu atama için seçilen açılış saatinden sonra olmalıdır.");
            } else {
                setBatchCloseTime(formattedTime);
            }
        } else if (type.startsWith('single_')) {
            const parts = type.split('_');
            const timeType = parts[1] as 'open' | 'close';
            const dayOfWeek = parseInt(parts[2]);

            const updatedHours = operatingHours.map(opHour => {
                if (opHour.day_of_week === dayOfWeek) {
                    const newHour = { ...opHour };
                    if (timeType === 'open') {
                        if (newHour.close_time && formattedTime >= newHour.close_time) {
                             Alert.alert("Geçersiz Saat", `${daysOfWeek[dayOfWeek]} için açılış saati (${formattedTime}), mevcut kapanış saatinden (${newHour.close_time}) sonra veya eşit olamaz.`);
                             return opHour; 
                        }
                        newHour.open_time = formattedTime;
                    } else { 
                         if (newHour.open_time && formattedTime <= newHour.open_time) {
                            Alert.alert("Geçersiz Saat", `${daysOfWeek[dayOfWeek]} için kapanış saati (${formattedTime}), mevcut açılış saatinden (${newHour.open_time}) önce veya eşit olamaz.`);
                            return opHour; 
                        }
                        newHour.close_time = formattedTime;
                    }
                    // Saat ayarlandıktan sonra günün kapalı olmadığını varsayalım,
                    // kullanıcı ayrıca kapalı olarak işaretlemediyse.
                    if (newHour.is_closed && (newHour.open_time || newHour.close_time)) {
                        // Eğer gün kapalıysa ve bir saat atanıyorsa, günü açık yap.
                        // Bu durum toggleSingleDayClosed ile daha iyi yönetilebilir,
                        // ancak burada da bir güvenlik önlemi olabilir.
                        // newHour.is_closed = false;
                    }
                    return newHour;
                }
                return opHour;
            });
            setOperatingHours(updatedHours);
        }
    }
    // iOS için timePickerData ve showTimePicker modal butonunda sıfırlanır/kapatılır.
    // Android için burada sıfırlanabilir.
    if (Platform.OS === 'android') {
        setTimePickerData(null);
    }
  };

  const renderEditForm = () => (
    <ScrollView style={styles.editFormContainer} showsVerticalScrollIndicator={false}>
      <Text style={styles.formSectionTitle}>İşletme Bilgileri</Text>
      
      <Text style={styles.formLabel}>İşyeri Adı</Text>
      <Input placeholder="Harika İşyerim" value={businessName} onChangeText={setBusinessName} inputContainerStyle={styles.inputContainer} disabled={saving || uploadingPhoto || publishing} />
      
      <Text style={styles.formLabel}>Şehir</Text>
      <TouchableOpacity onPress={() => setIsCityModalVisible(true)} style={styles.cityPickerButton} disabled={saving || uploadingPhoto || publishing}>
        <Text style={selectedCityId ? styles.cityPickerButtonText : styles.cityPickerButtonPlaceholder}> 
          {selectedCityId ? (cities.find(c => c.id === selectedCityId)?.name || "Şehir Bulunamadı") : "Şehir Seçiniz"}
        </Text>
        <Icon name="chevron-down" type="material-community" color="#555" />
      </TouchableOpacity>

      <Text style={styles.formLabel}>Açıklama / Özellikler</Text>
      <Input placeholder="İşyerinizin sunduğu hizmetler, ürünler vb." value={description} onChangeText={setDescription} multiline numberOfLines={4} inputContainerStyle={[styles.inputContainer, styles.multilineInputContainer]} disabled={saving || uploadingPhoto || publishing} />
      
      <Text style={styles.formLabel}>Adres</Text>
      <Input placeholder="Tam adresiniz" value={address} onChangeText={setAddress} inputContainerStyle={styles.inputContainer} disabled={saving || uploadingPhoto || publishing} />
      
      <Text style={styles.formSectionTitle}>Hizmet Türleri</Text> 
      {loadingServiceTypes ? (
        <ActivityIndicator style={{ marginVertical: 10 }} />
      ) : serviceTypes.length === 0 ? (
        <Text style={{textAlign: 'center', marginVertical: 10, color: '#6c757d' }}>Seçilebilecek hizmet türü bulunamadı.</Text> 
      ) : (
        <View style={styles.serviceTypesContainerEditor}>
          {serviceTypes.map(service => (
            <CheckBox
              key={service.id}
              title={service.name}
              onPress={() => handleServiceTypeToggle(service.id)}
              containerStyle={styles.checkboxContainerEditor}
              textStyle={styles.checkboxTextEditor}
              checked={selectedServiceTypeIds.includes(service.id)}
              checkedColor="#007AFF" 
              disabled={saving || uploadingPhoto || publishing}
            />
          ))}
        </View>
      )}

      <Text style={styles.formSectionTitle}>Konum Seçimi</Text>
      <TouchableOpacity onPress={() => {
        setInitialModalLatitude(latitude); // Modal açılırken mevcut konumu kaydet
        setInitialModalLongitude(longitude); // Modal açılırken mevcut konumu kaydet
        setFullScreenMapVisible(true);
      }} activeOpacity={0.8}>
        <View style={styles.mapContainerSmall}>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_DEFAULT}
            scrollEnabled={false} 
            zoomEnabled={false} 
            pitchEnabled={false}
            rotateEnabled={false}
            initialRegion={{
              latitude: latitude || 41.0082, 
              longitude: longitude || 28.9784,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            }}
            region={latitude && longitude ? { 
              latitude: latitude,
              longitude: longitude,
              latitudeDelta: 0.01, 
              longitudeDelta: 0.01,
            } : undefined}
          >
            {latitude && longitude && (
              <Marker coordinate={{ latitude, longitude }} />
            )}
          </MapView>
          <View style={styles.mapOverlayButton}>
            <Icon name="search-outline" type="ionicon" color="#fff" size={20}/>
            <Text style={styles.mapOverlayText}>Konumu Görüntüle/Düzenle</Text>
          </View>
          <Text style={styles.mapHelperText}>Konumu ayarlamak için haritaya dokunun.</Text>
        </View>
      </TouchableOpacity>

      <Modal
        visible={fullScreenMapVisible}
        animationType="slide"
        onRequestClose={() => setFullScreenMapVisible(false)}
      >
        <View style={styles.fullScreenMapContainer}>
          <MapView
            ref={fullScreenMapRef} 
            style={styles.mapModalContent}
            provider={PROVIDER_DEFAULT}
            initialRegion={{
              latitude: latitude || 41.0082,
              longitude: longitude || 28.9784,
              latitudeDelta: latitude ? 0.01 : 0.0922, 
              longitudeDelta: longitude ? 0.01 : 0.0421,
            }}
            showsUserLocation 
            onPress={handleMapInteraction} 
          >
            {latitude && longitude && (
              <Marker
                coordinate={{ latitude, longitude }}
                title="İşletme Konumu"
                description="Konumu ayarlamak için haritaya dokunun veya sürükleyin"
                draggable 
                onDragEnd={handleMapInteraction} 
              />
            )}
          </MapView>
          
          <TouchableOpacity 
            style={styles.mapModalCloseButton}
            onPress={() => setFullScreenMapVisible(false)}
          >
            <Icon name="close" type="ionicon" color="#333" size={30} />
          </TouchableOpacity>

          <View style={styles.mapModalButtonsContainer}>
            {latitude !== null && longitude !== null && (latitude !== initialModalLatitude || longitude !== initialModalLongitude) && (
              <Button
                title="Bu Konumu Kullan"
                onPress={() => {
                  // Enlem ve boylam zaten handleMapInteraction ile state'e set edildi.
                  // Sadece modalı kapatıyoruz.
                  setFullScreenMapVisible(false);
                }}
                buttonStyle={[styles.mapModalButton, styles.mapModalConfirmButton]}
                titleStyle={styles.mapModalButtonText}
              />
            )}
          </View>
        </View>
      </Modal>

      <Text style={styles.formSectionTitle}>İşyeri Fotoğrafları</Text>
      <View style={styles.photosContainerEditor}>
        <ScrollView horizontal style={styles.photoScrollView} showsHorizontalScrollIndicator={false}>
          {photos.map((url, index) => (
            <View key={url} style={styles.photoThumbnailContainerEditor}>
              <Image source={{ uri: url }} style={styles.photoThumbnailEditor} />
              <TouchableOpacity 
                style={styles.deletePhotoButtonEditor} 
                onPress={() => handleDeletePhoto(index)} 
                disabled={saving || uploadingPhoto || publishing}
              >
                <Icon name="close-circle" type="ionicon" color="#fff" size={24} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity 
            style={styles.addPhotoButtonEditor} 
            onPress={handlePickAndUploadImage} 
            disabled={saving || uploadingPhoto || publishing}
          >
            {uploadingPhoto ? (<ActivityIndicator color="#007bff" />) : (<Icon name="add-a-photo" type="material" color="#007bff" size={36} />)}
          </TouchableOpacity>
        </ScrollView>
      </View>

      <Text style={styles.sectionTitle}>Çalışma Saatleri Yönetimi</Text>
      
      <View style={styles.batchUpdateContainer}>
        <Text style={styles.batchSectionTitle}>1. Günleri Seçin:</Text>
        <View style={styles.daysSelectionContainer}>
          {daysOfWeek.map((dayName, index) => {
            // Pazar index 0, Cumartesi 6. Bizim daysOfWeek dizimiz de bu sırada.
            const dayKey = index; // operatingHours'daki day_of_week ile eşleşir
            const isSelectedForBatch = selectedDaysForBatchUpdate.includes(dayKey);
            return (
              <TouchableOpacity
                key={dayKey}
                style={[
                  styles.dayChip,
                  isSelectedForBatch && styles.dayChipSelected,
                ]}
                onPress={() => toggleDayForBatchUpdate(dayKey)}
              >
                <Text style={[styles.dayChipText, isSelectedForBatch && styles.dayChipTextSelected]}>
                  {dayName.substring(0,3)} {/* Pzt, Sal ... */}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.batchSectionTitle}>2. Saat Aralığını Belirleyin (Seçili Günler İçin):</Text>
        <View style={styles.batchTimeContainer}>
          <TouchableOpacity onPress={() => openTimePickerRevised('batch_open')} style={styles.timeButtonLarge}>
            <Icon name="time-outline" type="ionicon" color="#0066CC" size={18} style={{marginRight: 5}}/>
            <Text style={styles.timeButtonTextLarge}>{batchOpenTime || 'Açılış Saati'}</Text>
          </TouchableOpacity>
          <Text style={styles.timeSeparatorLarge}>-</Text>
          <TouchableOpacity onPress={() => openTimePickerRevised('batch_close')} style={styles.timeButtonLarge}>
             <Icon name="time-outline" type="ionicon" color="#0066CC" size={18} style={{marginRight: 5}}/>
            <Text style={styles.timeButtonTextLarge}>{batchCloseTime || 'Kapanış Saati'}</Text>
          </TouchableOpacity>
        </View>
        <Button
          title="Seçili Günlere Uygula"
          onPress={applyBatchTimeToSelectedDays}
          disabled={selectedDaysForBatchUpdate.length === 0 || !batchOpenTime || !batchCloseTime}
          buttonStyle={styles.applyBatchButton}
          titleStyle={styles.applyBatchButtonText}
          icon={<Icon name="checkmark-done-outline" type="ionicon" color="white" size={20} style={{marginRight: 8}}/>}
        />
      </View>
      
      <Text style={styles.sectionTitle}>Gün Bazında Çalışma Durumu</Text>
      {loadingOperatingHours ? (
        <ActivityIndicator size="small" color="#0066CC" style={{ marginVertical: 20 }}/>
      ) : (
        operatingHours.map((hourSetting) => ( // hourSetting.day_of_week 0-6 arası olmalı
          <View key={hourSetting.day_of_week} style={styles.dayDetailContainer}>
            <Text style={styles.dayDetailLabel}>{daysOfWeek[hourSetting.day_of_week]}</Text>
            <View style={styles.dayDetailContent}>
              <CheckBox
                title={hourSetting.is_closed ? 'Kapalı' : 'Açık'}
                checked={!hourSetting.is_closed}
                onPress={() => toggleSingleDayClosed(hourSetting.day_of_week)}
                containerStyle={styles.dayDetailCheckboxContainer}
                textStyle={[styles.dayDetailCheckboxText, !hourSetting.is_closed && styles.textBold]}
                iconType="material-community"
                checkedIcon="checkbox-marked"
                uncheckedIcon="checkbox-blank-outline"
                checkedColor="#007AFF"
              />
              {!hourSetting.is_closed && (
                <View style={styles.dayDetailTimeSlots}>
                  <TouchableOpacity onPress={() => openTimePickerRevised(`single_open_${hourSetting.day_of_week}`)} style={styles.timeButtonSmall}>
                    <Text style={styles.timeButtonTextSmall}>{hourSetting.open_time || 'Açılış'}</Text>
                  </TouchableOpacity>
                  <Text style={styles.timeSeparatorSmall}>-</Text>
                  <TouchableOpacity onPress={() => openTimePickerRevised(`single_close_${hourSetting.day_of_week}`)} style={styles.timeButtonSmall}>
                    <Text style={styles.timeButtonTextSmall}>{hourSetting.close_time || 'Kapanış'}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        ))
      )}

      {/* DateTimePicker Modalı (Platforma özgü gösterim) */}
      {showTimePicker && (
        Platform.OS === 'ios' ? (
          <Modal
            transparent={true}
            animationType="slide"
            visible={showTimePicker}
            onRequestClose={() => {
                setShowTimePicker(false);
                setTimePickerData(null);
            }}
          >
            <View style={styles.modalCenteredView}>
              <View style={styles.modalViewIOS}>
                <Text style={styles.modalTitle}>Saat Seçin</Text>
                <DateTimePicker
                    value={selectedPickerTime} // selectedPickerTime her zaman bir Date objesi
                    mode="time"
                    display="spinner"
                    onChange={(event, date) => { // event: DateTimePickerEvent, date?: Date
                        // iOS'ta onChange anlık güncellemeler için, Tamam butonu onTimeConfirmRevised'i çağıracak.
                        if (date) setSelectedPickerTime(date); // Modal içindeki picker'ı güncelle
                    }}
                />
                <View style={styles.modalButtonContainerIOS}>
                    <Button title="Vazgeç" onPress={() => { setShowTimePicker(false); setTimePickerData(null); }} buttonStyle={[styles.modalButtonIOS, styles.modalCancelButtonIOS]} titleStyle={styles.modalButtonTextIOS}/>
                    <Button title="Tamam" onPress={() => { onTimeConfirmRevised({type: 'set'} as DateTimePickerEvent, selectedPickerTime); setShowTimePicker(false); setTimePickerData(null);}} buttonStyle={[styles.modalButtonIOS, styles.modalConfirmButtonIOS]} titleStyle={styles.modalButtonTextIOS}/>
                </View>
              </View>
            </View>
          </Modal>
        ) : ( // Android
          <DateTimePicker
              value={selectedPickerTime}
              mode="time"
              display="default"
              onChange={(event, date) => onTimeConfirmRevised(event as DateTimePickerEvent, date)} // Direkt onTimeConfirmRevised'i çağır
          />
        )
      )}

      <Button title={saving || uploadingPhoto ? 'Kaydediliyor...' : 'Bilgileri Kaydet'} onPress={handleSaveBusinessDetails} disabled={saving || loading || uploadingPhoto || publishing} buttonStyle={[styles.actionButton, styles.saveButton]} titleStyle={styles.actionButtonTitle} containerStyle={styles.buttonContainer} />
      {hasBusiness && (<Button title="Vazgeç" onPress={() => { setIsEditing(false); fetchOwnerIdAndInitialData(); }} type="outline" buttonStyle={[styles.actionButton, styles.cancelButton]} titleStyle={[styles.actionButtonTitle, styles.cancelButtonTitle]} containerStyle={styles.buttonContainer} disabled={publishing} />)}
    </ScrollView>
  );

  const renderPreview = () => {
    if (loading) {
      return (
        <View style={styles.centeredLoader}> 
          <ActivityIndicator size="large" color="#0066CC" />
          <Text style={styles.loadingText}>İşletme Bilgileri Yükleniyor...</Text>
        </View>
      );
    }

    if (!hasBusiness && !isEditing) {
      return (
        <View style={styles.centeredMessageContainer}>
          <Icon name="store-plus-outline" type="material-community" size={60} color="#4A90E2" />
          <Text style={styles.centeredMessageText}>
            Harika bir iş kurmaya ne dersin? Hadi, ilk işletmeni ekleyerek başla!
          </Text>
          <Button 
            title="İşletme Ekle" 
            onPress={() => setIsEditing(true)} 
            icon={<Icon name="plus-circle" type="material-community" color="white" />} 
            buttonStyle={styles.actionButton}
            titleStyle={styles.actionButtonTitle}
            containerStyle={{ marginTop: 20 }}
          />
        </View>
      );
    }

    // isEditing true ise veya hasBusiness true ise (ve loading bittiyse) renderEditForm çağrılır.
    // Bu mantık ana return içinde daha net yönetilebilir.

    // Yeni Önizleme Tasarımı
    const businessLocation = latitude && longitude ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` : 'Konum Belirtilmemiş';
    const displayName = `${businessName || 'İşletme Adı Belirtilmemiş'}${selectedCityId && cities.find(c => c.id === selectedCityId) ? `, ${cities.find(c => c.id === selectedCityId)?.name}` : ''}`;

    return (
      <Card containerStyle={styles.previewCard}>
        <Text style={styles.previewBusinessName}>{displayName}</Text>
        <Card.Divider style={styles.previewDivider} />

        <View style={styles.previewInfoRow}>
          <Text style={styles.previewLabel}>Durum:</Text>
          <Text style={[styles.previewValue, isPublished ? styles.statusPublished : styles.statusUnpublished]}>
            {isPublished ? 'Yayında' : 'Yayında Değil'}
          </Text>
        </View>

        <View style={styles.previewInfoRow}>
          <Text style={styles.previewLabel}>Açıklama:</Text>
          <Text style={styles.previewValue} numberOfLines={3}>{description || '-'}</Text>
        </View>

        <View style={styles.previewInfoRow}>
          <Text style={styles.previewLabel}>Adres:</Text>
          <Text style={styles.previewValue} numberOfLines={2}>{address || '-'}</Text>
        </View>

        <View style={styles.previewInfoRow}>
          <Text style={styles.previewLabel}>Konum:</Text>
          <Text style={styles.previewValue}>{businessLocation}</Text>
        </View>
        
        {photos && photos.length > 0 && (
          <View style={styles.photoSectionContainer}>
            <Text style={styles.previewLabel}>Fotoğraflar:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScrollView}>
              {photos.map((photoUrl, index) => (
                <Image key={index} source={{ uri: photoUrl }} style={styles.previewPhotoItem} />
              ))}
            </ScrollView>
          </View>
        )}

        <Button
          title={isPublished ? 'Yayından Kaldır' : 'Yayınla'}
          onPress={handleTogglePublish}
          loading={publishing}
          buttonStyle={[styles.actionButton, isPublished ? styles.unpublishButton : styles.publishButton]}
          icon={<Icon name={isPublished ? "eye-off-outline" : "eye-outline"} type="ionicon" color="white" size={20} style={{marginRight: 8}}/>}
          titleStyle={styles.actionButtonTitle}
          containerStyle={styles.actionButtonContainer}
        />
        <Button
          title="İşyeri Bilgilerini Düzenle"
          onPress={() => setIsEditing(true)}
          buttonStyle={[styles.actionButton, styles.editInfoButton]}
          icon={<Icon name="pencil-outline" type="ionicon" color="white" size={20} style={{marginRight: 8}}/>}
          titleStyle={styles.actionButtonTitle}
          containerStyle={styles.actionButtonContainer}
        />
        <Button
          title="Müsaitlik Takvimi"
          onPress={() => navigation.navigate('BusinessAvailability' as never)}
          buttonStyle={[styles.actionButton, styles.calendarButton]}
          icon={<Icon name="calendar-outline" type="ionicon" color="white" size={20} style={{marginRight: 8}}/>}
          titleStyle={styles.actionButtonTitle}
          containerStyle={styles.actionButtonContainer}
        />
      </Card>
    );
  };

  if (loading) {
    return (<View style={styles.centeredLoader}><ActivityIndicator size="large" /><Text>Yükleniyor...</Text></View>);
  }
  if (!ownerId && !loading) {
    return (<View style={styles.centeredLoader}><Text>Kullanıcı oturumu bulunamadı.</Text></View>);
  }

  return (
    <SafeAreaView style={styles.safeAreaContainer}>
      <StatusBar barStyle={Platform.OS === 'ios' ? 'dark-content' : 'default'} backgroundColor={styles.safeAreaContainer.backgroundColor} />
      <ScrollView style={styles.scrollViewStyle} contentContainerStyle={styles.scrollContentContainer}>
        {isEditing ? renderEditForm() : renderPreview()}
        {renderCityPickerModal()} 
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeAreaContainer: { 
    flex: 1,
    backgroundColor: '#E0F7FA', 
  },
  scrollViewStyle: { 
    flex: 1, 
  },
  scrollContentContainer: {
    flexGrow: 1, 
    padding: 15, 
  },
  centeredLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
  },
  centeredMessageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  centeredMessageText: {
    fontSize: 18,
    color: '#4A5568',
    textAlign: 'center',
    marginTop: 15,
    lineHeight: 26,
  },
  previewCard: {
    borderRadius: 15,
    padding: 20,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 0, 
    elevation: 4,
    shadowColor: '#B0C4DE',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  previewBusinessName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 10,
    textAlign: 'center',
  },
  previewDivider: {
    marginBottom: 15,
  },
  previewInfoRow: {
    marginBottom: 12,
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#546E7A',
    marginBottom: 4,
  },
  previewValue: {
    fontSize: 16,
    color: '#37474F',
    lineHeight: 22,
  },
  statusPublished: {
    color: '#4CAF50', 
    fontWeight: 'bold',
  },
  statusUnpublished: {
    color: '#F44336', 
    fontWeight: 'bold',
  },
  photoSectionContainer: {
    marginTop: 10,
    marginBottom: 15,
  },
  photoScrollView: {
    marginTop: 8,
  },
  previewPhotoItem: {
    width: 100,
    height: 100,
    borderRadius: 10,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  actionButtonContainer: {
    marginTop: 10,
    width: '100%',
  },
  actionButton: {
    borderRadius: 10,
    paddingVertical: 12,
  },
  actionButtonTitle: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  unpublishButton: {
    backgroundColor: '#E53935', 
  },
  publishButton: {
    backgroundColor: '#43A047', 
  },
  editInfoButton: {
    backgroundColor: '#1E88E5', 
  },
  calendarButton: {
    backgroundColor: '#FF9800', 
  },
  editFormContainer: {
    flex: 1,
    paddingHorizontal: 5, 
    backgroundColor: '#FFFFFF', 
    borderRadius: 15,
  },
  formSectionTitle: { 
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginTop: 20, 
    marginBottom: 15,
    paddingBottom: 8, 
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  formLabel: { 
    fontSize: 15, 
    fontWeight: '500', 
    color: '#4A5568', 
    marginBottom: 8, 
    marginLeft: 5, 
  },
  inputContainer: { 
    backgroundColor: '#F7F9FC', 
    borderRadius: 10, 
    borderWidth: 1, 
    borderColor: '#DDE3EC', 
    paddingHorizontal: 15, 
    paddingVertical: Platform.OS === 'ios' ? 12 : 8, 
    marginBottom: 18, 
    height: Platform.OS === 'ios' ? 48 : 'auto', 
  },
  multilineInputContainer: {
    height: 100, 
    paddingVertical: 12, 
    textAlignVertical: 'top', 
  },
  mapContainerSmall: {
    height: 200,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  map: { flex: 1 },
  mapOverlayButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 8,
    borderRadius: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapOverlayText: { 
    color: '#fff',
    marginLeft: 5,
    fontSize: 12,
  },
  mapHelperText: { 
    position: 'absolute',
    bottom: 5,
    left: 5,
    right: 5,
    textAlign: 'center',
    fontSize: 12,
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 3,
    borderRadius: 4,
    zIndex: 1,
  },
  fullScreenMapContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapModalContent: {
    width: Dimensions.get('window').width * 0.95,
    height: Dimensions.get('window').height * 0.85,
    backgroundColor: 'white',
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  mapModalCloseButton: {
    position: 'absolute',
    top: 85,
    right: 25,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    padding: 8,
  },
  photosContainerEditor: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 15 },
  photoThumbnailContainerEditor: { marginRight: 10, marginBottom: 10, position: 'relative' },
  photoThumbnailEditor: { width: 80, height: 80, borderRadius: 6, backgroundColor: '#e0e0e0' },
  deletePhotoButtonEditor: { position: 'absolute', top: -5, right: -5, backgroundColor: 'rgba(220,53,69,0.9)', borderRadius: 12, padding:3, zIndex:1 },
  addPhotoButtonEditor: {
    width: 80, 
    height: 80, 
    borderRadius: 6, 
    backgroundColor: '#e9ecef', 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ced4da',
    marginRight: 10, 
    marginBottom: 10,
  },
  serviceTypesContainerEditor: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    marginBottom: 20, 
    padding: 15, 
    backgroundColor:'#F7F9FC', 
    borderRadius:10,
    borderWidth: 1,
    borderColor: '#DDE3EC',
  },
  checkboxContainerEditor: { 
    backgroundColor: 'transparent', 
    borderWidth: 0, 
    marginLeft: 0, 
    marginRight: 0, 
    padding: 6, 
    width: '50%', 
  },
  checkboxTextEditor: { 
    fontWeight: 'normal', 
    marginLeft: 8, 
    fontSize: 14, 
    color: '#34495E',
  },
  cityPickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15, 
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    borderWidth: 1,
    borderColor: '#DDE3EC', 
    borderRadius: 10, 
    backgroundColor: '#F7F9FC', 
    marginBottom: 18, 
    height: 48, // Hem iOS hem de Android için sabit yükseklik
  },
  cityPickerButtonText: { 
    fontSize: 16, 
    color: '#333',
  },
  cityPickerButtonPlaceholder: {
    fontSize: 16, 
    color: '#888', 
  },
  cityModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cityModalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    maxHeight: '70%',
  },
  cityModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  cityScrollView: {
    maxHeight: Dimensions.get('window').height * 0.4,
  },
  cityOptionButton: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  cityOptionText: {
    fontSize: 17,
    color: '#333',
  },
  cityOptionTextSelected: {
    fontWeight: 'bold',
    color: '#0066CC',
  },
  modalCloseButton: {
    marginTop: 15,
    paddingVertical: 10,
    backgroundColor: '#0066CC',
    borderRadius: 8,
  },
  modalCloseButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveButton: { backgroundColor: '#28a745', borderRadius: 10, paddingVertical: 14 }, 
  cancelButton: { 
    borderColor: '#757575', 
    backgroundColor: '#F0F0F0', 
    borderRadius: 10, 
    paddingVertical: 14, 
    borderWidth: 1 
  },
  cancelButtonTitle: { 
    color: '#333333', 
    fontWeight: '600', 
  },
  buttonContainer: { marginTop: 12, marginBottom: 8 }, 
  mapModalButtonsContainer: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  mapModalButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 150, // Butonların benzer genişlikte olması için
  },
  mapModalConfirmButton: {
    backgroundColor: '#4CAF50', // Yeşil tonu
  },
  mapModalCancelButton: {
    backgroundColor: '#f44336', // Kırmızı tonu
  },
  mapModalButtonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 5,
  },
  dayContainer: {
    marginBottom: 10,
    paddingVertical: 10,
    paddingHorizontal: 5,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  dayLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 8,
  },
  daySettingsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeSlotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#e7f0ff',
    borderRadius: 6,
    marginHorizontal: 5,
  },
  timeButtonText: {
    color: '#0066CC',
    fontWeight: '500',
  },
  timeSeparator: {
    fontSize: 16,
    marginHorizontal: 2,
    color: '#777',
  },
  // iOS DateTimePicker Modal Styles
  modalCenteredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalViewIOS: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  modalButtonContainerIOS: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    width: '100%',
  },
  modalButtonIOS: {
    paddingHorizontal: 20,
    minWidth: 100,
  },
  modalButtonTextIOS: {
    fontSize: 16,
  },
  batchUpdateContainer: {
    marginBottom: 25,
    padding: 15,
    backgroundColor: '#F8F9FA', // Biraz daha açık bir arka plan
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  batchSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#343A40',
    marginBottom: 10,
  },
  daysSelectionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around', // Veya 'flex-start'
    marginBottom: 15,
  },
  dayChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#E9ECEF',
    borderRadius: 20,
    margin: 4,
    borderWidth: 1,
    borderColor: '#DEE2E6',
  },
  dayChipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#0056b3',
  },
  dayChipText: {
    color: '#495057',
    fontWeight: '500',
    fontSize: 13,
  },
  dayChipTextSelected: {
    color: 'white',
  },
  batchTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  timeButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CED4DA',
    minWidth: 140, // Butonların eşit genişlikte görünmesi için
    justifyContent: 'center',
  },
  timeButtonTextLarge: {
    color: '#0066CC',
    fontWeight: '500',
    fontSize: 15,
  },
  timeSeparatorLarge: {
    fontSize: 18,
    color: '#6C757D',
    marginHorizontal: 5,
  },
  applyBatchButton: {
    backgroundColor: '#28A745', // Yeşil
    borderRadius: 8,
    paddingVertical: 12,
  },
  applyBatchButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  dayDetailContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    backgroundColor: '#FFFFFF', // Her satır için temiz bir arka plan
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 1.5,
    elevation: 1,
  },
  dayDetailLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#343A40',
    flex: 0.3, // Gün isminin kaplayacağı alan
  },
  dayDetailContent: {
    flex: 0.7, // Ayarların kaplayacağı alan
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end', // Ayarları sağa yasla
  },
  dayDetailCheckboxContainer: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
    margin: 0,
    marginRight: 10, // Checkbox ve saatler arası boşluk
  },
  dayDetailCheckboxText: {
    fontWeight: 'normal',
    fontSize: 15,
    color: '#495057',
  },
  textBold: {
    fontWeight: 'bold',
  },
  dayDetailTimeSlots: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeButtonSmall: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#E7F0FF',
    borderRadius: 6,
    marginHorizontal: 3,
  },
  timeButtonTextSmall: {
    color: '#0056b3',
    fontSize: 14,
  },
  timeSeparatorSmall: {
    fontSize: 14,
    color: '#6C757D',
  },
  modalCancelButtonIOS: {
    backgroundColor: '#FF3B30', // Kırmızı
  },
  modalConfirmButtonIOS: {
      backgroundColor: '#007AFF', // Mavi
  },
});

export default MyBusinessScreen;
