"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testChargingPlan = testChargingPlan;
var alternativePlanner_1 = require("./alternativePlanner");
var planPrinter_1 = require("./planPrinter");
const { AlternativePlanner } = require('./alternativePlanner');
const { PlanPrinter } = require('./planPrinter');
// Örnek rota (Antalya - Adana)
var route = [
    { lat: 36.8841, lng: 30.7056 }, // Antalya
    { lat: 36.8000, lng: 31.4333 }, // Manavgat
    { lat: 36.6000, lng: 32.0000 }, // Alanya
    { lat: 36.2000, lng: 32.6000 }, // Anamur
    { lat: 36.1000, lng: 33.0000 }, // Silifke (Dik yokuş ve uzun mesafe)
    { lat: 36.0000, lng: 33.5000 }, // Mersin
    { lat: 37.0000, lng: 35.3213 }, // Adana
];
// Örnek şarj istasyonları (sadece başlangıç ve bitiş noktalarında)
var stations = [
    {
        id: '1',
        name: 'Trugo Antalya',
        location: { lat: 36.8841, lng: 30.7056 },
        available: true,
        power: 150,
        type: 'Trugo',
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
        type: 'Tesla',
        price: 5.0,
        rating: 4.8,
        amenities: ['Restaurant', 'WC', 'Shop'],
        lastUpdated: new Date(),
    }
];
// Şarj planı seçenekleri
var options = {
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
async function testChargingPlan() {
    console.log('\n🧪 Test Senaryosu: İstanbul - Ankara Rota Planı');
    console.log('==================================================');

    const testScenario = {
        startLocation: { lat: 41.0082, lng: 28.9784 }, // İstanbul
        endLocation: { lat: 39.9334, lng: 32.8597 },   // Ankara
        startSOC: 80,                                  // Başlangıç batarya %80
        batteryCapacity: 50,                           // 50kWh batarya
        maxStops: 3,                                   // Maksimum 3 durak
        strategy: 'balanced'                           // Dengeli strateji
    };

    const plan = await AlternativePlanner.generatePlan(testScenario);
    
    // Planı doğrudan yazdır
    console.log('\n📋 Şarj Planı Detayları:');
    console.log('------------------------');
    console.log(JSON.stringify(plan, null, 2));

    // Planı formatlı şekilde yazdır
    PlanPrinter.printPlan(plan, 1);
}
// ABRP mantığına göre segment enerji hesaplama fonksiyonu
function calculateSegmentEnergy(segment, vehicle) {
    var distKm = segment.distance / 1000;
    var elevationGain = Math.max(0, segment.elevationDiff);
    var elevationLoss = Math.abs(Math.min(0, segment.elevationDiff));
    var baseConsumptionWh = vehicle.consumption * distKm;
    var uphillWh = (vehicle.weight * 9.81 * elevationGain) / 1000;
    var regenWh = (vehicle.weight * 9.81 * elevationLoss * vehicle.regenEfficiency) / 1000;
    var totalWh = baseConsumptionWh + uphillWh - regenWh;
    return totalWh;
}
// Test rotası oluştur
const testRoute = [
    { lat: 37.0094, lng: 33.3456 }, // Başlangıç
    { lat: 37.0564, lng: 33.4011 }, // Orta nokta
    { lat: 37.1234, lng: 33.4567 }  // Bitiş
];
// Test istasyonları
const testStations = [
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
const testPlan = {
    route: testRoute,
    stations: testStations,
    strategy: 'minStops',
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
// Testi çalıştır
testChargingPlan().catch(console.error);

// Van-Trabzon ABRP karşılaştırma testi
async function testManualRoute() {
    const testScenario = {
        startLocation: { lat: 38.5019, lng: 43.4160 }, // Van
        endLocation: { lat: 41.0015, lng: 39.7178 },   // Trabzon
        startSOC: 50,                                  // Başlangıç SOC %50
        batteryCapacity: 50,                           // 50kWh batarya
        maxStops: 5,                                   // Maksimum 5 durak
        strategy: 'balanced'                           // Dengeli strateji
    };

    console.log('\n🧪 ABRP Van-Trabzon Karşılaştırma Testi');
    console.log('==================================================');
    console.log('📍 Başlangıç:', testScenario.startLocation);
    console.log('🏁 Bitiş:', testScenario.endLocation);
    console.log('🔋 Başlangıç SOC:', testScenario.startSOC + '%');
    console.log('⚡ Batarya Kapasitesi:', testScenario.batteryCapacity + 'kWh');
    console.log('🛣️ Strateji:', testScenario.strategy);

    const plan = await AlternativePlanner.generatePlan(testScenario);
    
    // Planı detaylı göster
    console.log('\n📋 Şarj Planı Detayları:');
    console.log('------------------------');
    console.log(JSON.stringify(plan, null, 2));

    // Planı formatlı şekilde göster
    PlanPrinter.printPlan(plan, 1);
}

testManualRoute().catch(console.error);

function printChargingStopsTable(plan) {
  if (!plan.stops || plan.stops.length === 0) {
    console.log('🔋 Şarj durağı yok.');
    return;
  }
  const rows = plan.stops.map((stop, i) => [
    (i + 1).toString(),
    stop.station,
    stop.arrivalSOC !== undefined ? stop.arrivalSOC.toFixed(1) + '%' : '-',
    stop.chargeToSOC !== undefined ? stop.chargeToSOC.toFixed(1) + '%' : '-',
    stop.energy !== undefined ? stop.energy.toFixed(2) + ' kWh' : '-',
    stop.chargeTime !== undefined ? stop.chargeTime.toFixed(1) + ' dk' : '-',
    stop.arrivalTime || '-',
    stop.departureTime || '-'
  ]);
  const table = [
    ['#', 'İstasyon', 'Varış SOC', 'Şarj Sonrası SOC', 'Enerji', 'Şarj Süresi', 'Varış Zamanı', 'Çıkış Zamanı'],
    ...rows
  ];
  // Basit tablo yazdırıcı
  const colWidths = table[0].map((_, i) => Math.max(...table.map(row => (row[i] || '').length)));
  for (const row of table) {
    const line = row.map((cell, i) => (cell || '').padEnd(colWidths[i])).join(' | ');
    console.log(line);
  }
}

// 5 farklı gerçekçi rota için toplu test fonksiyonu (tablo ile)
async function testMultipleRealisticRoutesWithTables() {
  const testRoutes = [
    {
      name: "İzmir → Antalya",
      start: { lat: 38.4192, lng: 27.1287 },
      end: { lat: 36.8841, lng: 30.7056 },
      startSOC: 50,
      targetSOC: 50,
      strategy: "balanced"
    },
    {
      name: "İstanbul → Samsun",
      start: { lat: 41.0082, lng: 28.9784 },
      end: { lat: 41.2867, lng: 36.33 },
      startSOC: 50,
      targetSOC: 50,
      strategy: "balanced"
    },
    {
      name: "Ankara → Adana",
      start: { lat: 39.9208, lng: 32.8541 },
      end: { lat: 37.0000, lng: 35.3213 },
      startSOC: 50,
      targetSOC: 50,
      strategy: "balanced"
    },
    {
      name: "Bursa → Gaziantep",
      start: { lat: 40.1828, lng: 29.0665 },
      end: { lat: 37.0662, lng: 37.3833 },
      startSOC: 50,
      targetSOC: 50,
      strategy: "balanced"
    },
    {
      name: "Van → Erzincan",
      start: { lat: 38.5019, lng: 43.4160 },
      end: { lat: 39.75, lng: 39.5 },
      startSOC: 50,
      targetSOC: 50,
      strategy: "balanced"
    }
  ];
  for (const route of testRoutes) {
    console.log(`\n🚗 Rota: ${route.name}`);
    const scenario = {
      startLocation: route.start,
      endLocation: route.end,
      startSOC: route.startSOC,
      batteryCapacity: 50,
      maxStops: 10,
      strategy: route.strategy
    };
    const plan = await AlternativePlanner.generatePlan(scenario);
    // Özet
    const totalDistance = plan.segments.reduce((sum, seg) => sum + seg.distance, 0);
    const totalDriveTime = plan.totalDriveTime;
    const totalEnergy = plan.totalEnergy;
    const stopCount = plan.stops.length;
    const totalChargeTime = plan.totalChargeTime;
    const finalSOC = plan.finalSOC;
    let warning = '';
    if (finalSOC < route.targetSOC) {
      warning = `⚠️ Hedef varış SOC (%${route.targetSOC}) altına inildi! (Gerçek: %${finalSOC.toFixed(1)})`;
    }
    console.log(`📏 Mesafe: ${totalDistance.toFixed(1)} km, Sürüş süresi: ${totalDriveTime.toFixed(1)} dk`);
    console.log(`⚡ Toplam tüketim: ${totalEnergy.toFixed(1)} kWh`);
    console.log(`🔋 Şarj durak sayısı: ${stopCount}, Toplam şarj süresi: ${totalChargeTime.toFixed(1)} dk`);
    console.log(`📉 Varış SOC: %${finalSOC.toFixed(1)}`);
    if (warning) console.log(warning);
    if (plan.warnings && plan.warnings.length > 0) {
      plan.warnings.forEach(w => console.log(`⚠️ ${w}`));
    }
    // Tablo
    printChargingStopsTable(plan);
  }
}

// Fonksiyonu çalıştır
if (require.main === module) {
  testMultipleRealisticRoutesWithTables().catch(console.error);
}

async function testAntalyaIstanbulPlan() {
  const alternativePlanner = require('./alternativePlanner').AlternativePlanner;
  const batteryCapacity = 50; // Peugeot e-2008
  const startSOC = 50;
  const start = { lat: 36.8841, lng: 30.7056 };
  const end = { lat: 41.0082, lng: 28.9784 };
  const plan = await alternativePlanner.generatePlan({
    startLocation: start,
    endLocation: end,
    startSOC,
    batteryCapacity,
    maxStops: 10,
    strategy: 'balanced'
  });
  console.log('--- Antalya → İstanbul Şarj Planı ---');
  if (!plan || !plan.stops || plan.stops.length === 0) {
    console.log('Plan bulunamadı veya şarj durağı yok.');
    return;
  }
  plan.stops.forEach((stop, i) => {
    console.log(`#${i+1} ${stop.station}`);
    console.log(`  SOC: ${stop.arrivalSOC?.toFixed(1)}% → ${stop.chargeToSOC?.toFixed(1)}%`);
    console.log(`  Enerji: ${stop.energy?.toFixed(2)} kWh, Süre: ${stop.chargeTime?.toFixed(1)} dk, Güç: ${stop.power || '-'} kW, Maliyet: ₺${stop.cost?.toFixed(2)}`);
    console.log(`  Varış: ${stop.arrivalTime}, Çıkış: ${stop.departureTime}`);
  });
  console.log(`Varış SOC: ${plan.finalSOC?.toFixed(1)}%`);
  console.log(`Toplam süre: ${plan.totalTime?.toFixed(1)} dk`);
}

testAntalyaIstanbulPlan();
