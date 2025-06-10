import { Vehicle } from '../types/vehicle';
import { EnergyCalculationParams } from '../types/test';

export const calculateSegmentEnergy = (
  distance: number, // km
  elevation: number, // metre
  vehicle: Vehicle,
  params: EnergyCalculationParams
): number => {
  if (distance === 0) return 0;

  // Temel enerji tüketimi (kWh)
  const baseConsumptionKWh = (vehicle.consumption / 100) * distance;

  // Yükseklik farkı (potansiyel enerji, Joule)
  const mass = vehicle.weight; // kg
  const g = 9.81; // m/s^2
  const h = elevation; // metre
  const elevationEnergyKWh = (mass * g * h) / 3_600_000; // Joule -> kWh

  let totalEnergyKWh = baseConsumptionKWh;

  if (h > 0) {
    // Yokuş çıkış: ek enerji
    totalEnergyKWh += elevationEnergyKWh;
  } else if (h < 0) {
    // Yokuş iniş: rejeneratif frenleme ile geri kazanım
    const regenEfficiency = vehicle.regenEfficiency || 0.6; // default %60
    totalEnergyKWh += elevationEnergyKWh * regenEfficiency; // Negatif değer, enerji kazanımı
  }

  // Hız, sıcaklık, yük, yol tipi gibi diğer faktörler (opsiyonel, sadeleştirilmiş)
  // İstenirse çarpan eklenebilir

  return totalEnergyKWh;
}; 