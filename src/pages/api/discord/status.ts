
import type { NextApiRequest, NextApiResponse } from "next";
import cookie from "cookie";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Parse cookies from the request headers.
  const cookies = cookie.parse(req.headers.cookie || "");
  
  // Check if the 'discord_user_id' cookie exists.
  const isLinked = !!cookies["discord_user_id"];
  
  // Respond with the linked status.
  res.status(200).json({ linked: isLinked });
}