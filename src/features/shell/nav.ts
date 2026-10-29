import { Blocks, Bot, BookOpen, CreditCard, Inbox, LayoutDashboard, Package, Radio, Settings, Users, UsersRound, Workflow, type LucideIcon } from "lucide-react";
import { P, type Permission } from "@/lib/permissions";

export interface NavItem {
  key: "dashboard" | "inbox" | "automations" | "agent" | "knowledge" | "catalog" | "contacts" | "channels" | "team" | "billing" | "settings";
  href: string;
  icon: LucideIcon;
  permission?: Permission;
  /** Not built yet: shown with a «به‌زودی» badge so sellers see what is coming (backend module not available). */
  soon?: boolean;
  /** Shown in the mobile bottom tab bar. */
  tab?: boolean;
}

export const navItems: NavItem[] = [
  { key: "dashboard", href: "", icon: LayoutDashboard, tab: true },
  { key: "inbox", href: "/inbox", icon: Inbox, permission: P.inboxRead, tab: true },
  { key: "automations", href: "/automations", icon: Workflow, permission: P.automationWrite, soon: true },
  { key: "agent", href: "/agent", icon: Bot, permission: P.agentWrite, soon: true },
  { key: "knowledge", href: "/knowledge", icon: BookOpen, permission: P.knowledgeWrite, soon: true },
  { key: "catalog", href: "/catalog", icon: Package, permission: P.catalogRead, soon: true },
  { key: "contacts", href: "/contacts", icon: UsersRound, permission: P.crmRead, soon: true },
  { key: "channels", href: "/channels", icon: Radio, permission: P.settingsRead, tab: true },
  { key: "team", href: "/team", icon: Users, permission: P.membersRead },
  { key: "billing", href: "/billing", icon: CreditCard, permission: P.billingManage, soon: true },
  { key: "settings", href: "/settings", icon: Settings, permission: P.settingsRead, tab: true },
];

export const moreIcon = Blocks;
