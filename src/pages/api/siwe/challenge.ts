import type { NextApiRequest, NextApiResponse } from "next";
import { randomBytes } from "crypto";
import * as cookie from "cookie"; // This line is corrected

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const nonce = randomBytes(16).toString("hex");
  res.setHeader("Set-Cookie", cookie.serialize("siwe_nonce", nonce, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: 60 * 10,
  }));
  res.status(200).json({ nonce });
}
