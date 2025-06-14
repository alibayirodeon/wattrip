/**
 * 🔋 EV Energy & Charging Utilities
 * ABRP-style advanced calculations for WatTrip
 */

export interface EnergyCalculation {
  energyKWh: number;
  socPercent: number;
  rangeKm: number;
}

export interface ChargingSession {
  startSOC: number;
  endSOC: number;
  energyAddedKWh: number;
  chargingTimeMinutes: number;
  chargerPowerKW: number;
  averageChargingPowerKW: number; // Gerçek ortalama şarj gücü
}

export interface SegmentSOC {
  segmentIndex: number;
  startSOC: number;
  endSOC: number;
  distanceKm: number;
  energyConsumedKWh: number;
  description: string;
}

// 🚗 Rota ve Şarj Planlama için yeni interface'ler
export interface RouteSegment {
  segmentIndex: number;
  distanceKm: number;
  cumulativeDistanceKm: number;
}

export interface ChargingStation {
  name: string;
  lat: number;
  lng: number;
  powerKW: number;
  distanceFromStartKm?: number;
}

export interface ChargingStop {
  stationName: string;
  distanceFromStartKm: number;
  entrySOC: number;
  exitSOC: number;
  energyAddedKWh: number;
  chargingTimeMinutes: number;
  stationPowerKW: number;
}

export interface RoutePlanResult {
  chargingStops: ChargingStop[];
  finalSOC: number;
  canReachDestination: boolean;
  totalChargingTime: number;
  totalEnergyConsumed: number;
  warnings: string[];
}

/**
 * 🔋 SOC (State of Charge) hesaplamaları
 */
export class EnergyCalculator {
  constructor(
    private batteryCapacityKWh: number,
    private consumptionKWhPer100km: number
  ) {}

  /**
   * Enerji miktarından SOC hesapla
   */
  energyToSOC(energyKWh: number): number {
    return Math.min(100, Math.max(0, (energyKWh / this.batteryCapacityKWh) * 100));
  }

  /**
   * SOC'dan enerji miktarı hesapla
   */
  socToEnergy(socPercent: number): number {
    return (socPercent / 100) * this.batteryCapacityKWh;
  }

  /**
   * Mesafe için gerekli enerji hesapla
   */
  calculateEnergyForDistance(distanceKm: number): number {
    return (distanceKm * this.consumptionKWhPer100km) / 100;
  }

  /**
   * SOC'dan menzil hesapla
   */
  calculateRange(socPercent: number): number {
    const energyKWh = this.socToEnergy(socPercent);
    return (energyKWh * 100) / this.consumptionKWhPer100km;
  }

  /**
   * Mesafe için gereken enerji tüketimini hesapla (kWh)
   * Alias for calculateEnergyForDistance for consistency
   */
  distanceToEnergyConsumption(distanceKm: number | undefined | null): number {
    // Tip kontrolü ve varsayılan değer
    const safeDistance = typeof distanceKm === 'number' && !isNaN(distanceKm) 
      ? Math.max(0, distanceKm) 
      : 0;
    
    return this.calculateEnergyForDistance(safeDistance);
  }

  /**
   * SOC'dan menzil hesapla (km)
   * Alias for calculateRange for consistency
   */
  socToRange(socPercent: number | undefined | null): number {
    // Tip kontrolü ve varsayılan değer
    const safeSOC = typeof socPercent === 'number' && !isNaN(socPercent)
      ? Math.max(0, Math.min(100, socPercent))
      : 0;
    
    return this.calculateRange(safeSOC);
  }

  /**
   * Segment bazlı SOC düşüşü hesapla
   * @param startSOC Başlangıç SOC değeri (%)
   * @param distanceKm Segment mesafesi (km)
   * @param segmentIndex Segment indeksi (opsiyonel)
   * @returns SegmentSOC objesi
   */
  calculateSegmentSOC(
    startSOC: number,
    distanceKm: number | undefined | null,
    segmentIndex: number = 0
  ): SegmentSOC {
    // distanceKm için güvenli dönüşüm ve varsayılan değer
    const safeDistanceKm = typeof distanceKm === 'number' && !isNaN(distanceKm) 
      ? distanceKm 
      : 0;

    // Enerji hesaplamaları
    const energyConsumed = this.calculateEnergyForDistance(safeDistanceKm);
    const socDrop = this.energyToSOC(energyConsumed);
    const endSOC = Math.max(0, startSOC - socDrop);

    // Güvenli string formatlaması
    const formattedDistance = safeDistanceKm.toFixed(1);
    const formattedSocDrop = socDrop.toFixed(1);

    return {
      segmentIndex,
      startSOC,
      endSOC,
      distanceKm: safeDistanceKm,
      energyConsumedKWh: energyConsumed,
      description: `Segment ${segmentIndex + 1}: ${formattedDistance}km → ${formattedSocDrop}% SOC drop`
    };
  }
}

/**
 * 🚗 Gelişmiş Rota ve Şarj Planlama Fonksiyonu
 * Segment bazlı enerji tüketimi ve otomatik şarj durakları
 */
export function planRouteWithCharging(
  routeSegments: number[], // Her segmentin mesafesi (km)
  startSOC: number, // Başlangıç batarya %
  targetSOC: number, // Minimum varış batarya %
  batteryCapacity: number, // Batarya kapasitesi (kWh)
  consumptionPer100km: number, // Enerji tüketimi (kWh/100km)
  stations: ChargingStation[] // Şarj istasyonları
): RoutePlanResult {
  
  const energyCalc = new EnergyCalculator(batteryCapacity, consumptionPer100km);
  const chargingStops: ChargingStop[] = [];
  const warnings: string[] = [];
  
  let currentSOC = startSOC;
  let cumulativeDistance = 0;
  let totalChargingTime = 0;
  let totalEnergyConsumed = 0;

  console.log(`🚗 Route planning started: ${routeSegments.length} segments, ${startSOC}% → ${targetSOC}%`);

  // Her segment için planlama yap
  for (let i = 0; i < routeSegments.length; i++) {
    const segmentDistance = routeSegments[i];
    const segmentEnergy = energyCalc.calculateEnergyForDistance(segmentDistance);
    const segmentSOCDrop = energyCalc.energyToSOC(segmentEnergy);
    
    console.log(`📍 Segment ${i + 1}: ${segmentDistance}km, ${segmentSOCDrop.toFixed(1)}% SOC drop`);
    
    // Bu segmenti tamamladıktan sonraki SOC
    const socAfterSegment = currentSOC - segmentSOCDrop;
    cumulativeDistance += segmentDistance;
    totalEnergyConsumed += segmentEnergy;

    // Eğer SOC çok düşükse şarj gerekli
    const remainingDistance = routeSegments.slice(i + 1).reduce((sum, dist) => sum + dist, 0);
    const energyNeededForRemaining = energyCalc.calculateEnergyForDistance(remainingDistance);
    const socNeededForRemaining = energyCalc.energyToSOC(energyNeededForRemaining);
    const requiredSOC = socNeededForRemaining + targetSOC; // Hedef + kalan yol

    console.log(`🔋 After segment: SOC ${socAfterSegment.toFixed(1)}%, Required: ${requiredSOC.toFixed(1)}%`);

    // Şarj gerekli mi kontrol et
    if (socAfterSegment < requiredSOC && remainingDistance > 0) {
      console.log(`⚡ Charging needed! Current: ${socAfterSegment.toFixed(1)}%, Required: ${requiredSOC.toFixed(1)}%`);
      
      // En yakın istasyonu bul
      const nearbyStations = stations
        .map(station => ({
          ...station,
          distanceFromCurrentPoint: Math.abs((station.distanceFromStartKm || 0) - cumulativeDistance)
        }))
        .filter(station => station.distanceFromCurrentPoint <= 50) // 50km yarıçap
        .sort((a, b) => a.distanceFromCurrentPoint - b.distanceFromCurrentPoint);

      if (nearbyStations.length === 0) {
        warnings.push(`⚠️ No charging stations within 50km at ${cumulativeDistance}km`);
        continue;
      }

      const selectedStation = nearbyStations[0];
      
      // Şarj miktarını hesapla (%80 sınırı)
      const maxSOC = 80;
      const targetChargeSOC = Math.min(maxSOC, requiredSOC + 10); // 10% buffer
      const energyToAdd = energyCalc.socToEnergy(targetChargeSOC - socAfterSegment);
      
      // Şarj süresi hesapla (gerçek şarj eğrisi)
      const chargingTime = calculateAdvancedChargeTime(
        energyCalc,
        socAfterSegment,
        targetChargeSOC,
        selectedStation.powerKW,
        {
          ambientTemp: 20,
          batteryCondition: 'good',
          chargingStrategy: 'balanced'
        }
      );

      const chargingStop: ChargingStop = {
        stationName: selectedStation.name,
        distanceFromStartKm: selectedStation.distanceFromStartKm || cumulativeDistance,
        entrySOC: socAfterSegment,
        exitSOC: targetChargeSOC,
        energyAddedKWh: energyToAdd,
        chargingTimeMinutes: chargingTime.chargingTimeMinutes,
        stationPowerKW: selectedStation.powerKW
      };

      chargingStops.push(chargingStop);
      totalChargingTime += chargingTime.chargingTimeMinutes;
      currentSOC = targetChargeSOC;

      console.log(`🔌 Added charging stop: ${selectedStation.name}`);
      console.log(`   Entry: ${socAfterSegment.toFixed(1)}% → Exit: ${targetChargeSOC.toFixed(1)}%`);
      console.log(`   Energy: ${energyToAdd.toFixed(1)}kWh, Time: ${chargingTime.chargingTimeMinutes}min`);
    } else {
      // Şarj gerekmiyorsa SOC'u güncelle
      currentSOC = socAfterSegment;
    }
  }

  const canReachDestination = currentSOC >= targetSOC;
  
  if (!canReachDestination) {
    warnings.push(`❌ Cannot reach destination! Final SOC: ${currentSOC.toFixed(1)}%, Target: ${targetSOC}%`);
  }

  // Ensure currentSOC is a valid number
  const finalSOC = typeof currentSOC === 'number' ? currentSOC : 0;

  const result: RoutePlanResult = {
    chargingStops,
    finalSOC,
    canReachDestination,
    totalChargingTime,
    totalEnergyConsumed,
    warnings
  };

  console.log(`🏁 Route planning completed:`);
  console.log(`   Final SOC: ${finalSOC.toFixed(1)}%`);
  console.log(`   Charging stops: ${chargingStops.length}`);
  console.log(`   Total charging time: ${totalChargingTime}min`);
  console.log(`   Can reach destination: ${canReachDestination}`);

  return result;
}

/**
 * 🔋 Gelişmiş şarj süresi hesaplama
 * SOC'ye bağlı şarj eğrisi kullanır
 */
export function calculateAdvancedChargeTime(
  energyCalc: EnergyCalculator,
  startSOC: number,
  targetSOC: number,
  chargerPowerKW: number,
  conditions: {
    ambientTemp?: number;
    batteryCondition?: 'excellent' | 'good' | 'average' | 'poor';
    chargingStrategy?: 'fast' | 'balanced' | 'gentle';
  } = {}
): ChargingSession {
  
  const {
    ambientTemp = 20,
    batteryCondition = 'good',
    chargingStrategy = 'balanced'
  } = conditions;

  // SOC bazlı şarj gücü multiplier'ı
  const getSOCMultiplier = (soc: number): number => {
    if (soc < 20) return 0.95; // Soğuk batarya
    if (soc < 40) return 1.0;  // Optimum
    if (soc < 60) return 0.98; // İyi
    if (soc < 75) return 0.85; // Yavaşlamaya başlıyor
    if (soc < 85) return 0.65; // Belirgin yavaşlama
    return 0.35; // Çok yavaş (80%+)
  };

  // Sıcaklık etkisi
  const tempMultiplier = ambientTemp < 0 ? 0.7 : 
                        ambientTemp < 10 ? 0.85 : 
                        ambientTemp > 35 ? 0.9 : 1.0;

  // Batarya durumu etkisi
  const conditionMultiplier = {
    excellent: 1.0,
    good: 0.95,
    average: 0.85,
    poor: 0.7
  }[batteryCondition];

  // Strateji etkisi
  const strategyMultiplier = {
    fast: 1.0,
    balanced: 0.9,
    gentle: 0.75
  }[chargingStrategy];

  // Ortalama şarj gücü hesapla
  const avgSOC = (startSOC + targetSOC) / 2;
  const socMultiplier = getSOCMultiplier(avgSOC);
  
  const effectivePower = chargerPowerKW * 
                        socMultiplier * 
                        tempMultiplier * 
                        conditionMultiplier * 
                        strategyMultiplier;

  // Enerji ve süre hesapla
  const energyToAdd = energyCalc.socToEnergy(targetSOC - startSOC);
  const chargingTimeHours = energyToAdd / effectivePower;
  const chargingTimeMinutes = Math.ceil(chargingTimeHours * 60);

  return {
    startSOC,
    endSOC: targetSOC,
    energyAddedKWh: energyToAdd,
    chargingTimeMinutes,
    chargerPowerKW: chargerPowerKW,
    averageChargingPowerKW: effectivePower
  };
}

/**
 * 🚨 Batarya uyarıları
 */
export function generateBatteryWarnings(
  finalSOC: number,
  chargingStops: any[],
  routeDistanceKm: number
): string[] {
  const warnings: string[] = [];

  // Kritik seviye uyarısı
  if (finalSOC < 10) {
    warnings.push(`🚨 Varışta batarya seviyesi çok düşük: %${finalSOC.toFixed(1)}`);
  } else if (finalSOC < 15) {
    warnings.push(`⚠️ Varışta batarya seviyesi düşük: %${finalSOC.toFixed(1)}`);
  }

  // Çok fazla şarj durağı uyarısı
  if (chargingStops.length > 4) {
    warnings.push(`🔄 Çok fazla şarj durağı: ${chargingStops.length} durak`);
  }

  // Uzun şarj süresi uyarısı
  const totalChargeTime = chargingStops.reduce((total, stop) => 
    total + (stop.estimatedChargeTimeMinutes || 0), 0
  );
  if (totalChargeTime > 120) { // 2 saatten fazla
    warnings.push(`⏰ Toplam şarj süresi uzun: ${Math.round(totalChargeTime / 60)}s ${totalChargeTime % 60}dk`);
  }

  return warnings;
}

/**
 * 📊 Yolculuk istatistikleri
 */
export function calculateTripStats(
  routeDistanceKm: number,
  drivingTimeMinutes: number,
  chargingStops: any[]
) {
  const totalChargeTimeMinutes = chargingStops.reduce((total, stop) => 
    total + (stop.estimatedChargeTimeMinutes || 0), 0
  );

  const totalTripTimeMinutes = drivingTimeMinutes + totalChargeTimeMinutes;

  return {
    distance: routeDistanceKm,
    drivingTime: {
      hours: Math.floor(drivingTimeMinutes / 60),
      minutes: drivingTimeMinutes % 60,
      total: drivingTimeMinutes
    },
    chargingTime: {
      hours: Math.floor(totalChargeTimeMinutes / 60),
      minutes: totalChargeTimeMinutes % 60,
      total: totalChargeTimeMinutes
    },
    totalTime: {
      hours: Math.floor(totalTripTimeMinutes / 60),
      minutes: totalTripTimeMinutes % 60,
      total: totalTripTimeMinutes
    },
    chargingStops: chargingStops.length
  };
}

/**
 * 🎨 SOC renk kodlaması
 */
export function getSOCColor(socPercent: number): string {
  if (socPercent >= 80) return '#22c55e'; // Yeşil
  if (socPercent >= 50) return '#eab308'; // Sarı
  if (socPercent >= 20) return '#f97316'; // Turuncu
  return '#ef4444'; // Kırmızı
}

/**
 * 🔄 Süre formatlaması
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) {
    return `${mins}dk`;
  }
  return `${hours}s ${mins}dk`;
} 