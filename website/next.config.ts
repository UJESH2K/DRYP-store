import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  typescript: {
    ignoreBuildErrors: true,
  },

  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8080", // ⬅️ Changed from 5000
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "plus.unsplash.com",
        pathname: "/**",
      }
    ],
  },

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8080/api/:path*", // ⬅️ Changed from 5000
      },
      {
        source: "/uploads/:path*",
        destination: "http://localhost:8080/uploads/:path*", // ⬅️ Changed from 5000
      },
    ];
  },
};

export default nextConfig;