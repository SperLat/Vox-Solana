import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { WalletContextProvider } from "@/components/wallet-context-provider";

export const metadata: Metadata = {
  title: "Project Vox",
  description: "Solana devnet marketplace for audiobook narration bounties."
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <WalletContextProvider>{children}</WalletContextProvider>
      </body>
    </html>
  );
}
