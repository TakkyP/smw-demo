import { requireUser } from "@/server/auth";
import { handler, ok, parseBody } from "@/server/http";
import { taskDTOs } from "@/server/serialize";
import { createTask, createTaskSchema, listTasks } from "@/server/tasks";

export const GET = handler(async () => {
  const user = await requireUser();
  return ok({ tasks: await taskDTOs(await listTasks(user)) });
});

export const POST = handler(async (req) => {
  const user = await requireUser("employer");
  const input = await parseBody(req, createTaskSchema);
  const task = await createTask(user, input);
  const [dto] = await taskDTOs([task]);
  return ok({ task: dto }, { status: 201 });
});
