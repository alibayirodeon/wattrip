import React, { useState, useCallback, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, SafeAreaView, FlatList, ActivityIndicator, Alert } from 'react-native';
import { styled } from 'nativewind/dist/styled';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import debounce from 'lodash/debounce';
import { GOOGLE_PLACES_API_KEY } from '../config/env';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTextInput = styled(TextInput);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledSafeAreaView = styled(SafeAreaView);
const StyledMapView = styled(MapView);

interface LocationSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onLocationSelect: (location: { description: string; place_id: string; coordinates?: { latitude: number; longitude: number } }) => void;
}

interface PlaceResult {
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
  place_id: string;
}

export default function LocationSelectionModal({
  visible,
  onClose,
  onLocationSelect,
}: LocationSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const mapRef = useRef<MapView>(null);

  const searchPlaces = useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
            query
          )}&key=${GOOGLE_PLACES_API_KEY}&language=tr&components=country:tr`
        );
        const data = await response.json();
        setResults(data.predictions || []);
      } catch (error) {
        console.error('Places API Error:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    searchPlaces(text);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setResults([]);
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Konum İzni Gerekli',
          'Mevcut konumunuzu kullanabilmek için konum izni vermeniz gerekiyor.',
          [{ text: 'Tamam' }]
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });

      // Reverse geocoding to get address
      try {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${location.coords.latitude},${location.coords.longitude}&key=${GOOGLE_PLACES_API_KEY}&language=tr`
        );
        const data = await response.json();
        if (data.results?.[0]) {
          onLocationSelect({
            description: data.results[0].formatted_address,
            place_id: data.results[0].place_id,
            coordinates: {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude
            }
          });
          onClose();
        }
      } catch (error) {
        console.error('Reverse geocoding error:', error);
        Alert.alert('Hata', 'Adres bilgisi alınamadı.');
      }
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Hata', 'Konum alınamadı.');
    }
  };

  const handleMapPress = async (e: any) => {
    const coord = e.nativeEvent.coordinate;
    setSelectedLocation(coord);
    setSelectedAddress(null);
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coord.latitude},${coord.longitude}&key=${GOOGLE_PLACES_API_KEY}&language=tr`
      );
      const data = await response.json();
      if (data.results?.[0]) {
        setSelectedAddress(data.results[0].formatted_address);
      } else {
        setSelectedAddress('Adres bulunamadı');
      }
    } catch (err) {
      setSelectedAddress('Adres alınamadı');
    }
  };

  const handleMapLocationSelect = () => {
    if (selectedLocation) {
      onLocationSelect({
        description: selectedAddress || 'Seçilen Konum',
        place_id: `map_${selectedLocation.latitude}_${selectedLocation.longitude}`,
        coordinates: selectedLocation
      });
      onClose();
    }
  };

  // Google Places detay sorgusu
  async function fetchPlaceDetails(place_id: string): Promise<{ latitude: number; longitude: number } | null> {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&key=${GOOGLE_PLACES_API_KEY}&language=tr`
      );
      const data = await response.json();
      const loc = data.result?.geometry?.location;
      if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
        return { latitude: loc.lat, longitude: loc.lng };
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  const renderItem = ({ item }: { item: PlaceResult }) => (
    <StyledTouchableOpacity
      className="flex-row items-center px-4 py-3 border-b border-gray-100 dark:border-gray-800"
      onPress={async () => {
        // Koordinatları detaydan çek
        const coords = await fetchPlaceDetails(item.place_id);
        if (coords) {
          onLocationSelect({
            description: item.description,
            place_id: item.place_id,
            coordinates: coords
          });
          onClose();
        } else {
          // Hata: Koordinat alınamadı
          alert('Konum koordinatları alınamadı.');
        }
      }}
    >
      <StyledView className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center mr-4">
        <Icon name="map-marker" size={24} color="#0066FF" />
      </StyledView>
      <StyledView className="flex-1">
        <StyledText className="text-[#0A2542] dark:text-white text-base font-medium">
          {item.structured_formatting.main_text}
        </StyledText>
        <StyledText className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          {item.structured_formatting.secondary_text}
        </StyledText>
      </StyledView>
    </StyledTouchableOpacity>
  );

  const renderEmptyState = () => {
    if (!searchQuery) return null;
    if (loading) return null;

    return (
      <StyledView className="flex-1 items-center justify-center py-8">
        <Icon name="map-search" size={48} color="#94A3B8" />
        <StyledText className="text-gray-500 dark:text-gray-400 text-base mt-4">
          Sonuç bulunamadı
        </StyledText>
      </StyledView>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
    >
      <StyledSafeAreaView className="flex-1 bg-white dark:bg-gray-900">
        {showMap ? (
          <>
            <StyledView className="px-4 py-2 flex-row items-center justify-between border-b border-gray-100 dark:border-gray-800">
              <StyledTouchableOpacity onPress={() => setShowMap(false)} className="mr-4">
                <Icon name="arrow-left" size={24} color="#0A2542" />
              </StyledTouchableOpacity>
              <StyledText className="text-[#0A2542] dark:text-white text-lg font-medium">
                Haritadan Konum Seç
              </StyledText>
              <StyledTouchableOpacity 
                onPress={handleMapLocationSelect}
                disabled={!selectedLocation}
                className={`px-4 py-2 rounded-lg ${selectedLocation ? 'bg-[#0066FF]' : 'bg-gray-200 dark:bg-gray-700'}`}
              >
                <StyledText className={`${selectedLocation ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                  Seç
                </StyledText>
              </StyledTouchableOpacity>
            </StyledView>
            {selectedLocation && (
              <StyledView className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <StyledText className="text-[#0A2542] dark:text-white text-base">
                  {selectedAddress ? selectedAddress : 'Adres alınıyor...'}
                </StyledText>
              </StyledView>
            )}
            <StyledMapView
              ref={mapRef}
              className="flex-1 w-full"
              initialRegion={{
                latitude: 41.0082,
                longitude: 28.9784,
                latitudeDelta: 0.0922,
                longitudeDelta: 0.0421,
              }}
              onPress={handleMapPress}
            >
              {selectedLocation && (
                <Marker
                  coordinate={selectedLocation}
                  pinColor="#0066FF"
                />
              )}
            </StyledMapView>
          </>
        ) : (
          <>
            <StyledView className="px-4 py-2 flex-row items-center border-b border-gray-100 dark:border-gray-800">
              <StyledTouchableOpacity onPress={onClose} className="mr-4">
                <Icon name="arrow-left" size={24} color="#0A2542" />
              </StyledTouchableOpacity>
              <StyledView className="flex-1 flex-row items-center bg-gray-100 dark:bg-gray-800 rounded-lg px-3">
                <StyledTextInput
                  placeholder="Ara"
                  value={searchQuery}
                  onChangeText={handleSearch}
                  className="flex-1 h-10 text-base text-[#0A2542] dark:text-white"
                  placeholderTextColor="#94A3B8"
                  autoFocus
                />
                {searchQuery ? (
                  <StyledTouchableOpacity onPress={clearSearch}>
                    <Icon name="close" size={20} color="#94A3B8" />
                  </StyledTouchableOpacity>
                ) : null}
              </StyledView>
            </StyledView>

            <StyledView className="flex-1">
              {loading ? (
                <StyledView className="flex-1 items-center justify-center">
                  <ActivityIndicator size="large" color="#0066FF" />
                </StyledView>
              ) : (
                <FlatList
                  data={results}
                  renderItem={renderItem}
                  keyExtractor={(item) => item.place_id}
                  ListEmptyComponent={renderEmptyState}
                  keyboardShouldPersistTaps="handled"
                />
              )}
            </StyledView>

            {/* Quick Options - Always visible */}
            <StyledView className="px-4 py-4 border-t border-gray-100 dark:border-gray-800">
              <StyledTouchableOpacity 
                className="flex-row items-center py-4"
                onPress={getCurrentLocation}
              >
                <StyledView className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center mr-4">
                  <Icon name="crosshairs-gps" size={24} color="#0066FF" />
                </StyledView>
                <StyledText className="text-lg text-[#0A2542] dark:text-white">
                  Mevcut Konumu Seç
                </StyledText>
              </StyledTouchableOpacity>

              <StyledTouchableOpacity 
                className="flex-row items-center py-4"
                onPress={() => setShowMap(true)}
              >
                <StyledView className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center mr-4">
                  <Icon name="map-search" size={24} color="#0066FF" />
                </StyledView>
                <StyledText className="text-lg text-[#0A2542] dark:text-white">
                  Haritadan Seç
                </StyledText>
              </StyledTouchableOpacity>
            </StyledView>
          </>
        )}
      </StyledSafeAreaView>
    </Modal>
  );
} 