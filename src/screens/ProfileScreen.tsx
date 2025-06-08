import React, { useEffect, useState } from 'react';
import { View, ScrollView, FlatList, StyleSheet, Alert } from 'react-native';
import { Text, Card, Button, Divider, Avatar, Chip, FAB } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVehicleStore, Vehicle, getVehicleDisplayName } from '../context/useVehicleStore';
import VehicleCard from '../components/VehicleCard';
import AddVehicleModal from '../components/AddVehicleModal';

const ProfileScreen: React.FC = () => {
  const {
    vehicles,
    selectedVehicleId,
    setSelectedVehicle,
    addVehicle,
    updateVehicle,
    removeVehicle,
    getSelectedVehicle,
    initializeMockData,
  } = useVehicleStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  const selectedVehicle = getSelectedVehicle();

  // Initialize mock data on first load
  useEffect(() => {
    initializeMockData();
  }, [initializeMockData]);

  const handleVehicleSelect = (vehicleId: string) => {
    setSelectedVehicle(vehicleId);
  };

  const handleAddVehicle = (vehicleData: Omit<Vehicle, 'id' | 'createdAt'>) => {
    addVehicle(vehicleData);
    setShowAddModal(false);
  };

  const handleEditVehicle = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setShowAddModal(true);
  };

  const handleUpdateVehicle = (vehicleData: Omit<Vehicle, 'id' | 'createdAt'>) => {
    if (editingVehicle) {
      updateVehicle(editingVehicle.id, vehicleData);
      setEditingVehicle(null);
      setShowAddModal(false);
    }
  };

  const handleDeleteVehicle = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (!vehicle) return;

    Alert.alert(
      'Araç Sil',
      `${getVehicleDisplayName(vehicle)} aracını silmek istediğinizden emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => removeVehicle(vehicleId),
        },
      ]
    );
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingVehicle(null);
  };

  const renderVehicleCard = ({ item }: { item: Vehicle }) => (
    <VehicleCard
      vehicle={item}
      isSelected={item.id === selectedVehicleId}
      onSelect={handleVehicleSelect}
      onEdit={handleEditVehicle}
      onDelete={handleDeleteVehicle}
    />
  );

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Günaydın';
    if (hour < 18) return 'İyi günler';
    return 'İyi akşamlar';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.profileInfo}>
            <Avatar.Text
              size={56}
              label="WU"
              style={styles.avatar}
              labelStyle={styles.avatarText}
            />
            <View style={styles.greeting}>
              <Text style={styles.greetingText}>{getGreeting()}</Text>
              <Text style={styles.userName}>WatTrip Kullanıcısı</Text>
            </View>
          </View>
          
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{vehicles.length}</Text>
              <Text style={styles.statLabel}>Kayıtlı Araç</Text>
            </View>
            <View style={styles.statSeparator} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>⚡</Text>
              <Text style={styles.statLabel}>Elektrikli</Text>
            </View>
          </View>
        </View>

        {/* Selected Vehicle Section */}
        {selectedVehicle && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Aktif Araç</Text>
            <Card style={styles.selectedVehicleCard}>
              <Card.Content style={styles.selectedVehicleContent}>
                <View style={styles.selectedVehicleHeader}>
                  <View>
                    <Text style={styles.selectedVehicleBrand}>
                      {selectedVehicle.brand}
                    </Text>
                    <Text style={styles.selectedVehicleModel}>
                      {selectedVehicle.model}
                    </Text>
                    <Text style={styles.selectedVehiclePlate}>
                      {selectedVehicle.plate}
                    </Text>
                  </View>
                  <Chip
                    mode="flat"
                    style={styles.activeChip}
                    textStyle={styles.activeChipText}
                  >
                    Aktif Araç
                  </Chip>
                </View>

                <Divider style={styles.selectedVehicleDivider} />

                <View style={styles.selectedVehicleSpecs}>
                  <View style={styles.specRow}>
                    <View style={styles.specItem}>
                      <Text style={styles.specLabel}>Batarya</Text>
                      <Text style={styles.specValue}>
                        {selectedVehicle.batteryCapacity} kWh
                      </Text>
                    </View>
                    <View style={styles.specItem}>
                      <Text style={styles.specLabel}>Tüketim</Text>
                      <Text style={styles.specValue}>
                        {selectedVehicle.consumption} kWh/100km
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.socketInfo}>
                    <Text style={styles.specLabel}>Soket Tipi</Text>
                    <Chip
                      mode="outlined"
                      style={styles.socketChip}
                      textStyle={styles.socketChipText}
                      compact
                    >
                      🔌 {selectedVehicle.socketType}
                    </Chip>
                  </View>
                </View>
              </Card.Content>
            </Card>
          </View>
        )}

        {/* Vehicles Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Araçlarım</Text>
            <Button
              mode="outlined"
              onPress={() => setShowAddModal(true)}
              style={styles.addButton}
              contentStyle={styles.addButtonContent}
              compact
            >
              + Araç Ekle
            </Button>
          </View>

          {vehicles.length > 0 ? (
            <FlatList
              data={vehicles}
              renderItem={renderVehicleCard}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.vehiclesList}
            />
          ) : (
            <Card style={styles.emptyStateCard}>
              <Card.Content style={styles.emptyStateContent}>
                <Text style={styles.emptyStateIcon}>🚗</Text>
                <Text style={styles.emptyStateTitle}>Henüz araç eklemediniz</Text>
                <Text style={styles.emptyStateDescription}>
                  İlk aracınızı ekleyerek WatTrip deneyiminizi başlatın
                </Text>
                <Button
                  mode="contained"
                  onPress={() => setShowAddModal(true)}
                  style={styles.emptyStateButton}
                  contentStyle={styles.emptyStateButtonContent}
                >
                  İlk Aracımı Ekle
                </Button>
              </Card.Content>
            </Card>
          )}
        </View>

        {/* Bottom Padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Floating Action Button */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => setShowAddModal(true)}
        label="Araç Ekle"
      />

      {/* Add/Edit Vehicle Modal */}
      <AddVehicleModal
        visible={showAddModal}
        onDismiss={handleCloseModal}
        onSubmit={editingVehicle ? handleUpdateVehicle : handleAddVehicle}
        editingVehicle={editingVehicle}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 24,
    marginBottom: 16,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    backgroundColor: '#3498DB',
    marginRight: 16,
  },
  avatarText: {
    color: 'white',
    fontWeight: 'bold',
  },
  greeting: {
    flex: 1,
  },
  greetingText: {
    fontSize: 16,
    color: '#7F8C8D',
    marginBottom: 2,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingVertical: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statSeparator: {
    width: 1,
    height: 30,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 20,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#7F8C8D',
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  addButton: {
    borderColor: '#3498DB',
  },
  addButtonContent: {
    paddingHorizontal: 8,
  },
  selectedVehicleCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#3498DB',
  },
  selectedVehicleContent: {
    padding: 20,
  },
  selectedVehicleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  selectedVehicleBrand: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3498DB',
    marginBottom: 2,
  },
  selectedVehicleModel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 4,
  },
  selectedVehiclePlate: {
    fontSize: 14,
    color: '#7F8C8D',
    fontWeight: '500',
  },
  activeChip: {
    backgroundColor: '#E8F8F5',
  },
  activeChipText: {
    color: '#27AE60',
    fontWeight: 'bold',
    fontSize: 12,
  },
  selectedVehicleDivider: {
    marginVertical: 16,
    backgroundColor: '#E0E0E0',
  },
  selectedVehicleSpecs: {
    gap: 12,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  specItem: {
    alignItems: 'center',
    flex: 1,
  },
  specLabel: {
    fontSize: 12,
    color: '#7F8C8D',
    marginBottom: 4,
  },
  specValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  socketInfo: {
    alignItems: 'center',
  },
  socketChip: {
    marginTop: 4,
    borderColor: '#3498DB',
  },
  socketChipText: {
    color: '#3498DB',
    fontWeight: 'bold',
    fontSize: 12,
  },
  vehiclesList: {
    paddingLeft: 0,
  },
  emptyStateCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    elevation: 1,
  },
  emptyStateContent: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateDescription: {
    fontSize: 14,
    color: '#7F8C8D',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyStateButton: {
    backgroundColor: '#3498DB',
  },
  emptyStateButtonContent: {
    paddingHorizontal: 16,
  },
  bottomPadding: {
    height: 100,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#3498DB',
  },
});

export default ProfileScreen; 