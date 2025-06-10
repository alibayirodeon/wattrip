import { Vehicle } from '../types/vehicle';
import { RouteData } from '../types/route';

// Test araçları
export const testVehicles: Vehicle[] = [
  {
    id: '1',
    brand: 'Peugeot',
    model: 'e-2008',
    plate: '34 ABC 123',
    batteryCapacity: 50,
    consumption: 17.8,
    socketType: 'CCS',
    imageUrl: 'https://images.unsplash.com/photo-1566473965997-3de9c817e938?w=400&h=250&fit=crop',
    createdAt: new Date().toISOString(),
    // Enerji hesaplama parametreleri
    maxChargingPower: 100,
    regenEfficiency: 0.7,
    weight: 1540,
    dragCoefficient: 0.31,
    frontalArea: 2.4,
    rollingResistance: 0.01,
    motorEfficiency: 0.95,
    batteryEfficiency: 0.95,
    thermalEfficiency: 0.9,
    regenBrakingEfficiency: 0.7,
    batteryDegradationFactor: 0.98,
    temperatureEfficiencyFactor: 0.95,
    speedEfficiencyFactor: 0.9,
    loadEfficiencyFactor: 0.95,
    elevationEfficiencyFactor: 0.9,
    regenEfficiencyFactor: 0.7,
    batteryManagementEfficiency: 0.95,
    chargingEfficiency: 0.92,
    auxiliaryPowerConsumption: 0.5,
    climateControlEfficiency: 0.9,
    batteryHeatingEfficiency: 0.9,
    batteryCoolingEfficiency: 0.9,
    inverterEfficiency: 0.95,
    motorControllerEfficiency: 0.95,
    transmissionEfficiency: 0.98,
    wheelEfficiency: 0.98,
    aerodynamicEfficiency: 0.95,
    rollingEfficiency: 0.98,
    batteryAgingFactor: 0.98,
    temperatureImpactFactor: 0.95,
    speedImpactFactor: 0.9,
    loadImpactFactor: 0.95,
    elevationImpactFactor: 0.9,
    regenImpactFactor: 0.7,
    batteryManagementImpactFactor: 0.95,
    chargingImpactFactor: 0.92,
    auxiliaryImpactFactor: 0.95,
    climateControlImpactFactor: 0.9,
    batteryHeatingImpactFactor: 0.9,
    batteryCoolingImpactFactor: 0.9,
    inverterImpactFactor: 0.95,
    motorControllerImpactFactor: 0.95,
    transmissionImpactFactor: 0.98,
    wheelImpactFactor: 0.98,
    aerodynamicImpactFactor: 0.95,
    rollingImpactFactor: 0.98
  },
  {
    id: '2',
    brand: 'Tesla',
    model: 'Model Y',
    plate: '06 TSL 456',
    batteryCapacity: 75,
    consumption: 16.9,
    socketType: 'CCS',
    imageUrl: 'https://images.unsplash.com/photo-1617788138017-80ad40651399?w=400&h=250&fit=crop',
    createdAt: new Date().toISOString(),
    // Enerji hesaplama parametreleri
    maxChargingPower: 250,
    regenEfficiency: 0.75,
    weight: 1979,
    dragCoefficient: 0.23,
    frontalArea: 2.2,
    rollingResistance: 0.009,
    motorEfficiency: 0.97,
    batteryEfficiency: 0.96,
    thermalEfficiency: 0.92,
    regenBrakingEfficiency: 0.75,
    batteryDegradationFactor: 0.99,
    temperatureEfficiencyFactor: 0.96,
    speedEfficiencyFactor: 0.92,
    loadEfficiencyFactor: 0.96,
    elevationEfficiencyFactor: 0.92,
    regenEfficiencyFactor: 0.75,
    batteryManagementEfficiency: 0.96,
    chargingEfficiency: 0.94,
    auxiliaryPowerConsumption: 0.4,
    climateControlEfficiency: 0.92,
    batteryHeatingEfficiency: 0.92,
    batteryCoolingEfficiency: 0.92,
    inverterEfficiency: 0.97,
    motorControllerEfficiency: 0.97,
    transmissionEfficiency: 0.99,
    wheelEfficiency: 0.99,
    aerodynamicEfficiency: 0.97,
    rollingEfficiency: 0.99,
    batteryAgingFactor: 0.99,
    temperatureImpactFactor: 0.96,
    speedImpactFactor: 0.92,
    loadImpactFactor: 0.96,
    elevationImpactFactor: 0.92,
    regenImpactFactor: 0.75,
    batteryManagementImpactFactor: 0.96,
    chargingImpactFactor: 0.94,
    auxiliaryImpactFactor: 0.96,
    climateControlImpactFactor: 0.92,
    batteryHeatingImpactFactor: 0.92,
    batteryCoolingImpactFactor: 0.92,
    inverterImpactFactor: 0.97,
    motorControllerImpactFactor: 0.97,
    transmissionImpactFactor: 0.99,
    wheelImpactFactor: 0.99,
    aerodynamicImpactFactor: 0.97,
    rollingImpactFactor: 0.99
  },
  {
    id: '3',
    brand: 'Hyundai',
    model: 'IONIQ 5',
    plate: '35 HYN 789',
    batteryCapacity: 77.4,
    consumption: 16.8,
    socketType: 'CCS',
    imageUrl: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=400&h=250&fit=crop',
    createdAt: new Date().toISOString(),
    // Enerji hesaplama parametreleri
    maxChargingPower: 220,
    regenEfficiency: 0.72,
    weight: 1950,
    dragCoefficient: 0.25,
    frontalArea: 2.3,
    rollingResistance: 0.01,
    motorEfficiency: 0.96,
    batteryEfficiency: 0.95,
    thermalEfficiency: 0.91,
    regenBrakingEfficiency: 0.72,
    batteryDegradationFactor: 0.98,
    temperatureEfficiencyFactor: 0.95,
    speedEfficiencyFactor: 0.91,
    loadEfficiencyFactor: 0.95,
    elevationEfficiencyFactor: 0.91,
    regenEfficiencyFactor: 0.72,
    batteryManagementEfficiency: 0.95,
    chargingEfficiency: 0.93,
    auxiliaryPowerConsumption: 0.45,
    climateControlEfficiency: 0.91,
    batteryHeatingEfficiency: 0.91,
    batteryCoolingEfficiency: 0.91,
    inverterEfficiency: 0.96,
    motorControllerEfficiency: 0.96,
    transmissionEfficiency: 0.98,
    wheelEfficiency: 0.98,
    aerodynamicEfficiency: 0.96,
    rollingEfficiency: 0.98,
    batteryAgingFactor: 0.98,
    temperatureImpactFactor: 0.95,
    speedImpactFactor: 0.91,
    loadImpactFactor: 0.95,
    elevationImpactFactor: 0.91,
    regenImpactFactor: 0.72,
    batteryManagementImpactFactor: 0.95,
    chargingImpactFactor: 0.93,
    auxiliaryImpactFactor: 0.95,
    climateControlImpactFactor: 0.91,
    batteryHeatingImpactFactor: 0.91,
    batteryCoolingImpactFactor: 0.91,
    inverterImpactFactor: 0.96,
    motorControllerImpactFactor: 0.96,
    transmissionImpactFactor: 0.98,
    wheelImpactFactor: 0.98,
    aerodynamicImpactFactor: 0.96,
    rollingImpactFactor: 0.98
  }
];

// Test rotaları
export const testRoutes: RouteData[] = [
  {
    // Antalya - Korkuteli
    distance: 70,
    duration: 3600,
    polylinePoints: [
      { latitude: 36.8969, longitude: 30.7133 }, // Antalya
      { latitude: 37.0579, longitude: 30.1953 }  // Korkuteli
    ],
    elevationData: [
      { elevation: 30, distance: 0 },
      { elevation: 250, distance: 35 },
      { elevation: 1000, distance: 70 }
    ],
    segmentEnergies: [5.2, 8.4, 12.1]
  },
  {
    // İstanbul - Ankara
    distance: 450,
    duration: 25200,
    polylinePoints: [
      { latitude: 41.0082, longitude: 28.9784 }, // İstanbul
      { latitude: 39.9334, longitude: 32.8597 }  // Ankara
    ],
    elevationData: [
      { elevation: 100, distance: 0 },
      { elevation: 850, distance: 225 },
      { elevation: 938, distance: 450 }
    ],
    segmentEnergies: [45.2, 52.8, 48.3]
  }
];

// Test şarj istasyonları
export const testChargingStations = [
  {
    ID: 1,
    AddressInfo: {
      Title: 'Test Station 1',
      Latitude: 36.8969,
      Longitude: 30.7133,
      Distance: 0
    },
    Connections: [
      {
        ID: 1,
        PowerKW: 150,
        ConnectionTypeID: 1,
        ConnectionType: { Title: 'Type 2 CCS' }
      }
    ]
  },
  {
    ID: 2,
    AddressInfo: {
      Title: 'Test Station 2',
      Latitude: 37.0579,
      Longitude: 30.1953,
      Distance: 70
    },
    Connections: [
      {
        ID: 2,
        PowerKW: 250,
        ConnectionTypeID: 1,
        ConnectionType: { Title: 'Type 2 CCS' }
      }
    ]
  }
]; 