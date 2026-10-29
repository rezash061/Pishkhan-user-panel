"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Me, Workspace } from "@/lib/api/types";
import { can as roleCan, type Permission } from "@/lib/permissions";

interface WorkspaceContextValue {
  workspace: Workspace;
  me: Me;
  can: (permission: Permission) => boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ workspace, me, children }: { workspace: Workspace; me: Me; children: ReactNode }) {
  const value = useMemo(() => ({ workspace, me, can: (p: Permission) => roleCan(workspace.role, p) }), [workspace, me]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace outside WorkspaceProvider");
  return value;
}
