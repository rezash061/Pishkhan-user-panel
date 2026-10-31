import type { WorkspaceRole } from "@/lib/api/types";

/** Mirrors backend `Pishkhan.Modules.Tenancy.Contracts.Permissions` and `WorkspaceRoles`. The backend still enforces them. */
export const P = {
  settingsRead: "workspace.settings.read",
  settingsWrite: "workspace.settings.write",
  membersRead: "workspace.members.read",
  membersManage: "workspace.members.manage",
  billingManage: "workspace.billing.manage",
  channelsManage: "workspace.channels.manage",
  inboxRead: "workspace.inbox.read",
  inboxReply: "workspace.inbox.reply",
  automationWrite: "workspace.automation.write",
  agentWrite: "workspace.agent.write",
  knowledgeWrite: "workspace.knowledge.write",
  catalogRead: "workspace.catalog.read",
  catalogWrite: "workspace.catalog.write",
  crmRead: "workspace.crm.read",
  crmWrite: "workspace.crm.write",
  filesUpload: "workspace.files.upload",
  filesRead: "workspace.files.read",
  analyticsRead: "workspace.analytics.read",
  workspaceDelete: "workspace.delete",
  auditRead: "workspace.audit.read",
} as const;

export type Permission = (typeof P)[keyof typeof P];

const all = Object.values(P) as Permission[];

const sets: Record<WorkspaceRole, ReadonlySet<Permission>> = {
  owner: new Set(all),
  admin: new Set(all.filter((p) => p !== P.billingManage && p !== P.workspaceDelete && p !== P.auditRead)),
  agent: new Set([P.settingsRead, P.inboxRead, P.inboxReply, P.catalogRead, P.crmRead, P.crmWrite, P.filesUpload, P.filesRead, P.membersRead]),
  viewer: new Set([P.settingsRead, P.inboxRead, P.catalogRead, P.crmRead, P.filesRead, P.membersRead, P.analyticsRead]),
};

export function permissionsOf(role: string): ReadonlySet<Permission> {
  return sets[role as WorkspaceRole] ?? new Set();
}

export function can(role: string, permission: Permission): boolean {
  return permissionsOf(role).has(permission);
}
