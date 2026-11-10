import { requireUser } from "@/server/auth";
import { handler, ok, parseBody } from "@/server/http";
import { updateUser, updateUserSchema } from "@/server/users";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler<Ctx>(async (req, { params }) => {
  const actor = await requireUser("employer");
  const { id } = await params;
  await updateUser(actor, id, await parseBody(req, updateUserSchema));
  return ok({ ok: true });
});
