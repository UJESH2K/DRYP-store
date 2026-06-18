"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

/**
 * Shopify integration page.
 *
 * Vendors can paste their Shopify store domain + access token
 * to enable stock/order sync. We never store the token in
 * client-side state past initial form submission; it travels
 * to the backend which encrypts it server-side.
 */
interface ShopifyConnection {
  enabled: boolean;
  shop: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSyncedAt: string | null;
  productsSynced: number;
  errorMessage?: string;
}

export default function ShopifyIntegrationPage() {
  const { token } = useAuth();
  const [connection, setConnection] = useState<ShopifyConnection | null>(null);
  const [shop, setShop] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/vendors/shopify`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        setConnection(data);
        setShop(data.shop || '');
      } catch (e) {
        // ignore — first visit
      }
    })();
  }, [token]);

  async function save() {
    if (!shop || !accessToken) {
      setError('Both shop and access token are required.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/vendors/shopify`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ shop, accessToken }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setConnection(data);
      setAccessToken('');
      setSuccess('Saved. Test the connection below.');
    } catch (e: any) {
      setError(e?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/vendors/shopify/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess(`Connected — ${data.productsCount} products in your store.`);
        setConnection((c) => c ? { ...c, status: 'connected', productsSynced: data.productsCount, lastSyncedAt: new Date().toISOString() } : c);
      } else {
        setError(data.message || 'Connection failed.');
        setConnection((c) => c ? { ...c, status: 'error', errorMessage: data.message } : c);
      }
    } catch (e: any) {
      setError(e?.message || 'Test failed');
    } finally {
      setTesting(false);
    }
  }

  async function disconnect() {
    if (!confirm('Disconnect Shopify? Stock will no longer be auto-synced.')) return;
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/vendors/shopify`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setConnection(null);
        setShop('');
        setSuccess('Disconnected.');
      }
    } catch (e: any) {
      setError(e?.message || 'Could not disconnect');
    }
  }

  const isConnected = connection?.status === 'connected';

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="font-['Cormorant_Garamond'] text-4xl mb-2">Shopify</h1>
      <p className="text-gray-600 mb-8">
        Connect your Shopify store to keep stock and orders in sync with DRYP.
        We sync every 15 minutes and on every checkout.
      </p>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-4 mb-6 rounded">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 mb-6 rounded">
          {error}
        </div>
      )}

      <div className="bg-white border rounded-lg p-6 mb-6">
        <h2 className="text-xl font-medium mb-4">
          {isConnected ? '✓ Connected' : 'Connect'}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Store domain
            </label>
            <input
              type="text"
              placeholder="my-store.myshopify.com"
              value={shop}
              onChange={(e) => setShop(e.target.value.trim())}
              disabled={isConnected}
              className="w-full border rounded px-3 py-2 disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Admin API access token
            </label>
            <input
              type="password"
              placeholder={isConnected ? '•••••• (unchanged)' : 'shpat_...'}
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              disabled={isConnected}
              autoComplete="off"
              className="w-full border rounded px-3 py-2 disabled:bg-gray-50"
            />
            <p className="text-xs text-gray-500 mt-1">
              Generate at Shopify Admin → Apps → Develop apps → API credentials.
              Required scopes: <code>read_products</code>, <code>read_inventory</code>.
            </p>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          {!isConnected ? (
            <button
              onClick={save}
              disabled={saving}
              className="bg-black text-white px-5 py-2 rounded disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save & Connect'}
            </button>
          ) : (
            <>
              <button
                onClick={testConnection}
                disabled={testing}
                className="border px-5 py-2 rounded disabled:opacity-50"
              >
                {testing ? 'Testing…' : 'Test connection'}
              </button>
              <button
                onClick={disconnect}
                className="text-red-600 px-5 py-2"
              >
                Disconnect
              </button>
            </>
          )}
        </div>
      </div>

      {isConnected && connection && (
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-xl font-medium mb-4">Status</h2>
          <dl className="grid grid-cols-2 gap-y-3 text-sm">
            <dt className="text-gray-600">Products synced</dt>
            <dd>{connection.productsSynced ?? '—'}</dd>
            <dt className="text-gray-600">Last sync</dt>
            <dd>
              {connection.lastSyncedAt
                ? new Date(connection.lastSyncedAt).toLocaleString()
                : 'Never'}
            </dd>
            <dt className="text-gray-600">Stock check at checkout</dt>
            <dd>Enabled — fresh stock is verified at every order.</dd>
          </dl>
        </div>
      )}
    </div>
  );
}