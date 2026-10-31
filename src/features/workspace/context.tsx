"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Me, Workspace } from "@/lib/api/types";
import { useSupportSession } from "@/features/support/support";
import { P, can as roleCan, type Permission } from "@/lib/permissions";

/** Not offered under a support session: billing is refused there by the backend, and deleting a workspace is the owner's own call. */
const closedToSupport: ReadonlySet<Permission> = new Set([P.billingManage, P.workspaceDelete]);

interface WorkspaceContextValue {
  workspace: Workspace;
  me: Me;
  can: (permission: Permission) => boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ workspace, me, children }: { workspace: Workspace; me: Me; children: ReactNode }) {
  const support = Boolean(useSupportSession());
  const value = useMemo(
    () => ({ workspace, me, can: (p: Permission) => roleCan(workspace.role, p) && !(support && closedToSupport.has(p)) }),
    [workspace, me, support],
  );
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace outside WorkspaceProvider");
  return value;
}
