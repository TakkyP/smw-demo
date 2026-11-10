import "server-only";
import type { ObjectId } from "mongodb";
import type { SubmissionDTO, TaskDTO, UserDTO, UserRef } from "@/types";
import { collections, type SubmissionDoc, type TaskDoc, type UserDoc } from "./db";

export function userDTO(u: UserDoc): UserDTO {
  return {
    id: String(u._id),
    username: u.username,
    name: u.name,
    phone: u.phone ?? "",
    email: u.email ?? "",
    role: u.role,
    status: u.status,
    created_at: u.created_at.toISOString(),
  };
}

/** Load a map of user id -> UserRef for the given ids in one query. */
export async function loadUserRefs(ids: (ObjectId | null | undefined)[]): Promise<Map<string, UserRef>> {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  const map = new Map<string, UserRef>();
  if (!unique.length) return map;
  const { users } = await collections();
  const docs = await users
    .find({ _id: { $in: ids.filter((x): x is ObjectId => !!x) } }, { projection: { name: 1, username: 1 } })
    .toArray();
  for (const d of docs) map.set(String(d._id), { id: String(d._id), name: d.name, username: d.username });
  return map;
}

const ref = (map: Map<string, UserRef>, id: ObjectId | null | undefined) => (id ? (map.get(String(id)) ?? null) : null);

export async function taskDTOs(tasks: TaskDoc[]): Promise<TaskDTO[]> {
  if (!tasks.length) return [];
  const { submissions } = await collections();
  const [refs, counts] = await Promise.all([
    loadUserRefs(tasks.flatMap((t) => [t.assigned_user, t.created_by])),
    submissions
      .aggregate<{ _id: ObjectId; n: number }>([
        { $match: { task_id: { $in: tasks.map((t) => t._id) } } },
        { $group: { _id: "$task_id", n: { $sum: 1 } } },
      ])
      .toArray(),
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.n]));

  return tasks.map((t) => ({
    id: String(t._id),
    code: t.code,
    title: t.title,
    description: t.description,
    location: t.location,
    assigned_type: t.assigned_type,
    assigned_user: ref(refs, t.assigned_user),
    status: t.status,
    due_date: t.due_date ? t.due_date.toISOString() : null,
    is_archived: t.is_archived,
    created_by: ref(refs, t.created_by),
    created_at: t.created_at.toISOString(),
    updated_at: t.updated_at.toISOString(),
    claimed_at: t.claimed_at ? t.claimed_at.toISOString() : null,
    submission_count: countMap.get(String(t._id)) ?? 0,
  }));
}

export async function submissionDTOs(subs: SubmissionDoc[]): Promise<SubmissionDTO[]> {
  const refs = await loadUserRefs(subs.flatMap((s) => [s.user_id, s.reviewed_by]));
  return subs.map((s) => ({
    id: String(s._id),
    task_id: String(s.task_id),
    user: ref(refs, s.user_id),
    note: s.note,
    image_urls: s.image_urls,
    submitted_at: s.submitted_at.toISOString(),
    review_status: s.review_status,
    review_note: s.review_note ?? "",
    reviewed_by: ref(refs, s.reviewed_by),
    reviewed_at: s.reviewed_at ? s.reviewed_at.toISOString() : null,
  }));
}
