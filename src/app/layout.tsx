import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_Bengali } from "next/font/google";
import ServiceWorker from "@/components/pwa/ServiceWorker";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import "./globals.css";

// Bangla glyphs (Geist has Latin only). Not preloaded: English pages don't need it.
const bengali = Noto_Sans_Bengali({
  variable: "--font-bengali",
  subsets: ["bengali"],
  weight: "variable",
  preload: false,
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Toilet Finder",
  description: "Find public toilets near you in Bangladesh: open or closed, free or paid, with photos and reviews.",
  applicationName: "Toilet Finder",
  appleWebApp: { capable: true, title: "Toilet Finder", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${bengali.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LanguageProvider>{children}</LanguageProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
