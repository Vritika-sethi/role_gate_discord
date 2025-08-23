// pages/api/link-wallet.ts
import type { NextApiRequest, NextApiResponse } from "next";
import * as cookie from "cookie"; // This line is corrected
import { db, admin } from "@/lib/firebase";
import { session } from "@/lib/serverAuth";
import { CHAIN } from "@/lib/chain";

type WalletData = {
  address: string;
  blockchain?: number;
  nfts?: any[];
  tokens?: any[];
  lastUpdated?: any;
};

function getWalletsAsArray(walletsData: any): WalletData[] {
  let walletsArray: any[] = [];
  if (Array.isArray(walletsData)) {
    walletsArray = walletsData;
  } else if (typeof walletsData === 'object' && walletsData !== null) {
    walletsArray = Object.values(walletsData);
  }
  
  return walletsArray.map((w: any) => {
    const address = typeof w === "string" ? w : (w?.address ?? null);
    if (address && typeof address === 'string') {
      return { 
        address,
        blockchain: w.blockchain,
        nfts: w.nfts,
        tokens: w.tokens,
        lastUpdated: w.lastUpdated
      };
    }
    return null;
  }).filter(Boolean) as Array<WalletData>;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const cookies = cookie.parse(req.headers.cookie || "");
    const siweJwt = cookies["siwe_jwt"];
    const discordId = cookies["discord_user_id"];
    if (!siweJwt || !discordId) {
      return res.status(401).json({ error: "Login with wallet and Discord first." });
    }

    const { valid, payload } = session.verify(siweJwt);
    if (!valid) return res.status(401).json({ error: "Invalid wallet session." });

    const walletAddress = payload.address.toLowerCase();
    const userRef = db.collection("users").doc(discordId);
    const snap = await userRef.get();
    
    const walletsData = snap.exists ? snap.data()?.wallets ?? [] : [];
    const existing: WalletData[] = getWalletsAsArray(walletsData);

    if (!existing.find((w) => w.address.toLowerCase() === walletAddress)) {
      existing.push({ address: walletAddress, blockchain: CHAIN.id, nfts: [], tokens: [], lastUpdated: new Date() });
    }

    await userRef.set({
      userId: discordId,
      wallets: existing,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.status(200).json({ message: "Wallet linked." });
  } catch (e: any) {
    console.error("link-wallet error:", e);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
