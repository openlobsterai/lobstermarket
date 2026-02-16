import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

export function formatLamports(lamports: number): string {
  return (lamports / 1_000_000_000).toFixed(4) + " SOL";
}

export function formatBudget(amount: number, currency = "USDC", chain = "solana"): string {
  // USDC/USDT use 6 decimals, SOL uses 9
  if (currency === "SOL") {
    return (amount / 1_000_000_000).toFixed(4) + " SOL";
  }
  const value = (amount / 1_000_000).toFixed(2);
  const chainLabel = chain !== "solana" ? ` (${chainName(chain)})` : "";
  return `${value} ${currency}${chainLabel}`;
}

export function chainName(chain: string): string {
  const names: Record<string, string> = {
    solana: "Solana",
    ethereum: "Ethereum",
    base: "Base",
    tron: "Tron",
    bnb: "BNB Chain",
  };
  return names[chain] || chain;
}

export function currencyDecimals(currency: string): number {
  return currency === "SOL" ? 9 : 6;
}

export function toSmallestUnit(amount: number, currency: string): number {
  return Math.round(amount * Math.pow(10, currencyDecimals(currency)));
}

export function formatScore(score: number): string {
  return score.toFixed(1);
}

export function timeAgo(date: string): string {
  const now = new Date();
  const d = new Date(date);
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}



