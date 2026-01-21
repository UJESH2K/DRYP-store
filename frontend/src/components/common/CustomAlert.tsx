import React from 'react';
import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';

interface AlertButton {
  text: string;
  onPress: () => void;
  style?: 'cancel' | 'destructive' | 'default';
}

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  buttons: AlertButton[];
}

const CustomAlert: React.FC<CustomAlertProps> = ({ visible, title, message, buttons }) => {
  if (!visible) {
    return null;
  }

  return (
    <Modal
      transparent={true}
      animationType="fade"
      visible={visible}
      onRequestClose={() => {
        // This is required for Android back button
        // Find a cancel button or the last button to close
        const cancelButton = buttons.find(b => b.style === 'cancel');
        if (cancelButton) {
          cancelButton.onPress();
        } else {
          buttons[buttons.length - 1]?.onPress();
        }
      }}
    >
      <View style={styles.centeredView}>
        <View style={styles.alertView}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.buttonsContainer}>
            {buttons.map((button, index) => (
              <Pressable
                key={index}
                style={[
                  styles.button,
                  index > 0 && styles.buttonSeparator,
                  button.style === 'destructive' && styles.destructiveButton,
                ]}
                onPress={button.onPress}
              >
                <Text style={[
                  styles.buttonText,
                  button.style === 'destructive' && styles.destructiveButtonText,
                  button.style === 'cancel' && styles.cancelButtonText,
                ]}>
                  {button.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  alertView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '80%',
  },
  title: {
    fontSize: 20,
    fontFamily: 'Zaloga',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    fontFamily: 'Zaloga',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  buttonsContainer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    width: '100%',
  },
  button: {
    flex: 1,
    padding: 15,
    alignItems: 'center',
  },
  buttonSeparator: {
    borderLeftWidth: 1,
    borderLeftColor: '#eee',
  },
  buttonText: {
    fontSize: 16,
    fontFamily: 'Zaloga',
    color: '#007AFF', // iOS default blue
  },
  cancelButtonText: {
    fontFamily: 'Zaloga',
    fontWeight: 'bold',
  },
  destructiveButton: {
    // No special style for the button itself, just the text
  },
  destructiveButtonText: {
    color: 'red',
  },
});

export default CustomAlert;
