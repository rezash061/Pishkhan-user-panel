import { notFound } from "next/navigation";
import { TracePage } from "@/features/agent/trace-page";

export default async function Page({ params }: { params: Promise<{ traceId: string }> }) {
  const { traceId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(traceId)) notFound();
  return <TracePage traceId={traceId} />;
}
