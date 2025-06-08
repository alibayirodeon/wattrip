import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import MapView, { Marker, MapPressEvent } from 'react-native-maps';
import { Text, Button } from 'react-native-paper';
import axios from 'axios';
import { useLocationStore } from '../context/useLocationStore';

const { width, height } = Dimensions.get('window');

const MapSelectionScreen = ({ navigation, route }: any) => {
  const [selected, setSelected] = useState<{ lat: number; lon: number } | null>(null);
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const { setFrom, setTo, lastKnownLocation } = useLocationStore();
  const type: 'from' | 'to' = route?.params?.type || 'from';

  const [region, setRegion] = useState(() =>
    lastKnownLocation
      ? {
          latitude: lastKnownLocation.latitude,
          longitude: lastKnownLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }
      : {
          latitude: 39.0,
          longitude: 35.0,
          latitudeDelta: 5,
          longitudeDelta: 5,
        }
  );

  useEffect(() => {
    if (lastKnownLocation) {
      setRegion({
        latitude: lastKnownLocation.latitude,
        longitude: lastKnownLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  }, [lastKnownLocation]);

  const handleMapPress = async (e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setSelected({ lat: latitude, lon: longitude });
    setLoading(true);
    try {
      const res = await axios.get('https://nominatim.openstreetmap.org/reverse', {
        params: {
          lat: latitude,
          lon: longitude,
          format: 'json',
          'accept-language': 'tr',
        },
        headers: { 'User-Agent': 'WatTrip/1.0' },
      });
      setAddress(res.data.display_name || 'Adres bulunamadı');
    } catch {
      setAddress('Adres bulunamadı');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (selected && address) {
      const coord: [number, number] = [selected.lat, selected.lon];
      if (type === 'from') setFrom(address, coord);
      else setTo(address, coord);
      navigation.navigate('Location');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <MapView
        style={{ width, height: height * 0.6 }}
        region={region}
        onRegionChangeComplete={setRegion}
        onPress={handleMapPress}
      >
        {selected && (
          <Marker coordinate={{ latitude: selected.lat, longitude: selected.lon }} />
        )}
      </MapView>
      <View style={styles.bottomSheet}>
        <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Seçilen Adres</Text>
        <Text style={{ marginBottom: 12 }} numberOfLines={2} ellipsizeMode="tail">
          {loading ? 'Adres alınıyor...' : address || 'Haritadan bir nokta seçin'}
        </Text>
        <Button mode="contained" onPress={handleConfirm} disabled={!selected || !address || loading}>
          Onayla
        </Button>
        <Button onPress={() => navigation.goBack()} style={{ marginTop: 8 }}>
          Vazgeç
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default MapSelectionScreen; 