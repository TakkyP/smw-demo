import { z } from "zod";
import { handler, ok, parseBody } from "@/server/http";
import { userDTO } from "@/server/serialize";
import { endSession, startSession } from "@/server/session";

const schema = z.object({ idToken: z.string().min(1) });

/** Exchange a fresh Firebase ID token (from client sign-in) for an httpOnly session cookie. */
export const POST = handler(async (req) => {
  const { idToken } = await parseBody(req, schema);
  const user = await startSession(idToken);
  return ok({ user: userDTO(user) });
});

export const DELETE = handler(async () => {
  await endSession();
  return ok({ ok: true });
});
