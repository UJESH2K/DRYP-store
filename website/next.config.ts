import type { NextConfig } from "next";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";
const apiUrl = new URL(apiBaseUrl);

const s3PublicUrl =
  process.env.NEXT_PUBLIC_S3_PUBLIC_URL ||
  "https://casa-app-s3.s3.ap-southeast-2.amazonaws.com";
const s3RemoteUrl = new URL(s3PublicUrl);

const nextConfig: NextConfig = {
  reactCompiler: true,

  typescript: {
    ignoreBuildErrors: true,
  },

  images: {
    remotePatterns: [
      {
        protocol: apiUrl.protocol.replace(":", "") as "http" | "https",
        hostname: apiUrl.hostname,
        port: apiUrl.port,
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
      },
      {
        protocol: s3RemoteUrl.protocol.replace(":", "") as "http" | "https",
        hostname: s3RemoteUrl.hostname,
        pathname: "/**",
      },
    ],
  },

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiBaseUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
