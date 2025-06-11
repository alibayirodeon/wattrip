import { Vehicle } from '../context/useVehicleStore';
import { ChargingStation } from '../services/chargingStationService';
import { EnergyCalculator, generateBatteryWarnings, calculateTripStats, formatDuration } from '../lib/energyUtils';
import { calculateSegmentEnergy } from './energyCalculator';

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

export interface SegmentSOC {
  segmentIndex: number;
  distanceKm: number;
  energy: number;
  socDrop: number;
  socAfter: number;
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
  chargingStations,
  segmentEnergies,
  startChargePercent = 85
}: {
  selectedVehicle: Vehicle;
  routeData: RouteData;
  chargingStations: ChargingStation[];
  segmentEnergies?: number[];
  startChargePercent?: number;
}): ChargingPlanResult {
  console.log('🧮 Şarj planı hesaplama başladı...', {
    vehicle: `${selectedVehicle.brand} ${selectedVehicle.model}`,
    batteryCapacity: `${selectedVehicle.batteryCapacity}kWh`,
    consumption: `${selectedVehicle.consumption}kWh/100km`,
    routeDistance: `${(routeData.distance / 1000).toFixed(1)}km`,
    availableStations: chargingStations.length
  });
  
  // Sabitler ve başlangıç değerleri
  const SAFETY_SOC = 20; // Minimum güvenli SOC
  const PREFERRED_SOC = 80; // Tercih edilen maksimum SOC
  const SOC_BUFFER = 1; // SOC farkı toleransı
  
  const warnings: string[] = [];
  const chargingStops: ChargingStop[] = [];
  const segmentDetails: SegmentSOC[] = [];
  
  // [1] 📊 Temel hesaplamalar
  const routeDistanceKm = routeData.distance / 1000;
  let currentBatteryPercent = startChargePercent;
  let currentBatteryKWh = (currentBatteryPercent / 100) * selectedVehicle.batteryCapacity;
  let traveledDistanceKm = 0;
  let usedStationIds = new Set<number>();
  let totalEnergyNeededKWh = 0;
  
  // [2] 🔋 Segment bazlı enerji hesaplama
  let segments: number[] = [];
  if (segmentEnergies && segmentEnergies.length > 0) {
    segments = segmentEnergies;
  } else if (routeData.polylinePoints && routeData.polylinePoints.length > 1) {
    const points = routeData.polylinePoints;
    const elevations = Array(points.length).fill(0); // Gerçek uygulamada API'den alınacak
    for (let i = 0; i < points.length - 1; i++) {
      const distance = calculateDistance(
        points[i].latitude,
        points[i].longitude,
        points[i + 1].latitude,
        points[i + 1].longitude
      );
      const elevation = elevations[i + 1] - elevations[i];
      const params = { speed: 100, temperature: 20, load: 0, isHighway: true };
      const energy = calculateSegmentEnergy(distance, elevation, selectedVehicle, params);
      segments.push(energy);
    }
  } else {
    segments = [selectedVehicle.consumption * (routeDistanceKm / 100)];
  }
  
  // [3] 🚗 Segment bazlı ilerleme ve şarj planı
  for (let i = 0; i < segments.length; i++) {
    const segmentEnergy = segments[i];
    const segmentDistance = routeData.polylinePoints ? 
      calculateDistance(
        routeData.polylinePoints[i].latitude,
        routeData.polylinePoints[i].longitude,
        routeData.polylinePoints[i + 1].latitude,
        routeData.polylinePoints[i + 1].longitude
      ) : routeDistanceKm / segments.length;
    
    // Segment sonu SOC tahmini
    const energyForSegment = segmentEnergy;
    const socDropForSegment = (energyForSegment / selectedVehicle.batteryCapacity) * 100;
    const socAfterSegment = currentBatteryPercent - socDropForSegment;
    
    // Segment detaylarını kaydet
    segmentDetails.push({
      segmentIndex: i + 1,
      distanceKm: segmentDistance,
      energy: energyForSegment,
      socDrop: socDropForSegment,
      socAfter: socAfterSegment
    });
    
    // Güvenlik kontrolü
    if (socAfterSegment < SAFETY_SOC) {
      warnings.push(`⚠️ Segment ${i + 1} sonunda SOC %${socAfterSegment.toFixed(1)} (<%${SAFETY_SOC}) olacak. Ek şarj planlanıyor.`);
      
      // En uygun şarj istasyonunu bul
      const currentPosition = routeData.polylinePoints ? 
        routeData.polylinePoints[i] : 
        { latitude: 0, longitude: 0 };
      
      const availableStations = chargingStations
        .filter(station => {
          if (!station.AddressInfo?.Latitude || !station.AddressInfo?.Longitude) return false;
          if (usedStationIds.has(station.ID)) return false;
          
          const distance = calculateDistance(
            station.AddressInfo.Latitude,
            station.AddressInfo.Longitude,
            currentPosition.latitude,
            currentPosition.longitude
          );
          
          return distance <= 50; // 50km yarıçap
        })
        .map(station => ({
          station,
          distance: calculateDistance(
            station.AddressInfo?.Latitude || 0,
            station.AddressInfo?.Longitude || 0,
            currentPosition.latitude,
            currentPosition.longitude
          )
        }))
        .sort((a, b) => a.distance - b.distance);
      
      if (availableStations.length === 0) {
        const allStations = chargingStations.map(station => ({
          station,
          distance: calculateDistance(
            station.AddressInfo?.Latitude || 0,
            station.AddressInfo?.Longitude || 0,
            currentPosition.latitude,
            currentPosition.longitude
          )
        }));
        if (allStations.length > 0) {
          const nearest = allStations.sort((a, b) => a.distance - b.distance)[0];
          warnings.push(`⚠️ Uygun şarj istasyonu bulunamadı! En yakın istasyon: ${nearest.station.AddressInfo?.Title || 'Bilinmiyor'}, ${nearest.distance.toFixed(1)} km uzakta`);
          // 🚨 Her durumda bir şarj planı üret: En yakın istasyona kadar acil plan
          // 1. En yakın istasyona kadar kalan mesafeyi hesapla
          const distanceToNearest = nearest.distance;
          // 2. Enerji ihtiyacını hesapla (varsayım: düz yol, elevation yok)
          const energyNeeded = (selectedVehicle.consumption / 100) * distanceToNearest;
          const socDrop = (energyNeeded / selectedVehicle.batteryCapacity) * 100;
          const socAfter = currentBatteryPercent - socDrop;
          // 3. Şarj işlemi: mevcut SOC'den PREFERRED_SOC'ye kadar şarj
          const stationPowerKW = Math.max(...(nearest.station.Connections?.map(conn => conn.PowerKW || 0) || [0]));
          const { energy, duration } = calculateCharging(
            currentBatteryPercent,
            PREFERRED_SOC,
            selectedVehicle.batteryCapacity,
            stationPowerKW
          );
          const chargingStop = {
            stationId: nearest.station.ID,
            name: nearest.station.AddressInfo?.Title || `İstasyon ${nearest.station.ID}`,
            stopCoord: {
              latitude: nearest.station.AddressInfo?.Latitude || 0,
              longitude: nearest.station.AddressInfo?.Longitude || 0
            },
            distanceFromStartKm: Math.round(traveledDistanceKm + distanceToNearest),
            batteryBeforeStopPercent: Math.round(currentBatteryPercent),
            batteryAfterStopPercent: Math.round(PREFERRED_SOC),
            energyChargedKWh: energy,
            estimatedChargeTimeMinutes: duration,
            stationPowerKW: Math.round(stationPowerKW),
            connectorType: selectedVehicle.socketType,
            averageChargingPowerKW: Math.round(stationPowerKW * 0.92 * 10) / 10,
            chargingEfficiency: 92,
            segmentInfo: {
              segmentIndex: i + 1,
              distanceToNext: Math.max(0, routeDistanceKm - (traveledDistanceKm + distanceToNearest)),
              batteryAtSegmentEnd: Math.round(PREFERRED_SOC)
            }
          };
          chargingStops.push(chargingStop);
          warnings.push('Acil şarj planı: En yakın istasyona kadar şarj önerildi. Sonrasında manuel planlama gerekebilir.');
          return {
            chargingStops,
            totalChargingTimeMinutes: duration,
            canReachDestination: false,
            batteryAtDestinationPercent: socAfter,
            totalEnergyConsumedKWh: totalEnergyNeededKWh + energyNeeded,
            warnings,
            segmentDetails,
            chargingEfficiencyStats: {
              averageChargingPower: stationPowerKW,
              totalEnergyCharged: energy,
              chargingEfficiency: 92
            }
          };
        } else {
          warnings.push('Uygun şarj istasyonu bulunamadı! Alternatif rota önerilir.');
        }
        break;
      }
      
      const bestStation = availableStations[0].station;
      
      // Şarj kararı için güvenlik kontrolü
      const projectedSOC = socAfterSegment; // Bu durakta şarj başlangıç SOC'si
      let targetChargePercent = PREFERRED_SOC;
      
      // Eğer segment sonunda SOC düşük olacaksa, hedef SOC'yi yükselt
      if (projectedSOC < SAFETY_SOC) {
        targetChargePercent = PREFERRED_SOC;
        console.log(`⚠️ Segment ${i + 1} sonunda SOC %${projectedSOC.toFixed(1)} (<%${SAFETY_SOC}) olacak. Hedef SOC %${targetChargePercent} olarak ayarlandı.`);
      }
      
      // Şarj gerekliliği kontrolü
      const needsCharging = shouldCharge(
        projectedSOC,
        targetChargePercent,
        socAfterSegment,
        SAFETY_SOC,
        SOC_BUFFER
      );
      
      // Gerçek şarj enerjisi ve süresi hesapla
      const stationPowerKW = Math.max(...(bestStation.Connections?.map(conn => conn.PowerKW || 0) || [0]));
      
      if (needsCharging) {
        // Şarj işlemini projectedSOC'den başlat
        const { energy, duration } = calculateCharging(
          projectedSOC,
          targetChargePercent,
          selectedVehicle.batteryCapacity,
          stationPowerKW
        );
        
        // Şarj durağını ekle
        const chargingStop: ChargingStop = {
          stationId: bestStation.ID,
          name: bestStation.AddressInfo?.Title || `İstasyon ${bestStation.ID}`,
          stopCoord: {
            latitude: bestStation.AddressInfo?.Latitude || 0,
            longitude: bestStation.AddressInfo?.Longitude || 0
          },
          distanceFromStartKm: Math.max(0, Math.round(traveledDistanceKm)),
          batteryBeforeStopPercent: Math.round(projectedSOC),
          batteryAfterStopPercent: Math.round(targetChargePercent),
          energyChargedKWh: energy,
          estimatedChargeTimeMinutes: duration,
          stationPowerKW: Math.round(stationPowerKW),
          connectorType: selectedVehicle.socketType,
          averageChargingPowerKW: Math.round(stationPowerKW * 0.92 * 10) / 10,
          chargingEfficiency: 92,
          segmentInfo: {
            segmentIndex: i + 1,
            distanceToNext: Math.max(0, routeDistanceKm - traveledDistanceKm),
            batteryAtSegmentEnd: Math.round(targetChargePercent)
          }
        };
        chargingStops.push(chargingStop);
        usedStationIds.add(bestStation.ID);
        
        // Şarj sonrası güncelle
        logChargingStop({
          stopIndex: chargingStops.length,
          stationName: chargingStop.name,
          distance: chargingStop.distanceFromStartKm,
          startSOC: chargingStop.batteryBeforeStopPercent,
          endSOC: chargingStop.batteryAfterStopPercent,
          energy: chargingStop.energyChargedKWh,
          duration: chargingStop.estimatedChargeTimeMinutes,
          power: chargingStop.stationPowerKW,
          efficiency: 0.92
        });
        
        // Şarj sonrası SOC'yi güncelle
        currentBatteryPercent = targetChargePercent;
        currentBatteryKWh = (currentBatteryPercent / 100) * selectedVehicle.batteryCapacity;
      } else {
        warnings.push(`ℹ️ ${bestStation.AddressInfo?.Title || 'İstasyon'} durağında şarj yapılmadı (Projeksiyon: %${projectedSOC.toFixed(1)}, Hedef: %${targetChargePercent}, Segment Sonu: %${socAfterSegment.toFixed(1)}).`);
      }
      continue;
    }
    
    // Segmenti işle ve ilerle
    currentBatteryPercent = socAfterSegment;
    currentBatteryKWh = (currentBatteryPercent / 100) * selectedVehicle.batteryCapacity;
    traveledDistanceKm += segmentDistance;
    totalEnergyNeededKWh += energyForSegment;
  }
  
  // [4] 📊 Final hesaplamalar
  const totalChargingTimeMinutes = chargingStops.reduce((total, stop) => total + stop.estimatedChargeTimeMinutes, 0);
  const canReachDestination = currentBatteryPercent >= SAFETY_SOC;
  
  // Şarj verimliliği istatistikleri
  const totalEnergyCharged = chargingStops.reduce((total, stop) => total + stop.energyChargedKWh, 0);
  const totalNominalCharging = chargingStops.reduce((total, stop) =>
    total + (stop.stationPowerKW * (stop.estimatedChargeTimeMinutes / 60)), 0);
  const averageChargingPower = chargingStops.length > 0 ?
    chargingStops.reduce((total, stop) => total + stop.averageChargingPowerKW, 0) / chargingStops.length : 0;
  const overallChargingEfficiency = totalNominalCharging > 0 ? (totalEnergyCharged / totalNominalCharging) * 100 : 0;
  
  console.log('🏁 Şarj planı tamamlandı:', {
    canReachDestination,
    chargingStops: chargingStops.length,
    finalBattery: `${currentBatteryPercent.toFixed(1)}%`,
    totalChargingTime: `${totalChargingTimeMinutes}dk`,
    warnings: warnings.length
  });
  
  return {
    chargingStops,
    totalChargingTimeMinutes,
    canReachDestination,
    batteryAtDestinationPercent: Math.round(currentBatteryPercent),
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
 * 📖 Yardımcı Fonksiyonlar:
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

// --- Yardımcı: Gerçek şarj enerjisi ve süresi hesaplama ---
function calculateCharging(
  currentSOC: number,
  targetSOC: number,
  batteryCapacity: number,
  stationPower: number,
  efficiency = 0.92
) {
  const socDelta = targetSOC - currentSOC;
  if (socDelta <= 0) {
    return { energy: 0, duration: 0 };
  }
  const energyToCharge = batteryCapacity * (socDelta / 100); // kWh
  const chargingTimeMinutes = (energyToCharge / (stationPower * efficiency)) * 60; // dakika
  return {
    energy: parseFloat(energyToCharge.toFixed(2)),
    duration: Math.round(chargingTimeMinutes)
  };
}

function logChargingStop({
  stopIndex,
  stationName,
  distance,
  startSOC,
  endSOC,
  energy,
  duration,
  power,
  efficiency
}: {
  stopIndex: number;
  stationName: string;
  distance: number;
  startSOC: number;
  endSOC: number;
  energy: number;
  duration: number;
  power: number;
  efficiency: number;
}) {
  console.log(`  Durak ${stopIndex}: ${stationName}`);
  console.log(`    Mesafe: ${distance} km`);
  console.log(`    Batarya: %${startSOC} → %${endSOC}`);
  console.log(`    Şarj Enerjisi: ${energy} kWh`);
  console.log(`    Şarj Süresi: ${duration} dakika`);
  console.log(`    İstasyon Gücü: ${power} kW`);
  console.log(`    Verimlilik: %${efficiency * 100}`);
}

// --- Yardımcı: Şarj gerekliliği kontrolü ---
function shouldCharge(
  currentSOC: number,
  targetSOC: number,
  estimatedNextSOC: number,
  minSafeSOC: number = 20,
  buffer: number = 1
): boolean {
  const isLowAfterSegment = estimatedNextSOC < minSafeSOC;
  const notFullEnough = targetSOC - currentSOC > buffer;
  return isLowAfterSegment || notFullEnough;
} 