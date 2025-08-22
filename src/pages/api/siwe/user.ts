
import type { NextApiRequest, NextApiResponse } from "next";
import { session } from "@/lib/serverAuth";
import cookie from "cookie";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Parse cookies to find the session JWT.
  const cookies = cookie.parse(req.headers.cookie || "");
  const jwt = cookies["siwe_jwt"];

  if (!jwt) {
    return res.status(200).json({ loggedIn: false });
  }

  // Verify the JWT to check if the session is valid.
  const { valid, payload } = session.verify(jwt);
  if (!valid) {
    return res.status(200).json({ loggedIn: false });
  }

  // If valid, return the logged-in status and the user's address.
  res.status(200).json({ loggedIn: true, address: payload.address });
}