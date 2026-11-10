"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { useToast } from "@/components/toast";
import { EmptyState, ErrorText, Spinner, StatusBadge } from "@/components/ui";
import { IconArchive, IconRestore } from "@/components/icons";
import { api, fetcher } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { assigneeLabel } from "@/lib/task-rules";
import type { AssignedType, TaskDTO, UserDTO } from "@/types";

const EMPTY = {
  title: "",
  description: "",
  location: "",
  due_date: "",
  assigned_type: "all" as AssignedType,
  assigned_user: "",
};

export default function CreateTaskPage() {
  const toast = useToast();
  const tasksSWR = useSWR<{ tasks: TaskDTO[] }>("/api/tasks", fetcher);
  const usersSWR = useSWR<{ users: UserDTO[] }>("/api/users", fetcher);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const employees = useMemo(
    () => (usersSWR.data?.users ?? []).filter((u) => u.role === "employee" && u.status === "active"),
    [usersSWR.data],
  );
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const { task } = await api<{ task: TaskDTO }>("/api/tasks", {
        method: "POST",
        body: {
          ...form,
          due_date: form.due_date || null,
          assigned_user: form.assigned_type === "individual" ? form.assigned_user : null,
        },
      });
      toast(`สร้างงาน ${task.code} แล้ว`);
      setForm(EMPTY);
      tasksSWR.mutate();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleArchive(t: TaskDTO) {
    const action = t.is_archived ? "restore" : "archive";
    if (action === "archive" && !confirm(`ลบงาน ${t.code}? งานจะถูกเก็บถาวรและกู้คืนได้ภายหลัง`)) return;
    setBusyId(t.id);
    try {
      await api(`/api/tasks/${t.id}/${action}`, { method: "POST" });
      toast(action === "archive" ? "เก็บงานถาวรแล้ว" : "กู้คืนงานแล้ว");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusyId(null);
      tasksSWR.mutate();
    }
  }

  const tasks = tasksSWR.data?.tasks ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">เพิ่มรายการงาน</h1>
        <p className="text-sm text-neutral-500">สร้างงานใหม่และมอบหมายให้ทุกคนหรือรายบุคคล</p>
      </div>

      <form onSubmit={submit} className="card space-y-4 p-5">
        <div>
          <label className="label" htmlFor="title">ชื่องาน *</label>
          <input id="title" className="input" required value={form.title} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="desc">รายละเอียดงาน</label>
          <textarea
            id="desc"
            rows={3}
            className="input"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="loc">บริเวณ / พื้นที่ปฏิบัติงาน</label>
            <input id="loc" className="input" value={form.location} onChange={(e) => set("location", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="due">วันที่ครบกำหนด</label>
            <input id="due" type="date" className="input" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} />
          </div>
        </div>

        <fieldset>
          <legend className="label">ผู้รับผิดชอบ *</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["all", "ทุกคน (All Users)", "ทุกคนเห็นงาน แต่รับได้เพียง 1 คน"],
                ["individual", "User รายบุคคล", "มอบหมายให้พนักงานคนเดียว"],
              ] as const
            ).map(([value, label, hint]) => (
              <label
                key={value}
                className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${
                  form.assigned_type === value ? "border-brand-500 bg-brand-50" : "border-neutral-200 hover:border-brand-200"
                }`}
              >
                <input
                  type="radio"
                  name="assigned_type"
                  className="mt-1 accent-brand-600"
                  checked={form.assigned_type === value}
                  onChange={() => set("assigned_type", value)}
                />
                <span>
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="block text-xs text-neutral-500">{hint}</span>
                </span>
              </label>
            ))}
          </div>
          {form.assigned_type === "individual" && (
            <select
              className="input mt-3"
              required
              value={form.assigned_user}
              onChange={(e) => set("assigned_user", e.target.value)}
            >
              <option value="">— เลือกพนักงาน —</option>
              {employees.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.username})
                </option>
              ))}
            </select>
          )}
        </fieldset>

        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end">
          <button className="btn-primary w-full sm:w-auto" disabled={saving}>
            {saving && <Spinner />} บันทึกงาน
          </button>
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">รายการงานทั้งหมดที่เคยสร้าง ({tasks.length})</h2>
        {tasksSWR.isLoading ? (
          <div className="flex justify-center py-10 text-brand-600">
            <Spinner className="h-6 w-6" />
          </div>
        ) : tasks.length === 0 ? (
          <EmptyState title="ยังไม่มีงาน" hint="เริ่มสร้างงานแรกจากฟอร์มด้านบน" />
        ) : (
          <>
            {/* Desktop table */}
            <div className="card hidden overflow-hidden md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-brand-600 text-white">
                  <tr>
                    {["รหัส", "ชื่องาน", "พื้นที่", "ผู้รับผิดชอบ", "ครบกำหนด", "สถานะ", ""].map((h) => (
                      <th key={h} className="px-4 py-3 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {tasks.map((t) => (
                    <tr key={t.id} className={`hover:bg-brand-50/40 ${t.is_archived ? "text-neutral-400" : ""}`}>
                      <td className="whitespace-nowrap px-4 py-3 font-medium">{t.code}</td>
                      <td className="px-4 py-3">
                        <Link href={`/tasks/${t.id}`} className="font-medium hover:text-brand-700 hover:underline">
                          {t.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{t.location || "-"}</td>
                      <td className="px-4 py-3">{assigneeLabel(t)}</td>
                      <td className="whitespace-nowrap px-4 py-3">{formatDate(t.due_date)}</td>
                      <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <ArchiveButton task={t} busy={busyId === t.id} onClick={() => toggleArchive(t)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile list */}
            <div className="space-y-2 md:hidden">
              {tasks.map((t) => (
                <div key={t.id} className={`card p-4 ${t.is_archived ? "opacity-70" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/tasks/${t.id}`} className="min-w-0">
                      <p className="text-xs text-neutral-400">{t.code}</p>
                      <p className="font-semibold">{t.title}</p>
                    </Link>
                    <StatusBadge status={t.status} />
                  </div>
                  <p className="mt-1 text-sm text-neutral-600">
                    {t.location || "-"} · {assigneeLabel(t)}
                  </p>
                  <div className="mt-3 flex justify-end">
                    <ArchiveButton task={t} busy={busyId === t.id} onClick={() => toggleArchive(t)} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function ArchiveButton({ task, busy, onClick }: { task: TaskDTO; busy: boolean; onClick: () => void }) {
  return task.is_archived ? (
    <button className="btn-outline btn-sm" disabled={busy} onClick={onClick}>
      {busy ? <Spinner /> : <IconRestore width={14} height={14} />} กู้คืน
    </button>
  ) : (
    <button className="btn-ghost btn-sm text-brand-700" disabled={busy} onClick={onClick}>
      {busy ? <Spinner /> : <IconArchive width={14} height={14} />} ลบ
    </button>
  );
}
