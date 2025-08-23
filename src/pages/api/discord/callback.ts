// pages/api/discord/callback.ts
import type { NextApiRequest, NextApiResponse } from "next";
import * as cookie from "cookie"; // This line is corrected

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, state } = req.query;
  if (!code || typeof code !== "string") return res.status(400).send("Missing code.");

  try {
    const { guildId, userId } = JSON.parse(Buffer.from(state as string, "base64").toString("ascii"));

    const body = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID!,
      client_secret: process.env.DISCORD_CLIENT_SECRET!,
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.DISCORD_REDIRECT_URI!,
    });

    const tokenResp = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!tokenResp.ok) throw new Error("Token exchange failed");
    const tok = await tokenResp.json();

    const userResp = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });
    if (!userResp.ok) throw new Error("User fetch failed");
    const user = (await userResp.json()) as { id: string };

    if (user.id !== userId) return res.status(403).send("Discord user mismatch. Start from /verify again.");

    res.setHeader("Set-Cookie", cookie.serialize("discord_user_id", user.id, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
      path: "/", maxAge: 60 * 60 * 24 * 7,
    }));
    res.redirect(`/?guildId=${guildId}`);
  } catch (e: any) {
    console.error("Discord callback error:", e);
    res.status(500).send(e?.message ?? "Error");
  }
}
