import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator, Alert } from 'react-native';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useLocationStore } from '../context/useLocationStore';
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

export default function RouteDetailScreen() {
  const { fromCoord, toCoord } = useLocationStore();
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [distance, setDistance] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<MapView | null>(null);

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
        if (!response.data.routes.length) throw new Error('Rota bulunamadı');
        const points = decodePolyline(response.data.routes[0].overview_polyline.points);
        console.log('Polyline koordinatları:', points);
        setRouteCoords(points);
        setDistance(response.data.routes[0].legs[0].distance.value);
        setDuration(response.data.routes[0].legs[0].duration.value);
      } catch (e) {
        Alert.alert('Rota oluşturulamadı', 'Google Directions API ile rota alınamadı.');
      }
      setLoading(false);
    };
    fetchRoute();
  }, [fromCoord, toCoord]);

  useEffect(() => {
    if (routeCoords.length > 1 && mapRef.current) {
      mapRef.current.fitToCoordinates(routeCoords, {
        edgePadding: { top: 60, bottom: 60, left: 40, right: 40 },
        animated: true,
      });
    }
  }, [routeCoords]);

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        initialRegion={routeCoords.length > 0 ? {
          latitude: routeCoords[0].latitude,
          longitude: routeCoords[0].longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        } : {
          latitude: 39.9340,
          longitude: 32.8600,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {routeCoords.length > 1 && (
          <>
            <Polyline coordinates={routeCoords} strokeColor="red" strokeWidth={8} zIndex={100} />
            <Marker coordinate={routeCoords[0]} title="Başlangıç" pinColor="green" />
            <Marker coordinate={routeCoords[routeCoords.length - 1]} title="Bitiş" pinColor="blue" />
          </>
        )}
      </MapView>
      {loading && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 999 }}>
          <ActivityIndicator size="large" color="#1976D2" />
          <Text style={{ marginTop: 12, color: '#1976D2', fontWeight: 'bold' }}>Rota hesaplanıyor...</Text>
        </View>
      )}
      {!loading && routeCoords.length > 1 && (
        <View style={{ position: 'absolute', bottom: 30, left: 20, right: 20, backgroundColor: '#fff', borderRadius: 12, padding: 16, elevation: 4 }}>
          <Text>Mesafe: {distance !== null ? (distance / 1000).toFixed(2) : '-'} km</Text>
          <Text>Süre: {duration !== null ? Math.round(duration / 60) : '-'} dk</Text>
        </View>
      )}
    </View>
  );
} 