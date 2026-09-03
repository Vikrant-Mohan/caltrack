import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Outfit } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { AuthProvider } from "@/components/AuthProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display/heading font for the brand, titles and big calorie figures.
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#00b06b",
};

export const metadata: Metadata = {
  title: "Caltrack — Free Calorie Tracker",
  description: "Caltrack — a free, mobile-first calorie tracker.",
  applicationName: "Caltrack",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Caltrack",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: {
      url: "/icons/apple-touch-icon.png",
      sizes: "180x180",
      type: "image/png",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Browser extensions (e.g. LanguageTool) inject attributes like
    // data-lt-installed="true" into the DOM before React hydrates, which
    // makes the server HTML look different from the client render. Telling
    // React to skip hydration checks on the root elements keeps those
    // extension edits from surfacing as "hydration failed" errors.
    <html
      lang="en"
      suppressHydrationWarning
      className={`h-full ${geistSans.variable} ${geistMono.variable} ${outfit.variable}`}
    >
      <body
        suppressHydrationWarning
        className="flex min-h-screen flex-col bg-background font-sans text-foreground antialiased"
      >
        <AuthProvider>
          <div className="flex-1 pb-24">{children}</div>
          <BottomNav />
        </AuthProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
