import type { components } from "./schema";

type Schemas = components["schemas"];


export type Me = Schemas["MeResponse"];
export type Workspace = Schemas["WorkspaceResponse"];
export type Member = Schemas["MemberResponse"];
export type Channel = Schemas["ChannelResponse"];
export type Media = Schemas["MediaResponse"];
/** .NET documents integers as `number | string` in OpenAPI 3.1; on the wire they are JSON numbers. */
export type Conversation = Omit<Schemas["ConversationResponse"], "unreadCount"> & { unreadCount: number };
export type Message = Schemas["MessageResponse"];
export type Note = Schemas["NoteResponse"];
export type QuickReply = Schemas["QuickReplyResponse"];
export type Session = Schemas["SessionResponse"];
export type BusinessHours = Schemas["BusinessHoursDto"];
export type DayHours = Schemas["DayHours"];
export type Invitation = Schemas["InvitationResponse"];
export type FileInfo = Schemas["FileResponse"];
export type Page<T> = { items: T[]; nextCursor: string | null };

export type WorkspaceRole = "owner" | "admin" | "agent" | "viewer";
export type ConversationStatus = "open" | "pending" | "handed_off" | "closed";
export type MessageStatus = "received" | "queued" | "sent" | "read" | "failed";
export type ChannelStatus = "connecting" | "active" | "token_expiring" | "reauth_required" | "disconnected";
export type Industry = "clothing" | "cosmetics" | "jewelry" | "beauty_clinic" | "courses" | "other";

export const industries: Industry[] = ["clothing", "cosmetics", "jewelry", "beauty_clinic", "courses", "other"];
export const roles: WorkspaceRole[] = ["owner", "admin", "agent", "viewer"];
