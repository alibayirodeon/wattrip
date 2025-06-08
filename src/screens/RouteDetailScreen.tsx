import React, { useEffect, useState, useRef } from 'react';
import { View, ScrollView, ActivityIndicator, Alert, TouchableOpacity, FlatList } from 'react-native';
import { Text, Card, Button, Chip, Divider } from 'react-native-paper';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import { useLocationStore } from '../context/useLocationStore';
import { useNavigation } from '@react-navigation/native';
import chargingStationService, { ChargingStation } from '../services/chargingStationService';
import routeService from '../services/routeService';
import RouteCard from '../components/RouteCard';

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
  
  const [loading, setLoading] = useState(true);
  const [loadingChargingStations, setLoadingChargingStations] = useState(false);
  const [showSummary, setShowSummary] = useState(true);
  const [chargingStations, setChargingStations] = useState<ChargingStation[]>([]);
  const [showChargingStations, setShowChargingStations] = useState(true);
  const [showAllStations, setShowAllStations] = useState(false);
  const mapRef = useRef<MapView>(null);

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
    if (!routes[selectedRouteIndex]?.polylinePoints || routes[selectedRouteIndex].polylinePoints.length === 0) {
      return;
    }

    setLoadingChargingStations(true);
    try {
      console.log(`🔌 Fetching charging stations for route ${selectedRouteIndex + 1}...`);
      
      const selectedRoute = routes[selectedRouteIndex];
      const routeDistanceKm = selectedRoute.distance / 1000;
      
      try {
        const stations = await chargingStationService.findChargingStationsAlongRoute(
          selectedRoute.polylinePoints,
          15, // 15km initial radius
          200 // 200km battery range default
        );
        setChargingStations(stations);
        console.log(`🔌 Successfully loaded ${stations.length} charging stations for route ${selectedRouteIndex + 1}`);
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

  // Rota seçimi değiştiğinde
  const handleRouteSelect = (index: number) => {
    console.log(`🎯 Route ${index + 1} selected`);
    setSelectedRouteIndex(index);
  };

  // İlk yükleme
  useEffect(() => {
    fetchMultipleRoutes();
    
    // Cleanup function
    return () => {
      clearRoutes();
    };
  }, [fromCoord, toCoord]);

  // Seçili rota değiştiğinde şarj istasyonlarını yenile
  useEffect(() => {
    if (routes.length > 0 && !loading) {
      fetchChargingStationsForSelectedRoute();
    }
  }, [selectedRouteIndex, routes, loading]);

  // 🗺️ Harita zoom ayarları
  useEffect(() => {
    if (!mapRef.current || routes.length === 0) return;

    const fitMapToSelectedRoute = () => {
      const selectedRoute = routes[selectedRouteIndex];
      
      if (selectedRoute?.polylinePoints && selectedRoute.polylinePoints.length > 1) {
        console.log(`🗺️ Fitting map to route ${selectedRouteIndex + 1} with ${selectedRoute.polylinePoints.length} points`);
        
        mapRef.current?.fitToCoordinates(selectedRoute.polylinePoints, {
          edgePadding: { 
            top: 100, 
            bottom: showSummary ? 320 : 100, 
            left: 50, 
            right: 50 
          },
          animated: true,
        });
        
        // Ek zoom optimizasyonu
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.fitToCoordinates(selectedRoute.polylinePoints, {
              edgePadding: { 
                top: 80, 
                bottom: showSummary ? 300 : 80, 
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
            bottom: showSummary ? 320 : 100, 
            left: 50, 
            right: 50 
          },
          animated: true,
        });
      }
    };

    // Multiple zoom attempts for better results
    setTimeout(fitMapToSelectedRoute, 500);
    setTimeout(fitMapToSelectedRoute, 1000);
    
  }, [routes, selectedRouteIndex, fromCoord, toCoord, showSummary]);

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

  const handleStartNavigation = () => {
    if (routes[selectedRouteIndex]) {
      Alert.alert(
        'Navigasyon Başlat',
        `Seçili rota ile navigasyonu başlatmak istiyor musunuz?\n\nRota: ${routes[selectedRouteIndex].summary}\nMesafe: ${formatDistance(routes[selectedRouteIndex].distance)}`,
        [
          { text: 'İptal', style: 'cancel' },
          { text: 'Başlat', style: 'default' }
        ]
      );
    }
  };

  const handleSaveRoute = () => {
    Alert.alert('Kaydet', 'Rota favorilere kaydedildi!');
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
      case 'ac': return '#2196F3';      // Blue
      case 'fast': return '#FF9800';    // Orange  
      case 'ultra': return '#4CAF50';   // Green
      default: return '#9E9E9E';        // Gray
    }
  };

  const getPowerLevelBadge = (level: 'ac' | 'fast' | 'ultra' | 'unknown'): { emoji: string, text: string, color: string } => {
    switch (level) {
      case 'ac': return { emoji: '🔵', text: 'AC (≤22kW)', color: '#2196F3' };
      case 'fast': return { emoji: '🟠', text: 'DC Fast (23-149kW)', color: '#FF9800' };
      case 'ultra': return { emoji: '🟢', text: 'DC Ultra (≥150kW)', color: '#4CAF50' };
      default: return { emoji: '⚪', text: 'Bilinmiyor', color: '#9E9E9E' };
    }
  };

  const renderStationMarker = (station: any, index: number) => {
    if (!station.AddressInfo?.Latitude || !station.AddressInfo?.Longitude) return null;
    
    const powerLevel = getPowerLevel(station);
    const markerColor = getMarkerColor(powerLevel);
    
    return (
      <Marker
        key={`charging-${station.ID || index}`}
        coordinate={{
          latitude: station.AddressInfo.Latitude,
          longitude: station.AddressInfo.Longitude,
        }}
        title={station.AddressInfo.Title || 'Şarj İstasyonu'}
        description={`${station.AddressInfo.AddressLine1 || ''} - ${getPowerLevelBadge(powerLevel).text}`}
        zIndex={800}
      >
        <View style={{ 
          backgroundColor: markerColor, 
          padding: 8, 
          borderRadius: 20,
          borderWidth: 3,
          borderColor: 'white',
          elevation: 5,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 3,
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 28,
          minHeight: 28,
        }}>
          <Text style={{ color: 'white', fontSize: 14, fontWeight: 'bold' }}>⚡</Text>
        </View>
      </Marker>
    );
  };

  // 🎯 Seçili rota
  const selectedRoute = routes[selectedRouteIndex];
  const selectedEVInfo = routeEVInfo[selectedRouteIndex];

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
            
            // Harita hazır olduğunda hemen zoom yap
            if (selectedRoute?.polylinePoints && selectedRoute.polylinePoints.length > 1) {
              setTimeout(() => {
                mapRef.current?.fitToCoordinates(selectedRoute.polylinePoints, {
                  edgePadding: { 
                    top: 80, 
                    bottom: showSummary ? 300 : 80, 
                    left: 40, 
                    right: 40 
                  },
                  animated: true,
                });
              }, 300);
            }
          }}
        >
          {/* Seçili Rota Polyline - Gölge */}
          {selectedRoute?.polylinePoints && selectedRoute.polylinePoints.length > 1 && (
            <Polyline 
              coordinates={selectedRoute.polylinePoints} 
              strokeColor="rgba(0,0,0,0.4)" 
              strokeWidth={14}
              lineCap="round"
              lineJoin="round"
              zIndex={900}
            />
          )}
          
          {/* Seçili Rota Polyline - Ana çizgi */}
          {selectedRoute?.polylinePoints && selectedRoute.polylinePoints.length > 1 && (
            <Polyline 
              coordinates={selectedRoute.polylinePoints} 
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
                <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>🏁</Text>
              </View>
            </Marker>
          )}

          {/* Şarj İstasyonu Markerları */}
          {showChargingStations && chargingStations.map((station, index) => 
            renderStationMarker(station, index)
          )}
        </MapView>

        {/* Top overlay - Route count info */}
        {routes.length > 1 && (
          <View style={{
            position: 'absolute',
            top: 60,
            left: 16,
            right: 16,
            zIndex: 1000,
          }}>
            <Card style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              borderRadius: 12,
              elevation: 4,
            }}>
              <Card.Content style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
                <Text style={{ 
                  fontSize: 14, 
                  fontWeight: '600', 
                  color: '#2C3E50',
                  textAlign: 'center'
                }}>
                  🛣️ {routes.length} alternatif rota bulundu
                </Text>
              </Card.Content>
            </Card>
          </View>
        )}
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
            {/* Route Cards Horizontal List */}
            {routes.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ 
                  fontSize: 18, 
                  fontWeight: 'bold', 
                  color: '#2C3E50',
                  marginHorizontal: 16,
                  marginBottom: 12
                }}>
                  Rota Seçenekleri
                </Text>
                
                <FlatList
                  data={routes}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(_, index) => index.toString()}
                  contentContainerStyle={{ paddingLeft: 16 }}
                  renderItem={({ item, index }) => (
                    <RouteCard
                      route={item}
                      evInfo={routeEVInfo[index]}
                      index={index}
                      isSelected={index === selectedRouteIndex}
                      onSelect={handleRouteSelect}
                    />
                  )}
                />
              </View>
            )}

            {/* Selected Route Summary */}
            {selectedRoute && selectedEVInfo && (
              <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
                <Text style={{ 
                  fontSize: 18, 
                  fontWeight: 'bold', 
                  color: '#2C3E50',
                  marginBottom: 12
                }}>
                  Seçili Rota Detayları
                </Text>
                
                <Card style={{ backgroundColor: 'white', elevation: 2, borderRadius: 12 }}>
                  <Card.Content style={{ padding: 16 }}>
                    <View style={{ 
                      flexDirection: 'row', 
                      justifyContent: 'space-between',
                      marginBottom: 12
                    }}>
                      <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#2C3E50' }}>
                        {selectedRoute.summary}
                      </Text>
                      <Chip mode="flat" style={{ backgroundColor: '#E8F5E8' }}>
                        <Text style={{ color: '#27AE60', fontWeight: 'bold' }}>
                          Rota {selectedRouteIndex + 1}
                        </Text>
                      </Chip>
                    </View>
                    
                    <View style={{ 
                      flexDirection: 'row', 
                      justifyContent: 'space-around',
                      paddingVertical: 8
                    }}>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, color: '#7F8C8D' }}>Mesafe</Text>
                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#2C3E50' }}>
                          {formatDistance(selectedRoute.distance)}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, color: '#7F8C8D' }}>Süre</Text>
                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#2C3E50' }}>
                          {formatDuration(selectedRoute.duration)}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, color: '#7F8C8D' }}>Tüketim</Text>
                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#27AE60' }}>
                          {selectedEVInfo.estimatedConsumption.toFixed(1)} kWh
                        </Text>
                      </View>
                    </View>
                  </Card.Content>
                </Card>
              </View>
            )}



            {/* Action Buttons */}
            <View style={{ 
              flexDirection: 'row', 
              marginHorizontal: 16, 
              marginBottom: 16,
              gap: 8
            }}>
              <Button 
                mode="contained" 
                onPress={handleStartNavigation}
                style={{ 
                  flex: 1, 
                  backgroundColor: '#FF4500',
                  borderRadius: 12
                }}
                contentStyle={{ paddingVertical: 4 }}
              >
                <Text style={{ color: 'white', fontWeight: 'bold' }}>
                  Navigasyonu Başlat
                </Text>
              </Button>
              
              <Button 
                mode="outlined" 
                onPress={handleSaveRoute}
                style={{ 
                  borderColor: '#FF4500',
                  borderRadius: 12,
                  paddingHorizontal: 8
                }}
                contentStyle={{ paddingVertical: 4 }}
              >
                <Text style={{ color: '#FF4500', fontWeight: 'bold' }}>
                  Kaydet
                </Text>
              </Button>
            </View>

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
                          key={station.ID || index} 
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
    </View>
  );
} 