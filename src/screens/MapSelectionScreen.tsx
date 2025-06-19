import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, Alert, Animated } from 'react-native';
import MapView, { Marker, MapPressEvent, PROVIDER_GOOGLE } from 'react-native-maps';
import { Text, Button, TextInput, ActivityIndicator, Card } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import axios from 'axios';
import * as Location from 'expo-location';
import { useLocationStore } from '../context/useLocationStore';

const { width, height } = Dimensions.get('window');

interface SelectedLocation {
  latitude: number;
  longitude: number;
  address: string;
}

const MapSelectionScreen = ({ navigation, route }: any) => {
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const { setFrom, setTo, lastKnownLocation } = useLocationStore();
  const type: 'from' | 'to' = route?.params?.type || 'from';
  const mapRef = useRef<MapView>(null);
  const searchAnimation = useRef(new Animated.Value(0)).current;

  const [region, setRegion] = useState(() =>
    lastKnownLocation
      ? {
          latitude: lastKnownLocation.latitude,
          longitude: lastKnownLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }
      : {
          latitude: 39.9334, // Ankara merkez
          longitude: 32.8597,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }
  );

  useEffect(() => {
    if (lastKnownLocation && mapReady) {
      const newRegion = {
        latitude: lastKnownLocation.latitude,
        longitude: lastKnownLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 1000);
    }
  }, [lastKnownLocation, mapReady]);

  useEffect(() => {
    Animated.timing(searchAnimation, {
      toValue: showSearch ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [showSearch]);

  const reverseGeocode = async (latitude: number, longitude: number): Promise<string> => {
    try {
      const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
        params: {
          lat: latitude,
          lon: longitude,
          format: 'json',
          'accept-language': 'tr',
          addressdetails: 1,
        },
        headers: { 'User-Agent': 'WatTrip/1.0' },
      });
      return response.data.display_name || 'Adres bulunamadı';
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return 'Adres alınamadı';
    }
  };

  const handleMapPress = async (e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setLoading(true);
    
    try {
      const address = await reverseGeocode(latitude, longitude);
      setSelectedLocation({
        latitude,
        longitude,
        address,
      });
    } catch (error) {
      setSelectedLocation({
        latitude,
        longitude,
        address: 'Adres alınamadı',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCurrentLocation = async () => {
    try {
      setLoading(true);
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Konum İzni', 'Konum izni verilmedi. Lütfen ayarlardan izin verin.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      const { latitude, longitude } = location.coords;
      const address = await reverseGeocode(latitude, longitude);
      
      const newRegion = {
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      
      setRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 1000);
      
      setSelectedLocation({
        latitude,
        longitude,
        address,
      });
    } catch (error) {
      Alert.alert('Hata', 'Konum alınamadı. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      setLoading(true);
      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: searchQuery,
          countrycodes: 'tr',
          'accept-language': 'tr',
          format: 'json',
          limit: 1,
        },
        headers: { 'User-Agent': 'WatTrip/1.0' },
      });

      if (response.data.length > 0) {
        const result = response.data[0];
        const latitude = parseFloat(result.lat);
        const longitude = parseFloat(result.lon);
        
        const newRegion = {
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        
        setRegion(newRegion);
        mapRef.current?.animateToRegion(newRegion, 1000);
        
        setSelectedLocation({
          latitude,
          longitude,
          address: result.display_name,
        });
        
        setShowSearch(false);
        setSearchQuery('');
      } else {
        Alert.alert('Sonuç Bulunamadı', 'Aradığınız lokasyon bulunamadı.');
      }
    } catch (error) {
      Alert.alert('Arama Hatası', 'Arama yapılırken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!selectedLocation) return;
    
    const coord: [number, number] = [selectedLocation.latitude, selectedLocation.longitude];
    if (type === 'from') {
      setFrom(selectedLocation.address, coord);
    } else {
      setTo(selectedLocation.address, coord);
    }
    navigation.navigate('Location');
  };

  const title = type === 'from' ? 'Başlangıç Noktası Seç' : 'Varış Noktası Seç';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={24} color="#1A2B49" />
        </TouchableOpacity>
        <Text variant="titleMedium" style={styles.headerTitle}>{title}</Text>
        <TouchableOpacity 
          style={styles.searchButton}
          onPress={() => setShowSearch(!showSearch)}
        >
          <Icon name="magnify" size={24} color="#1976D2" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <Animated.View style={[
        styles.searchContainer,
        {
          height: searchAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 60],
          }),
          opacity: searchAnimation,
        }
      ]}>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Adres veya yer adı ara..."
          mode="outlined"
          style={styles.searchInput}
          right={
            <TextInput.Icon 
              icon="magnify" 
              onPress={handleSearch}
              disabled={!searchQuery.trim() || loading}
            />
          }
          onSubmitEditing={handleSearch}
        />
      </Animated.View>

      {/* Map */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
        onPress={handleMapPress}
        onMapReady={() => setMapReady(true)}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={true}
        mapType="standard"
      >
        {selectedLocation && (
          <Marker 
            coordinate={{
              latitude: selectedLocation.latitude,
              longitude: selectedLocation.longitude,
            }}
            title={type === 'from' ? 'Başlangıç' : 'Varış'}
            description={selectedLocation.address}
          >
            <View style={[
              styles.customMarker,
              { backgroundColor: type === 'from' ? '#4CAF50' : '#F44336' }
            ]}>
              <Icon 
                name={type === 'from' ? 'map-marker' : 'flag-checkered'} 
                size={20} 
                color="white" 
              />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Floating Action Buttons */}
      <TouchableOpacity 
        style={styles.currentLocationButton}
        onPress={handleCurrentLocation}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Icon name="crosshairs-gps" size={24} color="white" />
        )}
      </TouchableOpacity>

      {/* Bottom Sheet */}
      <Card style={styles.bottomSheet}>
        <Card.Content style={styles.bottomContent}>
          <View style={styles.dragHandle} />
          
          <Text variant="titleMedium" style={styles.sheetTitle}>
            {selectedLocation ? 'Seçilen Konum' : 'Haritadan Bir Nokta Seçin'}
          </Text>
          
          {selectedLocation && (
            <View style={styles.locationInfo}>
              <Icon name="map-marker" size={20} color="#1976D2" style={styles.locationIcon} />
              <Text variant="bodyMedium" style={styles.addressText} numberOfLines={3}>
                {selectedLocation.address}
              </Text>
            </View>
          )}
          
          <View style={styles.buttonContainer}>
            <Button
              mode="contained"
              onPress={handleConfirm}
              disabled={!selectedLocation || loading}
              style={styles.confirmButton}
              contentStyle={styles.buttonContent}
              icon="check"
            >
              Konumu Onayla
            </Button>
            
            <Button
              mode="outlined"
              onPress={() => navigation.goBack()}
              style={styles.cancelButton}
              contentStyle={styles.buttonContent}
              textColor="#666"
            >
              İptal
            </Button>
          </View>
        </Card.Content>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: 'white',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontWeight: 'bold',
    color: '#1A2B49',
    flex: 1,
    textAlign: 'center',
  },
  searchButton: {
    padding: 8,
  },
  searchContainer: {
    paddingHorizontal: 16,
    backgroundColor: 'white',
    overflow: 'hidden',
  },
  searchInput: {
    backgroundColor: 'white',
    marginBottom: 8,
  },
  map: {
    flex: 1,
  },
  customMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  currentLocationButton: {
    position: 'absolute',
    right: 16,
    bottom: 200,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1976D2',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    margin: 16,
    borderRadius: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  bottomContent: {
    padding: 20,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontWeight: 'bold',
    color: '#1A2B49',
    marginBottom: 12,
    textAlign: 'center',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    backgroundColor: '#F5F8FA',
    padding: 12,
    borderRadius: 12,
  },
  locationIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  addressText: {
    flex: 1,
    color: '#1A2B49',
    lineHeight: 20,
  },
  buttonContainer: {
    gap: 12,
  },
  confirmButton: {
    borderRadius: 12,
  },
  cancelButton: {
    borderRadius: 12,
    borderColor: '#E0E0E0',
  },
  buttonContent: {
    height: 48,
  },
});

export default MapSelectionScreen; 