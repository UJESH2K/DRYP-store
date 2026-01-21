import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCustomRouter } from '../../src/hooks/useCustomRouter';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/state/auth';
import { useToastStore } from '../../src/state/toast';

const Section = ({ header, children, footer }) => (
  <View style={styles.sectionContainer}>
    {header && <Text style={styles.sectionHeader}>{header.toUpperCase()}</Text>}
    <View style={styles.sectionBody}>
      {children}
    </View>
    {footer && <Text style={styles.sectionFooter}>{footer}</Text>}
  </View>
);

const Row = ({ title, icon, onPress, isFirst, isLast, isDestructive = false }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.row, isLast && { borderBottomWidth: 0 }, pressed && styles.rowPressed]}>
    <View style={styles.rowLeft}>
      {icon && <View style={styles.rowIcon}>{icon}</View>}
      <Text style={[styles.rowLabel, isDestructive && styles.destructiveText]}>{title}</Text>
    </View>
    {!isDestructive && <Ionicons name="chevron-forward" size={20} color="#c7c7cc" />}
  </Pressable>
);


export default function ProfileScreen() {
  const router = useCustomRouter();
  const { user, isAuthenticated, isGuest, guestId, logout } = useAuthStore();
  const showToast = useToastStore((state) => state.showToast);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
          showToast('You have been logged out successfully.', 'success');
        },
      },
    ]);
  };
  
  const accountItems = [
    { id: 'orders', title: 'My Orders', icon: <Ionicons name="cube-outline" size={22} color="#333" />, onPress: () => router.push('/account/orders') },
    { id: 'addresses', title: 'Shipping Addresses', icon: <Ionicons name="location-outline" size={22} color="#333" />, onPress: () => router.push('/account/addresses') },
    { id: 'payment', title: 'Payment Methods', icon: <Ionicons name="card-outline" size={22} color="#333" />, onPress: () => router.push('/account/payment') },
  ];
  
  const preferencesItems = [
    { id: 'settings', title: 'General Settings', icon: <Ionicons name="settings-outline" size={22} color="#333" />, onPress: () => router.push('/account/settings') },
    { id: 'style', title: 'Style Preferences', icon: <Ionicons name="shirt-outline" size={22} color="#333" />, onPress: () => router.push('/account/style') },
  ];

  const supportItems = [
    { id: 'help', title: 'Help & Support', icon: <Ionicons name="help-buoy-outline" size={22} color="#333" />, onPress: () => router.push('/account/help') },
    { id: 'about', title: 'About Us', icon: <Ionicons name="information-circle-outline" size={22} color="#333" />, onPress: () => router.push('/account/about') },
  ];

  if (isGuest || !isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
            <Text style={styles.headerTitle}>Account</Text>
        </View>
        <ScrollView style={styles.scrollView}>
            <View style={styles.profileHeader}>
                <View style={[styles.avatar, styles.guestAvatar]}>
                    <Ionicons name="person-outline" size={40} color="#8e8e93" />
                </View>
                <Text style={styles.profileName}>Guest User</Text>
            </View>
            <View style={styles.guestCtaContainer}>
                <Text style={styles.guestCtaText}>Create an account to save your preferences and unlock all features.</Text>
                <Pressable style={styles.signInButton} onPress={() => router.replace('/login')}>
                    <Text style={styles.signInButtonText}>Sign In or Create Account</Text>
                </Pressable>
            </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
            <Text style={styles.headerTitle}>Account</Text>
        </View>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.profileHeader} onPress={() => router.push('/account/profile-details')}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.profileName}>{user?.name}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
          </View>
        </Pressable>

        <Section header="My Account">
          {accountItems.map((item, index) => <Row key={item.id} {...item} isFirst={index === 0} isLast={index === accountItems.length - 1} />)}
        </Section>
        
        <Section header="Preferences">
          {preferencesItems.map((item, index) => <Row key={item.id} {...item} isFirst={index === 0} isLast={index === preferencesItems.length - 1} />)}
        </Section>
        
        <Section header="Support">
          {supportItems.map((item, index) => <Row key={item.id} {...item} isFirst={index === 0} isLast={index === supportItems.length - 1} />)}
        </Section>
        
        <Section>
            <Row title="Logout" onPress={handleLogout} isFirst isLast isDestructive />
        </Section>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f2f7',
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontFamily: 'Zaloga',
    fontSize: 28,
    color: '#000',
  },
  scrollView: {
    flex: 1,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#e5e5ea',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontFamily: 'Zaloga',
    fontSize: 32,
    color: '#3c3c43',
  },
  profileName: {
    fontFamily: 'Zaloga',
    fontSize: 22,
    fontWeight: '600',
    color: '#000',
  },
  profileEmail: {
    fontFamily: 'Zaloga',
    fontSize: 16,
    color: '#8e8e93',
    marginTop: 2,
  },
  sectionContainer: {
    marginTop: 20,
    marginHorizontal: 16,
  },
  sectionHeader: {
    fontFamily: 'Zaloga',
    fontSize: 14,
    color: '#6c757d',
    paddingLeft: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  sectionBody: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  sectionFooter: {
    fontFamily: 'Zaloga',
    fontSize: 13,
    color: '#6c757d',
    paddingHorizontal: 16,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 50,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#c6c6c8',
    backgroundColor: '#fff',
  },
  rowPressed: {
    backgroundColor: '#f2f2f7',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  rowLabel: {
    fontFamily: 'Zaloga',
    fontSize: 17,
    color: '#000000',
  },
  destructiveText: {
    color: '#ff3b30',
    textAlign: 'center',
    flex: 1,
  },
  // Guest view styles
  guestAvatar: {
    backgroundColor: '#e5e5ea',
  },
  guestCtaContainer: {
    margin: 16,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
  },
  guestCtaText: {
    fontFamily: 'Zaloga',
    fontSize: 16,
    textAlign: 'center',
    color: '#3c3c43',
    marginBottom: 16,
  },
  signInButton: {
    backgroundColor: '#000',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 12,
  },
  signInButtonText: {
    color: '#fff',
    fontFamily: 'Zaloga',
    fontSize: 16,
  },
});
