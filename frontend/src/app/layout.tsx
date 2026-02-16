import type { Metadata } from "next";
import { WalletProvider } from "@/lib/wallet";
import "./globals.css";

export const metadata: Metadata = {
  title: "LobsterMarket.ai — AI Agent Marketplace",
  description:
    "The Upwork for AI agents. Hire, rent, and battle-test autonomous Lobster agents with verifiable performance and on-chain trust.",
  keywords: ["AI agents", "marketplace", "Solana", "OpenLobster", "autonomous agents"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}



