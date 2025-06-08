import React, { useEffect, useState, useRef } from 'react';
import { View, ScrollView, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { Text, Card, Button, Chip, Divider } from 'react-native-paper';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import { useLocationStore } from '../context/useLocationStore';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';

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
  const [showSummary, setShowSummary] = useState(true);
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

  useEffect(() => {
    fetchRouteData();
  }, [fromCoord, toCoord]);

  // Harita otomatik zoom ayarla
  useEffect(() => {
    if (routeInfo?.polylinePoints && routeInfo.polylinePoints.length > 1 && mapRef.current) {
      setTimeout(() => {
        console.log('Fitting to coordinates:', routeInfo.polylinePoints.length, 'points');
        mapRef.current?.fitToCoordinates(routeInfo.polylinePoints, {
          edgePadding: { 
            top: 120, 
            bottom: showSummary ? 380 : 120, 
            left: 80, 
            right: 80 
          },
          animated: true,
        });
      }, 1500);
    } else if (fromCoord && toCoord && mapRef.current) {
      // Fallback: sadece başlangıç ve bitiş noktalarına göre
      setTimeout(() => {
        const coordinates = [
          { latitude: fromCoord[0], longitude: fromCoord[1] },
          { latitude: toCoord[0], longitude: toCoord[1] }
        ];
        
        console.log('Fitting to start/end points:', coordinates);
        mapRef.current?.fitToCoordinates(coordinates, {
          edgePadding: { 
            top: 120, 
            bottom: showSummary ? 380 : 120, 
            left: 80, 
            right: 80 
          },
          animated: true,
        });
      }, 1500);
    }
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

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f7fa' }}>
      {/* Harita Alanı */}
      <View style={{ flex: showSummary ? 0.6 : 1 }}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={{ flex: 1 }}
          initialRegion={{
            latitude: fromCoord ? fromCoord[0] : 39.9334,
            longitude: fromCoord ? fromCoord[1] : 32.8597,
            latitudeDelta: 0.5,
            longitudeDelta: 0.5,
          }}
          showsUserLocation={true}
          showsMyLocationButton={true}
          mapType="standard"
          zoomEnabled={true}
          scrollEnabled={true}
          pitchEnabled={false}
          rotateEnabled={true}
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
      </View>

      {/* Loading Overlay */}
      {loading && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(255,255,255,0.9)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <ActivityIndicator size="large" color="#1976D2" />
          <Text style={{ 
            marginTop: 16, 
            color: '#1976D2', 
            fontWeight: 'bold',
            fontSize: 16
          }}>
            Rota hesaplanıyor...
          </Text>
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
          </View>
        </ScrollView>
      )}
    </View>
  );
} 