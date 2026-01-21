
import React from 'react';
import Link from 'next/link';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-gray-800 text-white">
        <div className="p-4">
          <h2 className="text-2xl font-bold">Dashboard</h2>
        </div>
        <nav>
          <ul>
            <li>
              <Link href="/dashboard" className="block p-4 hover:bg-gray-700">
                Home
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/products"
                className="block p-4 hover:bg-gray-700"
              >
                Products
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/analytics"
                className="block p-4 hover:bg-gray-700"
              >
                Analytics
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/store"
                className="block p-4 hover:bg-gray-700"
              >
                Store Profile
              </Link>
            </li>
          </ul>
        </nav>
      </aside>
      <main className="flex-1 p-8 bg-gray-100">{children}</main>
    </div>
  );
}
