import { requireUser } from "@/server/auth";
import { handler, ok } from "@/server/http";
import { userDTO } from "@/server/serialize";

export const GET = handler(async () => ok({ user: userDTO(await requireUser()) }));
