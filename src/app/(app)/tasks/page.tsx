"use client";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { useSession } from "@/components/session-context";
import { StatCards } from "@/components/stat-cards";
import { TaskCard } from "@/components/task-card";
import { useToast } from "@/components/toast";
import { EmptyState, ErrorText, Spinner } from "@/components/ui";
import { IconSearch } from "@/components/icons";
import { api, fetcher } from "@/lib/api-client";
import { STATUS_LABEL } from "@/lib/constants";
import { isMine } from "@/lib/task-rules";
import type { TaskDTO, TaskStatus } from "@/types";

type Filter = "all" | "mine" | TaskStatus;

export default function TasksPage() {
  const user = useSession();
  const toast = useToast();
  const { data, error, isLoading, mutate } = useSWR<{ tasks: TaskDTO[] }>("/api/tasks", fetcher, {
    refreshInterval: 30_000, // pick up claims made by other employees
  });
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const tasks = useMemo(() => data?.tasks ?? [], [data]);
  const isEmployer = user.role === "employer";

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "ทั้งหมด" },
    ...(!isEmployer ? [{ key: "mine" as Filter, label: "งานของฉัน" }] : []),
    ...(["Open", "Claimed", "In Progress", "Pending Review", "Approved", "Rejected"] as TaskStatus[]).map((s) => ({
      key: s as Filter,
      label: STATUS_LABEL[s],
    })),
    ...(isEmployer ? [{ key: "Archived" as Filter, label: STATUS_LABEL.Archived }] : []),
  ];

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return tasks.filter((t) => {
      if (filter === "mine" && !isMine(t, user)) return false;
      if (filter !== "all" && filter !== "mine" && t.status !== filter) return false;
      if (!term) return true;
      return [t.code, t.title, t.location, t.description, t.assigned_user?.name ?? ""].some((s) =>
        s.toLowerCase().includes(term),
      );
    });
  }, [tasks, filter, q, user]);

  async function claim(task: TaskDTO) {
    setClaimingId(task.id);
    try {
      await api(`/api/tasks/${task.id}/claim`, { method: "POST" });
      toast(`รับงาน "${task.title}" แล้ว`);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setClaimingId(null);
      mutate();
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">รายการงาน</h1>
        <p className="text-sm text-neutral-500">
          {isEmployer ? "ภาพรวมงานทั้งหมดในระบบ" : "งานที่ได้รับมอบหมายและงานที่เปิดให้ทุกคนรับได้"}
        </p>
      </div>

      <StatCards tasks={isEmployer ? tasks : tasks.filter((t) => isMine(t, user) || t.status === "Open")} />

      <div className="space-y-3">
        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" width={18} height={18} />
          <input
            className="input pl-10"
            placeholder="ค้นหารหัส ชื่องาน พื้นที่ หรือผู้รับผิดชอบ"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {filters.map((f) => {
            const count =
              f.key === "all"
                ? tasks.length
                : f.key === "mine"
                  ? tasks.filter((t) => isMine(t, user)).length
                  : tasks.filter((t) => t.status === f.key).length;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                  filter === f.key
                    ? "bg-brand-600 text-white"
                    : "border border-neutral-200 bg-white text-neutral-600 hover:border-brand-200"
                }`}
              >
                {f.label} <span className="opacity-70">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && <ErrorText>{error.message}</ErrorText>}
      {isLoading ? (
        <div className="flex justify-center py-16 text-brand-600">
          <Spinner className="h-6 w-6" />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState title="ไม่พบงาน" hint={q || filter !== "all" ? "ลองเปลี่ยนตัวกรองหรือคำค้นหา" : undefined} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((t) => (
            <TaskCard key={t.id} task={t} user={user} onClaim={claim} claiming={claimingId === t.id} />
          ))}
        </div>
      )}
    </div>
  );
}
