import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Top-level React error boundary. Without this, a single render throw
 * blanks the whole app — the user sees a white screen and the only
 * recourse is to kill and relaunch. With this, we catch the throw,
 * show a fallback with a "Try Again" button, and let the user back to
 * the home screen.
 *
 * This catches errors in render, in componentDidMount, and in
 * getDerivedStateFromError. It does NOT catch:
 *   - Event handler errors (those propagate normally; use try/catch)
 *   - Async errors outside React (unhandled promise rejections)
 *   - Server-side rendering errors (we don't SSR)
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (__DEV__) {
      console.error('[ErrorBoundary] caught:', error, info.componentStack);
    }
    // In a real app, report to Sentry here. Skipped in this codebase
    // because Sentry isn't wired into the frontend yet.
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.root}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>
            The app hit an unexpected error. Your data is safe — try again,
            or restart the app if the problem persists.
          </Text>
          {__DEV__ && this.state.error ? (
            <ScrollView style={styles.debugBox}>
              <Text style={styles.debugText}>
                {this.state.error.name}: {this.state.error.message}
              </Text>
            </ScrollView>
          ) : null}
          <Pressable style={styles.button} onPress={this.reset}>
            <Text style={styles.buttonText}>Try Again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FCFCFA',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  debugBox: {
    maxHeight: 160,
    width: '100%',
    backgroundColor: '#f1f1ef',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  debugText: {
    fontFamily: 'Courier',
    fontSize: 12,
    color: '#a23',
  },
  button: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
});
