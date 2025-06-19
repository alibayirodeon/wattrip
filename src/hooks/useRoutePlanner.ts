import { useState } from 'react';
import routeService from '../services/routeService';

export type LocationParam = {
  description: string;
  coordinates: { latitude: number; longitude: number };
};

export type RouteParams = {
  start: LocationParam;
  end: LocationParam;
  vehicle: string;
  battery: number;
  filters: {
    ac: boolean;
    dc: boolean;
    green: boolean;
    sort: string;
  };
  // ... diğer parametreler eklenebilir
};

export function useRoutePlanner() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const plan = async (params: RouteParams) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      // Sadece koordinatları kullanarak rota planla
      const res = await routeService.fetchMultipleRoutes(
        [params.start.coordinates.latitude, params.start.coordinates.longitude],
        [params.end.coordinates.latitude, params.end.coordinates.longitude]
      );
      setResult(res);
    } catch (e: any) {
      setError(e.message || 'Rota planlama hatası');
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, result, plan };
} 