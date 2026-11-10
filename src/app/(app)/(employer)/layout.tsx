import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth";

/** Employer-only pages. Employees are sent back to their worklist. */
export default async function EmployerLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (user?.role !== "employer") redirect("/tasks");
  return <>{children}</>;
}
