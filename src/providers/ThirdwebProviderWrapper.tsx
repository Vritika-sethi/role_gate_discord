"use client";

import { ReactNode } from "react";
import { ThirdwebProvider } from "thirdweb/react";
import { thirdwebClient } from "@/lib/thirdweb";
import { CHAIN } from "@/lib/chain";
import { inAppWallet, createWallet } from "thirdweb/wallets";

// define wallets once
const wallets = [
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  inAppWallet(),
];

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThirdwebProvider>
      {children}
    </ThirdwebProvider>
  );
}
