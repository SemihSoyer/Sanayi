import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, Alert, ActivityIndicator, Image, TouchableOpacity, Platform, Dimensions, Modal, SafeAreaView, StatusBar } from 'react-native'; // SafeAreaView ve StatusBar eklendi
import { Text, Input, Button, Icon, Card, CheckBox } from '@rneui/themed'; // CheckBox eklendi
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps'; // PROVIDER_DEFAULT eklendi
import { supabase } from '../lib/supabase';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

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

  const fetchOwnerIdAndInitialData = useCallback(async () => {
    setLoading(true);
    setLoadingServiceTypes(true);
    setLoadingCities(true); // Şehir yüklemesini başlat
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
      }
    } else {
      setLoading(false);
      setLoadingServiceTypes(false);
      setLoadingCities(false); // Şehir yüklemesini de durdur
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
      Alert.alert("Hata", "İşlem için kullanıcı kimliği bulunamadı.");
      return;
    }
    if (!businessName.trim()) {
      Alert.alert("Eksik Bilgi", "İşletme adı boş bırakılamaz.");
      return;
    }
    if (!selectedCityId) { // Şehir seçimi kontrolü
      Alert.alert("Eksik Bilgi", "Lütfen işletmenizin bulunduğu şehri seçin.");
      return;
    }

    setSaving(true);
    // `id` alanı `BusinessDetails` arayüzünden çıkarılmıştı, bu yüzden Partial kullanırken dikkat.
    // Upsert için `id` gerekebilir, ya da insert/update ayrı ele alınmalı.
    // Mevcut upsert mantığı `id`yi `currentBusinessId` üzerinden alıyor.
    const businessDataToSave = {
        owner_id: ownerId,
        name: businessName.trim(),
        description: description.trim(),
        address: address.trim(),
        latitude: latitude,
        longitude: longitude,
        photos: photos,
        is_published: isPublished,
        city_id: selectedCityId, // Seçilen şehir ID'sini ekle
        // Eğer currentBusinessId varsa, upsert bunu güncelleme için kullanacak.
        // Yoksa ve owner_id varsa yeni kayıt oluşturacak (eğer RLS izin veriyorsa ve owner_id için unique constraint yoksa)
        // Genellikle PK olan `id` üzerinden upsert yapılır. Owner_id üzerinden upsert için onConflict owner_id olmalı.
        // Şimdiki upsert, eğer id verilirse onu kullanır, verilmezse insert yapar.
        ...(currentBusinessId && { id: currentBusinessId }), // Var olanı güncellemek için ID ekle
        updated_at: new Date(), // Her kayıtta güncellensin
    };

    try {
      const { error, data: savedData } = await supabase
        .from('businesses')
        .upsert(businessDataToSave, {
            // owner_id üzerinden upsert yapmak istiyorsak ve owner_id unique ise:
            // onConflict: 'owner_id',
            // ignoreDuplicates: false,
            // Genellikle PK (id) üzerinden upsert daha standarttır. 
            // Eğer yeni kayıt ve owner_id zaten varsa çakışma olmaması için PK (id) kullanılmalı.
            // Bu durumda, eğer `currentBusinessId` yoksa bu bir INSERT olmalı.
            // Eğer `currentBusinessId` varsa bu bir UPDATE olmalı.
            // `upsert` bu ayrımı `id`nin varlığına göre yapacaktır.
        })
        .select('id, name, description, address, latitude, longitude, photos, is_published, city_id') // city_id de seçilsin
        .single();

      if (error) {
        console.error('[MyBusinessScreen] Error during upsert:', error);
        throw error;
      }

      if (savedData && savedData.id) {
        const returnedBusinessId = savedData.id;
        setCurrentBusinessId(returnedBusinessId); // Dönen ID'yi state'e kaydet (yeni ekleme durumunda önemli)
        setHasBusiness(true); // İşletme artık var

        // Hizmet türlerini güncelle
        console.log(`[MyBusinessScreen] Updating services for business_id: ${returnedBusinessId}`);
        const { error: deleteError } = await supabase
          .from('BusinessServices')
          .delete()
          .eq('business_id', returnedBusinessId); // businessId -> returnedBusinessId
        
        if (deleteError) {
          console.error('[MyBusinessScreen] Error deleting old services:', deleteError);
          throw deleteError;
        }

        // Sonra yeni seçilen hizmetleri ekle
        if (selectedServiceTypeIds.length > 0) {
          const serviceRecords = selectedServiceTypeIds.map(serviceTypeId => ({
            business_id: returnedBusinessId, // businessId -> returnedBusinessId
            service_type_id: serviceTypeId
          }));
          console.log('[MyBusinessScreen] Inserting new services:', serviceRecords);
          const { error: insertError } = await supabase.from('BusinessServices').insert(serviceRecords);
          if (insertError) throw insertError;
        }
      }

      Alert.alert('Başarılı', 'İşyeri bilgileri ve hizmet türleri kaydedildi!');
      if (savedData) {
        // State'i dönen güncel veriyle ayarla
        setBusinessName(savedData.name || '');
        setDescription(savedData.description || '');
        setAddress(savedData.address || '');
        setSelectedCityId(savedData.city_id || null); // city_id de güncellensin
        setLatitude(savedData.latitude);
        setLongitude(savedData.longitude);
        setPhotos(Array.isArray(savedData.photos) ? savedData.photos : []);
        setIsPublished(savedData.is_published || false);
        // selectedServiceTypeIds zaten güncel olmalı
      }
      setIsEditing(false); // Düzenleme modundan çık
    } catch (error) {
      console.error('[MyBusinessScreen] Error in handleSaveBusinessDetails catch block:', error);
      if (error instanceof Error) Alert.alert('Kaydetme Hatası', error.message);
      else Alert.alert('Kaydetme Hatası', 'İşyeri bilgileri kaydedilirken bilinmeyen bir hata oluştu.');
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
});

export default MyBusinessScreen;
