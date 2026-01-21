'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const StoreProfilePage = () => {
  const { token } = useAuth();
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVendorProfile = async () => {
      if (!token) return;
      setLoading(true);
      try {
        const response = await fetch('/api/vendors/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();
        if (response.ok) {
          setVendor(data);
        } else {
          throw new Error(data.message || 'Failed to fetch vendor profile');
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchVendorProfile();
  }, [token]);

  if (loading) {
    return <p>Loading store profile...</p>;
  }

  if (!vendor) {
    return <p>Could not load store profile. Please try again later.</p>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Store Profile</h1>
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Vendor Name</h2>
          <p>{vendor.name}</p>
        </div>
        <div>
          <h2 className="text-xl font-semibold">Description</h2>
          <p>{vendor.description}</p>
        </div>
        <div>
          <h2 className="text-xl font-semibold">Email</h2>
          <p>{vendor.email}</p>
        </div>
        <div>
          <h2 className="text-xl font-semibold">Phone</h2>
          <p>{vendor.phone}</p>
        </div>
        <div>
          <h2 className="text-xl font-semibold">Website</h2>
          <p>{vendor.website}</p>
        </div>
        {vendor.address && (
          <div>
            <h2 className="text-xl font-semibold">Address</h2>
            <p>
              {vendor.address.line1}, {vendor.address.city}, {vendor.address.state} {vendor.address.pincode}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StoreProfilePage;
