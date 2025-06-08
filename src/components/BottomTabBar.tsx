import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const tabs = [
  { label: 'Harita', icon: 'map-outline' },
  { label: 'Rota', icon: 'map-marker-path', active: true },
  { label: 'Keşfet', icon: 'compass-outline' },
  { label: 'Profil', icon: 'account-outline' },
];

const BottomTabBar = () => {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', height: 64, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#f0f0f0' }}>
      {tabs.map((tab, idx) => (
        <TouchableOpacity key={tab.label} style={{ alignItems: 'center', flex: 1 }}>
          <Icon
            name={tab.icon}
            size={28}
            color={tab.active ? '#1976D2' : '#90A4AE'}
            style={tab.active ? { backgroundColor: '#E3F2FD', borderRadius: 20, padding: 8, marginBottom: 2 } : { marginBottom: 2 }}
          />
          <Text style={{ color: tab.active ? '#1976D2' : '#90A4AE', fontWeight: tab.active ? 'bold' : 'normal', fontSize: 12 }}>{tab.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

export default BottomTabBar; 