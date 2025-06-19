import React from 'react';
import { View, Text } from 'react-native';
import { styled } from 'nativewind/dist/styled';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const StyledView = styled(View);
const StyledText = styled(Text);

interface BatteryBarProps {
  percentage: number;
  charging?: boolean;
  className?: string;
  showIcon?: boolean;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const BatteryBar: React.FC<BatteryBarProps> = ({
  percentage,
  charging = false,
  className = '',
  showIcon = true,
  showPercentage = true,
  size = 'md',
}) => {
  // Batarya seviyesine göre renk belirleme
  const getBarColor = () => {
    if (percentage <= 20) return 'bg-red-500';
    if (percentage <= 40) return 'bg-orange-500';
    return 'bg-green-500';
  };

  // Boyut sınıflarını belirleme
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'h-2 text-xs';
      case 'lg':
        return 'h-4 text-base';
      default:
        return 'h-3 text-sm';
    }
  };

  const sizeClass = getSizeClasses();
  const barColor = getBarColor();

  return (
    <StyledView className={`flex-row items-center space-x-2 ${className}`}>
      {showIcon && (
        <Icon
          name={charging ? 'battery-charging' : 'battery'}
          size={size === 'sm' ? 16 : size === 'lg' ? 24 : 20}
          color={percentage <= 20 ? '#EF4444' : '#10B981'}
        />
      )}

      <StyledView className="flex-1">
        <StyledView
          className={`w-full bg-gray-700 rounded-full overflow-hidden ${sizeClass}`}
        >
          <StyledView
            className={`${barColor} h-full rounded-full`}
            style={{ width: `${percentage}%` }}
          />
        </StyledView>
      </StyledView>

      {showPercentage && (
        <StyledText
          className={`text-white font-medium ${
            size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm'
          }`}
        >
          {percentage}%
        </StyledText>
      )}
    </StyledView>
  );
};

export default BatteryBar; 