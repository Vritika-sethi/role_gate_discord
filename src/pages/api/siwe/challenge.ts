
import type { NextApiRequest, NextApiResponse } from "next";
import { randomBytes } from "crypto";
import cookie from "cookie";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }

  // Generate a secure, random nonce for the SIWE challenge.
  const nonce = randomBytes(16).toString("hex");

  // Store the nonce in a temporary, secure cookie that expires in 10 minutes.
  res.setHeader(
    "Set-Cookie",
    cookie.serialize("siwe_nonce", nonce, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10, // 10 minutes
    }),
  );

  res.status(200).json({ nonce });
}