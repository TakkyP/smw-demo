"use client";
import { useState } from "react";
import useSWR from "swr";
import { useSession } from "@/components/session-context";
import { useToast } from "@/components/toast";
import { ErrorText, Modal, Spinner } from "@/components/ui";
import { IconPlus } from "@/components/icons";
import { api, fetcher } from "@/lib/api-client";
import { ROLE_LABEL } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { Role, UserDTO, UserStatus } from "@/types";

type Editing = { mode: "create" } | { mode: "edit"; user: UserDTO } | null;

export default function UsersPage() {
  const me = useSession();
  const toast = useToast();
  const { data, isLoading, error, mutate } = useSWR<{ users: UserDTO[] }>("/api/users", fetcher);
  const [editing, setEditing] = useState<Editing>(null);
  const users = data?.users ?? [];

  async function toggleStatus(u: UserDTO) {
    const status: UserStatus = u.status === "active" ? "inactive" : "active";
    if (status === "inactive" && !confirm(`ปิดการใช้งานบัญชี ${u.name}? ผู้ใช้จะถูกออกจากระบบทันที`)) return;
    try {
      await api(`/api/users/${u.id}`, { method: "PATCH", body: { status } });
      toast(status === "active" ? "เปิดการใช้งานแล้ว" : "ปิดการใช้งานแล้ว");
      mutate();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">จัดการบุคคล</h1>
          <p className="text-sm text-neutral-500">เพิ่ม แก้ไข ปิดการใช้งาน และกำหนดสิทธิ์ผู้ใช้</p>
        </div>
        <button className="btn-primary" onClick={() => setEditing({ mode: "create" })}>
          <IconPlus width={18} height={18} /> เพิ่มผู้ใช้
        </button>
      </div>

      {error && <ErrorText>{error.message}</ErrorText>}
      {isLoading ? (
        <div className="flex justify-center py-16 text-brand-600">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {users.map((u) => (
            <div key={u.id} className={`card p-4 ${u.status === "inactive" ? "opacity-60" : ""}`}>
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">
                  {u.name.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {u.name} {u.id === me.id && <span className="text-xs font-normal text-neutral-400">(คุณ)</span>}
                  </p>
                  <p className="truncate text-sm text-neutral-500">@{u.username}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        u.role === "employer" ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700"
                      }`}
                    >
                      {u.role === "employer" ? "Employer" : "Employee"}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        u.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"
                      }`}
                    >
                      {u.status === "active" ? "ใช้งาน" : "ปิดการใช้งาน"}
                    </span>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-xs text-neutral-400">
                {u.phone && `${u.phone} · `}สร้างเมื่อ {formatDate(u.created_at)}
              </p>
              <div className="mt-3 flex gap-2 border-t border-neutral-100 pt-3">
                <button className="btn-outline btn-sm flex-1" onClick={() => setEditing({ mode: "edit", user: u })}>
                  แก้ไข
                </button>
                {u.id !== me.id && (
                  <button className="btn-ghost btn-sm flex-1" onClick={() => toggleStatus(u)}>
                    {u.status === "active" ? "ปิดการใช้งาน" : "เปิดการใช้งาน"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <UserFormModal
          key={editing.mode === "edit" ? editing.user.id : "new"}
          editing={editing}
          isSelf={editing.mode === "edit" && editing.user.id === me.id}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            mutate();
          }}
        />
      )}
    </div>
  );
}

function UserFormModal({
  editing,
  isSelf,
  onClose,
  onSaved,
}: {
  editing: NonNullable<Editing>;
  isSelf: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const existing = editing.mode === "edit" ? editing.user : null;
  const [form, setForm] = useState({
    username: existing?.username ?? "",
    name: existing?.name ?? "",
    phone: existing?.phone ?? "",
    email: existing?.email ?? "",
    role: (existing?.role ?? "employee") as Role,
    password: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (existing) {
        const { username: _u, password, ...rest } = form;
        void _u;
        await api(`/api/users/${existing.id}`, { method: "PATCH", body: { ...rest, ...(password && { password }) } });
        toast("บันทึกข้อมูลผู้ใช้แล้ว");
      } else {
        await api("/api/users", { method: "POST", body: form });
        toast(`เพิ่มผู้ใช้ ${form.username} แล้ว`);
      }
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={existing ? `แก้ไขผู้ใช้: ${existing.name}` : "เพิ่มผู้ใช้ใหม่"}>
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="label" htmlFor="usr-1">ชื่อผู้ใช้ (Username) *</label>
          <input id="usr-1"
            className="input"
            required
            disabled={!!existing}
            autoCapitalize="none"
            pattern="[a-zA-Z0-9._\-]{3,32}"
            title="a-z, 0-9, . _ - ความยาว 3-32 ตัว"
            value={form.username}
            onChange={(e) => set("username", e.target.value)}
          />
          {!existing && <p className="mt-1 text-xs text-neutral-500">ใช้สำหรับเข้าสู่ระบบ เปลี่ยนภายหลังไม่ได้</p>}
        </div>
        <div>
          <label className="label" htmlFor="usr-2">ชื่อ-นามสกุล *</label>
          <input id="usr-2" className="input" required value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="usr-3">เบอร์โทร</label>
            <input id="usr-3" className="input" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="usr-4">อีเมล (ติดต่อ)</label>
            <input id="usr-4" className="input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="usr-5">สิทธิ์ (Role) *</label>
          <select id="usr-5" className="input" value={form.role} disabled={isSelf} onChange={(e) => set("role", e.target.value as Role)}>
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="usr-6">{existing ? "ตั้งรหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)" : "รหัสผ่านเริ่มต้น *"}</label>
          <input id="usr-6"
            className="input"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required={!existing}
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
          />
          <p className="mt-1 text-xs text-neutral-500">อย่างน้อย 8 ตัวอักษร ผู้ใช้เปลี่ยนเองได้ในหน้าบัญชี</p>
        </div>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            ยกเลิก
          </button>
          <button className="btn-primary" disabled={saving}>
            {saving && <Spinner />} บันทึก
          </button>
        </div>
      </form>
    </Modal>
  );
}
