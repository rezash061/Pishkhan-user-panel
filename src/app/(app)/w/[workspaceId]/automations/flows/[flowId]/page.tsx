import { notFound } from "next/navigation";
import { EditFlow } from "@/features/flows/flow-editor";

export default async function Page({ params }: { params: Promise<{ flowId: string }> }) {
  const { flowId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(flowId)) notFound();
  return <EditFlow flowId={flowId} />;
}
