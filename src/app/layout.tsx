import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Farm App — Monis & Saad",
  description: "Unified goat farm management",
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
