// lib/firebase.ts
import * as admin from "firebase-admin";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config({path: ".env.local"});
console.log(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON as string)
const serviceAccountPath = JSON.parse(
  Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON!, "base64").toString("utf-8")
);
// const serviceAccountPath = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON as string);
// if (!fs.existsSync(serviceAccountPath)) {
//   console.error("❌ Missing serviceAccountKey.json at project root.");
//   process.exit(1);
// }
console.log(serviceAccountPath)
// console.log(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
// const serviceAccount = require("../../serviceAccountKey.json");

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountPath),
    });
    console.log("✅ Firestore initialized");
  } catch (err: any) {
    console.error("❌ Firestore init failed:", err?.message);
    process.exit(1);
  }
}

export const db = admin.firestore();
export { admin };