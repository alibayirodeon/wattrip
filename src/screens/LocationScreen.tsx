import React, { useCallback } from 'react';
import { View, ScrollView, Switch, TouchableOpacity } from 'react-native';
import { Text, Button, TextInput, Chip } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import BottomTabBar from '../components/BottomTabBar';
import { useLocationStore } from '../context/useLocationStore';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { shortenAddress } from '../lib/shortenAddress';

const vehicleOptions = [
  { label: 'Peugeot, e-2008…', value: 'peugeot' },
];

const LocationScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { from, to } = useLocationStore();
  const [advanced, setAdvanced] = React.useState(false);

  const goToSearch = useCallback((type: 'from' | 'to') => {
    navigation.navigate('SearchLocation', { type });
  }, [navigation]);

  const handleRoutePlan = () => {
    // Burada from ve to koordinatlarını alıp RouteDetailScreen'e yönlendirebilirsin
    navigation.navigate('RouteDetail');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fafbfc' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Üst başlık ve araç seçici */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 32, marginHorizontal: 20 }}>
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#1A2B49' }}>Rota Oluştur</Text>
          <Button mode="outlined" icon="car" style={{ borderRadius: 16, borderColor: '#E0E7EF' }} textColor="#1A2B49" contentStyle={{ flexDirection: 'row-reverse' }}>
            Peugeot, e-2008…
          </Button>
        </View>
        {/* Başlangıç ve Bitiş Noktası */}
        <View style={{ marginTop: 32, marginHorizontal: 20 }}>
          <TouchableOpacity activeOpacity={0.8} onPress={() => goToSearch('from')}>
            <TextInput
              label="Başlangıç Noktası"
              value={shortenAddress(from)}
              mode="outlined"
              left={<TextInput.Icon icon="dots-horizontal" />}
              style={{ marginBottom: 12, backgroundColor: '#fff' }}
              editable={false}
              pointerEvents="none"
              multiline
              numberOfLines={2}
            />
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.8} onPress={() => goToSearch('to')}>
            <TextInput
              label="Bitiş Noktası"
              value={shortenAddress(to)}
              mode="outlined"
              left={<TextInput.Icon icon="map-marker-outline" />}
              style={{ backgroundColor: '#fff' }}
              editable={false}
              pointerEvents="none"
              multiline
              numberOfLines={2}
            />
          </TouchableOpacity>
          <Button mode="text" textColor="#1976D2" style={{ alignSelf: 'flex-start', marginTop: 8 }}>
            Durak Ekle
          </Button>
        </View>
        {/* Filtreler */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginTop: 16 }}>
          <Chip style={{ marginRight: 8 }} icon="tune">AC</Chip>
          <Chip style={{ marginRight: 8 }} icon="tune">DC</Chip>
          <Chip style={{ marginRight: 8 }} icon="leaf">Yeşil Enerji</Chip>
          <Chip icon="star-outline">Puan</Chip>
        </View>
        {/* Gelişmiş Seçenekler */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginTop: 12 }}>
          <Text style={{ color: '#1A2B49', fontWeight: '500', fontSize: 15, marginRight: 8 }}>Gelişmiş Seçenekler</Text>
          <Switch value={advanced} onValueChange={setAdvanced} />
        </View>
        {/* Rota Oluştur Butonu */}
        <Button
          mode="contained-tonal"
          icon="swap-horizontal"
          style={{ marginHorizontal: 20, marginTop: 24, borderRadius: 24, height: 48, justifyContent: 'center' }}
          contentStyle={{ height: 48 }}
          disabled={!from || !to}
          onPress={handleRoutePlan}
        >
          Rota Oluştur
        </Button>
        {/* Rotalarım kutusu */}
        <View style={{ alignItems: 'center', marginTop: 40, marginHorizontal: 20, backgroundColor: '#F5F8FA', borderRadius: 20, padding: 32 }}>
          <Icon name="heart-outline" size={48} color="#90A4AE" style={{ marginBottom: 8 }} />
          <Text style={{ color: '#90A4AE', fontWeight: 'bold', fontSize: 18, marginBottom: 4 }}>Rotalarım</Text>
          <Text style={{ color: '#90A4AE', textAlign: 'center' }}>
            Henüz hiçbir rota kaydedilmedi. {'\n'}Sık kullandığınız rotaları kaydedin ve hızlıca ulaşın.
          </Text>
        </View>
      </ScrollView>
      {/* Alt Menü */}
      <BottomTabBar currentRoute="Location" />
    </View>
  );
};

export default LocationScreen; 