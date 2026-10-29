import { redirect } from "next/navigation";
import { ConnectInstagramStep } from "@/features/onboarding/connect-step";

export default async function OnboardingConnectPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  if (!params.ws || !/^[0-9a-f-]{36}$/i.test(params.ws)) redirect("/workspaces");
  return <ConnectInstagramStep workspaceId={params.ws} status={params.status ?? null} reason={params.reason ?? null} />;
}
