import { notFound, redirect } from "next/navigation";
import { TemplateStep } from "@/features/onboarding/template-step";
import { loadWorkspace } from "@/lib/api/server-data";

export default async function OnboardingTemplatePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  if (!params.ws || !/^[0-9a-f-]{36}$/i.test(params.ws)) redirect("/workspaces");
  const { workspace, status } = await loadWorkspace(params.ws);
  if (status === 401) redirect(`/login?expired=1&next=/onboarding/template?ws=${params.ws}`);
  if (!workspace) notFound();
  return <TemplateStep workspaceId={workspace.id} role={workspace.role} />;
}
