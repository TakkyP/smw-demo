const dateFmt = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "2-digit" });
const dateTimeFmt = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatDate = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : "-");
export const formatDateTime = (iso: string | null) => (iso ? dateTimeFmt.format(new Date(iso)) : "-");

/** yyyy-mm-dd for <input type="date"> */
export const toDateInput = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");

export function isOverdue(due: string | null, status: string) {
  if (!due || ["Approved", "Archived"].includes(status)) return false;
  const end = new Date(due);
  end.setHours(23, 59, 59, 999);
  return end.getTime() < Date.now();
}
