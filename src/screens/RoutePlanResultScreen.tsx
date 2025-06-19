import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, Dimensions, FlatList } from 'react-native';
import { styled } from 'nativewind/dist/styled';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { routeService } from '../services/routeService';
import chargingStationService, { ChargingStation } from '../services/chargingStationService';
import MapView, { Polyline, Marker, LatLng } from 'react-native-maps';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import decodePolyline from '../services/routeService';
import { calculateSegmentEnergy } from '../utils/energyCalculator';
import { generateChargingPlan, generateAdvancedChargingPlan } from '../utils/chargingPlanCalculator';
import { calculateDistance } from '../utils/distanceCalculator';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);

// Peugeot e-2008 sabit değerler
const VEHICLE_NAME = 'Peugeot e-2008';
const BATTERY_CAPACITY = 50; // kWh
const CONSUMPTION_PER_100KM = 17.8; // kWh/100km
const { height } = Dimensions.get('window');

// Enerji hesaplama yardımcı fonksiyonu
function calculateEVInfo(distanceMeters: number, batteryCapacity: number, consumptionPer100km: number, startPercent: number) {
  const distanceKm = distanceMeters / 1000;
  const estimatedConsumption = distanceKm * (consumptionPer100km / 100); // kWh
  const startBatteryKwh = (startPercent / 100) * batteryCapacity;
  const remainingBatteryKwh = startBatteryKwh - estimatedConsumption;
  const remainingPercent = (remainingBatteryKwh / batteryCapacity) * 100;
  // Basit şarj durağı hesabı: %20 altına düşerse şarj gerekir, her seferde %60 şarj varsayımı
  let chargingStops = 0;
  if (remainingPercent < 20) {
    const energyDeficit = estimatedConsumption - (startBatteryKwh - (batteryCapacity * 0.2));
    const energyPerStop = batteryCapacity * 0.6;
    chargingStops = Math.ceil(energyDeficit / energyPerStop);
  }
  return {
    estimatedConsumption,
    remainingPercent: Math.max(0, remainingPercent),
    chargingStops: Math.max(0, chargingStops),
  };
}

type SimpleRoute = {
  summary: string;
  distance: number;
  duration: number;
  polylinePoints: { latitude: number; longitude: number }[];
  // encodedPolyline?: string; // KULLANILMIYOR
};

// Enerji & batarya hesaplaması için sabitler
const VEHICLE = {
  id: 'peugeot2008',
  name: 'Peugeot e-2008',
  brand: 'Peugeot',
  model: 'e-2008',
  year: 2022,
  batteryCapacity: 50, // kWh
  consumption: 17.8, // kWh/100km
  socketType: 'CCS' as const,
  maxChargingPower: 100,
  regenEfficiency: 0.6,
  weight: 1623,
  dragCoefficient: 0.29,
  frontalArea: 2.2,
  rollingResistance: 0.01,
  motorEfficiency: 0.92,
  batteryEfficiency: 0.95,
  thermalEfficiency: 0.95,
  regenBraking: true,
  // Eksik zorunlu alanlar (örnek değerlerle dolduruldu)
  plate: 'XX1234',
  createdAt: new Date().toISOString(),
  // Diğer opsiyonel/etkisiz alanlar dummy değerlerle
  dragArea: 0,
  batteryDegradationFactor: 1,
  temperatureEfficiencyFactor: 1,
  speedEfficiencyFactor: 1,
  loadEfficiencyFactor: 1,
  elevationEfficiencyFactor: 1,
  regenEfficiencyFactor: 1,
  batteryManagementEfficiency: 1,
  chargingEfficiency: 1,
  auxiliaryPowerConsumption: 0,
  climateControlEfficiency: 1,
  batteryHeatingEfficiency: 1,
  batteryCoolingEfficiency: 1,
  inverterEfficiency: 1,
  motorControllerEfficiency: 1,
  transmissionEfficiency: 1,
  wheelEfficiency: 1,
  aerodynamicEfficiency: 1,
  rollingEfficiency: 1,
  batteryAgingFactor: 1,
  temperatureImpactFactor: 1,
  speedImpactFactor: 1,
  loadImpactFactor: 1,
  elevationImpactFactor: 1,
  regenImpactFactor: 1,
  batteryManagementImpactFactor: 1,
  chargingImpactFactor: 1,
  auxiliaryImpactFactor: 1,
  climateControlImpactFactor: 1,
  batteryHeatingImpactFactor: 1,
  batteryCoolingImpactFactor: 1,
  inverterImpactFactor: 1,
  motorControllerImpactFactor: 1,
  transmissionImpactFactor: 1,
  wheelImpactFactor: 1,
  aerodynamicImpactFactor: 1,
  rollingImpactFactor: 1,
};

function RoutePlanResultScreen({ navigation, route }: { navigation: any; route: any }) {
  const START_BATTERY_PERCENT = 80;
  // 1. Kullanıcıdan gelen from/to koordinatları (örnek: route.params.from, route.params.to)
  const fromCoord: [number, number] = route.params?.from ?? [36.884804, 30.704044];
  const toCoord: [number, number] = route.params?.to ?? [37.871353, 32.484634];
  const [fromLat, fromLng] = fromCoord;
  const [toLat, toLng] = toCoord;

  // State'ler
  const [routeSummary, setRouteSummary] = useState<string>('');
  const [routeDistance, setRouteDistance] = useState<number>(0);
  const [routeDuration, setRouteDuration] = useState<number>(0);
  const [polylineCoords, setPolylineCoords] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [stationsLoading, setStationsLoading] = useState(false);
  const [stationsError, setStationsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chargingPlan, setChargingPlan] = useState<any>(null);

  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setStationsLoading(true);
    setError(null);
    setStationsError(null);

    routeService.fetchMultipleRoutes([fromLat, fromLng], [toLat, toLng])
      .then((res) => {
        // --- En yakın biten rotayı seç ---
        const toCoordObj = { latitude: toLat, longitude: toLng };
        const getDistance = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) =>
          Math.sqrt(Math.pow(a.latitude - b.latitude, 2) + Math.pow(a.longitude - b.longitude, 2));
        const bestRoute = res.routes.reduce((best: any, route: any) => {
          const lastPoint = route.polylinePoints[route.polylinePoints.length - 1];
          const dist = getDistance(lastPoint, toCoordObj);
          if (!best || dist < best.dist) return { route, dist };
          return best;
        }, null).route;
        if (!bestRoute) {
          setError('Rota bulunamadı');
          setLoading(false);
          setStations([]);
          setPolylineCoords([]);
          setStationsLoading(false);
          return;
        }
        setRouteSummary(bestRoute.summary || '');
        setRouteDistance(typeof bestRoute.distance === 'string' ? parseFloat(bestRoute.distance) : bestRoute.distance);
        setRouteDuration(typeof bestRoute.duration === 'string' ? parseFloat(bestRoute.duration) : bestRoute.duration);
        setPolylineCoords(bestRoute.polylinePoints || []);
        chargingStationService.findChargingStationsAlongRoute(bestRoute.polylinePoints || [])
          .then((stationsRes) => {
            if (!isMounted) return;
            setStations(stationsRes);
            setStationsLoading(false);
            const plan = generateAdvancedChargingPlan({
              selectedVehicle: VEHICLE,
              routeData: {
                distance: typeof bestRoute.distance === 'string' ? parseFloat(bestRoute.distance) : bestRoute.distance,
                polylinePoints: bestRoute.polylinePoints || []
              },
              chargingStations: stationsRes,
              startChargePercent: START_BATTERY_PERCENT
            });
            setChargingPlan(plan);
          })
          .catch((err) => {
            if (!isMounted) return;
            setStationsError(err.message || 'İstasyonlar bulunamadı');
            setStations([]);
            setStationsLoading(false);
          });
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'Bir hata oluştu');
        setLoading(false);
        setStations([]);
        setPolylineCoords([]);
        setStationsLoading(false);
      });
    return () => { isMounted = false; };
  }, [fromLat, fromLng, toLat, toLng]);

  // Polyline toplam mesafe logu
  useEffect(() => {
    if (polylineCoords.length) {
      console.log('Polyline coords:', polylineCoords);
      let total = 0;
      for (let i = 1; i < polylineCoords.length; i++) {
        total += calculateDistance(
          polylineCoords[i-1].latitude, polylineCoords[i-1].longitude,
          polylineCoords[i].latitude, polylineCoords[i].longitude
        );
      }
      console.log('Polyline toplam mesafe (km):', total);
    }
  }, [polylineCoords]);

  // Harita fitToCoordinates
  useEffect(() => {
    if (mapRef.current && polylineCoords.length > 1) {
      const markers = stations
        .map(s => {
          const lat = s.AddressInfo?.Latitude;
          const lng = s.AddressInfo?.Longitude;
          if (typeof lat === 'number' && typeof lng === 'number') {
            return { latitude: lat, longitude: lng };
          }
          return null;
        })
        .filter((m): m is { latitude: number; longitude: number } => !!m);
      const allCoords = [...polylineCoords, ...markers];
      mapRef.current.fitToCoordinates(allCoords, {
        edgePadding: { top: 60, right: 40, bottom: 80, left: 40 },
        animated: true,
      });
    }
  }, [polylineCoords.length, stations.length]);

  // Enerji hesaplama (düz yol, eğim yok)
  const distanceKm = routeDistance; // routeDistance zaten km cinsinden
  const totalConsumption = (VEHICLE.consumption / 100) * distanceKm; // kWh
  const arrivalPercent = Math.max(0, START_BATTERY_PERCENT - (totalConsumption / VEHICLE.batteryCapacity) * 100);
  const chargingStops = Math.max(0, Math.ceil((totalConsumption - (VEHICLE.batteryCapacity * (START_BATTERY_PERCENT / 100))) / VEHICLE.batteryCapacity));

  // Şarj planı hesapla (polylineCoords ve stations güncellendiğinde)
  useEffect(() => {
    if (!polylineCoords.length || !stations.length) return;
    const routeData = {
      polylinePoints: polylineCoords,
      distance: routeDistance * 1000, // km -> metre
    };
    const plan = generateChargingPlan({
      selectedVehicle: VEHICLE,
      routeData,
      chargingStations: stations,
      startChargePercent: START_BATTERY_PERCENT,
    });
    setChargingPlan(plan);
  }, [polylineCoords, stations, routeDistance]);

  // --- Şarj planı kartı ---
  const renderChargingStop = ({ item, index }: { item: any; index: number }) => (
    <StyledView className="bg-white rounded-xl shadow-md p-4 mb-3 border border-gray-200">
      <StyledText className="text-lg font-bold mb-1">{item.station}</StyledText>
      <StyledView className="flex-row flex-wrap mb-1">
        <StyledText className="mr-4 text-xs">Varış SOC: <Text className="font-semibold">%{item.socBefore}</Text></StyledText>
        <StyledText className="mr-4 text-xs">Kalkış SOC: <Text className="font-semibold">%{item.socAfter}</Text></StyledText>
        <StyledText className="mr-4 text-xs">Şarj Süresi: <Text className="font-semibold">{item.chargeTime} dk</Text></StyledText>
        {item.chargeCost !== undefined && <StyledText className="mr-4 text-xs">Maliyet: <Text className="font-semibold">₺{item.chargeCost}</Text></StyledText>}
      </StyledView>
      <StyledView className="flex-row flex-wrap mb-1">
        <StyledText className="mr-4 text-xs">Şarj Enerjisi: <Text className="font-semibold">{item.energyAdded} kWh</Text></StyledText>
        <StyledText className="mr-4 text-xs">Güç: <Text className="font-semibold">{item.stopPower} kW</Text></StyledText>
        <StyledText className="mr-4 text-xs">Sürüş: <Text className="font-semibold">{item.driveTime} dk</Text></StyledText>
      </StyledView>
    </StyledView>
  );

  // --- Toplam özet kartı ---
  const renderPlanSummary = () => (
    <StyledView className="bg-blue-50 rounded-xl shadow p-4 mt-2 mb-6 border border-blue-200">
      <StyledText className="text-base font-bold mb-1">Toplam</StyledText>
      <StyledText className="text-xs">Toplam Şarj Süresi: <Text className="font-semibold">{chargingPlan?.totalChargingTime} dk</Text></StyledText>
      <StyledText className="text-xs">Toplam Enerji: <Text className="font-semibold">{chargingPlan?.totalEnergyConsumed} kWh</Text></StyledText>
      {chargingPlan?.totalCost !== undefined && <StyledText className="text-xs">Toplam Maliyet: <Text className="font-semibold">₺{chargingPlan?.totalCost}</Text></StyledText>}
    </StyledView>
  );

  // --- Şarj noktası isimlerini virgüllü dizi olarak hazırla ---
  const chargingStopNames = chargingPlan?.chargingStops?.map((stop: any) => `[${stop.station}]`).join(', ');

  // --- Terminale özet ve planı yazdır ---
  useEffect(() => {
    if (!chargingPlan) return;
    // Rota özeti
    console.log('--- Rota Özeti ---');
    console.log(`# | Rota Özeti | Toplam Mesafe | Şarj Durağı | Tüketim | Şarj Noktaları`);
    console.log(`1 | ${routeSummary} | ${routeDistance} km | ${chargingPlan.chargingStops?.length ?? 0} | ${chargingPlan.totalEnergyConsumed ?? '-'} kWh | ${chargingStopNames}`);
    // Şarj planı detayları
    if (chargingPlan.chargingStops && chargingPlan.chargingStops.length > 0) {
      console.log('\n--- Şarj Planı ---');
      chargingPlan.chargingStops.forEach((stop: any, idx: number) => {
        console.log(`#${idx + 1} ${stop.station}`);
        console.log(`  Varış SOC: %${stop.socBefore} | Kalkış SOC: %${stop.socAfter}`);
        console.log(`  Şarj Süresi: ${stop.chargeTime} dk | Enerji: ${stop.energyAdded} kWh | Güç: ${stop.stopPower} kW`);
        if (stop.chargeCost !== undefined) {
          console.log(`  Maliyet: ₺${stop.chargeCost}`);
        }
      });
      console.log('\nToplam Şarj Süresi:', chargingPlan.totalChargingTime, 'dk');
      console.log('Toplam Enerji:', chargingPlan.totalEnergyConsumed, 'kWh');
      if (chargingPlan.totalCost !== undefined) {
        console.log('Toplam Maliyet: ₺' + chargingPlan.totalCost);
      }
    } else {
      console.log('Bu rota için yolda şarj gerekmiyor.');
    }
  }, [chargingPlan, routeSummary, routeDistance, chargingStopNames]);

  return (
    <StyledScrollView className="flex-1 bg-gray-50">
      {/* Geri butonu */}
      <StyledTouchableOpacity
        className="absolute top-10 left-4 z-10 bg-white rounded-full p-2 shadow"
        onPress={() => navigation.goBack()}
      >
        <Icon name="arrow-left" size={24} color="#333" />
      </StyledTouchableOpacity>
      {/* Rota özeti tablosu */}
      <StyledView className="p-4">
        <StyledText className="text-xl font-bold mb-2">Rota Özeti</StyledText>
        <StyledView className="flex-row border-b border-gray-200 pb-2 mb-2">
          <StyledText className="w-8 font-bold">#</StyledText>
          <StyledText className="flex-1 font-bold">Rota</StyledText>
          <StyledText className="w-24 font-bold">Mesafe</StyledText>
          <StyledText className="w-16 font-bold">Şarj</StyledText>
          <StyledText className="w-20 font-bold">Tüketim</StyledText>
          <StyledText className="flex-1 font-bold">Noktalar</StyledText>
        </StyledView>
        <StyledView className="flex-row items-center py-2 border-b border-gray-100">
          <StyledText className="w-8">1</StyledText>
          <StyledText className="flex-1">{routeSummary}</StyledText>
          <StyledText className="w-24">{routeDistance} km</StyledText>
          <StyledText className="w-16">{chargingPlan?.chargingStops?.length ?? 0}</StyledText>
          <StyledText className="w-20">{chargingPlan?.totalEnergyConsumed ?? '-'} kWh</StyledText>
          <StyledText className="flex-1">{chargingStopNames}</StyledText>
        </StyledView>
      </StyledView>

      {/* Şarj planı kartları */}
      <StyledText className="text-lg font-bold mb-2 px-4">Şarj Planı</StyledText>
      {!loading && !error && chargingPlan && chargingPlan.chargingStops && chargingPlan.chargingStops.length > 0 && (
        <FlatList
          data={chargingPlan.chargingStops}
          renderItem={renderChargingStop}
          keyExtractor={(_, idx) => idx.toString()}
          ListFooterComponent={renderPlanSummary}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        />
      )}
      {/* Şarj gerekmiyorsa bilgi */}
      {!loading && !error && chargingPlan && (!chargingPlan.chargingStops || chargingPlan.chargingStops.length === 0) && (
        <StyledView className="p-4">
          <StyledText className="text-green-700 font-bold">Bu rota için yolda şarj gerekmiyor.</StyledText>
        </StyledView>
      )}
    </StyledScrollView>
  );
}

export default RoutePlanResultScreen; 