"use client";
import { createContext, useContext } from "react";
import type { UserDTO } from "@/types";

const SessionCtx = createContext<UserDTO | null>(null);

export function SessionProvider({ user, children }: { user: UserDTO; children: React.ReactNode }) {
  return <SessionCtx.Provider value={user}>{children}</SessionCtx.Provider>;
}

export function useSession(): UserDTO {
  const user = useContext(SessionCtx);
  if (!user) throw new Error("useSession must be used inside SessionProvider");
  return user;
}
