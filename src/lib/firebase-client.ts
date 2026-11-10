"use client";
import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, inMemoryPersistence, setPersistence, type Auth } from "firebase/auth";

let auth: Auth | null = null;

/**
 * Firebase is only used in the browser to verify the password and obtain an ID token.
 * The token is exchanged for an httpOnly session cookie, so nothing is persisted client-side.
 */
export async function clientAuth(): Promise<Auth> {
  if (auth) return auth;
  const app = getApps().length
    ? getApp()
    : initializeApp({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "demo-key",
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-worklist",
      });
  auth = getAuth(app);
  const emulator = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
  if (emulator) connectAuthEmulator(auth, `http://${emulator}`, { disableWarnings: true });
  await setPersistence(auth, inMemoryPersistence);
  return auth;
}

export function firebaseErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง";
    case "auth/user-disabled":
      return "บัญชีนี้ถูกปิดการใช้งาน";
    case "auth/too-many-requests":
      return "พยายามเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่";
    case "auth/weak-password":
      return "รหัสผ่านใหม่ง่ายเกินไป";
    case "auth/network-request-failed":
      return "เชื่อมต่อเครือข่ายไม่ได้";
    default:
      return (err as Error)?.message || "เกิดข้อผิดพลาด";
  }
}
