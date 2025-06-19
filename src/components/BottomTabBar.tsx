import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

interface TabItem {
  label: string;
  icon: string;
  route?: keyof RootStackParamList;
  active?: boolean;
}

interface BottomTabBarProps {
  currentRoute?: string;
}

const tabs: TabItem[] = [
  { label: 'Harita', icon: 'map-outline' },
  { label: 'Rota', icon: 'map-marker-path', route: 'Location' },
  { label: 'Keşfet', icon: 'compass-outline' },
  { label: 'Profil', icon: 'account-outline', route: 'Profile' },
];

const BottomTabBar: React.FC<BottomTabBarProps> = ({ currentRoute = 'Location' }) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const handleTabPress = (tab: TabItem) => {
    if (tab.route) {
      navigation.navigate(tab.route as any);
    }
  };

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', height: 64, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#f0f0f0' }}>
      {tabs.map((tab, idx) => {
        const isActive = currentRoute === tab.route || (currentRoute === 'Location' && tab.label === 'Rota');
        
        return (
          <TouchableOpacity 
            key={tab.label} 
            style={{ alignItems: 'center', flex: 1 }}
            onPress={() => handleTabPress(tab)}
            disabled={!tab.route}
          >
            <Icon
              name={tab.icon}
              size={28}
              color={isActive ? '#1976D2' : '#90A4AE'}
              style={isActive ? { backgroundColor: '#E3F2FD', borderRadius: 20, padding: 8, marginBottom: 2 } : { marginBottom: 2 }}
            />
            <Text style={{ 
              color: isActive ? '#1976D2' : '#90A4AE', 
              fontWeight: isActive ? 'bold' : 'normal', 
              fontSize: 12 
            }}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default BottomTabBar; 