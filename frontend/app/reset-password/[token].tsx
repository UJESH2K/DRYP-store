import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { resetPassword } from "../../src/lib/api";

// `/reset-password/[token]` is reached two ways:
//   - Cold: user taps dryp://reset-password/<token> in their email,
//     Linking handler in app/_layout.tsx routes here.
//   - In-app: we push this screen programmatically if needed.
//
// The screen validates that a token is present, lets the user type + confirm
// a new password, and calls PUT /api/auth/reset-password/:token. The token
// expires after 10 minutes (backend enforces this).

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!token) {
      setError(
        "This reset link is missing its security token. Please request a new one.",
      );
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setIsSubmitting(true);
    const result = await resetPassword(String(token), password);
    setIsSubmitting(false);
    if (result?.message && !result?.success) {
      // The backend returns { message: 'Invalid or expired reset token' } on 4xx
      setError(String(result.message));
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successBox}>
          <Text style={styles.title}>Password updated</Text>
          <Text style={styles.subtitle}>
            Your password has been reset. You can now log in with your new
            credentials.
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.replace("/login")}
          >
            <Text style={styles.primaryButtonText}>Go to Login</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            Enter a new password for your DRYP account.
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>New Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            placeholderTextColor="#999"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />

          <Text style={styles.label}>Confirm Password</Text>
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Type it again"
            placeholderTextColor="#999"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.primaryButton, isSubmitting && styles.disabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Update Password</Text>
            )}
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.replace("/login")}
          >
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    padding: 24,
  },
  header: {
    marginTop: 32,
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#666666",
    lineHeight: 22,
  },
  form: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333333",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#000000",
    backgroundColor: "#fafafa",
  },
  error: {
    color: "#c62828",
    marginTop: 16,
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: "#000000",
    paddingVertical: 16,
    borderRadius: 4,
    alignItems: "center",
    marginTop: 24,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 3,
  },
  secondaryButton: {
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  secondaryButtonText: {
    color: "#666666",
    fontSize: 14,
  },
  disabled: {
    opacity: 0.5,
  },
  successBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
});