"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { ErrorText, Spinner } from "@/components/ui";
import { api } from "@/lib/api-client";
import { clientAuth, firebaseErrorMessage } from "@/lib/firebase-client";
import { usernameToEmail } from "@/lib/username";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const auth = await clientAuth();
      const cred = await signInWithEmailAndPassword(auth, usernameToEmail(username), password);
      const idToken = await cred.user.getIdToken();
      await api("/api/auth/session", { method: "POST", body: { idToken } });
      await signOut(auth); // the httpOnly session cookie is now the only credential
      router.replace("/tasks");
      router.refresh();
    } catch (err) {
      setError(firebaseErrorMessage(err));
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-white sm:flex-row">
      <div className="flex flex-col justify-end bg-brand-600 px-6 pb-10 pt-16 text-white sm:w-1/2 sm:justify-center sm:px-14">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl font-bold text-brand-600">
          ✓
        </div>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">Worklist Management</h1>
        <p className="mt-2 text-white/85">ระบบติดตามและตรวจสอบงานที่มอบหมาย</p>
      </div>
      <div className="flex flex-1 items-start justify-center px-6 py-10 sm:items-center">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
          <h2 className="text-xl font-bold">เข้าสู่ระบบ</h2>
          <div>
            <label className="label" htmlFor="username">ชื่อผู้ใช้</label>
            <input
              id="username"
              className="input"
              autoComplete="username"
              autoCapitalize="none"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="password">รหัสผ่าน</label>
            <input
              id="password"
              type="password"
              className="input"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <ErrorText>{error}</ErrorText>
          <button className="btn-primary w-full py-3" disabled={loading}>
            {loading && <Spinner />} เข้าสู่ระบบ
          </button>
          <p className="text-center text-xs text-neutral-500">ลืมรหัสผ่าน? ติดต่อผู้ดูแลระบบ (Employer) เพื่อรีเซ็ต</p>
        </form>
      </div>
    </div>
  );
}
