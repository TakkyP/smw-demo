import type { Role, TaskStatus } from "@/types";

export const APP_NAME = "Worklist";

export const STATUS_LABEL: Record<TaskStatus, string> = {
  Open: "เปิดรับงาน",
  Claimed: "รับงานแล้ว",
  "In Progress": "กำลังดำเนินการ",
  "Pending Review": "รอตรวจสอบ",
  Approved: "อนุมัติแล้ว",
  Rejected: "ส่งกลับแก้ไข",
  Archived: "เก็บถาวร",
};

/** Tailwind classes for each status badge. Kept within the red/white theme, with neutral accents for readability. */
export const STATUS_STYLE: Record<TaskStatus, string> = {
  Open: "bg-white text-brand-700 ring-1 ring-brand-300",
  Claimed: "bg-brand-50 text-brand-700 ring-1 ring-brand-200",
  "In Progress": "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  "Pending Review": "bg-brand-600 text-white",
  Approved: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  Rejected: "bg-brand-900 text-white",
  Archived: "bg-neutral-100 text-neutral-500 ring-1 ring-neutral-200",
};

export const ROLE_LABEL: Record<Role, string> = {
  employer: "นายจ้าง (Employer)",
  employee: "ลูกจ้าง (Employee)",
};

export const ACTIVE_STATUSES: TaskStatus[] = ["Claimed", "In Progress", "Rejected"];

export const SESSION_COOKIE = "__session";
export const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000; // 5 days (Firebase allows up to 14)

export const MAX_IMAGES_PER_SUBMISSION = 10;
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // stays under Vercel's 4.5 MB body limit
