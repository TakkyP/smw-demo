import type { TaskDTO } from "@/types";

export function computeStats(tasks: TaskDTO[]) {
  const live = tasks.filter((t) => !t.is_archived);
  return {
    total: live.length,
    inProgress: live.filter((t) => ["Claimed", "In Progress", "Rejected"].includes(t.status)).length,
    pending: live.filter((t) => t.status === "Pending Review").length,
    done: live.filter((t) => t.status === "Approved").length,
  };
}

export function StatCards({ tasks }: { tasks: TaskDTO[] }) {
  const s = computeStats(tasks);
  const cards = [
    { label: "งานทั้งหมด", value: s.total, cls: "bg-brand-600 text-white", sub: "text-white/80" },
    { label: "กำลังดำเนินการ", value: s.inProgress, cls: "bg-white", sub: "text-neutral-500" },
    { label: "รอตรวจสอบ", value: s.pending, cls: "bg-white", sub: "text-neutral-500", accent: true },
    { label: "เสร็จสิ้น", value: s.done, cls: "bg-white", sub: "text-neutral-500" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className={`card relative overflow-hidden p-4 ${c.cls}`}>
          {c.accent && <span className="absolute inset-y-0 left-0 w-1 bg-brand-600" />}
          <p className={`text-xs font-medium sm:text-sm ${c.sub}`}>{c.label}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{c.value}</p>
        </div>
      ))}
    </div>
  );
}
