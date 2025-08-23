// pages/api/siwe/verify.ts
import type { NextApiRequest, NextApiResponse } from "next";
// Change the import statement to this format
import * as cookie from "cookie";
import { z } from "zod";
import { recoverMessageAddress } from "viem";
import { session } from "@/lib/serverAuth";

const BodySchema = z.object({
  address: z.string().startsWith("0x"),
  signature: z.string().startsWith("0x"),
  message: z.string().min(1),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const parse = BodySchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "Bad request", details: parse.error.format() });

  const { address, signature, message } = parse.data;
  const cookies = cookie.parse(req.headers.cookie || "");
  const nonce = cookies["siwe_nonce"];
  if (!nonce || !message.includes(nonce)) return res.status(400).json({ error: "Nonce mismatch." });

  try {
    const recovered = await recoverMessageAddress({ message, signature: signature as `0x${string}` });
    if (recovered.toLowerCase() !== address.toLowerCase()) return res.status(401).json({ error: "Invalid signature." });

    const jwt = session.issue(address as `0x${string}`);
    res.setHeader("Set-Cookie", [
      cookie.serialize("siwe_jwt", jwt, {
        httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
        path: "/", maxAge: 60 * 60 * 24 * 7,
      }),
      cookie.serialize("siwe_nonce", "", { maxAge: -1, path: "/" }),
    ]);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Verification failed." });
  }
}
