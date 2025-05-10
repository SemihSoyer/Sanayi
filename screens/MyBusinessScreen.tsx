import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert, ActivityIndicator, Image, TouchableOpacity, Platform } from 'react-native'; // SafeAreaView ve GestureHandlerRootView kaldırıldı
import { Text, Input, Button, Icon, Card } from '@rneui/themed';
import { supabase } from '../lib/supabase';
// DraggableFlatList importları kaldırıldı
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

// BusinessDetails arayüzünden id çıkarıldı, owner_id PK olacak.
interface BusinessDetails {
  owner_id: string;
  name: string;
  description: string;
  address: string;
  photos: string[];
  is_published: boolean; // Yeni eklendi
}

const MyBusinessScreen = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  
  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(false); // Yeni eklendi
  const [publishing, setPublishing] = useState(false); // Yeni eklendi

  const [hasBusiness, setHasBusiness] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const fetchOwnerIdAndInitialData = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const currentOwnerId = session.user.id;
      setOwnerId(currentOwnerId);
      
      try {
        // owner_id PK olduğu için, select'te id'ye gerek yok.
        const { data, error } = await supabase
          .from('businesses')
          .select('name, description, address, photos, is_published') // is_published eklendi
          .eq('owner_id', currentOwnerId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setBusinessName(data.name || '');
          setDescription(data.description || '');
          setAddress(data.address || '');
          setPhotos(Array.isArray(data.photos) ? data.photos : []);
          setIsPublished(data.is_published || false); // is_published state'i ayarlandı
          setHasBusiness(true);
          setIsEditing(false);
        } else {
          setHasBusiness(false);
          setIsEditing(false);
          setBusinessName('');
          setDescription('');
          setAddress('');
          setPhotos([]);
          setIsPublished(false); // İşyeri yoksa yayınlanmamış kabul et
        }
      } catch (error) {
        if (error instanceof Error) Alert.alert('Hata', 'İşyeri bilgileri çekilirken bir sorun oluştu: ' + error.message);
        setHasBusiness(false);
        setIsEditing(false);
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false); 
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
      // upsertData'dan id çıkarıldı, owner_id PK olarak kullanılacak.
      const upsertData: BusinessDetails = { 
        owner_id: ownerId,
        name: businessName,
        description: description,
        address: address,
        photos: photos,
        is_published: isPublished, // is_published eklendi
      };

      console.log('Attempting to save business details. Upsert data:', JSON.stringify(upsertData, null, 2));

      const { error, data: savedData } = await supabase
        .from('businesses')
        .upsert(upsertData) // onConflict belirtmeye gerek yok, PK (owner_id) üzerinden çalışır
        .select()
        .single(); 
      
      console.log('Supabase upsert response - error:', JSON.stringify(error, null, 2));
      console.log('Supabase upsert response - savedData:', JSON.stringify(savedData, null, 2));

      if (error) throw error;

      Alert.alert('Başarılı', 'İşyeri bilgileri kaydedildi!');
      if (savedData) { 
        // owner_id zaten state'de var ve PK. Diğer alanları savedData'dan güncelleyebiliriz.
        setBusinessName(savedData.name || '');
        setDescription(savedData.description || '');
        setAddress(savedData.address || '');
        setPhotos(Array.isArray(savedData.photos) ? savedData.photos : []);
        setIsPublished(savedData.is_published || false); // is_published state'i güncellendi
        setHasBusiness(true);
      }
      setIsEditing(false);
    } catch (error) {
      if (error instanceof Error) Alert.alert('Kaydetme Hatası', error.message);
      else Alert.alert('Kaydetme Hatası', 'Bilinmeyen bir hata oluştu.');
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

  const renderEditForm = () => (
    <View>
      <Input label="İşyeri Adı" placeholder="Harika İşyerim" value={businessName} onChangeText={setBusinessName} inputContainerStyle={styles.inputContainer} disabled={saving || uploadingPhoto || publishing} />
      <Input label="Açıklama / Özellikler" placeholder="İşyerinizin sunduğu hizmetler, ürünler vb." value={description} onChangeText={setDescription} multiline numberOfLines={4} inputContainerStyle={styles.inputContainer} disabled={saving || uploadingPhoto || publishing} />
      <Input label="Adres" placeholder="Tam adresiniz" value={address} onChangeText={setAddress} inputContainerStyle={styles.inputContainer} disabled={saving || uploadingPhoto || publishing} />
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
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginTop: 15, marginBottom: 10 },
  photosEditorContainer: { // Fotoğraf listesi ve ekleme butonu için genel sarmalayıcı
    marginBottom: 20,
  },
  photosScrollView: { 
    // maxHeight: 130, // Eğer dikey scroll olacaksa veya içerik taşacaksa
  },
  photoItemContainer: { // Her bir fotoğraf ve butonları için container
    marginRight: 10, 
    position: 'relative',
    width: 100, 
    height: 100, 
  },
  photo: { width: '100%', height: '100%', borderRadius: 8, backgroundColor: '#e9ecef' },
  deletePhotoButton: { 
    position: 'absolute', 
    top: -8, // Butonun biraz dışarı taşması için
    right: -8, // Butonun biraz dışarı taşması için
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
    marginLeft: 10, // Önceki fotoğraflardan sonra boşluk
  },
  addPhotoText: { marginTop: 5, fontSize: 12, color: '#007bff', textAlign: 'center' },
  buttonContainer: { marginTop: 10, marginBottom:10 },
  saveButton: { backgroundColor: '#28a745', borderRadius: 8, paddingVertical: 12 },
  publishButton: { borderRadius: 8, paddingVertical: 12 }, // Yeni stil
  cancelButton: { borderColor: '#6c757d', borderRadius: 8, paddingVertical: 10, borderWidth:1 },
  editButton: { backgroundColor: '#007bff', borderRadius: 8, paddingVertical: 12 },
  addButton: { backgroundColor: '#007bff', borderRadius: 8, paddingVertical: 12, minWidth: 200 },
  centeredContent: { alignItems: 'center', justifyContent: 'center', flex: 1, paddingTop: 50 },
  infoText: { fontSize: 16, color: '#6c757d', marginBottom: 20, textAlign: 'center' },
  card: { borderRadius: 10, padding: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 5, elevation: 3 },
  cardTitle: { textAlign: 'center', color: '#333', fontWeight:'bold', fontSize: 20 },
  previewLabel: { fontSize: 14, color: '#555', fontWeight: 'bold', marginTop: 10 },
  previewText: { fontSize: 16, color: '#333', marginBottom: 10, lineHeight: 22 },
  photosScrollViewPreview: { marginTop: 5, marginBottom:15, maxHeight:110 },
  previewPhoto: { width: 90, height: 90, borderRadius: 6, marginRight: 8, backgroundColor: '#e0e0e0' },
});

export default MyBusinessScreen;
