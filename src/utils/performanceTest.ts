import { performance } from 'perf_hooks';
import { ChargingStation } from '../services/chargingStationService';
import chargingStationService from '../services/chargingStationService';

interface PerformanceMetrics {
  apiCalls: number;
  totalTime: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  stationsFound: number;
  cacheHits: number;
  cacheMisses: number;
}

/**
 * 🧪 Performans Test Fonksiyonu
 * Rota üzerindeki şarj istasyonu arama performansını ölçer
 */
export async function testChargingStationSearch(
  routePoints: Array<{ latitude: number; longitude: number }>,
  testName: string
): Promise<PerformanceMetrics> {
  console.log(`\n🧪 Starting performance test: ${testName}`);
  
  // Başlangıç metrikleri
  const startTime = performance.now();
  const startMemory = process.memoryUsage();
  let apiCalls = 0;
  let cacheHits = 0;
  let cacheMisses = 0;
  
  // API çağrı sayacı
  const originalFetch = global.fetch;
  global.fetch = async (...args) => {
    apiCalls++;
    return originalFetch(...args);
  };
  
  // Cache hit/miss sayacı
  chargingStationService.onCacheHit(() => cacheHits++);
  chargingStationService.onCacheMiss(() => cacheMisses++);
  
  try {
    // Test edilecek fonksiyon
    const stations = await chargingStationService.findChargingStationsAlongRoute(
      routePoints,
      15, // 15km arama yarıçapı
      300 // 300km batarya menzili
    );
    
    // Bitiş metrikleri
    const endTime = performance.now();
    const endMemory = process.memoryUsage();
    
    // Sonuçları hesapla
    const metrics: PerformanceMetrics = {
      apiCalls,
      totalTime: endTime - startTime,
      memoryUsage: {
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        external: endMemory.external - startMemory.external
      },
      stationsFound: stations.length,
      cacheHits,
      cacheMisses
    };
    
    // Sonuçları logla
    console.log('\n📊 Performance Test Results:');
    console.log(`Test Name: ${testName}`);
    console.log(`⏱️ Total Time: ${metrics.totalTime.toFixed(2)}ms`);
    console.log(`📡 API Calls: ${metrics.apiCalls}`);
    console.log(`💾 Memory Usage:`);
    console.log(`   - Heap Used: ${(metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    console.log(`   - Heap Total: ${(metrics.memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`);
    console.log(`   - External: ${(metrics.memoryUsage.external / 1024 / 1024).toFixed(2)}MB`);
    console.log(`🔌 Stations Found: ${metrics.stationsFound}`);
    console.log(`🎯 Cache Performance:`);
    console.log(`   - Hits: ${metrics.cacheHits}`);
    console.log(`   - Misses: ${metrics.cacheMisses}`);
    console.log(`   - Hit Rate: ${((metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)) * 100).toFixed(1)}%`);
    
    return metrics;
  } finally {
    // Orijinal fonksiyonları geri yükle
    global.fetch = originalFetch;
    chargingStationService.removeAllListeners();
  }
}

/**
 * 🧪 Demo Rotalar için Performans Testi
 */
export async function runPerformanceTests(): Promise<void> {
  console.log('🚀 Starting performance test suite...');
  
  // Test rotaları
  const testRoutes = [
    {
      name: 'Antalya → Adana',
      points: [
        { latitude: 36.89689, longitude: 30.71328 }, // Antalya
        { latitude: 37.23647, longitude: 32.40633 }, // Orta nokta
        { latitude: 36.98652, longitude: 35.32533 }  // Adana
      ]
    },
    {
      name: 'İstanbul → Ankara',
      points: [
        { latitude: 41.0082, longitude: 28.9784 },   // İstanbul
        { latitude: 40.1885, longitude: 29.0610 },   // Orta nokta
        { latitude: 39.9334, longitude: 32.8597 }    // Ankara
      ]
    },
    {
      name: 'İzmir → Muğla',
      points: [
        { latitude: 38.4237, longitude: 27.1428 },   // İzmir
        { latitude: 37.7749, longitude: 29.0850 },   // Orta nokta
        { latitude: 37.2154, longitude: 28.3636 }    // Muğla
      ]
    }
  ];
  
  // Her rota için test yap
  const results = await Promise.all(
    testRoutes.map(route => testChargingStationSearch(route.points, route.name))
  );
  
  // Genel sonuçları özetle
  console.log('\n📈 Performance Test Summary:');
  console.log('============================');
  
  const totalTime = results.reduce((sum, r) => sum + r.totalTime, 0);
  const totalApiCalls = results.reduce((sum, r) => sum + r.apiCalls, 0);
  const totalStations = results.reduce((sum, r) => sum + r.stationsFound, 0);
  const totalCacheHits = results.reduce((sum, r) => sum + r.cacheHits, 0);
  const totalCacheMisses = results.reduce((sum, r) => sum + r.cacheMisses, 0);
  
  console.log(`⏱️ Average Time: ${(totalTime / results.length).toFixed(2)}ms`);
  console.log(`📡 Average API Calls: ${(totalApiCalls / results.length).toFixed(1)}`);
  console.log(`🔌 Average Stations: ${(totalStations / results.length).toFixed(1)}`);
  console.log(`🎯 Overall Cache Hit Rate: ${((totalCacheHits / (totalCacheHits + totalCacheMisses)) * 100).toFixed(1)}%`);
}

// Test fonksiyonunu çalıştır
if (require.main === module) {
  runPerformanceTests().catch(console.error);
} 