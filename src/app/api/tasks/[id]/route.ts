import { requireUser } from "@/server/auth";
import { collections } from "@/server/db";
import { handler, ok, parseBody } from "@/server/http";
import { submissionDTOs, taskDTOs } from "@/server/serialize";
import { getTaskForUser, updateTask, updateTaskSchema } from "@/server/tasks";

type Ctx = { params: Promise<{ id: string }> };

/** Task detail with full submission history (newest first). */
export const GET = handler<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const task = await getTaskForUser(user, id);
  const { submissions } = await collections();
  const subs = await submissions.find({ task_id: task._id }).sort({ submitted_at: -1 }).toArray();
  const [dto] = await taskDTOs([task]);
  return ok({ task: { ...dto, submissions: await submissionDTOs(subs) } });
});

export const PATCH = handler<Ctx>(async (req, { params }) => {
  await requireUser("employer");
  const { id } = await params;
  await updateTask(id, await parseBody(req, updateTaskSchema));
  return ok({ ok: true });
});
