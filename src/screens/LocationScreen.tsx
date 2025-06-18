import React, { useCallback, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { Text, TextInput, Button, Card } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import BottomTabBar from '../components/BottomTabBar';
import { useLocationStore } from '../context/useLocationStore';
import { useVehicleStore, useSelectedVehicle, getVehicleDisplayName } from '../context/useVehicleStore';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { shortenAddress } from '../lib/shortenAddress';

type SegmentSelectorProps = {
  value: number;
  onChange: (v: number) => void;
};
const SegmentSelector: React.FC<SegmentSelectorProps> = ({ value, onChange }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 16 }}>
    {[0, 1, 2, 3, 4].map(i => (
      <TouchableOpacity
        key={i}
        onPress={() => onChange(i)}
        style={{
          width: 18, height: 18, borderRadius: 9, marginHorizontal: 12,
          borderWidth: 2, borderColor: value === i ? '#2196F3' : '#444',
          backgroundColor: value === i ? '#111a' : '#222', alignItems: 'center', justifyContent: 'center'
        }}
      >
        {value === i && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#2196F3' }} />}
      </TouchableOpacity>
    ))}
  </View>
);

const LocationScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { from, to } = useLocationStore();
  const [startSOC, setStartSOC] = React.useState(42);
  const [arrivalSOC, setArrivalSOC] = React.useState(10);
  const [segmentPref, setSegmentPref] = React.useState(2);
  const selectedVehicle = useSelectedVehicle();
  const { setFrom, setTo } = useLocationStore();

  const handleRoutePlan = () => navigation.navigate('RouteDetail');
  const goToSearch = useCallback((type: 'from' | 'to') => {
    navigation.navigate('SearchLocation', { type });
  }, [navigation]);
  const handleClear = () => {
    setFrom('', [0, 0]);
    setTo('', [0, 0]);
    setStartSOC(42);
    setArrivalSOC(10);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#111' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}>
        {/* Nereden alanı */}
        <TouchableOpacity activeOpacity={0.8} onPress={() => goToSearch('from')} style={{ marginTop: 8, marginHorizontal: 16, marginBottom: 8 }}>
          <TextInput
            mode="outlined"
            placeholder="Nereden?"
            value={shortenAddress(from)}
            style={{ backgroundColor: '#222', borderRadius: 16, borderWidth: 0, color: '#fff' }}
            left={<TextInput.Icon icon="map-marker" color="#aaa" />}
            editable={false}
            pointerEvents="none"
          />
        </TouchableOpacity>
        {/* Nereye alanı */}
        <TouchableOpacity activeOpacity={0.8} onPress={() => goToSearch('to')} style={{ marginHorizontal: 16, marginBottom: 8 }}>
          <TextInput
            mode="outlined"
            placeholder="Nereye gitmek istiyorsunuz?"
            value={shortenAddress(to)}
            style={{ backgroundColor: '#222', borderRadius: 16, borderWidth: 0, color: '#fff' }}
            left={<TextInput.Icon icon="magnify" color="#aaa" />}
            right={<TextInput.Icon icon="flash" color="#fff" style={{ backgroundColor: '#222', borderRadius: 12 }} />}
            editable={false}
            pointerEvents="none"
          />
        </TouchableOpacity>
        {/* Kısa yol butonları */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 16, marginTop: 12 }}>
          <Button mode="contained" icon="home" style={styles.shortcutBtn}>Ev olarak ayarla</Button>
          <Button mode="contained" icon="briefcase" style={styles.shortcutBtn}>İş olarak ayarla</Button>
          <Button mode="contained" icon="content-copy" style={styles.shortcutBtn}>D</Button>
        </View>
        {/* Araç kartı ve batarya barı */}
        <Card style={styles.vehicleCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Icon name="car" size={28} color="#fff" style={{ marginRight: 10 }} />
              <View>
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>Peugeot e-2008 48 kWh</Text>
                <Text style={{ color: '#aaa', fontSize: 13 }}>Standart</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Icon name="battery" size={22} color="#fff" style={{ marginRight: 4 }} />
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>{startSOC} %</Text>
            </View>
          </View>
          {/* Batarya barı */}
          <View style={{ marginTop: 16, marginBottom: 4 }}>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: '#333', overflow: 'hidden' }}>
              <View style={{ width: `${startSOC}%`, height: 8, backgroundColor: '#8bc34a' }} />
            </View>
          </View>
        </Card>
        {/* Kaydedilen/Son Planlar */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 16, marginTop: 18 }}>
          <Button mode="contained" icon="heart-outline" style={styles.planBtn}>Kaydedilen planlar</Button>
          <Button mode="contained" icon="history" style={styles.planBtn}>Son planlar</Button>
        </View>
        {/* Varış şarj durumu sliderı */}
        <View style={{ marginHorizontal: 16, marginTop: 28 }}>
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>Varış şarj durumu</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <View style={{ height: 6, backgroundColor: '#333', borderRadius: 3 }}>
                <View style={{ width: `${arrivalSOC}%`, height: 6, backgroundColor: '#2196F3', borderRadius: 3 }} />
              </View>
            </View>
            <Text style={{ color: '#fff', marginLeft: 12, fontWeight: 'bold', fontSize: 16 }}>{arrivalSOC} %</Text>
          </View>
        </View>
        {/* Şarj durakları segmenti */}
        <View style={{ marginHorizontal: 16, marginTop: 28 }}>
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>Şarj Durakları</Text>
          <SegmentSelector value={segmentPref} onChange={setSegmentPref} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 8 }}>
            <Text style={{ color: '#aaa', fontSize: 13, width: 80 }}>Az ama uzun dur…</Text>
            <Text style={{ color: '#2196F3', fontWeight: 'bold', fontSize: 14 }}>En hızlı varış</Text>
            <Text style={{ color: '#aaa', fontSize: 13, width: 80, textAlign: 'right' }}>Kısa ama çok durak</Text>
          </View>
        </View>
        {/* Alt butonlar: Solda Temizle, sağda Rota Planla */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 16, marginTop: 28 }}>
          <Button mode="contained" icon="close" style={styles.bottomBtn} onPress={handleClear}>Temizle</Button>
          <Button mode="contained" icon="swap-horizontal" style={styles.bottomBtn} onPress={handleRoutePlan}>Rota Planla</Button>
        </View>
      </ScrollView>
      <BottomTabBar currentRoute="Location" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  shortcutBtn: {
    borderRadius: 14,
    backgroundColor: '#222',
    marginHorizontal: 2,
    minWidth: 90,
    height: 38,
    justifyContent: 'center',
  },
  vehicleCard: {
    backgroundColor: '#181818',
    borderRadius: 18,
    marginHorizontal: 16,
    marginTop: 22,
    padding: 18,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#222',
  },
  planBtn: {
    borderRadius: 14,
    backgroundColor: '#222',
    marginHorizontal: 2,
    minWidth: 140,
    height: 38,
    justifyContent: 'center',
  },
  bottomBtn: {
    borderRadius: 14,
    backgroundColor: '#222',
    marginHorizontal: 2,
    minWidth: 140,
    height: 38,
    justifyContent: 'center',
  },
});

export default LocationScreen; 