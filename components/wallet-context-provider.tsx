"use client";

import { PublicKey, type Connection, type Transaction } from "@solana/web3.js";
import type { ReactNode } from "react";
import { createContext, useContext, useMemo, useState } from "react";

type BrowserWalletName = "phantom" | "solflare";

type BrowserWalletProvider = {
  publicKey?: {
    toString: () => string;
  };
  isPhantom?: boolean;
  isSolflare?: boolean;
  connect: () => Promise<{ publicKey?: { toString: () => string } } | void>;
  disconnect?: () => Promise<void>;
  signTransaction?: (transaction: Transaction) => Promise<Transaction>;
  signAndSendTransaction?: (transaction: Transaction) => Promise<{ signature: string }>;
};

type WalletContextValue = {
  publicKey: PublicKey | null;
  connected: boolean;
  walletName: BrowserWalletName | null;
  connect: (walletName: BrowserWalletName) => Promise<void>;
  disconnect: () => Promise<void>;
  sendTransaction: (transaction: Transaction, connection: Connection) => Promise<string>;
};

declare global {
  interface Window {
    solana?: BrowserWalletProvider;
    solflare?: BrowserWalletProvider;
  }
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletContextProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [provider, setProvider] = useState<BrowserWalletProvider | null>(null);
  const [walletName, setWalletName] = useState<BrowserWalletName | null>(null);
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);

  const value = useMemo<WalletContextValue>(
    () => ({
      publicKey,
      connected: Boolean(publicKey && provider),
      walletName,
      connect: async (nextWalletName) => {
        const nextProvider = getProvider(nextWalletName);
        if (!nextProvider) {
          throw new Error(nextWalletName === "phantom" ? "Phantom wallet was not found." : "Solflare wallet was not found.");
        }

        const response = await nextProvider.connect();
        const nextPublicKey = response?.publicKey || nextProvider.publicKey;
        if (!nextPublicKey) {
          throw new Error("Wallet did not return a public key.");
        }

        setProvider(nextProvider);
        setWalletName(nextWalletName);
        setPublicKey(new PublicKey(nextPublicKey.toString()));
      },
      disconnect: async () => {
        await provider?.disconnect?.();
        setProvider(null);
        setWalletName(null);
        setPublicKey(null);
      },
      sendTransaction: async (transaction, connection) => {
        if (!provider) {
          throw new Error("Connect a wallet before sending a transaction.");
        }

        if (provider.signAndSendTransaction) {
          const result = await provider.signAndSendTransaction(transaction);
          return result.signature;
        }

        if (!provider.signTransaction) {
          throw new Error("This wallet cannot sign transactions from the browser.");
        }

        const signedTransaction = await provider.signTransaction(transaction);
        return connection.sendRawTransaction(signedTransaction.serialize());
      }
    }),
    [provider, publicKey, walletName]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useVoxWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useVoxWallet must be used inside WalletContextProvider.");
  }

  return context;
}

function getProvider(walletName: BrowserWalletName) {
  if (typeof window === "undefined") {
    return null;
  }

  if (walletName === "phantom" && window.solana?.isPhantom) {
    return window.solana;
  }

  if (walletName === "solflare" && window.solflare) {
    return window.solflare;
  }

  return null;
}
