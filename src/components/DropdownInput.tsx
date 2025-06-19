import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { styled } from 'nativewind/dist/styled';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);
const StyledPressable = styled(Pressable);

interface Option {
  label: string;
  value: string;
}

interface DropdownInputProps {
  placeholder: string;
  options: Option[];
  value?: string;
  onSelect: (option: Option) => void;
  className?: string;
  error?: string;
  disabled?: boolean;
}

const DropdownInput: React.FC<DropdownInputProps> = ({
  placeholder,
  options,
  value,
  onSelect,
  className = '',
  error,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = options.find(opt => opt.value === value);

  const handleSelect = (option: Option) => {
    onSelect(option);
    setIsOpen(false);
  };

  return (
    <>
      <StyledView className="w-full">
        <StyledTouchableOpacity
          onPress={() => !disabled && setIsOpen(true)}
          className={`
            h-12 
            px-4 
            bg-gray-800 
            rounded-xl 
            flex-row 
            items-center 
            justify-between
            ${error ? 'border border-red-500' : ''} 
            ${disabled ? 'opacity-50' : ''} 
            ${className}
          `}
        >
          <StyledText
            className={`flex-1 ${
              selectedOption ? 'text-white' : 'text-gray-400'
            }`}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </StyledText>
          <Icon
            name={isOpen ? 'chevron-up' : 'chevron-down'}
            size={24}
            color="#6B7280"
          />
        </StyledTouchableOpacity>

        {error && (
          <StyledText className="text-red-500 text-sm mt-1 ml-1">
            {error}
          </StyledText>
        )}
      </StyledView>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <StyledPressable
          className="flex-1 bg-black/50"
          onPress={() => setIsOpen(false)}
        >
          <StyledView className="flex-1 justify-end">
            <StyledView className="bg-gray-900 rounded-t-xl max-h-96">
              <StyledView className="p-4 border-b border-gray-800">
                <StyledText className="text-white text-lg font-semibold">
                  {placeholder}
                </StyledText>
              </StyledView>

              <StyledScrollView className="p-2">
                {options.map((option) => (
                  <StyledTouchableOpacity
                    key={option.value}
                    onPress={() => handleSelect(option)}
                    className={`
                      p-4 
                      rounded-xl 
                      flex-row 
                      items-center 
                      justify-between
                      ${
                        option.value === value
                          ? 'bg-blue-600'
                          : 'bg-gray-800'
                      }
                    `}
                  >
                    <StyledText className="text-white">
                      {option.label}
                    </StyledText>
                    {option.value === value && (
                      <Icon name="check" size={20} color="white" />
                    )}
                  </StyledTouchableOpacity>
                ))}
              </StyledScrollView>
            </StyledView>
          </StyledView>
        </StyledPressable>
      </Modal>
    </>
  );
};

export default DropdownInput; 