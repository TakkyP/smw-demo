import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/constants";
import type { Role } from "@/types";
import { adminAuth } from "./firebase-admin";
import { collections, type UserDoc } from "./db";
import { HttpError } from "./http";

/**
 * Resolve the logged-in user from the Firebase session cookie.
 * `checkRevoked: true` makes disabled accounts and password changes take effect immediately.
 * Cached per request.
 */
export const getSessionUser = cache(async (): Promise<UserDoc | null> => {
  const store = await cookies();
  const cookie = store.get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(cookie, true);
    const { users } = await collections();
    const user = await users.findOne({ firebase_uid: decoded.uid });
    if (!user || user.status !== "active") return null;
    return user;
  } catch {
    return null;
  }
});

/** For API routes: throws 401/403 instead of returning null. */
export async function requireUser(role?: Role): Promise<UserDoc> {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "กรุณาเข้าสู่ระบบ");
  if (role && user.role !== role) throw new HttpError(403, "ไม่มีสิทธิ์ใช้งานส่วนนี้");
  return user;
}
