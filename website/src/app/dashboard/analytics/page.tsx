'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const AnalyticsPage = () => {
  const { token } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!token) return;
      setLoading(true);
      try {
        const response = await fetch('/api/analytics/vendor', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();
        if (response.ok) {
          setAnalytics(data);
        } else {
          throw new Error(data.message || 'Failed to fetch analytics');
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [token]);

  if (loading) {
    return <p>Loading analytics...</p>;
  }

  if (!analytics) {
    return <p>Could not load analytics. Please try again later.</p>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Analytics</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold">Total Revenue</h2>
          <p className="text-2xl">${analytics.summary.totalRevenue.toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold">Total Orders</h2>
          <p className="text-2xl">{analytics.summary.totalOrders}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold">Total Products</h2>
          <p className="text-2xl">{analytics.summary.totalProducts}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold">Total Likes</h2>
          <p className="text-2xl">{analytics.summary.totalLikes}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-2xl font-bold mb-4">Top 5 Liked Products</h2>
          <ul className="bg-white p-4 rounded-lg shadow">
            {analytics.topLikedProducts.map((product) => (
              <li key={product._id} className="flex justify-between items-center py-2 border-b">
                <span>{product.name}</span>
                <span>{product.likes} Likes</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-4">Top 5 Sold Products</h2>
          <ul className="bg-white p-4 rounded-lg shadow">
            {analytics.topSoldProducts.map((product) => (
              <li key={product._id} className="flex justify-between items-center py-2 border-b">
                <span>{product.name}</span>
                <span>{product.totalQuantity} Sold</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
