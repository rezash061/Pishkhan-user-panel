/** TanStack Query keys, in one place so realtime handlers and mutations update the same caches. */
export const qk = {
  me: ["me"] as const,
  workspaces: ["workspaces"] as const,
  workspace: (ws: string) => ["workspace", ws] as const,
  channels: (ws: string) => ["channels", ws] as const,
  media: (ws: string, channelId: string) => ["media", ws, channelId] as const,
  members: (ws: string) => ["members", ws] as const,
  businessHours: (ws: string) => ["business-hours", ws] as const,
  quickReplies: (ws: string) => ["quick-replies", ws] as const,
  conversationLists: (ws: string) => ["conversations", ws] as const,
  conversationList: (ws: string, filter: string) => ["conversations", ws, filter] as const,
  conversation: (ws: string, id: string) => ["conversation", ws, id] as const,
  messages: (ws: string, id: string) => ["messages", ws, id] as const,
  notes: (ws: string, id: string) => ["notes", ws, id] as const,
  sessions: ["sessions"] as const,
};
