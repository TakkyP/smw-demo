import { requireUser } from "@/server/auth";
import { HttpError, handler, ok, parseBody } from "@/server/http";
import {
  archiveTask,
  claimTask,
  restoreTask,
  reviewSchema,
  reviewTask,
  startTask,
  submitSchema,
  submitTask,
} from "@/server/tasks";

type Ctx = { params: Promise<{ id: string; action: string }> };

/**
 * POST /api/tasks/:id/claim    (employee)  Open -> Claimed
 * POST /api/tasks/:id/start    (employee)  Claimed -> In Progress
 * POST /api/tasks/:id/submit   (employee)  Claimed | In Progress | Rejected -> Pending Review
 * POST /api/tasks/:id/review   (employer)  Pending Review -> Approved | Rejected
 * POST /api/tasks/:id/archive  (employer)  any -> Archived (soft delete)
 * POST /api/tasks/:id/restore  (employer)  Archived -> previous status
 */
export const POST = handler<Ctx>(async (req, { params }) => {
  const { id, action } = await params;
  switch (action) {
    case "claim":
      await claimTask(await requireUser("employee"), id);
      break;
    case "start":
      await startTask(await requireUser("employee"), id);
      break;
    case "submit": {
      const user = await requireUser("employee");
      await submitTask(user, id, await parseBody(req, submitSchema));
      break;
    }
    case "review": {
      const user = await requireUser("employer");
      await reviewTask(user, id, await parseBody(req, reviewSchema));
      break;
    }
    case "archive":
      await requireUser("employer");
      await archiveTask(id);
      break;
    case "restore":
      await requireUser("employer");
      await restoreTask(id);
      break;
    default:
      throw new HttpError(404, "ไม่พบคำสั่ง");
  }
  return ok({ ok: true });
});
