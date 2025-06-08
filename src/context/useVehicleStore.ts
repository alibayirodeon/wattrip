import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Vehicle {
  id: string;
  brand: string;
  model: string;
  plate: string;
  batteryCapacity: number; // kWh
  consumption: number; // kWh/100km
  socketType: 'Type2' | 'CCS' | 'CHAdeMO';
  imageUrl?: string;
  createdAt: string;
}

interface VehicleStore {
  vehicles: Vehicle[];
  selectedVehicleId: string | null;
  
  // Actions
  setSelectedVehicle: (id: string) => void;
  addVehicle: (vehicle: Omit<Vehicle, 'id' | 'createdAt'>) => void;
  updateVehicle: (id: string, updates: Partial<Vehicle>) => void;
  removeVehicle: (id: string) => void;
  getSelectedVehicle: () => Vehicle | null;
  
  // Utility actions
  initializeMockData: () => void;
  clearAllVehicles: () => void;
}

// Mock data için örnek araçlar
const MOCK_VEHICLES: Vehicle[] = [
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
  },
];

export const useVehicleStore = create<VehicleStore>()(
  persist(
    (set, get) => ({
      vehicles: [],
      selectedVehicleId: null,

      setSelectedVehicle: (id: string) => {
        const vehicle = get().vehicles.find(v => v.id === id);
        if (vehicle) {
          set({ selectedVehicleId: id });
          console.log(`🚗 Selected vehicle: ${vehicle.brand} ${vehicle.model} (${vehicle.plate})`);
        }
      },

      addVehicle: (vehicleData) => {
        const newVehicle: Vehicle = {
          ...vehicleData,
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          createdAt: new Date().toISOString(),
        };
        
        set((state) => {
          const updatedVehicles = [...state.vehicles, newVehicle];
          const newSelectedId = state.selectedVehicleId || newVehicle.id; // İlk araç otomatik seçilir
          
          console.log(`✅ Vehicle added: ${newVehicle.brand} ${newVehicle.model}`);
          return {
            vehicles: updatedVehicles,
            selectedVehicleId: newSelectedId
          };
        });
      },

      updateVehicle: (id: string, updates) => {
        set((state) => ({
          vehicles: state.vehicles.map(vehicle =>
            vehicle.id === id ? { ...vehicle, ...updates } : vehicle
          )
        }));
        console.log(`📝 Vehicle updated: ${id}`);
      },

      removeVehicle: (id: string) => {
        set((state) => {
          const filteredVehicles = state.vehicles.filter(v => v.id !== id);
          const newSelectedId = state.selectedVehicleId === id 
            ? (filteredVehicles.length > 0 ? filteredVehicles[0].id : null)
            : state.selectedVehicleId;
          
          console.log(`🗑️ Vehicle removed: ${id}`);
          return {
            vehicles: filteredVehicles,
            selectedVehicleId: newSelectedId
          };
        });
      },

      getSelectedVehicle: () => {
        const { vehicles, selectedVehicleId } = get();
        return vehicles.find(v => v.id === selectedVehicleId) || null;
      },

      initializeMockData: () => {
        const currentVehicles = get().vehicles;
        
        // Sadece vehicles boşsa mock data ekle
        if (currentVehicles.length === 0) {
          set({
            vehicles: MOCK_VEHICLES,
            selectedVehicleId: MOCK_VEHICLES[0].id // İlk aracı seç
          });
          console.log('🚗 Mock vehicles initialized');
        } else {
          console.log('🚗 Vehicles already exist, skipping mock data');
        }
      },

      clearAllVehicles: () => {
        set({
          vehicles: [],
          selectedVehicleId: null
        });
        console.log('🧹 All vehicles cleared');
      },
    }),
    {
      name: 'vehicle-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        vehicles: state.vehicles,
        selectedVehicleId: state.selectedVehicleId
      }),
    }
  )
);

// Utility functions
export const formatSocketType = (socketType: Vehicle['socketType']): string => {
  switch (socketType) {
    case 'Type2':
      return 'Type 2 AC';
    case 'CCS':
      return 'Type 2 CCS';
    case 'CHAdeMO':
      return 'CHAdeMO';
    default:
      return socketType;
  }
};

export const formatConsumption = (consumption: number): string => {
  return `${consumption} kWh/100km`;
};

export const formatBatteryCapacity = (capacity: number): string => {
  return `${capacity} kWh`;
};

export const getVehicleDisplayName = (vehicle: Vehicle): string => {
  return `${vehicle.brand} ${vehicle.model}`;
};

// Hook for easy access to selected vehicle data
export const useSelectedVehicle = () => {
  const getSelectedVehicle = useVehicleStore(state => state.getSelectedVehicle);
  return getSelectedVehicle();
}; 