import { Blocks, Bot, BookOpen, CreditCard, Inbox, LayoutDashboard, Package, Radio, Settings, ShoppingBag, Users, UsersRound, Workflow, type LucideIcon } from "lucide-react";
import { P, type Permission } from "@/lib/permissions";

export interface NavItem {
  key: "dashboard" | "inbox" | "orders" | "automations" | "agent" | "knowledge" | "catalog" | "contacts" | "channels" | "team" | "billing" | "settings";
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
  { key: "orders", href: "/orders", icon: ShoppingBag, permission: P.ordersRead, tab: true },
  { key: "automations", href: "/automations", icon: Workflow, permission: P.settingsRead },
  { key: "agent", href: "/agent", icon: Bot, permission: P.agentWrite },
  { key: "knowledge", href: "/knowledge", icon: BookOpen, permission: P.knowledgeWrite },
  { key: "catalog", href: "/catalog", icon: Package, permission: P.catalogRead },
  { key: "contacts", href: "/contacts", icon: UsersRound, permission: P.crmRead },
  { key: "channels", href: "/channels", icon: Radio, permission: P.settingsRead },
  { key: "team", href: "/team", icon: Users, permission: P.membersRead },
  { key: "billing", href: "/billing", icon: CreditCard, permission: P.billingManage },
  { key: "settings", href: "/settings", icon: Settings, permission: P.settingsRead, tab: true },
];

export const moreIcon = Blocks;
