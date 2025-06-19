import React from 'react';
import { View, TextInput, Text, TouchableOpacity } from 'react-native';
import { styled } from 'nativewind/dist/styled';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const StyledView = styled(View);
const StyledTextInput = styled(TextInput);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

interface NumberInputProps {
  placeholder: string;
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  className?: string;
  error?: string;
  disabled?: boolean;
}

const NumberInput: React.FC<NumberInputProps> = ({
  placeholder,
  value,
  onValueChange,
  min = 0,
  max = Infinity,
  step = 1,
  unit,
  className = '',
  error,
  disabled = false,
}) => {
  const increment = () => {
    if (disabled || value + step > max) return;
    onValueChange(value + step);
  };

  const decrement = () => {
    if (disabled || value - step < min) return;
    onValueChange(value - step);
  };

  const handleTextChange = (text: string) => {
    const num = parseFloat(text);
    if (isNaN(num)) return;
    if (num >= min && num <= max) {
      onValueChange(num);
    }
  };

  return (
    <StyledView className="w-full">
      <StyledView
        className={`
          flex-row 
          items-center 
          bg-gray-800 
          rounded-xl 
          ${error ? 'border border-red-500' : ''} 
          ${disabled ? 'opacity-50' : ''} 
          ${className}
        `}
      >
        {/* Decrement Button */}
        <StyledTouchableOpacity
          onPress={decrement}
          disabled={disabled || value <= min}
          className="p-3"
        >
          <Icon
            name="minus-circle"
            size={24}
            color={disabled || value <= min ? '#4B5563' : '#60A5FA'}
          />
        </StyledTouchableOpacity>

        {/* Input */}
        <StyledView className="flex-1 flex-row items-center justify-center">
          <StyledTextInput
            className="text-white text-center text-lg font-semibold"
            value={value.toString()}
            onChangeText={handleTextChange}
            keyboardType="numeric"
            editable={!disabled}
            selectionColor="#60A5FA"
          />
          {unit && (
            <StyledText className="text-gray-400 ml-1">
              {unit}
            </StyledText>
          )}
        </StyledView>

        {/* Increment Button */}
        <StyledTouchableOpacity
          onPress={increment}
          disabled={disabled || value >= max}
          className="p-3"
        >
          <Icon
            name="plus-circle"
            size={24}
            color={disabled || value >= max ? '#4B5563' : '#60A5FA'}
          />
        </StyledTouchableOpacity>
      </StyledView>

      {/* Error Message */}
      {error && (
        <StyledText className="text-red-500 text-sm mt-1 ml-1">
          {error}
        </StyledText>
      )}
    </StyledView>
  );
};

export default NumberInput; 