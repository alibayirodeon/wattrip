import React, { useEffect, useState, useRef } from 'react';
import { View, ScrollView, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { Text, Card, Button, Chip, Divider } from 'react-native-paper';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useLocationStore } from '../context/useLocationStore';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';

const GOOGLE_API_KEY = 'AIzaSyC1RCUy97Gu_yFZuCSi9lFP2Utv3pm75Mc';

function decodePolyline(encoded: any) {
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
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

interface RouteDetails {
  distance: number;
  duration: number;
  estimatedCost: number;
  energyConsumption: number;
  chargingStopsNeeded: number;
}

export default function RouteDetailScreen() {
  const navigation = useNavigation();
  const { from, to, fromCoord, toCoord } = useLocationStore();
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [routeDetails, setRouteDetails] = useState<RouteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSummary, setShowSummary] = useState(true);
  const mapRef = useRef<MapView | null>(null);

  // EV hesaplamaları (örnek değerler - gerçek uygulamada araç tipine göre)
  const calculateEVDetails = (distanceInMeters: number, durationInSeconds: number) => {
    const distanceKm = distanceInMeters / 1000;
    const durationMinutes = durationInSeconds / 60;
    
    // Peugeot e-2008 için örnek değerler
    const energyConsumption = distanceKm * 0.17; // kWh/km
    const estimatedCost = energyConsumption * 3.5; // TL (örnek elektrik fiyatı)
    const batteryRange = 320; // km
    const chargingStopsNeeded = Math.max(0, Math.ceil(distanceKm / batteryRange) - 1);
    
    return {
      distance: distanceKm,
      duration: durationMinutes,
      estimatedCost,
      energyConsumption,
      chargingStopsNeeded
    };
  };

  useEffect(() => {
    const fetchRoute = async () => {
      if (!fromCoord || !toCoord) {
        Alert.alert('Hata', 'Başlangıç ve varış noktası seçilmelidir.');
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${fromCoord[0]},${fromCoord[1]}&destination=${toCoord[0]},${toCoord[1]}&key=${GOOGLE_API_KEY}&mode=driving`;
        const response = await axios.get(url);
        
        if (!response.data.routes.length) {
          throw new Error('Rota bulunamadı');
        }
        
        const route = response.data.routes[0];
        const points = decodePolyline(route.overview_polyline.points);
        const leg = route.legs[0];
        
        setRouteCoords(points);
        
        const details = calculateEVDetails(leg.distance.value, leg.duration.value);
        setRouteDetails(details);
        
      } catch (error) {
        console.error('Route fetch error:', error);
        Alert.alert('Rota Hatası', 'Rota hesaplanırken bir hata oluştu. Lütfen tekrar deneyin.');
      }
      setLoading(false);
    };
    
    fetchRoute();
  }, [fromCoord, toCoord]);

  useEffect(() => {
    if (routeCoords.length > 1 && mapRef.current) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(routeCoords, {
          edgePadding: { top: 120, bottom: showSummary ? 320 : 60, left: 60, right: 60 },
          animated: true,
        });
      }, 500);
    }
  }, [routeCoords, showSummary]);

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}sa ${mins}dk`;
    }
    return `${mins}dk`;
  };

  const startNavigation = () => {
    Alert.alert(
      'Navigasyon Başlat',
      'Navigasyon uygulamasında rotayı açmak istiyor musunuz?',
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Aç', onPress: () => console.log('Navigation started') }
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f7fa' }}>
      {/* Harita */}
      <View style={{ flex: showSummary ? 0.6 : 1 }}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={{ flex: 1 }}
          initialRegion={{
            latitude: fromCoord ? fromCoord[0] : 39.9340,
            longitude: fromCoord ? fromCoord[1] : 32.8600,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          }}
          mapType="standard"
          showsUserLocation={true}
          showsMyLocationButton={true}
        >
          {routeCoords.length > 1 && (
            <>
              <Polyline 
                coordinates={routeCoords} 
                strokeColor="#1976D2" 
                strokeWidth={4}
                lineDashPattern={[1]}
              />
              <Marker 
                coordinate={routeCoords[0]} 
                title="Başlangıç"
                description={from}
              >
                <View style={{ 
                  backgroundColor: '#4CAF50', 
                  padding: 8, 
                  borderRadius: 20,
                  borderWidth: 3,
                  borderColor: 'white'
                }}>
                  <Icon name="map-marker" size={20} color="white" />
                </View>
              </Marker>
              <Marker 
                coordinate={routeCoords[routeCoords.length - 1]} 
                title="Varış"
                description={to}
              >
                <View style={{ 
                  backgroundColor: '#F44336', 
                  padding: 8, 
                  borderRadius: 20,
                  borderWidth: 3,
                  borderColor: 'white'
                }}>
                  <Icon name="flag-checkered" size={20} color="white" />
                </View>
              </Marker>
            </>
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
          <Icon 
            name={showSummary ? 'chevron-down' : 'chevron-up'} 
            size={24} 
            color="#1976D2" 
          />
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

      {/* Route Summary */}
      {showSummary && routeDetails && !loading && (
        <ScrollView style={{ flex: 0.4, backgroundColor: 'white' }}>
          <View style={{ padding: 20 }}>
            {/* Ana Bilgiler Kartı */}
            <Card style={{ marginBottom: 16, elevation: 2 }}>
              <Card.Content style={{ padding: 20 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Icon name="map-marker-distance" size={24} color="#1976D2" />
                    <Text variant="bodySmall" style={{ color: '#666', marginTop: 4 }}>Mesafe</Text>
                    <Text variant="titleMedium" style={{ fontWeight: 'bold', color: '#1A2B49' }}>
                      {routeDetails.distance.toFixed(1)} km
                    </Text>
                  </View>
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Icon name="clock-outline" size={24} color="#1976D2" />
                    <Text variant="bodySmall" style={{ color: '#666', marginTop: 4 }}>Süre</Text>
                    <Text variant="titleMedium" style={{ fontWeight: 'bold', color: '#1A2B49' }}>
                      {formatTime(routeDetails.duration)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Icon name="lightning-bolt" size={24} color="#FF9800" />
                    <Text variant="bodySmall" style={{ color: '#666', marginTop: 4 }}>Enerji</Text>
                    <Text variant="titleMedium" style={{ fontWeight: 'bold', color: '#1A2B49' }}>
                      {routeDetails.energyConsumption.toFixed(1)} kWh
                    </Text>
                  </View>
                </View>

                <Divider style={{ marginVertical: 12 }} />

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text variant="bodySmall" style={{ color: '#666' }}>Tahmini Maliyet</Text>
                    <Text variant="titleLarge" style={{ fontWeight: 'bold', color: '#4CAF50' }}>
                      ₺{routeDetails.estimatedCost.toFixed(2)}
                    </Text>
                  </View>
                  {routeDetails.chargingStopsNeeded > 0 && (
                    <Chip 
                      icon="ev-station" 
                      style={{ backgroundColor: '#FFF3E0' }}
                      textStyle={{ color: '#F57C00' }}
                    >
                      {routeDetails.chargingStopsNeeded} Şarj Durağı
                    </Chip>
                  )}
                </View>
              </Card.Content>
            </Card>

            {/* Rota Özellikleri */}
            <Card style={{ marginBottom: 16, elevation: 2 }}>
              <Card.Content style={{ padding: 20 }}>
                <Text variant="titleMedium" style={{ fontWeight: 'bold', marginBottom: 12, color: '#1A2B49' }}>
                  Rota Özellikleri
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <Chip icon="road" mode="outlined">Otoyol Güzergahı</Chip>
                  <Chip icon="leaf" mode="outlined" textStyle={{ color: '#4CAF50' }}>
                    Çevre Dostu
                  </Chip>
                  <Chip icon="clock-fast" mode="outlined">En Hızlı Rota</Chip>
                  {routeDetails.chargingStopsNeeded === 0 && (
                    <Chip icon="battery" mode="outlined" textStyle={{ color: '#4CAF50' }}>
                      Şarj Gereksiz
                    </Chip>
                  )}
                </View>
              </Card.Content>
            </Card>

            {/* Aksiyon Butonları */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Button
                mode="contained"
                icon="navigation"
                style={{ flex: 1, borderRadius: 12 }}
                contentStyle={{ height: 48 }}
                onPress={startNavigation}
              >
                Navigasyonu Başlat
              </Button>
              <Button
                mode="outlined"
                icon="heart-outline"
                style={{ borderRadius: 12, borderColor: '#1976D2' }}
                contentStyle={{ height: 48 }}
                textColor="#1976D2"
                onPress={() => Alert.alert('Rota Kaydet', 'Rota favorilerinize kaydedildi!')}
              >
                Kaydet
              </Button>
            </View>

            {/* Uyarı Mesajı */}
            {routeDetails.chargingStopsNeeded > 0 && (
              <Card style={{ marginTop: 16, backgroundColor: '#FFF8E1', elevation: 1 }}>
                <Card.Content style={{ padding: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Icon name="alert-circle" size={20} color="#F57C00" style={{ marginRight: 8 }} />
                    <Text variant="bodyMedium" style={{ color: '#E65100', flex: 1 }}>
                      Bu rota için {routeDetails.chargingStopsNeeded} şarj durağı önerilmektedir. 
                      Şarj istasyonları rotanızda gösterilecektir.
                    </Text>
                  </View>
                </Card.Content>
              </Card>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
} 