import { notFound } from "next/navigation";
import { EditRule } from "@/features/automations/rule-editor";

export default async function Page({ params }: { params: Promise<{ ruleId: string }> }) {
  const { ruleId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(ruleId)) notFound();
  return <EditRule ruleId={ruleId} />;
}
