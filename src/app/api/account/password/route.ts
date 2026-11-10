import { ObjectId } from "mongodb";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { collections } from "@/server/db";
import { handler, ok, parseBody } from "@/server/http";
import { startSession } from "@/server/session";

const schema = z.object({ idToken: z.string().min(1) });

/**
 * Called by the client right after it re-authenticated and changed the password with the Firebase SDK.
 * Firebase revokes existing sessions on password change (other devices get logged out), so we issue a
 * fresh session cookie for this device and record the change in password_history.
 */
export const POST = handler(async (req) => {
  const { idToken } = await parseBody(req, schema);
  const user = await startSession(idToken);
  const { passwordHistory } = await collections();
  await passwordHistory.insertOne({
    _id: new ObjectId(),
    user_id: user._id,
    changed_at: new Date(),
    changed_by: user._id,
  });
  return ok({ ok: true });
});

/** Recent password-change history for the current user. */
export const GET = handler(async () => {
  const user = await requireUser();
  const { passwordHistory } = await collections();
  const rows = await passwordHistory.find({ user_id: user._id }).sort({ changed_at: -1 }).limit(10).toArray();
  return ok({
    history: rows.map((r) => ({ changed_at: r.changed_at.toISOString(), by_self: r.changed_by.equals(user._id) })),
  });
});
