import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Al-Yumn Goat Farm",
  description: "Farm management for Monis & Saad",
  applicationName: "Al-Yumn Goat Farm",
  appleWebApp: {
    capable: true,
    title: "Al-Yumn",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-100 text-stone-900 antialiased">
        <div className="mx-auto min-h-screen max-w-lg pb-24">{children}</div>
      </body>
    </html>
  );
}
