import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { WorkspaceShell } from "@/features/shell/workspace-shell";
import { PendingDeletionPage } from "@/features/workspace/deletion";
import { loadMe, loadWorkspace, loadWorkspaces } from "@/lib/api/server-data";

export default async function WorkspaceLayout({ children, params }: { children: ReactNode; params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) notFound();
  const [{ workspace, status }, me] = await Promise.all([loadWorkspace(workspaceId), loadMe()]);
  if (status === 401 || !me) redirect(`/login?expired=1&next=/w/${workspaceId}`);
  if (!workspace) {
    // A workspace scheduled for deletion answers 404 but is still listed, so its owner can cancel.
    const pending = (await loadWorkspaces())?.find((w) => w.id === workspaceId && w.status === "pending_deletion");
    if (pending) return <PendingDeletionPage workspace={pending} />;
    notFound();
  }
  return (
    <WorkspaceShell workspace={workspace} me={me}>
      {children}
    </WorkspaceShell>
  );
}
