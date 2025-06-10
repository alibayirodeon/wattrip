/**
 * 🧩 Polyline noktalarını dinamik olarak seyrekleştirir
 *
 * @param polylinePoints - Rota üzerindeki polyline noktaları [{ lat, lng }]
 * @param maxPoints - Maksimum tutulacak nokta sayısı (varsayılan 300)
 * @returns Seyrekleştirilmiş polyline noktaları
 */
export function reducePolylineDensityDynamic(
  polylinePoints: { lat: number; lng: number }[],
  maxPoints: number = 300
): { lat: number; lng: number }[] {
  const totalPoints = polylinePoints.length;

  // Zaten azsa dokunma
  if (totalPoints <= maxPoints) return polylinePoints;

  // Minimum 3 nokta güvenliği
  if (maxPoints < 3) maxPoints = 3;

  // Dinamik aralık hesapla
  const keepEvery = Math.ceil(totalPoints / maxPoints);

  const reduced: { lat: number; lng: number }[] = [];

  // İlk nokta mutlaka eklenir
  reduced.push(polylinePoints[0]);

  // Aradaki noktaları dinamik aralıkla ekle
  for (let i = keepEvery; i < totalPoints - 1; i += keepEvery) {
    reduced.push(polylinePoints[i]);
  }

  // Son nokta mutlaka eklenir (tekrarı önle)
  if (reduced[reduced.length - 1] !== polylinePoints[totalPoints - 1]) {
    reduced.push(polylinePoints[totalPoints - 1]);
  }

  // Minimum 3 nokta güvenliği
  if (reduced.length < 3 && totalPoints >= 3) {
    // Orta noktayı da ekle
    const mid = Math.floor(totalPoints / 2);
    if (!reduced.includes(polylinePoints[mid])) {
      reduced.splice(1, 0, polylinePoints[mid]);
    }
  }

  return reduced;
} 