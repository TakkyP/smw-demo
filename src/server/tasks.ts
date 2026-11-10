import "server-only";
import { ObjectId, type Filter } from "mongodb";
import { z } from "zod";
import { MAX_IMAGES_PER_SUBMISSION } from "@/lib/constants";
import type { TaskStatus } from "@/types";
import { collections, imageBucket, nextTaskCode, toObjectId, type TaskDoc, type UserDoc } from "./db";
import { HttpError } from "./http";

// ---------- Validation schemas ----------

const dueDate = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v, ctx) => {
    if (v === undefined) return undefined; // not provided: leave unchanged on update
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "วันที่ไม่ถูกต้อง" });
      return z.NEVER;
    }
    return d;
  });

export const createTaskSchema = z
  .object({
    title: z.string().trim().min(1, "กรุณากรอกชื่องาน").max(200),
    description: z.string().trim().max(5000).default(""),
    location: z.string().trim().max(200).default(""),
    due_date: dueDate,
    assigned_type: z.enum(["all", "individual"]),
    assigned_user: z.string().optional().nullable(),
  })
  .refine((v) => v.assigned_type === "all" || !!v.assigned_user, {
    message: "กรุณาเลือกผู้รับผิดชอบ",
    path: ["assigned_user"],
  });

export const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5000).optional(),
  location: z.string().trim().max(200).optional(),
  due_date: dueDate,
});

export const submitSchema = z.object({
  note: z.string().trim().max(2000).default(""),
  image_urls: z
    .array(z.string().regex(/^\/api\/images\/[a-f0-9]{24}$/, "ลิงก์รูปภาพไม่ถูกต้อง"))
    .max(MAX_IMAGES_PER_SUBMISSION, `แนบรูปได้สูงสุด ${MAX_IMAGES_PER_SUBMISSION} รูป`)
    .default([]),
});

export const reviewSchema = z
  .object({
    decision: z.enum(["Approved", "Rejected"]),
    note: z.string().trim().max(2000).default(""),
  })
  .refine((v) => v.decision === "Approved" || v.note.length > 0, {
    message: "กรุณาระบุเหตุผลที่ส่งกลับแก้ไข",
    path: ["note"],
  });

// ---------- Queries ----------

/** Which tasks a user is allowed to see. Employees see "all" tasks (even if claimed by someone else) and their own. */
export function visibilityFilter(user: UserDoc): Filter<TaskDoc> {
  if (user.role === "employer") return {};
  return { is_archived: false, $or: [{ assigned_type: "all" }, { assigned_user: user._id }] };
}

export async function listTasks(user: UserDoc): Promise<TaskDoc[]> {
  const { tasks } = await collections();
  return tasks.find(visibilityFilter(user)).sort({ created_at: -1 }).limit(1000).toArray();
}

export async function getTaskForUser(user: UserDoc, id: string): Promise<TaskDoc> {
  const _id = toObjectId(id);
  if (!_id) throw new HttpError(404, "ไม่พบงาน");
  const { tasks } = await collections();
  const task = await tasks.findOne({ _id, ...visibilityFilter(user) });
  if (!task) throw new HttpError(404, "ไม่พบงาน");
  return task;
}

// ---------- Mutations ----------

async function assertActiveEmployee(id: string): Promise<ObjectId> {
  const _id = toObjectId(id);
  const { users } = await collections();
  const u = _id ? await users.findOne({ _id, status: "active", role: "employee" }) : null;
  if (!u) throw new HttpError(400, "ผู้รับผิดชอบไม่ถูกต้องหรือถูกปิดการใช้งาน");
  return u._id;
}

export async function createTask(user: UserDoc, input: z.infer<typeof createTaskSchema>): Promise<TaskDoc> {
  const assignedUser = input.assigned_type === "individual" ? await assertActiveEmployee(input.assigned_user!) : null;
  const now = new Date();
  const doc: TaskDoc = {
    _id: new ObjectId(),
    code: await nextTaskCode(),
    title: input.title,
    description: input.description,
    location: input.location,
    assigned_type: input.assigned_type,
    assigned_user: assignedUser,
    status: "Open",
    previous_status: null,
    due_date: input.due_date ?? null,
    is_archived: false,
    created_by: user._id,
    created_at: now,
    updated_at: now,
    claimed_at: null,
  };
  const { tasks } = await collections();
  await tasks.insertOne(doc);
  return doc;
}

export async function updateTask(id: string, input: z.infer<typeof updateTaskSchema>) {
  const _id = toObjectId(id);
  if (!_id) throw new HttpError(404, "ไม่พบงาน");
  const set: Partial<TaskDoc> = { updated_at: new Date() };
  if (input.title !== undefined) set.title = input.title;
  if (input.description !== undefined) set.description = input.description;
  if (input.location !== undefined) set.location = input.location;
  if (input.due_date !== undefined) set.due_date = input.due_date;
  const { tasks } = await collections();
  const res = await tasks.updateOne({ _id }, { $set: set });
  if (!res.matchedCount) throw new HttpError(404, "ไม่พบงาน");
}

/**
 * Claim is a single atomic conditional update: only one employee can ever win,
 * even if several press "รับงาน" at the same moment.
 */
export async function claimTask(user: UserDoc, id: string) {
  const task = await getTaskForUser(user, id);
  const { tasks } = await collections();
  const now = new Date();
  const res = await tasks.updateOne(
    {
      _id: task._id,
      is_archived: false,
      status: "Open",
      $or: [
        { assigned_type: "all", assigned_user: null },
        { assigned_type: "individual", assigned_user: user._id },
      ],
    },
    { $set: { status: "Claimed", assigned_user: user._id, claimed_at: now, updated_at: now } },
  );
  if (!res.modifiedCount) throw new HttpError(409, "งานนี้มีผู้รับไปแล้ว หรือไม่สามารถรับได้");
}

export async function startTask(user: UserDoc, id: string) {
  const task = await getTaskForUser(user, id);
  const { tasks } = await collections();
  const res = await tasks.updateOne(
    { _id: task._id, assigned_user: user._id, status: "Claimed", is_archived: false },
    { $set: { status: "In Progress", updated_at: new Date() } },
  );
  if (!res.modifiedCount) throw new HttpError(409, "ไม่สามารถเริ่มงานนี้ได้");
}

const SUBMITTABLE: TaskStatus[] = ["Claimed", "In Progress", "Rejected"];

export async function submitTask(user: UserDoc, id: string, input: z.infer<typeof submitSchema>) {
  if (!input.note && input.image_urls.length === 0) {
    throw new HttpError(400, "กรุณาแนบรูปภาพหรือเพิ่มหมายเหตุอย่างน้อย 1 อย่าง");
  }
  const task = await getTaskForUser(user, id);
  if (!task.assigned_user?.equals(user._id) || !SUBMITTABLE.includes(task.status) || task.is_archived) {
    throw new HttpError(409, "ไม่สามารถส่งงานนี้ได้ในสถานะปัจจุบัน");
  }

  // Images must have been uploaded by this user.
  if (input.image_urls.length) {
    const ids = input.image_urls.map((u) => new ObjectId(u.split("/").pop()));
    const bucket = await imageBucket();
    const found = await bucket.find({ _id: { $in: ids }, "metadata.uploaded_by": user._id }).toArray();
    if (found.length !== new Set(ids.map(String)).size) throw new HttpError(400, "พบรูปภาพที่ไม่ถูกต้อง");
  }

  const { tasks, submissions } = await collections();
  const now = new Date();
  const res = await tasks.updateOne(
    { _id: task._id, assigned_user: user._id, status: { $in: SUBMITTABLE }, is_archived: false },
    { $set: { status: "Pending Review", updated_at: now } },
  );
  if (!res.modifiedCount) throw new HttpError(409, "ไม่สามารถส่งงานนี้ได้ในสถานะปัจจุบัน");

  await submissions.insertOne({
    _id: new ObjectId(),
    task_id: task._id,
    user_id: user._id,
    note: input.note,
    image_urls: input.image_urls,
    submitted_at: now,
    review_status: "Pending",
    review_note: "",
    reviewed_by: null,
    reviewed_at: null,
  });
}

export async function reviewTask(reviewer: UserDoc, id: string, input: z.infer<typeof reviewSchema>) {
  const _id = toObjectId(id);
  if (!_id) throw new HttpError(404, "ไม่พบงาน");
  const { tasks, submissions } = await collections();
  const now = new Date();
  const res = await tasks.updateOne(
    { _id, status: "Pending Review", is_archived: false },
    { $set: { status: input.decision, updated_at: now } },
  );
  if (!res.modifiedCount) throw new HttpError(409, "งานนี้ไม่ได้อยู่ในสถานะรอตรวจสอบ");

  await submissions.findOneAndUpdate(
    { task_id: _id, review_status: "Pending" },
    {
      $set: {
        review_status: input.decision,
        review_note: input.note,
        reviewed_by: reviewer._id,
        reviewed_at: now,
      },
    },
    { sort: { submitted_at: -1 } },
  );
}

/** Soft delete: the task stays in the database and in the employer's list, and can be restored at any time. */
export async function archiveTask(id: string) {
  const _id = toObjectId(id);
  if (!_id) throw new HttpError(404, "ไม่พบงาน");
  const { tasks } = await collections();
  const res = await tasks.updateOne({ _id, is_archived: false }, [
    { $set: { previous_status: "$status", status: "Archived", is_archived: true, updated_at: "$$NOW" } },
  ]);
  if (!res.modifiedCount) throw new HttpError(409, "งานนี้ถูกเก็บถาวรแล้ว");
}

export async function restoreTask(id: string) {
  const _id = toObjectId(id);
  if (!_id) throw new HttpError(404, "ไม่พบงาน");
  const { tasks } = await collections();
  const res = await tasks.updateOne({ _id, is_archived: true }, [
    {
      $set: {
        status: { $ifNull: ["$previous_status", "Open"] },
        previous_status: null,
        is_archived: false,
        updated_at: "$$NOW",
      },
    },
  ]);
  if (!res.modifiedCount) throw new HttpError(409, "งานนี้ไม่ได้อยู่ในสถานะเก็บถาวร");
}
