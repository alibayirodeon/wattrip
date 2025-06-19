import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { styled } from 'nativewind/dist/styled';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

interface ChargingStationCardProps {
  name: string;
  power: number;
  available: boolean;
  rating: number;
  distance?: string;
  className?: string;
  onPress?: () => void;
}

const ChargingStationCard: React.FC<ChargingStationCardProps> = ({
  name,
  power,
  available,
  rating,
  distance,
  className = '',
  onPress,
}) => {
  return (
    <StyledTouchableOpacity
      className={`bg-gray-800 rounded-xl p-4 ${className}`}
      onPress={onPress}
      disabled={!onPress}
    >
      <StyledView className="flex-row justify-between items-start">
        <StyledView className="flex-1">
          <StyledText className="text-white text-lg font-semibold mb-1">
            {name}
          </StyledText>
          <StyledView className="flex-row items-center space-x-2">
            <Icon name="flash" size={16} color="#60A5FA" />
            <StyledText className="text-gray-400">
              {power} kW DC
            </StyledText>
          </StyledView>
        </StyledView>
        
        <StyledView className="items-end">
          {distance && (
            <StyledText className="text-gray-400 mb-1">
              {distance}
            </StyledText>
          )}
          <StyledView className="flex-row items-center space-x-1">
            <Icon name="star" size={16} color="#FBBF24" />
            <StyledText className="text-white">
              {rating.toFixed(1)}
            </StyledText>
          </StyledView>
        </StyledView>
      </StyledView>

      <StyledView className="mt-3 flex-row items-center space-x-2">
        <StyledView
          className={`h-2 w-2 rounded-full ${
            available ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
        <StyledText className="text-gray-400">
          {available ? 'Müsait' : 'Meşgul'}
        </StyledText>
      </StyledView>
    </StyledTouchableOpacity>
  );
};

export default ChargingStationCard; 