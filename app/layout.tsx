import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PST Email Intelligence — AI-Powered Outlook Search",
  description:
    "Search and extract information from Outlook PST email archives using Claude AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
