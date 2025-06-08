import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { 
  Text, 
  Modal, 
  Portal, 
  Card, 
  TextInput, 
  Button, 
  SegmentedButtons, 
  HelperText,
  Divider,
  Chip
} from 'react-native-paper';
import { Vehicle } from '../context/useVehicleStore';

interface AddVehicleModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (vehicle: Omit<Vehicle, 'id' | 'createdAt'>) => void;
  editingVehicle?: Vehicle | null;
}

interface FormData {
  brand: string;
  model: string;
  plate: string;
  batteryCapacity: string;
  consumption: string;
  socketType: Vehicle['socketType'];
  imageUrl: string;
}

interface FormErrors {
  brand?: string;
  model?: string;
  plate?: string;
  batteryCapacity?: string;
  consumption?: string;
}

const POPULAR_BRANDS = [
  'Tesla', 'Peugeot', 'Hyundai', 'BMW', 'Volkswagen', 
  'Mercedes', 'Audi', 'Renault', 'Nissan', 'Kia'
];

const SOCKET_OPTIONS = [
  { value: 'Type2', label: 'Type 2' },
  { value: 'CCS', label: 'CCS' },
  { value: 'CHAdeMO', label: 'CHAdeMO' },
] as const;

const AddVehicleModal: React.FC<AddVehicleModalProps> = ({
  visible,
  onDismiss,
  onSubmit,
  editingVehicle,
}) => {
  const [formData, setFormData] = useState<FormData>({
    brand: editingVehicle?.brand || '',
    model: editingVehicle?.model || '',
    plate: editingVehicle?.plate || '',
    batteryCapacity: editingVehicle?.batteryCapacity?.toString() || '',
    consumption: editingVehicle?.consumption?.toString() || '',
    socketType: editingVehicle?.socketType || 'CCS',
    imageUrl: editingVehicle?.imageUrl || '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!editingVehicle;

  // Form validation
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Brand validation
    if (!formData.brand.trim()) {
      newErrors.brand = 'Marka gereklidir';
    } else if (formData.brand.trim().length < 2) {
      newErrors.brand = 'Marka en az 2 karakter olmalıdır';
    }

    // Model validation
    if (!formData.model.trim()) {
      newErrors.model = 'Model gereklidir';
    } else if (formData.model.trim().length < 2) {
      newErrors.model = 'Model en az 2 karakter olmalıdır';
    }

    // Plate validation (Turkish format)
    const plateRegex = /^[0-9]{2}\s[A-Z]{1,3}\s[0-9]{1,4}$/;
    if (!formData.plate.trim()) {
      newErrors.plate = 'Plaka gereklidir';
    } else if (!plateRegex.test(formData.plate.trim())) {
      newErrors.plate = 'Geçerli plaka formatı: 34 ABC 123';
    }

    // Battery capacity validation
    const batteryCapacity = parseFloat(formData.batteryCapacity);
    if (!formData.batteryCapacity.trim()) {
      newErrors.batteryCapacity = 'Batarya kapasitesi gereklidir';
    } else if (isNaN(batteryCapacity) || batteryCapacity <= 0) {
      newErrors.batteryCapacity = 'Geçerli bir kapasitet giriniz';
    } else if (batteryCapacity < 10 || batteryCapacity > 200) {
      newErrors.batteryCapacity = 'Kapasitet 10-200 kWh arasında olmalıdır';
    }

    // Consumption validation
    const consumption = parseFloat(formData.consumption);
    if (!formData.consumption.trim()) {
      newErrors.consumption = 'Tüketim değeri gereklidir';
    } else if (isNaN(consumption) || consumption <= 0) {
      newErrors.consumption = 'Geçerli bir tüketim değeri giriniz';
    } else if (consumption < 10 || consumption > 40) {
      newErrors.consumption = 'Tüketim 10-40 kWh/100km arasında olmalıdır';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const vehicleData: Omit<Vehicle, 'id' | 'createdAt'> = {
        brand: formData.brand.trim(),
        model: formData.model.trim(),
        plate: formData.plate.trim().toUpperCase(),
        batteryCapacity: parseFloat(formData.batteryCapacity),
        consumption: parseFloat(formData.consumption),
        socketType: formData.socketType,
        imageUrl: formData.imageUrl.trim() || undefined,
      };

      onSubmit(vehicleData);
      handleClose();
      
      Alert.alert(
        'Başarılı',
        isEditing ? 'Araç bilgileri güncellendi!' : 'Yeni araç eklendi!',
        [{ text: 'Tamam' }]
      );
    } catch (error) {
      Alert.alert(
        'Hata',
        'Araç kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.',
        [{ text: 'Tamam' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      brand: '',
      model: '',
      plate: '',
      batteryCapacity: '',
      consumption: '',
      socketType: 'CCS',
      imageUrl: '',
    });
    setErrors({});
    setIsSubmitting(false);
    onDismiss();
  };

  const handleBrandChipPress = (brand: string) => {
    setFormData(prev => ({ ...prev, brand }));
    if (errors.brand) {
      setErrors(prev => ({ ...prev, brand: undefined }));
    }
  };

  const updateField = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={handleClose}
        contentContainerStyle={styles.modalContainer}
      >
        <Card style={styles.modalCard}>
          <Card.Title
            title={isEditing ? 'Araç Düzenle' : 'Yeni Araç Ekle'}
            titleStyle={styles.modalTitle}
          />
          
          <Divider style={styles.titleDivider} />

          <Card.Content style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Brand Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Marka</Text>
                
                {/* Popular brands */}
                <View style={styles.chipContainer}>
                  {POPULAR_BRANDS.map((brand) => (
                    <Chip
                      key={brand}
                      mode={formData.brand === brand ? 'flat' : 'outlined'}
                      selected={formData.brand === brand}
                      onPress={() => handleBrandChipPress(brand)}
                      style={[
                        styles.brandChip,
                        formData.brand === brand && styles.selectedBrandChip
                      ]}
                      textStyle={[
                        styles.brandChipText,
                        formData.brand === brand && styles.selectedBrandChipText
                      ]}
                    >
                      {brand}
                    </Chip>
                  ))}
                </View>

                <TextInput
                  mode="outlined"
                  label="Marka"
                  value={formData.brand}
                  onChangeText={(text) => updateField('brand', text)}
                  error={!!errors.brand}
                  style={styles.textInput}
                  autoCapitalize="words"
                />
                <HelperText type="error" visible={!!errors.brand}>
                  {errors.brand}
                </HelperText>
              </View>

              {/* Model */}
              <View style={styles.section}>
                <TextInput
                  mode="outlined"
                  label="Model"
                  value={formData.model}
                  onChangeText={(text) => updateField('model', text)}
                  error={!!errors.model}
                  style={styles.textInput}
                  autoCapitalize="words"
                />
                <HelperText type="error" visible={!!errors.model}>
                  {errors.model}
                </HelperText>
              </View>

              {/* Plate */}
              <View style={styles.section}>
                <TextInput
                  mode="outlined"
                  label="Plaka"
                  placeholder="34 ABC 123"
                  value={formData.plate}
                  onChangeText={(text) => updateField('plate', text)}
                  error={!!errors.plate}
                  style={styles.textInput}
                  autoCapitalize="characters"
                  maxLength={11}
                />
                <HelperText type="error" visible={!!errors.plate}>
                  {errors.plate}
                </HelperText>
              </View>

              {/* Battery Capacity */}
              <View style={styles.section}>
                <TextInput
                  mode="outlined"
                  label="Batarya Kapasitesi (kWh)"
                  value={formData.batteryCapacity}
                  onChangeText={(text) => updateField('batteryCapacity', text)}
                  error={!!errors.batteryCapacity}
                  style={styles.textInput}
                  keyboardType="decimal-pad"
                  right={<TextInput.Affix text="kWh" />}
                />
                <HelperText type="error" visible={!!errors.batteryCapacity}>
                  {errors.batteryCapacity}
                </HelperText>
              </View>

              {/* Consumption */}
              <View style={styles.section}>
                <TextInput
                  mode="outlined"
                  label="Tüketim (kWh/100km)"
                  value={formData.consumption}
                  onChangeText={(text) => updateField('consumption', text)}
                  error={!!errors.consumption}
                  style={styles.textInput}
                  keyboardType="decimal-pad"
                  right={<TextInput.Affix text="kWh/100km" />}
                />
                <HelperText type="error" visible={!!errors.consumption}>
                  {errors.consumption}
                </HelperText>
              </View>

              {/* Socket Type */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Soket Tipi</Text>
                <SegmentedButtons
                  value={formData.socketType}
                  onValueChange={(value) => updateField('socketType', value as Vehicle['socketType'])}
                  buttons={SOCKET_OPTIONS.map(option => ({
                    value: option.value,
                    label: option.label,
                    style: styles.segmentButton
                  }))}
                  style={styles.segmentedButtons}
                />
              </View>

              {/* Image URL (Optional) */}
              <View style={styles.section}>
                <TextInput
                  mode="outlined"
                  label="Resim URL'si (İsteğe bağlı)"
                  value={formData.imageUrl}
                  onChangeText={(text) => updateField('imageUrl', text)}
                  style={styles.textInput}
                  autoCapitalize="none"
                  keyboardType="url"
                />
                <HelperText type="info">
                  Araç görseli için internet linkini girebilirsiniz
                </HelperText>
              </View>
            </ScrollView>
          </Card.Content>

          <Card.Actions style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={handleClose}
              style={styles.cancelButton}
              disabled={isSubmitting}
            >
              İptal
            </Button>
            
            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={isSubmitting}
              disabled={isSubmitting}
              style={styles.submitButton}
            >
              {isEditing ? 'Güncelle' : 'Ekle'}
            </Button>
          </Card.Actions>
        </Card>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  titleDivider: {
    backgroundColor: '#E0E0E0',
  },
  modalContent: {
    paddingHorizontal: 0,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 8,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  brandChip: {
    backgroundColor: '#F8F9FA',
    borderColor: '#E0E0E0',
  },
  selectedBrandChip: {
    backgroundColor: '#3498DB',
  },
  brandChipText: {
    color: '#7F8C8D',
    fontSize: 12,
  },
  selectedBrandChipText: {
    color: 'white',
    fontWeight: 'bold',
  },
  textInput: {
    backgroundColor: 'white',
  },
  segmentedButtons: {
    marginTop: 8,
  },
  segmentButton: {
    borderColor: '#3498DB',
  },
  modalActions: {
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  cancelButton: {
    borderColor: '#95A5A6',
  },
  submitButton: {
    backgroundColor: '#3498DB',
  },
});

export default AddVehicleModal; 