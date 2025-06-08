// Environment Configuration
// NOT: Production'da bu değerler çevresel değişkenlerden alınmalı

export const ENV = {
  // Google Maps API Key
  GOOGLE_MAPS_API_KEY: 'AIzaSyC1RCUy97Gu_yFZuCSi9lFP2Utv3pm75Mc',
  
  // API Endpoints
  NOMINATIM_BASE_URL: 'https://nominatim.openstreetmap.org',
  GOOGLE_DIRECTIONS_API_URL: 'https://maps.googleapis.com/maps/api/directions/json',
  
  // App Configuration
  APP_NAME: 'WatTrip',
  APP_VERSION: '1.0.0',
  
  // EV Configuration
  DEFAULT_BATTERY_RANGE: 320, // km
  DEFAULT_ENERGY_CONSUMPTION: 0.17, // kWh/km
  DEFAULT_ELECTRICITY_PRICE: 3.5, // TL/kWh
  
  // Map Configuration
  DEFAULT_REGION: {
    latitude: 39.9334, // Ankara
    longitude: 32.8597,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  },
  
  // API Configuration
  REQUEST_TIMEOUT: 10000, // ms
  DEBOUNCE_DELAY: 400, // ms for search
  
  // UI Configuration
  ANIMATION_DURATION: 300, // ms
  LOADING_DELAY: 500, // ms
};

// Type definitions for better TypeScript support
export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

// Helper function to get config with fallbacks
export const getConfig = (key: keyof typeof ENV, fallback?: any) => {
  return ENV[key] ?? fallback;
};

// Helper function for API URLs
export const getApiUrl = (endpoint: string, params?: Record<string, string>) => {
  let url = endpoint;
  
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }
  
  return url;
};

export default ENV; 