"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { IconArchive, IconArrowLeft, IconCheck, IconRestore, IconX } from "@/components/icons";
import { ImageUploader } from "@/components/image-uploader";
import { useSession } from "@/components/session-context";
import { useToast } from "@/components/toast";
import { ErrorText, Lightbox, Modal, Spinner, StatusBadge } from "@/components/ui";
import { api, fetcher } from "@/lib/api-client";
import { formatDate, formatDateTime, isOverdue, toDateInput } from "@/lib/format";
import { assigneeLabel, canClaim, canReview, canStart, canSubmit } from "@/lib/task-rules";
import type { SubmissionDTO, TaskAction, TaskDetailDTO } from "@/types";

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useSession();
  const toast = useToast();
  const { data, error, isLoading, mutate } = useSWR<{ task: TaskDetailDTO }>(`/api/tasks/${id}`, fetcher);
  const [busy, setBusy] = useState<TaskAction | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  async function act(action: TaskAction, body?: unknown, success?: string) {
    setBusy(action);
    try {
      await api(`/api/tasks/${id}/${action}`, { method: "POST", body: body ?? {} });
      if (success) toast(success);
      await mutate();
      return true;
    } catch (e) {
      toast((e as Error).message, "error");
      await mutate();
      return false;
    } finally {
      setBusy(null);
    }
  }

  if (isLoading)
    return (
      <div className="flex justify-center py-20 text-brand-600">
        <Spinner className="h-6 w-6" />
      </div>
    );
  if (error || !data)
    return (
      <div className="space-y-4">
        <BackLink />
        <ErrorText>{error?.message ?? "ไม่พบงาน"}</ErrorText>
      </div>
    );

  const task = data.task;
  const latest = task.submissions[0];
  const overdue = isOverdue(task.due_date, task.status);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <BackLink />

      {/* Header + details */}
      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-neutral-400">{task.code}</p>
            <h1 className="mt-0.5 text-xl font-bold sm:text-2xl">{task.title}</h1>
          </div>
          <StatusBadge status={task.status} />
        </div>
        {task.description && <p className="mt-3 whitespace-pre-wrap text-neutral-700">{task.description}</p>}
        <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Info label="พื้นที่ปฏิบัติงาน" value={task.location || "-"} />
          <Info
            label="วันที่ครบกำหนด"
            value={
              <span className={overdue ? "font-semibold text-brand-700" : ""}>
                {formatDate(task.due_date)}
                {overdue && " · เกินกำหนด"}
              </span>
            }
          />
          <Info label="ประเภทการมอบหมาย" value={task.assigned_type === "all" ? "ทุกคน (All Users)" : "รายบุคคล"} />
          <Info label="ผู้รับผิดชอบ" value={assigneeLabel(task)} />
          <Info label="สร้างโดย" value={`${task.created_by?.name ?? "-"} · ${formatDateTime(task.created_at)}`} />
          {task.claimed_at && <Info label="รับงานเมื่อ" value={formatDateTime(task.claimed_at)} />}
        </dl>

        {user.role === "employer" && (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
            {!task.is_archived && (
              <button className="btn-outline btn-sm" onClick={() => setEditOpen(true)}>
                แก้ไขงาน
              </button>
            )}
            {task.is_archived ? (
              <button className="btn-primary btn-sm" disabled={!!busy} onClick={() => act("restore", {}, "กู้คืนงานแล้ว")}>
                {busy === "restore" ? <Spinner /> : <IconRestore width={16} height={16} />} กู้คืนงาน (Restore)
              </button>
            ) : (
              <button
                className="btn-outline btn-sm"
                disabled={!!busy}
                onClick={() => {
                  if (confirm("ลบงานนี้? งานจะถูกเก็บถาวร (Archived) และกู้คืนได้ภายหลัง"))
                    act("archive", {}, "เก็บงานถาวรแล้ว");
                }}
              >
                {busy === "archive" ? <Spinner /> : <IconArchive width={16} height={16} />} ลบงาน
              </button>
            )}
          </div>
        )}
      </section>

      {/* Employee actions */}
      {canClaim(task, user) && (
        <section className="card p-5">
          <p className="mb-3 text-sm text-neutral-600">งานนี้เปิดให้รับได้ เมื่อรับแล้วผู้อื่นจะรับซ้ำไม่ได้</p>
          <button className="btn-primary w-full sm:w-auto" disabled={!!busy} onClick={() => act("claim", {}, "รับงานแล้ว")}>
            {busy === "claim" && <Spinner />} รับงาน (Claim)
          </button>
        </section>
      )}
      {user.role === "employee" && task.assigned_type === "all" && task.assigned_user && task.assigned_user.id !== user.id && (
        <section className="card bg-neutral-50 p-4 text-sm text-neutral-600">
          งานนี้มีผู้รับแล้ว: <b>{task.assigned_user.name}</b>
        </section>
      )}
      {canStart(task, user) && (
        <section className="card p-5">
          <button className="btn-outline w-full sm:w-auto" disabled={!!busy} onClick={() => act("start", {}, "เริ่มดำเนินการแล้ว")}>
            {busy === "start" && <Spinner />} เริ่มดำเนินการ (In Progress)
          </button>
        </section>
      )}
      {canSubmit(task, user) && (
        <SubmitForm
          rejectedNote={task.status === "Rejected" ? latest?.review_note : undefined}
          busy={busy === "submit"}
          onSubmit={(body) => act("submit", body, "ส่งงานแล้ว รอตรวจสอบ")}
        />
      )}

      {/* Employer review */}
      {canReview(task, user) && latest && (
        <ReviewPanel
          submission={latest}
          busy={busy === "review"}
          onOpenImage={setLightbox}
          onReview={(decision, note) =>
            act("review", { decision, note }, decision === "Approved" ? "อนุมัติงานแล้ว" : "ส่งกลับแก้ไขแล้ว")
          }
        />
      )}

      {/* Submission history */}
      <section className="card p-5">
        <h2 className="mb-4 font-bold">ประวัติการส่งงาน ({task.submissions.length})</h2>
        {task.submissions.length === 0 ? (
          <p className="text-sm text-neutral-500">ยังไม่มีการส่งงาน</p>
        ) : (
          <ol className="relative space-y-5 border-l-2 border-brand-100 pl-5">
            {task.submissions.map((s, i) => (
              <li key={s.id} className="relative">
                <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand-600 ring-2 ring-brand-100" />
                <SubmissionView submission={s} index={task.submissions.length - i} onOpenImage={setLightbox} />
              </li>
            ))}
          </ol>
        )}
      </section>

      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
      {user.role === "employer" && (
        <EditTaskModal open={editOpen} onClose={() => setEditOpen(false)} task={task} onSaved={() => mutate()} />
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/tasks" className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-brand-700">
      <IconArrowLeft width={16} height={16} /> กลับไปรายการงาน
    </Link>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-neutral-800">{value}</dd>
    </div>
  );
}

const REVIEW_STYLE = {
  Pending: "bg-brand-50 text-brand-700",
  Approved: "bg-emerald-50 text-emerald-700",
  Rejected: "bg-brand-900 text-white",
} as const;
const REVIEW_LABEL = { Pending: "รอตรวจสอบ", Approved: "อนุมัติ", Rejected: "ส่งกลับแก้ไข" } as const;

function ImageGrid({ urls, onOpen }: { urls: string[]; onOpen: (u: string) => void }) {
  if (!urls.length) return null;
  return (
    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
      {urls.map((u) => (
        <button key={u} onClick={() => onOpen(u)} className="aspect-square overflow-hidden rounded-xl bg-neutral-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={u} alt="" loading="lazy" className="h-full w-full object-cover transition hover:scale-105" />
        </button>
      ))}
    </div>
  );
}

function SubmissionView({
  submission: s,
  index,
  onOpenImage,
}: {
  submission: SubmissionDTO;
  index: number;
  onOpenImage: (u: string) => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">ครั้งที่ {index}</span>
        <span className="text-neutral-500">
          {s.user?.name} · {formatDateTime(s.submitted_at)}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${REVIEW_STYLE[s.review_status]}`}>
          {REVIEW_LABEL[s.review_status]}
        </span>
      </div>
      {s.note && <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-700">{s.note}</p>}
      <ImageGrid urls={s.image_urls} onOpen={onOpenImage} />
      {s.reviewed_at && (
        <div className="mt-3 rounded-xl bg-neutral-50 px-3 py-2 text-sm">
          <p className="text-xs text-neutral-500">
            ตรวจโดย {s.reviewed_by?.name} · {formatDateTime(s.reviewed_at)}
          </p>
          {s.review_note && <p className="mt-1 whitespace-pre-wrap text-neutral-700">{s.review_note}</p>}
        </div>
      )}
    </div>
  );
}

function SubmitForm({
  rejectedNote,
  busy,
  onSubmit,
}: {
  rejectedNote?: string;
  busy: boolean;
  onSubmit: (body: { note: string; image_urls: string[] }) => Promise<boolean>;
}) {
  const [note, setNote] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim() && images.length === 0) return setError("กรุณาแนบรูปภาพหรือเพิ่มหมายเหตุ");
    setError("");
    if (await onSubmit({ note, image_urls: images })) {
      setNote("");
      setImages([]);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 border-brand-200 p-5">
      <h2 className="font-bold">ส่งงาน</h2>
      {rejectedNote && (
        <div className="rounded-xl bg-brand-50 p-3 text-sm text-brand-800">
          <p className="font-semibold">ถูกส่งกลับแก้ไข</p>
          <p className="mt-1 whitespace-pre-wrap">{rejectedNote}</p>
        </div>
      )}
      <div>
        <span className="label">รูปภาพประกอบ</span>
        <ImageUploader value={images} onChange={setImages} onBusyChange={setUploading} />
      </div>
      <div>
        <label className="label" htmlFor="note">หมายเหตุ</label>
        <textarea
          id="note"
          rows={3}
          className="input"
          placeholder="รายละเอียดการปฏิบัติงาน ปัญหาที่พบ ฯลฯ"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <ErrorText>{error}</ErrorText>
      <button className="btn-primary w-full sm:w-auto" disabled={busy || uploading}>
        {(busy || uploading) && <Spinner />} {uploading ? "กำลังอัปโหลดรูป..." : "ส่งงาน (Submit)"}
      </button>
    </form>
  );
}

function ReviewPanel({
  submission,
  busy,
  onOpenImage,
  onReview,
}: {
  submission: SubmissionDTO;
  busy: boolean;
  onOpenImage: (u: string) => void;
  onReview: (decision: "Approved" | "Rejected", note: string) => Promise<boolean>;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  return (
    <section className="card space-y-4 border-2 border-brand-600 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-brand-700">ตรวจสอบงานที่ส่ง</h2>
        <span className="text-xs text-neutral-500">{formatDateTime(submission.submitted_at)}</span>
      </div>
      <p className="text-sm">
        ส่งโดย <b>{submission.user?.name}</b>
      </p>
      {submission.note ? (
        <p className="whitespace-pre-wrap rounded-xl bg-neutral-50 p-3 text-sm text-neutral-700">{submission.note}</p>
      ) : (
        <p className="text-sm text-neutral-400">(ไม่มีหมายเหตุ)</p>
      )}
      <ImageGrid urls={submission.image_urls} onOpen={onOpenImage} />
      <div>
        <label className="label" htmlFor="review-note">ความเห็นผู้ตรวจ (จำเป็นเมื่อส่งกลับแก้ไข)</label>
        <textarea id="review-note" rows={2} className="input" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <ErrorText>{error}</ErrorText>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <button className="btn-primary" disabled={busy} onClick={() => onReview("Approved", note)}>
          {busy ? <Spinner /> : <IconCheck width={16} height={16} />} อนุมัติ
        </button>
        <button
          className="btn-outline"
          disabled={busy}
          onClick={() => {
            if (!note.trim()) return setError("กรุณาระบุเหตุผลที่ส่งกลับแก้ไข");
            setError("");
            onReview("Rejected", note);
          }}
        >
          <IconX width={16} height={16} /> ส่งกลับแก้ไข
        </button>
      </div>
    </section>
  );
}

function EditTaskModal({
  open,
  onClose,
  task,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  task: TaskDetailDTO;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    title: task.title,
    description: task.description,
    location: task.location,
    due_date: toDateInput(task.due_date),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api(`/api/tasks/${task.id}`, { method: "PATCH", body: { ...form, due_date: form.due_date || null } });
      toast("บันทึกแล้ว");
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`แก้ไขงาน ${task.code}`}>
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="label" htmlFor="edit-1">ชื่องาน</label>
          <input id="edit-1" className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="edit-2">รายละเอียดงาน</label>
          <textarea id="edit-2"
            className="input"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="edit-3">พื้นที่</label>
            <input id="edit-3" className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="edit-4">วันที่ครบกำหนด</label>
            <input id="edit-4"
              type="date"
              className="input"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </div>
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
