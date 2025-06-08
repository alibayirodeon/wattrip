import { create } from 'zustand';

interface LocationState {
  from: string;
  to: string;
  fromCoord: [number, number] | null;
  toCoord: [number, number] | null;
  lastKnownLocation: { latitude: number; longitude: number } | null;
  setFrom: (value: string, coord: [number, number]) => void;
  setTo: (value: string, coord: [number, number]) => void;
  setLastKnownLocation: (loc: { latitude: number; longitude: number }) => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  from: '',
  to: '',
  fromCoord: null,
  toCoord: null,
  lastKnownLocation: null,
  setFrom: (value, coord) => set({ from: value, fromCoord: coord }),
  setTo: (value, coord) => set({ to: value, toCoord: coord }),
  setLastKnownLocation: (loc) => set({ lastKnownLocation: loc }),
})); 