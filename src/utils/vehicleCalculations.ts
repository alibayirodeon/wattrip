import { Vehicle } from '../context/useVehicleStore';

export interface VehicleRangeInfo {
  maxRangeKm: number;
  remainingRangeKm: number;
  batteryPercentage: number;
  consumptionPer100km: number;
  estimatedConsumptionForRoute: number;
  chargingStopsRequired: number;
  recommendedStopInterval: number;
}

export interface EVCalculationParams {
  vehicle: Vehicle;
  routeDistanceKm: number;
  startingBatteryPercentage?: number; // Varsayılan %80
  safetyMarginPercentage?: number; // Varsayılan %20 (emniyet payı)
}

/**
 * Araç parametrelerine göre menzil hesaplar
 */
export function calculateVehicleRange(
  vehicle: Vehicle,
  startingBatteryPercentage: number = 80
): VehicleRangeInfo {
  const { batteryCapacity, consumption } = vehicle;
  
  // Teorik maksimum menzil (tam batarya ile)
  const maxRangeKm = (batteryCapacity * 100) / consumption;
  
  // Mevcut batarya seviyesine göre kalan menzil
  const remainingRangeKm = (maxRangeKm * startingBatteryPercentage) / 100;
  
  return {
    maxRangeKm: Math.round(maxRangeKm),
    remainingRangeKm: Math.round(remainingRangeKm),
    batteryPercentage: startingBatteryPercentage,
    consumptionPer100km: consumption,
    estimatedConsumptionForRoute: 0, // Rota uzunluğuna göre hesaplanacak
    chargingStopsRequired: 0, // Rota uzunluğuna göre hesaplanacak
    recommendedStopInterval: Math.round(maxRangeKm * 0.7) // %70 menzilde dur
  };
}

/**
 * Rota için EV hesaplamaları yapar
 */
export function calculateEVRequirementsForRoute(
  params: EVCalculationParams
): VehicleRangeInfo {
  const { vehicle, routeDistanceKm, startingBatteryPercentage = 80, safetyMarginPercentage = 20 } = params;
  
  const rangeInfo = calculateVehicleRange(vehicle, startingBatteryPercentage);
  
  // Rota için tahmini tüketim
  const estimatedConsumptionForRoute = (routeDistanceKm * vehicle.consumption) / 100;
  
  // Emniyet payı ile kullanılabilir menzil
  const usableRangeKm = rangeInfo.remainingRangeKm * (1 - safetyMarginPercentage / 100);
  
  // Gerekli şarj durak sayısı
  const chargingStopsRequired = routeDistanceKm > usableRangeKm 
    ? Math.ceil((routeDistanceKm - usableRangeKm) / (rangeInfo.recommendedStopInterval)) 
    : 0;
  
  return {
    ...rangeInfo,
    estimatedConsumptionForRoute: Math.round(estimatedConsumptionForRoute * 10) / 10,
    chargingStopsRequired,
  };
}

/**
 * Rotayı menzile göre segmentlere böler
 */
export function splitRouteByRange(
  routePoints: Array<{ latitude: number; longitude: number }>,
  rangeKm: number,
  routeDistanceKm: number
): Array<{ latitude: number; longitude: number }> {
  if (routeDistanceKm <= rangeKm || routePoints.length < 2) {
    return routePoints;
  }
  
  const segmentCount = Math.ceil(routeDistanceKm / rangeKm);
  const pointsPerSegment = Math.floor(routePoints.length / segmentCount);
  
  const segmentPoints: Array<{ latitude: number; longitude: number }> = [];
  
  for (let i = 0; i < segmentCount; i++) {
    const segmentMiddleIndex = Math.floor(i * pointsPerSegment + pointsPerSegment / 2);
    const index = Math.min(segmentMiddleIndex, routePoints.length - 1);
    segmentPoints.push(routePoints[index]);
  }
  
  return segmentPoints;
}

/**
 * Socket type'ı OpenChargeMap connector type'ına map eder
 */
export function mapSocketTypeToConnectorFilter(socketType: Vehicle['socketType']): string {
  switch (socketType) {
    case 'CCS':
      return 'CCS';
    case 'Type2':
      return 'Type2';
    case 'CHAdeMO':
      return 'CHAdeMO';
    default:
      return 'CCS'; // Varsayılan
  }
}

/**
 * Araç bilgilerini UI'da gösterilecek formatta döndürür
 */
export function formatVehicleDisplayInfo(vehicle: Vehicle, rangeInfo: VehicleRangeInfo) {
  return {
    vehicleName: `${vehicle.brand} ${vehicle.model}`,
    batteryInfo: `${vehicle.batteryCapacity} kWh`,
    consumptionInfo: `${vehicle.consumption} kWh/100km`,
    socketInfo: vehicle.socketType,
    maxRange: `${rangeInfo.maxRangeKm} km`,
    currentRange: `${rangeInfo.remainingRangeKm} km (%${rangeInfo.batteryPercentage})`,
    estimatedConsumption: `${rangeInfo.estimatedConsumptionForRoute} kWh`,
    chargingStops: rangeInfo.chargingStopsRequired > 0 
      ? `${rangeInfo.chargingStopsRequired} durak gerekli`
      : 'Şarj gereksiz'
  };
} 