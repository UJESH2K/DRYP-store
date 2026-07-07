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
