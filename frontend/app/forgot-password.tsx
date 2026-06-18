import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { forgotPassword } from "../src/lib/api";

// `/forgot-password` — asks for the user's email and asks the backend to
// send a reset link. The backend always returns 200 even if the email is
// not registered, so we never tell the user whether the email exists.
// On success we show a generic confirmation and tell them to check both
// their inbox AND their spam folder, then send them back to /login.

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    if (!email || !email.includes("@")) {
      return; // email validation is the only client-side gate; we keep it
              // minimal because the backend is the source of truth.
    }
    setSubmitting(true);
    await forgotPassword(email.trim().toLowerCase());
    // We deliberately ignore the response. The backend always replies 200
    // regardless of whether the email exists, so even an "error" here is
    // almost certainly a network problem. Show the success screen either
    // way; if SMTP is misconfigured the user will simply not receive an
    // email and can retry.
    setSubmitting(false);
    setDone(true);
  }

  if (done) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successBox}>
          <Text style={styles.title}>Check your inbox</Text>
          <Text style={styles.subtitle}>
            If an account exists for {email}, we just sent a password-reset
            link. It expires in 10 minutes. Be sure to check your spam
            folder.
          </Text>
          <Text style={styles.hint}>
            On mobile? Tap "Open in DRYP App" inside the email to reset your
            password without leaving the app.
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.replace("/login")}
          >
            <Text style={styles.primaryButtonText}>Back to Login</Text>
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
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={12}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.title}>Forgot Password</Text>
          <Text style={styles.subtitle}>
            Enter your email and we'll send you a reset link.
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            placeholderTextColor="#999"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />

          <Pressable
            style={[styles.primaryButton, submitting && styles.disabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Send Reset Link</Text>
            )}
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
  backButton: {
    paddingVertical: 8,
    marginTop: 8,
  },
  backButtonText: {
    fontSize: 14,
    color: "#666666",
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
  disabled: {
    opacity: 0.5,
  },
  successBox: {
    flex: 1,
    justifyContent: "center",
    padding: 8,
  },
  hint: {
    fontSize: 13,
    color: "#999999",
    marginTop: 16,
    marginBottom: 24,
    lineHeight: 20,
  },
});