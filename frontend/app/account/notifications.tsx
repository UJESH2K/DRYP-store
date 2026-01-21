import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  StatusBar,
  Switch,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useCustomRouter } from '../../src/hooks/useCustomRouter'

export default function NotificationsScreen() {
  const router = useCustomRouter()

  const [settings, setSettings] = useState({
    orderUpdates: true,
    promotions: false,
    newArrivals: true,
    priceDrops: true,
    wishlistItems: true,
    newsletter: false,
    pushNotifications: true,
    emailNotifications: true,
    smsNotifications: false,
  })

  const toggleSetting = (key: string) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key as keyof typeof prev]
    }))
  }

  const notificationSections = [
    {
      title: 'Order & Shopping',
      items: [
        {
          key: 'orderUpdates',
          title: 'Order Updates',
          description: 'Get notified about your order status',
          icon: '📦',
        },
        {
          key: 'wishlistItems',
          title: 'Wishlist Items',
          description: 'When items in your wishlist go on sale',
          icon: '❤️',
        },
        {
          key: 'priceDrops',
          title: 'Price Drops',
          description: 'Alert when prices drop on items you viewed',
          icon: '💰',
        },
      ]
    },
    {
      title: 'Marketing & Promotions',
      items: [
        {
          key: 'promotions',
          title: 'Promotions & Deals',
          description: 'Special offers and discount codes',
          icon: '🏷️',
        },
        {
          key: 'newArrivals',
          title: 'New Arrivals',
          description: 'Latest products from your favorite brands',
          icon: '✨',
        },
        {
          key: 'newsletter',
          title: 'Newsletter',
          description: 'Weekly style tips and trends',
          icon: '📰',
        },
      ]
    },
    {
      title: 'Delivery Methods',
      items: [
        {
          key: 'pushNotifications',
          title: 'Push Notifications',
          description: 'Receive notifications on your device',
          icon: '📱',
        },
        {
          key: 'emailNotifications',
          title: 'Email Notifications',
          description: 'Receive notifications via email',
          icon: '📧',
        },
        {
          key: 'smsNotifications',
          title: 'SMS Notifications',
          description: 'Receive notifications via text message',
          icon: '💬',
        },
      ]
    }
  ]

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.description}>
          Manage your notification preferences to stay updated on what matters to you.
        </Text>

        {notificationSections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            
            {section.items.map((item) => (
              <View key={item.key} style={styles.notificationItem}>
                <View style={styles.itemLeft}>
                  <Text style={styles.itemIcon}>{item.icon}</Text>
                  <View style={styles.itemContent}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <Text style={styles.itemDescription}>{item.description}</Text>
                  </View>
                </View>
                
                <Switch
                  value={settings[item.key as keyof typeof settings]}
                  onValueChange={() => toggleSetting(item.key)}
                  trackColor={{ false: '#e0e0e0', true: '#000000' }}
                  thumbColor={settings[item.key as keyof typeof settings] ? '#ffffff' : '#f4f3f4'}
                />
              </View>
            ))}
          </View>
        ))}

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>📍 Notification Settings</Text>
          <Text style={styles.infoText}>
            You can also manage notification settings from your device's system settings. 
            Some notifications may still be sent for important account and security updates.
          </Text>
        </View>
        
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 5,
  },
  backText: {
    fontSize: 24,
    color: '#000000',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
  },
  placeholder: {
    width: 34,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  description: {
    fontSize: 16,
    color: '#666666',
    lineHeight: 22,
    marginTop: 20,
    marginBottom: 30,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 18,
  },
  infoSection: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  bottomSpacing: {
    height: 100,
  },
})
