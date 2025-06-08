import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider as PaperProvider } from 'react-native-paper';
import LocationScreen from './src/screens/LocationScreen';
import SearchLocationScreen from './src/screens/SearchLocationScreen';
import MapSelectionScreen from './src/screens/MapSelectionScreen';
import RouteDetailScreen from './src/screens/RouteDetailScreen';
import { RootStackParamList } from './src/navigation/types';
import * as Location from 'expo-location';
import { useEffect } from 'react';
import { Alert } from 'react-native';
import { useLocationStore } from './src/context/useLocationStore';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const setLastKnownLocation = useLocationStore(s => s.setLastKnownLocation);
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Konum izni reddedildi', 'Konum tabanlı özellikler çalışmayabilir.');
        return;
      }
      let location = await Location.getCurrentPositionAsync({});
      setLastKnownLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    })();
  }, []);

  return (
    <PaperProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Location">
          <Stack.Screen name="Location" component={LocationScreen} options={{ title: 'Rota Planla' }} />
          <Stack.Screen name="SearchLocation" component={SearchLocationScreen} options={{ title: '', headerShown: false }} />
          <Stack.Screen name="MapSelection" component={MapSelectionScreen} options={{ title: 'Haritadan Seç', headerShown: true }} />
          <Stack.Screen name="RouteDetail" component={RouteDetailScreen} options={{ title: 'Rota Detayı' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}
