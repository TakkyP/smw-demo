"use client";
import Link from "next/link";
import { formatDate, isOverdue } from "@/lib/format";
import { assigneeLabel, canClaim, isMine } from "@/lib/task-rules";
import type { TaskDTO, UserDTO } from "@/types";
import { IconCalendar, IconPin, IconUser } from "./icons";
import { Spinner, StatusBadge } from "./ui";

export function TaskCard({
  task,
  user,
  onClaim,
  claiming,
}: {
  task: TaskDTO;
  user: UserDTO;
  onClaim?: (t: TaskDTO) => void;
  claiming?: boolean;
}) {
  const overdue = isOverdue(task.due_date, task.status);
  const takenByOther =
    user.role === "employee" && task.assigned_type === "all" && task.assigned_user && !isMine(task, user);

  return (
    <div className={`card flex flex-col p-4 transition hover:shadow-md ${task.is_archived ? "opacity-70" : ""}`}>
      <Link href={`/tasks/${task.id}`} className="flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-neutral-400">{task.code}</p>
            <h3 className="mt-0.5 line-clamp-2 font-semibold text-neutral-900">{task.title}</h3>
          </div>
          <StatusBadge status={task.status} />
        </div>
        {task.description && <p className="mt-2 line-clamp-2 text-sm text-neutral-600">{task.description}</p>}
        <dl className="mt-3 space-y-1.5 text-sm text-neutral-600">
          {task.location && (
            <div className="flex items-center gap-2">
              <IconPin width={16} height={16} className="shrink-0 text-brand-500" />
              <span className="truncate">{task.location}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <IconCalendar width={16} height={16} className="shrink-0 text-brand-500" />
            <span className={overdue ? "font-semibold text-brand-700" : ""}>
              {formatDate(task.due_date)}
              {overdue && " · เกินกำหนด"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <IconUser width={16} height={16} className="shrink-0 text-brand-500" />
            <span className="truncate">{assigneeLabel(task)}</span>
          </div>
        </dl>
      </Link>

      {user.role === "employee" && (canClaim(task, user) || takenByOther) && (
        <div className="mt-4 border-t border-neutral-100 pt-3">
          {canClaim(task, user) ? (
            <button className="btn-primary w-full" disabled={claiming} onClick={() => onClaim?.(task)}>
              {claiming && <Spinner />} รับงาน
            </button>
          ) : (
            <button className="btn w-full bg-neutral-100 text-neutral-500" disabled>
              มีผู้รับงานแล้ว
            </button>
          )}
        </div>
      )}
    </div>
  );
}
