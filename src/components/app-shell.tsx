"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import type { UserDTO } from "@/types";
import { IconList, IconLogout, IconPlus, IconUser, IconUsers } from "./icons";
import { SessionProvider } from "./session-context";
import { ToastProvider } from "./toast";

type Tab = { href: string; label: string; short: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> };

const EMPLOYER_TABS: Tab[] = [
  { href: "/tasks", label: "รายการงาน", short: "งาน", icon: IconList },
  { href: "/create", label: "เพิ่มรายการงาน", short: "เพิ่มงาน", icon: IconPlus },
  { href: "/users", label: "จัดการบุคคล", short: "บุคคล", icon: IconUsers },
];
const EMPLOYEE_TABS: Tab[] = [{ href: "/tasks", label: "รายการงาน", short: "งาน", icon: IconList }];
const ACCOUNT_TAB: Tab = { href: "/account", label: "บัญชีของฉัน", short: "บัญชี", icon: IconUser };

export function AppShell({ user, children }: { user: UserDTO; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const tabs = user.role === "employer" ? EMPLOYER_TABS : EMPLOYEE_TABS;
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  async function logout() {
    await api("/api/auth/session", { method: "DELETE" }).catch(() => {});
    router.replace("/login");
    router.refresh();
  }

  return (
    <SessionProvider user={user}>
      <ToastProvider>
        <header className="sticky top-0 z-40 bg-brand-600 text-white shadow-md">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
            <Link href="/tasks" className="flex items-center gap-2 font-bold">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-brand-600">✓</span>
              <span className="text-lg tracking-tight">Worklist</span>
            </Link>
            <div className="flex items-center gap-1 sm:gap-2">
              <Link
                href="/account"
                className="hidden items-center gap-2 rounded-xl px-3 py-1.5 text-sm hover:bg-white/10 sm:flex"
              >
                <span className="font-semibold">{user.name}</span>
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                  {user.role === "employer" ? "Employer" : "Employee"}
                </span>
              </Link>
              <button onClick={logout} className="rounded-xl p-2 hover:bg-white/10" aria-label="ออกจากระบบ" title="ออกจากระบบ">
                <IconLogout />
              </button>
            </div>
          </div>
          {/* Desktop / tablet tabs */}
          <nav className="hidden border-t border-white/15 sm:block">
            <div className="mx-auto flex max-w-6xl gap-1 px-4">
              {[...tabs, ACCOUNT_TAB].map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`flex items-center gap-2 border-b-[3px] px-4 py-2.5 text-sm font-medium transition ${
                    isActive(t.href) ? "border-white text-white" : "border-transparent text-white/75 hover:text-white"
                  }`}
                >
                  <t.icon width={18} height={18} />
                  {t.label}
                </Link>
              ))}
            </div>
          </nav>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:pb-10">{children}</main>

        {/* Mobile bottom navigation */}
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden">
          <div className="flex">
            {[...tabs, ACCOUNT_TAB].map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                  isActive(t.href) ? "text-brand-600" : "text-neutral-500"
                }`}
              >
                <t.icon width={22} height={22} />
                {t.short}
              </Link>
            ))}
          </div>
        </nav>
      </ToastProvider>
    </SessionProvider>
  );
}
