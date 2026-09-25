import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./ui-overrides.css";
import ErrorBoundary from "../components/ErrorBoundary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vinylify — Your music, your way",
  description: "A premium music experience. Connect your Spotify and play your music in style.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--color-bg)] text-[var(--color-text-primary)]">
        <link rel="preconnect" href="https://api.spotify.com" />
        <link rel="preconnect" href="https://i.scdn.co" />
        <link rel="preconnect" href="https://sdk.scdn.co" />
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
