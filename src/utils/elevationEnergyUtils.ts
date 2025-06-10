import axios from 'axios';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Segment {
  distance_km: number;
  elevation_gain_m: number;
}

/**
 * Google Elevation API'den polyline noktaları için yükseklik (metre) alır
 * 512 nokta limiti için otomatik bölme yapar
 */
export async function getElevationForPolyline(points: LatLng[], apiKey: string): Promise<number[]> {
  const MAX_POINTS = 512;
  const elevations: number[] = [];

  // Noktaları 512'lik parçalara böl
  for (let i = 0; i < points.length; i += MAX_POINTS) {
    const chunk = points.slice(i, i + MAX_POINTS);
    const locations = chunk.map(p => `${p.lat},${p.lng}`).join('|');
    const url = `https://maps.googleapis.com/maps/api/elevation/json?locations=${locations}&key=${apiKey}`;
    const resp = await axios.get(url);
    if (resp.data.status !== 'OK') {
      throw new Error(`Elevation API error: ${resp.data.status}`);
    }
    const chunkElevations = resp.data.results.map((r: any) => r.elevation);
    elevations.push(...chunkElevations);
  }
  return elevations;
}

/**
 * Haversine formülü ile iki nokta arası mesafe (km)
 */
export function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6371; // Dünya yarıçapı (km)
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat/2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng/2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Polyline ve yükseklik dizisinden segment bazlı mesafe ve eğim datası üretir
 */
export function buildSegmentData(points: LatLng[], elevations: number[]): Segment[] {
  const segments: Segment[] = [];
  for (let i = 1; i < points.length; i++) {
    const distance_km = haversineDistance(points[i-1], points[i]);
    const elevation_gain_m = elevations[i] - elevations[i-1];
    segments.push({ distance_km, elevation_gain_m });
  }
  return segments;
}

/**
 * Segment bazlı enerji tüketimi (kWh/100km cinsinden)
 * Pozitif eğimlerde: +%3 tüketim / %1 eğim
 * Negatif eğimlerde: -%1.5 tüketim / %1 eğim
 */
export function calculateSegmentEnergy(
  distance_km: number,
  elevation_gain_m: number,
  baseConsumption: number = 17.8
): number {
  // % eğim = (elevation_gain_m / (distance_km * 1000)) * 100
  const grade = distance_km > 0 ? (elevation_gain_m / (distance_km * 1000)) * 100 : 0;
  let factor = 0;
  if (grade > 0) factor = 0.03 * grade; // +%3 tüketim / %1 eğim
  else if (grade < 0) factor = 0.015 * grade; // -%1.5 tüketim / %1 eğim
  const adjustedConsumption = baseConsumption * (1 + factor);
  // Enerji (kWh): (adjustedConsumption / 100) * distance_km
  return (adjustedConsumption / 100) * distance_km;
} 