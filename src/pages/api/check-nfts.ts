import type { NextApiRequest, NextApiResponse } from "next";
import * as cookie from "cookie";
import { getContract, readContract } from "thirdweb";
import { thirdwebClient } from "@/lib/thirdweb";
import { CHAIN, ERC721_ABI } from "@/lib/chain";
import { db, admin } from "@/lib/firebase";

type RoleConfig = {
  roleId: string;
  roleName: string;
  linkType: string;
  contractAddress?: `0x${string}`;
  requiredCount: number;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { guildId } = req.body;
    if (!guildId) return res.status(400).json({ error: "Missing guildId." });

    const cookies = cookie.parse(req.headers.cookie || "");
    const discordId = cookies["discord_user_id"];
    if (!discordId) return res.status(401).json({ error: "Discord account not linked." });

    const userDocRef = db.collection("users").doc(discordId);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists || !userDoc.data()?.wallets) {
      return res.status(404).json({ error: "No wallets linked to your account." });
    }
    const userData = userDoc.data()!;
    const userWallets = userData.wallets || [];
    const claimedRoles = userData.guildData?.[guildId]?.claimedRoles || [];
    
    const serverSettingsDoc = await db.collection("serverSettings").doc(guildId).get();
    if (!serverSettingsDoc.exists) {
      return res.status(404).json({ error: "This server has no NFT roles configured." });
    }
    const roleConfigs = serverSettingsDoc.data()?.roles || [];

    const qualifiedRoles = [];
    const updatedWallets = [...userWallets];
    const totalBalances: { [contractAddress: string]: bigint } = {};

    for (const wallet of updatedWallets) {
        wallet.nfts = [];
        for (const config of roleConfigs) {
            if (config.linkType !== "nft_gated") continue;
            
            const contract = getContract({
                client: thirdwebClient,
                chain: CHAIN,
                address: config.contractAddress as `0x${string}`,
                abi: ERC721_ABI,
            });

            try {
                const balance = await readContract({ contract, method: "balanceOf", params: [wallet.address as `0x${string}`] });
                if (balance > 0n) {
                    wallet.nfts.push({ contract: config.contractAddress, balance: Number(balance) });
                    totalBalances[config.contractAddress as string] = (totalBalances[config.contractAddress as string] || 0n) + balance;
                }
            } catch (err) {
                console.error(`Error checking balance for ${wallet.address} on ${config.contractAddress}:`, err);
            }
        }
    }

    for (const config of roleConfigs) {
      if (config.linkType === "nft_gated") {
        const totalOwned = totalBalances[config.contractAddress as string] || 0n;
        if (totalOwned >= BigInt(config.requiredCount)) {
            qualifiedRoles.push({ roleId: config.roleId, roleName: config.roleName, required: config.requiredCount, owned: Number(totalOwned) });
        }
      } else {
        qualifiedRoles.push({ roleId: config.roleId, roleName: config.roleName, required: 0, owned: 0 });
      }
    }

    await userDocRef.update({
        wallets: updatedWallets,
        [`guildData.${guildId}.lastChecked`]: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({
      wallets: updatedWallets.map(w => w.address),
      qualifiedRoles,
      claimedRoles,
      qualifies: qualifiedRoles.length > 0,
    });
  } catch (e: any) {
    console.error("Check NFTs error:", e);
    res.status(500).json({ error: "An internal server error occurred." });
  }
}
