import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet, Modal, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MultiSelectDropdownProps {
  options: string[];
  selectedOptions: string[];
  onSelectionChange: (selected: string[]) => void;
  placeholder: string;
  containerStyle?: ViewStyle;
}

export default function MultiSelectDropdown({
  options,
  selectedOptions,
  onSelectionChange,
  placeholder,
  containerStyle,
}: MultiSelectDropdownProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [tempSelectedOptions, setTempSelectedOptions] = useState(selectedOptions);

  useEffect(() => {
    setTempSelectedOptions(selectedOptions);
  }, [selectedOptions]);

  const toggleOption = (option: string) => {
    const newSelectedOptions = tempSelectedOptions.includes(option)
      ? tempSelectedOptions.filter(item => item !== option)
      : [...tempSelectedOptions, option];
    setTempSelectedOptions(newSelectedOptions);
  };

  const handleApply = () => {
    onSelectionChange(tempSelectedOptions);
    setModalVisible(false);
  };

  const handleCancel = () => {
    setTempSelectedOptions(selectedOptions);
    setModalVisible(false);
  };

  const renderItem = ({ item }: { item: string }) => (
    <Pressable style={styles.option} onPress={() => toggleOption(item)}>
      <Text style={tempSelectedOptions.includes(item) ? styles.selectedOptionText : styles.optionText}>
        {item}
      </Text>
    </Pressable>
  );

  return (
    <View style={[styles.container, containerStyle]}>
      <Pressable style={styles.dropdown} onPress={() => setModalVisible(true)}>
        <Text style={styles.dropdownText}>
          {placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color="white" />
      </Pressable>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={handleCancel}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <FlatList
              data={options}
              renderItem={renderItem}
              keyExtractor={item => item}
            />
            <View style={styles.buttonsContainer}>
              <Pressable style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.applyButton} onPress={handleApply}>
                <Text style={styles.applyButtonText}>Apply</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // marginBottom: 10, // Removed to allow parent to manage spacing
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1, // Reverted border width
    borderColor: '#000',
    borderRadius: 12, 
    paddingVertical: 6, // Reduced padding
    paddingHorizontal: 10, // Reduced padding
    backgroundColor: '#000',
  },
  dropdownText: {
    color: '#fff',
    marginRight: 5,
    fontFamily: 'Zaloga',
    fontSize: 16, // Reverted font size
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxHeight: '80%',
  },
  option: {
    paddingVertical: 10, // Reverted padding
  },
  optionText: {
    fontSize: 16, // Reverted font size
    fontFamily: 'Zaloga',
  },
  selectedOptionText: {
    fontSize: 16, // Reverted font size
    fontFamily: 'Zaloga',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  applyButton: {
    padding: 10,
    backgroundColor: '#000', // Changed to black
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
    marginLeft: 5,
  },
  applyButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'Zaloga',
  },
  cancelButton: {
    padding: 10,
    backgroundColor: '#ccc',
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
    marginRight: 5,
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'Zaloga',
  },
});
