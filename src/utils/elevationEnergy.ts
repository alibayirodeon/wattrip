import axios from 'axios';

export interface LatLng { lat: number; lng: number; }
export interface Segment {
  distance_km: number;
  elevation_diff_m: number;
}

// 1. Polyline noktalarından yükseklik verisi al
export async function getElevationForPolyline(points: LatLng[], apiKey: string): Promise<number[]> {
  const BATCH_SIZE = 512;
  const results: number[] = [];

  for (let i = 0; i < points.length; i += BATCH_SIZE) {
    const batch = points.slice(i, i + BATCH_SIZE);
    const locations = batch.map(p => `${p.lat},${p.lng}`).join('|');
    const url = `https://maps.googleapis.com/maps/api/elevation/json?locations=${locations}&key=${apiKey}`;
    const response = await axios.get(url);
    if (response.data.status !== 'OK') {
      throw new Error(`Elevation API error: ${response.data.status}`);
    }
    results.push(...response.data.results.map((r: any) => r.elevation));
  }

  return results;
}

// 2. Segment verisi oluştur
export function buildSegmentData(points: LatLng[], elevations: number[]): Segment[] {
  const haversineDistance = (a: LatLng, b: LatLng): number => {
    const toRad = (x: number) => (x * Math.PI) / 180;
    const R = 6371; // km
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const aVal =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
    return R * c;
  };

  const segments: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    segments.push({
      distance_km: haversineDistance(points[i], points[i + 1]),
      elevation_diff_m: elevations[i + 1] - elevations[i],
    });
  }
  return segments;
}

// 3. Segment enerji hesabı
/**
 * Segment bazlı enerji tüketimi hesaplar (yokuş/iniş ve rejeneratif frenleme etkili).
 * @param segment - {distance_km, elevation_diff_m}
 * @param baseConsumption - 100km'de kWh cinsinden baz tüketim (varsayılan: 17.8)
 * @param regenEfficiency - Rejeneratif frenleme verimliliği (0-1, varsayılan: 0.6)
 * @returns kWh cinsinden toplam tüketim (inişte negatif olabilir)
 */
export function calculateSegmentEnergy(
  segment: Segment,
  baseConsumption = 17.8,
  regenEfficiency = 0.6
): number {
  const flatConsumption = (baseConsumption / 100) * segment.distance_km;
  let elevationImpact = 0;
  if (segment.elevation_diff_m > 0) {
    // Yokuş çıkış: her 100m başına +0.5 kWh
    elevationImpact = (segment.elevation_diff_m / 100) * 0.5;
  } else if (segment.elevation_diff_m < 0) {
    // İniş: rejeneratif frenleme ile enerji kazanımı
    // Her 100m inişte -0.3 kWh yerine, regenEfficiency ile ölçekle
    elevationImpact = (segment.elevation_diff_m / 100) * 0.5 * regenEfficiency;
  }
  return flatConsumption + elevationImpact;
}

/**
 * Örnek kullanım: Polyline ve API key ile segment bazlı enerji hesabı
 */
export async function demoElevationEnergyCalculation(
  points: LatLng[],
  apiKey: string,
  baseConsumption = 17.8
) {
  try {
    console.log('⛰️ Yükseklik verileri alınıyor...');
    const elevations = await getElevationForPolyline(points, apiKey);

    console.log('🛣️ Segmentler oluşturuluyor...');
    const segments = buildSegmentData(points, elevations);

    console.log('⚡ Enerji hesaplanıyor...');
    const energies = segments.map(seg => calculateSegmentEnergy(seg, baseConsumption));

    // Sonuçları özetle
    let totalEnergy = 0;
    segments.forEach((seg, i) => {
      totalEnergy += energies[i];
      console.log(
        `Segment ${i + 1}: ${seg.distance_km.toFixed(2)} km, ` +
        `Δh: ${seg.elevation_diff_m.toFixed(1)} m, ` +
        `Enerji: ${energies[i].toFixed(3)} kWh`
      );
    });
    console.log(`\nToplam enerji tüketimi: ${totalEnergy.toFixed(3)} kWh`);
    return { segments, energies, totalEnergy };
  } catch (err) {
    console.error('Elevation/enerji hesaplama hatası:', err);
    throw err;
  }
}

/**
 * Polyline noktalarını belirli aralıklarla (ör. 500 m) downsample eder.
 * @param points - orijinal polyline [{lat, lng}]
 * @param intervalMeters - örnekleme aralığı (varsayılan: 500 m)
 * @returns downsampled polyline
 */
export function downsamplePolyline(points: LatLng[], intervalMeters = 500): LatLng[] {
  if (points.length < 2) return points;
  const result: LatLng[] = [points[0]];
  let lastPoint = points[0];
  let accumulated = 0;
  for (let i = 1; i < points.length; i++) {
    const d = haversineDistance(lastPoint, points[i]) * 1000; // metre cinsinden
    accumulated += d;
    if (accumulated >= intervalMeters) {
      result.push(points[i]);
      lastPoint = points[i];
      accumulated = 0;
    }
  }
  if (result[result.length - 1] !== points[points.length - 1]) {
    result.push(points[points.length - 1]);
  }
  return result;
}

function haversineDistance(a: LatLng, b: LatLng): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const aVal =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
  return R * c;
} 