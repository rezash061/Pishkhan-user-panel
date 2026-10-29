import { getRequestConfig } from "next-intl/server";

/** fa-IR only for now (overview assumption A4); the catalog is per app, so adding fa-AF later is a new file. */
export default getRequestConfig(async () => ({
  locale: "fa",
  timeZone: "Asia/Tehran",
  messages: (await import("../../messages/fa.json")).default,
}));
