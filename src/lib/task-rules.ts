// UI-side mirror of the server rules. The server always re-checks; this only decides which buttons to show.
import type { TaskDTO, UserDTO } from "@/types";

export const isMine = (t: TaskDTO, u: UserDTO) => t.assigned_user?.id === u.id;

export function canClaim(t: TaskDTO, u: UserDTO) {
  if (u.role !== "employee" || t.is_archived || t.status !== "Open") return false;
  return t.assigned_type === "all" ? !t.assigned_user : isMine(t, u);
}

export const canStart = (t: TaskDTO, u: UserDTO) => u.role === "employee" && isMine(t, u) && t.status === "Claimed";

export const canSubmit = (t: TaskDTO, u: UserDTO) =>
  u.role === "employee" && isMine(t, u) && !t.is_archived && ["Claimed", "In Progress", "Rejected"].includes(t.status);

export const canReview = (t: TaskDTO, u: UserDTO) => u.role === "employer" && t.status === "Pending Review";

/** Label shown for "who is responsible". */
export function assigneeLabel(t: TaskDTO) {
  if (t.assigned_type === "all") return t.assigned_user ? `${t.assigned_user.name} (รับจากงานทุกคน)` : "ทุกคน · ยังไม่มีผู้รับ";
  return t.assigned_user?.name ?? "-";
}
