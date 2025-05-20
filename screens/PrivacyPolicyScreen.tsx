import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';

const PrivacyPolicyScreen = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Gizlilik Politikası</Text>
        <Text style={styles.paragraph}>
          Son güncelleme: [Tarih]
        </Text>
        <Text style={styles.paragraph}>
          Bu gizlilik politikası, [Uygulama Adınız] ("biz", "bize" veya "bizim") tarafından işletilen mobil uygulamanın kullanıcılarından ("siz" veya "sizin") toplanan, kullanılan ve ifşa edilen bilgileri açıklar.
        </Text>
        <Text style={styles.subTitle}>Topladığımız Bilgiler</Text>
        <Text style={styles.paragraph}>
          Kişisel Bilgiler: Uygulamamızı kullandığınızda, adınız, e-posta adresiniz, telefon numaranız gibi kişisel bilgileri bize sağlayabilirsiniz...
        </Text>
        <Text style={styles.subTitle}>Bilgilerin Kullanımı</Text>
        <Text style={styles.paragraph}>
          Topladığımız bilgileri şu amaçlarla kullanabiliriz: Uygulamamızı sağlamak ve sürdürmek; hizmetlerimizi kişiselleştirmek; sizinle iletişim kurmak...
        </Text>
        <Text style={styles.subTitle}>Çocukların Gizliliği</Text>
        <Text style={styles.paragraph}>
          Hizmetimiz 13 yaşın altındaki kişilere yönelik değildir... 
        </Text>
        <Text style={styles.subTitle}>Bu Gizlilik Politikasındaki Değişiklikler</Text>
        <Text style={styles.paragraph}>
          Gizlilik politikamızı zaman zaman güncelleyebiliriz. Yeni gizlilik politikasını bu sayfada yayınlayarak herhangi bir değişikliği size bildireceğiz.
        </Text>
        <Text style={styles.subTitle}>Bize Ulaşın</Text>
        <Text style={styles.paragraph}>
          Bu Gizlilik Politikası hakkında herhangi bir sorunuz varsa, lütfen bize ulaşın: [E-posta Adresiniz]
        </Text>
        {/* Daha fazla bölüm eklenebilir */}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F4F8',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  subTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#444',
    marginTop: 20,
    marginBottom: 10,
  },
  paragraph: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    marginBottom: 15,
  },
});

export default PrivacyPolicyScreen; 