// pages/api/check-roles.ts
import type { NextApiRequest, NextApiResponse } from "next";
import cookie from "cookie";
import { db, admin } from "@/lib/firebase";
import { thirdwebClient } from "@/lib/thirdweb";
import { CHAIN, ERC721_ABI} from "@/lib/chain";
import { getContract, readContract } from "thirdweb";

function getWalletsAsArray(walletsData: any): { address: string }[] {
  let walletsArray: any[] = [];
  if (Array.isArray(walletsData)) {
    walletsArray = walletsData;
  } else if (typeof walletsData === 'object' && walletsData !== null) {
    walletsArray = Object.values(walletsData);
  }
  
  return walletsArray.map((w: any) => {
    const address = typeof w === "string" ? w : (w?.address ?? null);
    if (address && typeof address === 'string') {
      return { address };
    }
    return null;
  }).filter(Boolean) as Array<{ address: string }>;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const { guildId } = req.body as { guildId?: string };
    if (!guildId) return res.status(400).json({ error: "Missing guildId" });

    const cookies = cookie.parse(req.headers.cookie || "");
    const discordId = cookies["discord_user_id"];
    if (!discordId) return res.status(401).json({ error: "Discord not linked" });

    // wallets
    const userRef = db.collection("users").doc(discordId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(404).json({ error: "User not found" });

    const userData = userSnap.data()!;
    
    const wallets = getWalletsAsArray(userData.wallets ?? []);

    if (!wallets.length) return res.status(404).json({ error: "No wallets linked" });

    const claimedRoles: string[] = userData.guildData?.[guildId]?.claimedRoles ?? [];

    // load role configs from sub-collection
    const rolesSnap = await db.collection("serverSettings").doc(guildId).collection("roles").get();
    const roleConfigs = rolesSnap.docs.map((d) => d.data());

    const qualifiedRoles: Array<{ roleId: string; roleName: string; required: number; owned: number }> = [];
    const totalBalances: Record<string, bigint> = {}; 

    const contracts = Array.from(new Set(roleConfigs.filter(r => r.linkType !== "free" && r.contractAddress).map(r => r.contractAddress)));

    const contractReaders: Record<string, { type: "erc20" | "erc721"; read: (addr: `0x${string}`) => Promise<bigint> }> = {};
    for (const addr of contracts) {
      const isERC20 = roleConfigs.some(r => r.contractAddress === addr && r.linkType === "token_gated");
      contractReaders[addr] = isERC20
        ? {
            type: "erc20",
            read: async (holder) => {
              const c = getContract({ client: thirdwebClient, chain: CHAIN, address: addr as `0x${string}`, abi: ERC721_ABI });
              const bal = await readContract({ contract: c, method: "balanceOf", params: [holder] });
              return BigInt(bal);
            }
          }
        : {
            type: "erc721",
            read: async (holder) => {
              const c = getContract({ client: thirdwebClient, chain: CHAIN, address: addr as `0x${string}`, abi: ERC721_ABI });
              const bal = await readContract({ contract: c, method: "balanceOf", params: [holder] });
              return BigInt(bal);
            }
          };
    }

    // compute totals per contract
    for (const addr of contracts) {
      let sum = 0n;
      for (const w of wallets) {
        if (!w.address) continue;
        const amount = await contractReaders[addr].read(w.address as `0x${string}`);
        sum += amount;
      }
      totalBalances[addr] = sum;
    }

    for (const cfg of roleConfigs) {
      if (cfg.linkType === "free") {
        qualifiedRoles.push({ roleId: cfg.roleId, roleName: cfg.roleName, required: 0, owned: 0 });
        continue;
      }
      const total = totalBalances[cfg.contractAddress] ?? 0n;
      const meets = total >= BigInt(cfg.requiredCount || 1);
      if (meets) {
        qualifiedRoles.push({
          roleId: cfg.roleId,
          roleName: cfg.roleName,
          required: Number(cfg.requiredCount || 1),
          owned: Number(total),
        });
      }
    }
    
    // NEW LOGIC: Determine if there are any unclaimed roles the user qualifies for
    const unclaimedQualifiedRoles = qualifiedRoles.filter(
      (role) => !claimedRoles.includes(role.roleId)
    );

    await userRef.set({
      [`guildData.${guildId}.lastChecked`]: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.status(200).json({
      wallets: wallets.map((w) => w.address),
      qualifiedRoles,
      claimedRoles,
      qualifies: unclaimedQualifiedRoles.length > 0, // Base the "qualifies" flag on unclaimed roles
    });
  } catch (e: any) {
    console.error("check-roles error:", e);
    res.status(500).json({ error: "Server error" });
  }
}