import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ChargingPlanResult } from '../utils/chargingPlanCalculator';

interface TripSummaryProps {
  chargingPlan: ChargingPlanResult;
  routeDistanceKm: number;
  drivingTimeMinutes: number;
}

const TripSummary: React.FC<TripSummaryProps> = ({ chargingPlan, routeDistanceKm, drivingTimeMinutes }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🚗 Yolculuk Özeti</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Toplam Mesafe:</Text>
        <Text style={styles.value}>{routeDistanceKm.toFixed(1)} km</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Sürüş Süresi:</Text>
        <Text style={styles.value}>{Math.floor(drivingTimeMinutes / 60)}s {drivingTimeMinutes % 60}dk</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Toplam Enerji:</Text>
        <Text style={styles.value}>{typeof chargingPlan.totalEnergyConsumed === 'number' ? chargingPlan.totalEnergyConsumed.toFixed(2) : '-'} kWh</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Şarj Süresi:</Text>
        <Text style={styles.value}>{typeof chargingPlan.totalChargingTime === 'number' ? chargingPlan.totalChargingTime.toFixed(0) : '-'} dk</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Şarj Durakları:</Text>
        <Text style={styles.value}>{chargingPlan.chargingStops.length} adet</Text>
      </View>
      {chargingPlan.message && (
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>⚠️ Uyarı:</Text>
          <Text style={styles.warningText}>{chargingPlan.message}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 10,
    elevation: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#1976D2',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontSize: 15,
    color: '#333',
  },
  value: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#222',
  },
  warningBox: {
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  warningTitle: {
    fontWeight: 'bold',
    color: '#B8860B',
    marginBottom: 4,
  },
  warningText: {
    color: '#B8860B',
    fontSize: 13,
  },
});

export default TripSummary; 