import React from 'react';
import { View, StyleSheet } from 'react-native';

interface StepIndicatorProps {
  totalSteps: number;
  currentStep: number;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ totalSteps, currentStep }) => {
  return (
    <View style={styles.container}>
      {Array.from({ length: totalSteps }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            index === currentStep ? styles.activeDot : styles.inactiveDot,
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: '#000',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  inactiveDot: {
    backgroundColor: '#ccc',
  },
});

export default StepIndicator;
