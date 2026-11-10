"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { signInWithEmailAndPassword, signOut, updatePassword } from "firebase/auth";
import { useSession } from "@/components/session-context";
import { useToast } from "@/components/toast";
import { ErrorText, Spinner } from "@/components/ui";
import { api, fetcher } from "@/lib/api-client";
import { ROLE_LABEL } from "@/lib/constants";
import { clientAuth, firebaseErrorMessage } from "@/lib/firebase-client";
import { formatDateTime } from "@/lib/format";
import { usernameToEmail } from "@/lib/username";

export default function AccountPage() {
  const user = useSession();
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">บัญชีของฉัน</h1>
        <p className="text-sm text-neutral-500">
          @{user.username} · {ROLE_LABEL[user.role]}
        </p>
      </div>
      <ProfileForm />
      <PasswordForm />
    </div>
  );
}

function ProfileForm() {
  const user = useSession();
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({ name: user.name, phone: user.phone, email: user.email });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api("/api/account", { method: "PATCH", body: form });
      toast("บันทึกข้อมูลแล้ว");
      router.refresh(); // reload session user in the header
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="card space-y-4 p-5">
      <h2 className="font-bold">ข้อมูลส่วนตัว</h2>
      <div>
        <label className="label" htmlFor="acc-1">ชื่อผู้ใช้</label>
        <input id="acc-1" className="input" value={user.username} disabled />
      </div>
      <div>
        <label className="label" htmlFor="acc-2">ชื่อ-นามสกุล</label>
        <input id="acc-2" className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="acc-3">เบอร์โทร</label>
          <input id="acc-3" className="input" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="acc-4">อีเมล (ติดต่อ)</label>
          <input id="acc-4" className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
      </div>
      <ErrorText>{error}</ErrorText>
      <div className="flex justify-end">
        <button className="btn-primary" disabled={saving}>
          {saving && <Spinner />} บันทึก
        </button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const user = useSession();
  const toast = useToast();
  const history = useSWR<{ history: { changed_at: string; by_self: boolean }[] }>("/api/account/password", fetcher);
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.next.length < 8) return setError("รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร");
    if (form.next !== form.confirm) return setError("ยืนยันรหัสผ่านใหม่ไม่ตรงกัน");
    if (form.next === form.current) return setError("รหัสผ่านใหม่ต้องไม่ซ้ำรหัสผ่านเดิม");
    setSaving(true);
    try {
      // Re-authenticate with the current password, then change it with Firebase.
      const auth = await clientAuth();
      const cred = await signInWithEmailAndPassword(auth, usernameToEmail(user.username), form.current);
      await updatePassword(cred.user, form.next);
      // Firebase revokes old sessions on password change; get a fresh token to keep this device signed in.
      const idToken = await cred.user.getIdToken(true);
      await api("/api/account/password", { method: "POST", body: { idToken } });
      await signOut(auth);
      setForm({ current: "", next: "", confirm: "" });
      toast("เปลี่ยนรหัสผ่านแล้ว อุปกรณ์อื่นจะถูกออกจากระบบ");
      history.mutate();
    } catch (err) {
      setError(
        (err as { code?: string }).code === "auth/invalid-credential" ? "รหัสผ่านปัจจุบันไม่ถูกต้อง" : firebaseErrorMessage(err),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="card space-y-4 p-5">
      <h2 className="font-bold">เปลี่ยนรหัสผ่าน</h2>
      <div>
        <label className="label" htmlFor="acc-5">รหัสผ่านปัจจุบัน</label>
        <input id="acc-5"
          className="input"
          type="password"
          autoComplete="current-password"
          required
          value={form.current}
          onChange={(e) => setForm({ ...form, current: e.target.value })}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="acc-6">รหัสผ่านใหม่</label>
          <input id="acc-6"
            className="input"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={form.next}
            onChange={(e) => setForm({ ...form, next: e.target.value })}
          />
        </div>
        <div>
          <label className="label" htmlFor="acc-7">ยืนยันรหัสผ่านใหม่</label>
          <input id="acc-7"
            className="input"
            type="password"
            autoComplete="new-password"
            required
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          />
        </div>
      </div>
      <ErrorText>{error}</ErrorText>
      <div className="flex justify-end">
        <button className="btn-primary" disabled={saving}>
          {saving && <Spinner />} เปลี่ยนรหัสผ่าน
        </button>
      </div>
      {!!history.data?.history.length && (
        <div className="border-t border-neutral-100 pt-4">
          <p className="mb-2 text-sm font-medium text-neutral-700">ประวัติการเปลี่ยนรหัสผ่าน</p>
          <ul className="space-y-1 text-sm text-neutral-500">
            {history.data.history.map((h) => (
              <li key={h.changed_at}>
                {formatDateTime(h.changed_at)} · {h.by_self ? "เปลี่ยนเอง" : "รีเซ็ตโดยผู้ดูแล"}
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
