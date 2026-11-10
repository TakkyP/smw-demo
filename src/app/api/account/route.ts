import { requireUser } from "@/server/auth";
import { adminAuth } from "@/server/firebase-admin";
import { collections } from "@/server/db";
import { handler, ok, parseBody } from "@/server/http";
import { updateProfileSchema } from "@/server/users";

/** Any logged-in user can edit their own basic profile. Username and role are not editable here. */
export const PATCH = handler(async (req) => {
  const user = await requireUser();
  const input = await parseBody(req, updateProfileSchema);
  const { users } = await collections();
  await users.updateOne({ _id: user._id }, { $set: { ...input, updated_at: new Date() } });
  await adminAuth().updateUser(user.firebase_uid, { displayName: input.name });
  return ok({ ok: true });
});
