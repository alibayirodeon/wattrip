import { Vehicle } from '../context/useVehicleStore';
import { ChargingStation } from '../services/chargingStationService';
import { EnergyCalculator, generateBatteryWarnings, calculateTripStats, formatDuration } from '../lib/energyUtils';
import { calculateSegmentEnergy } from './energyCalculator';

// Add at the top of the file, after imports
function getLatLng(obj: any): { latitude: number; longitude: number } {
  if (!obj) throw new Error('No object provided to getLatLng');
  if ('latitude' in obj && 'longitude' in obj) {
    return { latitude: obj.latitude, longitude: obj.longitude };
  }
  if ('lat' in obj && 'lng' in obj) {
    return { latitude: obj.lat, longitude: obj.lng };
  }
  if ('Latitude' in obj && 'Longitude' in obj) {
    return { latitude: obj.Latitude, longitude: obj.Longitude };
  }
  throw new Error('Object does not have recognizable lat/lng properties');
}

// Haversine formula - iki koordinat arası mesafe hesaplama (km)
function calculateDistance(lat1: number | undefined, lon1: number | undefined, lat2: number | undefined, lon2: number | undefined): number {
  if (
    typeof lat1 !== 'number' || typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' || typeof lon2 !== 'number'
  ) return 0;
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
    station.AddressInfo?.Latitude ?? 0,
    station.AddressInfo?.Longitude ?? 0,
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
  elevationEffectKWh?: number;
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
  elevationEffectKWh?: number;
}

export interface TimelineEntry {
  segmentIndex: number;
  arrival: string;
  departure: string;
  note: string;
}

interface Route {
  segments: Array<{
    start: Location;
    end: Location;
    distance: number;
    duration: number;
    elevation: number;
  }>;
}

interface Location {
  lat: number;
  lng: number;
}

export interface ChargingPlanResult {
  canReachDestination: boolean;
  reason?: 'insufficientBattery' | 'noStationsInRange' | 'success';
  message?: string;
  nextPossibleStationList?: Array<{
    station: ChargingStation;
    distance: number;
    requiredBattery: number;
    power: number;
  }>;
  chargingStops: ChargingStop[];
  totalChargingTime: number;
  totalEnergyConsumed: number;
  timeline: TimelineEntry[];
  totalCost?: number;
  socGraph?: { label: string; SOC: number }[];
  warnings?: string[];
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
  startChargePercent = 50
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
    availableStations: chargingStations.length,
    initialSOC: `${startChargePercent}%`
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
      const segmentEnergyObj = calculateSegmentEnergyWithElevation(
        { distance_km: distance, elevation_diff_m: elevation },
        selectedVehicle,
        params
      );
      const energyForSegment = segmentEnergyObj.total;
      const elevationEffectKWh = segmentEnergyObj.elevation;
      segments.push(energyForSegment);
      segmentDetails.push({
        segmentIndex: i + 1,
        distanceKm: distance,
        energy: energyForSegment,
        socDrop: (energyForSegment / selectedVehicle.batteryCapacity) * 100,
        socAfter: currentBatteryPercent - (energyForSegment / selectedVehicle.batteryCapacity) * 100,
        elevationEffectKWh: typeof elevationEffectKWh === 'number' ? elevationEffectKWh : 0
      });
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
    
    // Güvenlik kontrolü
    if (typeof socAfterSegment === 'number' && socAfterSegment < SAFETY_SOC) {
      warnings.push(`⚠️ Segment ${i + 1} sonunda SOC %${socAfterSegment.toFixed(1)} (<%${SAFETY_SOC}) olacak. Ek şarj planlanıyor.`);
      
      // En uygun şarj istasyonunu bul
      const currentPosition = routeData.polylinePoints ? 
        routeData.polylinePoints[i] : 
        { lat: 0, lng: 0 };
      const currentPos = getLatLng(currentPosition);
      const availableStations = chargingStations
        .filter(station => {
          const info = station.AddressInfo;
          if (!info || typeof info.Latitude !== 'number' || typeof info.Longitude !== 'number') return false;
          if (usedStationIds.has(station.ID)) return false;
          const stationPos = getLatLng(info);
          const distance = calculateDistance(
            stationPos.latitude,
            stationPos.longitude,
            currentPos.latitude,
            currentPos.longitude
          );
          return distance <= 50; // 50km yarıçap
        })
        .map(station => {
          const info = station.AddressInfo!;
          const stationPos = getLatLng(info);
          const distance = calculateDistance(
            stationPos.latitude,
            stationPos.longitude,
            currentPos.latitude,
            currentPos.longitude
          );
          return { station, distance };
        })
        .sort((a, b) => a.distance - b.distance);
      
      if (availableStations.length === 0) {
        const allStations = chargingStations.map(station => {
          const info = station.AddressInfo;
          if (!info || typeof info.Latitude !== 'number' || typeof info.Longitude !== 'number') return { station, distance: Infinity };
          const stationPos = getLatLng(info);
          const distance = calculateDistance(
            stationPos.latitude,
            stationPos.longitude,
            currentPos.latitude,
            currentPos.longitude
          );
          return { station, distance };
        });
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
          const nearestInfo = nearest.station.AddressInfo!;
          const nearestPos = getLatLng(nearestInfo);
          const chargingStop = {
            stationId: nearest.station.ID,
            name: nearest.station.AddressInfo?.Title || `İstasyon ${nearest.station.ID}`,
            stopCoord: {
              latitude: nearestPos.latitude,
              longitude: nearestPos.longitude
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
            },
            elevationEffectKWh: 0
          };
          chargingStops.push(chargingStop);
          warnings.push('Acil şarj planı: En yakın istasyona kadar şarj önerildi. Sonrasında manuel planlama gerekebilir.');
          return {
            canReachDestination: false,
            reason: 'insufficientBattery',
            message: `Bu segmenti geçmek için en az %${Math.ceil((energyNeeded / selectedVehicle.batteryCapacity) * 100)} batarya gereklidir.`,
            nextPossibleStationList: [
              {
                station: nearest.station,
                distance: distanceToNearest,
                requiredBattery: Math.ceil((energyNeeded / selectedVehicle.batteryCapacity) * 100),
                power: Math.max(...(nearest.station.Connections?.map(conn => conn.PowerKW || 0) || [0]))
              }
            ],
            chargingStops,
            totalChargingTime: duration,
            totalEnergyConsumed: energyNeeded,
            timeline: []
          };
        } else {
          warnings.push('Uygun şarj istasyonu bulunamadı! Alternatif rota önerilir.');
        }
        break;
      }
      
      const bestStation = availableStations[0].station;
      const bestInfo = bestStation.AddressInfo!;
      const bestPos = getLatLng(bestInfo);
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
      const distanceToStation = calculateDistance(currentPos.latitude, currentPos.longitude, bestPos.latitude, bestPos.longitude);
      const energyNeeded = (selectedVehicle.consumption / 100) * distanceToStation;
      const socDrop = (energyNeeded / selectedVehicle.batteryCapacity) * 100;
      const socAfter = currentBatteryPercent - socDrop;
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
            latitude: bestPos.latitude,
            longitude: bestPos.longitude
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
          },
          elevationEffectKWh: 0
        };
        chargingStops.push(chargingStop);
        usedStationIds.add(bestStation.ID);
        
        // Şarj sonrası güncelle
        logChargingStop({
          stopIndex: chargingStops.length,
          stationName: chargingStop.name,
          stationId: chargingStop.stationId,
          distance: chargingStop.distanceFromStartKm,
          startSOC: chargingStop.batteryBeforeStopPercent,
          endSOC: chargingStop.batteryAfterStopPercent,
          energy: chargingStop.energyChargedKWh,
          duration: chargingStop.estimatedChargeTimeMinutes,
          power: chargingStop.stationPowerKW,
          efficiency: chargingStop.chargingEfficiency
        });
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
  
  // Zaman çizelgesi için segment sürelerini hazırla
  // Ortalama hız (km/h) ile tahmini sürüş süresi hesapla
  const AVERAGE_SPEED_KMH = 70;
  const timelineSegments = segmentDetails.map((seg, i) => {
    // Bu segmentte şarj var mı?
    const stop = chargingStops.find(s => s.segmentInfo?.segmentIndex === seg.segmentIndex);
    // Sürüş süresi = mesafe / hız
    const driveDurationMin = seg.distanceKm > 0 ? Math.round((seg.distanceKm / AVERAGE_SPEED_KMH) * 60) : 0;
    return {
      driveDurationMin,
      chargingDurationMin: stop ? stop.estimatedChargeTimeMinutes : 0
    };
  });
  const timeline = createTimeline(timelineSegments);
  
  console.log('🏁 Şarj planı tamamlandı:', {
    canReachDestination,
    chargingStops: chargingStops.length,
    finalBattery: `${currentBatteryPercent.toFixed(1)}%`,
    totalChargingTime: `${totalChargingTimeMinutes}dk`,
    warnings: warnings.length
  });
  
  return {
    canReachDestination,
    reason: 'success',
    chargingStops,
    totalChargingTime: totalChargingTimeMinutes,
    totalEnergyConsumed: Math.round(totalEnergyNeededKWh * 10) / 10,
    timeline
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
      totalChargingTime: `${Math.floor(plan.totalChargingTime / 60)}s ${plan.totalChargingTime % 60}dk`,
      canReach: plan.canReachDestination,
      totalEnergy: `${plan.totalEnergyConsumed}kWh`,
      hasWarnings: !!plan.message
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
    warnings: plan.message ? [plan.message] : []
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
  stationId,
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
  stationId: number;
  distance: number;
  startSOC: number;
  endSOC: number;
  energy: number;
  duration: number;
  power: number;
  efficiency: number;
}) {
  console.log(`
🔋 Şarj Durağı #${stopIndex}`);
  console.log(`  📍 İstasyon: ${stationName} (ID: ${stationId})`);
  console.log(`  📏 Mesafe: ${distance} km`);
  console.log(`  🔋 Batarya: %${startSOC} → %${endSOC}`);
  console.log(`  ⚡ Alınan Enerji: ${energy} kWh (Hedef: %${endSOC})`);
  console.log(`  ⏱️ Şarj Süresi: ${duration} dakika`);
  console.log(`  ⚡ İstasyon Gücü: ${power} kW | Verimlilik: %${efficiency * 100}`);
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

/**
 * 🚦 Segment bazlı zaman çizelgesi oluşturur
 * @param segments { driveDurationMin: number, chargingDurationMin?: number }[]
 * @param startDate Date (varsayılan: new Date())
 * @returns { segmentIndex, arrival, departure, note }[]
 */
export function createTimeline(
  segments: { driveDurationMin: number; chargingDurationMin?: number }[],
  startDate: Date = new Date()
) {
  let current = new Date(startDate);
  return segments.map((seg, i) => {
    const arrival = new Date(current);
    let note = 'Şarj yok';
    if (seg.chargingDurationMin && seg.chargingDurationMin > 0) {
      note = `${seg.chargingDurationMin} dk şarj`;
    }
    // Sürüş süresi ekle
    current = new Date(current.getTime() + seg.driveDurationMin * 60000);
    // Şarj süresi ekle (varsa)
    if (seg.chargingDurationMin && seg.chargingDurationMin > 0) {
      current = new Date(current.getTime() + seg.chargingDurationMin * 60000);
    }
    const departure = new Date(current);
    return {
      segmentIndex: i + 1,
      arrival: arrival.toTimeString().slice(0, 5),
      departure: departure.toTimeString().slice(0, 5),
      note
    };
  });
}

// --- Örnek kullanım ---
// const segments = [
//   { driveDurationMin: 45, chargingDurationMin: 20 },
//   { driveDurationMin: 60 },
//   { driveDurationMin: 30, chargingDurationMin: 15 }
// ];
// const timeline = createTimeline(segments);
// console.log(timeline);
// Çıktı: [{ segmentIndex, arrival, departure, note }, ...]

export function optimizeChargingPlan(
  route: Route,
  vehicle: Vehicle,
  startChargePercent: number = 50,
  targetChargePercent: number = 70,
  maxChargingStops: number = 10,
  chargingStations: ChargingStation[] = []
): ChargingPlanResult {
  const minSOC = 15;
  const maxSOC = 80;
  let currentSOC = startChargePercent;
  let currentPosition = route.segments[0].start;
  let chargingStops: any[] = [];
  let canReach = false;
  let warnings: string[] = [];
  let socTimeline: { label: string; SOC: number }[] = [{ label: 'Start', SOC: currentSOC }];
  let totalEnergy = 0;
  let totalTime = 0;
  let totalCost = 0;
  let rejectionReason: 'insufficientBattery' | 'noStationsInRange' | undefined = undefined;
  let segmentIndex = 0;

  while (!canReach && chargingStops.length < maxChargingStops) {
    // 1. Kalan menzili ve segmenti hesapla
    const maxRangeKm = (currentSOC / 100) * vehicle.batteryCapacity / vehicle.consumption * 100;
    // 2. O menzildeki en uygun istasyonu bul
    const currentPos = getLatLng(currentPosition);
    const reachableStations = chargingStations.filter(station => {
      const dist = calculateDistance(
        currentPos.latitude,
        currentPos.longitude,
        typeof station.AddressInfo?.Latitude === 'number' ? station.AddressInfo.Latitude : 0,
        typeof station.AddressInfo?.Longitude === 'number' ? station.AddressInfo.Longitude : 0
      );
      return dist <= maxRangeKm;
    });
    if (reachableStations.length === 0) {
      // Ulaşılamazsa öneri ve çıkış
      rejectionReason = 'noStationsInRange';
      return {
        canReachDestination: false,
        reason: 'noStationsInRange',
        message: 'Menzilde istasyon yok',
        nextPossibleStationList: chargingStations.slice(0, 3).map(station => ({
          station,
          distance: calculateDistance(currentPos.latitude, currentPos.longitude, station.AddressInfo?.Latitude ?? 0, station.AddressInfo?.Longitude ?? 0),
          requiredBattery: 0,
          power: Math.max(...(station.Connections?.map(conn => conn.PowerKW || 0) || [0]))
        })),
        chargingStops: chargingStops,
        totalChargingTime: totalTime,
        totalEnergyConsumed: totalEnergy,
        timeline: [],
        totalCost,
        socGraph: socTimeline,
        warnings
      };
    }
    // En iyi istasyonu seç (ör: en yakın)
    const bestStation = reachableStations[0];
    const lat = typeof bestStation.AddressInfo?.Latitude === 'number' ? bestStation.AddressInfo.Latitude : 0;
    const lng = typeof bestStation.AddressInfo?.Longitude === 'number' ? bestStation.AddressInfo.Longitude : 0;
    const distanceToStation = calculateDistance(currentPos.latitude, currentPos.longitude, lat, lng);
    const energyNeeded = (vehicle.consumption / 100) * distanceToStation;
    const socDrop = (energyNeeded / vehicle.batteryCapacity) * 100;
    const segmentEndSOC = currentSOC - socDrop;
    const driveTime = Math.round((distanceToStation / 70) * 60); // 70 km/h
    if (segmentEndSOC < minSOC) {
      warnings.push(`Segment ${segmentIndex + 1} sonunda SOC %${segmentEndSOC.toFixed(1)}'ye düşüyor`);
    }
    // Şarj işlemi: hedef SOC %70-80
    const chargeTargetSOC = Math.min(maxSOC, targetChargePercent + 10);
    const energyToAdd = vehicle.batteryCapacity * ((chargeTargetSOC - segmentEndSOC) / 100);
    const powerKW = Math.max(...(bestStation.Connections?.map(conn => conn.PowerKW || 0) || [22]));
    const chargeTime = Math.round((energyToAdd / (powerKW * 0.92)) * 60); // %92 verimlilik
    const pricePerKWh = (bestStation && ((bestStation as any).pricePerKWh || (bestStation as any).CustomFields?.pricePerKWh || (bestStation as any).price || (bestStation as any).PricePerKWh)) || 7.99;
    const stopCost = +(energyToAdd * pricePerKWh).toFixed(2);
    chargingStops.push({
      station: bestStation,
      stationId: bestStation.ID,
      socBefore: Math.round(segmentEndSOC),
      socAfter: Math.round(chargeTargetSOC),
      energyAdded: +energyToAdd.toFixed(2),
      chargeTime,
      driveTime,
      chargeCost: stopCost,
      pricePerKWh,
      stopPower: powerKW
    });
    socTimeline.push({ label: `Şarj ${chargingStops.length} Öncesi`, SOC: Math.round(segmentEndSOC) });
    socTimeline.push({ label: `Şarj ${chargingStops.length} Sonrası`, SOC: Math.round(chargeTargetSOC) });
    totalEnergy += energyToAdd;
    totalTime += chargeTime + driveTime;
    totalCost += stopCost;
    currentSOC = chargeTargetSOC;
    currentPosition = { lat, lng };
    segmentIndex++;
    // Hedefe ulaşım kontrolü (ör: kalan mesafe < 10km ise bitir)
    const destPos = getLatLng(route.segments[route.segments.length - 1].end);
    const distanceToDest = calculateDistance(currentPos.latitude, currentPos.longitude, destPos.latitude, destPos.longitude);
    if (distanceToDest < 10) {
      canReach = true;
      socTimeline.push({ label: 'Finish', SOC: Math.round(currentSOC) });
      break;
    }
  }
  return {
    canReachDestination: canReach,
    reason: canReach ? 'success' : (rejectionReason ?? 'insufficientBattery'),
    message: warnings.join('\n'),
    chargingStops: chargingStops,
    totalChargingTime: totalTime,
    totalEnergyConsumed: totalEnergy,
    timeline: [],
    totalCost,
    socGraph: socTimeline,
    warnings
  };
}

// Segment enerji hesaplamasında düz yol ve eğim etkisini ayır
function calculateSegmentEnergyWithElevation(segment: any, vehicle: any, params?: any) {
  // Düz yol tüketimi (kWh)
  const flatConsumptionKWh = (vehicle.consumption / 100) * segment.distance_km;
  // Yükselti etkisi (kWh)
  const mass = vehicle.weight;
  const g = 9.81;
  const h = segment.elevation_diff_m;
  const elevationEnergyKWh = (mass * g * h) / 3_600_000;
  let elevationEffectKWh = 0;
  if (h > 0) {
    elevationEffectKWh = elevationEnergyKWh;
  } else if (h < 0) {
    const regenEfficiency = vehicle.regenEfficiency || 0.6;
    elevationEffectKWh = elevationEnergyKWh * regenEfficiency;
  }
  return {
    total: flatConsumptionKWh + elevationEffectKWh,
    flat: flatConsumptionKWh,
    elevation: elevationEffectKWh
  };
}

/**
 * Başlangıç SOC yetersizse en yakın istasyonu plana dahil ederek rota planlar.
 * 1. İlk istasyona ulaşım kontrolü yapılır.
 * 2. Ulaşılamıyorsa, en yakın istasyona kadar kısa bir segment ve şarj planı oluşturulur.
 * 3. Orada %80'e kadar şarj edilir.
 * 4. Asıl rota, bu istasyondan ve yeni SOC ile tekrar planlanır.
 * 5. Sonuçta tüm şarj durakları ve segmentler tek bir ChargingPlanResult olarak döner.
 */
export function planRouteWithInitialCharging({
  selectedVehicle,
  routeData,
  chargingStations,
  startChargePercent = 50
}: {
  selectedVehicle: Vehicle;
  routeData: RouteData;
  chargingStations: ChargingStation[];
  startChargePercent?: number;
}): ChargingPlanResult {
  // 1. İlk istasyona ulaşım kontrolü
  const SAFETY_MARGIN_KWH = 2;
  const points = routeData.polylinePoints;
  if (!points || points.length < 2) {
    return generateChargingPlan({ selectedVehicle, routeData, chargingStations, startChargePercent });
  }
  // İlk istasyonları bul
  const firstStations = chargingStations
    .map(station => {
      const info = station.AddressInfo;
      const point0 = getLatLng(points[0]);
      const lat = typeof info?.Latitude === 'number' ? info.Latitude : 0;
      const lng = typeof info?.Longitude === 'number' ? info.Longitude : 0;
      const distance = calculateDistance(point0.latitude, point0.longitude, lat, lng);
      return { station, distance };
    })
    .filter((item): item is { station: ChargingStation; distance: number } => !!item)
    .sort((a, b) => a.distance - b.distance);
  if (!firstStations.length) {
    return generateChargingPlan({ selectedVehicle, routeData, chargingStations, startChargePercent });
  }
  const firstStation = firstStations[0]!.station;
  const addressInfo = firstStation.AddressInfo;
  if (!addressInfo || typeof addressInfo.Latitude !== 'number' || typeof addressInfo.Longitude !== 'number') {
    return generateChargingPlan({ selectedVehicle, routeData, chargingStations, startChargePercent });
  }
  const distanceToFirstStation = firstStations[0]!.distance;
  const availableEnergy = (startChargePercent / 100) * selectedVehicle.batteryCapacity;
  const energyNeeded = (selectedVehicle.consumption / 100) * distanceToFirstStation;
  if (availableEnergy >= energyNeeded + SAFETY_MARGIN_KWH) {
    // İlk istasyona ulaşılabiliyor, normal planla
    return generateChargingPlan({ selectedVehicle, routeData, chargingStations, startChargePercent });
  }
  // 2. Başlangıç → ilk istasyon segmenti oluştur
  const segmentToStation = {
    ...routeData,
    polylinePoints: [points[0], { latitude: addressInfo.Latitude, longitude: addressInfo.Longitude }],
    distance: distanceToFirstStation * 1000 // metre
  };
  // 3. Bu segment için şarj planı (sadece ilk istasyon)
  const planToStation = generateChargingPlan({
    selectedVehicle,
    routeData: segmentToStation,
    chargingStations: [firstStation],
    startChargePercent
  });
  // 4. İlk istasyonda %80'e kadar şarj et
  const newSOC = 80;
  // 5. Asıl rotayı, bu istasyondan ve yeni SOC ile planla
  const restOfRoute = {
    ...routeData,
    polylinePoints: [{ latitude: addressInfo.Latitude, longitude: addressInfo.Longitude }, ...points.slice(1)],
    // distance güncellenebilir, ancak segment bazlı enerji hesaplaması varsa polylinePoints yeterli
  };
  const planMainRoute = generateChargingPlan({
    selectedVehicle,
    routeData: restOfRoute,
    chargingStations,
    startChargePercent: newSOC
  });
  // 6. Planları birleştir
  return {
    canReachDestination: planToStation.canReachDestination && planMainRoute.canReachDestination,
    reason: planToStation.canReachDestination && planMainRoute.canReachDestination ? 'success' : (planToStation.reason || planMainRoute.reason),
    chargingStops: [...planToStation.chargingStops, ...planMainRoute.chargingStops],
    totalChargingTime: planToStation.totalChargingTime + planMainRoute.totalChargingTime,
    totalEnergyConsumed: planToStation.totalEnergyConsumed + planMainRoute.totalEnergyConsumed,
    timeline: [...planToStation.timeline, ...planMainRoute.timeline],
    message: planToStation.canReachDestination ? 'Yola çıkmadan önce ilk istasyonda şarj etmeniz önerilir.' : planToStation.message
  };
}

/**
 * 🚀 Gelişmiş Çoklu Durağa Uyumlu, SOC Güvenlikli, Maliyetli Şarj Planlayıcı (ABRP tarzı)
 * - 6-10+ durak destekler
 * - SOC güvenlik eşiği ve segment uyarıları
 * - Toplam maliyet ve süre hesaplar
 * - SOC ilerleme dizisi ve özet kart verisi üretir
 * - Ulaşılamayan segment logic içerir
 */
export function generateAdvancedChargingPlan({
  selectedVehicle,
  routeData,
  chargingStations,
  segmentEnergies,
  startChargePercent = 50,
  minSOCThreshold = 15,
  targetSOC = 80,
  maxStops = 10,
  pricePerKWhDefault = 7.99
}: {
  selectedVehicle: Vehicle;
  routeData: RouteData;
  chargingStations: ChargingStation[];
  segmentEnergies?: number[];
  startChargePercent?: number;
  minSOCThreshold?: number;
  targetSOC?: number;
  maxStops?: number;
  pricePerKWhDefault?: number;
}): ChargingPlanResult {
  const batteryCapacity = selectedVehicle.batteryCapacity;
  const consumption = selectedVehicle.consumption;
  const totalDistanceKm = routeData.distance / 1000;
  const segments = segmentEnergies && segmentEnergies.length > 0
    ? segmentEnergies
    : [consumption * (totalDistanceKm / 100)];

  let currentSOC = startChargePercent;
  let traveledDistance = 0;
  let stops: any[] = [];
  let warnings: string[] = [];
  let socGraph: { label: string; SOC: number }[] = [{ label: 'Start', SOC: currentSOC }];
  let totalCost = 0;
  let totalTripMinutes = 0;
  let canReach = true;
  let rejectionReason: 'insufficientBattery' | 'noStationsInRange' | undefined = undefined;

  for (let i = 0; i < segments.length && stops.length < maxStops; i++) {
    const segmentDistance = (totalDistanceKm / segments.length);
    const segmentEnergy = segments[i];
    const socDrop = (segmentEnergy / batteryCapacity) * 100;
    const segmentEndSOC = currentSOC - socDrop;
    const driveTime = Math.round((segmentDistance / 70) * 60); // 70 km/h ortalama hız
    let chargeTime = 0;
    let energyAdded = 0;
    let stopSOCBefore = segmentEndSOC;
    let stopSOCAfter = segmentEndSOC;
    let stopCost = 0;
    let stopName = '';
    let stopId = 0;
    let stopPower = 0;

    // SOC güvenlik kontrolü
    if (segmentEndSOC < minSOCThreshold) {
      // En yakın istasyonu bul
      const currentPosition = routeData.polylinePoints ? 
        routeData.polylinePoints[i] : 
        { lat: 0, lng: 0 };
      const currentPos = getLatLng(currentPosition);
      const reachableStations = chargingStations.filter(station => {
        const dist = calculateDistance(
          currentPos.latitude,
          currentPos.longitude,
          typeof station.AddressInfo?.Latitude === 'number' ? station.AddressInfo.Latitude : 0,
          typeof station.AddressInfo?.Longitude === 'number' ? station.AddressInfo.Longitude : 0
        );
        return dist < segmentDistance * 1.2; // segment mesafesinin %20 fazlası menzil
      });
      if (reachableStations.length === 0) {
        canReach = false;
        rejectionReason = 'noStationsInRange';
        warnings.push(`⚠️ Segment ${i+1}: Batarya çok düşük, menzilde istasyon yok!`);
        break;
      }
      // En yakın istasyonu seç
      const bestStation = reachableStations[0];
      stopName = typeof bestStation.AddressInfo?.Title === 'string' ? bestStation.AddressInfo.Title : 'Şarj İstasyonu';
      stopId = bestStation.ID;
      stopPower = Math.max(...(bestStation.Connections?.map(conn => conn.PowerKW || 0) || [22]));
      // Hedef SOC'ye kadar şarj et
      energyAdded = batteryCapacity * ((targetSOC - segmentEndSOC) / 100);
      chargeTime = Math.round((energyAdded / (stopPower * 0.92)) * 60); // %92 verimlilik
      stopSOCBefore = segmentEndSOC;
      stopSOCAfter = targetSOC;
      // Fiyatı istasyondan al, yoksa default
      const pricePerKWh = (bestStation && ((bestStation as any).pricePerKWh || (bestStation as any).CustomFields?.pricePerKWh || (bestStation as any).price || (bestStation as any).PricePerKWh)) || pricePerKWhDefault;
      stopCost = +(energyAdded * pricePerKWh).toFixed(2);
      totalCost += stopCost;
      totalTripMinutes += chargeTime + driveTime;
      stops.push({
        station: stopName,
        stationId: stopId,
        socBefore: Math.round(stopSOCBefore),
        socAfter: Math.round(stopSOCAfter),
        energyAdded: +energyAdded.toFixed(2),
        chargeTime,
        chargeCost: stopCost,
        driveTime,
        stopPower
      });
      socGraph.push({ label: `Stop ${stops.length} (before)`, SOC: Math.round(stopSOCBefore) });
      socGraph.push({ label: `Stop ${stops.length} (after)`, SOC: Math.round(stopSOCAfter) });
      currentSOC = targetSOC;
    } else {
      // Şarj gerekmez, sadece sürüş
      totalTripMinutes += driveTime;
      socGraph.push({ label: `Segment ${i+1} End`, SOC: Math.round(segmentEndSOC) });
      currentSOC = segmentEndSOC;
    }
    traveledDistance += segmentDistance;
    // Segment sonunda SOC çok düşükse uyarı
    if (segmentEndSOC < minSOCThreshold) {
      warnings.push(`⚠️ Segment ${i+1} sonunda SOC çok düşük: %${Math.round(segmentEndSOC)}`);
    }
  }
  // Finish noktası
  socGraph.push({ label: 'Finish', SOC: Math.round(currentSOC) });
  return {
    canReachDestination: canReach,
    reason: canReach ? 'success' : (rejectionReason ?? 'insufficientBattery'),
    message: warnings.join('\n'),
    chargingStops: stops,
    totalChargingTime: stops.reduce((sum, s) => sum + s.chargeTime, 0),
    totalEnergyConsumed: stops.reduce((sum, s) => sum + s.energyAdded, 0),
    timeline: [],
    totalCost,
    socGraph
  };
} 