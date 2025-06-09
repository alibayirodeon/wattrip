import axios from 'axios';
import { RouteInfo, RouteEVInfo } from '../context/useLocationStore';

// Google Maps API Key - Production'da environment variable'dan alınmalı
const GOOGLE_MAPS_API_KEY = 'AIzaSyC1RCUy97Gu_yFZuCSi9lFP2Utv3pm75Mc';

// EV Configuration
const EV_CONFIG = {
  batteryCapacity: 64, // kWh (Peugeot e-2008 örneği)
  maxRange: 320, // km
  consumptionPerKm: 0.17, // kWh/km
  electricityPrice: 3.5, // TL/kWh
  startBatteryPercent: 80, // %
  safetyMargin: 20, // % - Güvenlik için ayrılan batarya
  chargingThreshold: 25, // % - Bu seviyenin altında şarj gerekir
};

// Google Encoded Polyline Decoder
function decodePolyline(encoded: string): Array<{ latitude: number; longitude: number }> {
  let points = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;
  
  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;
    
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;
    
    points.push({ 
      latitude: lat / 1e5, 
      longitude: lng / 1e5 
    });
  }
  return points;
}

// Calculate EV-specific information for a route
function calculateEVInfo(route: RouteInfo): RouteEVInfo {
  const distanceKm = route.distance / 1000;
  
  // Tüketim hesapla
  const estimatedConsumption = distanceKm * EV_CONFIG.consumptionPerKm;
  
  // Maliyet hesapla
  const estimatedCost = estimatedConsumption * EV_CONFIG.electricityPrice;
  
  // Başlangıç batarya miktarı (kWh)
  const startBatteryKwh = (EV_CONFIG.startBatteryPercent / 100) * EV_CONFIG.batteryCapacity;
  
  // Varışta kalan batarya (kWh)
  const remainingBatteryKwh = startBatteryKwh - estimatedConsumption;
  
  // Varışta kalan batarya yüzdesi
  const remainingBatteryPercent = (remainingBatteryKwh / EV_CONFIG.batteryCapacity) * 100;
  
  // Şarj gereksinimi hesapla
  let chargingStopsRequired = 0;
  
  if (remainingBatteryPercent < EV_CONFIG.safetyMargin) {
    // Basit hesaplama: Ne kadar enerji eksik, o kadar şarj durağı
    const energyDeficit = estimatedConsumption - (startBatteryKwh - (EV_CONFIG.safetyMargin / 100 * EV_CONFIG.batteryCapacity));
    const energyPerChargingStop = EV_CONFIG.batteryCapacity * 0.6; // %60 şarj varsayımı
    chargingStopsRequired = Math.ceil(energyDeficit / energyPerChargingStop);
  }
  
  return {
    estimatedConsumption,
    estimatedCost,
    chargingStopsRequired: Math.max(0, chargingStopsRequired),
    remainingBatteryAtDestination: Math.max(0, remainingBatteryPercent),
  };
}

interface RouteServiceResponse {
  routes: RouteInfo[];
  evInfo: RouteEVInfo[];
  hasAlternatives: boolean;
  error?: string;
}

class RouteService {
  /**
   * 🛣️ Google Directions API'den alternatif rotalar dahil tüm rotaları al
   */
  async fetchMultipleRoutes(
    fromCoord: [number, number],
    toCoord: [number, number]
  ): Promise<RouteServiceResponse> {
    console.log('🛣️ Fetching multiple routes with alternatives...');
    
    try {
      const url = `https://maps.googleapis.com/maps/api/directions/json`;
      const params = {
        origin: `${fromCoord[0]},${fromCoord[1]}`,
        destination: `${toCoord[0]},${toCoord[1]}`,
        key: GOOGLE_MAPS_API_KEY,
        mode: 'driving',
        language: 'tr',
        alternatives: 'true', // Bu çoklu rota için en önemli parametre
        units: 'metric',
        region: 'tr',
      };

      const response = await axios.get(url, { 
        params,
        timeout: 15000 // 15 saniye timeout
      });
      
      console.log('📡 Google Directions API response:', {
        status: response.data.status,
        routesCount: response.data.routes?.length || 0,
        error: response.data.error_message
      });
      
      if (response.data.status !== 'OK') {
        throw new Error(`Google API Error: ${response.data.status} - ${response.data.error_message || 'Unknown error'}`);
      }
      
      if (!response.data.routes || response.data.routes.length === 0) {
        throw new Error('Rota bulunamadı');
      }

      // Tüm rotaları parse et
      const routes: RouteInfo[] = [];
      const evInfo: RouteEVInfo[] = [];
      
      response.data.routes.forEach((route: any, index: number) => {
        try {
          const leg = route.legs[0]; // İlk ve tek leg (direct route)
          
          // Polyline'ı decode et
          const polylinePoints = decodePolyline(route.overview_polyline.points);
          
          const routeInfo: RouteInfo = {
            distance: leg.distance.value, // meters
            duration: leg.duration.value, // seconds
            polylinePoints: polylinePoints,
            summary: route.summary || `Rota ${index + 1}`,
            warnings: route.warnings || [],
            copyrights: route.copyrights,
            bounds: route.bounds ? {
              northeast: { 
                lat: route.bounds.northeast.lat, 
                lng: route.bounds.northeast.lng 
              },
              southwest: { 
                lat: route.bounds.southwest.lat, 
                lng: route.bounds.southwest.lng 
              }
            } : undefined,
          };
          
          // EV hesaplamalarını yap
          const evCalculations = calculateEVInfo(routeInfo);
          
          routes.push(routeInfo);
          evInfo.push(evCalculations);
          
          console.log(`✅ Route ${index + 1} parsed:`, {
            distance: `${(routeInfo.distance / 1000).toFixed(1)}km`,
            duration: `${Math.round(routeInfo.duration / 60)}min`,
            consumption: `${evCalculations.estimatedConsumption.toFixed(1)}kWh`,
            chargingStops: evCalculations.chargingStopsRequired,
            summary: routeInfo.summary
          });
          
        } catch (error) {
          console.warn(`⚠️ Failed to parse route ${index + 1}:`, error);
        }
      });
      
      if (routes.length === 0) {
        throw new Error('Hiçbir rota parse edilemedi');
      }
      
      return {
        routes,
        evInfo,
        hasAlternatives: routes.length > 1
      };
      
    } catch (error: any) {
      console.error('❌ Route fetch error:', error);
      
      // Hata tipine göre özel mesajlar
      let errorMessage = 'Rota alınırken bir hata oluştu';
      
      if (error.response) {
        // API'den gelen hata
        switch (error.response.status) {
          case 400:
            errorMessage = 'Geçersiz rota parametreleri';
            break;
          case 403:
            errorMessage = 'API anahtarı geçersiz veya süresi dolmuş';
            break;
          case 429:
            errorMessage = 'Çok fazla istek gönderildi, lütfen bekleyin';
            break;
          case 500:
            errorMessage = 'Sunucu hatası, lütfen daha sonra tekrar deneyin';
            break;
        }
      } else if (error.request) {
        // İstek yapıldı ama cevap alınamadı
        errorMessage = 'Sunucuya ulaşılamıyor, internet bağlantınızı kontrol edin';
      }
      
      console.warn('⚠️ Using fallback route due to:', errorMessage);
      
      // Fallback: Basit tek rota oluştur
      console.log('🔄 Creating fallback route...');
      
      const fallbackRoute = this.createFallbackRoute(fromCoord, toCoord);
      const fallbackEVInfo = calculateEVInfo(fallbackRoute);
      
      return {
        routes: [fallbackRoute],
        evInfo: [fallbackEVInfo],
        hasAlternatives: false,
        error: errorMessage
      };
    }
  }
  
  /**
   * 🆘 API başarısız olursa basit fallback rota oluştur
   */
  private createFallbackRoute(
    fromCoord: [number, number], 
    toCoord: [number, number]
  ): RouteInfo {
    // Haversine formula ile mesafe hesapla
    const R = 6371; // Earth radius in km
    const dLat = (toCoord[0] - fromCoord[0]) * Math.PI / 180;
    const dLon = (toCoord[1] - fromCoord[1]) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(fromCoord[0] * Math.PI / 180) * Math.cos(toCoord[0] * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distanceKm = R * c;
    
    // Basit duration hesapla (60 km/h ortalama)
    const durationMinutes = Math.round((distanceKm / 60) * 60);
    
    return {
      distance: distanceKm * 1000, // meters
      duration: durationMinutes * 60, // seconds
      polylinePoints: [
        { latitude: fromCoord[0], longitude: fromCoord[1] },
        { latitude: toCoord[0], longitude: toCoord[1] }
      ],
      summary: 'Doğrudan Rota (Tahmini)',
      warnings: ['Bu rota tahmini bir rotadır. Gerçek yol koşulları farklı olabilir.'],
    };
  }
  
  /**
   * 🔧 EV konfigürasyonunu güncelle
   */
  updateEVConfig(config: Partial<typeof EV_CONFIG>) {
    Object.assign(EV_CONFIG, config);
    console.log('🔧 EV Config updated:', EV_CONFIG);
  }
  
  /**
   * 📊 Mevcut EV konfigürasyonunu al
   */
  getEVConfig() {
    return { ...EV_CONFIG };
  }
}

// Singleton instance
export const routeService = new RouteService();
export default routeService; 