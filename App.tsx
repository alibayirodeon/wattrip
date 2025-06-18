import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider as PaperProvider } from 'react-native-paper';
import RoutePlannerScreen from './src/screens/RoutePlannerScreen';

export type RootStackParamList = {
  RoutePlanner: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <PaperProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="RoutePlanner"
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen name="RoutePlanner" component={RoutePlannerScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}
