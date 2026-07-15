import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from 'next/font/local';
import { AuthProvider } from '@/contexts/AuthContext';
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  variable: '--font-inter',
});

const zaloga = localFont({
  src: '../assets/fonts/Zaloga.ttf',
  display: 'swap',
  variable: '--font-zaloga',
});

export const metadata: Metadata = {
  title: "DRYP Vendor Hub",
  description: "Manage your products and sales.",
  icons: {
    icon: [
      { url: "/icon.svg?v=3", type: "image/svg+xml" },
      { url: "/favicon.ico?v=3", sizes: "any" },
      { url: "/icon.png?v=3", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-icon.png?v=3", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${zaloga.variable} font-sans antialiased`}
      >
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
