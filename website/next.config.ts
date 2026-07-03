import type { NextConfig } from "next";

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
        protocol: "http",
        hostname: "localhost",
        port: "5000",
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
        protocol: s3RemoteUrl.protocol.replace(":", ""),
        hostname: s3RemoteUrl.hostname,
        pathname: "/**",
      },
    ],
  },

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: process.env.NODE_ENV === "production"
          ? process.env.NEXT_PUBLIC_API_BASE_URL + "/api/:path*"
          : "http://localhost:5000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
