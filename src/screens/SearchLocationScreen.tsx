import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Pressable, Alert } from 'react-native';
import { TextInput, Text } from 'react-native-paper';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import axios from 'axios';
import { useLocationStore } from '../context/useLocationStore';
import { shortenAddress } from '../lib/shortenAddress';
import * as Location from 'expo-location';

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

const SearchLocationScreen = ({ navigation, route }: any) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const { setFrom, setTo, lastKnownLocation } = useLocationStore();
  const type: 'from' | 'to' = route?.params?.type || 'from';

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const timeout = setTimeout(() => {
      axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: query,
          countrycodes: 'tr',
          'accept-language': 'tr',
          format: 'json',
          addressdetails: 1,
          limit: 8,
        },
        headers: { 'User-Agent': 'WatTrip/1.0' },
      })
        .then(res => setResults(res.data))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 400);
    return () => clearTimeout(timeout);
  }, [query]);

  const handleSelect = (item: NominatimResult) => {
    const coord: [number, number] = [parseFloat(item.lat), parseFloat(item.lon)];
    if (type === 'from') setFrom(item.display_name, coord);
    else setTo(item.display_name, coord);
    navigation.goBack();
  };

  const handleSelectCurrentLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Konum izni reddedildi', 'Konum alınamadı.');
        return;
      }
      let location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;
      const res = await axios.get('https://nominatim.openstreetmap.org/reverse', {
        params: {
          lat: latitude,
          lon: longitude,
          format: 'json',
          'accept-language': 'tr',
        },
        headers: { 'User-Agent': 'WatTrip/1.0' },
      });
      const address = res.data.display_name || 'Adres bulunamadı';
      const coord: [number, number] = [latitude, longitude];
      if (type === 'from') setFrom(address, coord);
      else setTo(address, coord);
      navigation.navigate('Location');
    } catch (e) {
      Alert.alert('Konum alınamadı', 'Lütfen konum servislerini kontrol edin.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff', paddingTop: 32 }}>
      {/* Arama kutusu */}
      <View style={styles.searchBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingRight: 4, paddingLeft: 0 }}>
          <Ionicons name="arrow-back-outline" size={24} color="#1A2B49" />
        </TouchableOpacity>
        <TextInput
          placeholder="Ara"
          value={query}
          onChangeText={setQuery}
          style={styles.input}
          underlineColor="transparent"
          mode="flat"
          theme={{ roundness: 16 }}
          autoFocus
        />
      </View>
      {/* Seçenekler */}
      <TouchableOpacity style={styles.optionRow} onPress={handleSelectCurrentLocation}>
        <Icon name="crosshairs-gps" size={22} color="#1A2B49" style={{ marginRight: 12 }} />
        <Text style={styles.optionText}>Mevcut Konumu Seç</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.optionRow} onPress={() => navigation.navigate('MapSelection', { type })}>
        <Icon name="map-search-outline" size={22} color="#1A2B49" style={{ marginRight: 12 }} />
        <Text style={styles.optionText}>Haritadan Seç</Text>
      </TouchableOpacity>
      {/* Autocomplete Sonuçları */}
      {loading && <ActivityIndicator style={{ marginTop: 16 }} />}
      {!loading && query.length >= 2 && results.length === 0 && (
        <Text style={{ textAlign: 'center', color: '#90A4AE', marginTop: 24 }}>Sonuç bulunamadı</Text>
      )}
      <FlatList
        data={results}
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.resultRow,
              pressed && { backgroundColor: '#E3F2FD' },
            ]}
            onPress={() => handleSelect(item)}
          >
            <Icon name="map-marker-radius" size={20} color="#1976D2" style={{ marginRight: 10 }} />
            <Text style={{ flex: 1 }} numberOfLines={2} ellipsizeMode="tail">{shortenAddress(item.display_name)}</Text>
          </Pressable>
        )}
        style={{ marginTop: 8 }}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F8FA',
    borderRadius: 24,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    marginBottom: 16,
    height: 48,
  },
  input: {
    flex: 1,
    backgroundColor: 'transparent',
    marginLeft: 8,
    fontSize: 17,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  optionText: {
    fontSize: 16,
    color: '#1A2B49',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderColor: '#F0F0F0',
    backgroundColor: '#fff',
  },
});

export default SearchLocationScreen; 