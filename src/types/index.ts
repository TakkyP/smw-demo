// Shared types used by both server and client code.
// These describe the JSON shapes returned by the API (DTOs), not raw MongoDB documents.

export const ROLES = ["employer", "employee"] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ["active", "inactive"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const TASK_STATUSES = [
  "Open",
  "Claimed",
  "In Progress",
  "Pending Review",
  "Approved",
  "Rejected",
  "Archived",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const ASSIGNED_TYPES = ["all", "individual"] as const;
export type AssignedType = (typeof ASSIGNED_TYPES)[number];

export const REVIEW_STATUSES = ["Pending", "Approved", "Rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export interface UserRef {
  id: string;
  name: string;
  username: string;
}

export interface UserDTO {
  id: string;
  username: string;
  name: string;
  phone: string;
  email: string;
  role: Role;
  status: UserStatus;
  created_at: string;
}

export interface TaskDTO {
  id: string;
  code: string;
  title: string;
  description: string;
  location: string;
  assigned_type: AssignedType;
  /** For "individual" tasks: the target employee. For "all" tasks: whoever claimed it (null until claimed). */
  assigned_user: UserRef | null;
  status: TaskStatus;
  due_date: string | null;
  is_archived: boolean;
  created_by: UserRef | null;
  created_at: string;
  updated_at: string;
  claimed_at: string | null;
  submission_count: number;
}

export interface SubmissionDTO {
  id: string;
  task_id: string;
  user: UserRef | null;
  note: string;
  image_urls: string[];
  submitted_at: string;
  review_status: ReviewStatus;
  review_note: string;
  reviewed_by: UserRef | null;
  reviewed_at: string | null;
}

export interface TaskDetailDTO extends TaskDTO {
  submissions: SubmissionDTO[];
}

export type TaskAction = "claim" | "start" | "submit" | "review" | "archive" | "restore";
