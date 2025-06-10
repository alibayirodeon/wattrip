import { TestPoint } from '../types/test';
import { ENV } from '../config/env';

interface Point {
  latitude: number;
  longitude: number;
}

export const getElevationForPolyline = async (points: Point[]): Promise<TestPoint[]> => {
  // Google Elevation API'den yükseklik verisi al
  const apiKey = ENV.GOOGLE_MAPS_API_KEY; // config'den anahtar alındı
  console.log('[ElevationService] Kullanılan API anahtarı (son 4):', apiKey.slice(-4));
  const baseUrl = 'https://maps.googleapis.com/maps/api/elevation/json';
  
  // Noktaları string formatına dönüştür
  const locations = points.map(p => `${p.latitude},${p.longitude}`).join('|');
  
  try {
    const response = await fetch(
      `${baseUrl}?locations=${locations}&key=${apiKey}`
    );
    
    const data = await response.json();
    
    if (data.status !== 'OK') {
      throw new Error(`Elevation API error: ${data.status}`);
    }
    
    // Sonuçları TestPoint formatına dönüştür
    return data.results.map((result: any, index: number) => ({
      elevation: result.elevation,
      distance: index === 0 ? 0 : calculateDistance(
        points[index - 1].latitude,
        points[index - 1].longitude,
        points[index].latitude,
        points[index].longitude
      )
    }));
  } catch (error) {
    console.error('Elevation API error:', error);
    // Hata durumunda varsayılan değerler döndür
    return points.map((_, index) => ({
      elevation: 0,
      distance: index * 10 // Her nokta arası 10km varsay
    }));
  }
};

// İki nokta arası mesafe hesaplama (Haversine formülü)
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Dünya'nın yarıçapı (km)
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRad = (value: number): number => {
  return value * Math.PI / 180;
}; 