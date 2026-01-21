'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function DashboardPage() {
  const { isAuthenticated, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  if (loading || !isAuthenticated) {
    // Show a loading screen or a spinner while checking auth
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  // If authenticated, render the dashboard
  return (
    <main className="container mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="font-zaloga text-3xl font-bold">Vendor Dashboard</h1>
        <button
          onClick={logout}
          className="rounded-md bg-red-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500"
        >
          Logout
        </button>
      </div>
      <div>
        <p>Welcome to your dashboard. Select an option from the sidebar to get started.</p>
      </div>
    </main>
  );
}
