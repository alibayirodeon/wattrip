import { Vehicle } from '../context/useVehicleStore';
import { ChargingStation } from '../services/chargingStationService';
import { EnergyCalculator, generateBatteryWarnings, calculateTripStats, formatDuration, SegmentSOC } from '../lib/energyUtils';

// Haversine formula - iki koordinat arası mesafe hesaplama (km)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Şarj istasyonu güç kategorisi belirleme
function getStationPowerCategory(station: ChargingStation): 'ultra' | 'fast' | 'medium' | 'slow' {
  const maxPower = Math.max(...(station.Connections?.map(conn => conn.PowerKW || 0) || [0]));
  
  if (maxPower >= 150) return 'ultra'; // 150kW+ (Ultra hızlı)
  if (maxPower >= 50) return 'fast';   // 50-149kW (Hızlı DC)
  if (maxPower >= 22) return 'medium'; // 22-49kW (Orta AC/DC)
  return 'slow';                       // <22kW (Yavaş AC)
}

// Connector type uyumluluğu kontrol et - daha gevşek kriter
function isStationCompatible(station: ChargingStation, vehicleSocketType: string): boolean {
  if (!station.Connections || station.Connections.length === 0) {
    return true; // Bağlantı bilgisi yoksa kabul et (güvenli taraf)
  }
  
  return station.Connections.some(connection => {
    const connectionTitle = connection.ConnectionType?.Title?.toLowerCase() || '';
    const formalName = connection.ConnectionType?.FormalName?.toLowerCase() || '';
    const powerKW = connection.PowerKW || 0;
    
    // DC Fast Charging stations genelde uyumludur
    if (powerKW >= 50) {
      return true; // 50kW+ istasyonlar genelde CCS/CHAdeMO destekler
    }
    
    switch (vehicleSocketType) {
      case 'CCS':
        return connectionTitle.includes('ccs') || 
               connectionTitle.includes('combo') ||
               connectionTitle.includes('dc') ||
               formalName.includes('combined charging system') ||
               formalName.includes('combo');
      case 'Type2':
        return connectionTitle.includes('type 2') || 
               connectionTitle.includes('type2') ||
               connectionTitle.includes('mennekes') ||
               formalName.includes('mennekes');
      case 'CHAdeMO':
        return connectionTitle.includes('chademo');
      default:
        return true; // Bilinmeyen socket type'lar için kabul et
    }
  });
}

// İstasyon skoru hesaplama (location, power, compatibility)
function calculateStationScore(
  station: ChargingStation, 
  targetLat: number, 
  targetLon: number,
  vehicleSocketType: string
): number {
  let score = 0;
  
  // 1. Mesafe skoru (yakın istasyonlar daha yüksek skor) - daha gevşek limit
  const distance = calculateDistance(
    station.AddressInfo?.Latitude || 0,
    station.AddressInfo?.Longitude || 0,
    targetLat,
    targetLon
  );
  const distanceScore = Math.max(0, 100 - distance); // 100km'den yakın olanlar puan alır (daha gevşek)
  score += distanceScore;
  
  // 2. Güç skoru (yüksek güç daha yüksek skor)
  const powerCategory = getStationPowerCategory(station);
  const powerScore = {
    'ultra': 100,
    'fast': 75,
    'medium': 50,
    'slow': 25
  }[powerCategory];
  score += powerScore;
  
  // 3. Uyumluluk skoru
  if (isStationCompatible(station, vehicleSocketType)) {
    score += 50; // Uyumlu connector type için bonus
  }
  
  // 4. Operational durumu skoru
  if (station.StatusType?.IsOperational) {
    score += 25;
  }
  
  return score;
}

export interface ChargingStop {
  stationId: number;
  name: string;
  stopCoord: { latitude: number; longitude: number };
  distanceFromStartKm: number;
  batteryBeforeStopPercent: number;
  batteryAfterStopPercent: number;
  energyChargedKWh: number;
  estimatedChargeTimeMinutes: number;
  stationPowerKW: number;
  averageChargingPowerKW: number; // Gerçek ortalama şarj gücü
  connectorType: string;
  chargingEfficiency: number; // Şarj verimliliği %
  segmentInfo?: {
    segmentIndex: number;
    distanceToNext?: number;
    batteryAtSegmentEnd?: number;
  };
}

export interface RouteData {
  distance: number; // meters
  polylinePoints: Array<{ latitude: number; longitude: number }>;
}

export interface ChargingPlanResult {
  chargingStops: ChargingStop[];
  totalChargingTimeMinutes: number;
  canReachDestination: boolean;
  batteryAtDestinationPercent: number;
  totalEnergyConsumedKWh: number;
  warnings: string[];
  segmentDetails: SegmentSOC[]; // Segment bazlı SOC detayları
  chargingEfficiencyStats: {
    averageChargingPower: number;
    totalEnergyCharged: number;
    chargingEfficiency: number;
  };
}

/**
 * 🔋 EV Şarj Planlama Algoritması
 * 
 * Kısıtlar:
 * 1. Maksimum şarj sınırı: %80'in üzerine şarj edilmez
 * 2. Minimum güvenlik eşiği: Hiçbir segmentte %20'nin altına düşülmez
 */
export function generateChargingPlan({
  selectedVehicle,
  routeData,
  chargingStations
}: {
  selectedVehicle: Vehicle;
  routeData: RouteData;
  chargingStations: ChargingStation[];
}): ChargingPlanResult {
  console.log('🧮 Şarj planı hesaplama başladı...', {
    vehicle: `${selectedVehicle.brand} ${selectedVehicle.model}`,
    batteryCapacity: `${selectedVehicle.batteryCapacity}kWh`,
    consumption: `${selectedVehicle.consumption}kWh/100km`,
    routeDistance: `${(routeData.distance / 1000).toFixed(1)}km`,
    availableStations: chargingStations.length
  });
  
  // 🔋 Energy calculator instance oluştur
  const energyCalc = new EnergyCalculator(
    selectedVehicle.batteryCapacity,
    selectedVehicle.consumption
  );
  
  const warnings: string[] = [];
  const chargingStops: ChargingStop[] = [];
  
  // [1] 📊 Temel hesaplamalar
  const routeDistanceKm = routeData.distance / 1000;
  const totalEnergyNeededKWh = energyCalc.distanceToEnergyConsumption(routeDistanceKm);
  const maxRangeKm = energyCalc.socToRange(100);
  
  // Başlangıç ve hedef batarya seviyeleri (ABRP tarzı)
  const startChargePercent = 85; // %85 ile başla (daha gerçekçi)
  const targetArrivalPercent = 15; // %15 ile bitir (güvenlik marjı)
  const maxChargePercent = 85; // Maksimum %85'e kadar şarj et (hız için)
  const safetyMarginPercent = 15; // %15 güvenlik marjı (daha güvenli)
  
  console.log('📈 Enerji hesaplamaları:', {
    totalEnergyNeeded: `${totalEnergyNeededKWh.toFixed(1)}kWh`,
    maxRange: `${maxRangeKm.toFixed(1)}km`,
    startBattery: `${startChargePercent}%`,
    targetArrival: `${targetArrivalPercent}%`
  });
  
  // Kısıtlar
  const MAX_SOC = 80; // %80 üstü şarj yok
  const MIN_SOC = 20; // %20 altı güvenlik eşiği
  const maxAttempts = 20; // Sonsuz döngü önleme
  
  let currentBatteryPercent = startChargePercent;
  let currentBatteryKWh = (currentBatteryPercent / 100) * selectedVehicle.batteryCapacity;
  let remainingDistanceKm = routeDistanceKm;
  let traveledDistanceKm = 0;
  let segmentIndex = 0;
  let usedStationIds = new Set<number>();
  
  while (remainingDistanceKm > 0 && segmentIndex < maxAttempts) {
    // Kalan menzil (km)
    let currentRangeKm = (currentBatteryKWh * 100) / selectedVehicle.consumption;
    // Bir sonraki segment için güvenli menzil (ör: 1.15x)
    let safetyRangeForNext = Math.min(currentRangeKm * 0.85, remainingDistanceKm);
    let nextSegmentDistance = Math.min(safetyRangeForNext, remainingDistanceKm);
    // Segment için gereken enerji ve SOC
    let energyNeededKWh = (nextSegmentDistance * selectedVehicle.consumption) / 100;
    let socNeeded = (energyNeededKWh / selectedVehicle.batteryCapacity) * 100;
    let socAfterSegment = currentBatteryPercent - socNeeded;

    // [1] Minimum güvenlik eşiği kontrolü
    if (socAfterSegment < MIN_SOC) {
      warnings.push(`⚠️ Segment sonunda SOC %${socAfterSegment.toFixed(1)} (<%${MIN_SOC}) olacak. Ek şarj planlanıyor.`);
      // Uygun istasyon bul
      const currentPosition = routeData.polylinePoints[Math.floor((traveledDistanceKm / routeDistanceKm) * routeData.polylinePoints.length)] || routeData.polylinePoints[0];
      const notUsedStations = chargingStations.filter(station => !usedStationIds.has(station.ID));
      const compatibleStations = notUsedStations.filter(station => isStationCompatible(station, selectedVehicle.socketType));
      const availableStations = compatibleStations
        .map(station => ({
          station,
          score: calculateStationScore(
            station,
            currentPosition.latitude,
            currentPosition.longitude,
            selectedVehicle.socketType
          ),
          distance: calculateDistance(
            station.AddressInfo?.Latitude || 0,
            station.AddressInfo?.Longitude || 0,
            currentPosition.latitude,
            currentPosition.longitude
          )
        }))
        .sort((a, b) => b.score - a.score);
      if (availableStations.length === 0) {
        warnings.push('Uygun şarj istasyonu bulunamadı! Alternatif rota önerilir.');
        break;
      }
      const bestStation = availableStations[0].station;
      // Hedef şarj seviyesi %80'i aşmamalı
      let targetChargePercent = Math.min(MAX_SOC, currentBatteryPercent + socNeeded + 10); // 10% buffer
      // Şarj miktarı ve süresi hesapla
      const stationPowerKW = Math.max(...(bestStation.Connections?.map(conn => conn.PowerKW || 0) || [0]));
      const energyToChargeKWh = ((targetChargePercent - currentBatteryPercent) / 100) * selectedVehicle.batteryCapacity;
      const chargingResult = calculateAdvancedChargeTime(
        energyCalc,
        currentBatteryPercent,
        targetChargePercent,
        stationPowerKW,
        {
          ambientTemp: 20,
          batteryCondition: 'good',
          chargingStrategy: 'balanced'
        }
      );
      // Şarj durağını ekle
      const chargingStop: ChargingStop = {
        stationId: bestStation.ID,
        name: bestStation.AddressInfo?.Title || `İstasyon ${bestStation.ID}`,
        stopCoord: {
          latitude: bestStation.AddressInfo?.Latitude || 0,
          longitude: bestStation.AddressInfo?.Longitude || 0
        },
        distanceFromStartKm: Math.round(traveledDistanceKm),
        batteryBeforeStopPercent: Math.round(currentBatteryPercent),
        batteryAfterStopPercent: Math.round(targetChargePercent),
        energyChargedKWh: Math.round(energyToChargeKWh * 10) / 10,
        estimatedChargeTimeMinutes: chargingResult.timeMinutes,
        stationPowerKW: Math.round(stationPowerKW),
        connectorType: selectedVehicle.socketType,
        averageChargingPowerKW: Math.round(chargingResult.averagePowerKW * 10) / 10,
        chargingEfficiency: Math.round(chargingResult.efficiency),
        segmentInfo: {
          segmentIndex: segmentIndex + 1,
          distanceToNext: remainingDistanceKm,
          batteryAtSegmentEnd: Math.round(currentBatteryPercent)
        }
      };
      chargingStops.push(chargingStop);
      usedStationIds.add(bestStation.ID);
      // Şarj sonrası güncelle
      currentBatteryPercent = targetChargePercent;
      currentBatteryKWh = (currentBatteryPercent / 100) * selectedVehicle.batteryCapacity;
      continue; // segmenti tekrar değerlendir
    }

    // [2] Maksimum şarj sınırı kontrolü
    if (currentBatteryPercent > MAX_SOC) {
      currentBatteryPercent = MAX_SOC;
      currentBatteryKWh = (currentBatteryPercent / 100) * selectedVehicle.batteryCapacity;
      warnings.push(`ℹ️ Şarj seviyesi %${MAX_SOC}'e kırpıldı (maksimum sınır).`);
    }

    // [3] Segmenti işle ve ilerle
    currentBatteryPercent = socAfterSegment;
    currentBatteryKWh = (currentBatteryPercent / 100) * selectedVehicle.batteryCapacity;
    traveledDistanceKm += nextSegmentDistance;
    remainingDistanceKm -= nextSegmentDistance;
    segmentIndex++;
  }
  
  // [7] 📊 Final hesaplamalar
  const totalChargingTimeMinutes = chargingStops.reduce((total, stop) => total + stop.estimatedChargeTimeMinutes, 0);
  const canReachDestination = remainingDistanceKm <= 0;
  
  // Hedefte kalan batarya hesapla
  let finalBatteryPercent = currentBatteryPercent;
  if (remainingDistanceKm > 0) {
    const remainingEnergyKWh = (remainingDistanceKm * selectedVehicle.consumption) / 100;
    finalBatteryPercent = currentBatteryPercent - (remainingEnergyKWh / selectedVehicle.batteryCapacity * 100);
  }

  // 📊 Şarj verimliliği istatistikleri hesapla
  const totalEnergyCharged = chargingStops.reduce((total, stop) => total + stop.energyChargedKWh, 0);
  const totalNominalCharging = chargingStops.reduce((total, stop) => 
    total + (stop.stationPowerKW * (stop.estimatedChargeTimeMinutes / 60)), 0);
  const averageChargingPower = chargingStops.length > 0 ? 
    chargingStops.reduce((total, stop) => total + (stop.averageChargingPowerKW || stop.stationPowerKW), 0) / chargingStops.length : 0;
  const overallChargingEfficiency = totalNominalCharging > 0 ? (totalEnergyCharged / totalNominalCharging) * 100 : 0;

  // 📍 Segment bazlı SOC hesaplaması
  const segmentDistances: number[] = [];
  const segmentDescriptions: string[] = [];
  
  // İlk segment - başlangıçtan ilk şarj durağına
  if (chargingStops.length > 0) {
    segmentDistances.push(chargingStops[0].distanceFromStartKm);
    segmentDescriptions.push(`Başlangıç → ${chargingStops[0].name}`);
    
    // Şarj durakları arası segmentler
    for (let i = 1; i < chargingStops.length; i++) {
      const segmentDistance = chargingStops[i].distanceFromStartKm - chargingStops[i-1].distanceFromStartKm;
      segmentDistances.push(segmentDistance);
      segmentDescriptions.push(`${chargingStops[i-1].name} → ${chargingStops[i].name}`);
    }
    
    // Son segment - son şarj durağından hedefe
    const lastStopDistance = chargingStops[chargingStops.length - 1].distanceFromStartKm;
    const finalSegmentDistance = routeDistanceKm - lastStopDistance;
    if (finalSegmentDistance > 0) {
      segmentDistances.push(finalSegmentDistance);
      segmentDescriptions.push(`${chargingStops[chargingStops.length - 1].name} → Hedef`);
    }
  } else {
    // Hiç şarj durağı yoksa tek segment
    segmentDistances.push(routeDistanceKm);
    segmentDescriptions.push('Başlangıç → Hedef (Tek segment)');
  }

  // DÜZELTME: Her segment için ayrı ayrı SOC hesapla
  const segmentDetails: SegmentSOC[] = segmentDistances.map((distance, i) =>
    energyCalc.calculateSegmentSOC(startChargePercent, distance, i)
  );

  console.log('🏁 Şarj planı tamamlandı:', {
    canReachDestination,
    chargingStops: chargingStops.length,
    finalBattery: `${finalBatteryPercent.toFixed(1)}%`,
    totalChargingTime: `${totalChargingTimeMinutes}dk`,
    warnings: warnings.length
  });

  return {
    chargingStops,
    totalChargingTimeMinutes,
    canReachDestination,
    batteryAtDestinationPercent: Math.round(finalBatteryPercent),
    totalEnergyConsumedKWh: Math.round(totalEnergyNeededKWh * 10) / 10,
    warnings,
    segmentDetails,
    chargingEfficiencyStats: {
      averageChargingPower: Math.round(averageChargingPower * 10) / 10,
      totalEnergyCharged: Math.round(totalEnergyCharged * 10) / 10,
      chargingEfficiency: Math.round(overallChargingEfficiency)
    }
  };
}

/**
 * 📖 KULLANIM ÖRNEĞİ:
 * 
 * ```typescript
 * import { generateChargingPlan } from '../utils/chargingPlanCalculator';
 * import { useVehicleStore } from '../context/useVehicleStore';
 * 
 * // RouteDetailScreen veya başka bir component içinde:
 * const { getSelectedVehicle } = useVehicleStore();
 * const selectedVehicle = getSelectedVehicle();
 * 
 * const routeData = {
 *   distance: 606100, // meters (606.1km)
 *   polylinePoints: [
 *     { latitude: 36.8969, longitude: 30.7133 },
 *     { latitude: 37.0000, longitude: 31.0000 },
 *     // ... more points
 *   ]
 * };
 * 
 * const chargingPlan = generateChargingPlan({
 *   selectedVehicle,
 *   routeData,
 *   chargingStations: availableStations
 * });
 * 
 * console.log('🔋 Şarj Planı:');
 * console.log(`Toplam Durak: ${chargingPlan.chargingStops.length}`);
 * console.log(`Toplam Şarj Süresi: ${chargingPlan.totalChargingTimeMinutes} dakika`);
 * console.log(`Hedefe Ulaşabilir: ${chargingPlan.canReachDestination ? 'Evet' : 'Hayır'}`);
 * console.log(`Hedefteki Batarya: ${chargingPlan.batteryAtDestinationPercent}%`);
 * 
 * chargingPlan.chargingStops.forEach((stop, index) => {
 *   console.log(`Durak ${index + 1}: ${stop.name}`);
 *   console.log(`  📍 Mesafe: ${stop.distanceFromStartKm}km`);
 *   console.log(`  🔋 Batarya: ${stop.batteryBeforeStopPercent}% → ${stop.batteryAfterStopPercent}%`);
 *   console.log(`  ⏱️ Şarj Süresi: ${stop.estimatedChargeTimeMinutes} dakika`);
 *   console.log(`  ⚡ Güç: ${stop.stationPowerKW}kW`);
 * });
 * ```
 * 
 * ⚠️ ÖNEMLİ NOTLAR:
 * 
 * 1. **Vehicle Store Entegrasyonu**: selectedVehicle mutlaka Vehicle tipinde olmalı ve şu özellikleri içermeli:
 *    - batteryCapacity (kWh)
 *    - consumption (kWh/100km) 
 *    - socketType ('CCS', 'Type2', 'CHAdeMO')
 * 
 * 2. **Route Data Format**: routeData.polylinePoints Google Directions API'den gelen decoded polyline olmalı
 * 
 * 3. **Charging Stations**: OpenChargeMap API'den gelen tam ChargingStation[] array'i gerekli
 * 
 * 4. **Performance**: Büyük rotalar için (1000+ nokta) polylinePoints'i optimize etmek gerekebilir
 * 
 * 5. **Error Handling**: Eğer uygun istasyon bulunamazsa warnings array'inde uyarılar olacak
 */

/**
 * 🔧 YARDİMCI FONKSİYONLAR:
 */

// Şarj planını UI-friendly formatta format et
export function formatChargingPlanForUI(plan: ChargingPlanResult) {
  return {
    summary: {
      totalStops: plan.chargingStops.length,
      totalChargingTime: `${Math.floor(plan.totalChargingTimeMinutes / 60)}s ${plan.totalChargingTimeMinutes % 60}dk`,
      canReach: plan.canReachDestination,
      finalBattery: `${plan.batteryAtDestinationPercent}%`,
      totalEnergy: `${plan.totalEnergyConsumedKWh}kWh`,
      hasWarnings: plan.warnings.length > 0
    },
    stops: plan.chargingStops.map((stop, index) => ({
      number: index + 1,
      name: stop.name,
      location: `${stop.distanceFromStartKm}km'de`,
      batteryChange: `${stop.batteryBeforeStopPercent}% → ${stop.batteryAfterStopPercent}%`,
      chargeTime: `${stop.estimatedChargeTimeMinutes}dk`,
      power: `${stop.stationPowerKW}kW`,
      connector: stop.connectorType,
      coordinates: stop.stopCoord
    })),
    warnings: plan.warnings
  };
}

// Şarj planı validasyonu
export function validateChargingPlan(
  vehicle: Vehicle,
  routeData: RouteData,
  stations: ChargingStation[]
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Vehicle validation
  if (!vehicle.batteryCapacity || vehicle.batteryCapacity < 10 || vehicle.batteryCapacity > 200) {
    errors.push('Batarya kapasitesi 10-200 kWh arasında olmalıdır');
  }
  
  if (!vehicle.consumption || vehicle.consumption < 10 || vehicle.consumption > 50) {
    errors.push('Tüketim 10-50 kWh/100km arasında olmalıdır');
  }
  
  if (!['CCS', 'Type2', 'CHAdeMO'].includes(vehicle.socketType)) {
    errors.push('Desteklenmeyen soket tipi');
  }
  
  // Route validation
  if (!routeData.distance || routeData.distance < 1000) {
    errors.push('Rota mesafesi minimum 1km olmalıdır');
  }
  
  if (!routeData.polylinePoints || routeData.polylinePoints.length < 2) {
    errors.push('Rota en az 2 koordinat noktası içermelidir');
  }
  
  // Stations validation
  if (!stations || stations.length === 0) {
    errors.push('Şarj istasyonu bulunamadı');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Basit şarj süresi hesaplama
function calculateAdvancedChargeTime(
  energyCalculator: EnergyCalculator,
  startSOC: number,
  targetSOC: number,
  stationPowerKW: number,
  options: {
    ambientTemp?: number;
    batteryCondition?: 'new' | 'good' | 'fair' | 'poor';
    chargingStrategy?: 'fast' | 'balanced' | 'gentle';
  } = {}
): { timeMinutes: number; averagePowerKW: number; efficiency: number } {
  // Şarj edilecek enerji miktarı
  const energyToCharge = energyCalculator.socToEnergy(targetSOC - startSOC);
  
  // Basit şarj süresi hesaplama (sabit güç varsayımı)
  const timeHours = energyToCharge / stationPowerKW;
  const timeMinutes = Math.round(timeHours * 60);
  
  // Ortalama güç basitçe şarjerin gücü
  const averagePowerKW = stationPowerKW;
  
  // Verimlilik %100 varsayalım
  const efficiency = 100;

  return {
    timeMinutes,
    averagePowerKW,
    efficiency
  };
}

// Legacy şarj süresi hesaplama (geriye uyumluluk için)
function calculateChargeTime(
  energyToChargeKWh: number, 
  stationPowerKW: number,
  currentBatteryPercent: number,
  targetBatteryPercent: number
): number {
  // Şarj eğrisi simülasyonu - yüksek batarya seviyelerinde şarj yavaşlar
  let averageChargingPower = stationPowerKW;
  
  if (currentBatteryPercent > 80) {
    averageChargingPower *= 0.3; // %80 üzerinde çok yavaş
  } else if (currentBatteryPercent > 60) {
    averageChargingPower *= 0.6; // %60-80 arası yavaşlar
  } else if (currentBatteryPercent > 40) {
    averageChargingPower *= 0.8; // %40-60 arası biraz yavaş
  }
  // %0-40 arası maksimum hızda şarj
  
  const chargeTimeHours = energyToChargeKWh / averageChargingPower;
  return Math.round(chargeTimeHours * 60); // Dakikaya çevir
} 