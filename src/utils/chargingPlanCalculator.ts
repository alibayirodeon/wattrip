import { Vehicle } from '../context/useVehicleStore';
import { ChargingStation } from '../services/chargingStationService';

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

// Connector type uyumluluğu kontrol et
function isStationCompatible(station: ChargingStation, vehicleSocketType: string): boolean {
  if (!station.Connections) return false;
  
  return station.Connections.some(connection => {
    const connectionTitle = connection.ConnectionType?.Title?.toLowerCase() || '';
    const formalName = connection.ConnectionType?.FormalName?.toLowerCase() || '';
    
    switch (vehicleSocketType) {
      case 'CCS':
        return connectionTitle.includes('ccs') || 
               formalName.includes('combined charging system');
      case 'Type2':
        return connectionTitle.includes('type 2') || 
               connectionTitle.includes('type2') ||
               formalName.includes('mennekes');
      case 'CHAdeMO':
        return connectionTitle.includes('chademo');
      default:
        return true; // Bilinmeyen socket type'lar için genel kabul
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
  
  // 1. Mesafe skoru (yakın istasyonlar daha yüksek skor)
  const distance = calculateDistance(
    station.AddressInfo?.Latitude || 0,
    station.AddressInfo?.Longitude || 0,
    targetLat,
    targetLon
  );
  const distanceScore = Math.max(0, 50 - distance); // 50km'den yakın olanlar puan alır
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

// Şarj süresi hesaplama (dakika)
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
  connectorType: string;
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
}

/**
 * 🔋 EV Şarj Planlama Algoritması
 * 
 * Araç özelliklerine ve rota bilgilerine göre optimal şarj planı oluşturur
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
  
  const warnings: string[] = [];
  const chargingStops: ChargingStop[] = [];
  
  // [1] 📊 Temel hesaplamalar
  const routeDistanceKm = routeData.distance / 1000;
  const totalEnergyNeededKWh = (routeDistanceKm * selectedVehicle.consumption) / 100;
  const maxRangeKm = (selectedVehicle.batteryCapacity * 100) / selectedVehicle.consumption;
  
  // Başlangıç ve hedef batarya seviyeleri (varsayılan değerler)
  const startChargePercent = 80; // %80 ile başla
  const targetArrivalPercent = 20; // %20 ile bitir
  const maxChargePercent = 90; // Maksimum %90'a kadar şarj et
  const safetyMarginPercent = 10; // %10 güvenlik marjı
  
  console.log('📈 Enerji hesaplamaları:', {
    totalEnergyNeeded: `${totalEnergyNeededKWh.toFixed(1)}kWh`,
    maxRange: `${maxRangeKm.toFixed(1)}km`,
    startBattery: `${startChargePercent}%`,
    targetArrival: `${targetArrivalPercent}%`
  });
  
  // [2] 🔋 Mevcut durum değerlendirme
  let currentBatteryPercent = startChargePercent;
  let currentBatteryKWh = (currentBatteryPercent / 100) * selectedVehicle.batteryCapacity;
  let currentRangeKm = (currentBatteryKWh * 100) / selectedVehicle.consumption;
  let remainingDistanceKm = routeDistanceKm;
  let traveledDistanceKm = 0;
  
  // [3] 🎯 İlk kontrol - tek seferde gidebilir mi?
  const canReachDirectly = currentRangeKm >= (routeDistanceKm + (routeDistanceKm * safetyMarginPercent / 100));
  
  if (canReachDirectly) {
    const batteryAtDestination = currentBatteryPercent - (totalEnergyNeededKWh / selectedVehicle.batteryCapacity * 100);
    console.log('✅ Tek seferde ulaşım mümkün:', {
      currentRange: `${currentRangeKm.toFixed(1)}km`,
      neededRange: `${routeDistanceKm.toFixed(1)}km`,
      batteryAtDestination: `${batteryAtDestination.toFixed(1)}%`
    });
    
    return {
      chargingStops: [],
      totalChargingTimeMinutes: 0,
      canReachDestination: true,
      batteryAtDestinationPercent: Math.round(batteryAtDestination),
      totalEnergyConsumedKWh: totalEnergyNeededKWh,
      warnings: batteryAtDestination < targetArrivalPercent ? 
        [`Hedefteki batarya seviyesi (${batteryAtDestination.toFixed(1)}%) hedef seviyenin (${targetArrivalPercent}%) altında olacak`] : []
    };
  }
  
  // [4] 🛣️ Şarj durakları planlama
  console.log('🔌 Şarj durakları planlama gerekli...');
  
  const usedStationIds = new Set<number>();
  let segmentIndex = 0;
  const maxAttempts = 10; // Sonsuz döngü önleme
  
  while (remainingDistanceKm > 0 && segmentIndex < maxAttempts) {
    // Mevcut menzille gidebileceği maksimum mesafe
    const safeRangeKm = currentRangeKm * (1 - safetyMarginPercent / 100);
    const segmentDistanceKm = Math.min(safeRangeKm, remainingDistanceKm);
    
    console.log(`📍 Segment ${segmentIndex + 1}:`, {
      currentBattery: `${currentBatteryPercent.toFixed(1)}%`,
      currentRange: `${currentRangeKm.toFixed(1)}km`,
      safeRange: `${safeRangeKm.toFixed(1)}km`,
      remainingDistance: `${remainingDistanceKm.toFixed(1)}km`,
      plannedSegment: `${segmentDistanceKm.toFixed(1)}km`
    });
    
    // Bu segmentten sonra şarj gerekli mi?
    const energyAfterSegment = currentBatteryKWh - (segmentDistanceKm * selectedVehicle.consumption / 100);
    const batteryAfterSegment = (energyAfterSegment / selectedVehicle.batteryCapacity) * 100;
    const rangeAfterSegment = (energyAfterSegment * 100) / selectedVehicle.consumption;
    
    traveledDistanceKm += segmentDistanceKm;
    remainingDistanceKm -= segmentDistanceKm;
    
    // Segment tamamlandıktan sonra durum güncelle
    currentBatteryKWh = energyAfterSegment;
    currentBatteryPercent = batteryAfterSegment;
    currentRangeKm = rangeAfterSegment;
    
    // Hedefe ulaştık mı?
    if (remainingDistanceKm <= 0) {
      console.log('🏁 Hedefe ulaşıldı:', {
        finalBattery: `${currentBatteryPercent.toFixed(1)}%`,
        targetArrival: `${targetArrivalPercent}%`
      });
      break;
    }
    
    // Şarj gerekli mi kontrol et
    const safetyRangeForNext = remainingDistanceKm * (1 + safetyMarginPercent / 100);
    
    if (currentRangeKm < safetyRangeForNext) {
      console.log(`🔋 Şarj gerekli: Mevcut menzil ${currentRangeKm.toFixed(1)}km, gerekli ${safetyRangeForNext.toFixed(1)}km`);
      
      // [5] 🎯 En yakın uygun istasyonu bul
      const currentPosition = routeData.polylinePoints[Math.floor((traveledDistanceKm / routeDistanceKm) * routeData.polylinePoints.length)] || 
                             routeData.polylinePoints[0];
      
      // Uygun istasyonları filtrele ve skorla
      const availableStations = chargingStations
        .filter(station => !usedStationIds.has(station.ID))
        .filter(station => isStationCompatible(station, selectedVehicle.socketType))
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
        .sort((a, b) => b.score - a.score); // En yüksek skordan düşüğe sırala
      
      if (availableStations.length === 0) {
        warnings.push('Uygun şarj istasyonu bulunamadı! Alternatif rota önerilir.');
        console.log('❌ Uygun şarj istasyonu bulunamadı');
        break;
      }
      
      const bestStation = availableStations[0];
      console.log(`🎯 En iyi istasyon seçildi: ${bestStation.station.AddressInfo?.Title} (Skor: ${bestStation.score.toFixed(1)}, Mesafe: ${bestStation.distance.toFixed(1)}km)`);
      
      // [6] ⚡ Şarj miktarı ve süresi hesapla
      const stationPowerKW = Math.max(...(bestStation.station.Connections?.map(conn => conn.PowerKW || 0) || [0]));
      
      // Hedef şarj seviyesi hesapla
      const neededRangeKm = remainingDistanceKm * (1 + safetyMarginPercent / 100);
      const neededEnergyKWh = (neededRangeKm * selectedVehicle.consumption) / 100;
      const neededBatteryPercent = (neededEnergyKWh / selectedVehicle.batteryCapacity) * 100;
      
      const targetChargePercent = Math.min(
        maxChargePercent,
        Math.max(
          currentBatteryPercent + neededBatteryPercent,
          80 // Minimum %80'e şarj et
        )
      );
      
      const energyToChargeKWh = ((targetChargePercent - currentBatteryPercent) / 100) * selectedVehicle.batteryCapacity;
      const chargeTimeMinutes = calculateChargeTime(
        energyToChargeKWh,
        stationPowerKW,
        currentBatteryPercent,
        targetChargePercent
      );
      
      // Şarj durağını ekle
      const chargingStop: ChargingStop = {
        stationId: bestStation.station.ID,
        name: bestStation.station.AddressInfo?.Title || `İstasyon ${bestStation.station.ID}`,
        stopCoord: {
          latitude: bestStation.station.AddressInfo?.Latitude || 0,
          longitude: bestStation.station.AddressInfo?.Longitude || 0
        },
        distanceFromStartKm: Math.round(traveledDistanceKm),
        batteryBeforeStopPercent: Math.round(currentBatteryPercent),
        batteryAfterStopPercent: Math.round(targetChargePercent),
        energyChargedKWh: Math.round(energyToChargeKWh * 10) / 10,
        estimatedChargeTimeMinutes: chargeTimeMinutes,
        stationPowerKW: Math.round(stationPowerKW),
        connectorType: selectedVehicle.socketType
      };
      
      chargingStops.push(chargingStop);
      usedStationIds.add(bestStation.station.ID);
      
      // Durum güncelle
      currentBatteryPercent = targetChargePercent;
      currentBatteryKWh = (currentBatteryPercent / 100) * selectedVehicle.batteryCapacity;
      currentRangeKm = (currentBatteryKWh * 100) / selectedVehicle.consumption;
      
      console.log(`⚡ Şarj durağı eklendi:`, {
        station: chargingStop.name,
        distance: `${chargingStop.distanceFromStartKm}km`,
        batteryChange: `${chargingStop.batteryBeforeStopPercent}% → ${chargingStop.batteryAfterStopPercent}%`,
        chargeTime: `${chargingStop.estimatedChargeTimeMinutes}dk`,
        newRange: `${currentRangeKm.toFixed(1)}km`
      });
    }
    
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
  
  // Uyarılar ekle
  if (!canReachDestination) {
    warnings.push('Mevcut şarj istasyonları ile hedefe ulaşım garantilenemiyor');
  }
  if (finalBatteryPercent < targetArrivalPercent) {
    warnings.push(`Hedefteki batarya seviyesi (${finalBatteryPercent.toFixed(1)}%) hedef seviyenin altında olacak`);
  }
  if (chargingStops.length > 5) {
    warnings.push('Çok fazla şarj durağı gerekiyor, alternatif rota değerlendirebilirsiniz');
  }
  
  console.log('🏁 Şarj planı tamamlandı:', {
    chargingStops: chargingStops.length,
    totalChargingTime: `${totalChargingTimeMinutes}dk`,
    canReachDestination,
    finalBattery: `${finalBatteryPercent.toFixed(1)}%`,
    warnings: warnings.length
  });
  
  return {
    chargingStops,
    totalChargingTimeMinutes,
    canReachDestination,
    batteryAtDestinationPercent: Math.round(finalBatteryPercent),
    totalEnergyConsumedKWh: Math.round(totalEnergyNeededKWh * 10) / 10,
    warnings
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