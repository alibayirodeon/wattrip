"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanPrinter = void 0;
const fs = require('fs');
const path = require('path');
class PlanPrinter {
    static logFile = path.join(__dirname, '../../logs/plan.log');
    static printPlan(plan, planIndex) {
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
    static getStrategyName(strategy) {
        switch (strategy) {
            case 'minStops':
                return 'Minimum Durak';
            case 'minTime':
                return 'Minimum Süre';
            case 'balanced':
                return 'Dengeli';
            default:
                return strategy;
        }
    }
    static getFailureReason(reason) {
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
    static saveToLogFile(logData, plan) {
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
    static calculateRemainingRange(soc, capacity, consumptionPerKm = 0.178) {
        return (capacity * soc / 100) / consumptionPerKm;
    }
}
exports.PlanPrinter = PlanPrinter;
