import { testVehicles, testRoutes, testChargingStations } from './testData';
import { generateChargingPlan } from './chargingPlanCalculator';
import { calculateSegmentEnergy } from './energyCalculator';
import { getElevationForPolyline } from './elevationService';
import { 
  TestSegment, 
  TestPoint, 
  ChargingPlanResult, 
  ChargingStop, 
  EnergyCalculationParams,
  ChargingPlanParams 
} from '../types/test';

// Enerji hesaplama testi
const testEnergyCalculation = async () => {
  console.log('🔋 Enerji Hesaplama Testi Başlıyor...');
  
  try {
    for (const route of testRoutes) {
      console.log(`\n📍 Rota: ${route.polylinePoints[0].latitude},${route.polylinePoints[0].longitude} -> ${route.polylinePoints[1].latitude},${route.polylinePoints[1].longitude}`);
      
      for (const vehicle of testVehicles) {
        console.log(`\n🚗 Araç: ${vehicle.brand} ${vehicle.model}`);
        
        try {
          // Segment enerjilerini hesapla
          const segmentEnergies = await Promise.all(
            route.elevationData.map(async (segment: TestSegment, index: number) => {
              const params: EnergyCalculationParams = {
                speed: 100, // km/s
                temperature: 20, // °C
                load: 0, // kg
                isHighway: true
              };
              // Segment değerlerini logla
              console.log(`Segment ${index + 1} mesafe:`, segment.distance, 'eğim:', segment.elevation);
              const energy = calculateSegmentEnergy(segment.distance, segment.elevation, vehicle, params);
              if (isNaN(energy)) {
                console.warn(`NaN enerji! Segment ${index + 1}: distance=${segment.distance}, elevation=${segment.elevation}, vehicle=`, vehicle);
              }
              return energy;
            })
          );
          
          // Sonuçları göster
          console.log('📊 Segment Enerjileri:');
          segmentEnergies.forEach((energy: number, index: number) => {
            console.log(`  Segment ${index + 1}: ${energy.toFixed(2)} kWh`);
          });
          
          // Toplam enerji
          const totalEnergy = segmentEnergies.reduce((sum: number, energy: number) => sum + energy, 0);
          console.log(`\n⚡ Toplam Enerji: ${totalEnergy.toFixed(2)} kWh`);
          
          // Beklenen menzil
          const expectedRange = (vehicle.batteryCapacity / totalEnergy) * route.distance;
          console.log(`🎯 Beklenen Menzil: ${expectedRange.toFixed(2)} km`);
        } catch (error) {
          console.error(`❌ Araç testi sırasında hata: ${vehicle.brand} ${vehicle.model}`, error);
        }
      }
    }
  } catch (error) {
    console.error('❌ Enerji hesaplama testi sırasında hata:', error);
    throw error;
  }
};

// Şarj planı testi
const testChargingPlan = async () => {
  console.log('\n🔌 Şarj Planı Testi Başlıyor...');
  
  try {
    for (const route of testRoutes) {
      console.log(`\n📍 Rota: ${route.polylinePoints[0].latitude},${route.polylinePoints[0].longitude} -> ${route.polylinePoints[1].latitude},${route.polylinePoints[1].longitude}`);
      
      for (const vehicle of testVehicles) {
        console.log(`\n🚗 Araç: ${vehicle.brand} ${vehicle.model}`);
        
        try {
          if (!vehicle) {
            console.error('Araç undefined! Test verisi veya fonksiyon çağrısı hatalı.');
          }
          const params: ChargingPlanParams = {
            startBatteryPercent: 100,
            targetBatteryPercent: 20,
            minBatteryPercent: 10,
            maxBatteryPercent: 80,
            temperature: 20,
            load: 0,
            isHighway: true
          };
          
          // Şarj planı oluştur
          const plan: ChargingPlanResult = await generateChargingPlan({
            selectedVehicle: vehicle,
            routeData: {
              distance: route.distance,
              polylinePoints: route.polylinePoints
            },
            chargingStations: testChargingStations
          });
          
          // Sonuçları göster
          console.log('\n📋 Şarj Planı:');
          const lastStop = plan.chargingStops.length > 0 ? plan.chargingStops[plan.chargingStops.length-1] : null;
          const totalDistance = lastStop ? lastStop.distanceFromStartKm : 0;
          console.log(`Toplam Mesafe: ${totalDistance.toFixed(2)} km`);
          console.log(`Toplam Süre: ${plan.totalChargingTimeMinutes.toFixed(0)} dakika`);
          console.log(`Toplam Enerji: ${plan.totalEnergyConsumedKWh.toFixed(2)} kWh`);
          
          console.log('\n🛑 Şarj Durakları:');
          plan.chargingStops.forEach((stop: ChargingStop, index: number) => {
            console.log(`\n  Durak ${index + 1}: ${stop.name}`);
            console.log(`  Mesafe: ${stop.distanceFromStartKm} km`);
            console.log(`  Batarya: %${stop.batteryBeforeStopPercent} -> %${stop.batteryAfterStopPercent}`);
            console.log(`  Şarj Enerjisi: ${stop.energyChargedKWh} kWh`);
            console.log(`  Şarj Süresi: ${stop.estimatedChargeTimeMinutes} dakika`);
            console.log(`  İstasyon Gücü: ${stop.stationPowerKW} kW`);
            console.log(`  Ortalama Güç: ${stop.averageChargingPowerKW} kW`);
            console.log(`  Verimlilik: %${stop.chargingEfficiency}`);
          });
          
          if (plan.warnings.length > 0) {
            console.log('\n⚠️ Uyarılar:');
            plan.warnings.forEach(warning => console.log(`  ${warning}`));
          }
        } catch (error) {
          console.error(`❌ Araç şarj planı testi sırasında hata: ${vehicle.brand} ${vehicle.model}`, error);
        }
      }
    }
  } catch (error) {
    console.error('❌ Şarj planı testi sırasında hata:', error);
    throw error;
  }
};

// Yükseklik verisi testi
const testElevationData = async () => {
  console.log('\n⛰️ Yükseklik Verisi Testi Başlıyor...');
  
  try {
    for (const route of testRoutes) {
      console.log(`\n📍 Rota: ${route.polylinePoints[0].latitude},${route.polylinePoints[0].longitude} -> ${route.polylinePoints[1].latitude},${route.polylinePoints[1].longitude}`);
      
      try {
        // Yükseklik verilerini al
        const elevationData: TestPoint[] = await getElevationForPolyline(route.polylinePoints);
        
        // Sonuçları göster
        console.log('\n📊 Yükseklik Verileri:');
        elevationData.forEach((point: TestPoint, index: number) => {
          console.log(`  Nokta ${index + 1}: ${point.elevation} m (${point.distance} km)`);
        });
        
        // Yükseklik değişimi
        const elevationChange = elevationData[elevationData.length - 1].elevation - elevationData[0].elevation;
        console.log(`\n📈 Toplam Yükseklik Değişimi: ${elevationChange} m`);
      } catch (error) {
        console.error(`❌ Rota yükseklik verisi testi sırasında hata: ${route.polylinePoints[0].latitude},${route.polylinePoints[0].longitude} -> ${route.polylinePoints[1].latitude},${route.polylinePoints[1].longitude}`, error);
      }
    }
  } catch (error) {
    console.error('❌ Yükseklik verisi testi sırasında hata:', error);
    throw error;
  }
};

// Tüm testleri çalıştır
export const runAllTests = async () => {
  console.log('🧪 WatTrip Test Suite Başlıyor...\n');
  
  try {
    await testEnergyCalculation();
    await testChargingPlan();
    await testElevationData();
    
    console.log('\n✅ Tüm testler başarıyla tamamlandı!');
  } catch (error) {
    console.error('\n❌ Test sırasında hata oluştu:', error);
    if (error instanceof Error) {
      console.error('Hata detayı:', error.message);
      console.error('Hata stack:', error.stack);
    }
    throw error;
  }
};

// Diğer test fonksiyonlarını da export et
export {
  testEnergyCalculation,
  testChargingPlan,
  testElevationData
};

// Gelişmiş Test Suite
export const runAdvancedTestSuite = async () => {
  console.log('\n🚦 Gelişmiş Test Suite Başlıyor...');
  const defaultParams = {
    startBatteryPercent: 50,
    targetBatteryPercent: 20,
    minBatteryPercent: 10,
    maxBatteryPercent: 80,
    temperature: 20,
    load: 0,
    isHighway: true
  };

  // 1. Kritik Eşik Testleri
  console.log('\n[1] Kritik Eşik Testleri');
  for (const vehicle of testVehicles) {
    const route = testRoutes[0];
    // %19 SOC ile başlat
    const lowSOCParams = { ...defaultParams, startBatteryPercent: 19 };
    const planLowSOC = await generateChargingPlan({
      selectedVehicle: vehicle,
      routeData: { distance: route.distance, polylinePoints: route.polylinePoints },
      chargingStations: testChargingStations,
      startChargePercent: 19
    });
    console.log(`Araç: ${vehicle.brand} ${vehicle.model} - %19 SOC ile başlatıldı, Uyarılar:`, planLowSOC.warnings);
    // %81 hedef SOC
    const highSOCParams = { ...defaultParams, maxBatteryPercent: 81 };
    const planHighSOC = await generateChargingPlan({
      selectedVehicle: vehicle,
      routeData: { distance: route.distance, polylinePoints: route.polylinePoints },
      chargingStations: testChargingStations,
      startChargePercent: 50
    });
    console.log(`Araç: ${vehicle.brand} ${vehicle.model} - %81 hedef SOC, Uyarılar:`, planHighSOC.warnings);
  }

  // 2. Yokuş Tüketimi Gerçekliği
  console.log('\n[2] Yokuş Tüketimi Gerçekliği');
  const flatRoute = { ...testRoutes[0], elevationData: testRoutes[0].elevationData.map(seg => ({ ...seg, elevation: 0 })) };
  const hillyRoute = testRoutes[0];
  for (const vehicle of testVehicles) {
    const flatEnergy = flatRoute.elevationData.reduce((sum, seg) => sum + calculateSegmentEnergy(seg.distance, seg.elevation, vehicle, defaultParams), 0);
    const hillyEnergy = hillyRoute.elevationData.reduce((sum, seg) => sum + calculateSegmentEnergy(seg.distance, seg.elevation, vehicle, defaultParams), 0);
    console.log(`Araç: ${vehicle.brand} ${vehicle.model} - Düz: ${flatEnergy.toFixed(2)} kWh, Yokuşlu: ${hillyEnergy.toFixed(2)} kWh`);
  }

  // 3. Rejeneratif Frenleme Onayı
  console.log('\n[3] Rejeneratif Frenleme Onayı');
  for (const vehicle of testVehicles) {
    for (const seg of hillyRoute.elevationData) {
      const energy = calculateSegmentEnergy(seg.distance, seg.elevation < 0 ? -Math.abs(seg.elevation) : seg.elevation, vehicle, defaultParams);
      if (energy < 0) {
        console.log(`Araç: ${vehicle.brand} ${vehicle.model} - Rejen aktif! Segment: distance=${seg.distance}, elevation=${seg.elevation}, enerji=${energy.toFixed(2)} kWh`);
      }
    }
  }

  // 4. Şarj Altyapısı Sınırlı Testi
  console.log('\n[4] Şarj Altyapısı Sınırlı Testi');
  for (const vehicle of testVehicles) {
    const planNoStations = await generateChargingPlan({
      selectedVehicle: vehicle,
      routeData: { distance: testRoutes[0].distance, polylinePoints: testRoutes[0].polylinePoints },
      chargingStations: []
    });
    console.log(`Araç: ${vehicle.brand} ${vehicle.model} - İstasyon yok, Uyarılar:`, planNoStations.warnings);
  }

  // 5. Araçlara Özel Farklılık
  console.log('\n[5] Araçlara Özel Farklılık');
  for (const vehicle of testVehicles) {
    const plan = await generateChargingPlan({
      selectedVehicle: vehicle,
      routeData: { distance: testRoutes[0].distance, polylinePoints: testRoutes[0].polylinePoints },
      chargingStations: testChargingStations
    });
    console.log(`Araç: ${vehicle.brand} ${vehicle.model} - Toplam Enerji: ${plan.totalEnergyConsumedKWh} kWh, Durak Sayısı: ${plan.chargingStops.length}`);
  }

  // 6. SOC Bazlı Gerçek Uyarı Testi
  console.log('\n[6] SOC Bazlı Gerçek Uyarı Testi');
  for (const vehicle of testVehicles) {
    const route = testRoutes[0];
    const lowSOCPlan = await generateChargingPlan({
      selectedVehicle: vehicle,
      routeData: { distance: route.distance, polylinePoints: route.polylinePoints },
      chargingStations: testChargingStations
    });
    if (lowSOCPlan.warnings.some(w => w.toLowerCase().includes('şarj') || w.toLowerCase().includes('soc'))) {
      console.log(`Araç: ${vehicle.brand} ${vehicle.model} - Düşük SOC ile uyarı verildi:`, lowSOCPlan.warnings);
    } else {
      console.warn(`Araç: ${vehicle.brand} ${vehicle.model} - Düşük SOC ile uyarı YOK!`);
    }
  }

  // 7. Geri Kazanım (Regen) Senaryosu
  console.log('\n[7] Geri Kazanım (Regen) Senaryosu');
  const regenRoute = { ...testRoutes[0], elevationData: testRoutes[0].elevationData.map((seg, i) => ({ ...seg, elevation: i === 0 ? 800 : 50 })) };
  for (const vehicle of testVehicles) {
    for (const seg of regenRoute.elevationData) {
      const energy = calculateSegmentEnergy(seg.distance, seg.elevation < 0 ? -Math.abs(seg.elevation) : seg.elevation, vehicle, defaultParams);
      if (energy < 0) {
        console.log(`Araç: ${vehicle.brand} ${vehicle.model} - Regen aktif! Segment: distance=${seg.distance}, elevation=${seg.elevation}, enerji=${energy.toFixed(2)} kWh`);
      }
    }
  }

  // 8. Gerçek Rota Testi (uzun)
  console.log('\n[8] Gerçek Rota Testi (İstanbul → Ankara)');
  const longRoute = testRoutes.find(r => r.distance > 400000) || testRoutes[1];
  for (const vehicle of testVehicles) {
    const plan = await generateChargingPlan({
      selectedVehicle: vehicle,
      routeData: { distance: longRoute.distance, polylinePoints: longRoute.polylinePoints },
      chargingStations: testChargingStations
    });
    console.log(`Araç: ${vehicle.brand} ${vehicle.model} - Durak Sayısı: ${plan.chargingStops.length}, Toplam Enerji: ${plan.totalEnergyConsumedKWh} kWh, Uyarılar:`, plan.warnings);
  }

  // 9. Yavaş Şarj Durumu Senaryosu
  console.log('\n[9] Yavaş Şarj Durumu Senaryosu');
  const slowStations = testChargingStations.map(station => ({ ...station, Connections: station.Connections.map(conn => ({ ...conn, PowerKW: 22 })) }));
  for (const vehicle of testVehicles) {
    const plan = await generateChargingPlan({
      selectedVehicle: vehicle,
      routeData: { distance: longRoute.distance, polylinePoints: longRoute.polylinePoints },
      chargingStations: slowStations
    });
    console.log(`Araç: ${vehicle.brand} ${vehicle.model} - Yavaş şarj ile toplam süre: ${plan.totalChargingTimeMinutes} dk, Uyarılar:`, plan.warnings);
  }

  // 10. Enerji/Süre Tradeoff Analizi
  console.log('\n[10] Enerji/Süre Tradeoff Analizi');
  // Kısa ama tırmanışlı rota
  const shortHillyRoute = { ...testRoutes[0], elevationData: testRoutes[0].elevationData.map((seg, i) => ({ ...seg, elevation: i === 0 ? 0 : 500 })) };
  // Uzun ama düz rota
  const longFlatRoute = { ...testRoutes[1], elevationData: testRoutes[1].elevationData.map(seg => ({ ...seg, elevation: 0 })) };
  for (const vehicle of testVehicles) {
    const shortHillyEnergy = shortHillyRoute.elevationData.reduce((sum, seg) => sum + calculateSegmentEnergy(seg.distance, seg.elevation, vehicle, defaultParams), 0);
    const longFlatEnergy = longFlatRoute.elevationData.reduce((sum, seg) => sum + calculateSegmentEnergy(seg.distance, seg.elevation, vehicle, defaultParams), 0);
    console.log(`Araç: ${vehicle.brand} ${vehicle.model} - Kısa/Tırmanışlı: ${shortHillyEnergy.toFixed(2)} kWh, Uzun/Düz: ${longFlatEnergy.toFixed(2)} kWh`);
  }

  // 11. Rejeneratif Frenleme Doğrulama Testi
  console.log('\n[11] Rejeneratif Frenleme Doğrulama Testi');
  const regenTestRoute = { ...testRoutes[0], elevationData: testRoutes[0].elevationData.map((seg, i) => ({ ...seg, elevation: i === 0 ? 1000 : 50 })) };
  for (const vehicle of testVehicles) {
    let regenFound = false;
    for (const seg of regenTestRoute.elevationData) {
      const energy = calculateSegmentEnergy(seg.distance, seg.elevation < 0 ? -Math.abs(seg.elevation) : seg.elevation, vehicle, defaultParams);
      if (energy < 0) {
        regenFound = true;
        console.log(`Araç: ${vehicle.brand} ${vehicle.model} - Regen aktif! Segment: distance=${seg.distance}, elevation=${seg.elevation}, enerji=${energy.toFixed(2)} kWh`);
      }
    }
    if (!regenFound) {
      console.warn(`Araç: ${vehicle.brand} ${vehicle.model} - Regen aktif segment bulunamadı!`);
    }
  }

  // 12. %20 Altı SOC Senaryosu
  console.log('\n[12] %20 Altı SOC Senaryosu');
  for (const vehicle of testVehicles) {
    const route = testRoutes[1]; // uzun rota
    const lowSOCPlan = await generateChargingPlan({
      selectedVehicle: vehicle,
      routeData: { distance: route.distance, polylinePoints: route.polylinePoints },
      chargingStations: testChargingStations,
      segmentEnergies: undefined
    });
    const socWarning = lowSOCPlan.warnings.some(w => w.toLowerCase().includes('şarj') || w.toLowerCase().includes('soc'));
    console.log(`Araç: ${vehicle.brand} ${vehicle.model} - %15 SOC ile uzun rota, Uyarı: ${socWarning ? 'VAR' : 'YOK'}, Final Batarya: %${lowSOCPlan.batteryAtDestinationPercent}`);
  }

  // 13. Şarj Süresi ve Enerji Tüketimi Uyumu
  console.log('\n[13] Şarj Süresi ve Enerji Tüketimi Uyumu');
  for (const vehicle of testVehicles) {
    const plan = await generateChargingPlan({
      selectedVehicle: vehicle,
      routeData: { distance: testRoutes[1].distance, polylinePoints: testRoutes[1].polylinePoints },
      chargingStations: testChargingStations
    });
    plan.chargingStops.forEach((stop, idx) => {
      if (stop.energyChargedKWh > 0 && stop.estimatedChargeTimeMinutes <= 0) {
        console.warn(`Araç: ${vehicle.brand} ${vehicle.model} - Durak ${idx + 1}: Enerji ${stop.energyChargedKWh} kWh, Süre 0! HATA!`);
      }
    });
  }

  // 14. Segment Bazlı SOC Düşüşü Logu
  console.log('\n[14] Segment Bazlı SOC Düşüşü');
  for (const vehicle of testVehicles) {
    const route = testRoutes[0];
    let soc = 100;
    let socLog = `%${soc}`;
    for (const seg of route.elevationData) {
      const energy = calculateSegmentEnergy(seg.distance, seg.elevation, vehicle, defaultParams);
      const socDrop = (energy / vehicle.batteryCapacity) * 100;
      soc -= socDrop;
      socLog += ` → %${Math.round(soc)}`;
    }
    console.log(`Araç: ${vehicle.brand} ${vehicle.model} - SOC Akışı: ${socLog}`);
  }

  // 15. Düşük Başlangıç SOC ile Zorunlu Şarj Testi
  console.log('\n[15] Düşük Başlangıç SOC ile Zorunlu Şarj Testi');
  for (const vehicle of testVehicles) {
    const route = testRoutes[1]; // uzun rota
    const plan = await generateChargingPlan({
      selectedVehicle: vehicle,
      routeData: { distance: route.distance, polylinePoints: route.polylinePoints },
      chargingStations: testChargingStations,
      startChargePercent: 30 // düşük SOC ile başlat
    });
    console.log(`Araç: ${vehicle.brand} ${vehicle.model} - Başlangıç SOC: %30, Durak Sayısı: ${plan.chargingStops.length}`);
    plan.chargingStops.forEach((stop, idx) => {
      console.log(`  Durak ${idx + 1}: ${stop.name}, Batarya: %${stop.batteryBeforeStopPercent} → %${stop.batteryAfterStopPercent}, Enerji: ${stop.energyChargedKWh} kWh, Süre: ${stop.estimatedChargeTimeMinutes} dk`);
    });
  }

  // 16. Standart %50 SOC Testi
  console.log('\n[16] Standart %50 SOC Testi');
  for (const vehicle of testVehicles) {
    const route = testRoutes[0];
    const plan = await generateChargingPlan({
      selectedVehicle: vehicle,
      routeData: { distance: route.distance, polylinePoints: route.polylinePoints },
      chargingStations: testChargingStations,
      startChargePercent: 50
    });
    console.log(`Araç: ${vehicle.brand} ${vehicle.model} - Başlangıç SOC: %50`);
    console.log(`  Durak Sayısı: ${plan.chargingStops.length}`);
    console.log(`  Toplam Şarj Süresi: ${plan.totalChargingTimeMinutes} dk`);
    console.log(`  Toplam Enerji: ${plan.totalEnergyConsumedKWh} kWh`);
    console.log(`  Varışta Batarya: %${plan.batteryAtDestinationPercent}`);
  }

  console.log('\n🚦 Gelişmiş Test Suite tamamlandı!');
}; 