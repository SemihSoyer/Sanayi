import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { StyleSheet, View, Alert, Platform, ScrollView, ActivityIndicator, TouchableOpacity, SafeAreaView } from 'react-native';
import { Button, Input, Avatar, Text, Card, Icon } from '@rneui/themed';
import { Session } from '@supabase/supabase-js';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';

type ProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, 'App'>;

export default function ProfileScreen({ session }: { session: Session }) {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [username, setUsername] = useState('');
  const [website, setWebsite] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const navigation = useNavigation<ProfileScreenNavigationProp>();

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
        setAvatarUrl(data.avatar_url || null);
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
    avatar_url: string | null;
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
        const filePath = `${session.user.id}/${fileName}`;

        const formData = new FormData();
        formData.append('file', {
          uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
          name: fileName,
          type: asset.mimeType || `image/${fileExt}`,
        } as any);
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, formData, {
            upsert: true, 
          });

        if (uploadError) {
          throw uploadError;
        }

        const { data: publicURLData } = supabase.storage.from('avatars').getPublicUrl(filePath);
        
        if (!publicURLData || !publicURLData.publicUrl) {
            console.error('Failed to get public URL. Data from getPublicUrl:', publicURLData);
            throw new Error('Could not retrieve a valid public URL for the avatar.');
        }
        
        const newAvatarUrl = publicURLData.publicUrl;
        setAvatarUrl(newAvatarUrl);
        await updateProfileData({ username, website, avatar_url: newAvatarUrl });

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

  if (loading && !avatarUrl && !username) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066CC"/>
      </View>
    );
  }

  const menuItems: { title: string; icon: string; screen: any }[] = [
    { title: 'Ayarlar', icon: 'settings-outline', screen: 'Settings' },
    { title: 'Bize Ulaşın', icon: 'mail-outline', screen: 'ContactUs' },
    { title: 'Gizlilik Politikası', icon: 'shield-checkmark-outline', screen: 'PrivacyPolicy' },
    { title: 'Hizmet Koşulları', icon: 'document-text-outline', screen: 'TermsOfService' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Card containerStyle={styles.cardContainer}>
          <View style={styles.avatarSection}>
            <Avatar
              size={120}
              rounded
              source={avatarUrl ? { uri: avatarUrl } : undefined}
              title={username ? username.charAt(0).toUpperCase() : (session.user.email ? session.user.email.charAt(0).toUpperCase() : 'P')}
              containerStyle={styles.avatar}
            >
              <Avatar.Accessory size={30} onPress={handlePickAndUploadAvatar} disabled={uploading || loading} iconStyle={styles.avatarAccessory} />
            </Avatar>
            {(uploading || (loading && avatarUrl === null && !username)) && <ActivityIndicator style={styles.uploadIndicator} size="small" color="#0066CC"/>}
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
            leftIcon={<Icon name='person-outline' type='ionicon' size={20} color='#86939e' />}
          />
          <Input
            label="Website"
            value={website}
            onChangeText={setWebsite}
            placeholder="https://siteniz.com"
            inputContainerStyle={styles.inputContainer}
            labelStyle={styles.label}
            autoCapitalize="none"
            leftIcon={<Icon name='globe-outline' type='ionicon' size={20} color='#86939e' />}
          />

          <Button
            title={loading || uploading ? 'Güncelleniyor...' : 'Profili Güncelle'}
            onPress={() => updateProfileData({ username, website, avatar_url: avatarUrl })}
            disabled={loading || uploading}
            buttonStyle={styles.updateButton}
            containerStyle={styles.buttonContainer}
            icon={<Icon name='checkmark-circle-outline' type='ionicon' color='white' size={20} style={{ marginRight: 8 }}/>}
          />
        </Card>

        <Card containerStyle={styles.cardContainer}> 
          <Text style={styles.menuTitle}>Uygulama</Text>
          {menuItems.map((item, index) => (
            <TouchableOpacity 
              key={index} 
              style={styles.menuItem} 
              onPress={() => navigation.navigate(item.screen)}
            >
              <Icon name={item.icon} type='ionicon' size={24} color='#007AFF' />
              <Text style={styles.menuItemText}>{item.title}</Text>
              <Icon name='chevron-forward-outline' type='ionicon' size={22} color='#C7C7CC' />
            </TouchableOpacity>
          ))}
        </Card>

        <Button
          title="Çıkış Yap"
          onPress={() => supabase.auth.signOut()}
          buttonStyle={styles.signOutButton}
          containerStyle={styles.buttonContainer}
          disabled={uploading}
          icon={<Icon name='log-out-outline' type='ionicon' color='white' size={20} style={{ marginRight: 8 }}/>}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F0F4F8',
  },
  scrollContainer: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F4F8',
  },
  cardContainer: {
    width: '100%',
    borderRadius: 12,
    padding: 15,
    marginTop: 20,
    marginBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    backgroundColor: '#FFFFFF',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 15,
  },
  avatar: {
    backgroundColor: '#C5E1A5',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  avatarAccessory: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 2,
  },
  uploadIndicator: {
    position: 'absolute',
    bottom: 0,
    right: '40%',
  },
  emailText: {
    fontSize: 16,
    color: '#607D8B',
    textAlign: 'center',
    marginBottom: 20,
  },
  inputContainer: {
    borderBottomWidth: 1,
    borderColor: '#DCE4E8',
    paddingHorizontal: 5,
    marginBottom: 5,
  },
  label: {
    fontSize: 14,
    color: '#34495E',
    fontWeight: '600',
    marginBottom: 4,
  },
  buttonContainer: {
    width: '90%',
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  updateButton: {
    backgroundColor: '#007AFF',
    borderRadius: 25,
    paddingVertical: 12,
  },
  signOutButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 25,
    paddingVertical: 12,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    paddingHorizontal: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFF2F5',
  },
  menuItemText: {
    flex: 1,
    marginLeft: 15,
    fontSize: 16,
    color: '#333',
  },
});
