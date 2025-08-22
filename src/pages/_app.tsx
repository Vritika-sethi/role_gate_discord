// pages/_app.tsx
import type { AppProps } from "next/app";
import { ThirdwebProvider } from "thirdweb/react";
import { thirdwebClient } from "@/lib/thirdweb";

import "../styles/globals.css"; // Assuming a global CSS file exists

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ThirdwebProvider>
      <Component {...pageProps} />
    </ThirdwebProvider>
  );
}

export default MyApp;