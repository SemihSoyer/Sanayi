import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, Alert, ActivityIndicator, Image, TouchableOpacity, Platform, Dimensions, Modal } from 'react-native'; // Modal ve useRef eklendi
import { Text, Input, Button, Icon, Card, CheckBox } from '@rneui/themed'; // CheckBox eklendi
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps'; // PROVIDER_DEFAULT eklendi
import { supabase } from '../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

// BusinessDetails arayüzünden id çıkarıldı, owner_id PK olacak.
interface BusinessDetails {
  owner_id: string;
  name: string;
  description: string;
  address: string;
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

const MyBusinessScreen = () => {
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

  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [selectedServiceTypeIds, setSelectedServiceTypeIds] = useState<string[]>([]);
  const [loadingServiceTypes, setLoadingServiceTypes] = useState(false);

  const [hasBusiness, setHasBusiness] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [fullScreenMapVisible, setFullScreenMapVisible] = useState(false); // Tam ekran harita modal durumu
  
  const mapRef = useRef<MapView>(null); // Küçük harita için ref
  const fullScreenMapRef = useRef<MapView>(null); // Tam ekran harita için ref

  const fetchOwnerIdAndInitialData = useCallback(async () => {
    setLoading(true);
    setLoadingServiceTypes(true); // Hizmet türleri yüklemesini başlat
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
      
      try {
        console.log(`[MyBusinessScreen] Fetching business for owner_id: ${currentOwnerId}`);
        const { data, error: fetchError } = await supabase
          .from('businesses')
          .select('name, description, address, latitude, longitude, photos, is_published, id') // İşletme ID'sini de çekiyoruz
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
          setCurrentBusinessId(data.id); // İşletme ID'sini state'e kaydet
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
    if (!ownerId) { Alert.alert('Hata', 'Kullanıcı kimliği bulunamadı.'); return; }
    if (!businessName.trim()) { Alert.alert('Eksik Bilgi', 'İşyeri adı boş bırakılamaz.'); return; }
    setSaving(true);
    try {
      const businessDataToSave: Partial<BusinessDetails> & { owner_id: string } = { // BusinessFullDetails -> BusinessDetails
        owner_id: ownerId, // owner_id her zaman gönderilmeli
        name: businessName,
        description: description,
        address: address,
        latitude: latitude,
        longitude: longitude,
        photos: photos,
        is_published: isPublished,
      };

      // Eğer mevcut bir işletmeyi güncelliyorsak (currentBusinessId varsa), id'yi de ekle
      if (currentBusinessId) {
        (businessDataToSave as any).id = currentBusinessId;
      }

      console.log('[MyBusinessScreen] Attempting to save/upsert business. Data:', JSON.stringify(businessDataToSave, null, 2));

      // `upsert` işlemi, eğer `id` varsa ve eşleşiyorsa UPDATE, yoksa INSERT yapar (owner_id'ye göre değil, PK olan id'ye göre).
      // Yeni kayıt için id Supabase tarafından oluşturulur. Güncelleme için id'yi sağlamalıyız.
      // `onConflict` belirtilmediği için PK (id) üzerinden çakışma kontrolü yapar.
      const { error, data: savedData } = await supabase
        .from('businesses')
        .upsert(businessDataToSave) 
        .select('id, name, description, address, latitude, longitude, photos, is_published')
        .single(); // Başarılı upsert sonrası güncel veriyi tek satır olarak al
      
      console.log('[MyBusinessScreen] Supabase upsert response - error:', JSON.stringify(error, null, 2));
      console.log('[MyBusinessScreen] Supabase upsert response - savedData:', JSON.stringify(savedData, null, 2));

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

  const renderEditForm = () => (
    <View>
      <Input label="İşyeri Adı" placeholder="Harika İşyerim" value={businessName} onChangeText={setBusinessName} inputContainerStyle={styles.inputContainer} disabled={saving || uploadingPhoto || publishing} />
      <Input label="Açıklama / Özellikler" placeholder="İşyerinizin sunduğu hizmetler, ürünler vb." value={description} onChangeText={setDescription} multiline numberOfLines={4} inputContainerStyle={styles.inputContainer} disabled={saving || uploadingPhoto || publishing} />
      <Input label="Adres" placeholder="Tam adresiniz" value={address} onChangeText={setAddress} inputContainerStyle={styles.inputContainer} disabled={saving || uploadingPhoto || publishing} />
      
      <Text style={styles.sectionTitle}>Hizmet Türleri</Text>
      {loadingServiceTypes ? (
        <ActivityIndicator style={{ marginVertical: 10 }} />
      ) : serviceTypes.length === 0 ? (
        <Text style={styles.infoTextSmall}>Seçilebilecek hizmet türü bulunamadı. Lütfen Supabase panelinden 'ServiceTypes' tablosuna veri ekleyin.</Text>
      ) : (
        <View style={styles.serviceTypesContainer}>
          {serviceTypes.map(service => (
            <CheckBox
              key={service.id}
              title={service.name}
              checked={selectedServiceTypeIds.includes(service.id)}
              onPress={() => handleServiceTypeToggle(service.id)}
              containerStyle={styles.checkboxContainer}
              textStyle={styles.checkboxText}
              checkedColor="#007bff"
              disabled={saving || uploadingPhoto || publishing}
            />
          ))}
        </View>
      )}

      <Text style={styles.sectionTitle}>Konum Seçimi</Text>
      <TouchableOpacity onPress={() => setFullScreenMapVisible(true)} activeOpacity={0.8}>
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_DEFAULT}
            scrollEnabled={false} // Küçük haritada kaydırmayı devre dışı bırak
            zoomEnabled={false} // Küçük haritada zoomu devre dışı bırak
            pitchEnabled={false}
            rotateEnabled={false}
            initialRegion={{
              latitude: latitude || 41.0082, // Başlangıç konumu (varsayılan: İstanbul)
              longitude: longitude || 28.9784,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            }}
            region={latitude && longitude ? { // Eğer koordinat varsa haritayı oraya odakla
              latitude: latitude,
              longitude: longitude,
              latitudeDelta: 0.01, // Daha yakın zoom
              longitudeDelta: 0.01,
            } : undefined}
            // onPress={handleMapInteraction} // Küçük haritaya tıklayınca modal açılacak
          >
            {latitude && longitude && (
              <Marker
                coordinate={{ latitude, longitude }}
                // draggable={false} // Sürükleme tam ekranda olacak
              />
            )}
          </MapView>
          <View style={styles.mapOverlay}>
            <Icon name="search-outline" type="ionicon" color="#fff" size={20}/>
            <Text style={styles.mapOverlayText}>Konumu Görüntüle/Düzenle</Text>
          </View>
          <Text style={styles.mapHelperText}>Konumu ayarlamak için haritaya dokunun.</Text>
        </View>
      </TouchableOpacity>

      {/* Tam Ekran Harita Modalı */}
      <Modal
        visible={fullScreenMapVisible}
        animationType="slide"
        onRequestClose={() => setFullScreenMapVisible(false)}
      >
        <View style={styles.fullscreenMapContainer}>
          <MapView
            ref={fullScreenMapRef} // Tam ekran harita için ayrı ref
            style={styles.fullscreenMap}
            provider={PROVIDER_DEFAULT}
            initialRegion={{
              latitude: latitude || 41.0082,
              longitude: longitude || 28.9784,
              latitudeDelta: latitude ? 0.01 : 0.0922, // Konum varsa yakın zoom, yoksa genel
              longitudeDelta: longitude ? 0.01 : 0.0421,
            }}
            showsUserLocation // Kullanıcının yerini göster (isteğe bağlı)
            onPress={handleMapInteraction} // Haritaya basınca konumu güncelle
          >
            {latitude && longitude && (
              <Marker
                coordinate={{ latitude, longitude }}
                title="İşletme Konumu"
                description="Konumu ayarlamak için haritaya dokunun veya sürükleyin"
                draggable // Sürüklenebilir marker
                onDragEnd={handleMapInteraction} // Sürükleme bitince konumu güncelle
              />
            )}
          </MapView>
          
          {/* Zoom Kontrolleri */}
          <View style={styles.zoomControls}>
            <TouchableOpacity style={styles.zoomButton} onPress={zoomIn}>
              <Icon name="add" type="material" color="#333" size={24} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.zoomButton, { borderBottomWidth: 0 }]} onPress={zoomOut}>
              <Icon name="remove" type="material" color="#333" size={24} />
            </TouchableOpacity>
          </View>
          
          {/* Kapatma Butonu */}
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={() => setFullScreenMapVisible(false)}
          >
            <Icon name="close" type="material" color="#333" size={28} />
          </TouchableOpacity>
        </View>
      </Modal>

      <Text style={styles.sectionTitle}>İşyeri Fotoğrafları</Text>
      <View style={styles.photosEditorContainer}>
        <ScrollView horizontal style={styles.photosScrollView} showsHorizontalScrollIndicator={false}>
          {photos.map((url, index) => (
            <View key={url} style={styles.photoItemContainer}>
              <Image source={{ uri: url }} style={styles.photo} />
              <TouchableOpacity 
                style={styles.deletePhotoButton} 
                onPress={() => handleDeletePhoto(index)} 
                disabled={saving || uploadingPhoto || publishing}
              >
                <Icon name="close-circle" type="ionicon" color="#fff" size={24} />
              </TouchableOpacity>
              <View style={styles.moveButtonsContainer}>
                {index > 0 && (
                  <TouchableOpacity 
                    style={styles.moveButton} 
                    onPress={() => movePhoto(index, index - 1)}
                    disabled={saving || uploadingPhoto || publishing}
                  >
                    <Icon name="arrow-up-circle" type="ionicon" color="#fff" size={22} />
                  </TouchableOpacity>
                )}
                {index < photos.length - 1 && (
                  <TouchableOpacity 
                    style={styles.moveButton} 
                    onPress={() => movePhoto(index, index + 1)}
                    disabled={saving || uploadingPhoto || publishing}
                  >
                    <Icon name="arrow-down-circle" type="ionicon" color="#fff" size={22} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
          <TouchableOpacity 
            style={styles.addPhotoCard} 
            onPress={handlePickAndUploadImage} 
            disabled={saving || uploadingPhoto || publishing}
          >
            {uploadingPhoto ? (<ActivityIndicator color="#007bff" />) : (<Icon name="add-a-photo" type="material" color="#007bff" size={36} />)}
            <Text style={styles.addPhotoText}>Fotoğraf Ekle</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <Button title={saving || uploadingPhoto ? 'Kaydediliyor...' : 'Bilgileri Kaydet'} onPress={handleSaveBusinessDetails} disabled={saving || loading || uploadingPhoto || publishing} buttonStyle={styles.saveButton} containerStyle={styles.buttonContainer} />
      {hasBusiness && (<Button title="Vazgeç" onPress={() => { setIsEditing(false); fetchOwnerIdAndInitialData(); }} type="outline" buttonStyle={styles.cancelButton} containerStyle={styles.buttonContainer} disabled={publishing} />)}
    </View>
  );

  const renderPreview = () => (
    <Card containerStyle={styles.card}>
      <Card.Title style={styles.cardTitle}>{businessName || "İşyeri Adı Belirtilmemiş"}</Card.Title>
      <Card.Divider />
      <Text style={styles.previewLabel}>Durum:</Text>
      <Text style={[styles.previewText, { color: isPublished ? 'green' : 'red', fontWeight: 'bold' }]}>
        {isPublished ? 'Yayında' : 'Yayında Değil'}
      </Text>
      <Text style={styles.previewLabel}>Açıklama:</Text>
      <Text style={styles.previewText}>{description || "Açıklama yok."}</Text>
      <Text style={styles.previewLabel}>Adres:</Text>
      <Text style={styles.previewText}>{address || "Adres belirtilmemiş."}</Text>
      <Text style={styles.previewLabel}>Konum:</Text>
      <Text style={styles.previewText}>{latitude && longitude ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` : "Konum belirtilmemiş."}</Text>
      <Text style={styles.previewLabel}>Fotoğraflar:</Text>
      {photos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScrollViewPreview}>
          {photos.map((url, index) => (<Image key={index} source={{ uri: url }} style={styles.previewPhoto} />))}
        </ScrollView>
      ) : (<Text style={styles.previewText}>Henüz fotoğraf eklenmemiş.</Text>)}
      
      <Button 
        title={publishing ? 'İşleniyor...' : (isPublished ? 'Yayından Kaldır' : 'Yayınla')} 
        onPress={handleTogglePublish} 
        disabled={publishing || loading}
        buttonStyle={[styles.publishButton, { backgroundColor: isPublished ? '#dc3545' : '#28a745' }]} 
        containerStyle={styles.buttonContainer} 
        icon={{ name: isPublished ? 'eye-off-outline' : 'eye-outline', type: 'ionicon', color: 'white' }}
      />
      <Button 
        title="İşyeri Bilgilerini Düzenle" 
        onPress={() => setIsEditing(true)} 
        icon={{ name: 'edit', type: 'material', color: 'white' }} 
        buttonStyle={styles.editButton} 
        containerStyle={styles.buttonContainer} 
        disabled={publishing || loading}
      />
    </Card>
  );

  if (loading) {
    return (<View style={styles.loadingContainer}><ActivityIndicator size="large" /><Text>Yükleniyor...</Text></View>);
  }
  if (!ownerId && !loading) {
    return (<View style={styles.loadingContainer}><Text>Kullanıcı oturumu bulunamadı.</Text></View>);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text h3 style={styles.header}>İşyerim</Text>
      {isEditing ? renderEditForm() : (hasBusiness ? renderPreview() : (
        <View style={styles.centeredContent}>
          <Text style={styles.infoText}>Henüz bir işyeri kaydınız bulunmuyor.</Text>
          <Button title="Yeni İşyeri Ekle" onPress={() => { setIsEditing(true); setHasBusiness(false); /* businessId'ye gerek yok */ setBusinessName(''); setDescription(''); setAddress(''); setPhotos([]); }} icon={{ name: 'add-circle', type: 'ionicon', color: 'white' }} buttonStyle={styles.addButton} />
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  contentContainer: { padding: 20, paddingBottom: 40 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f2f5' },
  header: { textAlign: 'center', marginBottom: 25, color: '#333', fontWeight: 'bold' },
  inputContainer: { backgroundColor: '#fff', borderRadius: 8, borderWidth:1, borderColor: '#ddd', paddingHorizontal:10, marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginTop: 20, marginBottom: 10 }, 
  mapContainer: {
    height: 180, // Küçük haritanın yüksekliği ayarlandı
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden', 
    position: 'relative', // Overlay için
    backgroundColor: '#e9ecef', // Harita yüklenirken arka plan
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapOverlay: { // Küçük harita üzerine tıklama alanı
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8, // Kenarlarla uyumlu
    flexDirection: 'row', // İkon ve metin yan yana
    padding: 10,
  },
  mapOverlayText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 16,
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
    zIndex: 1, // Overlay'in üzerinde olması için
  },
  fullscreenMapContainer: { // Modal içeriği
    flex: 1,
    position: 'relative', // Butonlar için
  },
  fullscreenMap: {
    ...StyleSheet.absoluteFillObject,
  },
  zoomControls: { // Zoom butonlarının container'ı
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 20, // iOS için alttan boşluk
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    // Gölge efektleri (isteğe bağlı)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  zoomButton: { // Zoom butonları (+/-)
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1, // Butonlar arası çizgi
    borderBottomColor: '#eee',
  },
  closeButton: { // Kapatma butonu (X)
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20, // iOS için yukarıdan boşluk
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 10,
    borderRadius: 20, // Yuvarlak buton
    // Gölge
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  photosEditorContainer: { 
    marginBottom: 20,
  },
  photosScrollView: { 
  },
  photoItemContainer: { 
    marginRight: 10, 
    position: 'relative',
    width: 100, 
    height: 100, 
  },
  photo: { width: '100%', height: '100%', borderRadius: 8, backgroundColor: '#e9ecef' },
  deletePhotoButton: { 
    position: 'absolute', 
    top: -8, 
    right: -8, 
    backgroundColor: 'rgba(220,53,69,0.85)', 
    borderRadius: 15, 
    width: 30, 
    height: 30, 
    justifyContent: 'center', 
    alignItems: 'center', 
    zIndex: 1 
  },
  moveButtonsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingVertical: 2,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  moveButton: {
    paddingHorizontal: 5,
  },
  addPhotoCard: { 
    width: 100, 
    height: 100, 
    borderRadius: 8, 
    backgroundColor: '#f8f9fa', 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 2, 
    borderColor: '#007bff', 
    borderStyle: 'dashed', 
    padding:10,
    marginLeft: 10, 
  },
  addPhotoText: { marginTop: 5, fontSize: 12, color: '#007bff', textAlign: 'center' },
  buttonContainer: { marginTop: 10, marginBottom:10 },
  saveButton: { backgroundColor: '#28a745', borderRadius: 8, paddingVertical: 12 },
  publishButton: { borderRadius: 8, paddingVertical: 12 }, 
  cancelButton: { borderColor: '#6c757d', borderRadius: 8, paddingVertical: 10, borderWidth:1 },
  editButton: { backgroundColor: '#007bff', borderRadius: 8, paddingVertical: 12 },
  addButton: { backgroundColor: '#007bff', borderRadius: 8, paddingVertical: 12, minWidth: 200 },
  centeredContent: { alignItems: 'center', justifyContent: 'center', flex: 1, paddingTop: 50 },
  infoText: { fontSize: 16, color: '#6c757d', marginBottom: 20, textAlign: 'center' },
  infoTextSmall: { fontSize: 14, color: '#6c757d', marginVertical: 10, textAlign: 'center', fontStyle: 'italic' },
  card: { borderRadius: 10, padding: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 5, elevation: 3 },
  cardTitle: { textAlign: 'center', color: '#333', fontWeight:'bold', fontSize: 20 },
  previewLabel: { fontSize: 14, color: '#555', fontWeight: 'bold', marginTop: 10 },
  previewText: { fontSize: 16, color: '#333', marginBottom: 10, lineHeight: 22 },
  photosScrollViewPreview: { marginTop: 5, marginBottom:15, maxHeight:110 },
  previewPhoto: { width: 90, height: 90, borderRadius: 6, marginRight: 8, backgroundColor: '#e0e0e0' },
  serviceTypesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  checkboxContainer: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
    marginLeft: 0,
    marginRight: 15, // Checkboxlar arası boşluk
    marginVertical: 5,
  },
  checkboxText: {
    fontWeight: 'normal',
    marginLeft: 5,
  },
});

export default MyBusinessScreen;
