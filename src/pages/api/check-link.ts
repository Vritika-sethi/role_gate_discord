import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/lib/firebase";
import cookie from "cookie";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { walletAddress } = req.body;
  if (!walletAddress) {
    return res.status(400).json({ error: "Missing walletAddress." });
  }

  const cookies = cookie.parse(req.headers.cookie || "");
  const discordId = cookies["discord_user_id"];
  if (!discordId) {
    return res.status(401).json({ error: "Discord account not linked." });
  }

  try {
    const userDoc = await db.collection("users").doc(discordId).get();
    if (!userDoc.exists) {
      return res.status(200).json({ linked: false });
    }

    const wallets = userDoc.data()?.wallets || [];
    const isLinked = wallets.some((wallet: any) => wallet.address.toLowerCase() === walletAddress.toLowerCase());

    return res.status(200).json({ linked: isLinked });
  } catch (e: any) {
    console.error("Error checking wallet link status:", e);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}