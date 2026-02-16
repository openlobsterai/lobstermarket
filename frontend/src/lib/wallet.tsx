"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getNonce, verifyWallet } from "./api";
import bs58 from "bs58";

// ─── Types ──────────────────────────────────────────────────
export type WalletType = "phantom" | "solflare" | "metamask" | "coinbase" | "trust" | "okx";
export type ChainType = "solana" | "ethereum" | "base" | "bnb" | "tron";

interface WalletInfo {
  id: WalletType;
  name: string;
  chain: ChainType;
  icon: string;
  color: string;
  detected: boolean;
}

interface WalletState {
  connected: boolean;
  publicKey: string | null;
  token: string | null;
  user: any | null;
  connecting: boolean;
  walletType: WalletType | null;
  chainType: ChainType | null;
  showModal: boolean;
  availableWallets: WalletInfo[];
  connect: (walletId?: WalletType) => Promise<void>;
  disconnect: () => void;
  openWalletModal: () => void;
  closeWalletModal: () => void;
}

const WalletContext = createContext<WalletState>({
  connected: false,
  publicKey: null,
  token: null,
  user: null,
  connecting: false,
  walletType: null,
  chainType: null,
  showModal: false,
  availableWallets: [],
  connect: async () => {},
  disconnect: () => {},
  openWalletModal: () => {},
  closeWalletModal: () => {},
});

export function useWallet() {
  return useContext(WalletContext);
}

// ─── Wallet Detection ───────────────────────────────────────
function getProvider(id: WalletType): any | null {
  if (typeof window === "undefined") return null;
  const w = window as any;

  switch (id) {
    case "phantom":
      return w.phantom?.solana || (w.solana?.isPhantom ? w.solana : null);
    case "solflare":
      return w.solflare?.isSolflare ? w.solflare : null;
    case "metamask": {
      if (w.ethereum?.isMetaMask && !w.ethereum?.isCoinbaseWallet) return w.ethereum;
      // Multi-provider case
      if (w.ethereum?.providers) {
        return w.ethereum.providers.find((p: any) => p.isMetaMask && !p.isCoinbaseWallet) || null;
      }
      return null;
    }
    case "coinbase": {
      if (w.coinbaseWalletExtension) return w.coinbaseWalletExtension;
      if (w.ethereum?.isCoinbaseWallet) return w.ethereum;
      if (w.ethereum?.providers) {
        return w.ethereum.providers.find((p: any) => p.isCoinbaseWallet) || null;
      }
      return null;
    }
    case "trust": {
      if (w.trustwallet) return w.trustwallet;
      if (w.ethereum?.isTrust) return w.ethereum;
      return null;
    }
    case "okx": {
      return w.okxwallet || null;
    }
    default:
      return null;
  }
}

function detectWallets(): WalletInfo[] {
  const wallets: WalletInfo[] = [
    { id: "phantom", name: "Phantom", chain: "solana", icon: "👻", color: "from-purple-500 to-purple-700", detected: false },
    { id: "solflare", name: "Solflare", chain: "solana", icon: "🔆", color: "from-orange-500 to-orange-700", detected: false },
    { id: "metamask", name: "MetaMask", chain: "ethereum", icon: "🦊", color: "from-amber-500 to-amber-700", detected: false },
    { id: "coinbase", name: "Coinbase Wallet", chain: "ethereum", icon: "🔵", color: "from-blue-500 to-blue-700", detected: false },
    { id: "trust", name: "Trust Wallet", chain: "bnb", icon: "🛡️", color: "from-cyan-500 to-cyan-700", detected: false },
    { id: "okx", name: "OKX Wallet", chain: "ethereum", icon: "⭕", color: "from-slate-500 to-slate-700", detected: false },
  ];

  return wallets.map((w) => ({
    ...w,
    detected: !!getProvider(w.id),
  }));
}

// ─── Signing Logic ──────────────────────────────────────────
async function connectSolana(provider: any): Promise<{ address: string; signMessage: (msg: string) => Promise<string> }> {
  const resp = await provider.connect();
  const address = resp.publicKey.toString();
  return {
    address,
    signMessage: async (msg: string) => {
      const encoded = new TextEncoder().encode(msg);
      const signed = await provider.signMessage(encoded, "utf8");
      return bs58.encode(signed.signature);
    },
  };
}

async function connectEVM(provider: any): Promise<{ address: string; signMessage: (msg: string) => Promise<string> }> {
  const accounts: string[] = await provider.request({ method: "eth_requestAccounts" });
  const address = accounts[0];
  return {
    address,
    signMessage: async (msg: string) => {
      const signature: string = await provider.request({
        method: "personal_sign",
        params: [msg, address],
      });
      return signature; // hex string with 0x prefix
    },
  };
}

function isSolanaWallet(id: WalletType): boolean {
  return id === "phantom" || id === "solflare";
}

function walletChain(id: WalletType): ChainType {
  switch (id) {
    case "phantom":
    case "solflare":
      return "solana";
    case "trust":
      return "bnb";
    default:
      return "ethereum";
  }
}

// ─── Provider ───────────────────────────────────────────────
export function WalletProvider({ children }: { children: ReactNode }) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [walletType, setWalletType] = useState<WalletType | null>(null);
  const [chainType, setChainType] = useState<ChainType | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [availableWallets, setAvailableWallets] = useState<WalletInfo[]>([]);

  // Detect wallets on mount
  useEffect(() => {
    // Small delay to let extensions inject
    const timer = setTimeout(() => setAvailableWallets(detectWallets()), 200);
    return () => clearTimeout(timer);
  }, []);

  // Restore session
  useEffect(() => {
    const savedToken = localStorage.getItem("lm_token");
    const savedUser = localStorage.getItem("lm_user");
    const savedPk = localStorage.getItem("lm_pubkey");
    const savedWalletType = localStorage.getItem("lm_wallet_type") as WalletType | null;
    const savedChain = localStorage.getItem("lm_chain") as ChainType | null;
    if (savedToken && savedUser && savedPk) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      setPublicKey(savedPk);
      setWalletType(savedWalletType);
      setChainType(savedChain);
    }
  }, []);

  const connect = useCallback(async (walletId?: WalletType) => {
    // If no wallet specified, open modal
    if (!walletId) {
      setShowModal(true);
      return;
    }

    const provider = getProvider(walletId);
    if (!provider) {
      // Open install page
      const urls: Record<WalletType, string> = {
        phantom: "https://phantom.app/",
        solflare: "https://solflare.com/",
        metamask: "https://metamask.io/",
        coinbase: "https://www.coinbase.com/wallet",
        trust: "https://trustwallet.com/",
        okx: "https://www.okx.com/web3",
      };
      window.open(urls[walletId] || "https://phantom.app/", "_blank");
      return;
    }

    setConnecting(true);
    setShowModal(false);

    try {
      const isSolana = isSolanaWallet(walletId);
      const chain = walletChain(walletId);

      // Connect and get signing function
      const { address, signMessage } = isSolana
        ? await connectSolana(provider)
        : await connectEVM(provider);

      setPublicKey(address);
      setWalletType(walletId);
      setChainType(chain);

      // Get nonce from backend
      const { message } = await getNonce(address);

      // Sign
      const signature = await signMessage(message);

      // Verify with backend
      const walletTypeBackend = isSolana ? "solana" : chain;
      const { token: jwt, user: u } = await verifyWallet(
        address,
        signature,
        message,
        walletTypeBackend,
      );

      setToken(jwt);
      setUser(u);

      // Persist
      localStorage.setItem("lm_token", jwt);
      localStorage.setItem("lm_user", JSON.stringify(u));
      localStorage.setItem("lm_pubkey", address);
      localStorage.setItem("lm_wallet_type", walletId);
      localStorage.setItem("lm_chain", chain);
    } catch (err) {
      console.error("Wallet connect failed:", err);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (walletType) {
      const provider = getProvider(walletType);
      provider?.disconnect?.();
    }
    setPublicKey(null);
    setToken(null);
    setUser(null);
    setWalletType(null);
    setChainType(null);
    localStorage.removeItem("lm_token");
    localStorage.removeItem("lm_user");
    localStorage.removeItem("lm_pubkey");
    localStorage.removeItem("lm_wallet_type");
    localStorage.removeItem("lm_chain");
  }, [walletType]);

  return (
    <WalletContext.Provider
      value={{
        connected: !!token,
        publicKey,
        token,
        user,
        connecting,
        walletType,
        chainType,
        showModal,
        availableWallets,
        connect,
        disconnect,
        openWalletModal: () => setShowModal(true),
        closeWalletModal: () => setShowModal(false),
      }}
    >
      {children}
      {/* ─── Wallet Selection Modal ─────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-md mx-4 p-6 rounded-2xl bg-slate-900 border border-slate-700/50 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-1">Connect Wallet</h2>
            <p className="text-sm text-slate-400 mb-5">
              Choose a wallet to sign in. Solana wallets are recommended.
            </p>

            {/* Solana section */}
            <div className="mb-4">
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-2 font-medium">
                Solana (Recommended — USDC)
              </div>
              <div className="space-y-2">
                {availableWallets
                  .filter((w) => isSolanaWallet(w.id))
                  .map((w) => (
                    <button
                      key={w.id}
                      onClick={() => connect(w.id)}
                      disabled={connecting}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-purple-500/30 hover:bg-slate-800 transition disabled:opacity-50"
                    >
                      <span className="text-2xl">{w.icon}</span>
                      <div className="flex-1 text-left">
                        <div className="font-medium">{w.name}</div>
                        <div className="text-xs text-slate-500">Solana</div>
                      </div>
                      {w.detected ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs">
                          Detected
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-500 text-xs">
                          Install
                        </span>
                      )}
                    </button>
                  ))}
              </div>
            </div>

            {/* EVM section */}
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-2 font-medium">
                EVM Wallets (ETH / Base / BNB)
              </div>
              <div className="space-y-2">
                {availableWallets
                  .filter((w) => !isSolanaWallet(w.id))
                  .map((w) => (
                    <button
                      key={w.id}
                      onClick={() => connect(w.id)}
                      disabled={connecting}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-blue-500/30 hover:bg-slate-800 transition disabled:opacity-50"
                    >
                      <span className="text-2xl">{w.icon}</span>
                      <div className="flex-1 text-left">
                        <div className="font-medium">{w.name}</div>
                        <div className="text-xs text-slate-500">
                          {w.chain === "bnb" ? "BNB Chain" : "Ethereum / Base"}
                        </div>
                      </div>
                      {w.detected ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs">
                          Detected
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-500 text-xs">
                          Install
                        </span>
                      )}
                    </button>
                  ))}
              </div>
            </div>

            <button
              onClick={() => setShowModal(false)}
              className="w-full mt-5 py-2.5 rounded-xl border border-slate-700 text-slate-400 text-sm font-medium hover:bg-slate-800/50 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </WalletContext.Provider>
  );
}
