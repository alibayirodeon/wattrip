# 🚗 WatTrip - EV Route Planning Mobile App

**WatTrip**, elektrikli araçlar için özel olarak geliştirilmiş, Türkçe destekli bir rota planlama ve şarj istasyonu bulma uygulamasıdır. React Native + Expo ile geliştirilmiştir.

## ✨ Özellikler

- 🛣️ **Akıllı Rota Planlama** - Başlangıç ve bitiş noktası ile çoklu durak desteği
- ⚡ **EV Şarj İstasyonu Entegrasyonu** - AC/DC şarj istasyonları ve yeşil enerji filtreleri
- 🗺️ **Harita Entegrasyonu** - Konum seçimi ve görselleştirme
- 📍 **GPS Konum Servisleri** - Gerçek zamanlı konum algılama
- 🇹🇷 **Türkçe Arayüz** - Tam Türkçe dil desteği
- 🎨 **Modern UI/UX** - Material Design prensipleri

## 🛠️ Teknoloji Stack

- **React Native** 0.79.3 - Cross-platform mobil geliştirme
- **Expo SDK** 53.0.10 - Hızlı geliştirme platformu
- **TypeScript** 5.8.3 - Type-safe JavaScript
- **React Native Paper** 5.14.5 - Material Design bileşenleri
- **Zustand** 5.0.5 - State yönetimi
- **React Navigation** 7.x - Navigasyon
- **Expo Location** 18.1.5 - GPS servisleri
- **NativeWind** 4.1.23 - Tailwind CSS

## 🚀 Kurulum

1. **Projeyi klonlayın:**
   ```bash
   git clone <repository-url>
   cd wattrip2
   ```

2. **Bağımlılıkları yükleyin:**
   ```bash
   npm install
   ```

3. **Uygulamayı çalıştırın:**
   ```bash
   npm start
   ```

## 📱 Platform Desteği

- ✅ **iOS** - iPhone/iPad
- ✅ **Android** - Telefon/Tablet
- ✅ **Web** - Progressive Web App

## 🔧 Geliştirme Komutları

```bash
npm start          # Expo development server
npm run android    # Android emülatörde çalıştır
npm run ios        # iOS simülatörde çalıştır
npm run web        # Web tarayıcısında çalıştır
```

## 📂 Proje Yapısı

```
src/
├── components/     # Yeniden kullanılabilir bileşenler
├── screens/        # Uygulama ekranları
├── navigation/     # Navigasyon tip tanımları
├── context/        # Zustand state store
└── lib/           # Yardımcı fonksiyonlar
```

## 🎯 Ekranlar

1. **LocationScreen** - Ana rota planlama ekranı
2. **SearchLocationScreen** - Konum arama ekranı
3. **MapSelectionScreen** - Harita üzerinden konum seçimi
4. **RouteDetailScreen** - Rota detayları ve bilgileri

## 🔒 İzinler

- **Konum İzni** - GPS tabanlı konum servisleri için
- **Network Erişimi** - Harita ve API istekleri için

## 📈 Gelecek Özellikler

- [ ] Gerçek zamanlı trafik bilgisi
- [ ] Şarj istasyonu rezervasyonu
- [ ] Rota geçmişi ve favoriler
- [ ] Sosyal özellikler ve paylaşım
- [ ] Çoklu dil desteği

## 🤝 Katkı Sağlama

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/yeni-ozellik`)
3. Commit edin (`git commit -m 'Yeni özellik eklendi'`)
4. Push edin (`git push origin feature/yeni-ozellik`)
5. Pull Request oluşturun

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

## 👨‍💻 Geliştirici

Geliştirildi ile ❤️ tarafından WatTrip ekibi

---

**WatTrip** - Elektrikli araçlarla seyahat etmenin en akıllı yolu! 🚗⚡ 