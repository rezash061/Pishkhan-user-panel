import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cookieNames } from "@/lib/auth/cookies";

/**
 * Instagram OAuth lands here (backend `Instagram:PanelReturnUrl`, `?status=connected|denied|error&reason=&channel=`).
 * The page that started the connect stored where to return in the `pk-oauth` cookie: onboarding or the channels page.
 */
export default async function OAuthReturn({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const jar = await cookies();
  const [workspaceId, from] = (jar.get("pk-oauth")?.value ?? "").split("|");
  const ws = workspaceId && /^[0-9a-f-]{36}$/i.test(workspaceId) ? workspaceId : jar.get(cookieNames.lastWorkspace)?.value;
  const query = new URLSearchParams();
  for (const key of ["status", "reason", "channel"]) if (params[key]) query.set(key, params[key]!);
  if (!ws) redirect("/workspaces");
  redirect(from === "onboarding" ? `/onboarding/connect?ws=${ws}&${query}` : `/w/${ws}/channels?${query}`);
}
