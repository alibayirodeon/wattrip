import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ChargingStop } from '../utils/chargingPlanCalculator';
import { getSOCColor, formatDuration } from '../lib/energyUtils';

interface ChargingStopCardProps {
  stop: ChargingStop;
  stopNumber: number;
  isLast?: boolean;
}

export function ChargingStopCard({ stop, stopNumber, isLast = false }: ChargingStopCardProps) {
  const startSOCColor = getSOCColor(stop.batteryBeforeStopPercent);
  const endSOCColor = getSOCColor(stop.batteryAfterStopPercent);

  return (
    <View style={styles.container}>
      {/* 📍 Stop Header */}
      <View style={styles.header}>
        <View style={styles.stopNumber}>
          <Text style={styles.stopNumberText}>{stopNumber}</Text>
        </View>
        <View style={styles.stationInfo}>
          <Text style={styles.stationName} numberOfLines={1}>
            {stop.name}
          </Text>
          <Text style={styles.distance}>
            📍 {stop.distanceFromStartKm.toFixed(0)} km
          </Text>
          {stop.segmentInfo && (
            <Text style={styles.segmentInfo}>
              📊 Segment {stop.segmentInfo.segmentIndex}
            </Text>
          )}
        </View>
      </View>

      {/* 🔋 Battery Info */}
      <View style={styles.batterySection}>
        <View style={styles.batteryRow}>
          <View style={styles.socContainer}>
            <View style={[styles.socIndicator, { backgroundColor: startSOCColor }]} />
            <Text style={styles.socText}>
              {stop.batteryBeforeStopPercent.toFixed(0)}%
            </Text>
          </View>
          
          <View style={styles.arrow}>
            <Text style={styles.arrowText}>→</Text>
          </View>
          
          <View style={styles.socContainer}>
            <View style={[styles.socIndicator, { backgroundColor: endSOCColor }]} />
            <Text style={styles.socText}>
              {stop.batteryAfterStopPercent.toFixed(0)}%
            </Text>
          </View>
        </View>

        <Text style={styles.energyAdded}>
          ⚡ +{stop.energyChargedKWh.toFixed(1)} kWh
        </Text>
      </View>

      {/* ⏱️ Charging Details */}
      <View style={styles.chargingDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>⏱️ Şarj Süresi:</Text>
          <Text style={styles.detailValue}>
            {formatDuration(stop.estimatedChargeTimeMinutes)}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>🔌 Güç:</Text>
          <Text style={styles.detailValue}>
            {stop.stationPowerKW} kW ({stop.connectorType})
          </Text>
        </View>

        {/* Gelişmiş şarj bilgileri */}
        {stop.averageChargingPowerKW && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>⚡ Ortalama Güç:</Text>
            <Text style={styles.detailValue}>
              {stop.averageChargingPowerKW.toFixed(1)} kW
            </Text>
          </View>
        )}

        {stop.chargingEfficiency && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>📈 Verimlilik:</Text>
            <Text style={[
              styles.detailValue,
              { color: stop.chargingEfficiency > 80 ? '#059669' : 
                       stop.chargingEfficiency > 60 ? '#d97706' : '#dc2626' }
            ]}>
              {stop.chargingEfficiency.toFixed(0)}%
            </Text>
          </View>
        )}

        {/* Segment sonrası bilgi */}
        {stop.segmentInfo?.distanceToNext && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>🛣️ Sonraki Mesafe:</Text>
            <Text style={styles.detailValue}>
              {stop.segmentInfo.distanceToNext.toFixed(0)} km
            </Text>
          </View>
        )}
      </View>

      {/* Connection Line to Next Stop */}
      {!isLast && (
        <View style={styles.connectionLine}>
          <View style={styles.dottedLine} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stopNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stopNumberText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  stationInfo: {
    flex: 1,
  },
  stationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  distance: {
    fontSize: 14,
    color: '#6b7280',
  },
  segmentInfo: {
    fontSize: 12,
    color: '#8b5cf6',
    fontWeight: '500',
  },
  batterySection: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  batteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  socContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  socIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  socText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  arrow: {
    marginHorizontal: 16,
  },
  arrowText: {
    fontSize: 20,
    color: '#6b7280',
    fontWeight: 'bold',
  },
  energyAdded: {
    textAlign: 'center',
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
  },
  chargingDetails: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  connectionLine: {
    position: 'absolute',
    bottom: -8,
    left: '50%',
    transform: [{ translateX: -1 }],
    height: 16,
    width: 2,
    backgroundColor: '#e5e7eb',
  },
  dottedLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#e5e7eb',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
});

export default ChargingStopCard; 