# WatTrip Rota ve Şarj Planlama Algoritması – Teknik Özeti

## 1. Rota ve Şarj Planlama Akışı

### a) Rota Hesaplama
- Kullanıcıdan başlangıç ve varış noktası alınır.
- Google Directions API veya benzeri bir servis ile rota polyline noktaları (`latitude`, `longitude`) elde edilir.
- Rota noktaları, `decodePolyline` fonksiyonu ile diziye çevrilir.

### b) Şarj İstasyonu Bulma
- Rota üzerindeki noktalar, GeoHash tabanlı kümeleme ile gruplandırılır (her 100 nokta için 1 küme, min 3, max 5).
- Her kümenin merkezi alınarak, bu noktalarda şarj istasyonu aranır.
- Her arama için OpenChargeMap API kullanılır:
  - Parametreler: `latitude`, `longitude`, `distance`, `maxresults`, `key` (API anahtarı), vb.
  - Sonuçlar cache'e alınır (5dk veya 1 saat).
- Eğer API başarısız olursa veya istasyon bulunamazsa, mock istasyonlar eklenir.

### c) Şarj Planı Hesaplama
- Kullanıcı aracının batarya kapasitesi, tüketimi ve soket tipi alınır.
- Rota uzunluğu ve enerji ihtiyacı hesaplanır.
- Başlangıç batarya yüzdesi (%85), hedef varış batarya yüzdesi (%15) olarak alınır.
- Rota segmentlere bölünür, her segmentte kalan batarya ve menzil hesaplanır.
- Eğer menzil yetersizse:
  - Uygun (soket uyumlu, kullanılmamış) istasyonlar filtrelenir ve skorlama yapılır.
  - En iyi istasyon seçilir, şarj süresi ve miktarı hesaplanır.
  - Şarj durakları ve toplam şarj süresi kaydedilir.
- Sonuçta, kullanıcıya şarj durakları, toplam şarj süresi, varıştaki batarya yüzdesi ve uyarılar sunulur.

---

## 2. Temel Fonksiyonlar ve Dosyalar

- **src/services/chargingStationService.ts**
  - `findChargingStationsAlongRoute(routePoints, searchRadius, batteryRangeKm)`
  - `searchChargingStations(params)`
  - `searchWithAdaptiveRadius(latitude, longitude, radius)`

- **src/utils/chargingPlanCalculator.ts**
  - `generateChargingPlan({ selectedVehicle, routeData, chargingStations })`
    - Enerji ihtiyacı, segment bazlı batarya ve menzil, istasyon skorlama, şarj süresi hesaplama

- **src/lib/energyUtils.ts**
  - `planRouteWithCharging(...)`
  - `calculateAdvancedChargeTime(...)`
  - Enerji, menzil, şarj süresi ve istasyon seçimiyle ilgili yardımcı fonksiyonlar

- **src/screens/RouteDetailScreen.tsx**
  - Kullanıcı arayüzünde rota, istasyonlar ve şarj planı gösterimi

---

## 3. Kullanılan API ve Teknolojiler

- **OpenChargeMap API**: Şarj istasyonu verisi
- **Google Directions API**: Rota ve polyline verisi
- **GeoHash**: Rota noktalarını kümelendirerek arama optimizasyonu
- **Cache**: API çağrılarında tekrar eden istekleri azaltmak için
- **Mock Data**: API başarısız olursa demo istasyonlar

---

## 4. Örnek Akış

1. Kullanıcı Antalya → Adana rotası seçer.
2. Rota noktaları alınır ve kümelenir.
3. Her küme merkezi için şarj istasyonları API'den çekilir.
4. Uygun istasyonlar filtrelenir, skorlama yapılır.
5. Batarya ve menzil durumuna göre şarj durakları ve süreleri hesaplanır.
6. Sonuçlar kullanıcıya sunulur.

---

## 5. Önemli Notlar

- API anahtarı her zaman doğru şekilde iletilmeli.
- Mobilde `process.env` kullanılamaz, anahtar doğrudan kodda veya uygun bir ortamdan alınmalı.
- Büyük rotalarda performans için polyline noktaları optimize edilebilir.
- Uygun istasyon bulunamazsa kullanıcıya uyarı verilir ve mock veriyle plan yapılır. 