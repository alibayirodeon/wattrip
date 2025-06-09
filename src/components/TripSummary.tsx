import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ChargingPlanResult } from '../utils/chargingPlanCalculator';
import { calculateTripStats, formatDuration, getSOCColor } from '../lib/energyUtils';

interface TripSummaryProps {
  chargingPlan: ChargingPlanResult;
  routeDistanceKm: number;
  drivingTimeMinutes: number;
}

export function TripSummary({ 
  chargingPlan, 
  routeDistanceKm, 
  drivingTimeMinutes 
}: TripSummaryProps) {
  const tripStats = calculateTripStats(
    routeDistanceKm,
    drivingTimeMinutes,
    chargingPlan.chargingStops
  );

  const finalBatteryColor = getSOCColor(chargingPlan.batteryAtDestinationPercent);
  const hasWarnings = chargingPlan.warnings.length > 0;

  return (
    <View style={styles.container}>
      {/* 🚗 Trip Overview Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🚗 Yolculuk Özeti</Text>
        {chargingPlan.canReachDestination ? (
          <View style={[styles.statusBadge, styles.successBadge]}>
            <Text style={styles.statusText}>✅ Uygun</Text>
          </View>
        ) : (
          <View style={[styles.statusBadge, styles.errorBadge]}>
            <Text style={styles.statusText}>❌ Riskli</Text>
          </View>
        )}
      </View>

      {/* 📊 Time Statistics */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>🚗</Text>
          <Text style={styles.statLabel}>Sürüş</Text>
          <Text style={styles.statValue}>
            {formatDuration(tripStats.drivingTime.total)}
          </Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statIcon}>⚡</Text>
          <Text style={styles.statLabel}>Şarj</Text>
          <Text style={styles.statValue}>
            {formatDuration(tripStats.chargingTime.total)}
          </Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statIcon}>⏱️</Text>
          <Text style={styles.statLabel}>Toplam</Text>
          <Text style={styles.statValue}>
            {formatDuration(tripStats.totalTime.total)}
          </Text>
        </View>
      </View>

      {/* 🔋 Battery & Distance Info */}
      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>📍 Mesafe:</Text>
          <Text style={styles.infoValue}>
            {routeDistanceKm.toFixed(0)} km
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>🔋 Varışta Batarya:</Text>
          <View style={styles.batteryInfo}>
            <View style={[styles.batteryIndicator, { backgroundColor: finalBatteryColor }]} />
            <Text style={[styles.infoValue, { color: finalBatteryColor }]}>
              {chargingPlan.batteryAtDestinationPercent.toFixed(0)}%
            </Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>🔌 Şarj Durakları:</Text>
          <Text style={styles.infoValue}>
            {chargingPlan.chargingStops.length} durak
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>⚡ Toplam Enerji:</Text>
          <Text style={styles.infoValue}>
            {chargingPlan.totalEnergyConsumedKWh.toFixed(1)} kWh
          </Text>
        </View>
      </View>

      {/* ⚠️ Warnings Section */}
      {hasWarnings && (
        <View style={styles.warningsSection}>
          <Text style={styles.warningsTitle}>⚠️ Uyarılar</Text>
          {chargingPlan.warnings.map((warning, index) => (
            <View key={index} style={styles.warningItem}>
              <Text style={styles.warningText}>{warning}</Text>
            </View>
          ))}
        </View>
      )}

      {/* 💡 Tips Section */}
      <View style={styles.tipsSection}>
        <Text style={styles.tipsTitle}>💡 İpuçları</Text>
        <Text style={styles.tipText}>
          • Şarj durağı öncesi %20'nin altına düşmemeye çalışın
        </Text>
        <Text style={styles.tipText}>
          • Hızlı şarj için %80'e kadar şarj edin
        </Text>
        <Text style={styles.tipText}>
          • Soğuk havada menzil %10-15 azalabilir
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  successBadge: {
    backgroundColor: '#dcfce7',
  },
  errorBadge: {
    backgroundColor: '#fee2e2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f2937',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  infoSection: {
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  batteryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  batteryIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  warningsSection: {
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  warningsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#92400e',
    marginBottom: 8,
  },
  warningItem: {
    marginBottom: 4,
  },
  warningText: {
    fontSize: 13,
    color: '#92400e',
  },
  tipsSection: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 12,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 12,
    color: '#1e40af',
    marginBottom: 2,
  },
});

export default TripSummary; 