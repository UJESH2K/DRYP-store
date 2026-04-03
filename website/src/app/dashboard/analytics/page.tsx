"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

interface AnalyticsSummary {
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  totalLikes: number;
}

interface ProductStat {
  _id: string;
  name: string;
  likes: number;
  totalQuantity: number;
}

interface AnalyticsData {
  summary: AnalyticsSummary;
  topLikedProducts: ProductStat[];
  topSoldProducts: ProductStat[];
}

const AnalyticsPage = () => {
  const { token } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!token) return;
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/analytics/vendor`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();
        if (response.ok) {
          setAnalytics(data);
        } else {
          throw new Error(data.message || "Failed to fetch analytics");
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
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <p className="font-sans text-[10px] uppercase tracking-[0.4em] text-gray-400 animate-pulse">
          Compiling Metrics...
        </p>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex h-[80vh] items-center justify-center text-center">
        <div>
          <span className="font-cursive text-6xl text-gray-300 mb-2 block">
            Error
          </span>
          <p className="font-sans text-[10px] tracking-[0.2em] text-gray-500 uppercase mt-4">
            Unable to retrieve studio metrics at this time.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Pinyon+Script&family=Playfair+Display:ital,wght@0,300;0,400;0,600;1,400&display=swap');
        .font-editorial { font-family: 'Playfair Display', serif; }
        .font-cursive { font-family: 'Pinyon Script', cursive; }
      `,
        }}
      />

      <div className="min-h-screen bg-[#FCFCFA] text-black font-sans selection:bg-black selection:text-white px-6 py-12 md:px-16 lg:px-24">
        {/* Minimalist Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-black pb-8 mb-16 gap-6">
          <div>
            <p className="font-sans text-[10px] font-medium uppercase tracking-[0.4em] text-gray-400 mb-3">
              Performance & Reach
            </p>
            <h1 className="font-editorial text-5xl md:text-6xl font-light tracking-tight text-black">
              The{" "}
              <span className="font-cursive text-6xl md:text-7xl lowercase text-gray-400 -ml-2">
                analytics
              </span>
            </h1>
          </div>
          <div className="text-right hidden md:block">
            <p className="font-sans text-[9px] uppercase tracking-[0.3em] text-gray-400">
              Reporting Period
            </p>
            <p className="font-editorial italic text-lg mt-1 text-black">
              All Time
            </p>
          </div>
        </div>

        {/* --- KPI Grid (Architectural / Editorial Style) --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-gray-200 border border-gray-200 mb-24">
          {/* Revenue */}
          <div className="bg-[#FCFCFA] p-8 flex flex-col justify-between aspect-square md:aspect-auto md:h-48 group hover:bg-black transition-colors duration-500 cursor-default">
            <h2 className="font-sans text-[9px] font-semibold uppercase tracking-[0.3em] text-gray-400 group-hover:text-gray-400 transition-colors">
              Gross Revenue
            </h2>
            <p className="font-editorial text-4xl lg:text-5xl text-black group-hover:text-white transition-colors duration-500">
              ${analytics.summary.totalRevenue.toFixed(2)}
            </p>
          </div>

          {/* Orders */}
          <div className="bg-[#FCFCFA] p-8 flex flex-col justify-between aspect-square md:aspect-auto md:h-48 group hover:bg-black transition-colors duration-500 cursor-default">
            <h2 className="font-sans text-[9px] font-semibold uppercase tracking-[0.3em] text-gray-400 group-hover:text-gray-400 transition-colors">
              Acquisitions
            </h2>
            <p className="font-editorial text-4xl lg:text-5xl text-black group-hover:text-white transition-colors duration-500">
              {analytics.summary.totalOrders}
            </p>
          </div>

          {/* Products */}
          <div className="bg-[#FCFCFA] p-8 flex flex-col justify-between aspect-square md:aspect-auto md:h-48 group hover:bg-black transition-colors duration-500 cursor-default">
            <h2 className="font-sans text-[9px] font-semibold uppercase tracking-[0.3em] text-gray-400 group-hover:text-gray-400 transition-colors">
              Archive Size
            </h2>
            <p className="font-editorial text-4xl lg:text-5xl text-black group-hover:text-white transition-colors duration-500">
              {analytics.summary.totalProducts}
            </p>
          </div>

          {/* Likes */}
          <div className="bg-[#FCFCFA] p-8 flex flex-col justify-between aspect-square md:aspect-auto md:h-48 group hover:bg-black transition-colors duration-500 cursor-default">
            <h2 className="font-sans text-[9px] font-semibold uppercase tracking-[0.3em] text-gray-400 group-hover:text-gray-400 transition-colors">
              Global Interest
            </h2>
            <p className="font-editorial text-4xl lg:text-5xl text-black group-hover:text-white transition-colors duration-500">
              {analytics.summary.totalLikes}
            </p>
          </div>
        </div>

        {/* --- Top Lists Section --- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
          {/* Top Liked Products */}
          <div>
            <div className="border-b border-black pb-4 mb-6 flex items-baseline justify-between">
              <h2 className="font-editorial text-2xl tracking-tight">
                Most Desired
              </h2>
              <span className="font-sans text-[8px] uppercase tracking-[0.3em] text-gray-400">
                By Likes
              </span>
            </div>

            {analytics.topLikedProducts.length > 0 ? (
              <ul className="flex flex-col">
                {analytics.topLikedProducts.map((product, index) => (
                  <li
                    key={product._id}
                    className="group flex justify-between items-center py-5 border-b border-gray-100 hover:border-black transition-colors duration-300"
                  >
                    <div className="flex items-center gap-6">
                      <span className="font-editorial text-sm italic text-gray-400">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="font-sans text-xs uppercase tracking-widest text-black group-hover:font-medium transition-all">
                        {product.name}
                      </span>
                    </div>
                    <span className="font-sans text-[10px] tracking-[0.2em] text-gray-400 group-hover:text-black transition-colors">
                      {product.likes} <span className="text-[8px]">♡</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-gray-400 py-4">
                No engagement data yet.
              </p>
            )}
          </div>

          {/* Top Sold Products */}
          <div>
            <div className="border-b border-black pb-4 mb-6 flex items-baseline justify-between">
              <h2 className="font-editorial text-2xl tracking-tight">
                Highest Movement
              </h2>
              <span className="font-sans text-[8px] uppercase tracking-[0.3em] text-gray-400">
                By Volume
              </span>
            </div>

            {analytics.topSoldProducts.length > 0 ? (
              <ul className="flex flex-col">
                {analytics.topSoldProducts.map((product, index) => (
                  <li
                    key={product._id}
                    className="group flex justify-between items-center py-5 border-b border-gray-100 hover:border-black transition-colors duration-300"
                  >
                    <div className="flex items-center gap-6">
                      <span className="font-editorial text-sm italic text-gray-400">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="font-sans text-xs uppercase tracking-widest text-black group-hover:font-medium transition-all">
                        {product.name}
                      </span>
                    </div>
                    <span className="font-sans text-[10px] tracking-[0.2em] text-gray-400 group-hover:text-black transition-colors">
                      {product.totalQuantity}{" "}
                      <span className="text-[8px]">UNITS</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-gray-400 py-4">
                No transaction data yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default AnalyticsPage;
