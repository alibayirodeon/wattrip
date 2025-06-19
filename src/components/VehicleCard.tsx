import React, { useState } from 'react';
import { View, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Text, Card, Chip, Divider, Button } from 'react-native-paper';
import { Vehicle, formatSocketType, formatConsumption, formatBatteryCapacity } from '../context/useVehicleStore';

interface VehicleCardProps {
  vehicle: Vehicle;
  isSelected: boolean;
  onSelect: (vehicleId: string) => void;
  onEdit?: (vehicle: Vehicle) => void;
  onDelete?: (vehicleId: string) => void;
}

const VehicleCard: React.FC<VehicleCardProps> = ({
  vehicle,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleCardPress = () => {
    onSelect(vehicle.id);
  };

  const toggleDetails = () => {
    setShowDetails(!showDetails);
  };

  const getBrandColor = (brand: string): string => {
    switch (brand.toLowerCase()) {
      case 'tesla':
        return '#E31937';
      case 'peugeot':
        return '#0066CC';
      case 'hyundai':
        return '#002C5F';
      case 'bmw':
        return '#0066B1';
      case 'volkswagen':
        return '#001C46';
      default:
        return '#2C3E50';
    }
  };

  const getSocketTypeColor = (socketType: Vehicle['socketType']): string => {
    switch (socketType) {
      case 'Type2':
        return '#3498DB';
      case 'CCS':
        return '#27AE60';
      case 'CHAdeMO':
        return '#E74C3C';
      default:
        return '#95A5A6';
    }
  };

  return (
    <TouchableOpacity
      onPress={handleCardPress}
      style={[styles.cardContainer, isSelected && styles.selectedContainer]}
      activeOpacity={0.7}
    >
      <Card
        style={[
          styles.card,
          isSelected && styles.selectedCard,
        ]}
        elevation={isSelected ? 5 : 3}
      >
        {/* Vehicle Image */}
        <View style={styles.imageContainer}>
          {vehicle.imageUrl && !imageError ? (
            <Image
              source={{ uri: vehicle.imageUrl }}
              style={styles.vehicleImage}
              onError={() => setImageError(true)}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.placeholderImage, { backgroundColor: getBrandColor(vehicle.brand) + '20' }]}>
              <Text style={[styles.placeholderText, { color: getBrandColor(vehicle.brand) }]}>
                🚗
              </Text>
              <Text style={[styles.placeholderBrand, { color: getBrandColor(vehicle.brand) }]}>
                {vehicle.brand.toUpperCase()}
              </Text>
            </View>
          )}
          
          {/* Selected Badge */}
          {isSelected && (
            <View style={styles.selectedBadge}>
              <Text style={styles.selectedBadgeText}>✓</Text>
            </View>
          )}
        </View>

        <Card.Content style={styles.cardContent}>
          {/* Vehicle Header */}
          <View style={styles.headerRow}>
            <View style={styles.vehicleInfo}>
              <Text style={[styles.vehicleTitle, { color: getBrandColor(vehicle.brand) }]}>
                {vehicle.brand} {vehicle.model}
              </Text>
              <Text style={styles.plateText}>{vehicle.plate}</Text>
            </View>
            
            {isSelected && (
              <Chip
                mode="flat"
                style={styles.activeChip}
                textStyle={styles.activeChipText}
                compact
              >
                Aktif
              </Chip>
            )}
          </View>

          {/* Main Specs */}
          <View style={styles.specsRow}>
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>Batarya</Text>
              <Text style={styles.specValue}>
                {formatBatteryCapacity(vehicle.batteryCapacity)}
              </Text>
            </View>
            
            <View style={styles.separator} />
            
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>Tüketim</Text>
              <Text style={styles.specValue}>
                {formatConsumption(vehicle.consumption)}
              </Text>
            </View>
          </View>

          {/* Socket Type */}
          <View style={styles.socketContainer}>
            <Chip
              mode="flat"
              style={[styles.socketChip, { backgroundColor: getSocketTypeColor(vehicle.socketType) + '20' }]}
              textStyle={[styles.socketText, { color: getSocketTypeColor(vehicle.socketType) }]}
              compact
            >
              🔌 {formatSocketType(vehicle.socketType)}
            </Chip>
          </View>

          {/* Details Toggle */}
          <TouchableOpacity
            onPress={toggleDetails}
            style={styles.detailsButton}
          >
            <Text style={styles.detailsButtonText}>
              {showDetails ? 'Ayrıntıları Gizle' : 'Ayrıntıları Gör'}
            </Text>
            <Text style={styles.detailsButtonIcon}>
              {showDetails ? '▼' : '▶'}
            </Text>
          </TouchableOpacity>

          {/* Expanded Details */}
          {showDetails && (
            <View style={styles.detailsContainer}>
              <Divider style={styles.detailsDivider} />
              
              <View style={styles.detailsGrid}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Marka:</Text>
                  <Text style={styles.detailValue}>{vehicle.brand}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Model:</Text>
                  <Text style={styles.detailValue}>{vehicle.model}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Plaka:</Text>
                  <Text style={styles.detailValue}>{vehicle.plate}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Batarya Kapasitesi:</Text>
                  <Text style={styles.detailValue}>{formatBatteryCapacity(vehicle.batteryCapacity)}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Tüketim:</Text>
                  <Text style={styles.detailValue}>{formatConsumption(vehicle.consumption)}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Soket Tipi:</Text>
                  <Text style={styles.detailValue}>{formatSocketType(vehicle.socketType)}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Eklenme Tarihi:</Text>
                  <Text style={styles.detailValue}>
                    {new Date(vehicle.createdAt).toLocaleDateString('tr-TR')}
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              {(onEdit || onDelete) && (
                <View style={styles.actionButtons}>
                  {onEdit && (
                    <Button
                      mode="outlined"
                      onPress={() => onEdit(vehicle)}
                      style={styles.editButton}
                      contentStyle={styles.buttonContent}
                    >
                      Düzenle
                    </Button>
                  )}
                  
                  {onDelete && (
                    <Button
                      mode="outlined"
                      onPress={() => onDelete(vehicle.id)}
                      style={styles.deleteButton}
                      contentStyle={styles.buttonContent}
                      textColor="#E74C3C"
                    >
                      Sil
                    </Button>
                  )}
                </View>
              )}
            </View>
          )}
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    marginRight: 16,
    width: 300,
  },
  selectedContainer: {
    transform: [{ scale: 1.02 }],
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  selectedCard: {
    borderColor: '#3498DB',
    backgroundColor: '#F8FBFF',
  },
  imageContainer: {
    position: 'relative',
    height: 120,
  },
  vehicleImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 32,
    marginBottom: 4,
  },
  placeholderBrand: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  selectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#3498DB',
    borderRadius: 16,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  selectedBadgeText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cardContent: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  plateText: {
    fontSize: 14,
    color: '#7F8C8D',
    fontWeight: '500',
  },
  activeChip: {
    backgroundColor: '#E8F8F5',
    height: 28,
  },
  activeChipText: {
    color: '#27AE60',
    fontSize: 12,
    fontWeight: 'bold',
  },
  specsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: 12,
  },
  specItem: {
    alignItems: 'center',
    flex: 1,
  },
  separator: {
    width: 1,
    height: 30,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 16,
  },
  specLabel: {
    fontSize: 12,
    color: '#7F8C8D',
    marginBottom: 2,
  },
  specValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  socketContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  socketChip: {
    alignSelf: 'center',
  },
  socketText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  detailsButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
  },
  detailsButtonText: {
    fontSize: 14,
    color: '#3498DB',
    fontWeight: '500',
    marginRight: 8,
  },
  detailsButtonIcon: {
    fontSize: 12,
    color: '#3498DB',
  },
  detailsContainer: {
    marginTop: 12,
  },
  detailsDivider: {
    marginBottom: 12,
    backgroundColor: '#E0E0E0',
  },
  detailsGrid: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 13,
    color: '#7F8C8D',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 13,
    color: '#2C3E50',
    fontWeight: 'bold',
    textAlign: 'right',
    flex: 1,
    marginLeft: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    flex: 1,
    borderColor: '#3498DB',
  },
  deleteButton: {
    flex: 1,
    borderColor: '#E74C3C',
  },
  buttonContent: {
    paddingVertical: 4,
  },
});

export default VehicleCard; 