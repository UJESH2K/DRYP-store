import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  StatusBar,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function AboutScreen() {
  const socialLinks = [
    { name: 'Instagram', icon: 'logo-instagram', url: 'https://instagram.com/dryp' },
    { name: 'Twitter', icon: 'logo-twitter', url: 'https://twitter.com/dryp' },
    { name: 'Facebook', icon: 'logo-facebook', url: 'https://facebook.com/dryp' },
    { name: 'TikTok', icon: 'logo-tiktok', url: 'https://tiktok.com/@dryp' },
  ];

  const legalLinks = [
    { title: 'Privacy Policy', action: () => Alert.alert('Privacy Policy', 'Opening privacy policy...') },
    { title: 'Terms of Service', action: () => Alert.alert('Terms of Service', 'Opening terms of service...') },
    { title: 'Cookie Policy', action: () => Alert.alert('Cookie Policy', 'Opening cookie policy...') },
  ];

  const openSocialLink = (url: string) => {
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open link'));
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.appInfo}>
          <Text style={styles.appName}>DRYP</Text>
          <Text style={styles.appTagline}>Discover Your Style</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Our Mission</Text>
          <Text style={styles.aboutText}>
            DRYP is your personal style companion, designed to help you discover and curate fashion that matches your unique taste. Our AI-powered recommendations learn from your preferences to bring you the perfect pieces from top brands worldwide.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Follow Us</Text>
          <View style={styles.socialGrid}>
            {socialLinks.map((social) => (
              <Pressable
                key={social.name}
                style={styles.socialButton}
                onPress={() => openSocialLink(social.url)}
              >
                <Ionicons name={social.icon as any} size={28} color="#000" />
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>
          <View style={styles.legalContainer}>
            {legalLinks.map((link, index) => (
              <Pressable
                key={index}
                style={styles.legalButton}
                onPress={link.action}
              >
                <Text style={styles.legalText}>{link.title}</Text>
                <Ionicons name="chevron-forward" size={20} color="#cccccc" />
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.copyright}>
          <Text style={styles.copyrightText}>
            © 2024 DRYP. All rights reserved.
          </Text>
          <Text style={styles.copyrightText}>
            Version 1.0.0
          </Text>
        </View>
        
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    marginBottom: 24,
  },
  appName: {
    fontSize: 48,
    fontFamily: 'Zaloga',
    color: '#000',
    marginBottom: 4,
  },
  appTagline: {
    fontSize: 16,
    fontFamily: 'Zaloga',
    color: '#6c757d',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: 'Zaloga',
    color: '#343a40',
    marginBottom: 16,
  },
  aboutText: {
    fontSize: 16,
    fontFamily: 'Zaloga',
    color: '#6c757d',
    lineHeight: 24,
  },
  socialGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
  },
  socialButton: {
    padding: 12,
  },
  legalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    overflow: 'hidden',
  },
  legalButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  legalText: {
    fontSize: 17,
    fontFamily: 'Zaloga',
    color: '#000',
  },
  copyright: {
    alignItems: 'center',
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    marginTop: 20,
  },
  copyrightText: {
    fontSize: 14,
    fontFamily: 'Zaloga',
    color: '#adb5bd',
    textAlign: 'center',
    marginBottom: 4,
  },
  bottomSpacing: {
    height: 40,
  },
});