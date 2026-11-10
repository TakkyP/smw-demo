import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";

const font = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-thai",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Worklist Management", template: "%s · Worklist" },
  description: "ระบบติดตามและตรวจสอบงานที่มอบหมาย",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#D32F2F",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={font.variable}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
