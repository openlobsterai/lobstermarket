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

interface WalletState {
  connected: boolean;
  publicKey: string | null;
  token: string | null;
  user: any | null;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState>({
  connected: false,
  publicKey: null,
  token: null,
  user: null,
  connecting: false,
  connect: async () => {},
  disconnect: () => {},
});

export function useWallet() {
  return useContext(WalletContext);
}

function getPhantom(): any | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.phantom?.solana || w.solana;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [connecting, setConnecting] = useState(false);

  // Restore session on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("lm_token");
    const savedUser = localStorage.getItem("lm_user");
    const savedPk = localStorage.getItem("lm_pubkey");
    if (savedToken && savedUser && savedPk) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      setPublicKey(savedPk);
    }
  }, []);

  const connect = useCallback(async () => {
    const phantom = getPhantom();
    if (!phantom) {
      window.open("https://phantom.app/", "_blank");
      return;
    }

    setConnecting(true);
    try {
      // Connect wallet
      const resp = await phantom.connect();
      const pk = resp.publicKey.toString();
      setPublicKey(pk);

      // Get nonce from backend
      const { message } = await getNonce(pk);

      // Sign message
      const encoded = new TextEncoder().encode(message);
      const signedMessage = await phantom.signMessage(encoded, "utf8");
      const signatureB58 = bs58.encode(signedMessage.signature);

      // Verify with backend
      const { token: jwt, user: u } = await verifyWallet(pk, signatureB58, message);

      setToken(jwt);
      setUser(u);

      // Persist
      localStorage.setItem("lm_token", jwt);
      localStorage.setItem("lm_user", JSON.stringify(u));
      localStorage.setItem("lm_pubkey", pk);
    } catch (err) {
      console.error("Wallet connect failed:", err);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    const phantom = getPhantom();
    phantom?.disconnect?.();
    setPublicKey(null);
    setToken(null);
    setUser(null);
    localStorage.removeItem("lm_token");
    localStorage.removeItem("lm_user");
    localStorage.removeItem("lm_pubkey");
  }, []);

  return (
    <WalletContext.Provider
      value={{
        connected: !!token,
        publicKey,
        token,
        user,
        connecting,
        connect,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

