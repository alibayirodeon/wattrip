import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import { styled } from 'nativewind/dist/styled';
import { ActivityIndicator } from 'react-native-paper';

const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledText = styled(Text);
const StyledView = styled(View);

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  title,
  onPress,
  disabled = false,
  loading = false,
  className = '',
  icon,
}) => {
  return (
    <StyledTouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      className={`
        bg-blue-600 
        rounded-xl 
        py-3 
        px-4 
        flex-row 
        items-center 
        justify-center 
        space-x-2
        ${disabled ? 'opacity-50' : ''} 
        ${className}
      `}
    >
      {loading ? (
        <ActivityIndicator color="white" size={20} />
      ) : (
        <StyledView className="flex-row items-center space-x-2">
          {icon && <StyledView className="mr-2">{icon}</StyledView>}
          <StyledText className="text-white font-semibold text-base">
            {title}
          </StyledText>
        </StyledView>
      )}
    </StyledTouchableOpacity>
  );
};

export default PrimaryButton; 