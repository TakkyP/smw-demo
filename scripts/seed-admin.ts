/**
 * Create (or repair) the first Employer account in Firebase Auth + MongoDB.
 *
 *   npm run seed:admin
 *
 * Reads SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD / SEED_ADMIN_NAME and the normal app env from .env.local.
 * Safe to run more than once.
 */
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { MongoClient, ObjectId } from "mongodb";

async function main() {
  const username = (process.env.SEED_ADMIN_USERNAME || "admin").trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME || "ผู้ดูแลระบบ";
  const domain = process.env.NEXT_PUBLIC_USERNAME_EMAIL_DOMAIN || "worklist.local";
  if (!password || password.length < 8) throw new Error("SEED_ADMIN_PASSWORD must be at least 8 characters");

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const app =
    process.env.FIREBASE_AUTH_EMULATOR_HOST && !privateKey
      ? initializeApp({ projectId: projectId || "demo-worklist" })
      : initializeApp({
          credential: cert({ projectId, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey }),
        });
  const auth = getAuth(app);

  const email = `${username}@${domain}`;
  let uid: string;
  try {
    uid = (await auth.getUserByEmail(email)).uid;
    console.log(`Firebase user ${email} already exists (${uid})`);
  } catch {
    uid = (await auth.createUser({ email, password, displayName: name })).uid;
    console.log(`Created Firebase user ${email} (${uid})`);
  }

  const client = await new MongoClient(process.env.MONGODB_URI!).connect();
  try {
    const users = client.db(process.env.MONGODB_DB || "worklist").collection("users");
    const now = new Date();
    await users.updateOne(
      { username },
      {
        $set: { firebase_uid: uid, role: "employer", status: "active", updated_at: now },
        $setOnInsert: { _id: new ObjectId(), username, name, phone: "", email: "", created_at: now },
      },
      { upsert: true },
    );
    console.log(`MongoDB user "${username}" is an active employer. You can now log in.`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
