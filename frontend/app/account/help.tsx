import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  StatusBar,
  Alert,
  Linking,
  LayoutAnimation, // For animations
  Platform,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function HelpScreen() {
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);

  const faqItems = [
    {
      id: 1,
      question: 'How do I track my order?',
      answer: 'You can track your order by going to "My Orders" in your account section. Click on any order to see detailed tracking information and delivery updates.',
    },
    {
      id: 2,
      question: 'What is your return policy?',
      answer: 'We offer a 30-day return policy for all items. Items must be in original condition with tags attached. Free returns are available for orders over $50.',
    },
    {
      id: 3,
      question: 'How do I change my shipping address?',
      answer: 'You can update your shipping address in the "Addresses" section of your account. Make sure to update it before placing your order.',
    },
    {
      id: 4,
      question: 'Do you offer international shipping?',
      answer: 'Yes, we ship to over 50 countries worldwide. Shipping costs and delivery times vary by location. Check our shipping page for more details.',
    },
    {
      id: 5,
      question: 'How do I use a discount code?',
      answer: 'Enter your discount code at checkout in the "Promo Code" field. The discount will be applied automatically to eligible items.',
    },
  ];

  const contactOptions = [
    {
      id: 'chat',
      title: 'Live Chat',
      description: 'Chat with our support team',
      icon: 'chatbubble-ellipses-outline',
      action: () => Alert.alert('Live Chat', 'Live chat feature coming soon!'),
    },
    {
      id: 'email',
      title: 'Email Support',
      description: 'support@dryp.com',
      icon: 'mail-outline',
      action: () => Linking.openURL('mailto:support@dryp.com'),
    },
    {
      id: 'phone',
      title: 'Phone Support',
      description: '+1 (555) 123-DRYP',
      icon: 'call-outline',
      action: () => Linking.openURL('tel:+15551234379'),
    },
    {
      id: 'help-center',
      title: 'Help Center',
      description: 'Browse our knowledge base',
      icon: 'book-outline',
      action: () => Alert.alert('Help Center', 'Opening help center...'),
    },
  ];

  const quickActions = [
    {
      id: 'report',
      title: 'Report an Issue',
      icon: 'alert-circle-outline',
      action: () => Alert.alert('Report Issue', 'Report an issue with your order'),
    },
    {
      id: 'size-guide',
      title: 'Size Guide',
      icon: 'cut-outline',
      action: () => Alert.alert('Size Guide', 'Opening size guide...'),
    },
    {
      id: 'shipping-info',
      title: 'Shipping Information',
      icon: 'cube-outline',
      action: () => Alert.alert('Shipping Info', 'Opening shipping information...'),
    },
  ];

  const toggleFAQ = (id: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); // Animate expansion
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.description}>
          We're here to help! Find answers to common questions or get in touch with our support team.
        </Text>

        {/* Contact Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Us</Text>
          <View style={styles.contactGrid}>
            {contactOptions.map((option) => (
              <Pressable
                key={option.id}
                style={styles.contactCard}
                onPress={option.action}
              >
                <Ionicons name={option.icon as any} size={28} color="#000" style={styles.contactIcon} />
                <Text style={styles.contactTitle}>{option.title}</Text>
                <Text style={styles.contactDescription}>{option.description}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* FAQ Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          
          {faqItems.map((item) => (
            <View key={item.id} style={styles.faqItem}>
              <Pressable
                style={styles.faqQuestion}
                onPress={() => toggleFAQ(item.id)}
              >
                <Text style={styles.faqQuestionText}>{item.question}</Text>
                <Ionicons name={expandedFAQ === item.id ? "chevron-up" : "chevron-down"} size={20} color="#6c757d" />
              </Pressable>
              
              {expandedFAQ === item.id && (
                <View style={styles.faqAnswer}>
                  <Text style={styles.faqAnswerText}>{item.answer}</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          {quickActions.map((action) => (
            <Pressable 
              key={action.id}
              style={styles.actionButton}
              onPress={action.action}
            >
              <Ionicons name={action.icon as any} size={22} color="#000" style={styles.actionIcon} />
              <Text style={styles.actionText}>{action.title}</Text>
              <Ionicons name="chevron-forward" size={20} color="#cccccc" />
            </Pressable>
          ))}
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
  description: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 16,
    marginBottom: 24,
    fontFamily: 'Zaloga',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Zaloga',
    color: '#343a40',
    marginBottom: 16,
  },
  contactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  contactCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  contactIcon: {
    marginBottom: 10,
  },
  contactTitle: {
    fontSize: 16,
    fontFamily: 'Zaloga',
    color: '#000',
    marginBottom: 4,
  },
  contactDescription: {
    fontSize: 12,
    fontFamily: 'Zaloga',
    color: '#6c757d',
    textAlign: 'center',
  },
  faqItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  faqQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  faqQuestionText: {
    fontSize: 16,
    fontFamily: 'Zaloga',
    color: '#000',
    flex: 1,
    paddingRight: 10,
  },
  faqAnswer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  faqAnswerText: {
    fontSize: 14,
    fontFamily: 'Zaloga',
    color: '#6c757d',
    lineHeight: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  actionIcon: {
    marginRight: 12,
  },
  actionText: {
    fontSize: 16,
    fontFamily: 'Zaloga',
    color: '#000',
    flex: 1,
  },
  bottomSpacing: {
    height: 100,
  },
});