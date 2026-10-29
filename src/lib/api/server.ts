import "server-only";
import createClient from "openapi-fetch";
import { getAccessToken } from "@/lib/auth/session";
import { apiBaseUrl } from "@/lib/env";
import type { paths } from "./schema";

/** Typed backend client for server components, authenticated with the caller's access token. */
export async function serverApi() {
  const token = await getAccessToken();
  return createClient<paths>({
    baseUrl: apiBaseUrl,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    fetch: (request) => fetch(request, { cache: "no-store" }),
  });
}
