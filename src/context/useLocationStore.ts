import { create } from 'zustand';

// Route interface for multi-route support
export interface RouteInfo {
  distance: number; // meters
  duration: number; // seconds
  polylinePoints: Array<{ latitude: number; longitude: number }>;
  summary?: string; // Route description from Google API
  warnings?: string[]; // Route warnings
  copyrights?: string; // Map data copyrights
  bounds?: {
    northeast: { lat: number; lng: number };
    southwest: { lat: number; lng: number };
  };
}

// EV-specific calculations for each route
export interface RouteEVInfo {
  estimatedConsumption: number; // kWh
  estimatedCost: number; // TL
  chargingStopsRequired: number;
  remainingBatteryAtDestination: number; // %
}

interface LocationState {
  from: string;
  to: string;
  fromCoord: [number, number] | null;
  toCoord: [number, number] | null;
  lastKnownLocation: { latitude: number; longitude: number } | null;
  
  // Multi-route support
  routes: RouteInfo[];
  routeEVInfo: RouteEVInfo[];
  selectedRouteIndex: number;
  loadingRoutes: boolean;
  
  // Actions
  setFrom: (value: string, coord: [number, number]) => void;
  setTo: (value: string, coord: [number, number]) => void;
  setLastKnownLocation: (loc: { latitude: number; longitude: number }) => void;
  
  // Multi-route actions
  setRoutes: (routes: RouteInfo[], evInfo: RouteEVInfo[]) => void;
  setSelectedRouteIndex: (index: number) => void;
  setLoadingRoutes: (loading: boolean) => void;
  clearRoutes: () => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  from: '',
  to: '',
  fromCoord: null,
  toCoord: null,
  lastKnownLocation: null,
  
  // Multi-route initial state
  routes: [],
  routeEVInfo: [],
  selectedRouteIndex: 0,
  loadingRoutes: false,
  
  // Basic actions
  setFrom: (value, coord) => set({ from: value, fromCoord: coord }),
  setTo: (value, coord) => set({ to: value, toCoord: coord }),
  setLastKnownLocation: (loc) => set({ lastKnownLocation: loc }),
  
  // Multi-route actions
  setRoutes: (routes, evInfo) => set({ 
    routes, 
    routeEVInfo: evInfo,
    selectedRouteIndex: 0 // Always select first route by default
  }),
  setSelectedRouteIndex: (index) => set({ selectedRouteIndex: index }),
  setLoadingRoutes: (loading) => set({ loadingRoutes: loading }),
  clearRoutes: () => set({ 
    routes: [], 
    routeEVInfo: [], 
    selectedRouteIndex: 0 
  }),
})); 