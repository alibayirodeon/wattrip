import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { View, ScrollView, ActivityIndicator, Alert, TouchableOpacity, FlatList, Dimensions, Platform, StyleSheet } from 'react-native';
import { Text, Card, Button, Chip, Divider, Title, Paragraph } from 'react-native-paper';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { ENV } from '../config/env';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import * as Print from 'expo-print';

import { useLocationStore } from '../context/useLocationStore';
import { useVehicleStore, useSelectedVehicle } from '../context/useVehicleStore';
import { useNavigation } from '@react-navigation/native';
import chargingStationService, { ChargingStation } from '../services/chargingStationService';
import routeService from '../services/routeService';
import RouteCard from '../components/RouteCard';
import ChargingStopCard from '../components/ChargingStopCard';
import TripSummary from '../components/TripSummary';
import { generateChargingPlan, ChargingPlanResult, formatChargingPlanForUI, validateChargingPlan, generateAdvancedChargingPlan } from '../utils/chargingPlanCalculator';
import { formatDuration } from '../lib/energyUtils';

import { 
  EnergyCalculator, 
  planRouteWithCharging, 
  ChargingStation as NewChargingStation, 
  RoutePlanResult 
} from '../lib/energyUtils';

import { getElevationForPolyline, buildSegmentData, calculateSegmentEnergy, downsamplePolyline } from '../utils/elevationEnergy';
import { runAllTests } from '../utils/testUtils';

// Google Maps API Key - Production'da environment variable'dan alınmalı
const GOOGLE_MAPS_API_KEY = ENV.GOOGLE_MAPS_API_KEY;

// Haversine formula ile mesafe hesapla (km)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Google Encoded Polyline Decoder
function decodePolyline(encoded: string) {
  let points = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;
  
  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;
    
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;
    
    points.push({ 
      latitude: lat / 1e5, 
      longitude: lng / 1e5 
    });
  }
  return points;
}

interface RouteInfo {
  distance: number; // meters
  duration: number; // seconds
  polylinePoints: Array<{ latitude: number; longitude: number }>;
}

// HEX -> RGBA yardımcı fonksiyonu
const hexToRgba = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

// --- YARDIMCI FONKSİYONLAR: Maliyet, Süre, SOC Grafik, Özet Kart ---

// 1. Şarj Maliyet Hesaplama
export function calculateChargeCost(energyAdded: number, pricePerKWh: number): string {
  if (typeof energyAdded !== 'number' || typeof pricePerKWh !== 'number') return '₺0';
  const cost = energyAdded * pricePerKWh;
  return `₺${cost.toFixed(2)}`;
}

// 2. Toplam Yolculuk Süresi Hesabı
function parseTimeToMinutes(time: string): number {
  const hourMatch = time.match(/(\d+)\s*h/);
  const minMatch = time.match(/(\d+)\s*min/);
  const hours = hourMatch ? parseInt(hourMatch[1], 10) : 0;
  const mins = minMatch ? parseInt(minMatch[1], 10) : 0;
  return hours * 60 + mins;
}

export function sumTimes(...times: string[]): string {
  const totalMins = times.reduce((sum, t) => sum + parseTimeToMinutes(t), 0);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
}

// 3. SOC Değişim Grafiği Verisi
export type Segment = {
  from: string;
  to: string;
  startSOC: number; // 0-1 arası
  endSOC: number;   // 0-1 arası
};

export type SocGraphPoint = { point: string; SOC: number };

export function generateSocGraph(segments: Segment[]): SocGraphPoint[] {
  const graph: SocGraphPoint[] = [];
  if (segments.length === 0) return graph;
  graph.push({ point: segments[0].from, SOC: Math.round(segments[0].startSOC * 100) });
  segments.forEach((seg, i) => {
    graph.push({ point: `${seg.to} (önce)`, SOC: Math.round(seg.endSOC * 100) });
    if (i < segments.length - 1 && segments[i + 1].startSOC > seg.endSOC) {
      graph.push({ point: `${seg.to} (sonra)`, SOC: Math.round(segments[i + 1].startSOC * 100) });
    }
  });
  const last = segments[segments.length - 1];
  graph.push({ point: "Finish", SOC: Math.round(last.endSOC * 100) });
  return graph;
}

// 4. Durak Özet Kartı (UI için)
export type StopSummary = {
  station: string;
  socBefore: number; // %
  socAfter: number;  // %
  energyAdded: number; // kWh
  chargeTime: string;  // "26 dk"
  chargeCost: string;  // "₺259"
};

export function formatStopSummaryCard(stop: StopSummary): string {
  return `🛑 ${stop.station} | %${stop.socBefore} → %${stop.socAfter} | ⚡ +${stop.energyAdded} kWh | ⏱️ ${stop.chargeTime} | 💰 ${stop.chargeCost}`;
}

export default function RouteDetailScreen() {
  const navigation = useNavigation();
  const { 
    from, 
    to, 
    fromCoord, 
    toCoord,
    routes,
    routeEVInfo,
    selectedRouteIndex,
    loadingRoutes,
    setRoutes,
    setSelectedRouteIndex,
    setLoadingRoutes,
    clearRoutes
  } = useLocationStore();

  // 🚗 Vehicle Store
  const { getSelectedVehicle, initializeMockData } = useVehicleStore();
  const selectedVehicle = useSelectedVehicle();
  
  const [loading, setLoading] = useState(true);
  const [loadingChargingStations, setLoadingChargingStations] = useState(false);
  const [loadingChargingPlan, setLoadingChargingPlan] = useState(false);
  const [showSummary, setShowSummary] = useState(true);
  const [chargingStations, setChargingStations] = useState<ChargingStation[]>([]);
  const [showChargingStations, setShowChargingStations] = useState(true);
  const [showAllStations, setShowAllStations] = useState(false);
  const [chargingPlan, setChargingPlan] = useState<ChargingPlanResult | null>(null);
  const [showChargingPlan, setShowChargingPlan] = useState(false);
  const [localSelectedRouteIndex, setLocalSelectedRouteIndex] = useState<number | null>(null);
  const mapRef = useRef<MapView>(null);

  // Rota renkleri
  // Route colors - White primary, blue secondary like in screenshot
  const routeColors = ['#FFFFFF', '#2196F3', '#4CAF50', '#FF9800', '#9C27B0'];

  const [elevationEnergy, setElevationEnergy] = useState<{
    totalEnergy: number;
    segmentEnergies: number[];
    segments: any[];
  } | null>(null);

  const [routePlans, setRoutePlans] = useState<ChargingPlanResult[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);

  /**
   * 🧠 Test: Yeni Rota Planlama Fonksiyonu
   */
  const testNewRoutePlanning = useCallback(() => {
    console.log('🧠 Testing new route planning function...');
    
    // Demo veriler
    const routeSegments = [120, 150, 180, 157]; // 607km Antalya-Adana
    const startSOC = 85;
    const targetSOC = 15;
    const batteryCapacity = 50; // Peugeot e-2008
    const consumptionPer100km = 17.8;
    
    const demoStations: NewChargingStation[] = [
      {
        name: 'Trugo Yüreğir',
        lat: 37.0234,
        lng: 35.3311,
        powerKW: 180,
        distanceFromStartKm: 340
      },
      {
        name: 'OtoPriz Saray DC1',
        lat: 36.8868,
        lng: 30.7027,
        powerKW: 120,
        distanceFromStartKm: 115
      }
    ];

    try {
      const result: RoutePlanResult = planRouteWithCharging(
        routeSegments,
        startSOC,
        targetSOC,
        batteryCapacity,
        consumptionPer100km,
        demoStations
      );

      console.log('✅ Route planning completed!');
      console.log(`🏁 Can reach destination: ${result.canReachDestination}`);
      console.log(`🔋 Final SOC: ${typeof result.finalSOC === 'number' ? result.finalSOC.toFixed(1) : '0.0'}%`);
      console.log(`⚡ Charging stops: ${result.chargingStops.length}`);
      console.log(`⏱️ Total charging time: ${result.totalChargingTime}min`);

      Alert.alert(
        '🧠 Yeni Rota Planlama Testi',
        `✅ Test tamamlandı!\n\n` +
        `🏁 Hedefe ulaşabilir: ${result.canReachDestination ? 'Evet' : 'Hayır'}\n` +
        `🔋 Final SOC: ${typeof result.finalSOC === 'number' ? result.finalSOC.toFixed(1) : '0.0'}%\n` +
        `⚡ Şarj durakları: ${result.chargingStops.length}\n` +
        `⏱️ Toplam şarj süresi: ${result.totalChargingTime}dk\n` +
        `📊 Tüketim: ${typeof result.totalEnergyConsumed === 'number' ? result.totalEnergyConsumed.toFixed(1) : '0.0'}kWh`,
        [{ text: 'Tamam' }]
      );

    } catch (error) {
      console.error('❌ Route planning test failed:', error);
      Alert.alert('Test Hatası', `Rota planlama testi başarısız: ${error}`);
    }
  }, []);

  // 🛣️ Multi-route'ları al
  const fetchMultipleRoutes = async () => {
    if (!fromCoord || !toCoord) {
      Alert.alert('Hata', 'Başlangıç ve varış noktası seçilmelidir.');
      setLoading(false);
      return;
    }

    setLoadingRoutes(true);
    setLoading(true);
    
    try {
      console.log('🛣️ Fetching multiple routes...');
      
      const result = await routeService.fetchMultipleRoutes(fromCoord, toCoord);
      
      setRoutes(result.routes, result.evInfo);
      
      console.log(`✅ Successfully loaded ${result.routes.length} routes`, {
        hasAlternatives: result.hasAlternatives,
        routes: result.routes.map((r, i) => ({
          index: i,
          distance: `${(r.distance / 1000).toFixed(1)}km`,
          duration: `${Math.round(r.duration / 60)}min`,
          summary: r.summary
        }))
      });
      
    } catch (error) {
      console.error('❌ Multi-route fetch error:', error);
      Alert.alert(
        'Rota Hatası', 
        'Rotalar yüklenirken bir hata oluştu. Lütfen tekrar deneyin.'
      );
    } finally {
      setLoadingRoutes(false);
      setLoading(false);
    }
  };

  // 🔌 Seçili rotaya göre şarj istasyonlarını al
  const fetchChargingStationsForSelectedRoute = async () => {
    if (!routes || !routes[selectedRouteIndex]?.polylinePoints || routes[selectedRouteIndex].polylinePoints.length === 0) {
      return;
    }

    setLoadingChargingStations(true);
    console.log('🚀 Starting charging station search with optimizations...');
    try {
      console.log(`🔌 Fetching charging stations for route ${selectedRouteIndex + 1}...`);
      
      const selectedRoute = routes[selectedRouteIndex];
      const routeDistanceKm = selectedRoute.distance / 1000;
      
      try {
        const stations = await chargingStationService.findChargingStationsAlongRoute(
          selectedRoute.polylinePoints,
          20, // 20km initial radius (genişletildi)
          300 // 300km battery range (daha uzun menzil)
        );
        
                 // Eğer az istasyon bulunduysa mock data ile destekle
         let finalStations = stations;
         if (stations.length < 3 && fromCoord) {
           console.warn(`⚠️ Only ${stations.length} stations found, adding mock stations for better planning`);
           const mockStations = chargingStationService.getMockChargingStations(fromCoord[0], fromCoord[1]);
           
           // Gerçek ve mock istasyonları birleştir (duplicate'leri kaldırarak)
           const allStations = [...stations];
           mockStations.forEach(mockStation => {
             const exists = stations.some(realStation => {
               const realLat = realStation.AddressInfo?.Latitude;
               const realLng = realStation.AddressInfo?.Longitude;
               const mockLat = mockStation.AddressInfo?.Latitude;
               const mockLng = mockStation.AddressInfo?.Longitude;
               
               return realLat && realLng && mockLat && mockLng &&
                      Math.abs(realLat - mockLat) < 0.01 &&
                      Math.abs(realLng - mockLng) < 0.01;
             });
             if (!exists) {
               allStations.push(mockStation);
             }
           });
           finalStations = allStations;
           console.log(`🔌 Enhanced with mock data: ${finalStations.length} total stations`);
         }
        
        setChargingStations(finalStations);
        console.log(`🔌 Successfully loaded ${finalStations.length} charging stations for route ${selectedRouteIndex + 1}`);
      } catch (error) {
        console.warn('⚠️ API failed, using mock charging stations:', error);
        
        // Mock data kullan
        if (fromCoord) {
          const mockStations = chargingStationService.getMockChargingStations(fromCoord[0], fromCoord[1]);
          setChargingStations(mockStations);
          console.log(`🔌 Using ${mockStations.length} mock charging stations`);
        }
      }
    } catch (error) {
      console.error('❌ Error fetching EV charging stations:', error);
    } finally {
      setLoadingChargingStations(false);
    }
  };

  // 🧮 Şarj planını hesapla
  const generateChargingPlanForRoute = async (stations: ChargingStation[]) => {
    let selectedVehicle = getSelectedVehicle();
    
    // Eğer araç seçili değilse varsayılan bir araç kullan
    if (!selectedVehicle) {
      console.warn('⚠️ No vehicle selected, using default vehicle for charging plan');
      selectedVehicle = {
        id: 'default',
        brand: 'Hyundai',
        model: 'IONIQ 5',
        plate: '35 HYN 789',
        batteryCapacity: 77.4,
        consumption: 16.8,
        socketType: 'CCS',
        createdAt: new Date().toISOString()
      };
    }

    if (!routes || selectedRouteIndex < 0 || selectedRouteIndex >= routes.length) {
      console.warn('⚠️ Invalid route selection');
      return;
    }
    
    const selectedRoute = routes[selectedRouteIndex];
    if (!selectedRoute || !selectedRoute.distance) {
      console.warn('⚠️ No route selected or invalid route data');
      return;
    }

    setLoadingChargingPlan(true);
    try {
      console.log('🧮 Generating charging plan...', {
        vehicle: `${selectedVehicle.brand} ${selectedVehicle.model}`,
        batteryCapacity: `${selectedVehicle.batteryCapacity}kWh`,
        consumption: `${selectedVehicle.consumption}kWh/100km`,
        socketType: selectedVehicle.socketType,
        routeDistance: `${(selectedRoute.distance / 1000).toFixed(1)}km`,
        availableStations: stations.length
      });

      // --- YÜKSEKLİK ENTEGRASYONU BAŞLANGIÇ ---
      // Polyline noktalarını {lat, lng} formatına dönüştür
      const originalPolylinePoints = selectedRoute.polylinePoints.map(p => ({ lat: p.latitude, lng: p.longitude }));
      // 500 m aralıklarla downsample et
      const polylinePoints = downsamplePolyline(originalPolylinePoints, 500);
      let elevationTotalEnergy = null;
      let segmentEnergies: number[] | undefined = undefined;
      try {
        const elevations = await getElevationForPolyline(polylinePoints, ENV.GOOGLE_MAPS_API_KEY);
        const segments = buildSegmentData(polylinePoints, elevations);
        const baseConsumption = selectedVehicle.consumption;
        const regenEfficiency = 0.6; // Varsayılan rejeneratif frenleme verimliliği
        segmentEnergies = segments.map(seg => calculateSegmentEnergy(seg, baseConsumption, regenEfficiency));
        elevationTotalEnergy = segmentEnergies.reduce((sum, e) => sum + e, 0);
        console.log('⚡ Yükseklik+Rejen etkili toplam enerji:', elevationTotalEnergy.toFixed(2), 'kWh');
      } catch (err) {
        console.warn('⚠️ Elevation verisi alınamadı veya hata oluştu:', err);
      }
      // --- YÜKSEKLİK ENTEGRASYONU BİTİŞ ---

      // Route data'yı hazırla
      const routeData = {
        distance: selectedRoute.distance,
        polylinePoints: selectedRoute.polylinePoints
      };

      // Minimum validation
      if (!routeData.distance || routeData.distance < 1000) {
        console.warn('⚠️ Route too short, no charging plan needed');
        setChargingPlan({
          chargingStops: [],
          totalChargingTime: 0,
          canReachDestination: true,
          totalEnergyConsumed: (routeData.distance / 1000) * (selectedVehicle.consumption / 100),
          message: 'Rota çok kısa, şarj gerekmeyebilir',
          timeline: []
        });
        return;
      }

      // Şarj planını hesapla
      const plan = generateAdvancedChargingPlan({
        selectedVehicle,
        routeData,
        chargingStations: stations,
        segmentEnergies,
        startChargePercent: 50 // veya dinamik alınabilir
      });

      // Yükseklik etkili enerji tüketimini warnings'e ekle (demo amaçlı)
      if (elevationTotalEnergy !== null) {
        plan.message = `Yükseklik etkili toplam enerji: ${elevationTotalEnergy.toFixed(2)} kWh`;
      }

      setChargingPlan(plan);
      console.log('✅ Charging plan generated:', {
        stops: plan.chargingStops.length,
        totalTime: `${plan.totalChargingTime}min`,
        canReach: plan.canReachDestination,
        warnings: plan.message ? [plan.message] : [],
      });

      // Sadece kritik uyarıları göster
      const criticalWarnings = plan.message ? [plan.message] : [];
      
      if (criticalWarnings.length > 0) {
        Alert.alert('Önemli Uyarı', criticalWarnings.join('\n\n'), [
          { text: 'Tamam', style: 'default' }
        ]);
      }

    } catch (error: any) {
      console.error('❌ Error generating charging plan:', error);
      
      // Hata tipine göre özel mesajlar
      let errorMessage = 'Şarj planı hesaplanırken bir hata oluştu';
      
      if (error.message) {
        if (error.message.includes('validation')) {
          errorMessage = 'Araç veya rota bilgileri geçersiz';
        } else if (error.message.includes('station')) {
          errorMessage = 'Şarj istasyonları yüklenemedi';
        } else if (error.message.includes('battery')) {
          errorMessage = 'Batarya hesaplamaları yapılamadı';
        }
      }
      
      // Fallback plan oluştur
      const fallbackPlan = {
        chargingStops: [],
        totalChargingTime: 0,
        canReachDestination: false,
        totalEnergyConsumed: (selectedRoute.distance / 1000) * (selectedVehicle.consumption / 100),
        message: errorMessage,
        timeline: []
      };
      
      setChargingPlan(fallbackPlan);
      
      // Kullanıcıya hata mesajını göster
      Alert.alert(
        'Şarj Planı Hatası',
        errorMessage,
        [{ text: 'Tamam', style: 'default' }]
      );
    } finally {
      setLoadingChargingPlan(false);
    }
  };

  // Rota seçimi değiştiğinde
  const handleRouteSelect = (index: number) => {
    console.log(`🎯 Route ${index + 1} selected`);
    setLocalSelectedRouteIndex(index);
    setSelectedRouteIndex(index);
    
    // Şarj planını sıfırla
    setChargingPlan(null);
  };

  // Şarj planı oluşturma fonksiyonu
  const handleCreateChargingPlan = () => {
    if (localSelectedRouteIndex === null) {
      Alert.alert('Uyarı', 'Lütfen önce bir rota seçin.');
      return;
    }
    
    if (chargingStations.length === 0) {
      Alert.alert('Uyarı', 'Şarj istasyonları henüz yüklenmedi. Lütfen bekleyin.');
      return;
    }

    generateChargingPlanForRoute(chargingStations);
  };

  // İlk yükleme
  useEffect(() => {
    // Vehicle mock data'yı initialize et
    initializeMockData();
    
    fetchMultipleRoutes();
    
    // Cleanup function
    return () => {
      clearRoutes();
    };
  }, [fromCoord, toCoord]);

  // Manuel rota seçimi yapıldığında şarj istasyonlarını yükle
  useEffect(() => {
    if (routes.length > 0 && !loading && localSelectedRouteIndex !== null) {
      fetchChargingStationsForSelectedRoute();
    }
  }, [localSelectedRouteIndex, routes, loading]);

  // 🗺️ Harita zoom ayarları - Tüm rotaları göster
  useEffect(() => {
    if (!mapRef.current || routes.length === 0) return;

    const fitMapToAllRoutes = () => {
      // Tüm rota noktalarını topla
      const allPoints = routes.flatMap(route => route.polylinePoints);
      
      if (allPoints.length > 0) {
        console.log(`🗺️ Fitting map to ${routes.length} routes with ${allPoints.length} total points`);
        
        mapRef.current?.fitToCoordinates(allPoints, {
          edgePadding: { 
            top: 100, 
            bottom: showSummary ? 350 : 80, 
            left: 40, 
            right: 40 
          },
          animated: true,
        });
        
        // Ek zoom optimizasyonu
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.fitToCoordinates(allPoints, {
              edgePadding: { 
                top: 80, 
                bottom: showSummary ? 320 : 120, 
                left: 50, 
                right: 50 
              },
              animated: true,
            });
          }
        }, 800);
        
      } else if (fromCoord && toCoord) {
        console.log('🗺️ Fitting to start/end points only');
        
        const coordinates = [
          { latitude: fromCoord[0], longitude: fromCoord[1] },
          { latitude: toCoord[0], longitude: toCoord[1] }
        ];
        
        mapRef.current?.fitToCoordinates(coordinates, {
          edgePadding: { 
            top: 100, 
            bottom: showSummary ? 320 : 100, 
            left: 50, 
            right: 50 
          },
          animated: true,
        });
      }
    };

    // Multiple zoom attempts for better results
    setTimeout(fitMapToAllRoutes, 500);
    setTimeout(fitMapToAllRoutes, 1000);
    
  }, [routes, fromCoord, toCoord, showSummary]);

  // Helper functions
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}s ${minutes}dk`;
    }
    return `${minutes}dk`;
  };

  const formatDistance = (meters: number) => {
    return `${(meters / 1000).toFixed(1)} km`;
  };

  // Calculate time difference from fastest route (like in screenshot +21 min)
  const getTimeDifference = (routeIndex: number) => {
    if (routes.length === 0) return '';
    
    const fastestRoute = routes.reduce((prev, current) => 
      prev.duration < current.duration ? prev : current
    );
    
    const currentRoute = routes[routeIndex];
    const diffMinutes = Math.round((currentRoute.duration - fastestRoute.duration) / 60);
    
    if (diffMinutes === 0) {
      return ''; // Fastest route, no indicator
    }
    
    return `+${diffMinutes} min`;
  };

  // Charging station helper functions
  const getPowerLevel = (station: any): 'ac' | 'fast' | 'ultra' | 'unknown' => {
    const connections = station.Connections || [];
    let maxPower = 0;
    
    connections.forEach((conn: any) => {
      const power = conn.PowerKW || 0;
      if (power > maxPower) maxPower = power;
    });
    
    if (maxPower <= 22) return 'ac';
    if (maxPower >= 23 && maxPower <= 149) return 'fast';
    if (maxPower >= 150) return 'ultra';
    return 'unknown';
  };

  const getMarkerColor = (level: 'ac' | 'fast' | 'ultra' | 'unknown'): string => {
    switch (level) {
      case 'ac': return '#27AE60';      // Green like in screenshot
      case 'fast': return '#FF9800';    // Orange like in screenshot
      case 'ultra': return '#E74C3C';   // Red like in screenshot  
      default: return '#95A5A6';        // Gray for unknown
    }
  };

  const getPowerLevelBadge = (level: 'ac' | 'fast' | 'ultra' | 'unknown'): { emoji: string, text: string, color: string } => {
    switch (level) {
      case 'ac': return { emoji: '🟢', text: 'AC (≤22kW)', color: '#27AE60' };
      case 'fast': return { emoji: '🟠', text: 'DC Fast (23-149kW)', color: '#FF9800' };
      case 'ultra': return { emoji: '🔴', text: 'DC Ultra (≥150kW)', color: '#E74C3C' };
      default: return { emoji: '⚪', text: 'Bilinmiyor', color: '#95A5A6' };
    }
  };

  const renderStationMarker = (station: any, index: number) => {
    if (!station.AddressInfo?.Latitude || !station.AddressInfo?.Longitude) return null;
    
    const powerLevel = getPowerLevel(station);
    const markerColor = getMarkerColor(powerLevel);
    
    // Şarj planında seçili istasyon mu kontrol et
    const chargingStopIndex = chargingPlan?.chargingStops?.findIndex(stop => 
      stop.stationId === station.ID
    );
    const isInChargingPlan = chargingStopIndex !== undefined && chargingStopIndex >= 0;
    
    return (
      <Marker
        key={`charging-${station.ID || `unknown-${index}`}-${index}`}
        coordinate={{
          latitude: station.AddressInfo.Latitude,
          longitude: station.AddressInfo.Longitude,
        }}
        title={station.AddressInfo.Title || 'Şarj İstasyonu'}
        description={`${station.AddressInfo.AddressLine1 || ''} - ${getPowerLevelBadge(powerLevel).text}${isInChargingPlan ? ' (Planlanan Durak)' : ''}`}
        zIndex={isInChargingPlan ? 900 : 800}
      >
        <View style={{ 
          backgroundColor: isInChargingPlan ? '#FF4500' : markerColor, 
          padding: isInChargingPlan ? 10 : 8, 
          borderRadius: isInChargingPlan ? 25 : 20,
          borderWidth: isInChargingPlan ? 4 : 3,
          borderColor: isInChargingPlan ? '#FFF' : 'white',
          elevation: isInChargingPlan ? 8 : 5,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: isInChargingPlan ? 3 : 2 },
          shadowOpacity: isInChargingPlan ? 0.4 : 0.3,
          shadowRadius: isInChargingPlan ? 5 : 3,
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: isInChargingPlan ? 36 : 28,
          minHeight: isInChargingPlan ? 36 : 28,
        }}>
          <Text style={{ 
            color: 'white', 
            fontSize: isInChargingPlan ? 16 : 14, 
            fontWeight: 'bold' 
          }}>
            {isInChargingPlan ? (chargingStopIndex + 1).toString() : '⚡'}
          </Text>
        </View>
      </Marker>
    );
  };

  // 🎯 Seçili rota
  const selectedRoute = routes[selectedRouteIndex];
  const selectedEVInfo = routeEVInfo[selectedRouteIndex];

  const handleRunTests = async () => {
    try {
      await runAllTests();
    } catch (error) {
      console.error('Test çalıştırma hatası:', error);
    }
  };

  // Her rota için gerçek şarj planı hesapla
  useEffect(() => {
    if (!routes || routes.length === 0 || chargingStations.length === 0) {
      setRoutePlans([]);
      return;
    }
    setPlansLoading(true);
    Promise.all(
      routes.map(route => {
        const routeData = { distance: route.distance, polylinePoints: route.polylinePoints };
        return generateChargingPlan({
          selectedVehicle: selectedVehicle!,
          routeData,
          chargingStations
        });
      })
    ).then(plans => {
      setRoutePlans(plans);
      setPlansLoading(false);
    });
  }, [routes, chargingStations, selectedVehicle]);

  // Loading state
  if (loading || loadingRoutes) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: '#f5f7fa',
        paddingHorizontal: 32
      }}>
        <Card style={{ 
          backgroundColor: 'white', 
          borderRadius: 20,
          paddingHorizontal: 36,
          paddingVertical: 48,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          alignItems: 'center',
          minWidth: 280
        }}>
          <ActivityIndicator size="large" color="#FF4500" style={{ marginBottom: 24 }} />
          <Text style={{ 
            fontSize: 19, 
            fontWeight: 'bold', 
            color: '#2C3E50',
            textAlign: 'center',
            marginBottom: 12
          }}>
            Rotalar Yükleniyor
          </Text>
          <Text style={{ 
            fontSize: 15, 
            color: '#7F8C8D',
            textAlign: 'center',
            lineHeight: 22
          }}>
            Alternatif rotalar hesaplanıyor ve EV analizi yapılıyor...
          </Text>
        </Card>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f7fa' }}>
      {/* Harita Alanı */}
      <View style={{ flex: showSummary ? 0.55 : 1 }}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={{ flex: 1 }}
          initialRegion={{
            latitude: fromCoord && toCoord ? 
              (fromCoord[0] + toCoord[0]) / 2 : 
              (fromCoord ? fromCoord[0] : 39.9334),
            longitude: fromCoord && toCoord ? 
              (fromCoord[1] + toCoord[1]) / 2 : 
              (fromCoord ? fromCoord[1] : 32.8597),
            latitudeDelta: fromCoord && toCoord ? 
              Math.abs(fromCoord[0] - toCoord[0]) * 1.2 : 0.5,
            longitudeDelta: fromCoord && toCoord ? 
              Math.abs(fromCoord[1] - toCoord[1]) * 1.2 : 0.5,
          }}
          showsUserLocation={true}
          showsMyLocationButton={true}
          mapType="standard"
          zoomEnabled={true}
          scrollEnabled={true}
          pitchEnabled={false}
          rotateEnabled={true}
          onMapReady={() => {
            console.log('🗺️ Map is ready');
            
            // Harita hazır olduğunda tüm rotaları göster
            if (routes.length > 0) {
              setTimeout(() => {
                const allPoints = routes.flatMap(route => route.polylinePoints);
                if (allPoints.length > 0) {
                  mapRef.current?.fitToCoordinates(allPoints, {
                    edgePadding: { 
                      top: 80, 
                      bottom: showSummary ? 300 : 80, 
                      left: 40, 
                      right: 40 
                    },
                    animated: true,
                  });
                }
              }, 300);
            }
          }}
        >
          {/* Tüm Rotalar */}
          {routes.map((route, index) => {
            const isSelected = localSelectedRouteIndex === index;
            const routeColor = routeColors[index % routeColors.length];
            const polylineColor = isSelected ? routeColor : hexToRgba(routeColor, 0.5);
            // Sadece gerçek polyline varsa çiz
            if (route.polylinePoints.length > 2) {
              return (
                <Polyline
                  key={`route-polyline-${index}`}
                  coordinates={route.polylinePoints}
                  strokeColor={polylineColor}
                  strokeWidth={isSelected ? 10 : 5}
                  lineCap="round"
                  lineJoin="round"
                  zIndex={850 + index}
                />
              );
            } else if (isSelected) {
              // Eğer seçili rota ve polyline kısa ise uyarı göster
              return (
                <View key={`route-polyline-warning-${index}`} style={{ position: 'absolute', top: 60, left: 0, right: 0, alignItems: 'center', zIndex: 2000 }}>
                  <Text style={{ backgroundColor: '#FFD2D2', color: '#D32F2F', padding: 8, borderRadius: 8, fontWeight: 'bold' }}>
                    Rota verisi alınamadı, lütfen tekrar deneyin.
                  </Text>
                </View>
              );
            }
            return null;
          })}

          {/* Başlangıç Marker */}
          {fromCoord && (
            <Marker 
              key="start-marker"
              coordinate={{ latitude: fromCoord[0], longitude: fromCoord[1] }}
              title="Başlangıç"
              description={from}
              zIndex={1000}
            >
              <View style={{ 
                backgroundColor: '#4CAF50', 
                padding: 12, 
                borderRadius: 25,
                borderWidth: 4,
                borderColor: 'white',
                elevation: 8,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>●</Text>
              </View>
            </Marker>
          )}

          {/* Bitiş Marker */}
          {toCoord && (
            <Marker 
              key="end-marker"
              coordinate={{ latitude: toCoord[0], longitude: toCoord[1] }}
              title="Varış"
              description={to}
              zIndex={1000}
            >
              <View style={{ 
                backgroundColor: '#F44336', 
                padding: 12, 
                borderRadius: 25,
                borderWidth: 4,
                borderColor: 'white',
                elevation: 8,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>🏁</Text>
              </View>
            </Marker>
          )}

          {/* Şarj İstasyonu Markerları */}
          {showChargingStations && chargingStations.map((station, index) => 
            renderStationMarker(station, index)
          )}

          {/* Şarj Planı Durakları - Özel Marker'lar */}
          {chargingPlan && chargingPlan.chargingStops.map((stop, index) => (
            <Marker
              key={`charging-plan-${stop.stationId}-${index}`}
              coordinate={stop.stopCoord}
              title={`🔋 Durak ${index + 1}: ${stop.name}`}
              description={`⚡ ${stop.stationPowerKW}kW | ⏱️ ${stop.estimatedChargeTimeMinutes}dk | 🔋 ${stop.batteryBeforeStopPercent}% → ${stop.batteryAfterStopPercent}%`}
              zIndex={1000}
            >
              <View style={{ 
                backgroundColor: '#FF4500', 
                padding: 10, 
                borderRadius: 20,
                borderWidth: 4,
                borderColor: 'white',
                elevation: 8,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.4,
                shadowRadius: 4,
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 32,
                minHeight: 32,
              }}>
                <Text style={{ 
                  color: 'white', 
                  fontSize: 12, 
                  fontWeight: 'bold' 
                }}>
                  {index + 1}
                </Text>
              </View>
            </Marker>
          ))}
        </MapView>
      </View>

      {/* Bottom Section */}
      {showSummary && (
        <View style={{ 
          flex: 0.45, 
          backgroundColor: 'white',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingTop: 8,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
        }}>
          {/* Drag Handle */}
          <View style={{ 
            alignItems: 'center', 
            paddingVertical: 8 
          }}>
            <View style={{ 
              width: 40, 
              height: 4, 
              backgroundColor: '#E0E0E0', 
              borderRadius: 2 
            }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Route Selection */}
            {routes.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ 
                  fontSize: 18, 
                  fontWeight: 'bold', 
                  color: '#2C3E50',
                  marginHorizontal: 16,
                  marginBottom: 12
                }}>
                  🛣️ Rota Seçin ({routes.length} seçenek)
                </Text>
                
                <FlatList
                  data={routes}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(_, idx) => `route-card-${idx}`}
                  renderItem={({ item, index }) => (
                    <RouteCard
                      route={item}
                      evInfo={routePlans[index] ? {
                        estimatedConsumption: routePlans[index].totalEnergyConsumed,
                        estimatedCost: 0, // maliyet hesaplanıyorsa ekle
                        chargingStopsRequired: routePlans[index].chargingStops.length,
                        remainingBatteryAtDestination: 0
                      } : {
                        estimatedConsumption: 0,
                        estimatedCost: 0,
                        chargingStopsRequired: 0,
                        remainingBatteryAtDestination: 0
                      }}
                      index={index}
                      isSelected={localSelectedRouteIndex === index}
                      onSelect={handleRouteSelect}
                      routeColors={routeColors}
                      loading={plansLoading || !routePlans[index]}
                    />
                  )}
                  contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}
                  style={{ maxHeight: 180 }}
                />
                
                {/* Yükleme Durumu Göstergesi - ChatGPT önerisi */}
                {loadingChargingStations && localSelectedRouteIndex !== null && (
                  <View style={{ 
                    marginHorizontal: 16, 
                    marginTop: 16,
                    backgroundColor: '#F8F9FA',
                    padding: 16,
                    borderRadius: 12,
                    flexDirection: 'row',
                    alignItems: 'center'
                  }}>
                    <ActivityIndicator size="small" color={routeColors[localSelectedRouteIndex % routeColors.length]} />
                    <Text style={{ 
                      marginLeft: 12,
                      color: '#6C757D',
                      fontSize: 14
                    }}>
                      🔍 Rota boyunca şarj istasyonları aranıyor...
                    </Text>
                  </View>
                )}
                
                {/* Planı Oluştur Butonu */}
                {localSelectedRouteIndex !== null && !loadingChargingStations && (
                  <View style={{ 
                    marginHorizontal: 16, 
                    marginTop: 16 
                  }}>
                    <Button 
                      mode="contained" 
                      onPress={handleCreateChargingPlan}
                      loading={loadingChargingPlan}
                      disabled={loadingChargingStations || loadingChargingPlan || chargingStations.length === 0}
                      style={{ 
                        backgroundColor: chargingStations.length === 0 ? '#BDC3C7' : routeColors[localSelectedRouteIndex % routeColors.length],
                        borderRadius: 12,
                        elevation: 4
                      }}
                      contentStyle={{ paddingVertical: 8 }}
                      icon="lightning-bolt"
                    >
                      <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
                        {chargingStations.length === 0 ? '⏳ İstasyonlar Yükleniyor...' : '⚡ Şarj Planını Oluştur'}
                      </Text>
                    </Button>
                    
                    {chargingStations.length > 0 && (
                      <Text style={{ 
                        textAlign: 'center', 
                        marginTop: 8, 
                        fontSize: 12, 
                        color: '#27AE60',
                        fontWeight: '500'
                      }}>
                        ✅ {chargingStations.length} şarj istasyonu bulundu
                      </Text>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Action Buttons */}
            {localSelectedRouteIndex !== null && chargingPlan && (
              <View style={{ 
                flexDirection: 'row', 
                marginHorizontal: 16, 
                marginBottom: 16,
                gap: 8
              }}>
                <Button 
                  mode="contained" 
                  onPress={handleRunTests}
                  style={{ 
                    flex: 1, 
                    backgroundColor: routeColors[localSelectedRouteIndex % routeColors.length],
                    borderRadius: 12
                  }}
                  contentStyle={{ paddingVertical: 4 }}
                >
                  <Text style={{ color: 'white', fontWeight: 'bold' }}>
                    🧪 Testleri Çalıştır
                  </Text>
                </Button>
              </View>
            )}

            {/* 🔋 EV Şarj Planı Section */}
            {chargingPlan && (
              <View style={{ marginTop: 10 }}>
                {/* Yolculuk Özeti */}
                <View style={{ backgroundColor: '#F5F8FA', borderRadius: 12, margin: 10, padding: 14, elevation: 1 }}>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1976D2', marginBottom: 6 }}>🚗 Yolculuk Özeti</Text>
                  <Text style={{ fontSize: 15, color: '#333' }}>
                    Toplam Süre: <Text style={{ fontWeight: 'bold' }}>{sumTimes(
                      `${Math.floor(selectedRoute?.duration ? selectedRoute.duration / 60 : 0)}h ${(selectedRoute?.duration ? Math.round(selectedRoute.duration % 3600 / 60) : 0)}min`,
                      `${chargingPlan.totalChargingTime}min`
                    )}</Text>  |
                    Toplam Mesafe: <Text style={{ fontWeight: 'bold' }}>{selectedRoute?.distance ? (selectedRoute.distance / 1000).toFixed(1) : 0} km</Text>
                  </Text>
                  <Text style={{ fontSize: 15, color: '#333', marginTop: 2 }}>
                    Şarj Süresi: <Text style={{ fontWeight: 'bold' }}>{chargingPlan.chargingStops.reduce((t, s) => t + s.estimatedChargeTimeMinutes, 0)} dk</Text>  |
                    Şarj Sayısı: <Text style={{ fontWeight: 'bold' }}>{chargingPlan.chargingStops.length}</Text>
                  </Text>
                  <Text style={{ fontSize: 15, color: '#333', marginTop: 2 }}>
                    Toplam Maliyet: <Text style={{ fontWeight: 'bold', color: '#D32F2F' }}>{chargingPlan.totalCost ? `₺${chargingPlan.totalCost.toFixed(2)}` : '-'}</Text>
                  </Text>
                  <Text style={{ fontSize: 15, color: '#333', marginTop: 2 }}>
                    Başlangıç SOC: <Text style={{ fontWeight: 'bold' }}>{chargingPlan.chargingStops.length > 0 ? chargingPlan.chargingStops[0].batteryBeforeStopPercent : 100}%</Text>  |
                    Varışta Kalan SOC: <Text style={{ fontWeight: 'bold' }}>{chargingPlan.chargingStops.length > 0 ? chargingPlan.chargingStops[chargingPlan.chargingStops.length - 1].batteryAfterStopPercent : 100}%</Text>
                  </Text>
                  {/* SOC Değişim Grafiği Dizisi */}
                  <Text style={{ fontSize: 15, color: '#1976D2', marginTop: 8, fontWeight: 'bold' }}>SOC Değişim Grafiği Verisi:</Text>
                  <Text style={{ fontSize: 13, color: '#333', marginTop: 2 }}>
                    {chargingPlan.socGraph ? JSON.stringify(chargingPlan.socGraph) :
                      JSON.stringify(generateSocGraph(
                        chargingPlan.chargingStops.map((stop, idx, arr) => ({
                          from: idx === 0 ? 'Start' : arr[idx - 1].name,
                          to: stop.name,
                          startSOC: (stop.batteryBeforeStopPercent || 0) / 100,
                          endSOC: (stop.batteryAfterStopPercent || 0) / 100
                        }))
                      ))}
                  </Text>
                  {chargingPlan.message && (
                    <Text style={{ color: '#D32F2F', fontWeight: 'bold', fontSize: 15, marginTop: 8 }}>{chargingPlan.message}</Text>
                  )}
                </View>
                {/* Şarj Durakları & Segmentler */}
                {chargingPlan && chargingPlan.chargingStops.length > 0 && (
                  <View style={{ marginHorizontal: 10, marginBottom: 10 }}>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1976D2', marginBottom: 6 }}>🔌 Şarj Durakları & Segmentler</Text>
                    {chargingPlan.chargingStops.map((stop, idx) => {
                      // Fiyatı istasyondan al, yoksa varsayılan 7.99₺
                      const stationObj = chargingStations.find(s => s.ID === stop.stationId);
                      const pricePerKWh = (stationObj && ((stationObj as any).pricePerKWh || (stationObj as any).CustomFields?.pricePerKWh || (stationObj as any).price || (stationObj as any).PricePerKWh)) || 7.99;
                      const cost = calculateChargeCost(stop.energyChargedKWh, pricePerKWh);
                      const summary = formatStopSummaryCard({
                        station: stop.name,
                        socBefore: stop.batteryBeforeStopPercent,
                        socAfter: stop.batteryAfterStopPercent,
                        energyAdded: stop.energyChargedKWh,
                        chargeTime: `${stop.estimatedChargeTimeMinutes} dk`,
                        chargeCost: cost
                      });
                      return (
                        <Card key={`stop-summary-${idx}`} style={{ marginBottom: 8, backgroundColor: '#F8F9FA', borderRadius: 8 }}>
                          <Card.Content>
                            <Text style={{ fontSize: 15, color: '#333', fontWeight: 'bold' }}>{summary}</Text>
                          </Card.Content>
                        </Card>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* Loading Charging Plan */}
            {loadingChargingPlan && (
              <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
                <Card style={{ backgroundColor: 'white', elevation: 2, borderRadius: 12 }}>
                  <Card.Content style={{ padding: 16, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#FF4500" style={{ marginBottom: 8 }} />
                    <Text style={{ fontSize: 14, color: '#7F8C8D' }}>
                      Şarj planı hesaplanıyor...
                    </Text>
                  </Card.Content>
                </Card>
              </View>
            )}

            {/* Charging Stations Section */}
            <View style={{ marginHorizontal: 16, marginBottom: 20 }}>
              <View style={{ 
                flexDirection: 'row', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: 12
              }}>
                <Text style={{ 
                  fontSize: 18, 
                  fontWeight: 'bold', 
                  color: '#2C3E50'
                }}>
                  Şarj İstasyonları ({chargingStations.length})
                </Text>
                
                <TouchableOpacity onPress={() => setShowChargingStations(!showChargingStations)}>
                  <Chip 
                    mode="flat"
                    style={{ backgroundColor: showChargingStations ? '#E8F5E8' : '#F5F5F5' }}
                  >
                    <Text style={{ 
                      color: showChargingStations ? '#27AE60' : '#7F8C8D',
                      fontWeight: 'bold'
                    }}>
                      {showChargingStations ? 'Gizle' : 'Göster'}
                    </Text>
                  </Chip>
                </TouchableOpacity>
              </View>
              
              {loadingChargingStations ? (
                <Card style={{ backgroundColor: '#F8F9FA', elevation: 1, borderRadius: 12 }}>
                  <Card.Content style={{ 
                    padding: 24,
                    alignItems: 'center'
                  }}>
                    <ActivityIndicator size="small" color="#FF4500" style={{ marginBottom: 12 }} />
                    <Text style={{ 
                      fontSize: 14, 
                      color: '#7F8C8D',
                      textAlign: 'center'
                    }}>
                      Şarj istasyonları yükleniyor...
                    </Text>
                  </Card.Content>
                </Card>
              ) : chargingStations.length > 0 ? (
                <View>
                  {/* Power Level Legend */}
                  <View style={{ 
                    flexDirection: 'row', 
                    justifyContent: 'space-around',
                    marginBottom: 12,
                    backgroundColor: '#F8F9FA',
                    padding: 12,
                    borderRadius: 8
                  }}>
                    {[
                      getPowerLevelBadge('ac'),
                      getPowerLevelBadge('fast'),
                      getPowerLevelBadge('ultra')
                    ].map((badge, index) => (
                      <View key={index} style={{ alignItems: 'center', flex: 1 }}>
                        <Text style={{ fontSize: 16, marginBottom: 2 }}>{badge.emoji}</Text>
                        <Text style={{ 
                          fontSize: 10, 
                          color: badge.color, 
                          fontWeight: 'bold',
                          textAlign: 'center'
                        }}>
                          {badge.text}
                        </Text>
                      </View>
                    ))}
                  </View>
                  
                  {/* Station List */}
                  {chargingStations
                    .slice(0, showAllStations ? undefined : 5)
                    .map((station, index) => {
                      const powerLevel = getPowerLevel(station);
                      const badge = getPowerLevelBadge(powerLevel);
                      
                      return (
                        <Card 
                          key={`station-${station.ID || 'unknown'}-${index}`} 
                          style={{ 
                            marginBottom: 8, 
                            backgroundColor: 'white',
                            elevation: 1,
                            borderRadius: 8
                          }}
                        >
                          <Card.Content style={{ padding: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text style={{ fontSize: 18, marginRight: 8 }}>{badge.emoji}</Text>
                              <View style={{ flex: 1 }}>
                                <Text style={{ 
                                  fontSize: 14, 
                                  fontWeight: 'bold', 
                                  color: '#2C3E50',
                                  marginBottom: 2
                                }}>
                                  {station.AddressInfo?.Title || 'Şarj İstasyonu'}
                                </Text>
                                <Text style={{ 
                                  fontSize: 12, 
                                  color: '#7F8C8D',
                                  marginBottom: 4
                                }}>
                                  {station.AddressInfo?.AddressLine1 || 'Adres bilgisi yok'}
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                  <Chip
                                    mode="flat"
                                    style={{ 
                                      backgroundColor: badge.color + '20',
                                      height: 24,
                                      marginRight: 8
                                    }}
                                    textStyle={{ 
                                      fontSize: 10, 
                                      color: badge.color,
                                      fontWeight: 'bold'
                                    }}
                                  >
                                    {badge.text}
                                  </Chip>
                                  
                                  {station.StatusType?.Title && (
                                    <Chip
                                      mode="flat"
                                      style={{ 
                                        backgroundColor: station.StatusType.Title === 'Operational' ? '#E8F5E8' : '#FFF3E0',
                                        height: 24
                                      }}
                                      textStyle={{ 
                                        fontSize: 10, 
                                        color: station.StatusType.Title === 'Operational' ? '#27AE60' : '#F57C00',
                                        fontWeight: 'bold'
                                      }}
                                    >
                                      {station.StatusType.Title === 'Operational' ? 'Aktif' : 'Belirsiz'}
                                    </Chip>
                                  )}
                                </View>
                              </View>
                            </View>
                          </Card.Content>
                        </Card>
                      );
                    })}
                  
                  {/* Show More/Less Button */}
                  {chargingStations.length > 5 && (
                    <TouchableOpacity 
                      onPress={() => setShowAllStations(!showAllStations)}
                      style={{ 
                        alignItems: 'center', 
                        paddingVertical: 12,
                        backgroundColor: '#F8F9FA',
                        borderRadius: 8,
                        marginTop: 8
                      }}
                    >
                      <Text style={{ 
                        color: '#FF4500', 
                        fontWeight: 'bold',
                        fontSize: 14
                      }}>
                        {showAllStations 
                          ? 'Daha Az Göster' 
                          : `${chargingStations.length - 5} İstasyon Daha Göster`
                        }
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <Card style={{ backgroundColor: '#FFF3E0', elevation: 1, borderRadius: 12 }}>
                  <Card.Content style={{ padding: 16, alignItems: 'center' }}>
                    <Text style={{ fontSize: 32, marginBottom: 8 }}>🔌</Text>
                    <Text style={{ 
                      fontSize: 14, 
                      color: '#F57C00', 
                      fontWeight: 'bold',
                      textAlign: 'center'
                    }}>
                      Bu rota boyunca şarj istasyonu bulunamadı
                    </Text>
                  </Card.Content>
                </Card>
              )}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Yükseklikli Enerji Butonu */}
      <TouchableOpacity
        style={{
          position: 'absolute',
          top: 100,
          right: 20,
          backgroundColor: '#1976D2',
          padding: 10,
          borderRadius: 8,
          zIndex: 1000,
        }}
        onPress={async () => {
          if (!selectedRoute) return;
          // Polyline noktalarını {lat, lng} formatına dönüştür
          const polylinePoints = selectedRoute.polylinePoints.map(p => ({ lat: p.latitude, lng: p.longitude }));
          try {
            const elevations = await getElevationForPolyline(polylinePoints, ENV.GOOGLE_MAPS_API_KEY);
            const segments = buildSegmentData(polylinePoints, elevations);
            const baseConsumption = selectedVehicle?.consumption || 17.8;
            const segmentEnergies = segments.map(seg => calculateSegmentEnergy(seg, baseConsumption));
            const totalEnergy = segmentEnergies.reduce((sum, e) => sum + e, 0);
            setElevationEnergy({ totalEnergy, segmentEnergies, segments });
            Alert.alert('Yükseklikli Enerji', `Toplam: ${totalEnergy.toFixed(2)} kWh`);
          } catch (err: any) {
            Alert.alert('Hata', err.message || 'Bilinmeyen hata');
          }
        }}
      >
        <Text style={{ color: 'white', fontWeight: 'bold' }}>Yokuşlu Enerji</Text>
      </TouchableOpacity>

      {/* Yükseklikli Enerji Sonucu */}
      {elevationEnergy && (
        <View style={{ padding: 16, backgroundColor: '#fff', margin: 10, borderRadius: 8 }}>
          <Text>Toplam Enerji: {elevationEnergy.totalEnergy.toFixed(2)} kWh</Text>
          {elevationEnergy.segments.map((seg, i) => (
            <Text key={i}>
              Segment {i + 1}: {seg.distance_km.toFixed(2)} km, Δh: {seg.elevation_diff_m.toFixed(1)} m, Enerji: {elevationEnergy.segmentEnergies[i].toFixed(3)} kWh
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  buttonContainer: {
    position: 'absolute',
    top: 100,
    right: 20,
    zIndex: 1000,
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 8,
  },
  testButton: {
    backgroundColor: '#6c5ce7',
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
}); 