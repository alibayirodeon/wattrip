export interface ChargingStation {
  id: string;
  name: string;
  location: {
    lat: number;
    lng: number;
  };
  available: boolean;
  power: number; // kW
  type: 'Trugo' | 'Tesla' | 'Other';
  price: number; // TL/kWh
  rating: number; // 1-5
  amenities: string[]; // ['Restaurant', 'WC', 'Cafe', etc.]
  lastUpdated: Date;
  score?: number; // Calculated score for ranking
}

export interface ChargingStationScore {
  station: ChargingStation;
  score: number;
  reasons: string[];
}

export interface ChargingPlanOptions {
  minSOC: number; // Default: 20
  maxSOC: number; // Default: 80
  preferredStationTypes?: ('Trugo' | 'Tesla' | 'Other')[];
  minPower?: number; // Minimum charging power in kW
  maxPrice?: number; // Maximum price per kWh
  minRating?: number; // Minimum station rating
  requiredAmenities?: string[]; // Required amenities
  strategy: 'minStops' | 'minTime' | 'balanced';
} 