import { AlternativePlanner } from './alternativePlanner';
import { PlanPrinter } from './planPrinter';
import { ChargingPlanOptions, ChargingStation } from '../types/chargingStation';
import { calculateDistance } from './distanceCalculator';
import { ExtendedAlternativePlan } from './planPrinter';

// Örnek rota (Antalya - Adana)
const route = [
  { lat: 36.8841, lng: 30.7056 }, // Antalya
  { lat: 36.8000, lng: 31.4333 }, // Manavgat
  { lat: 36.6000, lng: 32.0000 }, // Alanya
  { lat: 36.2000, lng: 32.6000 }, // Anamur
  { lat: 36.1000, lng: 33.0000 }, // Silifke (Dik yokuş ve uzun mesafe)
  { lat: 36.0000, lng: 33.5000 }, // Mersin
  { lat: 37.0000, lng: 35.3213 }, // Adana
];

// Örnek şarj istasyonları (sadece başlangıç ve bitiş noktalarında)
const stations: ChargingStation[] = [
  {
    id: '1',
    name: 'Trugo Antalya',
    location: { lat: 36.8841, lng: 30.7056 },
    available: true,
    power: 150,
    type: 'Trugo' as const,
    price: 4.5,
    rating: 4.5,
    amenities: ['Restaurant', 'WC', 'Cafe'],
    lastUpdated: new Date(),
  },
  {
    id: '2',
    name: 'Tesla Adana',
    location: { lat: 37.0000, lng: 35.3213 },
    available: true,
    power: 250,
    type: 'Tesla' as const,
    price: 5.0,
    rating: 4.8,
    amenities: ['Restaurant', 'WC', 'Shop'],
    lastUpdated: new Date(),
  }
];

// Şarj planı seçenekleri
const options: ChargingPlanOptions = {
  minSOC: 20,
  maxSOC: 80,
  preferredStationTypes: ['Trugo', 'Tesla'],
  minPower: 100,
  maxPrice: 5.5,
  minRating: 4.0,
  requiredAmenities: ['WC'],
  strategy: 'balanced'
};

// Test fonksiyonu
export function testChargingPlan() {
  console.log('=== WATTRIP ŞARJ PLANI TESTİ ===\n');
  
  // Alternatif planları oluştur
  const plans = AlternativePlanner.generatePlans(
    route,
    stations,
    options,
    50, // 50kWh batarya
    24  // %24 başlangıç şarjı
  );

  // Planları yazdır
  console.log('\n=== WATTRIP ŞARJ PLANI TESTİ ===\n');

  plans.forEach((plan, index) => {
    console.log(`🧪 Plan ${index + 1} sonucu: success = ${plan.success}`);
    if (!plan.success) {
      console.log(`❌ Neden: ${plan.failureReason}, SOC: ${plan.finalSOC}, Lokasyon: ${JSON.stringify(plan.failureLocation)}`);
    }
    console.log(`\nPLAN ${index + 1}\n`);
    PlanPrinter.printPlan(plan as ExtendedAlternativePlan, index + 1);
  });

  // İstasyon karşılaştırması
  console.log('\n=== İSTASYON KARŞILAŞTIRMASI ===');
  PlanPrinter.printStationComparison(stations);

  // En iyi istasyonun detayları
  console.log('\n=== EN İYİ İSTASYON ===');
  const bestStation = stations.reduce((best, current) => 
    (current.rating > best.rating) ? current : best
  );
  console.log(`\n=== ŞARJ İSTASYONU DETAYLARI ===`);
  console.log(`İsim: ${bestStation.name}`);
  console.log(`Tip: ${bestStation.type}`);
  console.log(`Güç: ${bestStation.power}kW`);
  console.log(`Fiyat: ${bestStation.price} TL/kWh`);
  console.log(`Değerlendirme: ${bestStation.rating}/5`);
  console.log(`Müsaitlik: ${bestStation.available ? 'Evet' : 'Hayır'}`);
  console.log(`Olanaklar: ${bestStation.amenities.join(', ')}`);
  console.log(`Son Güncelleme: ${bestStation.lastUpdated.toLocaleString()}`);
}

// ABRP mantığına göre segment enerji hesaplama fonksiyonu
function calculateSegmentEnergy(segment: { distance: number; elevationDiff: number }, vehicle: { consumption: number; weight: number; regenEfficiency: number }) {
  const distKm = segment.distance / 1000;
  const elevationGain = Math.max(0, segment.elevationDiff);
  const elevationLoss = Math.abs(Math.min(0, segment.elevationDiff));

  const baseConsumptionWh = vehicle.consumption * distKm;
  const uphillWh = (vehicle.weight * 9.81 * elevationGain) / 1000;
  const regenWh = (vehicle.weight * 9.81 * elevationLoss * vehicle.regenEfficiency) / 1000;

  const totalWh = baseConsumptionWh + uphillWh - regenWh;

  return totalWh;
}

// Test senaryosu
const testScenario = {
  start: {
    lat: 37.0094,
    lng: 33.3456,
    elevation: 1000, // Yüksek başlangıç noktası
    soc: 24 // Düşük başlangıç SOC
  },
  end: {
    lat: 37.1234,
    lng: 33.4567,
    elevation: 1800, // Daha yüksek bitiş noktası
    soc: 20 // Hedef SOC
  },
  vehicle: {
    batteryCapacity: 50, // kWh
    consumptionPerKm: 0.178, // kWh/km
    minSOC: 10, // Minimum SOC
    maxSOC: 90 // Maximum SOC
  }
};

// Test rotası oluştur
const testRoute: { lat: number; lng: number; }[] = [
  { lat: 37.0094, lng: 33.3456 }, // Başlangıç
  { lat: 37.0564, lng: 33.4011 }, // Orta nokta
  { lat: 37.1234, lng: 33.4567 }  // Bitiş
];

// Test istasyonları
const testStations: ChargingStation[] = [
  {
    id: 'station1',
    name: 'Test Station 1',
    location: {
      lat: 37.0564,
      lng: 33.4011
    },
    power: 50, // kW
    price: 5, // TL/kWh
    rating: 4.5,
    available: true,
    type: 'Trugo',
    amenities: ['WC', 'Cafe'],
    lastUpdated: new Date()
  }
];

// Test planı oluştur
const testPlan: ExtendedAlternativePlan = {
  route: testRoute,
  stations: testStations,
  strategy: 'minStops' as const,
  success: false,
  failureReason: 'noStationsInRange',
  failureLocation: {
    lat: 37.0564,
    lng: 33.4011
  },
  finalSOC: 14.99,
  totalEnergy: 123.79,
  warnings: [
    'Yüksek eğim nedeniyle enerji tüketimi beklenenden fazla',
    'Düşük başlangıç SOC nedeniyle rota tamamlanamadı'
  ],
  chargingStops: [],
  totalTime: 0,
  totalStops: 0,
  totalCost: 0,
  socProfile: []
};

// Test planını yazdır
console.log('🧪 Test Senaryosu: Düşük SOC ve Yüksek Eğimli Rota');
console.log('==================================================');
PlanPrinter.printPlan(testPlan, 0);

// Dosya çalıştırıldığında otomatik test başlat
if (require.main === module) {
  testChargingPlan();
} 