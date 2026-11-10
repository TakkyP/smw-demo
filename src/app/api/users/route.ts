import { requireUser } from "@/server/auth";
import { collections } from "@/server/db";
import { handler, ok, parseBody } from "@/server/http";
import { userDTO } from "@/server/serialize";
import { createUser, createUserSchema } from "@/server/users";

export const GET = handler(async () => {
  await requireUser("employer");
  const { users } = await collections();
  const docs = await users.find().sort({ status: 1, role: 1, name: 1 }).toArray();
  return ok({ users: docs.map(userDTO) });
});

export const POST = handler(async (req) => {
  await requireUser("employer");
  const user = await createUser(await parseBody(req, createUserSchema));
  return ok({ user: userDTO(user) }, { status: 201 });
});
