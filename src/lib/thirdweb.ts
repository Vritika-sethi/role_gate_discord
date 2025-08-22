import { createThirdwebClient } from "thirdweb";
import { defineChain } from "thirdweb/chains";

export const thirdwebClient = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!, // Get this from thirdweb dashboard
});

// Example: Redbelly chain
export const CHAIN = defineChain({
  id: 151,
  name: "Redbelly Mainnet",
  rpc: "https://governors.mainnet.redbelly.network", // replace with correct RPC
  nativeCurrency: {
    name: "Redbelly",
    symbol: "RBNT",
    decimals: 18,
  },
});
