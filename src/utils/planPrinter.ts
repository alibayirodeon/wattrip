import { AlternativePlanner, AlternativePlan } from './alternativePlanner';
import { ChargingStation } from '../types/chargingStation';
import * as fs from 'fs';
import * as path from 'path';

interface ChargingStop {
  station?: ChargingStation;
  distance?: number;
  energyCharged?: number;
  chargingTime?: number;
  socBefore?: number;
  socAfter?: number;
  location?: {
    lat: number;
    lng: number;
  };
  reason?: 'noStationsInRange' | 'batteryDepleted';
  socAtFailure?: number;
}

export interface ExtendedAlternativePlan extends AlternativePlan {
  totalDistance?: number;
  totalEnergy?: number;
  chargingStops: ChargingStop[];
  routeInfo?: string;
  route?: { lat: number; lng: number }[];
  routeSummary?: string;
  distance?: number;
  warnings?: string[];
}

export class PlanPrinter {
  private static logFile = path.join(__dirname, '../../logs/plan.log');

  static printPlan(plan: ExtendedAlternativePlan, planIndex: number) {
    const strategyName = this.getStrategyName(plan.strategy);
    
    // Başarısız plan için gelişmiş log formatı
    if (!plan.success) {
      const logData = {
        '⛔ Durum': 'Rota Tamamlanamadı!',
        '📍 Konum': plan.failureLocation ? 
          `${plan.failureLocation.lat.toFixed(4)}, ${plan.failureLocation.lng.toFixed(4)}` : 
          'bilinmiyor',
        '🔋 Batarya': typeof plan.finalSOC === 'number' ? 
          `${plan.finalSOC.toFixed(2)}% (~${this.calculateRemainingRange(plan.finalSOC, 50).toFixed(1)} km)` : 
          'bilinmiyor',
        '🛑 Sorun': this.getFailureReason(plan.failureReason),
        '💡 Öneri': 'Başlangıç SOC\'yi %50 üzerine çıkararak tekrar deneyin veya rota alternatiflerini değerlendirin'
      };

      // Tablo formatında göster
      console.table(logData);

      // Uyarıları göster
      if (plan.warnings && plan.warnings.length > 0) {
        console.log('\n⚠️ Uyarılar:');
        plan.warnings.forEach(warning => {
          console.log(`  - ${warning}`);
        });
      }

      // Enerji tüketimi
      if (plan.totalEnergy) {
        console.log(`\n⚡ Yükseklik etkili toplam enerji: ${plan.totalEnergy.toFixed(2)} kWh`);
      }

      // Log dosyasına kaydet
      this.saveToLogFile(logData, plan);

      console.log('\n');
      return;
    }

    // ... mevcut başarılı loglar ...
  }

  private static getStrategyName(strategy: 'minStops' | 'minTime' | 'balanced'): string {
    switch (strategy) {
      case 'minStops': return 'Minimum Durak';
      case 'minTime': return 'Minimum Süre';
      case 'balanced': return 'Dengeli';
      default: return strategy;
    }
  }

  private static getStrategyDescription(strategy: 'minStops' | 'minTime' | 'balanced'): string {
    switch (strategy) {
      case 'minStops': return 'En az sayıda şarj durağı ile rotayı tamamlar';
      case 'minTime': return 'Toplam yolculuk süresini minimize eder';
      case 'balanced': return 'Şarj süresi ve maliyet arasında denge kurar';
      default: return '';
    }
  }

  private static formatTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours} saat ${mins} dakika`;
  }

  private static getProfilePoints(profile: Array<{ distance: number; soc: number }>) {
    // Her 10km'de bir nokta göster
    const step = Math.max(1, Math.floor(profile.length / 10));
    return profile.filter((_, i) => i % step === 0);
  }

  static printStationDetails(station: ChargingStation) {
    console.log('\n=== ŞARJ İSTASYONU DETAYLARI ===');
    console.log(`İsim: ${station.name}`);
    console.log(`Tip: ${station.type}`);
    console.log(`Güç: ${station.power}kW`);
    console.log(`Fiyat: ${station.price} TL/kWh`);
    console.log(`Değerlendirme: ${station.rating}/5`);
    console.log(`Müsaitlik: ${station.available ? 'Evet' : 'Hayır'}`);
    console.log(`Olanaklar: ${station.amenities.join(', ')}`);
    console.log(`Son Güncelleme: ${station.lastUpdated.toLocaleString()}`);
    if (station.score !== undefined) {
      console.log(`Skor: ${(station.score * 100).toFixed(1)}%`);
    }
  }

  static printStationComparison(stations: ChargingStation[]) {
    console.log('\n=== ŞARJ İSTASYONLARI KARŞILAŞTIRMASI ===');
    stations.forEach((station, index) => {
      console.log(`\n${index + 1}. ${station.name}`);
      console.log(`   Tip: ${station.type}`);
      console.log(`   Güç: ${station.power}kW`);
      console.log(`   Fiyat: ${station.price} TL/kWh`);
      console.log(`   Değerlendirme: ${station.rating}/5`);
    });
  }

  private static getFailureReason(reason?: string): string {
    if (!reason) return 'Bilinmeyen hata';
    
    switch (reason) {
      case 'noStationsInRange':
        return 'Uygun şarj istasyonu bulunamadı (noStationsInRange)';
      case 'tooFewStations':
        return 'Yeterli sayıda şarj istasyonu bulunamadı (tooFewStations)';
      default:
        return reason;
    }
  }

  private static saveToLogFile(logData: any, plan: ExtendedAlternativePlan) {
    // Log dizinini oluştur
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Log içeriğini hazırla
    const logContent = {
      timestamp: new Date().toISOString(),
      ...logData,
      warnings: plan.warnings || [],
      totalEnergy: plan.totalEnergy
    };

    // Dosyaya ekle
    fs.appendFileSync(
      this.logFile,
      JSON.stringify(logContent, null, 2) + '\n',
      'utf8'
    );
  }

  static calculateRemainingRange(soc: number, capacity: number, consumptionPerKm: number = 0.178): number {
    return (capacity * soc / 100) / consumptionPerKm;
  }
} 