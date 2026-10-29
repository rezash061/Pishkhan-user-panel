
/** Base URL of the Api host, without a trailing slash. Server side only. */
export const apiBaseUrl = (process.env.PISHKHAN_API_URL ?? "http://localhost:5080").replace(/\/+$/, "");

/** __Host- cookies need HTTPS; local development over http://localhost uses plain names. */
export const secureCookies = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : process.env.NODE_ENV === "production";
