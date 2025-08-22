import * as admin from "firebase-admin";
import fs from "fs";

// IMPORTANT: Make sure the path to your service account key is correct.
// This path is relative to the root of your project where you run the 'next dev' command.
const serviceAccountPath = "./serviceAccountKey.json";

if (!fs.existsSync(serviceAccountPath)) {
  console.error("❌ CRITICAL: Missing serviceAccountKey.json in the project root!");
  console.error("❌ The application will not be able to connect to Firestore.");
  process.exit(1);
}

const serviceAccount = require("../../serviceAccountKey.json");

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("✅ Firestore initialized successfully.");
  } catch (error: any) {
    console.error("❌ Firestore initialization failed:", error.message);
    process.exit(1);
  }
}

export const db = admin.firestore();
export { admin }; // Export the admin namespace
