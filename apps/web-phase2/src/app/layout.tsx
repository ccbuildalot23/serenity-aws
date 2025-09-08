import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from 'sonner';
import AuthProvider from '@/providers/AuthProvider';
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Serenity - Mental Health & Recovery Support",
  description: "HIPAA-compliant mental health platform for daily check-ins, crisis support, and provider dashboards",
  keywords: ["mental health", "recovery", "HIPAA compliant", "crisis support", "daily check-in"],
  authors: [{ name: "Serenity Team" }],
  viewport: "width=device-width, initial-scale=1",
  robots: "noindex, nofollow", // MVP development - prevent indexing
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <AuthProvider>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </AuthProvider>
      </body>
    </html>
  );
}
