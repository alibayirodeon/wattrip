import React from 'react';
import { View, TextInput, TouchableOpacity } from 'react-native';
import { styled } from 'nativewind/dist/styled';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ActivityIndicator } from 'react-native-paper';

const StyledView = styled(View);
const StyledTextInput = styled(TextInput);
const StyledTouchableOpacity = styled(TouchableOpacity);

interface SearchInputProps {
  placeholder: string;
  onSearch: (text: string) => void;
  onClear?: () => void;
  value?: string;
  className?: string;
  loading?: boolean;
  disabled?: boolean;
}

const SearchInput: React.FC<SearchInputProps> = ({
  placeholder,
  onSearch,
  onClear,
  value = '',
  className = '',
  loading = false,
  disabled = false,
}) => {
  const handleClear = () => {
    onClear?.();
    onSearch('');
  };

  return (
    <StyledView className={`relative ${className}`}>
      {/* Search Icon */}
      <StyledView className="absolute left-3 top-3 z-10">
        <Icon name="magnify" size={24} color="#6B7280" />
      </StyledView>

      {/* Input */}
      <StyledTextInput
        className={`
          h-12 
          pl-12 
          pr-10 
          bg-gray-800 
          text-white 
          rounded-xl
          ${disabled ? 'opacity-50' : ''}
        `}
        placeholder={placeholder}
        placeholderTextColor="#6B7280"
        onChangeText={onSearch}
        value={value}
        editable={!disabled && !loading}
        selectionColor="#60A5FA"
      />

      {/* Clear or Loading Icon */}
      {(value.length > 0 || loading) && (
        <StyledView className="absolute right-3 top-3 z-10">
          {loading ? (
            <ActivityIndicator size={24} color="#60A5FA" />
          ) : (
            <StyledTouchableOpacity
              onPress={handleClear}
              disabled={disabled}
            >
              <Icon name="close-circle" size={24} color="#6B7280" />
            </StyledTouchableOpacity>
          )}
        </StyledView>
      )}
    </StyledView>
  );
};

export default SearchInput; 