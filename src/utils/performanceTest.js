"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testChargingStationSearch = testChargingStationSearch;
exports.runPerformanceTests = runPerformanceTests;
var perf_hooks_1 = require("perf_hooks");
var chargingStationService_1 = require("../services/chargingStationService");
/**
 * 🧪 Performans Test Fonksiyonu
 * Rota üzerindeki şarj istasyonu arama performansını ölçer
 */
async function testChargingStationSearch(routePoints, testName) {
    console.log(`\n🧪 Starting performance test: ${testName}`);
    
    // Başlangıç metrikleri
    const startTime = perf_hooks_1.performance.now();
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
    chargingStationService_1.default.onCacheHit(() => cacheHits++);
    chargingStationService_1.default.onCacheMiss(() => cacheMisses++);
    
    try {
        // Test edilecek fonksiyon
        const stations = await chargingStationService_1.default.findChargingStationsAlongRoute(
            routePoints,
            15, // 15km arama yarıçapı
            300 // 300km batarya menzili
        );
        
        // Bitiş metrikleri
        const endTime = perf_hooks_1.performance.now();
        const endMemory = process.memoryUsage();
        
        // Sonuçları hesapla
        const metrics = {
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
        chargingStationService_1.default.removeAllListeners();
    }
}
/**
 * 🧪 Demo Rotalar için Performans Testi
 */
async function runPerformanceTests() {
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

module.exports = {
    testChargingStationSearch,
    runPerformanceTests
};
