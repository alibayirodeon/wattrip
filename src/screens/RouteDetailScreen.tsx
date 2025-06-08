import React, { useEffect, useState, useRef } from 'react';
import { View, ScrollView, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { Text, Card, Button, Chip, Divider } from 'react-native-paper';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import { useLocationStore } from '../context/useLocationStore';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import chargingStationService, { ChargingStation, getChargingSearchPoints } from '../services/chargingStationService';

// Google Maps API Key - Production'da environment variable'dan alınmalı
const GOOGLE_MAPS_API_KEY = 'AIzaSyC1RCUy97Gu_yFZuCSi9lFP2Utv3pm75Mc';

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

export default function RouteDetailScreen() {
  const navigation = useNavigation();
  const { from, to, fromCoord, toCoord } = useLocationStore();
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingChargingStations, setLoadingChargingStations] = useState(false);
  const [showSummary, setShowSummary] = useState(true);
  const [chargingStations, setChargingStations] = useState<ChargingStation[]>([]);
  const [showChargingStations, setShowChargingStations] = useState(true);
  const [showAllStations, setShowAllStations] = useState(false);
  const mapRef = useRef<MapView>(null);

  // Google Directions API'den rota bilgisi al
  const fetchRouteData = async () => {
      if (!fromCoord || !toCoord) {
        Alert.alert('Hata', 'Başlangıç ve varış noktası seçilmelidir.');
        setLoading(false);
        return;
      }

      setLoading(true);
    try {
      const url = `https://maps.googleapis.com/maps/api/directions/json`;
      const params = {
        origin: `${fromCoord[0]},${fromCoord[1]}`,
        destination: `${toCoord[0]},${toCoord[1]}`,
        key: GOOGLE_MAPS_API_KEY,
        mode: 'driving',
        language: 'tr'
      };

             const response = await axios.get(url, { params });
       
       console.log('Google Directions API response:', response.data);
       
       if (!response.data.routes || response.data.routes.length === 0) {
         console.error('No routes found in response:', response.data);
         throw new Error('Rota bulunamadı');
       }

      const route = response.data.routes[0];
      const leg = route.legs[0];
      
      // Polyline'ı decode et
      const polylinePoints = decodePolyline(route.overview_polyline.points);
      
      setRouteInfo({
        distance: leg.distance.value, // meters
        duration: leg.duration.value, // seconds
        polylinePoints: polylinePoints
      });
      
      console.log('Polyline points count:', polylinePoints.length);
      console.log('First 3 polyline points:', polylinePoints.slice(0, 3));
      
      // Force zoom after setting route data
      setTimeout(() => {
        if (mapRef.current && polylinePoints.length > 1) {
          console.log('Force zooming to route...');
          mapRef.current.fitToCoordinates(polylinePoints, {
            edgePadding: { top: 120, bottom: 380, left: 80, right: 80 },
            animated: true,
          });
        }
      }, 2000);

         } catch (error) {
       console.error('Route fetch error:', error);
       
       // API başarısız olursa mock data ile test edelim
       if (fromCoord && toCoord) {
         console.log('Using mock route data for testing...');
         
         // Basit straight line polyline oluştur
         const mockPolylinePoints = [
           { latitude: fromCoord[0], longitude: fromCoord[1] },
           { latitude: toCoord[0], longitude: toCoord[1] }
         ];
         
         // Yaklaşık mesafe hesapla (Haversine formula)
         const distance = calculateDistance(fromCoord[0], fromCoord[1], toCoord[0], toCoord[1]);
         const mockDuration = Math.round(distance * 60); // 1km = 1 dakika varsayımı
         
         setRouteInfo({
           distance: distance * 1000, // meters
           duration: mockDuration, // seconds  
           polylinePoints: mockPolylinePoints
         });
         
         console.log('Mock route created:', { distance, duration: mockDuration });
         console.log('Mock polyline points:', mockPolylinePoints);
       } else {
         Alert.alert(
           'Rota Hatası', 
           'Rota hesaplanırken bir hata oluştu. Lütfen tekrar deneyin.'
         );
       }
            } finally {
       setLoading(false);
     }
  };

  // Şarj istasyonlarını al
  const fetchChargingStations = async () => {
    if (!routeInfo?.polylinePoints || routeInfo.polylinePoints.length === 0) {
      return;
    }

    setLoadingChargingStations(true);
    try {
      console.log('🔌 Fetching charging stations along route...');
      
      // Geliştirilmiş algoritma ile şarj istasyonlarını bul
      try {
        const stations = await chargingStationService.findChargingStationsAlongRoute(
          routeInfo.polylinePoints,
          15 // 15km initial radius (adaptif olarak 25, 35km'ye kadar çıkabilir)
        );
        setChargingStations(stations);
        console.log(`🔌 Successfully loaded ${stations.length} charging stations with improved algorithm`);
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
      console.error('❌ Error fetching charging stations:', error);
    } finally {
      setLoadingChargingStations(false);
    }
  };

  useEffect(() => {
    fetchRouteData();
  }, [fromCoord, toCoord]);

  // Rota yüklendikten sonra şarj istasyonlarını al
  useEffect(() => {
    if (routeInfo && !loading) {
      fetchChargingStations();
    }
  }, [routeInfo, loading]);

  // Gelişmiş harita otomatik zoom ayarla
  useEffect(() => {
    if (!mapRef.current) return;

    const fitMapToRoute = () => {
      if (routeInfo?.polylinePoints && routeInfo.polylinePoints.length > 1) {
        console.log('🗺️ Fitting to route with', routeInfo.polylinePoints.length, 'polyline points');
        
        // Tüm polyline noktalarını kullan
        mapRef.current?.fitToCoordinates(routeInfo.polylinePoints, {
          edgePadding: { 
            top: 100, 
            bottom: showSummary ? 300 : 100, 
            left: 50, 
            right: 50 
          },
          animated: true,
        });
        
        // Ek zoom optimizasyonu - biraz daha yakınlaştır
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.fitToCoordinates(routeInfo.polylinePoints, {
              edgePadding: { 
                top: 80, 
                bottom: showSummary ? 280 : 80, 
                left: 40, 
                right: 40 
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
            bottom: showSummary ? 300 : 100, 
            left: 50, 
            right: 50 
          },
        animated: true,
      });
    }
    };

    // İlk zoom - hızlı
    setTimeout(fitMapToRoute, 500);
    
    // İkinci zoom - daha optimize
    setTimeout(fitMapToRoute, 1000);
    
  }, [routeInfo, fromCoord, toCoord, showSummary]);

  // Süre formatla (saat/dakika)
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}sa ${minutes}dk`;
    }
    return `${minutes}dk`;
  };

  // Mesafe formatla (km)
  const formatDistance = (meters: number) => {
    return (meters / 1000).toFixed(1);
  };

  // Navigasyon başlat
  const handleStartNavigation = () => {
    Alert.alert(
      'Navigasyon Başlat',
      'Harici navigasyon uygulamasında rotayı açmak istiyor musunuz?',
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Aç', onPress: () => {
          console.log('Navigation started');
          // Buraya harici navigasyon entegrasyonu eklenebilir
        }}
      ]
    );
  };

  // Rotayı kaydet
  const handleSaveRoute = () => {
    Alert.alert('Başarılı', 'Rota favorilerinize kaydedildi!');
  };

  // 🔌 Şarj istasyonu güç seviyesi ve renk hesaplama fonksiyonları
  const getPowerLevel = (station: any): 'ac' | 'fast' | 'ultra' | 'unknown' => {
    const maxPower = station.Connections?.reduce((max: number, conn: any) => {
      const power = conn?.PowerKW || 0;
      return power > max ? power : max;
    }, 0) || 0;

    if (maxPower === 0) return 'unknown';
    if (maxPower <= 22) return 'ac';      // AC Yavaş
    if (maxPower <= 149) return 'fast';   // DC Hızlı
    return 'ultra';                       // DC Ultra Hızlı
  };

  const getMarkerColor = (level: 'ac' | 'fast' | 'ultra' | 'unknown'): string => {
    switch (level) {
      case 'ac': return '#2196F3';      // 🔵 Mavi - AC
      case 'fast': return '#FF9800';    // 🟠 Turuncu - DC
      case 'ultra': return '#4CAF50';   // 🟢 Yeşil - DC Ultra
      case 'unknown': return '#9E9E9E'; // ⚫ Gri - Bilinmeyen
      default: return '#9E9E9E';
    }
  };

  const getPowerLevelBadge = (level: 'ac' | 'fast' | 'ultra' | 'unknown'): { emoji: string, text: string, color: string } => {
    switch (level) {
      case 'ac': return { emoji: '🔵', text: 'AC', color: '#2196F3' };
      case 'fast': return { emoji: '🟠', text: 'DC HIZLI', color: '#FF9800' };
      case 'ultra': return { emoji: '🟢', text: 'DC ULTRA', color: '#4CAF50' };
      case 'unknown': return { emoji: '⚫', text: 'BİLİNMEYEN', color: '#9E9E9E' };
      default: return { emoji: '⚫', text: 'BİLİNMEYEN', color: '#9E9E9E' };
    }
  };

  const renderStationMarker = (station: any, index: number) => {
    const powerLevel = getPowerLevel(station);
    const markerColor = getMarkerColor(powerLevel);
    const maxPower = station.Connections?.reduce((max: number, conn: any) => {
      const power = conn?.PowerKW || 0;
      return power > max ? power : max;
    }, 0) || 0;

    console.log(`🗺️ Rendering charging station marker ${index + 1}:`, {
      id: station.ID,
      title: station.AddressInfo?.Title,
      lat: station.AddressInfo?.Latitude,
      lng: station.AddressInfo?.Longitude,
      powerLevel,
      maxPower: `${maxPower}kW`,
      color: markerColor
    });
    
    return (
      <Marker
        key={`charging-${station.ID}`}
        coordinate={{
          latitude: station.AddressInfo!.Latitude,
          longitude: station.AddressInfo!.Longitude,
        }}
        title={station.AddressInfo?.Title || 'Şarj İstasyonu'}
        description={`${station.OperatorInfo?.Title || 'Bilinmeyen'} • ${maxPower}kW • ${getPowerLevelBadge(powerLevel).text}`}
        zIndex={1000}
      >
        <View style={{
          backgroundColor: markerColor,
          padding: 10,
          borderRadius: 25,
          borderWidth: 4,
          borderColor: '#FFFFFF',
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.4,
          shadowRadius: 4,
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 40,
          minHeight: 40,
        }}>
          <Text style={{ 
            color: 'white', 
            fontSize: 20, 
            fontWeight: 'bold',
            textShadowColor: 'rgba(0,0,0,0.8)',
            textShadowOffset: { width: 1, height: 1 },
            textShadowRadius: 2
          }}>⚡</Text>
        </View>
      </Marker>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f7fa' }}>
      {/* Harita Alanı */}
      <View style={{ flex: showSummary ? 0.6 : 1 }}>
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
            console.log('🗺️ Map is ready. Charging stations info:', {
              total: chargingStations.length,
              showChargingStations,
              validStations: chargingStations.filter(s => s.AddressInfo?.Latitude && s.AddressInfo?.Longitude).length
            });
            
            // Harita hazır olduğunda hemen zoom yap
            if (routeInfo?.polylinePoints && routeInfo.polylinePoints.length > 1) {
              setTimeout(() => {
                mapRef.current?.fitToCoordinates(routeInfo.polylinePoints, {
                  edgePadding: { 
                    top: 80, 
                    bottom: showSummary ? 280 : 80, 
                    left: 40, 
                    right: 40 
                  },
                  animated: true,
                });
              }, 300);
            } else if (fromCoord && toCoord) {
              setTimeout(() => {
                const coordinates = [
                  { latitude: fromCoord[0], longitude: fromCoord[1] },
                  { latitude: toCoord[0], longitude: toCoord[1] }
                ];
                mapRef.current?.fitToCoordinates(coordinates, {
                  edgePadding: { 
                    top: 80, 
                    bottom: showSummary ? 280 : 80, 
                    left: 40, 
                    right: 40 
                  },
                  animated: true,
                });
              }, 300);
            }
          }}
        >
          {/* Rota Polyline - Gölge */}
          {routeInfo?.polylinePoints && routeInfo.polylinePoints.length > 1 && (
            <Polyline 
              coordinates={routeInfo.polylinePoints} 
              strokeColor="rgba(0,0,0,0.4)" 
              strokeWidth={14}
              lineCap="round"
              lineJoin="round"
              zIndex={900}
            />
          )}
          
          {/* Rota Polyline - Ana çizgi */}
          {routeInfo?.polylinePoints && routeInfo.polylinePoints.length > 1 && (
            <Polyline 
              coordinates={routeInfo.polylinePoints} 
              strokeColor="#FF4500" 
              strokeWidth={10}
              lineCap="round"
              lineJoin="round"
              zIndex={950}
            />
          )}

          {/* Başlangıç Marker */}
          {fromCoord && (
            <Marker 
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
                <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>📍</Text>
              </View>
            </Marker>
          )}

          {/* Şarj İstasyonu Marker'ları */}
          {showChargingStations && chargingStations.filter(station => 
            station.AddressInfo?.Latitude && station.AddressInfo?.Longitude
          ).map((station, index) => renderStationMarker(station, index))}
      </MapView>

        {/* Toggle Button */}
        <TouchableOpacity
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            backgroundColor: 'white',
            borderRadius: 25,
            padding: 12,
            elevation: 4,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
          }}
          onPress={() => setShowSummary(!showSummary)}
        >
          <Text style={{ color: '#1976D2', fontSize: 24, fontWeight: 'bold' }}>
            {showSummary ? '▼' : '▲'}
          </Text>
        </TouchableOpacity>

        {/* Şarj İstasyonları Toggle */}
        <TouchableOpacity
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            backgroundColor: 'white',
            borderRadius: 25,
            padding: 12,
            elevation: 4,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
          }}
          onPress={() => setShowChargingStations(!showChargingStations)}
        >
          <Text style={{ 
            color: showChargingStations ? '#4CAF50' : '#666', 
            fontSize: 20, 
            fontWeight: 'bold' 
          }}>
            ⚡
          </Text>
        </TouchableOpacity>
      </View>

      {/* Loading Overlay */}
      {(loading || loadingChargingStations) && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(255,255,255,0.95)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <View style={{
            backgroundColor: 'white',
            borderRadius: 20,
            padding: 30,
            alignItems: 'center',
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 6,
          }}>
          <ActivityIndicator size="large" color="#1976D2" />
            <Text style={{ 
              marginTop: 20, 
              color: '#1976D2', 
              fontWeight: 'bold',
              fontSize: 18,
              textAlign: 'center'
            }}>
              {loading ? 'Rota hesaplanıyor...' : 'Şarj istasyonları yükleniyor...'}
            </Text>
            <Text style={{ 
              marginTop: 8, 
              color: '#666', 
              fontSize: 14,
              textAlign: 'center'
            }}>
              {loading ? 'En iyi güzergah bulunuyor' : 'Rota üzerindeki şarj noktaları aranıyor'}
            </Text>
          </View>
        </View>
      )}

      {/* Rota Özeti */}
      {showSummary && routeInfo && !loading && (
        <ScrollView style={{ flex: 0.4, backgroundColor: 'white' }}>
          <View style={{ padding: 20 }}>
            {/* Ana Bilgiler Kartı */}
            <Card style={{ marginBottom: 16, elevation: 2 }}>
              <Card.Content style={{ padding: 20 }}>
                <Text variant="titleLarge" style={{ 
                  fontWeight: 'bold', 
                  textAlign: 'center',
                  marginBottom: 20,
                  color: '#1A2B49'
                }}>
                  Rota Bilgileri
                </Text>

                <View style={{ 
                  flexDirection: 'row', 
                  justifyContent: 'space-around',
                  marginBottom: 16 
                }}>
                  {/* Mesafe */}
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={{ fontSize: 32 }}>📏</Text>
                    <Text variant="bodySmall" style={{ 
                      color: '#666', 
                      marginTop: 8,
                      marginBottom: 4
                    }}>
                      Mesafe
                    </Text>
                    <Text variant="headlineSmall" style={{ 
                      fontWeight: 'bold', 
                      color: '#1A2B49' 
                    }}>
                      {formatDistance(routeInfo.distance)} km
                    </Text>
                  </View>

                  {/* Süre */}
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={{ fontSize: 32 }}>⏰</Text>
                    <Text variant="bodySmall" style={{ 
                      color: '#666', 
                      marginTop: 8,
                      marginBottom: 4
                    }}>
                      Süre
                    </Text>
                    <Text variant="headlineSmall" style={{ 
                      fontWeight: 'bold', 
                      color: '#1A2B49' 
                    }}>
                      {formatDuration(routeInfo.duration)}
                    </Text>
                  </View>
                </View>

                <Divider style={{ marginVertical: 16 }} />

                {/* Rota Özellikleri */}
                <Text variant="titleMedium" style={{ 
                  fontWeight: 'bold', 
                  marginBottom: 12,
                  color: '#1A2B49' 
                }}>
                  Rota Özellikleri
                </Text>
                
                <View style={{ 
                  flexDirection: 'row', 
                  flexWrap: 'wrap', 
                  gap: 8,
                  marginBottom: 20
                }}>
                  <Chip icon="road" mode="outlined">Otoyol Güzergahı</Chip>
                  <Chip icon="car" mode="outlined">Araçla</Chip>
                  <Chip icon="clock-fast" mode="outlined">En Hızlı Rota</Chip>
                  {chargingStations.length > 0 && (
                    <Chip 
                      style={{ backgroundColor: '#E8F5E8' }}
                      textStyle={{ color: '#4CAF50' }}
                      mode="outlined"
                    >
                      ⚡ {chargingStations.length} Şarj İstasyonu
                    </Chip>
                  )}
                </View>

                {/* Aksiyon Butonları */}
                <View style={{ gap: 12 }}>
                  <Button
                    mode="contained"
                    icon="navigation"
                    style={{ borderRadius: 12 }}
                    contentStyle={{ height: 48 }}
                    onPress={handleStartNavigation}
                  >
                    Navigasyonu Başlat
                  </Button>
                  
                  <Button
                    mode="outlined"
                    icon="heart-outline"
                    style={{ borderRadius: 12, borderColor: '#1976D2' }}
                    contentStyle={{ height: 48 }}
                    textColor="#1976D2"
                    onPress={handleSaveRoute}
                  >
                    Rotayı Kaydet
                  </Button>
                </View>
              </Card.Content>
            </Card>

            {/* Şarj İstasyonları Kartı */}
            {(chargingStations.length > 0 || loadingChargingStations) && (
              <Card style={{ marginBottom: 16, elevation: 2 }}>
                <Card.Content style={{ padding: 20 }}>
                  <Text variant="titleMedium" style={{ 
                    fontWeight: 'bold', 
                    marginBottom: 16,
                    color: '#1A2B49' 
                  }}>
                    🔌 Rota Üzerindeki Şarj İstasyonları
                    {loadingChargingStations && (
                      <ActivityIndicator 
                        size="small" 
                        color="#1976D2" 
                        style={{ marginLeft: 8 }}
                      />
                    )}
                  </Text>
                  
                  {/* Renk Açıklaması */}
                  {chargingStations.length > 0 && !loadingChargingStations && (
                    <View style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: 8,
                      marginBottom: 16,
                      padding: 12,
                      backgroundColor: '#F8F9FA',
                      borderRadius: 8,
                      borderLeftWidth: 3,
                      borderLeftColor: '#1976D2'
                    }}>
                      <Text style={{ width: '100%', fontSize: 12, fontWeight: 'bold', color: '#666', marginBottom: 8 }}>
                        ⚡ Şarj Hızı Kategorileri:
                      </Text>
                      
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
                        <View style={{ 
                          width: 12, 
                          height: 12, 
                          borderRadius: 6, 
                          backgroundColor: '#2196F3',
                          marginRight: 4
                        }} />
                        <Text style={{ fontSize: 11, color: '#666' }}>AC (≤22kW)</Text>
                      </View>
                      
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
                        <View style={{ 
                          width: 12, 
                          height: 12, 
                          borderRadius: 6, 
                          backgroundColor: '#FF9800',
                          marginRight: 4
                        }} />
                        <Text style={{ fontSize: 11, color: '#666' }}>DC Hızlı (23-149kW)</Text>
                      </View>
                      
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ 
                          width: 12, 
                          height: 12, 
                          borderRadius: 6, 
                          backgroundColor: '#4CAF50',
                          marginRight: 4
                        }} />
                        <Text style={{ fontSize: 11, color: '#666' }}>DC Ultra (150kW+)</Text>
                      </View>
                    </View>
                  )}
                  
                  {loadingChargingStations ? (
                    <View style={{
                      backgroundColor: '#F5F5F5',
                      borderRadius: 12,
                      padding: 20,
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: 80
                    }}>
                      <ActivityIndicator size="small" color="#1976D2" />
                      <Text style={{ 
                        marginTop: 8, 
                        color: '#666', 
                        fontSize: 14 
                      }}>
                        Şarj istasyonları aranıyor...
                      </Text>
                    </View>
                  ) : chargingStations.length === 0 ? (
                    <View style={{
                      backgroundColor: '#FFF3E0',
                      borderRadius: 12,
                      padding: 20,
                      alignItems: 'center',
                      borderLeftWidth: 4,
                      borderLeftColor: '#FF9800'
                    }}>
                      <Text style={{ 
                        color: '#E65100', 
                        fontSize: 16,
                        fontWeight: 'bold'
                      }}>
                        ⚠️ Şarj İstasyonu Bulunamadı
                      </Text>
                      <Text style={{ 
                        marginTop: 4, 
                        color: '#666', 
                        fontSize: 14,
                        textAlign: 'center'
                      }}>
                        Bu rota üzerinde şarj istasyonu bulunmamaktadır.
                      </Text>
                    </View>
                  ) : (
                    <>
                      {(showAllStations ? chargingStations : chargingStations.slice(0, 3)).map((station, index) => (
                    <View key={station.ID} style={{
                      backgroundColor: '#F5F5F5',
                      borderRadius: 12,
                      padding: 16,
                      marginBottom: index < (showAllStations ? chargingStations.length - 1 : 2) ? 12 : 0,
                      borderLeftWidth: 4,
                      borderLeftColor: getMarkerColor(getPowerLevel(station))
                    }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                          <Text variant="titleSmall" style={{ fontWeight: 'bold', color: '#1A2B49' }}>
                            {station.AddressInfo?.Title || 'Şarj İstasyonu'}
                          </Text>
                          <Text variant="bodySmall" style={{ color: '#666', marginTop: 4 }}>
                            {station.OperatorInfo?.Title || 'Bilinmeyen Operatör'}
                          </Text>
                          <Text variant="bodySmall" style={{ color: '#666' }}>
                            {station.AddressInfo?.AddressLine1 || ''}{station.AddressInfo?.AddressLine1 && station.AddressInfo?.Town ? ', ' : ''}{station.AddressInfo?.Town || 'Bilinmeyen Lokasyon'}
                          </Text>
                          {station.Distance && (
                            <Text variant="bodySmall" style={{ color: '#4CAF50', marginTop: 4, fontWeight: 'bold' }}>
                              📍 {station.Distance.toFixed(1)} km uzaklıkta
                            </Text>
                          )}
                        </View>
                        <View style={{ alignItems: 'center' }}>
                          {(() => {
                            const powerLevel = getPowerLevel(station);
                            const badge = getPowerLevelBadge(powerLevel);
                            const maxPower = station.Connections?.reduce((max: number, conn: any) => {
                              const power = conn?.PowerKW || 0;
                              return power > max ? power : max;
                            }, 0) || 0;
                            
                            return (
                              <View style={{
                                backgroundColor: badge.color,
                                borderRadius: 8,
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                marginBottom: 4,
                                alignItems: 'center'
                              }}>
                                <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>
                                  {badge.emoji} {badge.text}
                                </Text>
                                <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>
                                  {maxPower || 'N/A'}kW
                                </Text>
                              </View>
                            );
                          })()}
                        </View>
                      </View>
                      
                      {station.Connections?.[0] && (
                        <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center' }}>
                          <Text variant="bodySmall" style={{ color: '#666' }}>
                            🔌 {station.Connections?.[0]?.ConnectionType?.Title || 'Bilinmeyen'} • 
                            {station.Connections?.[0]?.Quantity || 1} nokta
                          </Text>
                        </View>
                      )}
                    </View>
                  ))}

                  {chargingStations.length > 3 && !showAllStations && (
                    <TouchableOpacity 
                      onPress={() => setShowAllStations(true)}
                      style={{
                        backgroundColor: '#E3F2FD',
                        borderRadius: 8,
                        padding: 12,
                        marginTop: 12,
                        borderWidth: 1,
                        borderColor: '#1976D2',
                      }}
                    >
                      <Text variant="bodySmall" style={{ 
                        textAlign: 'center', 
                        color: '#1976D2', 
                        fontWeight: 'bold'
                      }}>
                        +{chargingStations.length - 3} şarj istasyonu daha göster
                      </Text>
                    </TouchableOpacity>
                  )}

                  {showAllStations && chargingStations.length > 3 && (
                    <TouchableOpacity 
                      onPress={() => setShowAllStations(false)}
                      style={{
                        backgroundColor: '#F5F5F5',
                        borderRadius: 8,
                        padding: 12,
                        marginTop: 12,
                        borderWidth: 1,
                        borderColor: '#666',
                      }}
                    >
                        <Text variant="bodySmall" style={{ 
                          textAlign: 'center', 
                          color: '#666', 
                          fontWeight: 'bold'
                        }}>
                          Daha az göster
                        </Text>
                      </TouchableOpacity>
                    )}
                    </>
                  )}
                </Card.Content>
              </Card>
            )}
        </View>
        </ScrollView>
      )}
    </View>
  );
} 