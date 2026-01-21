import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Alert, Dimensions, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/state/auth';
import { apiCall } from '../../src/lib/api';
import { VendorHeader } from '../../src/components/vendor/Header';
import { formatPrice } from '../../src/utils/formatting';

const screenWidth = Dimensions.get('window').width;

const MetricCard = ({ icon, label, value, color, size = 'small' }) => (
  <View style={[styles.card, size === 'large' ? styles.largeCard : styles.smallCard, { borderBottomColor: color, borderBottomWidth: 4 }]}>
    <Ionicons name={icon} size={28} color={color} style={styles.cardIcon} />
    <Text style={styles.cardLabel}>{label}</Text>
    <Text style={styles.cardValue}>{value}</Text>
  </View>
);

const ListCard = ({ title, data, renderItem }) => (
  <View style={[styles.card, styles.listCard]}>
    <Text style={styles.cardTitle}>{title}</Text>
    {data && data.length > 0 ? data.map(renderItem) : <Text style={styles.emptyText}>No data available</Text>}
  </View>
);

export default function AnalyticsScreen() {
  const { user } = useAuthStore();
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (user?.role !== 'vendor') {
      setError("You must be a vendor to see analytics.");
      setIsLoading(false);
      return;
    };
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiCall('/api/analytics/vendor');
      if (data && !data.message) {
        setAnalytics(data);
      } else {
        throw new Error(data.message || 'Failed to fetch analytics');
      }
    } catch (err) {
      setError(err.message);
      Alert.alert('Error', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchAnalytics();
    }, [fetchAnalytics])
  );

  if (isLoading) {
    return <SafeAreaView style={styles.centered}><ActivityIndicator size="large" /></SafeAreaView>;
  }

  if (error) {
    return <SafeAreaView style={styles.centered}><Text style={styles.errorText}>Error: {error}</Text></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <VendorHeader title="Dashboard" />
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchAnalytics} />}
      >
        <View style={styles.bentoGrid}>
          {/* Row 1 */}
          <MetricCard 
            label="Total Revenue" 
            value={formatPrice(analytics?.summary?.totalRevenue || 0)} 
            icon="cash-outline" 
            color="#10B981"
            size="large"
          />
          <MetricCard 
            label="Total Orders" 
            value={analytics?.summary?.totalOrders || 0} 
            icon="cart-outline" 
            color="#3B82F6" 
          />
          
          {/* Row 2 */}
          <MetricCard 
            label="Total Likes" 
            value={analytics?.summary?.totalLikes || 0} 
            icon="heart-outline" 
            color="#EF4444" 
          />
          <MetricCard 
            label="Wishlisted" 
            value={analytics?.summary?.totalWishlisted || 0} 
            icon="bookmark-outline" 
            color="#F59E0B"
          />
          <MetricCard 
            label="Products" 
            value={analytics?.summary?.totalProducts || 0} 
            icon="cube-outline" 
            color="#6366F1"
          />

          {/* Row 3 - Lists */}
          <ListCard 
            title="Top 5 Most Liked"
            data={analytics?.topLikedProducts}
            renderItem={(item, index) => (
              <View key={item._id} style={styles.listItem}>
                <Text style={styles.listItemNumber}>{index + 1}.</Text>
                <Text style={styles.listItemName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.listItemValue}>{item.likes} likes</Text>
              </View>
            )}
          />
          <ListCard 
            title="Top 5 Best Sellers"
            data={analytics?.topSoldProducts}
            renderItem={(item, index) => (
              <View key={item._id} style={styles.listItem}>
                <Text style={styles.listItemNumber}>{index + 1}.</Text>
                <Text style={styles.listItemName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.listItemValue}>{item.totalQuantity} sold</Text>
              </View>
            )}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' },
  errorText: { color: 'red', fontSize: 16 },
  scrollContent: { padding: 12 },
  
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  smallCard: {
    flexBasis: `calc(33.333% - 8px)`, // Three cards per row
    flexGrow: 1,
    alignItems: 'center',
  },
  largeCard: {
    flexBasis: `calc(66.667% - 8px)`, // Takes up 2/3 of the space
    flexGrow: 1,
  },
  listCard: {
    flexBasis: '100%',
  },
  cardIcon: {
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
  },
  cardValue: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginTop: 4,
  },
  cardTitle: { 
    fontSize: 18, 
    fontWeight: '600', 
    marginBottom: 12, 
    color: '#343a40' 
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  listItemNumber: {
    width: 24,
    color: '#6c757d',
  },
  listItemName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  listItemValue: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    marginVertical: 20,
    fontSize: 14,
    color: '#6c757d',
  }
});
