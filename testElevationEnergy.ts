import { demoElevationEnergyCalculation, LatLng } from './src/utils/elevationEnergy';
import { ENV } from './src/config/env';

const antalyaKorkuteliPolyline: LatLng[] = [
  { lat: 36.8969, lng: 30.7133 }, // Antalya Merkez
  { lat: 36.9800, lng: 30.5000 }, // Ara nokta
  { lat: 37.0200, lng: 30.3500 }, // Ara nokta
  { lat: 37.0647, lng: 30.1956 }, // Korkuteli
];

const apiKey = ENV.GOOGLE_MAPS_API_KEY;

(async () => {
  await demoElevationEnergyCalculation(antalyaKorkuteliPolyline, apiKey);
})(); 