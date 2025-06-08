import React from 'react';
import { View, StyleSheet, Modal } from 'react-native';
import { ActivityIndicator, Text, Card } from 'react-native-paper';
import { ENV } from '../config/env';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  transparent?: boolean;
  dismissible?: boolean;
  onDismiss?: () => void;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible,
  message = 'Yükleniyor...',
  transparent = false,
  dismissible = false,
  onDismiss,
}) => {
  if (!visible) return null;

  const handleBackdropPress = () => {
    if (dismissible && onDismiss) {
      onDismiss();
    }
  };

  const overlayStyle = [
    styles.overlay,
    transparent && styles.transparentOverlay,
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleBackdropPress}
    >
      <View style={overlayStyle}>
        <View 
          style={styles.backdrop} 
          onTouchEnd={handleBackdropPress}
        />
        <Card style={styles.loadingCard}>
          <Card.Content style={styles.cardContent}>
            <ActivityIndicator 
              size="large" 
              color="#1976D2" 
              style={styles.spinner}
            />
            <Text variant="bodyLarge" style={styles.message}>
              {message}
            </Text>
          </Card.Content>
        </Card>
      </View>
    </Modal>
  );
};

// Hook for managing loading states
export const useLoading = (initialState = false) => {
  const [loading, setLoading] = React.useState(initialState);
  const [message, setMessage] = React.useState('Yükleniyor...');

  const showLoading = (msg = 'Yükleniyor...') => {
    setMessage(msg);
    setLoading(true);
  };

  const hideLoading = () => {
    setLoading(false);
  };

  const withLoading = async <T,>(
    promise: Promise<T>,
    loadingMessage = 'İşlem yapılıyor...'
  ): Promise<T> => {
    showLoading(loadingMessage);
    try {
      const result = await promise;
      return result;
    } finally {
      hideLoading();
    }
  };

  return {
    loading,
    message,
    showLoading,
    hideLoading,
    withLoading,
  };
};

// Different loading states
export const LoadingStates = {
  ROUTE_CALCULATING: 'Rota hesaplanıyor...',
  LOCATION_FETCHING: 'Konum alınıyor...',
  ADDRESS_SEARCHING: 'Adres aranıyor...',
  MAP_LOADING: 'Harita yükleniyor...',
  SAVING: 'Kaydediliyor...',
  UPDATING: 'Güncelleniyor...',
  DELETING: 'Siliniyor...',
} as const;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  transparentOverlay: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  loadingCard: {
    borderRadius: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    minWidth: 200,
  },
  cardContent: {
    padding: 24,
    alignItems: 'center',
  },
  spinner: {
    marginBottom: 16,
  },
  message: {
    color: '#1A2B49',
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default LoadingOverlay; 