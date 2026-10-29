import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cookieNames } from "@/lib/auth/cookies";

/** "/" opens the last workspace (PWA start URL); `?go=inbox` is the manifest shortcut. */
export default async function Home({ searchParams }: { searchParams: Promise<{ go?: string }> }) {
  const { go } = await searchParams;
  const last = (await cookies()).get(cookieNames.lastWorkspace)?.value;
  if (!last || !/^[0-9a-f-]{36}$/i.test(last)) redirect("/workspaces");
  redirect(go === "inbox" ? `/w/${last}/inbox` : `/w/${last}`);
}
