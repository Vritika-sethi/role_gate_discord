import jwt from "jsonwebtoken";

// Ensure the JWT_SECRET is loaded from environment variables.
const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is not set!");
}

// Defines the data structure that will be stored in the JWT payload.
type SessionPayload = {
  address: `0x${string}`;
};

// An object to handle JWT session management.
export const session = {
  // Issues a new JWT for a given wallet address.
  issue(address: `0x${string}`) {
    return jwt.sign({ address }, JWT_SECRET, { expiresIn: "7d" });
  },
  // Verifies a JWT and returns the payload if it's valid.
  verify(token: string) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as SessionPayload;
      return { valid: true as const, payload };
    } catch (e: any) {
      return { valid: false as const, error: e?.message ?? "invalid token" };
    }
  },
};