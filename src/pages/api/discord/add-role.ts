// pages/api/discord/add-role.ts
import type { NextApiRequest, NextApiResponse } from "next";
import cookie from "cookie";
import { db, admin } from "@/lib/firebase";
import { getContract, readContract } from "thirdweb";
import { thirdwebClient } from "@/lib/thirdweb";
import { CHAIN, ERC721_ABI} from "@/lib/chain";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const { guildId, roleId } = req.body as { guildId?: string; roleId?: string };
    if (!guildId || !roleId) return res.status(400).json({ error: "Missing guildId or roleId" });

    const cookies = cookie.parse(req.headers.cookie || "");
    const userId = cookies["discord_user_id"];
    if (!userId) return res.status(401).json({ error: "Discord not linked." });

    // Load config
    const roleSnap = await db.collection("serverSettings").doc(guildId).collection("roles").doc(roleId).get();
    if (!roleSnap.exists) return res.status(404).json({ error: "Role config not found." });
    const config = roleSnap.data()!;
    const linkType = config.linkType as "free" | "nft_gated" | "token_gated";

    // Load user wallets
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) return res.status(403).json({ error: "No linked wallets." });
    const wallets: Array<{ address: string }> = (userDoc.data()?.wallets ?? []).map((w: any) =>
      typeof w === "string" ? { address: w } : { address: w.address }
    );
    if (!wallets.length) return res.status(403).json({ error: "No linked wallets." });

    // Qualification check (server-side re-check)
    let qualified = false;
    if (linkType === "free") {
      qualified = true;
    } else if (linkType === "nft_gated" || linkType === "token_gated") {
      const contract = getContract({
        client: thirdwebClient,
        chain: CHAIN,
        address: config.contractAddress as `0x${string}`,
        abi: ERC721_ABI,
      });
      let total = 0n;
      for (const w of wallets) {
        const bal = await readContract({ contract, method: "balanceOf", params: [w.address as `0x${string}`] });
        total += BigInt(bal);
      }
      qualified = total >= BigInt(config.requiredCount || 1);
    }

    if (!qualified) return res.status(403).json({ error: "You do not meet the requirements." });

    // Grant role via Discord
    const url = `https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`;
    const discordResponse = await fetch(url, {
      method: "PUT",
      headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}`, "Content-Type": "application/json" },
    });
    if (!discordResponse.ok) {
      const txt = await discordResponse.text();
      console.error("Discord API Error:", txt);
      return res.status(discordResponse.status).json({ error: "Discord API error." });
    }

    // Update user document
    await db.collection("users").doc(userId).set({
      guildData: {
        [guildId]: {
          claimedRoles: admin.firestore.FieldValue.arrayUnion(roleId),
          lastClaimedAt: admin.firestore.FieldValue.serverTimestamp(),
        }
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return res.status(204).end();
  } catch (e: any) {
    console.error("add-role error:", e);
    return res.status(500).json({ error: "Server error." });
  }
}