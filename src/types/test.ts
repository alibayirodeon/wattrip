import { Vehicle } from './vehicle';
import { RouteData } from './route';

export interface TestSegment {
  distance: number;
  elevation: number;
}

export interface TestPoint {
  elevation: number;
  distance: number;
}

export interface ChargingPlanResult {
  totalDistance: number;
  totalDuration: number;
  totalEnergy: number;
  chargingStops: ChargingStop[];
  warnings: string[];
}

export interface ChargingStop {
  stationId: number;
  name: string;
  stopCoord: {
    latitude: number;
    longitude: number;
  };
  distanceFromStartKm: number;
  batteryBeforeStopPercent: number;
  batteryAfterStopPercent: number;
  energyChargedKWh: number;
  estimatedChargeTimeMinutes: number;
  stationPowerKW: number;
  connectorType: string;
  averageChargingPowerKW: number;
  chargingEfficiency: number;
  segmentInfo: {
    segmentIndex: number;
    distanceToNext: number;
    batteryAtSegmentEnd: number;
  };
}

export interface EnergyCalculationParams {
  speed: number;
  temperature: number;
  load: number;
  isHighway: boolean;
}

export interface ChargingPlanParams {
  startBatteryPercent: number;
  targetBatteryPercent: number;
  minBatteryPercent: number;
  maxBatteryPercent: number;
  temperature: number;
  load: number;
  isHighway: boolean;
} 