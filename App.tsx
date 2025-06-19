import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider as PaperProvider } from 'react-native-paper';
import LocationScreen from './src/screens/LocationScreen';
import SearchLocationScreen from './src/screens/SearchLocationScreen';
import MapSelectionScreen from './src/screens/MapSelectionScreen';
import RouteDetailScreen from './src/screens/RouteDetailScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ErrorBoundary from './src/components/ErrorBoundary';
import { RootStackParamList } from './src/navigation/types';
import * as Location from 'expo-location';
import { useEffect } from 'react';
import { Alert } from 'react-native';
import { useLocationStore } from './src/context/useLocationStore';
import { withExpoSnack } from 'nativewind';

const Stack = createNativeStackNavigator<RootStackParamList>();

function App() {
  const setLastKnownLocation = useLocationStore(s => s.setLastKnownLocation);
  
  useEffect(() => {
    const initializeLocation = async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Konum izni reddedildi', 'Konum tabanlı özellikler çalışmayabilir.');
          return;
        }
        
        let location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        
        setLastKnownLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } catch (error) {
        console.warn('Location initialization failed:', error);
        // Don't show alert for location errors during startup
      }
    };
    
    initializeLocation();
  }, [setLastKnownLocation]);

  return (
    <ErrorBoundary>
      <PaperProvider>
        <NavigationContainer>
          <Stack.Navigator initialRouteName="Location">
            <Stack.Screen 
              name="Location" 
              component={LocationScreen} 
              options={{ title: 'Rota Planla' }} 
            />
            <Stack.Screen 
              name="SearchLocation" 
              component={SearchLocationScreen} 
              options={{ title: '', headerShown: false }} 
            />
            <Stack.Screen 
              name="MapSelection" 
              component={MapSelectionScreen} 
              options={{ title: 'Haritadan Seç', headerShown: false }} 
            />
            <Stack.Screen 
              name="RouteDetail" 
              component={RouteDetailScreen} 
              options={{ title: 'Rota Detayı' }} 
            />
            <Stack.Screen 
              name="Profile" 
              component={ProfileScreen} 
              options={{ title: 'Profil', headerShown: false }} 
            />
          </Stack.Navigator>
        </NavigationContainer>
      </PaperProvider>
    </ErrorBoundary>
  );
}

export default withExpoSnack(App);
