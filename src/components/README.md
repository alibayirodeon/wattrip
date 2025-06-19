# WatTrip Components

Bu klasör, WatTrip uygulamasında kullanılan yeniden kullanılabilir bileşenleri içerir.

## Input Bileşenleri

### LocationInput
Konum girişi için kullanılan input bileşeni.
```tsx
<LocationInput
  placeholder="Konum girin"
  onLocationSelect={(location) => {}}
  error="Hata mesajı"
  disabled={false}
/>
```

### SearchInput
Genel arama işlemleri için kullanılan input bileşeni.
```tsx
<SearchInput
  placeholder="Ara..."
  onSearch={(text) => {}}
  icon="search"
/>
```

### NumberInput
Sayısal değer girişi için kullanılan input bileşeni.
```tsx
<NumberInput
  placeholder="Değer girin"
  onValueChange={(value) => {}}
  min={0}
  max={100}
/>
```

### DropdownInput
Seçenekler arasından seçim yapmak için kullanılan input bileşeni.
```tsx
<DropdownInput
  placeholder="Seçiniz"
  options={[]}
  onSelect={(value) => {}}
/>
```

## Kart (Card) Bileşenleri

### ChargingStationCard
Şarj istasyonu bilgilerini gösteren kart bileşeni.
```tsx
<ChargingStationCard
  name="Trugo DC Antalya"
  power={180}
  available={true}
  rating={4.6}
/>
```

### RouteSummaryCard
Rota özeti bilgilerini gösteren kart bileşeni.
```tsx
<RouteSummaryCard
  distance="450 km"
  duration="5s 30d"
  chargingStops={3}
  totalChargingTime="45d"
/>
```

### VehicleCard
Araç bilgilerini gösteren kart bileşeni.
```tsx
<VehicleCard
  model="Tesla Model 3"
  batteryCapacity={75}
  range={400}
  image="url"
/>
```

### HistoryCard
Geçmiş rota bilgilerini gösteren kart bileşeni.
```tsx
<HistoryCard
  from="İstanbul"
  to="Ankara"
  date="2024-03-15"
  duration="4s 30d"
/>
```

## Ortak UI Bileşenleri

### PrimaryButton
Ana eylem butonu bileşeni.
```tsx
<PrimaryButton
  title="Rota Planla"
  onPress={() => {}}
  disabled={false}
  loading={false}
/>
```

### BatteryBar
Batarya durumunu gösteren bar bileşeni.
```tsx
<BatteryBar
  percentage={75}
  charging={true}
/>
```

### ActionSheet
Alt menü seçenekleri için kullanılan bileşen.
```tsx
<ActionSheet
  visible={true}
  onClose={() => {}}
  options={[]}
/>
```

## Stil Standartları

- Tüm bileşenler NativeWind className prop'unu destekler
- Koyu tema renkleri:
  - Arka plan: bg-gray-900
  - Yüzey: bg-gray-800
  - Metin: text-white, text-gray-400
  - Vurgu: text-blue-400, bg-blue-600
- Köşe yuvarlaklığı: rounded-xl
- Boşluklar: p-4, m-4, space-y-4

## Hata Yönetimi

Tüm input bileşenleri aşağıdaki hata yönetimi prop'larını destekler:
- error?: string
- disabled?: boolean
- loading?: boolean 