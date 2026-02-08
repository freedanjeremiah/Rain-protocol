import type { Metadata } from "next";
import { Press_Start_2P } from "next/font/google";
import { Toaster } from "sonner";
import { Providers } from "@/components/providers";
import "./globals.css";
import "@mysten/dapp-kit/dist/index.css";

const pressStart2P = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
});

export const metadata: Metadata = {
  title: "Rain – We fix fake P2P",
  description: "Rate discovery and liquidation execution both use Sui's DeepBook — no CEX dependency, no off-chain keepers. True P2P lending on Sui.",
  icons: {
    icon: "/images/rain-logo.png",
    apple: "/images/rain-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={pressStart2P.variable}>
      <body className="font-pixel antialiased min-h-screen bg-[var(--bg)] text-[var(--fg)]">
        <Providers>
          {children}
        </Providers>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
