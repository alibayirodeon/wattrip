import React, { useCallback, useEffect } from 'react';
import { View, ScrollView, Switch, TouchableOpacity } from 'react-native';
import { Text, Button, TextInput, Chip, Card } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import BottomTabBar from '../components/BottomTabBar';
import { useLocationStore } from '../context/useLocationStore';
import { useVehicleStore, useSelectedVehicle, getVehicleDisplayName, formatSocketType } from '../context/useVehicleStore';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { shortenAddress } from '../lib/shortenAddress';

const vehicleOptions = [
  { label: 'Peugeot, e-2008…', value: 'peugeot' },
];

// Simple slider component
const SimpleSlider = ({ 
  value, 
  onValueChange, 
  minimumValue, 
  maximumValue, 
  step, 
  trackColor = '#E0E0E0',
  activeTrackColor = '#2196F3',
  thumbColor = '#2196F3'
}: {
  value: number;
  onValueChange: (value: number) => void;
  minimumValue: number;
  maximumValue: number;
  step: number;
  trackColor?: string;
  activeTrackColor?: string;
  thumbColor?: string;
}) => {
  const percentage = ((value - minimumValue) / (maximumValue - minimumValue)) * 100;
  
  return (
    <View style={{ height: 40, justifyContent: 'center' }}>
      <View style={{
        height: 6,
        backgroundColor: trackColor,
        borderRadius: 3,
        position: 'relative'
      }}>
        <View style={{
          height: 6,
          backgroundColor: activeTrackColor,
          borderRadius: 3,
          width: `${percentage}%`
        }} />
        <TouchableOpacity
          style={{
            position: 'absolute',
            left: `${percentage}%`,
            top: -7,
            width: 20,
            height: 20,
            backgroundColor: thumbColor,
            borderRadius: 10,
            marginLeft: -10,
            elevation: 3,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
          }}
          onPress={() => {
            // Simple increment/decrement on press
            const newValue = value + step <= maximumValue ? value + step : minimumValue;
            onValueChange(newValue);
          }}
        />
      </View>
    </View>
  );
};

const LocationScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { from, to } = useLocationStore();
  const [advanced, setAdvanced] = React.useState(false);
  const [startBatteryPercentage, setStartBatteryPercentage] = React.useState(80);
  const [minArrivalBatteryPercentage, setMinArrivalBatteryPercentage] = React.useState(20);
  
  const { initializeMockData } = useVehicleStore();
  const selectedVehicle = useSelectedVehicle();

  // Initialize vehicles on component mount
  useEffect(() => {
    initializeMockData();
  }, [initializeMockData]);

  const goToSearch = useCallback((type: 'from' | 'to') => {
    navigation.navigate('SearchLocation', { type });
  }, [navigation]);

  const handleRoutePlan = () => {
    // Burada from ve to koordinatlarını alıp RouteDetailScreen'e yönlendirebilirsin
    navigation.navigate('RouteDetail');
  };

  const handleVehicleSelect = () => {
    navigation.navigate('Profile');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fafbfc' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Üst başlık ve araç seçici */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 32, marginHorizontal: 20 }}>
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#1A2B49' }}>Rota Oluştur</Text>
          <Button 
            mode="outlined" 
            icon="car" 
            style={{ borderRadius: 16, borderColor: '#E0E7EF' }} 
            textColor="#1A2B49" 
            contentStyle={{ flexDirection: 'row-reverse' }}
            onPress={handleVehicleSelect}
          >
            Araç Seç
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
        {/* EV Konfigürasyon Kartı */}
        {selectedVehicle && (
          <View style={{ marginHorizontal: 20, marginTop: 24 }}>
            <Card style={{ 
              backgroundColor: 'white', 
              borderRadius: 20, 
              elevation: 3,
              borderWidth: 2,
              borderColor: '#E3F2FD'
            }}>
              {/* Araç Başlığı */}
              <View style={{ 
                backgroundColor: '#E3F2FD', 
                borderTopLeftRadius: 18, 
                borderTopRightRadius: 18,
                paddingHorizontal: 20,
                paddingVertical: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ 
                    fontSize: 20, 
                    fontWeight: 'bold', 
                    color: '#1A2B49',
                    marginBottom: 4
                  }}>
                    {getVehicleDisplayName(selectedVehicle)} {selectedVehicle.batteryCapacity} kWh
                  </Text>
                </View>
                <TouchableOpacity 
                  onPress={handleVehicleSelect}
                  style={{ 
                    backgroundColor: 'rgba(26, 43, 73, 0.1)', 
                    borderRadius: 12, 
                    padding: 8 
                  }}
                >
                  <Icon name="cog" size={20} color="#1A2B49" />
                </TouchableOpacity>
              </View>

              {/* Araç Bilgileri Grid */}
              <View style={{ 
                paddingHorizontal: 20, 
                paddingTop: 20,
                paddingBottom: 16
              }}>
                <View style={{ 
                  flexDirection: 'row', 
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  marginBottom: 20
                }}>
                  {/* Güç */}
                  <View style={{ 
                    backgroundColor: '#F0F9FF', 
                    borderRadius: 16, 
                    padding: 12,
                    width: '48%',
                    marginBottom: 8,
                    flexDirection: 'row',
                    alignItems: 'center'
                  }}>
                    <View style={{ 
                      backgroundColor: '#4CAF50', 
                      borderRadius: 20, 
                      padding: 8, 
                      marginRight: 10 
                    }}>
                      <Icon name="flash" size={16} color="white" />
                    </View>
                    <View>
                      <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1A2B49' }}>
                        101 kW
                      </Text>
                    </View>
                  </View>

                  {/* Batarya */}
                  <View style={{ 
                    backgroundColor: '#F0F9FF', 
                    borderRadius: 16, 
                    padding: 12,
                    width: '48%',
                    marginBottom: 8,
                    flexDirection: 'row',
                    alignItems: 'center'
                  }}>
                    <View style={{ 
                      backgroundColor: '#4CAF50', 
                      borderRadius: 20, 
                      padding: 8, 
                      marginRight: 10 
                    }}>
                      <Icon name="battery" size={16} color="white" />
                    </View>
                    <View>
                      <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1A2B49' }}>
                        {selectedVehicle.batteryCapacity}/{selectedVehicle.batteryCapacity} kWh
                      </Text>
                    </View>
                  </View>

                  {/* Konektör */}
                  <View style={{ 
                    backgroundColor: '#F0F9FF', 
                    borderRadius: 16, 
                    padding: 12,
                    width: '48%',
                    flexDirection: 'row',
                    alignItems: 'center'
                  }}>
                    <View style={{ 
                      backgroundColor: '#4CAF50', 
                      borderRadius: 20, 
                      padding: 8, 
                      marginRight: 10 
                    }}>
                      <Icon name="power-plug" size={16} color="white" />
                    </View>
                    <View>
                      <Text style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>
                        {formatSocketType(selectedVehicle.socketType)}
                      </Text>
                      <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1A2B49' }}>
                        270/270
                      </Text>
                    </View>
                  </View>

                  {/* WLTP */}
                  <View style={{ 
                    backgroundColor: '#F0F9FF', 
                    borderRadius: 16, 
                    padding: 12,
                    width: '48%',
                    flexDirection: 'row',
                    alignItems: 'center'
                  }}>
                    <View style={{ 
                      backgroundColor: '#4CAF50', 
                      borderRadius: 20, 
                      padding: 8, 
                      marginRight: 10 
                    }}>
                      <Icon name="speedometer" size={16} color="white" />
                    </View>
                    <View>
                      <Text style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>WLTP</Text>
                      <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1A2B49' }}>
                        340/340
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Başlangıç Batarya Yüzdesi */}
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ 
                    fontSize: 16, 
                    fontWeight: 'bold', 
                    color: '#1A2B49', 
                    marginBottom: 12 
                  }}>
                    Başlangıç Batarya Yüzdesi
                  </Text>
                  <View style={{ 
                    backgroundColor: '#F8F9FA', 
                    borderRadius: 12, 
                    paddingHorizontal: 16,
                    paddingVertical: 8
                  }}>
                    <SimpleSlider
                      value={startBatteryPercentage}
                      onValueChange={setStartBatteryPercentage}
                      minimumValue={10}
                      maximumValue={100}
                      step={5}
                      activeTrackColor="#2196F3"
                      thumbColor="#2196F3"
                    />
                    <View style={{ 
                      flexDirection: 'row', 
                      justifyContent: 'space-between',
                      marginTop: -8
                    }}>
                      <Text style={{ fontSize: 12, color: '#666' }}>10%</Text>
                      <Text style={{ 
                        fontSize: 16, 
                        fontWeight: 'bold', 
                        color: '#2196F3' 
                      }}>
                        %{Math.round(startBatteryPercentage)}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#666' }}>100%</Text>
                    </View>
                  </View>
                </View>

                {/* Minimum Varış Batarya Yüzdesi */}
                <View>
                  <Text style={{ 
                    fontSize: 16, 
                    fontWeight: 'bold', 
                    color: '#1A2B49', 
                    marginBottom: 12 
                  }}>
                    Minimum Varış Batarya Yüzdesi
                  </Text>
                  <View style={{ 
                    backgroundColor: '#F8F9FA', 
                    borderRadius: 12, 
                    paddingHorizontal: 16,
                    paddingVertical: 8
                  }}>
                    <SimpleSlider
                      value={minArrivalBatteryPercentage}
                      onValueChange={setMinArrivalBatteryPercentage}
                      minimumValue={5}
                      maximumValue={50}
                      step={5}
                      activeTrackColor="#FF9800"
                      thumbColor="#FF9800"
                    />
                    <View style={{ 
                      flexDirection: 'row', 
                      justifyContent: 'space-between',
                      marginTop: -8
                    }}>
                      <Text style={{ fontSize: 12, color: '#666' }}>5%</Text>
                      <Text style={{ 
                        fontSize: 16, 
                        fontWeight: 'bold', 
                        color: '#FF9800' 
                      }}>
                        %{Math.round(minArrivalBatteryPercentage)}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#666' }}>50%</Text>
                    </View>
                  </View>
                </View>
              </View>
            </Card>
          </View>
        )}
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