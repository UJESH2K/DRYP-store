import React, { useState, useRef } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet, Modal, ViewStyle, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<View>(null);
  const [menuLayout, setMenuLayout] = useState({ top: 0, left: 0, width: 0 });

  const measureAndOpen = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setMenuLayout({ top: y + height + 4, left: x, width });
      setOpen(true);
    });
  };

  const toggleOption = (option: string) => {
    const newSelected = selectedOptions.includes(option)
      ? selectedOptions.filter(o => o !== option)
      : [...selectedOptions, option];
    onSelectionChange(newSelected);
  };

  const selectedCount = selectedOptions.length;

  return (
    <View style={[styles.container, containerStyle]}>
      <Pressable ref={triggerRef} style={styles.dropdown} onPress={measureAndOpen}>
        <Text style={styles.dropdownText} numberOfLines={1}>
          {selectedCount > 0 ? `${placeholder} (${selectedCount})` : placeholder}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color="white" />
      </Pressable>

      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View
            style={[
              styles.menu,
              {
                position: 'absolute',
                top: menuLayout.top,
                left: Math.max(8, Math.min(menuLayout.left, SCREEN_WIDTH - 240)),
                minWidth: 200,
                maxWidth: Math.min(280, SCREEN_WIDTH - 16),
              },
            ]}
          >
            <FlatList
              data={options}
              renderItem={({ item }) => {
                const isSelected = selectedOptions.includes(item);
                return (
                  <Pressable
                    style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                    onPress={() => toggleOption(item)}
                  >
                    <Text style={isSelected ? styles.selectedOptionText : styles.optionText}>
                      {item}
                    </Text>
                    {isSelected && <Ionicons name="checkmark" size={18} color="#000" />}
                  </Pressable>
                );
              }}
              keyExtractor={(item) => item}
              extraData={selectedOptions}
              keyboardShouldPersistTaps="handled"
              style={styles.menuList}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#000',
    minWidth: 90,
  },
  dropdownText: {
    color: '#fff',
    marginRight: 5,
    fontFamily: 'Zaloga',
    fontSize: 16,
    flexShrink: 1,
  },
  backdrop: {
    flex: 1,
  },
  menu: {
    backgroundColor: 'white',
    borderRadius: 10,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    maxHeight: 240,
  },
  menuList: {
    maxHeight: 232,
  },
  option: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionPressed: {
    backgroundColor: '#f5f5f5',
  },
  optionText: {
    fontSize: 15,
    fontFamily: 'Zaloga',
    color: '#666',
  },
  selectedOptionText: {
    fontSize: 15,
    fontFamily: 'Zaloga',
    color: '#000',
  },
});
