import "server-only";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { USERNAME_PATTERN, normalizeUsername, usernameToEmail } from "@/lib/username";
import { adminAuth } from "./firebase-admin";
import { collections, toObjectId, type UserDoc } from "./db";
import { HttpError } from "./http";

const password = z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร").max(128);
const phone = z.string().trim().max(30).default("");
const email = z.string().trim().max(200).email("อีเมลไม่ถูกต้อง").or(z.literal("")).default("");

export const createUserSchema = z.object({
  username: z
    .string()
    .transform(normalizeUsername)
    .pipe(z.string().regex(USERNAME_PATTERN, "ชื่อผู้ใช้ใช้ได้เฉพาะ a-z, 0-9, . _ - (3-32 ตัว)")),
  password,
  name: z.string().trim().min(1, "กรุณากรอกชื่อ").max(100),
  phone,
  email,
  role: z.enum(["employer", "employee"]),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().max(30).optional(),
  email: email.optional(),
  role: z.enum(["employer", "employee"]).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  password: password.optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อ").max(100),
  phone,
  email,
});

export async function createUser(input: z.infer<typeof createUserSchema>): Promise<UserDoc> {
  const { users } = await collections();
  if (await users.findOne({ username: input.username })) throw new HttpError(409, "ชื่อผู้ใช้นี้ถูกใช้แล้ว");

  let fbUser;
  try {
    fbUser = await adminAuth().createUser({
      email: usernameToEmail(input.username),
      password: input.password,
      displayName: input.name,
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "auth/email-already-exists") throw new HttpError(409, "ชื่อผู้ใช้นี้ถูกใช้แล้ว");
    if (code === "auth/invalid-password") throw new HttpError(400, "รหัสผ่านไม่ผ่านเงื่อนไข");
    throw err;
  }

  const now = new Date();
  const doc: UserDoc = {
    _id: new ObjectId(),
    firebase_uid: fbUser.uid,
    username: input.username,
    name: input.name,
    phone: input.phone,
    email: input.email,
    role: input.role,
    status: "active",
    created_at: now,
    updated_at: now,
  };
  try {
    await users.insertOne(doc);
  } catch (err) {
    await adminAuth().deleteUser(fbUser.uid).catch(() => {}); // keep both stores in sync
    throw err;
  }
  return doc;
}

export async function updateUser(actor: UserDoc, id: string, input: z.infer<typeof updateUserSchema>) {
  const _id = toObjectId(id);
  const { users, passwordHistory } = await collections();
  const target = _id ? await users.findOne({ _id }) : null;
  if (!target) throw new HttpError(404, "ไม่พบผู้ใช้");

  const isSelf = target._id.equals(actor._id);
  if (isSelf && input.status === "inactive") throw new HttpError(400, "ไม่สามารถปิดการใช้งานบัญชีของตัวเองได้");
  if (isSelf && input.role && input.role !== "employer") throw new HttpError(400, "ไม่สามารถลดสิทธิ์บัญชีของตัวเองได้");

  const set: Partial<UserDoc> = { updated_at: new Date() };
  if (input.name !== undefined) set.name = input.name;
  if (input.phone !== undefined) set.phone = input.phone;
  if (input.email !== undefined) set.email = input.email;
  if (input.role !== undefined) set.role = input.role;
  if (input.status !== undefined) set.status = input.status;

  const auth = adminAuth();
  await auth.updateUser(target.firebase_uid, {
    ...(input.name !== undefined && { displayName: input.name }),
    ...(input.password && { password: input.password }),
    ...(input.status !== undefined && { disabled: input.status === "inactive" }),
  });
  // Sign the user out everywhere when disabled or when an admin resets the password.
  if (input.status === "inactive" || input.password) await auth.revokeRefreshTokens(target.firebase_uid);

  await users.updateOne({ _id: target._id }, { $set: set });
  if (input.password) {
    await passwordHistory.insertOne({
      _id: new ObjectId(),
      user_id: target._id,
      changed_at: new Date(),
      changed_by: actor._id,
    });
  }
}
