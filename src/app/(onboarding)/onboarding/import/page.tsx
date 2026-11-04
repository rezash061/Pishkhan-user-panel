import { notFound, redirect } from "next/navigation";
import { ImportStep } from "@/features/onboarding/import-step";
import { loadWorkspace } from "@/lib/api/server-data";

export default async function OnboardingImportPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  if (!params.ws || !/^[0-9a-f-]{36}$/i.test(params.ws)) redirect("/workspaces");
  const { workspace, status } = await loadWorkspace(params.ws);
  if (status === 401) redirect(`/login?expired=1&next=/onboarding/import?ws=${params.ws}`);
  if (!workspace) notFound();
  return <ImportStep workspaceId={workspace.id} role={workspace.role} />;
}
