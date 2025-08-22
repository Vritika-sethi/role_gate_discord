import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { guildId, userId } = req.query;

  const state = Buffer.from(JSON.stringify({ guildId, userId })).toString('base64');

  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID!,
    response_type: "code",
    redirect_uri: process.env.DISCORD_REDIRECT_URI!,
    scope: "identify", // 'guilds' scope is not needed for this flow
    prompt: "consent",
    state: state,
  });
  
  res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
}