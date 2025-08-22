// src/pages/api/link-wallet-discord.ts
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    // Call Firebase Function instead of using firebase-admin
    const response = await fetch(
      "https://us-central1-YOUR_PROJECT.cloudfunctions.net/linkWalletDiscord",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      }
    );

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("API route error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
