// pages/api/discord/status.ts
import type { NextApiRequest, NextApiResponse } from "next";
// Change the import statement to this format
import * as cookie from "cookie";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const cookies = cookie.parse(req.headers.cookie || "");
  const isLinked = !!cookies["discord_user_id"];
  res.status(200).json({ linked: isLinked });
}