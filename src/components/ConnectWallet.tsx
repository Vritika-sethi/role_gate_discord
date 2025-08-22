"use client";

import { ConnectButton } from "thirdweb/react";
import { thirdwebClient } from "@/lib/thirdweb";
import { CHAIN } from "@/lib/chain";
import { inAppWallet, createWallet } from "thirdweb/wallets";

const wallets = [
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  inAppWallet(),
];

export default function WalletConnect() {
  return (
    <ConnectButton 
      client={thirdwebClient} 
      wallets={wallets} 
      chain={CHAIN} 
    />
  );
}
