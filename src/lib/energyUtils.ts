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
   * SOC'den enerji miktarı hesapla
   */
  socToEnergy(socPercent: number): number {
    return (socPercent / 100) * this.batteryCapacityKWh;
  }

  /**
   * SOC'den menzil hesapla
   */
  socToRange(socPercent: number): number {
    const energyKWh = this.socToEnergy(socPercent);
    return (energyKWh * 100) / this.consumptionKWhPer100km;
  }

  /**
   * Mesafeden enerji tüketimi hesapla
   */
  distanceToEnergyConsumption(distanceKm: number): number {
    return (distanceKm * this.consumptionKWhPer100km) / 100;
  }

  /**
   * 📍 Segment bazlı SOC düşüşü hesaplama
   */
  calculateSegmentSOC(
    startSOC: number,
    segmentDistances: number[],
    segmentDescriptions?: string[]
  ): SegmentSOC[] {
    const segments: SegmentSOC[] = [];
    let currentSOC = startSOC;

    segmentDistances.forEach((distance, index) => {
      const energyConsumed = this.distanceToEnergyConsumption(distance);
      const socConsumed = this.energyToSOC(energyConsumed);
      const segmentStartSOC = currentSOC;
      const segmentEndSOC = Math.max(0, currentSOC - socConsumed);

      segments.push({
        segmentIndex: index + 1,
        startSOC: segmentStartSOC,
        endSOC: segmentEndSOC,
        distanceKm: distance,
        energyConsumedKWh: energyConsumed,
        description: segmentDescriptions?.[index] || `Segment ${index + 1}`
      });

      currentSOC = segmentEndSOC;
    });

    return segments;
  }

  /**
   * 🔌 Gelişmiş şarj eğrisi hesaplama (Gerçek EV davranışı)
   */
  calculateAdvancedChargingCurve(
    startSOC: number,
    targetSOC: number,
    chargerPowerKW: number,
    options: {
      batteryTempC?: number; // Batarya sıcaklığı
      ambientTempC?: number; // Ortam sıcaklığı
      batteryCondition?: 'new' | 'good' | 'fair' | 'poor'; // Batarya durumu
      chargingStrategy?: 'fast' | 'balanced' | 'gentle'; // Şarj stratejisi
    } = {}
  ): ChargingSession {
    const startEnergyKWh = this.socToEnergy(startSOC);
    const targetEnergyKWh = Math.min(
      this.socToEnergy(targetSOC),
      this.batteryCapacityKWh
    );
    const energyAddedKWh = targetEnergyKWh - startEnergyKWh;

    if (energyAddedKWh <= 0) {
      return {
        startSOC,
        endSOC: startSOC,
        energyAddedKWh: 0,
        chargingTimeMinutes: 0,
        chargerPowerKW,
        averageChargingPowerKW: 0
      };
    }

    // 📈 Gerçek şarj eğrisi simülasyonu
    let powerReductionFactor = 1.0;

    // SOC bazlı güç azaltması (Non-linear curve)
    if (startSOC >= 80) {
      powerReductionFactor *= 0.2; // %80+ çok yavaş (Gerçek EV davranışı)
    } else if (startSOC >= 70) {
      powerReductionFactor *= 0.35; // %70-80 yavaş
    } else if (startSOC >= 60) {
      powerReductionFactor *= 0.55; // %60-70 orta-yavaş
    } else if (startSOC >= 40) {
      powerReductionFactor *= 0.75; // %40-60 orta
    } else if (startSOC >= 20) {
      powerReductionFactor *= 0.95; // %20-40 neredeyse maksimum
    }
    // %0-20 maksimum hızda

    // Target SOC'ye doğru ilerlerken güç progressively azalır
    const avgSOC = (startSOC + targetSOC) / 2;
    if (avgSOC > startSOC) {
      // Şarj boyunca ortalama SOC yükselecekse ek azaltma
      if (avgSOC >= 75) {
        powerReductionFactor *= 0.8;
      } else if (avgSOC >= 65) {
        powerReductionFactor *= 0.9;
      }
    }

    // 🌡️ Sıcaklık etkisi (Daha detaylı)
    if (options.batteryTempC !== undefined) {
      const batteryTemp = options.batteryTempC;
      if (batteryTemp < 0) {
        powerReductionFactor *= 0.4; // Çok soğuk
      } else if (batteryTemp < 10) {
        powerReductionFactor *= 0.6; // Soğuk
      } else if (batteryTemp > 40) {
        powerReductionFactor *= 0.7; // Sıcak (thermal throttling)
      } else if (batteryTemp > 30) {
        powerReductionFactor *= 0.85; // Biraz sıcak
      }
      // 10-30°C optimal aralık
    }

    if (options.ambientTempC !== undefined) {
      const ambientTemp = options.ambientTempC;
      if (ambientTemp < -10) {
        powerReductionFactor *= 0.75; // Çok soğuk hava
      } else if (ambientTemp > 35) {
        powerReductionFactor *= 0.9; // Sıcak hava
      }
    }

    // 🔋 Batarya durumu etkisi
    if (options.batteryCondition) {
      const conditionFactors = {
        'new': 1.0,
        'good': 0.95,
        'fair': 0.85,
        'poor': 0.7
      };
      powerReductionFactor *= conditionFactors[options.batteryCondition];
    }

    // ⚡ Şarj stratejisi etkisi
    if (options.chargingStrategy) {
      const strategyFactors = {
        'fast': 1.0, // Maksimum hız
        'balanced': 0.85, // Dengeli (batarya ömrü koruma)
        'gentle': 0.65 // Yumuşak (maksimum batarya ömrü)
      };
      powerReductionFactor *= strategyFactors[options.chargingStrategy];
    }

    const averageChargingPowerKW = chargerPowerKW * powerReductionFactor;
    const chargingTimeHours = energyAddedKWh / averageChargingPowerKW;
    const chargingTimeMinutes = Math.round(chargingTimeHours * 60);

    return {
      startSOC,
      endSOC: this.energyToSOC(targetEnergyKWh),
      energyAddedKWh,
      chargingTimeMinutes,
      chargerPowerKW,
      averageChargingPowerKW
    };
  }

  /**
   * 🔌 Gerçekçi şarj süresi hesaplama (ABRP tarzı) - Legacy method
   */
  calculateChargingTime(
    startSOC: number,
    targetSOC: number,
    chargerPowerKW: number,
    options: {
      maxChargeSpeed?: boolean; // Yüksek SOC'de yavaşlama
      temperature?: number; // Hava sıcaklığı etkisi
      batteryTemp?: number; // Batarya sıcaklığı
    } = {}
  ): ChargingSession {
    // Yeni gelişmiş metoda yönlendir
    return this.calculateAdvancedChargingCurve(startSOC, targetSOC, chargerPowerKW, {
      ambientTempC: options.temperature,
      batteryTempC: options.batteryTemp,
      chargingStrategy: options.maxChargeSpeed === false ? 'gentle' : 'fast'
    });
  }

  /**
   * 🎯 Optimal şarj seviyesi hesaplama
   */
  calculateOptimalChargeLevel(
    currentSOC: number,
    remainingDistanceKm: number,
    nextStationDistanceKm?: number
  ): number {
    const energyNeededForRemaining = this.distanceToEnergyConsumption(remainingDistanceKm);
    const socNeededForRemaining = this.energyToSOC(energyNeededForRemaining);
    
    // Güvenlik marjı ekle
    const safetyMargin = 15; // %15 güvenlik marjı
    let targetSOC = socNeededForRemaining + safetyMargin;

    // Bir sonraki istasyon varsa, ona kadar yetecek kadar şarj et
    if (nextStationDistanceKm) {
      const energyForNextStation = this.distanceToEnergyConsumption(nextStationDistanceKm);
      const socForNextStation = this.energyToSOC(energyForNextStation);
      targetSOC = Math.max(targetSOC, socForNextStation + safetyMargin);
    }

    // Maksimum %85'e kadar şarj et (hız için)
    return Math.min(85, Math.max(currentSOC, targetSOC));
  }
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