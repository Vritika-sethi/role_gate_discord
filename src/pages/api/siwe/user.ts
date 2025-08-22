// pages/api/siwe/user.ts
import type { NextApiRequest, NextApiResponse } from "next";
import cookie from "cookie"; // This line was likely missing or incorrect
import { session } from "@/lib/serverAuth";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // This line will now work because 'cookie' is properly imported
  const cookies = cookie.parse(req.headers.cookie || "");
  const jwt = cookies["siwe_jwt"];

  if (!jwt) {
    return res.status(200).json({ loggedIn: false });
  }

  const { valid, payload } = session.verify(jwt);

  if (!valid) {
    return res.status(200).json({ loggedIn: false });
  }

  res.status(200).json({ loggedIn: true, address: payload.address });
}