import React, { useCallback, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { Text, TextInput, Button, Card } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import BottomTabBar from '../components/BottomTabBar';
import { useLocationStore } from '../context/useLocationStore';
import { useVehicleStore, useSelectedVehicle, getVehicleDisplayName } from '../context/useVehicleStore';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { shortenAddress } from '../lib/shortenAddress';
import { styled } from 'nativewind/dist/styled';

const StyledView = styled(View);
const StyledScrollView = styled(ScrollView);
const StyledSafeAreaView = styled(SafeAreaView);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledCard = styled(Card);
const StyledButton = styled(Button);
const BaseStyledTextInput = styled(TextInput);
const StyledTextInput = Object.assign(BaseStyledTextInput, { Icon: TextInput.Icon });

type SegmentSelectorProps = {
  value: number;
  onChange: (v: number) => void;
};

const SegmentSelector: React.FC<SegmentSelectorProps> = ({ value, onChange }) => (
  <View className="flex-row items-center justify-center my-4">
    {[0, 1, 2, 3, 4].map(i => (
      <TouchableOpacity
        key={i}
        onPress={() => onChange(i)}
        className={`w-[18px] h-[18px] rounded-full mx-3 border-2 ${value === i ? 'border-blue-500 bg-[#111a]' : 'border-gray-600 bg-gray-800'} items-center justify-center`}
      >
        {value === i && <View className="w-[10px] h-[10px] rounded-full bg-blue-500" />}
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
    <StyledSafeAreaView className="flex-1 bg-[#111]">
      <StyledScrollView className="flex-1 pb-6">
        {/* Nereden alanı */}
        <StyledTouchableOpacity activeOpacity={0.8} onPress={() => goToSearch('from')} className="mt-2 mx-4 mb-2">
          <StyledTextInput
            mode="outlined"
            placeholder="Nereden?"
            value={shortenAddress(from)}
            className="bg-gray-800 rounded-2xl"
            left={<StyledTextInput.Icon icon="map-marker" color="#aaa" />}
            editable={false}
            pointerEvents="none"
          />
        </StyledTouchableOpacity>
        {/* Nereye alanı */}
        <StyledTouchableOpacity activeOpacity={0.8} onPress={() => goToSearch('to')} className="mx-4 mb-2">
          <StyledTextInput
            mode="outlined"
            placeholder="Nereye gitmek istiyorsunuz?"
            value={shortenAddress(to)}
            className="bg-gray-800 rounded-2xl"
            left={<StyledTextInput.Icon icon="magnify" color="#aaa" />}
            right={<StyledTextInput.Icon icon="flash" color="#fff" className="bg-gray-800 rounded-xl" />}
            editable={false}
            pointerEvents="none"
          />
        </StyledTouchableOpacity>
        {/* Kısa yol butonları */}
        <View className="flex-row justify-between mx-4 mt-3">
          <StyledButton mode="contained" icon="home" className="rounded-xl bg-gray-800 mx-0.5 min-w-[90px] h-[38px] justify-center">Ev olarak ayarla</StyledButton>
          <StyledButton mode="contained" icon="briefcase" className="rounded-xl bg-gray-800 mx-0.5 min-w-[90px] h-[38px] justify-center">İş olarak ayarla</StyledButton>
          <StyledButton mode="contained" icon="content-copy" className="rounded-xl bg-gray-800 mx-0.5 min-w-[90px] h-[38px] justify-center">D</StyledButton>
        </View>
        {/* Araç kartı ve batarya barı */}
        <StyledCard className="bg-[#181818] rounded-2xl mx-4 mt-5 p-4 border border-gray-800">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Icon name="car" size={28} color="#fff" className="mr-2" />
              <View>
                <Text className="text-white font-bold text-lg">Peugeot e-2008 48 kWh</Text>
                <Text className="text-gray-400 text-xs">Standart</Text>
              </View>
            </View>
            <View className="flex-row items-center">
              <Icon name="battery" size={22} color="#fff" className="mr-1" />
              <Text className="text-white font-bold text-lg">{startSOC} %</Text>
            </View>
          </View>
          {/* Batarya barı */}
          <View className="mt-4 mb-1">
            <View className="h-2 rounded bg-gray-700 overflow-hidden">
              <View className={`h-2 bg-green-500`} style={{ width: `${startSOC}%` }} />
            </View>
          </View>
        </StyledCard>
        {/* Kaydedilen/Son Planlar */}
        <View className="flex-row justify-between mx-4 mt-4">
          <StyledButton mode="contained" icon="heart-outline" className="rounded-xl bg-gray-800 mx-0.5 min-w-[140px] h-[38px] justify-center">Kaydedilen planlar</StyledButton>
          <StyledButton mode="contained" icon="history" className="rounded-xl bg-gray-800 mx-0.5 min-w-[140px] h-[38px] justify-center">Son planlar</StyledButton>
        </View>
        {/* Varış şarj durumu sliderı */}
        <View className="mx-4 mt-7">
          <Text className="text-white font-bold text-base mb-2">Varış şarj durumu</Text>
          <View className="flex-row items-center">
            <View className="flex-1">
              <View className="h-1.5 bg-gray-700 rounded">
                <View className={`h-1.5 bg-blue-500 rounded`} style={{ width: `${arrivalSOC}%` }} />
              </View>
            </View>
            <Text className="text-white ml-3 font-bold text-base">{arrivalSOC} %</Text>
          </View>
        </View>
        {/* Şarj durakları segmenti */}
        <View className="mx-4 mt-7">
          <Text className="text-white font-bold text-base mb-2">Şarj Durakları</Text>
          <SegmentSelector value={segmentPref} onChange={setSegmentPref} />
          <View className="flex-row justify-between mx-2">
            <Text className="text-gray-400 text-xs w-20">Az ama uzun dur…</Text>
            <Text className="text-blue-500 font-bold text-sm">En hızlı varış</Text>
            <Text className="text-gray-400 text-xs w-20 text-right">Kısa ama çok durak</Text>
          </View>
        </View>
        {/* Alt butonlar: Solda Temizle, sağda Rota Planla */}
        <View className="flex-row justify-between mx-4 mt-7">
          <StyledButton mode="contained" icon="close" className="rounded-xl bg-gray-800 mx-0.5 min-w-[140px] h-[38px] justify-center" onPress={handleClear}>Temizle</StyledButton>
          <StyledButton mode="contained" icon="swap-horizontal" className="rounded-xl bg-gray-800 mx-0.5 min-w-[140px] h-[38px] justify-center" onPress={handleRoutePlan}>Rota Planla</StyledButton>
        </View>
      </StyledScrollView>
      <BottomTabBar currentRoute="Location" />
    </StyledSafeAreaView>
  );
};

export default LocationScreen; 