import type { components } from "./schema";

type Schemas = components["schemas"];


export type Me = Schemas["MeResponse"];
export type Workspace = Schemas["WorkspaceResponse"];
export type Member = Schemas["MemberResponse"];
export type Channel = Schemas["ChannelResponse"];
export type Media = Schemas["MediaResponse"];
export type Conversation = Schemas["ConversationResponse"];
export type ConversationContact = Schemas["ConversationContact"];
export type Handoff = Schemas["HandoffInfo"];
export type MessageAttachment = Schemas["MessageAttachment"];
export type Message = Schemas["MessageResponse"];
export type Note = Schemas["NoteResponse"];
export type QuickReply = Schemas["QuickReplyResponse"];
export type Session = Schemas["SessionResponse"];
export type BusinessHours = Schemas["BusinessHoursDto"];
export type DayHours = Schemas["DayHours"];
export type Invitation = Schemas["InvitationResponse"];
export type PendingInvitation = Schemas["PendingInvitationResponse"];
export type FileInfo = Schemas["FileResponse"];
export type Page<T> = { items: T[]; nextCursor: string | null };
export type Dashboard = Schemas["DashboardResponse"];
export type DashboardDay = Schemas["DashboardDay"];
export type AppNotification = Schemas["NotificationResponse"];
export type NotificationPreference = Schemas["PreferenceResponse"];

// Automation (BE-1.3)
export type Rule = Schemas["RuleResponse"];
export type RuleRequest = Schemas["RuleRequest"];
export type RuleAction = Schemas["RuleAction"];
export type TriggerConfig = Schemas["TriggerConfig"];
export type OutboundContent = Schemas["OutboundContent"];
export type MessageButton = Schemas["MessageButton"];
export type RuleStats = Schemas["RuleStatsResponse"];
export type BacklogRun = Schemas["BacklogRunResponse"];
export type Flow = Schemas["FlowResponse"];
export type FlowGraph = Schemas["FlowGraph"];
export type FlowNode = Schemas["FlowNode"];
export type FlowEdge = Schemas["FlowEdge"];
export type FlowCondition = Schemas["FlowCondition"];
export type FlowIssue = Schemas["FlowIssue"];
export type FlowValidation = Schemas["FlowValidation"];
export type AutomationSettings = Schemas["SettingsResponse"];
export type RuleTestRequest = Schemas["RuleTestRequest"];
export type RuleTestResult = Schemas["RuleTestResponse"];
export type FlowTestResult = Schemas["FlowTestResponse"];
export type SandboxStep = Schemas["SandboxStep"];
export type SandboxMessage = Schemas["SandboxMessage"];

// Catalog (BE-1.6)
export type Category = Schemas["CategoryResponse"];
export type Product = Schemas["ProductResponse"];
export type ProductRequest = Schemas["ProductRequest"];
export type Variant = Schemas["VariantResponse"];
export type VariantRequest = Schemas["VariantRequest"];
export type Money = Schemas["Money"];
export type CardSet = Schemas["CardSetResponse"];
export type StorefrontCard = Schemas["StorefrontCard"];
export type CatalogImport = Schemas["ImportResponse"];

/** Rule triggers the backend accepts now (`TriggerKinds.Available`); form_completed and order_status_changed come later. */
export const triggerKinds = [
  "dm_keyword",
  "comment_keyword",
  "comment_any",
  "story_reply",
  "story_mention",
  "live_comment",
  "post_share",
  "new_conversation",
  "postback",
  "outside_business_hours",
] as const;
export type TriggerKind = (typeof triggerKinds)[number];
export const commentTriggers: readonly string[] = ["comment_keyword", "comment_any", "live_comment"];

export const matchModes = ["contains", "exact", "any_of", "pattern"] as const;
export type MatchMode = (typeof matchModes)[number];
export type CommentScope = "all" | "post" | "next_post";

/** `ActionKinds.Available`; schedule_followup and capture_phone come later. */
export const actionKinds = ["send_message", "private_reply", "public_reply", "send_cards", "start_flow", "add_tag", "remove_tag", "set_field", "handoff", "pause_ai", "notify_team"] as const;
export type ActionKind = (typeof actionKinds)[number];

/** `FlowNodeTypes.Available`; follow_gate comes with BE-1.8. */
export const flowNodeTypes = ["message", "question", "condition", "delay", "storefront", "action", "ai", "end"] as const;
export type FlowNodeType = (typeof flowNodeTypes)[number];
export const answerTypes = ["text", "number", "phone", "choice"] as const;

export const productStatuses = ["active", "draft", "archived"] as const;
export type ProductStatus = (typeof productStatuses)[number];
export type StockPolicy = "track" | "unlimited";

export type WorkspaceRole = "owner" | "admin" | "agent" | "viewer";
export type ConversationStatus = "open" | "pending" | "handed_off" | "closed";
export type MessageStatus = "received" | "queued" | "sent" | "read" | "failed";
export type ChannelStatus = "connecting" | "active" | "token_expiring" | "reauth_required" | "disconnected";
export type Industry = "clothing" | "cosmetics" | "jewelry" | "beauty_clinic" | "courses" | "other";

export const industries: Industry[] = ["clothing", "cosmetics", "jewelry", "beauty_clinic", "courses", "other"];
export const roles: WorkspaceRole[] = ["owner", "admin", "agent", "viewer"];
