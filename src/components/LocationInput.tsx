import React from 'react';
import { View } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { styled } from 'nativewind/dist/styled';

const StyledView = styled(View);

interface LocationInputProps {
  placeholder: string;
  onLocationSelect: (details: any) => void;
  icon?: string;
}

const LocationInput: React.FC<LocationInputProps> = ({
  placeholder,
  onLocationSelect,
  icon
}) => {
  return (
    <StyledView className="mx-4 mb-2">
      <GooglePlacesAutocomplete
        placeholder={placeholder}
        onPress={(data, details = null) => {
          onLocationSelect(details);
        }}
        query={{
          key: 'YOUR_GOOGLE_PLACES_API_KEY',
          language: 'tr',
          components: 'country:tr',
        }}
        styles={{
          container: {
            flex: 0,
          },
          textInput: {
            height: 50,
            backgroundColor: '#1F2937',
            color: '#fff',
            fontSize: 16,
            paddingHorizontal: 16,
            borderRadius: 12,
          },
          predefinedPlacesDescription: {
            color: '#1faadb',
          },
          description: {
            color: '#fff',
          },
          row: {
            backgroundColor: '#1F2937',
          },
          separator: {
            backgroundColor: '#374151',
            height: 1,
          },
          poweredContainer: {
            display: 'none',
          },
        }}
      />
    </StyledView>
  );
};

export default LocationInput; 