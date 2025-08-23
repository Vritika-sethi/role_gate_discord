// pages/api/siwe/logout.ts
import type { NextApiRequest, NextApiResponse } from "next";
import * as cookie from "cookie";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Clear the session cookie by setting its expiration date to the past
  res.setHeader("Set-Cookie", cookie.serialize("siwe_jwt", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: -1, // This effectively deletes the cookie
  }));

  res.status(200).json({ message: "Logged out successfully" });
}
