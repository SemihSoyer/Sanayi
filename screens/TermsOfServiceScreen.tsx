import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';

const TermsOfServiceScreen = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Hizmet Koşulları</Text>
        <Text style={styles.paragraph}>
          Son güncelleme: [Tarih]
        </Text>
        <Text style={styles.paragraph}>
          Lütfen bu Hizmet Koşullarını ("Koşullar", "Hizmet Koşulları") [Uygulama Adınız] mobil uygulamasını ("Hizmet") kullanmadan önce dikkatlice okuyun.
        </Text>
        <Text style={styles.subTitle}>Kabul</Text>
        <Text style={styles.paragraph}>
          Hizmete erişiminiz ve Hizmeti kullanımınız, bu Koşulları kabul etmenize ve bunlara uymanıza bağlıdır. Bu Koşullar, Hizmete erişen veya Hizmeti kullanan tüm ziyaretçiler, kullanıcılar ve diğerleri için geçerlidir.
        </Text>
        <Text style={styles.subTitle}>Hesaplar</Text>
        <Text style={styles.paragraph}>
          Bizde bir hesap oluşturduğunuzda, bize her zaman doğru, eksiksiz ve güncel bilgiler sağlamalısınız. Bunun yapılmaması, Koşulların ihlali anlamına gelir ve Hizmetimizdeki hesabınızın derhal feshedilmesine neden olabilir...
        </Text>
        <Text style={styles.subTitle}>Fikri Mülkiyet</Text>
        <Text style={styles.paragraph}>
          Hizmet ve orijinal içeriği, özellikleri ve işlevselliği [Uygulama Adınız] ve lisans verenlerinin münhasır mülkiyetindedir ve öyle kalacaktır...
        </Text>
        <Text style={styles.subTitle}>Bu Hizmet Koşullarındaki Değişiklikler</Text>
        <Text style={styles.paragraph}>
          Tamamen kendi takdirimize bağlı olarak, bu Koşulları herhangi bir zamanda değiştirme veya yerine yenisini getirme hakkımızı saklı tutarız...
        </Text>
        <Text style={styles.subTitle}>Bize Ulaşın</Text>
        <Text style={styles.paragraph}>
          Bu Koşullar hakkında herhangi bir sorunuz varsa, lütfen bize ulaşın: [E-posta Adresiniz]
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

export default TermsOfServiceScreen; 