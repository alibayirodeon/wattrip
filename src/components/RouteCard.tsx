import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text, Card, Chip, Divider } from 'react-native-paper';
import { RouteInfo, RouteEVInfo } from '../context/useLocationStore';

interface RouteCardProps {
  route: RouteInfo;
  evInfo: RouteEVInfo;
  index: number;
  isSelected: boolean;
  onSelect: (index: number) => void;
  routeColors: string[];
  loading?: boolean;
}

// Helper functions
const formatDistance = (meters: number): string => {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}s ${minutes}dk`;
  }
  return `${minutes}dk`;
};

const formatConsumption = (kwh: number): string => {
  return `${kwh.toFixed(1)} kWh`;
};

const formatCost = (cost: number): string => {
  return `₺${cost.toFixed(2)}`;
};

const getChargingStopsText = (stops: number): string => {
  if (stops === 0) return 'Şarj gerek yok';
  if (stops === 1) return '1 şarj durağı';
  return `${stops} şarj durağı`;
};

const getBatteryColor = (battery: number): string => {
  if (battery >= 30) return '#4CAF50'; // Green
  if (battery >= 15) return '#FF9800'; // Orange
  return '#F44336'; // Red
};

const RouteCard: React.FC<RouteCardProps> = ({
  route,
  evInfo,
  index,
  isSelected,
  onSelect,
  routeColors,
  loading
}) => {
  const routeColor = routeColors[index % routeColors.length];
  return (
    <TouchableOpacity
      onPress={() => onSelect(index)}
      style={styles.cardContainer}
      activeOpacity={0.7}
    >
      <Card
        style={[
          styles.card,
          isSelected && styles.selectedCard,
        ]}
        elevation={isSelected ? 5 : 3}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Renkli şerit */}
          <View style={{ width: 8, height: '100%', backgroundColor: routeColor, borderTopLeftRadius: 16, borderBottomLeftRadius: 16, marginRight: 8 }} />
          <Card.Content style={[styles.cardContent, { flex: 1 }]}>
          {/* Route Header */}
          <View style={styles.headerRow}>
            <Text style={styles.routeTitle}>
              Rota {index + 1}
            </Text>
            {isSelected && (
              <Chip
                mode="flat"
                style={styles.selectedChip}
                textStyle={styles.selectedChipText}
              >
                Seçili
              </Chip>
            )}
          </View>

          {/* Route Summary */}
          {route.summary && (
            <Text style={styles.routeSummary} numberOfLines={1}>
              {route.summary}
            </Text>
          )}

          {/* Main Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Mesafe</Text>
              <Text style={styles.statValue}>
                {formatDistance(route.distance)}
              </Text>
            </View>
            
            <View style={styles.separator} />
            
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Süre</Text>
              <Text style={styles.statValue}>
                {formatDuration(route.duration)}
              </Text>
            </View>
          </View>

          <Divider style={styles.divider} />

          {/* EV Stats */}
          <View style={styles.evStatsRow}>
            <View style={styles.evStatItem}>
              <Text style={styles.evStatLabel}>Tüketim</Text>
              <Text style={styles.evStatValue}>
                {formatConsumption(evInfo.estimatedConsumption)}
              </Text>
            </View>

            <View style={styles.evStatItem}>
              <Text style={styles.evStatLabel}>Maliyet</Text>
              <Text style={styles.evStatValue}>
                {formatCost(evInfo.estimatedCost)}
              </Text>
            </View>
          </View>

          {/* Charging Info */}
          <View style={styles.chargingRow}>
            <Text style={styles.chargingText}>
              {getChargingStopsText(evInfo.chargingStopsRequired)}
            </Text>
            
            <View style={styles.batteryInfo}>
              <Text style={styles.batteryLabel}>Kalan batarya:</Text>
              <Text
                style={[
                  styles.batteryValue,
                  { color: getBatteryColor(evInfo.remainingBatteryAtDestination) }
                ]}
              >
                %{Math.round(evInfo.remainingBatteryAtDestination)}
              </Text>
            </View>
          </View>
          </Card.Content>
        </View>
        {/* Alt bilgi ve buton */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4 }}>
          {loading ? (
            <Text style={{ fontSize: 14, color: '#888', fontStyle: 'italic' }}>Hesaplanıyor...</Text>
          ) : (
            <View>
              <Text style={{ fontSize: 13, color: '#2C3E50', fontWeight: '600' }}>Süre: <Text style={{ fontWeight: 'normal' }}>{formatDuration(route.duration)}</Text></Text>
              <Text style={{ fontSize: 13, color: '#2C3E50', fontWeight: '600' }}>Enerji: <Text style={{ fontWeight: 'normal' }}>{formatConsumption(evInfo.estimatedConsumption)}</Text></Text>
              <Text style={{ fontSize: 13, color: '#2C3E50', fontWeight: '600' }}>Şarj: <Text style={{ fontWeight: 'normal' }}>{evInfo.chargingStopsRequired}</Text></Text>
            </View>
          )}
          <TouchableOpacity
            onPress={() => onSelect(index)}
            disabled={isSelected || loading}
            style={{
              backgroundColor: isSelected ? '#4CAF50' : routeColor,
              paddingVertical: 8,
              paddingHorizontal: 18,
              borderRadius: 20,
              opacity: isSelected || loading ? 0.7 : 1
            }}
          >
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 15 }}>
              {isSelected ? 'Seçili' : 'Bu rotayı seç'}
            </Text>
          </TouchableOpacity>
        </View>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    marginRight: 16,
    width: 280, // Fixed width for horizontal scroll
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedCard: {
    borderColor: '#FF4500',
    backgroundColor: '#FFF8F5',
  },
  cardContent: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  routeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  selectedChip: {
    backgroundColor: '#FF4500',
    height: 28,
  },
  selectedChipText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  routeSummary: {
    fontSize: 14,
    color: '#7F8C8D',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  separator: {
    width: 1,
    height: 30,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 16,
  },
  statLabel: {
    fontSize: 12,
    color: '#7F8C8D',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  divider: {
    marginVertical: 12,
    backgroundColor: '#E0E0E0',
  },
  evStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  evStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  evStatLabel: {
    fontSize: 12,
    color: '#7F8C8D',
    marginBottom: 2,
  },
  evStatValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#27AE60',
  },
  chargingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  chargingText: {
    fontSize: 13,
    color: '#3498DB',
    fontWeight: '600',
  },
  batteryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  batteryLabel: {
    fontSize: 12,
    color: '#7F8C8D',
    marginRight: 4,
  },
  batteryValue: {
    fontSize: 13,
    fontWeight: 'bold',
  },
});

export default RouteCard; 