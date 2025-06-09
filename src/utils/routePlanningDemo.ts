/**
 * 🧠 Rota Planlama Demo ve Test Fonksiyonları
 * Yeni segment bazlı şarj planlamasını test eder
 */

import { 
  planRouteWithCharging, 
  ChargingStation, 
  RoutePlanResult,
  EnergyCalculator 
} from '../lib/energyUtils';

// Demo veri setleri
const DEMO_VEHICLES = {
  peugeot2008: {
    name: 'Peugeot e-2008',
    batteryCapacity: 50, // kWh
    consumptionPer100km: 17.8 // kWh/100km
  },
  teslaMod3: {
    name: 'Tesla Model 3',
    batteryCapacity: 75, // kWh
    consumptionPer100km: 15.2 // kWh/100km
  },
  bmwi3: {
    name: 'BMW i3',
    batteryCapacity: 42, // kWh
    consumptionPer100km: 16.5 // kWh/100km
  }
};

const DEMO_CHARGING_STATIONS: ChargingStation[] = [
  {
    name: 'Trugo Yüreğir',
    lat: 37.0234,
    lng: 35.3311,
    powerKW: 180,
    distanceFromStartKm: 340
  },
  {
    name: 'OtoPriz Saray, Muratpaşa - DC 1',
    lat: 36.8868,
    lng: 30.7027,
    powerKW: 120,
    distanceFromStartKm: 115
  },
  {
    name: 'Hilton, Adana',
    lat: 37.0015,
    lng: 35.3213,
    powerKW: 75,
    distanceFromStartKm: 420
  },
  {
    name: 'Novotel Konya',
    lat: 37.8743,
    lng: 32.4846,
    powerKW: 180,
    distanceFromStartKm: 200
  },
  {
    name: 'Shell Kule Site',
    lat: 37.0056,
    lng: 35.3251,
    powerKW: 180,
    distanceFromStartKm: 425
  }
];

/**
 * 🚗 Demo Rota Planı: Antalya → Adana
 */
export function demoAntalyaAdanaRoute(): RoutePlanResult {
  console.log('🚗 Demo: Antalya → Adana Route Planning');
  
  // Rota segmentleri (toplam ~607km)
  const routeSegments = [
    85,   // Antalya → Akseki
    95,   // Akseki → Seydişehir  
    110,  // Seydişehir → Karaman
    120,  // Karaman → Pozantı
    97,   // Pozantı → Adana
    100   // Adana şehir içi + buffer
  ];
  
  const vehicle = DEMO_VEHICLES.peugeot2008;
  const startSOC = 85; // %85 başlangıç
  const targetSOC = 15; // %15 minimum varış
  
  const result = planRouteWithCharging(
    routeSegments,
    startSOC,
    targetSOC,
    vehicle.batteryCapacity,
    vehicle.consumptionPer100km,
    DEMO_CHARGING_STATIONS
  );
  
  // Sonuçları logla
  console.log('📊 Demo Results:');
  console.log(`🏁 Can reach destination: ${result.canReachDestination}`);
  console.log(`🔋 Final SOC: ${result.finalSOC.toFixed(1)}%`);
  console.log(`⚡ Charging stops: ${result.chargingStops.length}`);
  console.log(`⏱️ Total charging time: ${result.totalChargingTime} minutes`);
  console.log(`📈 Total energy consumed: ${result.totalEnergyConsumed.toFixed(1)} kWh`);
  
  if (result.chargingStops.length > 0) {
    console.log('🔌 Planned charging stops:');
    result.chargingStops.forEach((stop, index) => {
      console.log(`   ${index + 1}. ${stop.stationName}`);
      console.log(`      📍 At ${stop.distanceFromStartKm}km`);
      console.log(`      🔋 SOC: ${stop.entrySOC.toFixed(1)}% → ${stop.exitSOC.toFixed(1)}%`);
      console.log(`      ⚡ Energy added: ${stop.energyAddedKWh.toFixed(1)} kWh`);
      console.log(`      ⏱️ Charging time: ${stop.chargingTimeMinutes} min`);
      console.log(`      🔌 Station power: ${stop.stationPowerKW} kW`);
      console.log('');
    });
  }
  
  if (result.warnings.length > 0) {
    console.log('⚠️ Warnings:');
    result.warnings.forEach(warning => console.log(`   ${warning}`));
  }
  
  return result;
}

/**
 * 🧪 Çoklu Araç Karşılaştırma Testi
 */
export function demoVehicleComparison(): void {
  console.log('\n🧪 Vehicle Comparison Demo');
  console.log('='.repeat(50));
  
  // Aynı rota için farklı araçları test et
  const routeSegments = [100, 150, 120, 180, 157]; // ~707km Antalya-Adana extended
  const startSOC = 80;
  const targetSOC = 20;
  
  Object.entries(DEMO_VEHICLES).forEach(([key, vehicle]) => {
    console.log(`\n🚗 Testing: ${vehicle.name}`);
    console.log(`   Battery: ${vehicle.batteryCapacity}kWh`);
    console.log(`   Consumption: ${vehicle.consumptionPer100km}kWh/100km`);
    
    const result = planRouteWithCharging(
      routeSegments,
      startSOC,
      targetSOC,
      vehicle.batteryCapacity,
      vehicle.consumptionPer100km,
      DEMO_CHARGING_STATIONS
    );
    
    console.log(`   📊 Result: ${result.canReachDestination ? '✅ CAN REACH' : '❌ CANNOT REACH'}`);
    console.log(`   🔋 Final SOC: ${result.finalSOC.toFixed(1)}%`);
    console.log(`   ⚡ Stops needed: ${result.chargingStops.length}`);
    console.log(`   ⏱️ Total charging: ${result.totalChargingTime}min`);
    console.log(`   📈 Energy used: ${result.totalEnergyConsumed.toFixed(1)}kWh`);
  });
}

/**
 * 🎯 SOC Sensitivity Analysis
 */
export function demoSOCAnalysis(): void {
  console.log('\n🎯 SOC Sensitivity Analysis');
  console.log('='.repeat(50));
  
  const routeSegments = [120, 150, 180, 157]; // ~607km
  const vehicle = DEMO_VEHICLES.peugeot2008;
  
  // Farklı başlangıç SOC'ları test et
  const startSOCs = [60, 70, 80, 90];
  const targetSOC = 15;
  
  startSOCs.forEach(startSOC => {
    console.log(`\n🔋 Start SOC: ${startSOC}%`);
    
    const result = planRouteWithCharging(
      routeSegments,
      startSOC,
      targetSOC,
      vehicle.batteryCapacity,
      vehicle.consumptionPer100km,
      DEMO_CHARGING_STATIONS
    );
    
    console.log(`   📊 Can reach: ${result.canReachDestination ? 'YES' : 'NO'}`);
    console.log(`   🔋 Final SOC: ${result.finalSOC.toFixed(1)}%`);
    console.log(`   ⚡ Stops: ${result.chargingStops.length}`);
    console.log(`   ⏱️ Charging time: ${result.totalChargingTime}min`);
  });
}

/**
 * 🏃‍♂️ Tam Demo Paketi - Tüm testleri çalıştır
 */
export function runFullDemo(): void {
  console.log('🚀 Starting Full Route Planning Demo');
  console.log('='.repeat(60));
  
  try {
    // 1. Temel rota planı
    console.log('\n1️⃣ Basic Route Planning');
    demoAntalyaAdanaRoute();
    
    // 2. Araç karşılaştırması
    console.log('\n2️⃣ Vehicle Comparison');
    demoVehicleComparison();
    
    // 3. SOC analizi
    console.log('\n3️⃣ SOC Sensitivity Analysis');
    demoSOCAnalysis();
    
    console.log('\n🎉 Demo completed successfully!');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

/**
 * 📊 Energy Calculator Demo
 */
export function demoEnergyCalculator(): void {
  console.log('\n📊 Energy Calculator Demo');
  console.log('='.repeat(40));
  
  const vehicle = DEMO_VEHICLES.peugeot2008;
  const energyCalc = new EnergyCalculator(
    vehicle.batteryCapacity,
    vehicle.consumptionPer100km
  );
  
  console.log(`🚗 Vehicle: ${vehicle.name}`);
  console.log(`🔋 Battery: ${vehicle.batteryCapacity}kWh`);
  console.log(`📊 Consumption: ${vehicle.consumptionPer100km}kWh/100km`);
  console.log('');
  
  // Çeşitli hesaplamalar
  const testDistances = [50, 100, 150, 200];
  const testSOCs = [20, 40, 60, 80];
  
  console.log('📏 Distance → Energy & SOC Drop:');
  testDistances.forEach(distance => {
    const energy = energyCalc.calculateEnergyForDistance(distance);
    const socDrop = energyCalc.energyToSOC(energy);
    console.log(`   ${distance}km → ${energy.toFixed(1)}kWh → ${socDrop.toFixed(1)}% SOC drop`);
  });
  
  console.log('\n🔋 SOC → Range:');
  testSOCs.forEach(soc => {
    const range = energyCalc.calculateRange(soc);
    console.log(`   ${soc}% SOC → ${range.toFixed(1)}km range`);
  });
  
  console.log('\n📍 Segment Example (100km at 80% SOC):');
  const segmentResult = energyCalc.calculateSegmentSOC(80, 100, 0);
  console.log(`   Start: ${segmentResult.startSOC}%`);
  console.log(`   End: ${segmentResult.endSOC.toFixed(1)}%`);
  console.log(`   Energy used: ${segmentResult.energyConsumedKWh.toFixed(1)}kWh`);
  console.log(`   Description: ${segmentResult.description}`);
}

// Export for easy testing
export const DEMO = {
  antalyaAdana: demoAntalyaAdanaRoute,
  vehicleComparison: demoVehicleComparison,
  socAnalysis: demoSOCAnalysis,
  energyCalculator: demoEnergyCalculator,
  runAll: runFullDemo
}; 