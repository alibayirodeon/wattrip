import React, { useState } from 'react';
import { View, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { Text, Button } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { styled } from 'nativewind/dist/styled';
import LocationInput from '../components/LocationInput';

const StyledView = styled(View);
const StyledSafeAreaView = styled(SafeAreaView);
const StyledScrollView = styled(ScrollView);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledText = styled(Text);
const StyledButton = styled(Button);

interface Location {
  description: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

const RoutePlannerScreen = () => {
  const [startLocation, setStartLocation] = useState<Location | null>(null);
  const [endLocation, setEndLocation] = useState<Location | null>(null);
  const [waypoints, setWaypoints] = useState<(Location | null)[]>([]);

  const handleAddWaypoint = () => {
    setWaypoints([...waypoints, null]);
  };

  const handleRemoveWaypoint = (index: number) => {
    const newWaypoints = waypoints.filter((_, i) => i !== index);
    setWaypoints(newWaypoints);
  };

  const handleClear = () => {
    setStartLocation(null);
    setEndLocation(null);
    setWaypoints([]);
  };

  const handlePlan = () => {
    if (!startLocation || !endLocation) return;
    console.log('Planning route with:', { startLocation, endLocation, waypoints });
  };

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-900">
      <StyledScrollView className="flex-1">
        {/* Header */}
        <StyledView className="px-4 py-6">
          <StyledText className="text-2xl font-bold text-white">Rota Planla</StyledText>
          <StyledText className="text-gray-400 mt-1">
            Başlangıç ve varış noktalarını seçin
          </StyledText>
        </StyledView>

        {/* Location Inputs */}
        <StyledView className="mb-4">
          <LocationInput
            placeholder="Nereden?"
            onLocationSelect={(details) => setStartLocation(details)}
            icon="map-marker-outline"
          />
          
          {waypoints.map((waypoint, index) => (
            <StyledView key={index} className="flex-row items-center">
              <LocationInput
                placeholder={`Ara Durak ${index + 1}`}
                onLocationSelect={(details) => {
                  const newWaypoints = [...waypoints];
                  newWaypoints[index] = details;
                  setWaypoints(newWaypoints);
                }}
                icon="map-marker-plus"
              />
              <StyledTouchableOpacity
                onPress={() => handleRemoveWaypoint(index)}
                className="p-2"
              >
                <Icon name="close-circle" size={24} color="#EF4444" />
              </StyledTouchableOpacity>
            </StyledView>
          ))}

          <LocationInput
            placeholder="Nereye?"
            onLocationSelect={(details) => setEndLocation(details)}
            icon="map-marker"
          />
        </StyledView>

        {/* Add Waypoint Button */}
        <StyledTouchableOpacity
          onPress={handleAddWaypoint}
          className="flex-row items-center justify-center mx-4 mb-4 p-3 rounded-xl bg-gray-800"
        >
          <Icon name="plus-circle-outline" size={24} color="#60A5FA" />
          <StyledText className="ml-2 text-blue-400 font-medium">
            Ara Durak Ekle
          </StyledText>
        </StyledTouchableOpacity>

        {/* Action Buttons */}
        <StyledView className="flex-row justify-between px-4 mt-4">
          <StyledButton
            mode="contained"
            onPress={handleClear}
            className="flex-1 mr-2 bg-gray-700"
            contentStyle={{ height: 50 }}
          >
            Temizle
          </StyledButton>
          <StyledButton
            mode="contained"
            onPress={handlePlan}
            className="flex-1 ml-2 bg-blue-600"
            contentStyle={{ height: 50 }}
            disabled={!startLocation || !endLocation}
          >
            Planla
          </StyledButton>
        </StyledView>
      </StyledScrollView>
    </StyledSafeAreaView>
  );
};

export default RoutePlannerScreen; 