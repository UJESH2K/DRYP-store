import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

interface Props { children: React.ReactNode }
interface State { hasError: boolean; error?: Error }

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(error: Error): State { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error('ErrorBoundary caught:', error, info); }
  handleRetry = () => this.setState({ hasError: false, error: undefined });
  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{this.state.error?.message}</Text>
          <Pressable style={styles.button} onPress={this.handleRetry}><Text style={styles.buttonText}>Try Again</Text></Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 24 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 8, fontFamily: 'Zaloga' },
  message: { fontSize: 14, color: '#666', marginBottom: 24, textAlign: 'center' },
  button: { backgroundColor: '#000', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontFamily: 'Zaloga' },
});
