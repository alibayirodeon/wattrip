import React, { useEffect, useState } from 'react';
import { View, ScrollView, FlatList, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Text, Card, Button, Divider, Avatar, Chip, FAB, Modal } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVehicleStore, Vehicle, getVehicleDisplayName, formatSocketType } from '../context/useVehicleStore';
import VehicleCard from '../components/VehicleCard';
import AddVehicleModal from '../components/AddVehicleModal';
import BottomTabBar from '../components/BottomTabBar';

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
  const [showVehicleSelector, setShowVehicleSelector] = useState(false);

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
        {/* Header Section - ChargIQ Style */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.appTitle}>WatTrip</Text>
            <TouchableOpacity style={styles.settingsButton}>
              <Text style={styles.settingsIcon}>⚙️</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.profileInfo}>
            <Avatar.Text
              size={80}
              label="AB"
              style={styles.avatar}
              labelStyle={styles.avatarText}
            />
            <Text style={styles.userName}>Ali Bayır</Text>
          </View>
        </View>

        {/* Vehicle Info Section - ChargIQ Style */}
        <View style={styles.vehicleSection}>
          <View style={styles.vehicleSectionHeader}>
            <Text style={styles.vehicleSectionTitle}>Araç Bilgisi</Text>
            <TouchableOpacity>
              <Text style={styles.moreButton}>•••</Text>
            </TouchableOpacity>
          </View>

          {selectedVehicle ? (
            <Card style={styles.vehicleCard}>
              <Card.Content style={styles.vehicleCardContent}>
                <View style={styles.vehicleCardMain}>
                  <View style={styles.vehicleInfo}>
                    <Text style={styles.vehicleBrand}>{selectedVehicle.brand}</Text>
                    <Text style={styles.vehicleModel}>
                      {selectedVehicle.model} {selectedVehicle.batteryCapacity} kWh
                    </Text>
                    <Text style={styles.vehiclePlate}>{selectedVehicle.plate}</Text>
                    <Text style={styles.vehicleSocket}>{formatSocketType(selectedVehicle.socketType)}</Text>
                  </View>
                  <View style={styles.vehicleImageContainer}>
                    <View style={styles.vehicleImagePlaceholder}>
                      <Text style={styles.vehicleEmoji}>🚗</Text>
                    </View>
                  </View>
                </View>
                
                <TouchableOpacity 
                  style={styles.detailsButton}
                  onPress={() => setShowVehicleSelector(true)}
                >
                  <Text style={styles.detailsButtonText}>Ayrıntıları Gör</Text>
                  <Text style={styles.detailsButtonIcon}>⌄</Text>
                </TouchableOpacity>
              </Card.Content>
            </Card>
          ) : (
            <Card style={styles.emptyVehicleCard}>
              <Card.Content style={styles.emptyVehicleContent}>
                <Text style={styles.emptyVehicleText}>Henüz araç eklemediniz</Text>
                <Button
                  mode="outlined"
                  onPress={() => setShowAddModal(true)}
                  style={styles.addVehicleButton}
                >
                  + Araç Ekle
                </Button>
              </Card.Content>
            </Card>
          )}
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuIcon}>💰</Text>
            <Text style={styles.menuText}>Tarifeler</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuIcon}>📊</Text>
            <Text style={styles.menuText}>Etkileşimler</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom Padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Alt Menü */}
      <BottomTabBar currentRoute="Profile" />



      {/* Vehicle Selector Modal */}
      <Modal
        visible={showVehicleSelector}
        onDismiss={() => setShowVehicleSelector(false)}
        contentContainerStyle={styles.modalContainer}
      >
        <Card style={styles.selectorModal}>
          <Card.Title
            title="Araç Seç"
            titleStyle={styles.modalTitle}
          />
          <Divider />
          <Card.Content style={styles.selectorContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {vehicles.map((vehicle) => (
                <TouchableOpacity
                  key={vehicle.id}
                  style={[
                    styles.vehicleSelectorItem,
                    vehicle.id === selectedVehicleId && styles.selectedVehicleItem
                  ]}
                  onPress={() => {
                    handleVehicleSelect(vehicle.id);
                    setShowVehicleSelector(false);
                  }}
                >
                  <View style={styles.vehicleSelectorInfo}>
                    <Text style={styles.vehicleSelectorBrand}>{vehicle.brand} {vehicle.model}</Text>
                    <Text style={styles.vehicleSelectorDetails}>
                      {vehicle.plate} • {vehicle.batteryCapacity} kWh • {formatSocketType(vehicle.socketType)}
                    </Text>
                  </View>
                  {vehicle.id === selectedVehicleId && (
                    <Text style={styles.selectedIcon}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
              
              <TouchableOpacity
                style={styles.addNewVehicleButton}
                onPress={() => {
                  setShowVehicleSelector(false);
                  setShowAddModal(true);
                }}
              >
                <Text style={styles.addNewVehicleIcon}>+</Text>
                <Text style={styles.addNewVehicleText}>Yeni Araç Ekle</Text>
              </TouchableOpacity>
            </ScrollView>
          </Card.Content>
        </Card>
      </Modal>

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
    backgroundColor: '#1E88E5',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 30,
    marginBottom: 0,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  settingsButton: {
    padding: 8,
  },
  settingsIcon: {
    fontSize: 20,
    color: 'white',
  },
  profileInfo: {
    alignItems: 'center',
  },
  avatar: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginBottom: 12,
  },
  avatarText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 28,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  vehicleSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  vehicleSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  vehicleSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  moreButton: {
    fontSize: 20,
    color: '#666',
    fontWeight: 'bold',
  },
  vehicleCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  vehicleCardContent: {
    padding: 16,
  },
  vehicleCardMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleBrand: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  vehicleModel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 2,
  },
  vehiclePlate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  vehicleSocket: {
    fontSize: 12,
    color: '#1E88E5',
  },
  vehicleImageContainer: {
    width: 80,
    height: 50,
  },
  vehicleImagePlaceholder: {
    width: 80,
    height: 50,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleEmoji: {
    fontSize: 20,
  },
  detailsButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailsButtonText: {
    fontSize: 14,
    color: '#1E88E5',
    marginRight: 4,
  },
  detailsButtonIcon: {
    fontSize: 12,
    color: '#1E88E5',
  },
  emptyVehicleCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    elevation: 1,
  },
  emptyVehicleContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyVehicleText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
  },
  addVehicleButton: {
    borderColor: '#1E88E5',
  },
  menuSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  menuIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  menuArrow: {
    fontSize: 20,
    color: '#ccc',
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
  // Modal Styles
  modalContainer: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  selectorModal: {
    backgroundColor: 'white',
    borderRadius: 12,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  selectorContent: {
    paddingVertical: 0,
  },
  vehicleSelectorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedVehicleItem: {
    backgroundColor: '#E3F2FD',
  },
  vehicleSelectorInfo: {
    flex: 1,
  },
  vehicleSelectorBrand: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  vehicleSelectorDetails: {
    fontSize: 12,
    color: '#666',
  },
  selectedIcon: {
    fontSize: 18,
    color: '#1E88E5',
    fontWeight: 'bold',
  },
  addNewVehicleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    marginTop: 8,
  },
  addNewVehicleIcon: {
    fontSize: 20,
    color: '#1E88E5',
    marginRight: 8,
  },
  addNewVehicleText: {
    fontSize: 16,
    color: '#1E88E5',
    fontWeight: '500',
  },
});

export default ProfileScreen; 