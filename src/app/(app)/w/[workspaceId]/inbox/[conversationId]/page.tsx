import { notFound } from "next/navigation";
import { ConversationView } from "@/features/inbox/conversation-view";

export default async function ConversationPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(conversationId)) notFound();
  return <ConversationView key={conversationId} conversationId={conversationId} />;
}
