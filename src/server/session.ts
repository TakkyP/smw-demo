import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/lib/constants";
import { adminAuth } from "./firebase-admin";
import { collections, type UserDoc } from "./db";
import { HttpError } from "./http";

/**
 * Verify a fresh Firebase ID token, check the matching app user is active,
 * and set the httpOnly session cookie. Used by login and after a password change.
 */
export async function startSession(idToken: string, opts: { maxAuthAgeSec?: number } = {}): Promise<UserDoc> {
  const auth = adminAuth();
  const decoded = await auth.verifyIdToken(idToken, true).catch(() => {
    throw new HttpError(401, "การยืนยันตัวตนไม่สำเร็จ");
  });
  // Only accept recent sign-ins to limit token replay.
  const maxAge = opts.maxAuthAgeSec ?? 5 * 60;
  if (Date.now() / 1000 - decoded.auth_time > maxAge) throw new HttpError(401, "กรุณาเข้าสู่ระบบใหม่");

  const { users } = await collections();
  const user = await users.findOne({ firebase_uid: decoded.uid });
  if (!user) throw new HttpError(403, "ไม่พบบัญชีผู้ใช้ในระบบ");
  if (user.status !== "active") throw new HttpError(403, "บัญชีนี้ถูกปิดการใช้งาน");

  const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
  const store = await cookies();
  store.set(SESSION_COOKIE, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });
  return user;
}

export async function endSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
