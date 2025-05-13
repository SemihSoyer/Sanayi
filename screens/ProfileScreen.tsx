import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { StyleSheet, View, Alert, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { Button, Input, Avatar, Text } from '@rneui/themed';
import { Session } from '@supabase/supabase-js';
import * as ImagePicker from 'expo-image-picker';

export default function ProfileScreen({ session }: { session: Session }) {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [username, setUsername] = useState('');
  const [website, setWebsite] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null); // string | null olarak güncellendi

  useEffect(() => {
    if (session) getProfile();
  }, [session]);

  async function getProfile() {
    try {
      setLoading(true);
      if (!session?.user) throw new Error('No user on the session!');

      const { data, error, status } = await supabase
        .from('profiles')
        .select(`username, website, avatar_url`)
        .eq('id', session.user.id)
        .single();

      if (error && status !== 406) {
        throw error;
      }

      if (data) {
        setUsername(data.username || '');
        setWebsite(data.website || '');
        const fetchedAvatarUrl = data.avatar_url || null;
        setAvatarUrl(fetchedAvatarUrl);
        console.log('Profile fetched, avatarUrl:', fetchedAvatarUrl); // LOG 1
      }
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert('Error fetching profile', error.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function updateProfileData({
    username,
    website,
    avatar_url,
  }: {
    username: string;
    website: string;
    avatar_url: string | null; // string | null olarak güncellendi
  }) {
    try {
      setLoading(true);
      if (!session?.user) throw new Error('No user on the session!');

      const updates = {
        id: session.user.id,
        username,
        website,
        avatar_url,
        updated_at: new Date(),
      };

      const { error } = await supabase.from('profiles').upsert(updates);

      if (error) {
        throw error;
      }
      Alert.alert('Success', 'Profile updated successfully!');
      // Optionally re-fetch profile or just update local state if confident
      if (avatar_url !== undefined) setAvatarUrl(avatar_url);

    } catch (error) {
      if (error instanceof Error) {
        Alert.alert('Error updating profile', error.message);
      }
    } finally {
      setLoading(false);
    }
  }

  const handlePickAndUploadAvatar = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) {
        Alert.alert("Permission required", "You've refused to allow this app to access your photos!");
        return;
      }

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images', // Küçük harf 'images' olarak düzeltildi
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (pickerResult.canceled) {
        return;
      }

      if (pickerResult.assets && pickerResult.assets.length > 0) {
        const asset = pickerResult.assets[0];
        const uri = asset.uri;
        
        setUploading(true);

        const fileExt = uri.split('.').pop();
        const fileName = `${session.user.id}_${Date.now()}.${fileExt}`;
        const filePath = `${session.user.id}/${fileName}`; // Store in a user-specific folder

        // Use FormData for uploading
        const formData = new FormData();
        formData.append('file', {
          uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
          name: fileName,
          type: asset.mimeType || `image/${fileExt}`, // Ensure this is a valid MIME type
        } as any); // 'as any' to bypass strict type checking for FormData append if needed

        console.log('FormData created for file:', fileName, 'Type:', asset.mimeType || `image/${fileExt}`);
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, formData, {
            // contentType is usually inferred from FormData, but can be set if needed
            // For FormData, Supabase client might handle content type automatically.
            // Explicitly setting it might sometimes cause issues with FormData.
            // Let's try without it first, or ensure it's correctly derived.
            // contentType: asset.mimeType || `image/${fileExt}`, 
            upsert: true, 
          });

        if (uploadError) {
          throw uploadError;
        }

        // getPublicUrl sadece data: { publicUrl: string } döner, error objesi bu seviyede dönmez.
        const { data: publicURLData } = supabase.storage.from('avatars').getPublicUrl(filePath);
        console.log('getPublicUrl data:', publicURLData); // LOG 2
        
        if (!publicURLData || !publicURLData.publicUrl) {
            // Eğer publicUrl null veya undefined ise, bu bir sorun teşkil edebilir.
            // Dosyanın varlığını veya bucket izinlerini kontrol etmek gerekebilir.
            // Şimdilik bir hata fırlatıyoruz.
            console.error('Failed to get public URL. Data from getPublicUrl:', publicURLData);
            throw new Error('Could not retrieve a valid public URL for the avatar.');
        }
        
        const newAvatarUrl = publicURLData.publicUrl;
        console.log('New avatar public URL:', newAvatarUrl); // LOG 4
        setAvatarUrl(newAvatarUrl); // Update UI immediately
        await updateProfileData({ username, website, avatar_url: newAvatarUrl }); // Save to DB

      }
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert('Avatar Upload Error', error.message);
      } else {
        Alert.alert('Avatar Upload Error', 'An unexpected error occurred.');
      }
    } finally {
      setUploading(false);
    }
  };


  // Konsol loglarını görmek için avatarUrl'yi burada da loglayabiliriz.
  // console.log('Rendering ProfileScreen, avatarUrl state:', avatarUrl);

  if (loading && !avatarUrl && !username) { // Daha kapsamlı ilk yükleme kontrolü
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066CC"/>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.avatarContainer}>
        <Avatar
          size={150}
          rounded
          source={avatarUrl ? { uri: avatarUrl } : undefined}
          title={username ? username.charAt(0).toUpperCase() : (session.user.email ? session.user.email.charAt(0).toUpperCase() : 'P')}
          containerStyle={styles.avatar}
        >
          <Avatar.Accessory size={34} onPress={handlePickAndUploadAvatar} disabled={uploading || loading} />
        </Avatar>
        {(uploading || (loading && avatarUrl === null)) && <ActivityIndicator style={styles.uploadIndicator} size="small" color="#0066CC"/>}
      </View>
      
      <Text style={styles.emailText}>{session?.user?.email}</Text>

      <Input
        label="Kullanıcı Adı"
        value={username}
        onChangeText={setUsername}
        placeholder="Kullanıcı adınız"
        inputContainerStyle={styles.inputContainer}
        labelStyle={styles.label}
        autoCapitalize="none"
      />
      <Input
        label="Website"
        value={website}
        onChangeText={setWebsite}
        placeholder="https://siteniz.com"
        inputContainerStyle={styles.inputContainer}
        labelStyle={styles.label}
        autoCapitalize="none"
      />

      <Button
        title={loading || uploading ? 'Güncelleniyor...' : 'Profili Güncelle'}
        onPress={() => updateProfileData({ username, website, avatar_url: avatarUrl })}
        disabled={loading || uploading}
        buttonStyle={styles.button}
        containerStyle={styles.buttonContainer}
      />
      <Button
        title="Çıkış Yap"
        onPress={() => supabase.auth.signOut()}
        buttonStyle={[styles.button, styles.signOutButton]}
        containerStyle={styles.buttonContainer}
        disabled={uploading}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f0f2f5', // Diğer ekranlarla uyumlu açık gri
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f2f5', // Diğer ekranlarla uyumlu açık gri
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 30,
    position: 'relative',
  },
  avatar: {
    backgroundColor: '#cccccc',
    borderWidth: 3,
    borderColor: '#0066CC', // Yeni birincil mavi
  },
  uploadIndicator: {
    position: 'absolute',
    bottom: 10,
    right: 10,
  },
  emailText: {
    marginBottom: 20,
    color: '#555',
    fontSize: 16,
  },
  inputContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderBottomWidth: 0, // Remove default underline for a cleaner look with borderRadius
    paddingHorizontal: 10,
    marginBottom: 15, // Space between inputs
    elevation: 2, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  label: {
    color: '#0066CC', // Yeni birincil mavi
    fontWeight: '600',
    marginBottom: 5,
    marginLeft: 5,
  },
  buttonContainer: {
    width: '100%',
    marginTop: 10,
  },
  button: {
    backgroundColor: '#0066CC', // Yeni birincil mavi
    borderRadius: 10,
    paddingVertical: 12,
  },
  signOutButton: {
    backgroundColor: '#dc3545',
  },
});
