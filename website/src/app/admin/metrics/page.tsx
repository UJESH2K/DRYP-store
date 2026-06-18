"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

interface Metrics {
  counts: {
    users: number;
    vendors: number;
    products: number;
    orders: number;
    revenue: number;
  };
  signupsByDay: { _id: string; count: number }[];
  revenueByDay: { date: string; revenue: number; orders: number }[];
  topVendors: { vendorName: string; revenue: number; orders: number }[];
  ordersByStatus: Record<string, number>;
}

function formatUSD(n: number) {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

export default function AdminMetricsPage() {
  const { token } = useAuth();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/analytics/admin/metrics`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          setError(`HTTP ${res.status}`);
          return;
        }
        setMetrics(await res.json());
      } catch (e: any) {
        setError(e?.message || 'Network error');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) return <div className="p-8">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!metrics) return null;

  // Compute the simple inline SVG chart dimensions.
  const chartW = 800, chartH = 200, padding = 20;
  const maxRev = Math.max(1, ...metrics.revenueByDay.map((d) => d.revenue));
  const stepX = (chartW - padding * 2) / Math.max(1, metrics.revenueByDay.length - 1);
  const points = metrics.revenueByDay.map((d, i) => {
    const x = padding + i * stepX;
    const y = chartH - padding - (d.revenue / maxRev) * (chartH - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="max-w-6xl mx-auto p-8">
      <h1 className="font-['Cormorant_Garamond'] text-4xl mb-2">Platform metrics</h1>
      <p className="text-gray-600 mb-8">
        Live counts and 30-day revenue trend. Refreshes on each page load.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <Stat label="Users" value={metrics.counts.users.toLocaleString()} />
        <Stat label="Vendors" value={metrics.counts.vendors.toLocaleString()} />
        <Stat label="Products" value={metrics.counts.products.toLocaleString()} />
        <Stat label="Orders" value={metrics.counts.orders.toLocaleString()} />
        <Stat label="Revenue" value={formatUSD(metrics.counts.revenue)} />
      </div>

      <section className="bg-white border rounded-lg p-6 mb-8">
        <h2 className="text-xl font-medium mb-4">Revenue (last 30 days)</h2>
        <svg
          viewBox={`0 0 ${chartW} ${chartH}`}
          className="w-full h-48"
          preserveAspectRatio="none"
        >
          <polyline
            points={points}
            fill="none"
            stroke="currentColor"
            className="text-black"
            strokeWidth={2}
          />
        </svg>
      </section>

      <div className="grid md:grid-cols-2 gap-8">
        <section className="bg-white border rounded-lg p-6">
          <h2 className="text-xl font-medium mb-4">Orders by status</h2>
          <ul className="space-y-1 text-sm">
            {Object.entries(metrics.ordersByStatus).length === 0 && (
              <li className="text-gray-500">No orders yet.</li>
            )}
            {Object.entries(metrics.ordersByStatus).map(([status, count]) => (
              <li key={status} className="flex justify-between">
                <span className="capitalize">{status.replace(/_/g, ' ')}</span>
                <span className="font-mono">{count}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-white border rounded-lg p-6">
          <h2 className="text-xl font-medium mb-4">Top vendors</h2>
          {metrics.topVendors.length === 0 ? (
            <p className="text-gray-500 text-sm">No sales yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-1">Vendor</th>
                  <th>Orders</th>
                  <th className="text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {metrics.topVendors.map((v) => (
                  <tr key={v.vendorName} className="border-b last:border-b-0">
                    <td className="py-1">{v.vendorName}</td>
                    <td>{v.orders}</td>
                    <td className="text-right font-mono">
                      {formatUSD(v.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="text-xs uppercase text-gray-500 tracking-wider">
        {label}
      </div>
      <div className="text-2xl font-medium mt-1">{value}</div>
    </div>
  );
}